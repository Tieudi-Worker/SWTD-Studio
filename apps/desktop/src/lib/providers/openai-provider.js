/**
 * OpenAI provider — `gpt-image-2` via the REST Images API.
 *
 * Spec: docs/features/phase-3-model-adapter/spec.md §2 OpenAI adapter
 * Plan: docs/features/phase-3-model-adapter/plan.md §4.5
 */

import { providerError, PROVIDER_TIMEOUTS_MS } from './types.js'

const GENERATIONS_URL = 'https://api.openai.com/v1/images/generations'
const MODELS_URL = 'https://api.openai.com/v1/models'

/** OpenAI's supported sizes are a coarser subset than FAL's. We map
 *  every aspect ratio to the closest supported size and surface the
 *  approximation in providerMeta so the UI can show a hint. */
const ASPECT_TO_SIZE = {
  '1:1':  { size: '1024x1024', exact: true  },
  '4:5':  { size: '1024x1536', exact: true  },
  '9:16': { size: '1024x1536', exact: false }, // closest supported portrait
  '16:9': { size: '1536x1024', exact: true  }
}

function statusToReason(status) {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'network'
  if (status >= 400) return 'invalid-response'
  return 'unknown'
}

async function fetchWithTimeout(url, init, { signal, timeoutMs }) {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

/** Decode base64 string to a PNG Blob without ever logging the bytes. */
function b64ToBlob(b64) {
  if (typeof atob !== 'function') {
    throw providerError('openai', 'invalid-response', { hint: 'atob not available in this runtime' })
  }
  const bin = atob(b64)
  const len = bin.length
  const u8 = new Uint8Array(len)
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i)
  return new Blob([u8], { type: 'image/png' })
}

export const openaiProvider = Object.freeze({
  id: 'openai',
  label: 'OpenAI (gpt-image-2)',
  requiresApiKey: true,
  docsUrl: 'https://platform.openai.com/api-keys',

  async generate({ prompt, aspectRatio = '1:1', quality = 'high', signal } = {}, apiKey) {
    if (!apiKey) throw providerError('openai', 'invalid-key', { hint: 'no API key configured' })
    if (signal?.aborted) throw providerError('openai', 'aborted')

    const sizeMap = ASPECT_TO_SIZE[aspectRatio] || ASPECT_TO_SIZE['1:1']
    const body = {
      model: 'gpt-image-2',
      prompt,
      n: 1,
      size: sizeMap.size,
      quality,
      response_format: 'b64_json'
    }
    const started = Date.now()

    let res
    try {
      res = await fetchWithTimeout(GENERATIONS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      }, { signal, timeoutMs: PROVIDER_TIMEOUTS_MS.openai })
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw providerError('openai', signal?.aborted ? 'aborted' : 'timeout')
      }
      throw providerError('openai', 'network', { hint: 'fetch failed before response' })
    }

    if (!res.ok) {
      throw providerError('openai', statusToReason(res.status), { status: res.status })
    }

    let payload
    try {
      payload = await res.json()
    } catch {
      throw providerError('openai', 'invalid-response', { status: res.status })
    }

    const b64 = payload?.data?.[0]?.b64_json
    if (!b64) {
      throw providerError('openai', 'invalid-response', { hint: 'no b64_json in payload' })
    }

    const imageBlob = b64ToBlob(b64)
    return {
      imageBlob,
      mime: 'image/png',
      elapsedMs: Date.now() - started,
      providerMeta: {
        aspectRatio,
        size: sizeMap.size,
        aspectApproximated: !sizeMap.exact
      }
    }
  },

  async testConnection(apiKey) {
    if (!apiKey) return { ok: false, reason: 'invalid-key' }
    try {
      const res = await fetch(MODELS_URL, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: 'unauthorized' }
      }
      if (res.ok) return { ok: true }
      return { ok: false, reason: 'invalid-response' }
    } catch {
      return { ok: false, reason: 'network' }
    }
  }
})

export { ASPECT_TO_SIZE as OPENAI_SIZES }
