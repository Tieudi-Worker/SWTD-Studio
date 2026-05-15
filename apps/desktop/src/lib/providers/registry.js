/**
 * Provider registry.
 *
 * Single home for the provider list. Concrete adapters never import each
 * other — the registry is the only module that knows about all three.
 *
 * Spec: docs/features/phase-3-model-adapter/spec.md §2
 * Plan: docs/features/phase-3-model-adapter/plan.md §3 + §4.2
 */

import { mockProvider } from './mock-provider.js'
import { falProvider } from './fal-provider.js'
import { openaiProvider } from './openai-provider.js'
import { getActiveProviderId, setActiveProviderId, hasKey } from '../key-store.js'

export const PROVIDERS = Object.freeze([mockProvider, falProvider, openaiProvider])

/** Look up a provider by id. Returns null if unknown. */
export function getProvider(id) {
  return PROVIDERS.find(p => p.id === id) || null
}

/** Default (mock) — the always-available fallback. */
export function getMockProvider() {
  return mockProvider
}

/**
 * Resolve the provider that should actually execute the next generation,
 * applying the Q1-locked graceful-degradation rule: if the operator-selected
 * provider requires an API key but has none saved, fall back to mock and
 * surface the substitution.
 *
 * @returns {{
 *   provider: import('./types.js').ImageProvider,
 *   fellBackToMock: boolean,
 *   reason?: 'missing-key'|'unknown-provider'
 * }}
 */
export function resolveActiveProvider() {
  const id = getActiveProviderId()
  const requested = getProvider(id)
  if (!requested) {
    return { provider: mockProvider, fellBackToMock: true, reason: 'unknown-provider' }
  }
  if (requested.requiresApiKey && !hasKey(requested.id)) {
    return { provider: mockProvider, fellBackToMock: true, reason: 'missing-key' }
  }
  return { provider: requested, fellBackToMock: false }
}

export { getActiveProviderId, setActiveProviderId }
