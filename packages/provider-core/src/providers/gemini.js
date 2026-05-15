/**
 * Gemini provider (Google generativelanguage API).
 *
 * v1: generate-only. `supportsEdit: false` — the fallback router will skip
 * gemini for edit-mode and surface a `provider-unsupported-edit` chain entry
 * if it ever sits at the head of an edit-mode chain.
 *
 * Plan §4.4.
 */

import { providerError, statusToReason } from '../error.js'
import { fetchWithTimeout } from './_fetch.js'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

const AUTH_FIELDS = [
  { id: 'apiKey', type: 'secret', label: 'API Key', required: true },
  {
    id: 'defaultModel', type: 'select', label: 'Default model',
    options: ['imagen-3'], default: 'imagen-3'
  }
]

export const geminiProvider = Object.freeze({
  id: 'gemini',
  label: 'Gemini',
  authFields: AUTH_FIELDS,
  capabilities: {
    supportsGenerate: true,
    supportsEdit: false,
    defaultGenerateModel: 'imagen-3',
    defaultEditModel: null,
    supportedAspectRatios: ['1:1', '4:5', '16:9'],
    supportedQualities: ['low', 'medium', 'high', 'auto'],
    supportedOutputFormats: ['png', 'jpeg']
  },
  models: ['imagen-3'],

  async generate(input, ctx) {
    if (!ctx.apiKey) throw providerError('gemini', 'invalid-key', { hint: 'no API key configured' })
    if (ctx.signal?.aborted) throw providerError('gemini', 'aborted')
    const started = Date.now()
    const model = input.model || 'imagen-3'
    const url = `${BASE_URL}/models/${encodeURIComponent(model)}:generateImage?key=${encodeURIComponent(ctx.apiKey)}`
    const body = {
      prompt: { text: input.prompt },
      sampleCount: 1,
      aspectRatio: input.aspectRatio || '1:1',
      personGeneration: 'ALLOW_ADULT',
      // Gemini ignores 'quality' field; we forward for forward-compat.
      quality: input.quality || 'high'
    }
    const res = await fetchWithTimeout(url, {
      providerId: 'gemini', method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: ctx.signal, timeoutMs: ctx.timeoutMs
    })
    if (!res.ok) throw providerError('gemini', statusToReason(res.status), { status: res.status })
    let payload
    try { payload = await res.json() } catch { throw providerError('gemini', 'invalid-response', { status: res.status }) }
    const b64 = payload?.generatedImages?.[0]?.image?.imageBytes
      || payload?.predictions?.[0]?.bytesBase64Encoded
    if (!b64) throw providerError('gemini', 'invalid-response', { hint: 'no image bytes in payload' })
    return {
      bytes: Buffer.from(b64, 'base64'),
      mime: 'image/png',
      model,
      mode: 'generate',
      elapsedMs: Date.now() - started,
      providerMeta: { aspectRatio: input.aspectRatio }
    }
  },

  async testConnection(ctx) {
    if (!ctx.apiKey) return { ok: false, reason: 'invalid-key' }
    try {
      const url = `${BASE_URL}/models?key=${encodeURIComponent(ctx.apiKey)}`
      const res = await fetchWithTimeout(url, {
        providerId: 'gemini', method: 'GET',
        signal: ctx.signal, timeoutMs: ctx.timeoutMs
      })
      if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthorized' }
      if (res.ok) return { ok: true }
      return { ok: false, reason: 'invalid-response' }
    } catch (err) {
      return { ok: false, reason: err?.reason || 'network' }
    }
  }
})
