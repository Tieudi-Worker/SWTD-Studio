/**
 * Secret-scrubbing logger wrapper (compliance flavor).
 *
 * Mirrors Provider Core's `logger.js` because v1 evaluators never see secrets,
 * but a future US8 vision-adapter extension might log adapter responses that
 * carry tokens. Scrubbing now keeps that surface safe later.
 *
 * Plan §4.10.
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
 * Build a logger. `base` is the underlying sink; if omitted, `console` is used.
 */
export function createLogger(base = console) {
  const emit = (level, msg, fields) => {
    const scrubbed = fields ? scrub(fields) : undefined
    const fn = base[level] || base.log || (() => {})
    if (scrubbed) fn.call(base, `[compliance-core] ${msg}`, scrubbed)
    else fn.call(base, `[compliance-core] ${msg}`)
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
