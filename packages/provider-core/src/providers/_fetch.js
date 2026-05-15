/**
 * Shared fetch-with-timeout helper used by every real provider.
 *
 * Chains the caller's AbortSignal to a per-request timer so a long-running
 * provider call cannot exceed `timeoutMs`. Failure modes are normalized to
 * the ProviderError vocabulary.
 *
 * Pure Node 18+ `fetch` + AbortController. Zero external deps.
 */

import { providerError } from '../error.js'

/**
 * @param {string} url
 * @param {RequestInit & { providerId:string, signal?:AbortSignal, timeoutMs:number }} init
 */
export async function fetchWithTimeout(url, init) {
  const { providerId, signal, timeoutMs, ...rest } = init
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  let aborted = false
  if (signal) {
    if (signal.aborted) { aborted = true; controller.abort() }
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  const timer = setTimeout(() => controller.abort('timeout'), Math.max(1, timeoutMs))
  try {
    return await fetch(url, { ...rest, signal: controller.signal })
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw providerError(providerId, aborted || signal?.aborted ? 'aborted' : 'timeout')
    }
    throw providerError(providerId, 'network', { hint: err && err.message ? err.message.slice(0, 200) : undefined })
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

/**
 * Read a fetch Response into a Buffer, normalising errors. Used by every
 * adapter that needs the image bytes back.
 */
export async function readResponseBytes(res, providerId) {
  try {
    const arr = await res.arrayBuffer()
    return Buffer.from(new Uint8Array(arr))
  } catch (err) {
    throw providerError(providerId, 'invalid-response', { hint: err && err.message })
  }
}
