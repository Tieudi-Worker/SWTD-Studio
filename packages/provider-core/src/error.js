/**
 * ProviderError factory + helpers.
 *
 * Single shape for every adapter / router / pipeline failure so the UI can
 * map `reason → i18n key` without parsing raw HTTP bodies or stack traces.
 *
 * Spec / Plan: see plan §4.9.
 */

/**
 * Build a structured ProviderError. Throwing strings is forbidden.
 *
 * @param {string} providerId  'openai' | 'fal' | 'gemini' | 'kie' | 'custom' | 'mock' | 'router'
 * @param {string} reason      One of the ProviderError reasons in types.js
 * @param {object} [extras]
 * @param {number}  [extras.status]
 * @param {string}  [extras.hint]
 * @param {Array<{providerId:string, reason:string, status?:number}>} [extras.attempted]
 */
export function providerError(providerId, reason, extras = {}) {
  const err = new Error(`[${providerId}] ${reason}`)
  err.name = 'ProviderError'
  err.providerId = providerId
  err.reason = reason
  if (extras.status != null) err.status = extras.status
  if (extras.hint) err.hint = extras.hint
  if (Array.isArray(extras.attempted)) err.attempted = extras.attempted
  return err
}

/**
 * Map an HTTP status to the canonical ProviderError reason vocabulary.
 *
 * Phase 3's renderer adapters used the same mapping; Phase 4 promotes it to
 * the shared package so every provider speaks the same dialect.
 */
export function statusToReason(status) {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate-limited'
  if (typeof status === 'number' && status >= 500) return 'network'
  if (typeof status === 'number' && status >= 400) return 'invalid-response'
  return 'unknown'
}

/**
 * Whether a given ProviderError reason is auto-fallback-eligible. Two reasons
 * are explicit non-fallback: a corrupt provider response (operator needs to
 * see the actual issue) and an explicit AbortController abort.
 */
export function isFallbackEligible(reason) {
  return reason !== 'invalid-response' && reason !== 'aborted'
}

/**
 * Normalize an arbitrary thrown value into a ProviderError without losing the
 * original reason. Used by the router so any provider that throws a plain
 * Error still produces a consistent fallback chain entry.
 */
export function normalizeError(err, providerId) {
  if (err && err.name === 'ProviderError') return err
  if (err && err.name === 'AbortError') {
    return providerError(providerId, 'aborted')
  }
  const reason = (err && typeof err.reason === 'string') ? err.reason : 'unknown'
  return providerError(providerId, reason, {
    hint: err && err.message ? String(err.message).slice(0, 200) : undefined
  })
}
