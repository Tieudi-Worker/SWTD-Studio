const { contextBridge, ipcRenderer } = require('electron')

const listeners = new Set()
ipcRenderer.on('swtd:pipeline-event', (_evt, payload) => {
  for (const fn of listeners) {
    try { fn(payload) } catch (err) { console.error('[swtd preload] listener error', err) }
  }
})

contextBridge.exposeInMainWorld('swtd', {
  ping: () => ipcRenderer.invoke('swtd:ping'),
  pickFolder: (opts) => ipcRenderer.invoke('swtd:pick-folder', opts),
  validateSku: (skuPath) => ipcRenderer.invoke('swtd:validate-sku', skuPath),
  listSkus: (workspacePath) => ipcRenderer.invoke('swtd:list-skus', workspacePath),
  readBrief: (skuPath) => ipcRenderer.invoke('swtd:read-brief', skuPath),
  runListing: (payload) => ipcRenderer.invoke('swtd:run-listing', payload),
  runAplus: (payload) => ipcRenderer.invoke('swtd:run-aplus', payload),
  cancelPipeline: (runId) => ipcRenderer.invoke('swtd:cancel-pipeline', runId),
  validateListingOutput: (skuPath) => ipcRenderer.invoke('swtd:validate-listing-output', skuPath),
  validateAplusOutput: (skuPath) => ipcRenderer.invoke('swtd:validate-aplus-output', skuPath),
  revealPath: (targetPath) => ipcRenderer.invoke('swtd:reveal-path', targetPath),
  onPipelineEvent: (handler) => {
    listeners.add(handler)
    return () => listeners.delete(handler)
  }
})
