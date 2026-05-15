/**
 * Fal.ai provider — text-to-image only in v1.
 *
 * `supportsEdit: false` until the FAL `/edit` route ships with the
 * accompanying file-storage upload step (deferred follow-up — plan §4 OOS).
 *
 * Phase 3's renderer-side adapter shape is preserved; only the auth-key
 * plumbing changed (now via ctx).
 *
 * Plan §4.4.
 */

import { providerError, statusToReason } from '../error.js'
import { fetchWithTimeout, readResponseBytes } from './_fetch.js'

const TEXT_TO_IMAGE_URL = 'https://fal.run/openai/gpt-image-2'

const ASPECT_TO_IMAGE_SIZE = {
  '1:1':  { width: 2048, height: 2048 },
  '4:5':  { width: 1664, height: 2080 },
  '9:16': { width: 1440, height: 2560 },
  '16:9': { width: 2560, height: 1440 }
}

const AUTH_FIELDS = [
  { id: 'apiKey', type: 'secret', label: 'API Key', required: true },
  {
    id: 'defaultModel', type: 'select', label: 'Default model',
    options: ['openai/gpt-image-2', 'flux-dev'],
    default: 'openai/gpt-image-2'
  }
]

export const falProvider = Object.freeze({
  id: 'fal',
  label: 'Fal.ai',
  authFields: AUTH_FIELDS,
  capabilities: {
    supportsGenerate: true,
    supportsEdit: false,
    defaultGenerateModel: 'openai/gpt-image-2',
    defaultEditModel: null,
    supportedAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
    supportedQualities: ['low', 'medium', 'high', 'auto'],
    supportedOutputFormats: ['png']
  },
  models: ['openai/gpt-image-2', 'flux-dev'],

  async generate(input, ctx) {
    if (!ctx.apiKey) throw providerError('fal', 'invalid-key', { hint: 'no API key configured' })
    if (ctx.signal?.aborted) throw providerError('fal', 'aborted')
    const started = Date.now()
    const image_size = ASPECT_TO_IMAGE_SIZE[input.aspectRatio] || ASPECT_TO_IMAGE_SIZE['1:1']
    const body = {
      prompt: input.prompt,
      image_size,
      quality: input.quality || 'high',
      num_images: 1,
      output_format: 'png'
    }
    const res = await fetchWithTimeout(TEXT_TO_IMAGE_URL, {
      providerId: 'fal', method: 'POST',
      headers: {
        Authorization: `Key ${ctx.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      signal: ctx.signal, timeoutMs: ctx.timeoutMs
    })
    if (!res.ok) throw providerError('fal', statusToReason(res.status), { status: res.status })
    let payload
    try { payload = await res.json() } catch { throw providerError('fal', 'invalid-response', { status: res.status }) }
    const first = payload?.images?.[0]
    if (!first?.url) throw providerError('fal', 'invalid-response', { hint: 'no image url in payload' })
    const imgRes = await fetchWithTimeout(first.url, {
      providerId: 'fal', method: 'GET',
      signal: ctx.signal, timeoutMs: ctx.timeoutMs
    })
    if (!imgRes.ok) throw providerError('fal', statusToReason(imgRes.status), { status: imgRes.status })
    const bytes = await readResponseBytes(imgRes, 'fal')
    return {
      bytes,
      mime: 'image/png',
      model: input.model || 'openai/gpt-image-2',
      mode: 'generate',
      elapsedMs: Date.now() - started,
      providerMeta: {
        aspectRatio: input.aspectRatio,
        width: first.width, height: first.height,
        inferenceSeconds: payload?.timings?.inference
      }
    }
  },

  async testConnection(ctx) {
    if (!ctx.apiKey) return { ok: false, reason: 'invalid-key' }
    try {
      const res = await fetchWithTimeout(TEXT_TO_IMAGE_URL, {
        providerId: 'fal', method: 'HEAD',
        headers: { Authorization: `Key ${ctx.apiKey}` },
        signal: ctx.signal, timeoutMs: ctx.timeoutMs
      })
      if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthorized' }
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: err?.reason || 'network' }
    }
  }
})

export { ASPECT_TO_IMAGE_SIZE as FAL_SIZES }
