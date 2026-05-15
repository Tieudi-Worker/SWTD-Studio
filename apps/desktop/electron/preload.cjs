const { contextBridge, ipcRenderer } = require('electron')

const listeners = new Set()
ipcRenderer.on('swtd:pipeline-event', (_evt, payload) => {
  for (const fn of listeners) {
    try { fn(payload) } catch (err) { console.error('[swtd preload] listener error', err) }
  }
})

// Build a `swtd-asset://` URL for an absolute preview file path. Used by both
// the legacy `window.swtd` namespace (Phases 1–3) and the new `window.swtdProvider`
// namespace (Phase 4). Pure string transform; no IPC round-trip.
function assetUrl(absPath) {
  if (!absPath || typeof absPath !== 'string') return null
  const normalized = absPath.replace(/\\/g, '/')
  return `swtd-asset://abs${normalized.startsWith('/') ? '' : '/'}${encodeURI(normalized)}`
}

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
  assetUrl,
  revealPath: (targetPath) => ipcRenderer.invoke('swtd:reveal-path', targetPath),
  // Phase 2 — read a brand-context markdown file from disk applying the
  // workspace-default + SKU-override resolution rule. Read-only. Filename
  // must end in `.md`; main process path-checks the resolved file sits
  // under the workspace root.
  readBrandFile: (args) => ipcRenderer.invoke('swtd:read-brand-file', args),
  onPipelineEvent: (handler) => {
    listeners.add(handler)
    return () => listeners.delete(handler)
  }
})

/*
 * Phase 4 — `window.swtdProvider`
 *
 * Single namespace through which the renderer reaches Provider Core. The
 * preload bridge exposes only the calls listed below; in particular there
 * is NO `getKey`-shaped function. A renderer process that ever needed the
 * plaintext key would have to add an IPC handler in main.cjs by hand, and
 * the architecture exists specifically to make that an explicit, reviewable
 * change rather than an accident. (Plan §4.2; SC2.)
 *
 * Every call is a one-shot `ipcRenderer.invoke` — no event-based
 * subscriptions in this surface. Long-running generations expose a `genId`
 * the renderer can pass to `cancelGeneration` to abort.
 */
contextBridge.exposeInMainWorld('swtdProvider', {
  /* Registry / route config */
  listProviders:   () => ipcRenderer.invoke('swtd:provider:list'),
  getRouteConfig:  () => ipcRenderer.invoke('swtd:provider:get-route-config'),
  setRouteConfig:  (cfg) => ipcRenderer.invoke('swtd:provider:set-route-config', cfg),

  /* Key vault — note the deliberate absence of a getKey shape */
  saveKey:    (providerId, value) => ipcRenderer.invoke('swtd:provider:save-key',  { providerId, value }),
  hasKeyFor:  (providerId)        => ipcRenderer.invoke('swtd:provider:has-key',   { providerId }),
  clearKey:   (providerId)        => ipcRenderer.invoke('swtd:provider:clear-key', { providerId }),
  testProvider: (providerId)      => ipcRenderer.invoke('swtd:provider:test',      { providerId }),

  /* image_generate unified contract — mode chosen by reference-image presence */
  generateImage: (input) => ipcRenderer.invoke('swtd:provider:generate-image', input),
  editImage:     (input) => ipcRenderer.invoke('swtd:provider:edit-image',     input),
  cancelGeneration: (genId) => ipcRenderer.invoke('swtd:provider:cancel-generation', genId),

  /* Custom provider config — non-secret triple (Boss D1: name + baseUrl +
   * optional modelPrefix). The apiKey continues to go through saveKey. */
  getCustomConfig:   ()      => ipcRenderer.invoke('swtd:provider:get-custom-config'),
  saveCustomConfig:  (cfg)   => ipcRenderer.invoke('swtd:provider:save-custom-config',  cfg),
  clearCustomConfig: ()      => ipcRenderer.invoke('swtd:provider:clear-custom-config'),

  /* Research / Insight Brief — auto-builds the Creative Brief on success */
  researchInsight:  (input) => ipcRenderer.invoke('swtd:provider:research-insight',  input),
  cancelResearch:   (researchId) => ipcRenderer.invoke('swtd:provider:cancel-research', researchId),
  getInsightBrief:  (skuPath) => ipcRenderer.invoke('swtd:provider:get-insight-brief', skuPath),

  /* Media store — replaces Phase 3's swtd:save/list/cleanup-tmp-generated */
  listTmpImages:     (args) => ipcRenderer.invoke('swtd:provider:list-tmp-images',     args),
  cleanupTmp:        (args) => ipcRenderer.invoke('swtd:provider:cleanup-tmp',         args),
  promoteToApproved: (args) => ipcRenderer.invoke('swtd:provider:promote-to-approved', args),

  /* Helper that mirrors `window.swtd.assetUrl` so renderer code calling into
   * swtdProvider doesn't need to reach back into the legacy namespace.    */
  assetUrl
})
