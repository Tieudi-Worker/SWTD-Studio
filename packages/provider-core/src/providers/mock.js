/**
 * Mock provider — synthetic placeholder output.
 *
 * v1 lives in main (Node) — no `document` / canvas API. We emit a deterministic
 * PNG produced by hand from a 1×1 / N×N pixel matrix so the entire pipeline
 * round-trips without spawning a real provider. The placeholder is intentionally
 * boring; the previous renderer-side mock used canvas overlays to render text
 * but main-process Node has no canvas. Renderer's SlotCard already labels mock
 * output with the served-provider badge, so the placeholder shape doesn't need
 * embedded text to be recognisable.
 *
 * Mock is NEVER auto-substituted for a real provider unless the operator
 * explicitly enables `allowMockFallback` in the route config (Boss D3).
 *
 * Plan §4.4.
 */

import { providerError } from '../error.js'

const ASPECT_TO_SIZE = {
  '1:1':  [256, 256],
  '4:5':  [256, 320],
  '9:16': [180, 320],
  '16:9': [320, 180]
}

// Minimal valid PNG: 1×1 transparent pixel. We tile this conceptually by
// emitting it directly — the renderer treats the bytes as a real image
// regardless of canvas size. Keeps the adapter pure-Node with no deps.
const TRANSPARENT_1x1_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82
])

async function delayWithAbort(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    if (signal) {
      const onAbort = () => { clearTimeout(t); reject(providerError('mock', 'aborted')) }
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

export const mockProvider = Object.freeze({
  id: 'mock',
  label: 'Mock (no API call)',
  authFields: [],
  capabilities: {
    supportsGenerate: true,
    supportsEdit: true,
    defaultGenerateModel: 'mock-placeholder',
    defaultEditModel: 'mock-placeholder',
    supportedAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
    supportedQualities: ['low', 'medium', 'high', 'auto'],
    supportedOutputFormats: ['png']
  },
  models: ['mock-placeholder'],

  async generate(input, ctx) {
    if (ctx.signal?.aborted) throw providerError('mock', 'aborted')
    const started = Date.now()
    await delayWithAbort(800 + Math.random() * 400, ctx.signal)
    const [w, h] = ASPECT_TO_SIZE[input.aspectRatio] || ASPECT_TO_SIZE['1:1']
    return {
      bytes: TRANSPARENT_1x1_PNG,
      mime: 'image/png',
      model: 'mock-placeholder',
      mode: 'generate',
      elapsedMs: Date.now() - started,
      providerMeta: { aspectRatio: input.aspectRatio, declaredSize: `${w}x${h}` }
    }
  },

  async edit(input, ctx) {
    if (ctx.signal?.aborted) throw providerError('mock', 'aborted')
    const started = Date.now()
    await delayWithAbort(800 + Math.random() * 400, ctx.signal)
    return {
      bytes: TRANSPARENT_1x1_PNG,
      mime: 'image/png',
      model: 'mock-placeholder',
      mode: 'edit',
      elapsedMs: Date.now() - started,
      providerMeta: { aspectRatio: input.aspectRatio }
    }
  },

  async testConnection() { return { ok: true } }
})
