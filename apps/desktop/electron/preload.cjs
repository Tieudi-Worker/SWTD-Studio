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
  // Build a `swtd-asset://` URL for an absolute preview file path. No IPC
  // round-trip; this is a pure string transform exposed for ergonomics so
  // renderer code doesn't need to know the protocol name. Returns null for
  // empty / non-string input.
  assetUrl: (absPath) => {
    if (!absPath || typeof absPath !== 'string') return null
    const normalized = absPath.replace(/\\/g, '/')
    return `swtd-asset://abs${normalized.startsWith('/') ? '' : '/'}${encodeURI(normalized)}`
  },
  revealPath: (targetPath) => ipcRenderer.invoke('swtd:reveal-path', targetPath),
  // Phase 2 — read a brand-context markdown file from disk applying the
  // workspace-default + SKU-override resolution rule. Read-only. Filename
  // must end in `.md`; main process path-checks the resolved file sits
  // under the workspace root. Returns:
  //   { ok: true, content: string, source: 'sku'|'workspace' }
  //   { ok: false, source: 'none' }                                 // file absent
  //   { ok: false, error: '<reason>' }                              // path rejected
  readBrandFile: (args) => ipcRenderer.invoke('swtd:read-brand-file', args),
  onPipelineEvent: (handler) => {
    listeners.add(handler)
    return () => listeners.delete(handler)
  }
})
