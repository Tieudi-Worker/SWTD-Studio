/**
 * OpenAI provider — `gpt-image-2` (generate) + `gpt-image-2/edit` (edit).
 *
 * - generate → POST /v1/images/generations  (JSON body, b64_json response)
 * - edit     → POST /v1/images/edits        (multipart/form-data with image[])
 * - testConnection → GET /v1/models         (cheap auth probe)
 *
 * Plan §4.4. Phase 3's renderer-side adapter shape is preserved; the only
 * differences are (a) Node `fetch` instead of browser `fetch`, (b) Buffer
 * bytes returned instead of a Blob, (c) auth/key passed via ctx instead of
 * a positional argument.
 */

import { providerError, statusToReason } from '../error.js'
import { fetchWithTimeout, readResponseBytes } from './_fetch.js'

const GENERATIONS_URL = 'https://api.openai.com/v1/images/generations'
const EDITS_URL = 'https://api.openai.com/v1/images/edits'
const MODELS_URL = 'https://api.openai.com/v1/models'

const ASPECT_TO_SIZE = {
  '1:1':  '1024x1024',
  '4:5':  '1024x1536',
  '9:16': '1024x1536',
  '16:9': '1536x1024'
}

function b64ToBytes(b64) {
  return Buffer.from(b64, 'base64')
}

const AUTH_FIELDS = [
  { id: 'apiKey', type: 'secret', label: 'API Key', required: true },
  {
    id: 'defaultImageModel', type: 'select',
    label: 'Default image model',
    options: ['gpt-image-2', 'gpt-image-2/edit', 'gpt-image-1.5'],
    default: 'gpt-image-2'
  },
  {
    id: 'defaultQuality', type: 'select', label: 'Default quality',
    options: ['low', 'medium', 'high', 'auto'], default: 'high'
  },
  {
    id: 'outputFormat', type: 'select', label: 'Output format',
    options: ['png', 'jpeg', 'webp'], default: 'png'
  }
]

export const openaiProvider = Object.freeze({
  id: 'openai',
  label: 'OpenAI',
  authFields: AUTH_FIELDS,
  capabilities: {
    supportsGenerate: true,
    supportsEdit: true,
    defaultGenerateModel: 'gpt-image-2',
    defaultEditModel: 'gpt-image-2/edit',
    supportedAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
    supportedQualities: ['low', 'medium', 'high', 'auto'],
    supportedOutputFormats: ['png']
  },
  models: ['gpt-image-2', 'gpt-image-2/edit', 'gpt-image-1.5'],

  async generate(input, ctx) {
    if (!ctx.apiKey) throw providerError('openai', 'invalid-key', { hint: 'no API key configured' })
    if (ctx.signal?.aborted) throw providerError('openai', 'aborted')
    const started = Date.now()
    const size = ASPECT_TO_SIZE[input.aspectRatio] || ASPECT_TO_SIZE['1:1']
    const body = {
      model: input.model || 'gpt-image-2',
      prompt: input.prompt,
      n: 1,
      size,
      quality: input.quality || 'high',
      response_format: 'b64_json'
    }
    const res = await fetchWithTimeout(GENERATIONS_URL, {
      providerId: 'openai',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      signal: ctx.signal,
      timeoutMs: ctx.timeoutMs
    })
    if (!res.ok) throw providerError('openai', statusToReason(res.status), { status: res.status })

    let payload
    try { payload = await res.json() } catch { throw providerError('openai', 'invalid-response', { status: res.status }) }
    const b64 = payload?.data?.[0]?.b64_json
    if (!b64) throw providerError('openai', 'invalid-response', { hint: 'no b64_json in payload' })

    return {
      bytes: b64ToBytes(b64),
      mime: 'image/png',
      model: body.model,
      mode: 'generate',
      elapsedMs: Date.now() - started,
      providerMeta: { aspectRatio: input.aspectRatio, size }
    }
  },

  async edit(input, ctx) {
    if (!ctx.apiKey) throw providerError('openai', 'invalid-key', { hint: 'no API key configured' })
    if (ctx.signal?.aborted) throw providerError('openai', 'aborted')
    const images = Array.isArray(input.images) ? input.images : (input.image ? [input.image] : [])
    if (images.length === 0) throw providerError('openai', 'invalid-input', { hint: 'edit requires at least one reference image' })

    const started = Date.now()
    const form = new FormData()
    form.append('model', input.model || 'gpt-image-2/edit')
    form.append('prompt', input.prompt)
    form.append('n', '1')
    form.append('size', ASPECT_TO_SIZE[input.aspectRatio] || ASPECT_TO_SIZE['1:1'])
    if (input.quality) form.append('quality', input.quality)
    form.append('response_format', 'b64_json')
    // Reference images are appended as `image[]`. The caller must hand the
    // adapter actual Buffers / Blobs; URL ingestion (swtd-asset://) is
    // resolved by the IPC handler in P4.2 before the adapter ever sees them.
    for (const img of images) {
      if (img && typeof img === 'object' && (img instanceof Blob || ArrayBuffer.isView(img))) {
        const blob = img instanceof Blob ? img : new Blob([img], { type: 'image/png' })
        form.append('image[]', blob, 'reference.png')
      } else if (typeof img === 'string') {
        // Adapter does not resolve filesystem paths. The IPC handler in
        // main.cjs is responsible for reading bytes and substituting them.
        throw providerError('openai', 'invalid-input', {
          hint: 'edit reference must be a Blob/Buffer; IPC layer must resolve filesystem paths first'
        })
      }
    }
    const res = await fetchWithTimeout(EDITS_URL, {
      providerId: 'openai',
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
      body: form,
      signal: ctx.signal,
      timeoutMs: ctx.timeoutMs
    })
    if (!res.ok) throw providerError('openai', statusToReason(res.status), { status: res.status })
    let payload
    try { payload = await res.json() } catch { throw providerError('openai', 'invalid-response', { status: res.status }) }
    const b64 = payload?.data?.[0]?.b64_json
    if (!b64) throw providerError('openai', 'invalid-response', { hint: 'no b64_json in payload' })
    return {
      bytes: b64ToBytes(b64),
      mime: 'image/png',
      model: input.model || 'gpt-image-2/edit',
      mode: 'edit',
      elapsedMs: Date.now() - started,
      providerMeta: { aspectRatio: input.aspectRatio, referenceCount: images.length }
    }
  },

  async testConnection(ctx) {
    if (!ctx.apiKey) return { ok: false, reason: 'invalid-key' }
    try {
      const res = await fetchWithTimeout(MODELS_URL, {
        providerId: 'openai', method: 'GET',
        headers: { Authorization: `Bearer ${ctx.apiKey}` },
        signal: ctx.signal, timeoutMs: ctx.timeoutMs
      })
      if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthorized' }
      if (res.ok) return { ok: true }
      return { ok: false, reason: 'invalid-response' }
    } catch (err) {
      const reason = err?.reason || 'network'
      return { ok: false, reason }
    }
  }
})

export { ASPECT_TO_SIZE as OPENAI_SIZES }
// readResponseBytes intentionally imported only by adapters that need raw bytes
void readResponseBytes
