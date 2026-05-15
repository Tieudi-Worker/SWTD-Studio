/**
 * FAL.ai provider — `openai/gpt-image-2` (text-to-image).
 *
 * v1 ships text-to-image only. The `/edit` endpoint with reference-image
 * upload is a Phase 3.5 enhancement (requires file-storage upload + URL
 * round-trip).
 *
 * Spec: docs/features/phase-3-model-adapter/spec.md §2 FAL adapter
 * Plan: docs/features/phase-3-model-adapter/plan.md §4.4
 */

import { providerError, PROVIDER_TIMEOUTS_MS } from './types.js'

const TEXT_TO_IMAGE_URL = 'https://fal.run/openai/gpt-image-2'

/** Multiples of 16, max 3840 edge, per FAL's docs.
 *  Verified against the meta-ads-generator-template reference app. */
const ASPECT_TO_IMAGE_SIZE = {
  '1:1':  { width: 2048, height: 2048 },
  '4:5':  { width: 1664, height: 2080 },
  '9:16': { width: 1440, height: 2560 },
  '16:9': { width: 2560, height: 1440 }
}

function statusToReason(status) {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'network'
  if (status >= 400) return 'invalid-response'
  return 'unknown'
}

/** Run a fetch with an abort + hard-timeout chained to the caller's signal. */
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

export const falProvider = Object.freeze({
  id: 'fal',
  label: 'FAL.ai (gpt-image-2)',
  requiresApiKey: true,
  docsUrl: 'https://fal.ai/dashboard/keys',

  async generate({ prompt, aspectRatio = '1:1', quality = 'high', signal } = {}, apiKey) {
    if (!apiKey) throw providerError('fal', 'invalid-key', { hint: 'no API key configured' })
    if (signal?.aborted) throw providerError('fal', 'aborted')

    const image_size = ASPECT_TO_IMAGE_SIZE[aspectRatio] || ASPECT_TO_IMAGE_SIZE['1:1']
    const body = {
      prompt,
      image_size,
      quality,
      num_images: 1,
      output_format: 'png'
    }
    const started = Date.now()

    let res
    try {
      res = await fetchWithTimeout(TEXT_TO_IMAGE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      }, { signal, timeoutMs: PROVIDER_TIMEOUTS_MS.fal })
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw providerError('fal', signal?.aborted ? 'aborted' : 'timeout')
      }
      throw providerError('fal', 'network', { hint: 'fetch failed before response' })
    }

    if (!res.ok) {
      throw providerError('fal', statusToReason(res.status), { status: res.status })
    }

    let payload
    try {
      payload = await res.json()
    } catch {
      throw providerError('fal', 'invalid-response', { status: res.status })
    }

    const first = payload?.images?.[0]
    if (!first?.url) {
      throw providerError('fal', 'invalid-response', { hint: 'no image url in payload' })
    }

    // Second fetch — pull the image bytes. Same abort + timeout chain.
    let imgRes
    try {
      imgRes = await fetchWithTimeout(first.url, {}, { signal, timeoutMs: PROVIDER_TIMEOUTS_MS.fal })
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw providerError('fal', signal?.aborted ? 'aborted' : 'timeout')
      }
      throw providerError('fal', 'network', { hint: 'image download failed' })
    }
    if (!imgRes.ok) {
      throw providerError('fal', statusToReason(imgRes.status), { status: imgRes.status })
    }

    const imageBlob = await imgRes.blob()
    return {
      imageBlob,
      mime: imageBlob.type || 'image/png',
      elapsedMs: Date.now() - started,
      providerMeta: {
        aspectRatio,
        width: first.width,
        height: first.height,
        inferenceSeconds: payload?.timings?.inference
      }
    }
  },

  async testConnection(apiKey) {
    if (!apiKey) return { ok: false, reason: 'invalid-key' }
    // FAL has no documented cheap probe; the smallest billable request is
    // already noticeable. Strategy: HEAD against the endpoint URL — FAL
    // returns 401 immediately on bad-auth without engaging the model.
    // Acceptable approximation: a key that survives auth but fails for
    // other reasons still reports 'ok' here.
    try {
      const res = await fetch(TEXT_TO_IMAGE_URL, {
        method: 'HEAD',
        headers: { 'Authorization': `Key ${apiKey}` }
      })
      // FAL returns 405 (Method Not Allowed) on HEAD for /run endpoints
      // when auth is valid. 401/403 means bad key.
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: 'unauthorized' }
      }
      return { ok: true }
    } catch {
      return { ok: false, reason: 'network' }
    }
  }
})

export { ASPECT_TO_IMAGE_SIZE as FAL_SIZES }
