const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')

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
  ipcMain.handle('swtd:list-skus', async (_evt, workspacePath) => {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return { ok: false, error: 'Workspace path missing.', items: [] }
    }
    const entries = await fs.promises.readdir(workspacePath, { withFileTypes: true })
    const items = []
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const skuDir = path.join(workspacePath, e.name)
      const hasBrief = fs.existsSync(path.join(skuDir, 'brief.json'))
      items.push({ name: e.name, path: skuDir, hasBrief })
    }
    items.sort((a, b) => a.name.localeCompare(b.name))
    return { ok: true, items }
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

    runRuntimeBin({
      runtimeRoot: RUNTIME_ROOT,
      repoRoot: REPO_ROOT,
      bin: 'listing',
      skuPath,
      extraArgs,
      signal: controller.signal,
      env: { SWTD_DESKTOP: '1' },
      onLine: ({ stream, line, ts }) => {
        send('swtd:pipeline-event', { runId, kind: 'log', stream, line, ts })
      }
    })
      .then((result) => {
        activeRuns.delete(runId)
        send('swtd:pipeline-event', {
          runId,
          kind: 'end',
          ok: result.ok,
          code: result.code,
          aborted: result.aborted,
          signal: result.signal,
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
