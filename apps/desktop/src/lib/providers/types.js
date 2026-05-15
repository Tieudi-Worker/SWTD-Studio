/**
 * Image-provider interface contract for Phase 3.
 *
 * Every concrete provider (mock-provider.js, fal-provider.js,
 * openai-provider.js) implements exactly this shape — no extra public
 * methods, no provider-specific knobs leaking into the registry or the
 * Shell.jsx dispatcher.
 *
 * This module is pure JSDoc typedefs — no runtime exports. It exists so
 * the contract has a single home for review + future agents to grep.
 *
 * Spec: docs/features/phase-3-model-adapter/spec.md §2
 * Plan: docs/features/phase-3-model-adapter/plan.md §4.1
 */

/**
 * @typedef {Object} GenerateRequest
 * @property {string} prompt           Composed prompt text (Phase 2 output).
 * @property {'1:1'|'4:5'|'9:16'|'16:9'} [aspectRatio]
 * @property {Blob[]} [referenceImages] Optional. v1 passes []. Reference-image
 *                                       grounding (FAL `/edit`) is Phase 3.5.
 * @property {'low'|'medium'|'high'} [quality]
 * @property {AbortSignal} signal       Cancellation signal — providers MUST
 *                                       honor `signal.aborted` and reject the
 *                                       promise with `{ name: 'AbortError' }`
 *                                       when the controller aborts mid-flight.
 */

/**
 * @typedef {Object} GenerateResult
 * @property {Blob} imageBlob           Generated image bytes (always PNG in v1).
 * @property {string} mime              'image/png'
 * @property {number} elapsedMs
 * @property {Object} [providerMeta]    Provider-specific debug info. Must NOT
 *                                       contain the API key, header values,
 *                                       or any auth material.
 */

/**
 * @typedef {Object} ProviderError
 * @property {'ProviderError'} name
 * @property {string} providerId        'mock' | 'fal' | 'openai'
 * @property {number} [status]          HTTP status when applicable.
 * @property {('unauthorized'|'rate-limited'|'timeout'|'network'|'invalid-response'|'aborted'|'invalid-key'|'unknown')} reason
 * @property {string} [hint]            Operator-facing one-liner (not a stack trace).
 */

/**
 * @typedef {Object} ImageProvider
 * @property {string} id                'mock' | 'fal' | 'openai'
 * @property {string} label             Human-readable name for the picker.
 * @property {boolean} requiresApiKey
 * @property {string} [docsUrl]         Optional. Surfaced as a "where to get a key" link.
 * @property {(req: GenerateRequest, apiKey?: string) => Promise<GenerateResult>} generate
 * @property {(apiKey: string) => Promise<{ ok: boolean, reason?: string }>} testConnection
 */

/**
 * Standard error factory — providers call this to produce a structured
 * ProviderError instead of throwing strings.
 *
 * @param {string} providerId
 * @param {ProviderError['reason']} reason
 * @param {object} [extras]
 * @returns {Error & ProviderError}
 */
export function providerError(providerId, reason, extras = {}) {
  const err = new Error(`[${providerId}] ${reason}`)
  err.name = 'ProviderError'
  err.providerId = providerId
  err.reason = reason
  if (extras.status != null) err.status = extras.status
  if (extras.hint) err.hint = extras.hint
  return err
}

/** Hard timeouts per provider (Boss-acceptable defaults). */
export const PROVIDER_TIMEOUTS_MS = Object.freeze({
  mock:   10_000,
  fal:    120_000,
  openai: 90_000
})
