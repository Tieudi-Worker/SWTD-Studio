/**
 * Fallback router.
 *
 * Walks an ordered provider chain and stops on the first success. Returns
 * `{ servedProvider, fallbackChain, result }` so the renderer can render a
 * `via X (Y rate-limited)` badge without losing the failure trail.
 *
 * Two ProviderError reasons do NOT trigger auto-fallback:
 *   - `invalid-response`  → operator should see the actual failure
 *   - `aborted`           → the operator explicitly cancelled
 *
 * Plan §4.8.
 */

import { normalizeError, isFallbackEligible, providerError } from './error.js'

/**
 * @param {object} args
 * @param {string[]} args.chain                Ordered provider ids
 * @param {(id:string) => import('./types.js').ImageProvider | null} args.getProvider
 * @param {(provider: import('./types.js').ImageProvider) => Promise<import('./types.js').ProviderRawResult>} args.execute
 *        Caller-supplied per-provider execution closure; the router does not
 *        know whether it's a generate or edit call.
 * @param {object} [args.skipped]              Pre-skipped chain entries from getDefaultRoute
 * @param {Array<{providerId:string, reason:string}>} [args.skipped]
 * @param {object} [args.logger]
 */
export async function route({ chain, getProvider, execute, skipped = [], logger }) {
  if (!Array.isArray(chain) || chain.length === 0) {
    throw providerError('router', 'all-providers-failed', { attempted: skipped })
  }

  const attempted = [...skipped]

  for (const providerId of chain) {
    const provider = getProvider(providerId)
    if (!provider) {
      attempted.push({ providerId, reason: 'unknown' })
      continue
    }
    try {
      const result = await execute(provider)
      const fallbackChain = attempted.slice()
      if (logger && fallbackChain.length > 0) {
        logger.warn('router: fell back', { servedProvider: providerId, fallbackChain })
      }
      return { servedProvider: providerId, fallbackChain, result }
    } catch (err) {
      const normalized = normalizeError(err, providerId)
      attempted.push({
        providerId,
        reason: normalized.reason,
        status: normalized.status
      })
      if (!isFallbackEligible(normalized.reason)) {
        // Surface the actual error so the operator sees it. Carry the
        // fallback trail on the error for diagnostics.
        normalized.attempted = attempted
        throw normalized
      }
      // else: continue with the next provider
    }
  }

  throw providerError('router', 'all-providers-failed', { attempted })
}
