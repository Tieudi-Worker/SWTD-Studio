/**
 * Renderer-side helpers around the Phase 4 media store.
 *
 * Boss D7: 7-day TTL semantics unchanged from Phase 3. The owner moved from
 * inline handlers in `electron/main.cjs` into `packages/provider-core/src/
 * media-store.js`, called through the unified `swtd:provider:*` namespace.
 *
 * Plan §4.2 + §4.6.
 */

/** 7 days in milliseconds — kept for callers that still import it from here. */
export const TMP_TTL_MS = 7 * 24 * 60 * 60 * 1000

const api = typeof window !== 'undefined' ? window.swtdProvider : null

/**
 * List non-expired tmp-generated entries for a SKU, keyed by slotId. Newest
 * entry per slot wins (`media-store.js` already sorts entries desc).
 */
export async function loadLatestPerSlot({ skuPath }) {
  if (!api?.listTmpImages) return {}
  const res = await api.listTmpImages({ skuPath })
  if (!res?.ok || !Array.isArray(res.entries)) return {}
  const out = {}
  for (const e of res.entries) {
    if (out[e.slotId]) continue
    out[e.slotId] = e
  }
  return out
}

/** Sweep expired entries. Safe to call repeatedly. */
export async function cleanupExpired({ skuPath }) {
  if (!api?.cleanupTmp) return { ok: false, error: 'preload not available', deleted: 0, kept: 0 }
  return api.cleanupTmp({ skuPath })
}

/** Build a `swtd-asset://` URL from an absolute path. */
export function tmpAssetUrl(absPath) {
  if (!api?.assetUrl) return null
  return api.assetUrl(absPath)
}
