/**
 * Web research adapters — `webSearch` + `webFetch`.
 *
 * Plan §4.5 + research Q8. v1 ships:
 *   - webFetch: a generic Node fetch that reads HTML, runs `sanitizeWebText`,
 *     and returns the sentinel-wrapped body + provenance.
 *   - webSearch: a pluggable search backend selectable by the caller.
 *     Implementer-default is `mock` (offline-safe deterministic results) so
 *     the rest of the pipeline can be exercised without a paid search key.
 *     Real backends (Google Programmable Search, Bing, or a Custom-provider
 *     adapter) can be wired in by passing a different `searchBackend`.
 *
 * The web-research module never reaches into the renderer; it is consumed by
 * `insight-brief.js` which itself is invoked from main via IPC.
 */

import { fetchWithTimeout } from './providers/_fetch.js'
import { sanitizeWebText } from './sanitize.js'
import { providerError, statusToReason } from './error.js'

const DEFAULT_FETCH_TIMEOUT_MS = 30_000
const ACCEPTED_CONTENT_TYPES = [/^text\/html/i, /^text\/plain/i, /^application\/xhtml\+xml/i]

/**
 * Fetch a URL and return sanitized text + provenance. Treats the response as
 * untrusted: scripts/styles/comments stripped, prompt-injection lines quoted,
 * sentinel-wrapped before returning.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @param {AbortSignal} [opts.signal]
 * @param {number} [opts.maxBodyChars]
 */
export async function webFetch(url, opts = {}) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    throw providerError('web-research', 'invalid-input', { hint: 'webFetch requires http(s) url' })
  }
  const fetchedAt = Date.now()
  const res = await fetchWithTimeout(url, {
    providerId: 'web-research', method: 'GET',
    headers: { 'User-Agent': 'SWTD-Studio/provider-core (research)' },
    signal: opts.signal,
    timeoutMs: opts.timeoutMs || DEFAULT_FETCH_TIMEOUT_MS
  })
  if (!res.ok) {
    throw providerError('web-research', statusToReason(res.status), { status: res.status, hint: `webFetch ${url}` })
  }
  const contentType = res.headers.get('content-type') || ''
  if (!ACCEPTED_CONTENT_TYPES.some((r) => r.test(contentType))) {
    throw providerError('web-research', 'invalid-response', {
      hint: `webFetch content-type not accepted: ${contentType}`
    })
  }
  let bodyText
  try { bodyText = await res.text() } catch (err) {
    throw providerError('web-research', 'invalid-response', { hint: err && err.message })
  }
  const { body, rawTextLength, flagged, sanitized } = sanitizeWebText(bodyText, { maxBodyChars: opts.maxBodyChars })
  return {
    url, fetchedAt,
    contentType,
    textBody: body,
    rawTextLength,
    rawBytesLength: bodyText.length,
    flagged,
    sanitized
  }
}

/* -------------------------------------------------------------------------- */
/* webSearch backends                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Mock backend — deterministic, offline-safe. Returns synthesized hits so the
 * pipeline can be exercised end-to-end without a paid search key. Implementer
 * default per plan §5 Q8; real backends can be wired in by callers.
 */
export function createMockSearchBackend() {
  return {
    id: 'mock',
    async search(query) {
      if (typeof query !== 'string' || !query.length) return []
      const slug = query.trim().slice(0, 40).replace(/\s+/g, '-').toLowerCase()
      return [
        { title: `Top picks for "${query}"`, url: `https://example.invalid/${slug}/top`, snippet: `Sample snippet for ${query}`, source: 'mock' },
        { title: `Buying guide: ${query}`,    url: `https://example.invalid/${slug}/guide`, snippet: `Common buying triggers for ${query}.`, source: 'mock' },
        { title: `Reviews on ${query}`,        url: `https://example.invalid/${slug}/reviews`, snippet: `What customers say about ${query}.`, source: 'mock' }
      ]
    }
  }
}

/**
 * Google Programmable Search (CSE) backend — needs an API key + cx engine id.
 * Returned hits are the same shape as the mock backend so callers can swap
 * without changes. Search snippets are NOT sanitized (the caller passes the
 * full result through `webFetch` if it wants the body, which IS sanitized).
 */
export function createGoogleCseBackend({ apiKey, cx, timeoutMs }) {
  if (!apiKey || !cx) throw new TypeError('createGoogleCseBackend: apiKey + cx required')
  return {
    id: 'google-cse',
    async search(query, opts = {}) {
      if (typeof query !== 'string' || !query.length) return []
      const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}`
      const res = await fetchWithTimeout(url, {
        providerId: 'web-research', method: 'GET',
        signal: opts.signal,
        timeoutMs: timeoutMs || DEFAULT_FETCH_TIMEOUT_MS
      })
      if (!res.ok) throw providerError('web-research', statusToReason(res.status), { status: res.status })
      const payload = await res.json().catch(() => null)
      const items = Array.isArray(payload?.items) ? payload.items : []
      return items.map((i) => ({
        title: i.title, url: i.link, snippet: i.snippet, source: 'google-cse'
      }))
    }
  }
}

/**
 * Run a `webSearch` against the supplied backend. The default backend (mock)
 * is offline-safe so the rest of the pipeline can be tested.
 */
export async function webSearch(query, { backend, signal } = {}) {
  const b = backend || createMockSearchBackend()
  return b.search(query, { signal })
}
