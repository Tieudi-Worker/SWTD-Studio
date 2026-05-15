/**
 * Kie.ai provider — per-model dispatch (`nano-banana-pro`, `seedream`, `kling`).
 *
 * Kie's API surface is OpenAI-shape for image generation but the model
 * routing is per-product. The adapter picks the right HTTP path based on
 * the resolved model id; edit-mode currently only ships for the
 * `nano-banana-pro/edit` variant.
 *
 * Plan §4.4. The exact Kie endpoint shape may differ in practice; the
 * adapter is structured so the URL composition can be revisited without
 * touching the registry.
 */

import { providerError, statusToReason } from '../error.js'
import { fetchWithTimeout, readResponseBytes } from './_fetch.js'

const BASE_URL = 'https://api.kie.ai/v1'

const AUTH_FIELDS = [
  { id: 'apiKey', type: 'secret', label: 'API Key', required: true },
  {
    id: 'defaultModelGroup', type: 'select', label: 'Default model group',
    options: ['nano-banana-pro', 'seedream', 'kling'], default: 'nano-banana-pro'
  }
]

function endpointFor(model) {
  // Kie groups its models under category paths. We surface the model id 1:1.
  // /v1/images/generations?model=<id> is OpenAI-compatible; /edit uses the
  // /v1/images/edits route with the `model` query set explicitly.
  if (model && model.endsWith('/edit')) return `${BASE_URL}/images/edits`
  return `${BASE_URL}/images/generations`
}

export const kieProvider = Object.freeze({
  id: 'kie',
  label: 'Kie.ai',
  authFields: AUTH_FIELDS,
  capabilities: {
    supportsGenerate: true,
    supportsEdit: true,
    defaultGenerateModel: 'nano-banana-pro',
    defaultEditModel: 'nano-banana-pro/edit',
    supportedAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
    supportedQualities: ['low', 'medium', 'high', 'auto'],
    supportedOutputFormats: ['png']
  },
  models: ['nano-banana-pro', 'nano-banana-pro/edit', 'seedream', 'kling'],

  async generate(input, ctx) {
    if (!ctx.apiKey) throw providerError('kie', 'invalid-key', { hint: 'no API key configured' })
    if (ctx.signal?.aborted) throw providerError('kie', 'aborted')
    const started = Date.now()
    const model = input.model || 'nano-banana-pro'
    const url = endpointFor(model)
    const body = {
      model,
      prompt: input.prompt,
      n: 1,
      aspect_ratio: input.aspectRatio || '1:1',
      quality: input.quality || 'high',
      response_format: 'b64_json'
    }
    const res = await fetchWithTimeout(url, {
      providerId: 'kie', method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      signal: ctx.signal, timeoutMs: ctx.timeoutMs
    })
    if (!res.ok) throw providerError('kie', statusToReason(res.status), { status: res.status })
    let payload
    try { payload = await res.json() } catch { throw providerError('kie', 'invalid-response', { status: res.status }) }
    const b64 = payload?.data?.[0]?.b64_json
    const remoteUrl = payload?.data?.[0]?.url
    let bytes
    if (b64) {
      bytes = Buffer.from(b64, 'base64')
    } else if (remoteUrl) {
      const imgRes = await fetchWithTimeout(remoteUrl, {
        providerId: 'kie', method: 'GET',
        signal: ctx.signal, timeoutMs: ctx.timeoutMs
      })
      if (!imgRes.ok) throw providerError('kie', statusToReason(imgRes.status), { status: imgRes.status })
      bytes = await readResponseBytes(imgRes, 'kie')
    } else {
      throw providerError('kie', 'invalid-response', { hint: 'no b64_json or url in payload' })
    }
    return {
      bytes,
      mime: 'image/png',
      model,
      mode: 'generate',
      elapsedMs: Date.now() - started,
      providerMeta: { aspectRatio: input.aspectRatio }
    }
  },

  async edit(input, ctx) {
    if (!ctx.apiKey) throw providerError('kie', 'invalid-key', { hint: 'no API key configured' })
    if (ctx.signal?.aborted) throw providerError('kie', 'aborted')
    const images = Array.isArray(input.images) ? input.images : (input.image ? [input.image] : [])
    if (images.length === 0) throw providerError('kie', 'invalid-input', { hint: 'edit requires at least one reference image' })

    const started = Date.now()
    const model = input.model || 'nano-banana-pro/edit'
    const url = endpointFor(model)
    const form = new FormData()
    form.append('model', model)
    form.append('prompt', input.prompt)
    form.append('n', '1')
    form.append('aspect_ratio', input.aspectRatio || '1:1')
    if (input.quality) form.append('quality', input.quality)
    form.append('response_format', 'b64_json')
    for (const img of images) {
      if (img instanceof Blob) form.append('image[]', img, 'reference.png')
      else if (ArrayBuffer.isView(img)) form.append('image[]', new Blob([img], { type: 'image/png' }), 'reference.png')
      else throw providerError('kie', 'invalid-input', { hint: 'edit reference must be Blob/Buffer' })
    }
    const res = await fetchWithTimeout(url, {
      providerId: 'kie', method: 'POST',
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
      body: form, signal: ctx.signal, timeoutMs: ctx.timeoutMs
    })
    if (!res.ok) throw providerError('kie', statusToReason(res.status), { status: res.status })
    let payload
    try { payload = await res.json() } catch { throw providerError('kie', 'invalid-response', { status: res.status }) }
    const b64 = payload?.data?.[0]?.b64_json
    if (!b64) throw providerError('kie', 'invalid-response', { hint: 'no b64_json in payload' })
    return {
      bytes: Buffer.from(b64, 'base64'),
      mime: 'image/png',
      model,
      mode: 'edit',
      elapsedMs: Date.now() - started,
      providerMeta: { aspectRatio: input.aspectRatio, referenceCount: images.length }
    }
  },

  async testConnection(ctx) {
    if (!ctx.apiKey) return { ok: false, reason: 'invalid-key' }
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/models`, {
        providerId: 'kie', method: 'GET',
        headers: { Authorization: `Bearer ${ctx.apiKey}` },
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
