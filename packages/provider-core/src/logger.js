/**
 * Secret-scrubbing logger wrapper.
 *
 * Every log line that ever leaves provider-core passes through `scrub()` so
 * fields named `apiKey` / `key` / `token` / `bearer` / `authorization` (any
 * case) never reach stdout, log files, or the renderer event channel.
 *
 * The wrapper is a tiny adapter — it defers to an injected base logger
 * (typically `console` in main, or a pino instance) so callers can pick the
 * sink. If no base is provided, `console` is used.
 *
 * Plan §4.9.
 */

const SECRET_KEYS = new Set([
  'apikey', 'api_key', 'key', 'token', 'bearer', 'authorization', 'auth',
  'secret', 'password', 'access_token', 'refresh_token'
])
const REDACTED = '[redacted]'

function isSecretKeyName(name) {
  if (typeof name !== 'string') return false
  return SECRET_KEYS.has(name.toLowerCase())
}

/**
 * Recursively replace any object value whose key matches the secret list with
 * `[redacted]`. Arrays are walked; primitives are returned as-is. Cycle-safe
 * via a WeakSet.
 */
export function scrub(value, seen = new WeakSet()) {
  if (value == null || typeof value !== 'object') return value
  if (seen.has(value)) return '[cycle]'
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map((v) => scrub(v, seen))
  }
  const out = {}
  for (const [k, v] of Object.entries(value)) {
    if (isSecretKeyName(k)) {
      out[k] = REDACTED
    } else if (typeof v === 'string' && /^Bearer\s+/i.test(v)) {
      out[k] = 'Bearer ' + REDACTED
    } else {
      out[k] = scrub(v, seen)
    }
  }
  return out
}

/**
 * Build a logger. `base` is the underlying sink; if omitted, `console` is
 * used. Returns an object with `info / warn / error / debug` methods that
 * each accept `(msg, fields?)`.
 */
export function createLogger(base = console) {
  const emit = (level, msg, fields) => {
    const scrubbed = fields ? scrub(fields) : undefined
    const fn = base[level] || base.log || (() => {})
    if (scrubbed) fn.call(base, `[provider-core] ${msg}`, scrubbed)
    else fn.call(base, `[provider-core] ${msg}`)
  }
  return {
    info:  (msg, fields) => emit('info',  msg, fields),
    warn:  (msg, fields) => emit('warn',  msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    debug: (msg, fields) => emit('debug', msg, fields)
  }
}

export const NOOP_LOGGER = Object.freeze({
  info: () => {}, warn: () => {}, error: () => {}, debug: () => {}
})
