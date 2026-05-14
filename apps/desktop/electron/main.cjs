const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')
const { discoverSkus } = require('./sku-discovery.cjs')

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

  createWindow()
})

app.on('window-all-closed', () => {
  for (const controller of activeRuns.values()) {
    try { controller.abort() } catch {}
  }
  activeRuns.clear()
  if (process.platform !== 'darwin') app.quit()
})
