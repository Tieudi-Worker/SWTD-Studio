/**
 * Renderer-side provider registry — Phase 4 thin proxy.
 *
 * Phase 3's renderer-side adapter set (`mock-provider.js`, `fal-provider.js`,
 * `openai-provider.js`, `types.js`) is deleted in Phase 4.2. The renderer
 * no longer holds any HTTP-call code; everything goes through
 * `window.swtdProvider.*` (Plan §4.1, D5).
 *
 * This module survives as a tiny convenience wrapper so existing call sites
 * (`ProviderPicker.jsx`, `Shell.jsx`) keep importing from a stable path
 * while we migrate UI in P4.3. It exposes:
 *
 *   - `loadProviders()`         async; fetches the current provider list +
 *                               per-id key-presence from main
 *   - `getActiveProviderId()`   localStorage-mirrored picker preference
 *   - `setActiveProviderId()`   write that preference
 *
 * Plaintext keys NEVER live in the renderer in Phase 4. The legacy
 * `resolveActiveProvider({ provider, fellBackToMock, reason })` semantic is
 * moved into main via the route config + fallback router; the renderer just
 * surfaces `servedProvider` from each generation result.
 */

const ACTIVE_PROVIDER_KEY = 'swtd_active_provider'

const swtdProvider = typeof window !== 'undefined' ? window.swtdProvider : null

/**
 * Fetch the provider list from main. Returns
 * `[{ id, label, authFields, capabilities, models, hasKey }, …]`.
 * Resolves to an empty array when the preload bridge is unavailable
 * (e.g. unit tests or storybook).
 */
export async function loadProviders() {
  if (!swtdProvider?.listProviders) return []
  const res = await swtdProvider.listProviders().catch(() => null)
  if (!res?.ok || !Array.isArray(res.providers)) return []
  return res.providers
}

/** Read the operator's picked active provider id. Defaults to `mock`. */
export function getActiveProviderId() {
  if (typeof localStorage === 'undefined') return 'mock'
  try { return localStorage.getItem(ACTIVE_PROVIDER_KEY) || 'mock' } catch { return 'mock' }
}

export function setActiveProviderId(providerId) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(ACTIVE_PROVIDER_KEY, String(providerId || 'mock')) } catch { /* ignore */ }
}
