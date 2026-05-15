/**
 * Renderer-side helpers around the Phase-3 temp generated-image cache.
 *
 * Boss Q2 lock: 7-day TTL, sidecar JSON metadata, manual export only.
 * All file I/O happens in electron/main.cjs via the 3 IPCs exposed in
 * preload.cjs. This module is the thin renderer-side façade.
 *
 * Spec: docs/features/phase-3-model-adapter/spec.md §7 Q2
 * Plan: docs/features/phase-3-model-adapter/plan.md §4.8
 */

/** 7 days in milliseconds — single source of truth for the TTL. */
export const TMP_TTL_MS = 7 * 24 * 60 * 60 * 1000

const api = typeof window !== 'undefined' ? window.swtd : null

/**
 * Save a generated image blob to `<sku>/output/tmp-generated/`.
 * Returns the IPC result `{ ok, file, generatedAt, expiresAt, providerId }`.
 */
export async function saveGeneratedImage({ skuPath, slotId, providerId, templateId, angleId, aspectRatio, blob }) {
  if (!api?.saveGeneratedImage) return { ok: false, error: 'preload not available' }
  if (!blob) return { ok: false, error: 'blob required' }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return api.saveGeneratedImage({
    skuPath,
    slotId,
    providerId: providerId || null,
    templateId: templateId || null,
    angleId: angleId || null,
    aspectRatio: aspectRatio || null,
    mime: 'image/png',
    bytes: Array.from(bytes)        // contextBridge can't ferry Uint8Array; use plain array
  })
}

/**
 * List non-expired tmp-generated entries for a SKU.
 * Returns `{ [slotId]: { file, generatedAt, expiresAt, providerId, ... } }`
 * with the **newest entry per slot** wins (sorted by generatedAt desc in main).
 */
export async function loadLatestPerSlot({ skuPath }) {
  if (!api?.listTmpGenerated) return {}
  const res = await api.listTmpGenerated({ skuPath })
  if (!res?.ok || !Array.isArray(res.entries)) return {}
  const out = {}
  for (const e of res.entries) {
    if (out[e.slotId]) continue                  // first wins (entries already sorted desc)
    out[e.slotId] = e
  }
  return out
}

/**
 * Sweep expired entries. Safe to call repeatedly. Returns { deleted, kept }
 * for runbook evidence.
 */
export async function cleanupExpired({ skuPath }) {
  if (!api?.cleanupTmpGenerated) return { ok: false, error: 'preload not available', deleted: 0, kept: 0 }
  return api.cleanupTmpGenerated({ skuPath })
}

/** Build a `swtd-asset://` URL from an absolute path so the renderer can
 *  display the tmp PNG via the existing preview path. Same helper as
 *  Phase 1's slot validator previews. */
export function tmpAssetUrl(absPath) {
  if (!api?.assetUrl) return null
  return api.assetUrl(absPath)
}
