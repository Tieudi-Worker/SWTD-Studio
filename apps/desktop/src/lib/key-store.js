/**
 * Per-provider API key persistence.
 *
 * Boss Q1 (LOCKED): plain `localStorage` under `swtd_provider_keys` with an
 * explicit warning chip in the UI. Anyone with renderer-process access can
 * read the keys. Future hardening to OS keychain / Electron `safeStorage`
 * will land in a separate security pass.
 *
 * NEVER logs the key. NEVER sends it anywhere. UI components show the
 * field masked by default.
 *
 * Spec: docs/features/phase-3-model-adapter/spec.md §7 Q1
 * Plan: docs/features/phase-3-model-adapter/plan.md §4.3
 */

const STORAGE_KEY = 'swtd_provider_keys'
const ACTIVE_PROVIDER_KEY = 'swtd_active_provider'

function readAll() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return (parsed && typeof parsed === 'object') ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(obj) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj || {}))
  } catch { /* quota or serialization — accept loss */ }
}

/** Read a provider's saved API key. Empty string if absent. */
export function getKey(providerId) {
  if (!providerId) return ''
  return readAll()[providerId] || ''
}

/** Store a provider's API key. Empty/null value clears the entry. */
export function setKey(providerId, value) {
  if (!providerId) return
  const all = readAll()
  const trimmed = String(value || '').trim()
  if (!trimmed) delete all[providerId]
  else all[providerId] = trimmed
  writeAll(all)
}

/** Remove a provider's API key. */
export function clearKey(providerId) {
  setKey(providerId, '')
}

/** Boolean: does this provider have a non-empty key saved? */
export function hasKey(providerId) {
  return !!getKey(providerId)
}

/** Returns map of `{ providerId: hasKeyBool }` — never returns the keys themselves. */
export function summarize() {
  const all = readAll()
  const out = {}
  for (const k of Object.keys(all)) out[k] = !!(all[k] && all[k].length)
  return out
}

/** Active provider id persistence (separate key so wipe-all doesn't lose preference). */
export function getActiveProviderId() {
  if (typeof localStorage === 'undefined') return 'mock'
  try {
    const raw = localStorage.getItem(ACTIVE_PROVIDER_KEY)
    return raw || 'mock'
  } catch {
    return 'mock'
  }
}

export function setActiveProviderId(providerId) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ACTIVE_PROVIDER_KEY, String(providerId || 'mock'))
  } catch { /* ignore */ }
}

/** Mask a key for log/display. Returns "·······abcd" for keys >= 8 chars,
 *  or "·••··" for shorter ones. NEVER call this with the full key going
 *  anywhere observable; it's only for UI breadcrumbs. */
export function maskKey(key) {
  if (!key) return ''
  const s = String(key)
  if (s.length < 8) return '•'.repeat(s.length)
  return '•'.repeat(s.length - 4) + s.slice(-4)
}
