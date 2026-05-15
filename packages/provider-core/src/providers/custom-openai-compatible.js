/**
 * Custom OpenAI-compatible provider — single adapter parameterized at
 * register-time with `{ providerName, baseUrl, apiKey?, modelPrefix? }`.
 *
 * Use case (Boss D1): 9router-style proxies and other OpenAI-compatible
 * endpoints. Same auth header style as OpenAI (Bearer + JSON body).
 *
 * The Provider Registry stores Custom as a factory — operators register
 * additional Custom providers via Settings; each one gets its own id like
 * `custom:9router` so multiple Customs can coexist.
 *
 * Plan §4.4 + research Q6.
 */

import { providerError, statusToReason } from '../error.js'
import { fetchWithTimeout } from './_fetch.js'

const AUTH_FIELDS = [
  { id: 'providerName', type: 'text', label: 'Provider name', required: true,
    hint: 'Display label shown in the Settings tab and route badge' },
  { id: 'baseUrl',      type: 'url',  label: 'Base URL', required: true,
    hint: 'e.g. https://9router.example.com' },
  { id: 'apiKey',       type: 'secret', label: 'API Key', required: true },
  { id: 'modelPrefix',  type: 'text', label: 'Model path prefix (optional)',
    hint: 'Inserted between base URL and /images/generations' }
]

function endpointFor(baseUrl, modelPrefix, mode) {
  const trimmed = String(baseUrl || '').replace(/\/+$/, '')
  const prefix = modelPrefix ? `/${String(modelPrefix).replace(/^\/+|\/+$/g, '')}` : '/v1'
  return mode === 'edit'
    ? `${trimmed}${prefix}/images/edits`
    : `${trimmed}${prefix}/images/generations`
}

export function createCustomProvider({ id, providerName, baseUrl, modelPrefix, models } = {}) {
  if (!id || typeof id !== 'string' || !id.startsWith('custom')) {
    throw new TypeError('createCustomProvider: id must start with "custom"')
  }
  if (!providerName || !baseUrl) {
    throw new TypeError('createCustomProvider: providerName + baseUrl required')
  }
  return Object.freeze({
    id,
    label: providerName,
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
    models: Array.isArray(models) && models.length > 0 ? models : ['gpt-image-2', 'gpt-image-2/edit'],
    config: { providerName, baseUrl, modelPrefix: modelPrefix || null },

    async generate(input, ctx) {
      if (!ctx.apiKey) throw providerError(id, 'invalid-key', { hint: 'no API key configured' })
      if (ctx.signal?.aborted) throw providerError(id, 'aborted')
      const started = Date.now()
      const model = input.model || 'gpt-image-2'
      const body = {
        model,
        prompt: input.prompt,
        n: 1,
        size: input.size || (input.aspectRatio === '16:9' ? '1536x1024' : input.aspectRatio === '9:16' ? '1024x1536' : '1024x1024'),
        quality: input.quality || 'high',
        response_format: 'b64_json'
      }
      const res = await fetchWithTimeout(endpointFor(baseUrl, modelPrefix, 'generate'), {
        providerId: id, method: 'POST',
        headers: {
          Authorization: `Bearer ${ctx.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(body),
        signal: ctx.signal, timeoutMs: ctx.timeoutMs
      })
      if (!res.ok) throw providerError(id, statusToReason(res.status), { status: res.status })
      let payload
      try { payload = await res.json() } catch { throw providerError(id, 'invalid-response', { status: res.status }) }
      const b64 = payload?.data?.[0]?.b64_json
      if (!b64) throw providerError(id, 'invalid-response', { hint: 'no b64_json in payload (provider may not be OpenAI-compatible)' })
      return {
        bytes: Buffer.from(b64, 'base64'),
        mime: 'image/png',
        model,
        mode: 'generate',
        elapsedMs: Date.now() - started,
        providerMeta: { aspectRatio: input.aspectRatio, providerName }
      }
    },

    async edit(input, ctx) {
      if (!ctx.apiKey) throw providerError(id, 'invalid-key', { hint: 'no API key configured' })
      if (ctx.signal?.aborted) throw providerError(id, 'aborted')
      const images = Array.isArray(input.images) ? input.images : (input.image ? [input.image] : [])
      if (images.length === 0) throw providerError(id, 'invalid-input', { hint: 'edit requires at least one reference image' })
      const started = Date.now()
      const model = input.model || 'gpt-image-2/edit'
      const form = new FormData()
      form.append('model', model)
      form.append('prompt', input.prompt)
      form.append('n', '1')
      if (input.quality) form.append('quality', input.quality)
      form.append('response_format', 'b64_json')
      for (const img of images) {
        if (img instanceof Blob) form.append('image[]', img, 'reference.png')
        else if (ArrayBuffer.isView(img)) form.append('image[]', new Blob([img], { type: 'image/png' }), 'reference.png')
        else throw providerError(id, 'invalid-input', { hint: 'edit reference must be Blob/Buffer' })
      }
      const res = await fetchWithTimeout(endpointFor(baseUrl, modelPrefix, 'edit'), {
        providerId: id, method: 'POST',
        headers: { Authorization: `Bearer ${ctx.apiKey}` },
        body: form, signal: ctx.signal, timeoutMs: ctx.timeoutMs
      })
      if (!res.ok) throw providerError(id, statusToReason(res.status), { status: res.status })
      let payload
      try { payload = await res.json() } catch { throw providerError(id, 'invalid-response', { status: res.status }) }
      const b64 = payload?.data?.[0]?.b64_json
      if (!b64) throw providerError(id, 'invalid-response', { hint: 'no b64_json in payload' })
      return {
        bytes: Buffer.from(b64, 'base64'),
        mime: 'image/png',
        model,
        mode: 'edit',
        elapsedMs: Date.now() - started,
        providerMeta: { aspectRatio: input.aspectRatio, providerName, referenceCount: images.length }
      }
    },

    async testConnection(ctx) {
      if (!ctx.apiKey) return { ok: false, reason: 'invalid-key' }
      try {
        // Cheap probe: send a HEAD-style request to /v1/models if the
        // operator's proxy supports it; fall back to a tiny GET on the base.
        const trimmed = String(baseUrl).replace(/\/+$/, '')
        const probeUrl = `${trimmed}/v1/models`
        const res = await fetchWithTimeout(probeUrl, {
          providerId: id, method: 'GET',
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
}

/**
 * Default Custom provider stub used at registration time before the operator
 * has configured anything. Renders the Custom Settings tab; refuses to
 * generate until configured.
 */
export const customProviderTemplate = Object.freeze({
  id: 'custom',
  label: 'Custom (OpenAI-compatible)',
  authFields: AUTH_FIELDS,
  capabilities: {
    supportsGenerate: true, supportsEdit: true,
    defaultGenerateModel: 'gpt-image-2',
    defaultEditModel: 'gpt-image-2/edit',
    supportedAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
    supportedQualities: ['low', 'medium', 'high', 'auto'],
    supportedOutputFormats: ['png']
  },
  models: [],
  async generate() {
    throw providerError('custom', 'invalid-input', { hint: 'Custom provider not configured — set Provider Name + Base URL in Settings' })
  },
  async edit() {
    throw providerError('custom', 'invalid-input', { hint: 'Custom provider not configured — set Provider Name + Base URL in Settings' })
  },
  async testConnection() { return { ok: false, reason: 'invalid-input' } }
})
