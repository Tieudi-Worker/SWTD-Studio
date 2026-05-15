const { app, BrowserWindow, Menu, ipcMain, dialog, shell, protocol } = require('electron')
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

let mainWindow = null
const activeRuns = new Map() // runId -> AbortController

async function loadCore() {
  return import(pathToFileURL(CORE_ENTRY).href)
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

app.whenReady().then(() => {
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
  // Phase 3 — Temp generated-image cache (Boss-locked Q2)
  //
  // Path: <sku>/output/tmp-generated/slot${id}-${timestamp}.png
  // Sidecar: <sku>/output/tmp-generated/slot${id}-${timestamp}.json
  //
  // Operator-reviewable preview output from provider adapters. 7-day TTL.
  // Auto-cleaned on app startup, SKU open, and before each new generation.
  // Approved/export remains a separate manual step (NOT auto-promoted).
  // ──────────────────────────────────────────────────────────────────────────

  const TMP_TTL_MS = 7 * 24 * 60 * 60 * 1000   // 7 days
  const TMP_DIR_NAME = path.join('output', 'tmp-generated')

  function tmpDirFor(skuPath) {
    if (!skuPath || typeof skuPath !== 'string') return null
    const sku = path.resolve(skuPath)
    return path.join(sku, TMP_DIR_NAME)
  }

  // Path-safety: the resolved candidate MUST live under tmpDir; reject
  // anything that escapes (.. traversal, symlink chicanery).
  function isUnderTmpDir(candidate, tmpDir) {
    const c = path.resolve(candidate)
    const d = path.resolve(tmpDir)
    return c === d || c.startsWith(d + path.sep)
  }

  ipcMain.handle('swtd:save-generated-image', async (_evt, args = {}) => {
    const { skuPath, slotId, providerId, templateId, angleId, aspectRatio, mime, bytes } = args
    if (!skuPath || typeof skuPath !== 'string') return { ok: false, error: 'skuPath required' }
    if (!Number.isInteger(slotId) || slotId < 1 || slotId > 8) return { ok: false, error: 'slotId 1..8 required' }
    if (mime !== 'image/png') return { ok: false, error: 'only image/png is supported in v1' }
    if (!bytes || !(bytes instanceof Uint8Array || bytes instanceof ArrayBuffer || Array.isArray(bytes))) {
      return { ok: false, error: 'bytes must be Uint8Array / ArrayBuffer / number[]' }
    }
    const tmpDir = tmpDirFor(skuPath)
    if (!tmpDir) return { ok: false, error: 'invalid skuPath' }
    try {
      await fs.promises.mkdir(tmpDir, { recursive: true })
      const generatedAt = Date.now()
      const expiresAt = generatedAt + TMP_TTL_MS
      const base = `slot${slotId}-${generatedAt}`
      const pngPath = path.join(tmpDir, base + '.png')
      const jsonPath = path.join(tmpDir, base + '.json')
      if (!isUnderTmpDir(pngPath, tmpDir) || !isUnderTmpDir(jsonPath, tmpDir)) {
        return { ok: false, error: 'path safety check failed' }
      }
      const buf = Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes)
      await fs.promises.writeFile(pngPath, buf)
      const sidecar = {
        generatedAt,
        expiresAt,
        providerId: providerId || null,
        slotId,
        templateId: templateId || null,
        angleId: angleId || null,
        aspectRatio: aspectRatio || null
      }
      await fs.promises.writeFile(jsonPath, JSON.stringify(sidecar, null, 2))
      return { ok: true, file: pngPath, generatedAt, expiresAt, providerId: sidecar.providerId }
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) }
    }
  })

  ipcMain.handle('swtd:list-tmp-generated', async (_evt, args = {}) => {
    const { skuPath } = args
    if (!skuPath || typeof skuPath !== 'string') return { ok: false, error: 'skuPath required' }
    const tmpDir = tmpDirFor(skuPath)
    if (!tmpDir || !fs.existsSync(tmpDir)) return { ok: true, entries: [] }
    try {
      const names = await fs.promises.readdir(tmpDir)
      const now = Date.now()
      const entries = []
      for (const name of names) {
        if (!name.endsWith('.json')) continue
        const jsonPath = path.join(tmpDir, name)
        if (!isUnderTmpDir(jsonPath, tmpDir)) continue
        let meta
        try {
          meta = JSON.parse(await fs.promises.readFile(jsonPath, 'utf8'))
        } catch { continue }
        if (!meta || typeof meta.expiresAt !== 'number') continue
        if (meta.expiresAt <= now) continue                   // skip expired; cleanup will sweep
        const pngPath = jsonPath.replace(/\.json$/, '.png')
        if (!fs.existsSync(pngPath)) continue
        entries.push({
          slotId: meta.slotId,
          file: pngPath,
          generatedAt: meta.generatedAt,
          expiresAt: meta.expiresAt,
          providerId: meta.providerId || null,
          templateId: meta.templateId || null,
          angleId: meta.angleId || null,
          aspectRatio: meta.aspectRatio || null
        })
      }
      // Newest first per slot so the renderer can take entries[0] per slot
      // without extra sorting.
      entries.sort((a, b) => b.generatedAt - a.generatedAt)
      return { ok: true, entries }
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) }
    }
  })

  ipcMain.handle('swtd:cleanup-tmp-generated', async (_evt, args = {}) => {
    const { skuPath } = args
    if (!skuPath || typeof skuPath !== 'string') return { ok: false, error: 'skuPath required' }
    const tmpDir = tmpDirFor(skuPath)
    if (!tmpDir || !fs.existsSync(tmpDir)) return { ok: true, deleted: 0, kept: 0 }
    try {
      const names = await fs.promises.readdir(tmpDir)
      const now = Date.now()
      let deleted = 0
      let kept = 0
      // Pass 1: find expired / orphan-png sidecars; collect both members of
      // the pair so we delete png + json together.
      for (const name of names) {
        if (!name.endsWith('.json')) continue
        const jsonPath = path.join(tmpDir, name)
        if (!isUnderTmpDir(jsonPath, tmpDir)) continue
        let meta = null
        try {
          meta = JSON.parse(await fs.promises.readFile(jsonPath, 'utf8'))
        } catch { /* malformed sidecar — treat as expired */ }
        const isExpired = !meta || typeof meta.expiresAt !== 'number' || meta.expiresAt <= now
        const pngPath = jsonPath.replace(/\.json$/, '.png')
        if (isExpired) {
          try { await fs.promises.unlink(jsonPath) } catch {}
          try { if (fs.existsSync(pngPath)) await fs.promises.unlink(pngPath) } catch {}
          deleted++
        } else {
          kept++
        }
      }
      // Pass 2: orphan PNGs (no matching json) — delete; they're inaccessible
      // anyway because we never serve them without metadata.
      for (const name of names) {
        if (!name.endsWith('.png')) continue
        const pngPath = path.join(tmpDir, name)
        const jsonPath = pngPath.replace(/\.png$/, '.json')
        if (!fs.existsSync(jsonPath)) {
          try { await fs.promises.unlink(pngPath); deleted++ } catch {}
        }
      }
      return { ok: true, deleted, kept }
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) }
    }
  })

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
  if (process.platform !== 'darwin') app.quit()
})
