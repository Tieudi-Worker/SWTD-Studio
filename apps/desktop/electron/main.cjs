const { app, BrowserWindow, Menu, ipcMain, dialog, shell, protocol, safeStorage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')
const { discoverSkus } = require('./sku-discovery.cjs')

// swtd-asset:// custom protocol — serves slot/A+ preview images to the
// renderer. Registered as `standard + secure + supportFetchAPI` so it can
// be used in <img src>, fetch(), and cache like https://.
//
// Must be called before app.whenReady().
const ASSET_PROTOCOL = 'swtd-asset'
const PREVIEW_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])

protocol.registerSchemesAsPrivileged([
  {
    scheme: ASSET_PROTOCOL,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
])

const isDev = !app.isPackaged

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const RUNTIME_ROOT = path.join(REPO_ROOT, 'runtime')
const CORE_ENTRY = path.join(REPO_ROOT, 'packages', 'core', 'src', 'index.js')
const PROVIDER_CORE_ENTRY = path.join(REPO_ROOT, 'packages', 'provider-core', 'src', 'index.js')

let mainWindow = null
const activeRuns = new Map() // runId -> AbortController

// Phase 4 — Provider Core wiring. The package is ESM, so it must be loaded
// via dynamic import. We materialise the singleton at boot (see
// `initializeProviderCore`) and stash it here for the IPC handlers.
let providerCore = null
const activeProviderGenerations = new Map() // genId -> AbortController

async function loadCore() {
  return import(pathToFileURL(CORE_ENTRY).href)
}

async function loadProviderCore() {
  return import(pathToFileURL(PROVIDER_CORE_ENTRY).href)
}

/**
 * Build the ProviderCore singleton, backed by Electron's `safeStorage` for
 * the KeyVault and the filesystem for the MediaStore. Idempotent — repeat
 * calls return the cached instance.
 *
 * Plan §4.7 + §4.1: safeStorage is the v1 backend; if encryption is not
 * available on this host the package falls back to AES-on-disk + logs once.
 */
async function initializeProviderCore() {
  if (providerCore) return providerCore
  const mod = await loadProviderCore()
  const userData = app.getPath('userData')
  const keyVault = mod.createSafeStorageVault({
    safeStorage,
    vaultFilePath: path.join(userData, 'provider-core', 'keys.vault'),
    machineSaltSeed: userData,
    logger: mod.createLogger(console)
  })
  const mediaStore = mod.createMediaStore({ logger: mod.createLogger(console) })
  providerCore = mod.createProviderCore({
    keyVault,
    mediaStore,
    logger: mod.createLogger(console)
  })

  // Phase 4.3 — restore the operator's configured Custom Provider, if any.
  // The non-secret config (providerName / baseUrl / modelPrefix) lives in
  // a small JSON file under userData; the secret apiKey lives in the
  // vault. Boot-time re-register replaces the no-op `customProviderTemplate`
  // so generateImage works after a restart without re-saving Settings.
  const cfg = await loadCustomProviderConfig()
  if (cfg) {
    try {
      providerCore.registerCustom({
        id: 'custom',
        providerName: cfg.providerName,
        baseUrl: cfg.baseUrl,
        modelPrefix: cfg.modelPrefix || null,
        models: Array.isArray(cfg.models) ? cfg.models : undefined
      })
    } catch (e) {
      console.warn('[provider-core] could not re-register custom provider:', e.message)
    }
  }
  return providerCore
}

/* -------------------------------------------------------------------------- */
/* Custom-provider config persistence (non-secret).                            */
/*                                                                             */
/* The apiKey itself lives in the safeStorage-backed KeyVault. The other       */
/* three Boss-D1 fields (providerName, baseUrl, optional modelPrefix) are      */
/* persisted as JSON under userData so the adapter can be re-registered at     */
/* boot. We deliberately keep this OUT of the vault — the vault encrypts       */
/* every value, and providerName/baseUrl are not secret. Keeping them          */
/* separate also makes them inspectable for debugging without touching the     */
/* encrypted store.                                                            */
/* -------------------------------------------------------------------------- */

function customConfigPath() {
  return path.join(app.getPath('userData'), 'provider-core', 'custom-config.json')
}

async function loadCustomProviderConfig() {
  try {
    const raw = await fs.promises.readFile(customConfigPath(), 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.providerName !== 'string' || !parsed.providerName) return null
    if (typeof parsed.baseUrl !== 'string' || !parsed.baseUrl) return null
    return {
      providerName: parsed.providerName,
      baseUrl: parsed.baseUrl,
      modelPrefix: typeof parsed.modelPrefix === 'string' ? parsed.modelPrefix : null,
      models: Array.isArray(parsed.models) ? parsed.models.filter((m) => typeof m === 'string') : null
    }
  } catch {
    return null
  }
}

async function saveCustomProviderConfig(cfg) {
  const dir = path.dirname(customConfigPath())
  await fs.promises.mkdir(dir, { recursive: true })
  const payload = {
    providerName: cfg.providerName,
    baseUrl: cfg.baseUrl,
    modelPrefix: cfg.modelPrefix || null,
    models: Array.isArray(cfg.models) ? cfg.models : null
  }
  const tmp = customConfigPath() + '.tmp'
  await fs.promises.writeFile(tmp, JSON.stringify(payload, null, 2))
  await fs.promises.rename(tmp, customConfigPath())
}

async function clearCustomProviderConfig() {
  try { await fs.promises.unlink(customConfigPath()) } catch { /* ignore */ }
}

/**
 * Resolve a reference-image path to a Buffer that the OpenAI / Kie /Custom
 * adapter can stream into multipart form-data. Phase 4.2 ships local path
 * resolution only; remote `swtd-asset://` URIs are decoded back to absolute
 * paths. Anything else (http/https/data:) is rejected so the renderer
 * cannot trick main into reading arbitrary URLs.
 */
async function resolveReferenceImage(ref) {
  if (!ref || typeof ref !== 'string') return null
  let abs = ref
  if (/^swtd-asset:\/\//i.test(abs)) {
    try {
      const u = new URL(abs)
      // swtd-asset://abs/<encoded-absolute-path>
      abs = decodeURIComponent(u.pathname || '')
    } catch { return null }
  }
  // Reject anything that still looks like a URL after decoding.
  if (/^[a-z]+:\/\//i.test(abs)) return null
  const resolved = path.resolve(abs)
  if (!fs.existsSync(resolved)) return null
  return fs.promises.readFile(resolved)
}

function newGenerationId() {
  return `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'SWTD Studio',
    backgroundColor: '#0A0A0B',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function newRunId() {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// Detect the Phase 2.5 cohesion pause emitted by the legacy master.js +
// CohesionValidator. We scan the stream for two signals:
//   1. A pino JSON line with `msg: "Pipeline paused for Cohesion Validation"`
//      and a `requestPath` field (most reliable, written by Master).
//   2. The pretty-printed `Read <path>/_cohesion_request.json` instruction
//      block emitted by CohesionValidator (fallback when JSON parse fails).
// Either signal yields an absolute path to the request JSON.
function detectCohesionFromLine(line) {
  if (!line) return null
  const trimmed = line.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed)
      const msg = typeof obj.msg === 'string' ? obj.msg : ''
      if (/paused for Cohesion Validation/i.test(msg) && typeof obj.requestPath === 'string') {
        return { requestPath: obj.requestPath, paused: true }
      }
      // Some lines from CohesionValidator carry only msg with the path inline.
      const inline = msg.match(/(\S*_cohesion_request\.json)/)
      if (inline) return { requestPath: inline[1], paused: /pause/i.test(msg) || undefined }
    } catch {
      /* fall through to raw parse */
    }
  }

  if (/PAUSE: Cohesion Validation/i.test(trimmed)) {
    return { paused: true }
  }
  const m = trimmed.match(/(\S*_cohesion_request\.json)/)
  if (m) return { requestPath: m[1] }
  return null
}

async function readBriefSafe(briefPath) {
  try {
    const raw = await fs.promises.readFile(briefPath, 'utf8')
    const parsed = JSON.parse(raw)
    return { ok: true, brief: parsed }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  // --- Preview asset protocol -----------------------------------------------
  // Serves whitelisted preview files (slot images + A+ module images) to the
  // renderer via `swtd-asset://abs/path`. Safety: only files under a
  // `/output/<step>/...` segment with an allowed extension are served. Path
  // traversal sequences are rejected. No file outside that pattern is served.
  protocol.handle(ASSET_PROTOCOL, async (req) => {
    try {
      const url = new URL(req.url)
      // swtd-asset://abs/<encoded-absolute-path>  → url.pathname is `/<…>`
      const absPath = path.resolve(decodeURIComponent(url.pathname || ''))
      if (!absPath || absPath.includes('\u0000')) {
        return new Response('bad path', { status: 400 })
      }
      const ext = path.extname(absPath).toLowerCase()
      if (!PREVIEW_EXT.has(ext)) {
        return new Response('extension not allowed', { status: 403 })
      }
      // Must live under an /output/<step>/ segment to prevent the protocol
      // becoming a generic disk reader.
      const norm = absPath.replace(/\\/g, '/')
      // Phase 3 — also allow `/output/tmp-generated/` so renderer-generated
      // images (provider-adapter output, 7-day TTL) display via the same path.
      if (!/\/output\/(listing|aplus|tmp-generated)\//i.test(norm)) {
        return new Response('path outside output directory', { status: 403 })
      }
      if (!fs.existsSync(absPath)) {
        return new Response('not found', { status: 404 })
      }
      const data = await fs.promises.readFile(absPath)
      const mime = ext === '.png' ? 'image/png'
        : ext === '.webp' ? 'image/webp'
          : 'image/jpeg'
      return new Response(data, {
        status: 200,
        headers: { 'Content-Type': mime, 'Cache-Control': 'no-cache' }
      })
    } catch (err) {
      return new Response(`asset error: ${err.message || err}`, { status: 500 })
    }
  })

  // --- Health probe ----------------------------------------------------------
  ipcMain.handle('swtd:ping', () => ({ ok: true, ts: Date.now() }))

  // --- Folder pickers --------------------------------------------------------
  ipcMain.handle('swtd:pick-folder', async (_evt, opts = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: opts.title || 'Select folder',
      defaultPath: opts.defaultPath || REPO_ROOT,
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths.length) {
      return { canceled: true, path: null }
    }
    return { canceled: false, path: result.filePaths[0] }
  })

  // --- SKU validation --------------------------------------------------------
  ipcMain.handle('swtd:validate-sku', async (_evt, skuPath) => {
    if (!skuPath || typeof skuPath !== 'string') {
      return { ok: false, error: 'No SKU path provided.' }
    }
    if (!fs.existsSync(skuPath)) {
      return { ok: false, error: 'SKU folder does not exist.' }
    }
    const stat = await fs.promises.stat(skuPath)
    if (!stat.isDirectory()) {
      return { ok: false, error: 'Path is not a directory.' }
    }
    const briefPath = path.join(skuPath, 'brief.json')
    if (!fs.existsSync(briefPath)) {
      return { ok: false, error: 'brief.json not found in SKU folder.' }
    }
    const { ok, brief, error } = await readBriefSafe(briefPath)
    if (!ok) return { ok: false, error: `brief.json invalid: ${error}` }
    return {
      ok: true,
      brief: {
        sku: brief.sku || null,
        product_name: brief.product_name || null,
        category: brief.category || null,
        materials: Array.isArray(brief.materials) ? brief.materials.length : 0,
        features: Array.isArray(brief.features) ? brief.features.length : 0,
        occasion: brief.occasion || null,
        dimensions: brief.dimensions || null
      }
    }
  })

  // --- Workspace listing -----------------------------------------------------
  // See sku-discovery.cjs for the discovery logic and modes ('single',
  // 'parent', 'empty'). Errors surface as { ok:false, error, items:[] } so the
  // renderer can render an empty-state instead of crashing.
  ipcMain.handle('swtd:list-skus', async (_evt, workspacePath) => {
    return discoverSkus(workspacePath)
  })

  // --- Run listing pipeline --------------------------------------------------
  ipcMain.handle('swtd:run-listing', async (_evt, payload = {}) => {
    const { skuPath, skipSlots, dryRun } = payload
    if (!skuPath) return { ok: false, error: 'skuPath required' }
    if (!fs.existsSync(path.join(skuPath, 'brief.json'))) {
      return { ok: false, error: 'brief.json not found — validate the SKU first.' }
    }

    const runId = newRunId()
    const controller = new AbortController()
    activeRuns.set(runId, controller)

    const extraArgs = []
    if (skipSlots && skipSlots.length) {
      extraArgs.push('--skip-slots', skipSlots.join(','))
    }
    if (dryRun) extraArgs.push('--dry-run')

    const { runRuntimeBin } = await loadCore()

    send('swtd:pipeline-event', {
      runId,
      kind: 'start',
      bin: 'listing',
      skuPath,
      extraArgs,
      ts: Date.now()
    })

    // Track cohesion-pause markers seen in the stream. The legacy pipeline
    // exits with code 2 when it wants Claude Code Vision to score the 8 slots
    // and write _cohesion_report.json. We surface that as a 'paused' state
    // instead of a generic failure once the run ends.
    let cohesionPaused = false
    let cohesionRequestPath = null

    runRuntimeBin({
      runtimeRoot: RUNTIME_ROOT,
      repoRoot: REPO_ROOT,
      bin: 'listing',
      skuPath,
      extraArgs,
      signal: controller.signal,
      env: { SWTD_DESKTOP: '1' },
      onLine: ({ stream, line, ts }) => {
        const sig = detectCohesionFromLine(line)
        if (sig) {
          if (sig.paused) cohesionPaused = true
          if (sig.requestPath && !cohesionRequestPath) {
            cohesionRequestPath = sig.requestPath
          }
        }
        send('swtd:pipeline-event', { runId, kind: 'log', stream, line, ts })
      }
    })
      .then((result) => {
        activeRuns.delete(runId)
        // Exit code 2 from master.js means "paused, awaiting human review".
        // Combined with a cohesion marker in the stream, we promote the run
        // to a 'paused' state so the UI shows review guidance rather than a
        // red failure badge. We fall back to requestPath-only detection if
        // the bridge mangled the exit code.
        const paused = (result.code === 2 && (cohesionPaused || cohesionRequestPath))
          || (cohesionPaused && !!cohesionRequestPath)
        send('swtd:pipeline-event', {
          runId,
          kind: 'end',
          ok: result.ok,
          code: result.code,
          aborted: result.aborted,
          signal: result.signal,
          paused,
          pauseReason: paused ? 'cohesion-review' : null,
          cohesionRequestPath: paused ? cohesionRequestPath : null,
          ts: Date.now()
        })
      })
      .catch((err) => {
        activeRuns.delete(runId)
        send('swtd:pipeline-event', {
          runId,
          kind: 'error',
          message: err && err.message ? err.message : String(err),
          ts: Date.now()
        })
      })

    return { ok: true, runId }
  })

  // --- A+ pipeline -----------------------------------------------------------
  // Parallel to swtd:run-listing. Same legacy bridge, different `--only` target
  // and a different `--skip-slots` argv prefix (aplus_m1,... vs slot1,...).
  // The pipeline-event stream tags `bin: 'aplus'` so the renderer can route
  // events into the A+ run state instead of the listing state.
  ipcMain.handle('swtd:run-aplus', async (_evt, payload = {}) => {
    const { skuPath, skipModules, dryRun } = payload
    if (!skuPath) return { ok: false, error: 'skuPath required' }
    if (!fs.existsSync(path.join(skuPath, 'brief.json'))) {
      return { ok: false, error: 'brief.json not found — validate the SKU first.' }
    }

    const runId = newRunId()
    const controller = new AbortController()
    activeRuns.set(runId, controller)

    const extraArgs = []
    if (skipModules && skipModules.length) {
      extraArgs.push('--skip-slots', skipModules.join(','))
    }
    if (dryRun) extraArgs.push('--dry-run')

    const { runRuntimeBin } = await loadCore()

    send('swtd:pipeline-event', {
      runId,
      kind: 'start',
      bin: 'aplus',
      skuPath,
      extraArgs,
      ts: Date.now()
    })

    // Defensive: A+ shares the legacy bridge with listing, so a future
    // master.js change could surface the same exit-code-2 cohesion-pause
    // behavior for A+. Track the same markers; if the A+ pipeline never
    // emits them this stays a no-op.
    let cohesionPaused = false
    let cohesionRequestPath = null

    runRuntimeBin({
      runtimeRoot: RUNTIME_ROOT,
      repoRoot: REPO_ROOT,
      bin: 'aplus',
      skuPath,
      extraArgs,
      signal: controller.signal,
      env: { SWTD_DESKTOP: '1' },
      onLine: ({ stream, line, ts }) => {
        const sig = detectCohesionFromLine(line)
        if (sig) {
          if (sig.paused) cohesionPaused = true
          if (sig.requestPath && !cohesionRequestPath) {
            cohesionRequestPath = sig.requestPath
          }
        }
        send('swtd:pipeline-event', { runId, kind: 'log', stream, line, ts })
      }
    })
      .then((result) => {
        activeRuns.delete(runId)
        const paused = (result.code === 2 && (cohesionPaused || cohesionRequestPath))
          || (cohesionPaused && !!cohesionRequestPath)
        send('swtd:pipeline-event', {
          runId,
          kind: 'end',
          ok: result.ok,
          code: result.code,
          aborted: result.aborted,
          signal: result.signal,
          paused,
          pauseReason: paused ? 'cohesion-review' : null,
          cohesionRequestPath: paused ? cohesionRequestPath : null,
          ts: Date.now()
        })
      })
      .catch((err) => {
        activeRuns.delete(runId)
        send('swtd:pipeline-event', {
          runId,
          kind: 'error',
          message: err && err.message ? err.message : String(err),
          ts: Date.now()
        })
      })

    return { ok: true, runId }
  })

  // --- Cancel ----------------------------------------------------------------
  ipcMain.handle('swtd:cancel-pipeline', async (_evt, runId) => {
    const controller = activeRuns.get(runId)
    if (!controller) return { ok: false, error: 'no active run with that id' }
    controller.abort()
    return { ok: true }
  })

  // --- Reveal helpers (used by Project tab) ----------------------------------
  ipcMain.handle('swtd:read-brief', async (_evt, skuPath) => {
    const briefPath = path.join(skuPath || '', 'brief.json')
    if (!fs.existsSync(briefPath)) return { ok: false, error: 'brief.json missing' }
    return readBriefSafe(briefPath)
  })

  // --- Phase 2: read a brand-context markdown file ---------------------------
  // Implements Boss-locked Q2 (spec.md §7): try SKU path first, fall back to
  // workspace path. Read-only. Filename must end in `.md`. Resolved file must
  // sit under either the workspace root or the SKU root — no path traversal.
  ipcMain.handle('swtd:read-brand-file', async (_evt, args = {}) => {
    const { workspacePath, skuPath, filename } = args
    if (!filename || typeof filename !== 'string' || !filename.endsWith('.md')) {
      return { ok: false, error: 'filename must end in .md' }
    }
    if (filename.includes('/') || filename.includes('\\') || filename.includes(' ')) {
      return { ok: false, error: 'filename must be a bare name (no path separators)' }
    }
    function tryRead(rootDir, source) {
      if (!rootDir || typeof rootDir !== 'string') return null
      const root = path.resolve(rootDir)
      const candidate = path.resolve(root, filename)
      // Defence-in-depth: the resolved candidate MUST be inside root.
      if (!candidate.startsWith(root + path.sep) && candidate !== path.join(root, filename)) {
        return null
      }
      if (!fs.existsSync(candidate)) return null
      try {
        const content = fs.readFileSync(candidate, 'utf8')
        return { ok: true, content, source }
      } catch (err) {
        return { ok: false, error: err && err.message ? err.message : String(err) }
      }
    }
    // SKU first (override), workspace second (default).
    const sku = tryRead(skuPath, 'sku')
    if (sku?.ok) return sku
    if (sku && !sku.ok) return sku                     // read error surfaced
    const ws = tryRead(workspacePath, 'workspace')
    if (ws?.ok) return ws
    if (ws && !ws.ok) return ws
    return { ok: false, source: 'none' }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 4 — Provider Core IPC namespace (`swtd:provider:*`)
  //
  // Replaces the three Phase 3 handlers (`swtd:save-generated-image`,
  // `swtd:list-tmp-generated`, `swtd:cleanup-tmp-generated`) with a single
  // namespace that flows through `packages/provider-core`. The renderer
  // never makes a provider HTTP call directly — it goes through these IPCs.
  //
  // Boss D5 + D7: provider HTTP lives in main; media-store contract is
  // unchanged from Phase 3 (7-day TTL on tmp-generated/).
  // Plan §4.1, §4.2.
  // ──────────────────────────────────────────────────────────────────────────

  // Bootstrap the singleton. If construction fails (e.g. unable to write the
  // vault file), every subsequent IPC returns a clear error rather than
  // crashing the renderer.
  let providerCoreInitError = null
  try {
    await initializeProviderCore()
  } catch (err) {
    providerCoreInitError = err && err.message ? err.message : String(err)
    console.error('[provider-core] initialization failed:', providerCoreInitError)
  }

  function requireProviderCore() {
    if (!providerCore) {
      return { ok: false, error: providerCoreInitError || 'provider-core not initialized' }
    }
    return null
  }

  // List providers + key presence. Plaintext keys NEVER leave main.
  ipcMain.handle('swtd:provider:list', async () => {
    const err = requireProviderCore(); if (err) return err
    const list = providerCore.listProviders()
    const out = []
    for (const meta of list) {
      const has = await providerCore.hasKeyFor(meta.id).catch(() => false)
      out.push({ ...meta, hasKey: Boolean(has) })
    }
    return { ok: true, providers: out, vault: providerCore.keyVaultInfo() }
  })

  // Save a key. The plaintext value is consumed inside main and immediately
  // encrypted; no IPC ever reads it back.
  ipcMain.handle('swtd:provider:save-key', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    const { providerId, value } = args
    if (typeof providerId !== 'string' || !providerId) return { ok: false, error: 'providerId required' }
    if (typeof value !== 'string') return { ok: false, error: 'value (string) required' }
    try {
      await providerCore.saveKey(providerId, value)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) }
    }
  })

  // Boolean probe — renderer uses this to render `••••` chips / warning dots.
  ipcMain.handle('swtd:provider:has-key', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    const { providerId } = args
    if (typeof providerId !== 'string' || !providerId) return { ok: false, has: false }
    const has = await providerCore.hasKeyFor(providerId).catch(() => false)
    return { ok: true, has: Boolean(has) }
  })

  ipcMain.handle('swtd:provider:clear-key', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    const { providerId } = args
    if (typeof providerId !== 'string' || !providerId) return { ok: false, error: 'providerId required' }
    try {
      await providerCore.clearKey(providerId)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) }
    }
  })

  ipcMain.handle('swtd:provider:test', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    const { providerId } = args
    if (typeof providerId !== 'string' || !providerId) return { ok: false, reason: 'invalid-input' }
    try {
      const r = await providerCore.testProvider(providerId)
      return { ok: !!r?.ok, reason: r?.reason }
    } catch (e) {
      return { ok: false, reason: e?.reason || 'network' }
    }
  })

  ipcMain.handle('swtd:provider:get-route-config', async () => {
    const err = requireProviderCore(); if (err) return err
    return { ok: true, route: providerCore.getRouteConfig() }
  })

  ipcMain.handle('swtd:provider:set-route-config', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    try {
      const route = providerCore.setRouteConfig(args || {})
      return { ok: true, route }
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) }
    }
  })

  // Custom provider configuration (Boss D1: providerName + baseUrl + apiKey,
  // optional modelPrefix). The non-secret triple lives in a JSON file under
  // userData; the apiKey continues to live in the KeyVault via
  // `swtd:provider:save-key`. Saving re-registers the adapter so the
  // operator can generate immediately without restarting.
  ipcMain.handle('swtd:provider:get-custom-config', async () => {
    const err = requireProviderCore(); if (err) return err
    const cfg = await loadCustomProviderConfig()
    return { ok: true, config: cfg }
  })

  ipcMain.handle('swtd:provider:save-custom-config', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    const { providerName, baseUrl, modelPrefix, models } = args || {}
    if (typeof providerName !== 'string' || !providerName.trim()) {
      return { ok: false, error: 'providerName required' }
    }
    if (typeof baseUrl !== 'string' || !/^https?:\/\//i.test(baseUrl)) {
      return { ok: false, error: 'baseUrl must be a valid http(s) URL' }
    }
    try {
      const cfg = {
        providerName: providerName.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/, ''),
        modelPrefix: typeof modelPrefix === 'string' && modelPrefix.trim() ? modelPrefix.trim() : null,
        models: Array.isArray(models) ? models.filter((m) => typeof m === 'string' && m.trim()) : null
      }
      await saveCustomProviderConfig(cfg)
      providerCore.registerCustom({ id: 'custom', ...cfg })
      return { ok: true, config: cfg }
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) }
    }
  })

  ipcMain.handle('swtd:provider:clear-custom-config', async () => {
    const err = requireProviderCore(); if (err) return err
    try {
      await clearCustomProviderConfig()
      // Reset the in-memory adapter to the no-op template so generateImage
      // starts returning `Custom provider not configured` again.
      providerCore.resetCustomToTemplate()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) }
    }
  })

  // Unified image_generate / image_edit entry point. The renderer hands us
  // the operator's intent (prompt, optional reference image path[s], slot
  // metadata) and we return a `swtd-asset://` ready file path plus the
  // sidecar provenance.
  async function dispatchImage(handler, args = {}) {
    const err = requireProviderCore(); if (err) return err
    const genId = newGenerationId()
    const controller = new AbortController()
    activeProviderGenerations.set(genId, controller)
    try {
      // Resolve reference images (paths/swtd-asset URIs → Buffers) here in
      // main so the adapter never touches the filesystem.
      const refs = []
      const candidates = Array.isArray(args.images) ? args.images : (args.image ? [args.image] : [])
      for (const c of candidates) {
        const buf = await resolveReferenceImage(c)
        if (!buf) {
          return { ok: false, error: 'reference image not found', reason: 'invalid-input' }
        }
        refs.push(buf)
      }
      const input = { ...args }
      if (refs.length > 0) {
        input.images = refs
        delete input.image
      }
      const result = await handler(input, { signal: controller.signal })
      return { ok: true, genId, ...result }
    } catch (e) {
      const reason = e?.reason || (e?.name === 'AbortError' ? 'aborted' : 'unknown')
      return {
        ok: false,
        genId,
        reason,
        attempted: Array.isArray(e?.attempted) ? e.attempted : undefined,
        error: e && e.message ? e.message : String(e)
      }
    } finally {
      activeProviderGenerations.delete(genId)
    }
  }

  ipcMain.handle('swtd:provider:generate-image', async (_evt, args = {}) =>
    dispatchImage((input, ctx) => providerCore.generateImage(input, ctx), args)
  )
  ipcMain.handle('swtd:provider:edit-image', async (_evt, args = {}) =>
    dispatchImage((input, ctx) => providerCore.editImage(input, ctx), args)
  )

  ipcMain.handle('swtd:provider:cancel-generation', async (_evt, genId) => {
    const controller = activeProviderGenerations.get(genId)
    if (!controller) return { ok: false, error: 'no active generation with that id' }
    try { controller.abort() } catch {}
    return { ok: true }
  })

  // Research / Insight Brief — wired in P4.2 so the IPC surface is complete;
  // operator-facing Brief Step UI lands in P4.4. The default v1 search
  // backend is the offline-safe mock (plan §5 Q8).
  ipcMain.handle('swtd:provider:research-insight', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    try {
      const r = await providerCore.researchInsight(args || {})
      return { ok: true, ...r }
    } catch (e) {
      return { ok: false, reason: e?.reason || 'unknown', error: e && e.message ? e.message : String(e) }
    }
  })

  ipcMain.handle('swtd:provider:get-insight-brief', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    const skuPath = typeof args === 'string' ? args : args?.skuPath
    const brief = await providerCore.getInsightBrief(skuPath)
    return { ok: true, brief }
  })

  // Media store — replaces Phase 3's three handlers. Same on-disk layout +
  // sidecar shape, owned by `packages/provider-core/src/media-store.js`.
  ipcMain.handle('swtd:provider:list-tmp-images', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    try {
      const { entries, corrupt } = await providerCore.listTmpImages(args || {})
      return { ok: true, entries, corrupt }
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e), entries: [] }
    }
  })

  ipcMain.handle('swtd:provider:cleanup-tmp', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    try {
      const r = await providerCore.cleanupTmp(args || {})
      return { ok: true, ...r }
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e), deleted: 0, kept: 0 }
    }
  })

  ipcMain.handle('swtd:provider:promote-to-approved', async (_evt, args = {}) => {
    const err = requireProviderCore(); if (err) return err
    try {
      const r = await providerCore.promoteToApproved(args || {})
      return { ok: true, ...r }
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) }
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // End provider-core IPC namespace
  // ──────────────────────────────────────────────────────────────────────────

  // --- Reveal a file or folder in the OS file manager -----------------------
  // Used by the cohesion-pause UI to surface _cohesion_request.json so the
  // operator can hand it to Claude Code Vision and write _cohesion_report.json
  // alongside it.
  ipcMain.handle('swtd:reveal-path', async (_evt, targetPath) => {
    if (!targetPath || typeof targetPath !== 'string') {
      return { ok: false, error: 'path required' }
    }
    if (!fs.existsSync(targetPath)) {
      return { ok: false, error: 'path does not exist' }
    }
    try {
      const stat = await fs.promises.stat(targetPath)
      if (stat.isDirectory()) {
        const err = await shell.openPath(targetPath)
        if (err) return { ok: false, error: err }
      } else {
        shell.showItemInFolder(targetPath)
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) }
    }
  })

  // --- Listing output validator ---------------------------------------------
  ipcMain.handle('swtd:validate-listing-output', async (_evt, skuPath) => {
    if (!skuPath || typeof skuPath !== 'string') {
      return { ok: false, error: 'skuPath required' }
    }
    if (!fs.existsSync(skuPath)) {
      return { ok: false, error: 'SKU folder does not exist.' }
    }
    try {
      const { validateListingOutput } = await loadCore()
      const report = await validateListingOutput({ skuPath, runtimeRoot: RUNTIME_ROOT })
      return { ok: true, report }
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) }
    }
  })

  // --- A+ output validator --------------------------------------------------
  ipcMain.handle('swtd:validate-aplus-output', async (_evt, skuPath) => {
    if (!skuPath || typeof skuPath !== 'string') {
      return { ok: false, error: 'skuPath required' }
    }
    if (!fs.existsSync(skuPath)) {
      return { ok: false, error: 'SKU folder does not exist.' }
    }
    try {
      const { validateAplusOutput } = await loadCore()
      const report = await validateAplusOutput({ skuPath, runtimeRoot: RUNTIME_ROOT })
      return { ok: true, report }
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) }
    }
  })

  createWindow()
})

app.on('window-all-closed', () => {
  for (const controller of activeRuns.values()) {
    try { controller.abort() } catch {}
  }
  activeRuns.clear()
  for (const controller of activeProviderGenerations.values()) {
    try { controller.abort() } catch {}
  }
  activeProviderGenerations.clear()
  if (process.platform !== 'darwin') app.quit()
})
