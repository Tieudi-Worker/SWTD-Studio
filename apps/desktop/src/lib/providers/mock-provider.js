/**
 * Mock image provider.
 *
 * Returns a canvas-generated placeholder PNG so the entire Generate flow
 * works end-to-end without any API credit. The placeholder embeds the
 * slot id + aspect ratio as overlay text so it never reads as a real
 * product image during a demo.
 *
 * Reuses the same lifecycle shape as real providers — Shell.jsx cannot
 * tell mock from real except by image content.
 *
 * Spec: docs/features/phase-3-model-adapter/spec.md §2 Mock adapter
 * Plan: docs/features/phase-3-model-adapter/plan.md §4.6
 */

import { providerError, PROVIDER_TIMEOUTS_MS } from './types.js'

const ASPECT_TO_SIZE = {
  '1:1':  { w: 1024, h: 1024 },
  '4:5':  { w: 1024, h: 1280 },
  '9:16': { w: 720,  h: 1280 },
  '16:9': { w: 1280, h: 720 }
}

/** Produces a tinted PNG with overlay text. Returns a Blob. */
async function renderPlaceholderPng({ slotId, aspectRatio, prompt }) {
  if (typeof document === 'undefined') {
    // Node / test environment — return a tiny 1×1 transparent PNG as a stand-in.
    // The 67-byte header below is a valid minimal PNG.
    const TRANSPARENT_1x1 = Uint8Array.from([
      137,80,78,71,13,10,26,10, 0,0,0,13, 73,72,68,82, 0,0,0,1, 0,0,0,1,
      8,6,0,0,0, 31,21,196,137, 0,0,0,13, 73,68,65,84, 120,156,99,0,1,0,0,5,
      0,1, 13,10,45,180, 0,0,0,0, 73,69,78,68, 174,66,96,130
    ])
    return new Blob([TRANSPARENT_1x1], { type: 'image/png' })
  }

  const { w, h } = ASPECT_TO_SIZE[aspectRatio] || ASPECT_TO_SIZE['1:1']
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  // Background: soft pink so it never reads as a real photo. The amber
  // diagonal stripes scream "demo" without being garish.
  ctx.fillStyle = '#FFE4F0'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(212, 168, 87, 0.18)'
  ctx.lineWidth = 8
  const step = 64
  for (let x = -h; x < w + h; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + h, h)
    ctx.stroke()
  }

  // Centered overlay text.
  ctx.fillStyle = '#9C2C5E'
  ctx.font = `bold ${Math.round(w / 12)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('MOCK', w / 2, h / 2 - w / 12)
  ctx.font = `${Math.round(w / 24)}px sans-serif`
  ctx.fillStyle = '#5A1A3A'
  ctx.fillText(`slot ${slotId ?? '?'} · ${aspectRatio || '1:1'}`, w / 2, h / 2)

  // Prompt prefix as a faint footer — proves the prompt actually reached
  // the adapter without leaking the full text.
  if (prompt) {
    ctx.font = `${Math.round(w / 48)}px monospace`
    ctx.fillStyle = 'rgba(90, 26, 58, 0.4)'
    ctx.fillText(String(prompt).slice(0, 64) + '…', w / 2, h - w / 24)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(providerError('mock', 'invalid-response', { hint: 'canvas.toBlob returned null' }))
    }, 'image/png')
  })
}

export const mockProvider = Object.freeze({
  id: 'mock',
  label: 'Mock (no API call)',
  requiresApiKey: false,

  async generate({ prompt, aspectRatio = '1:1', signal } = {}) {
    if (signal?.aborted) throw providerError('mock', 'aborted')
    const started = Date.now()

    // Simulate latency. Aborting mid-wait rejects cleanly.
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, 1500 + Math.random() * 800)
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(t)
          reject(providerError('mock', 'aborted'))
        }, { once: true })
      }
    })

    const imageBlob = await renderPlaceholderPng({
      slotId: arguments[0]?.slotId,
      aspectRatio,
      prompt
    })

    return {
      imageBlob,
      mime: 'image/png',
      elapsedMs: Date.now() - started,
      providerMeta: { aspectRatio, kind: 'mock-placeholder' }
    }
  },

  async testConnection() {
    return { ok: true }
  }
})

export { ASPECT_TO_SIZE as MOCK_SIZES, PROVIDER_TIMEOUTS_MS }
