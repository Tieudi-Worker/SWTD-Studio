/**
 * Sanitize / HTML-text extraction with prompt-injection neutralization.
 *
 * Boss D8 lock: every byte that comes from a web fetch is untrusted. We
 *   1. Strip <script>, <style>, <noscript> blocks outright.
 *   2. Decode common entities into plain text.
 *   3. Walk the visible-text characters and emit a normalized string.
 *   4. Quote (do not delete) lines matching known prompt-injection markers
 *      so an audit trail exists in sources.json without the marker ever
 *      becoming an instruction.
 *   5. Wrap the body with <UNTRUSTED_WEB_CONTENT>…</UNTRUSTED_WEB_CONTENT>
 *      sentinels so downstream extractors treat the body as data, not
 *      instructions.
 *
 * Hand-rolled (no DOM library) per plan §5 Q7. If smoke tests reveal 3+
 * pages that can't be parsed, a tiny dep is surfaced to Boss before adding.
 *
 * Plan §4.5, D8.
 */

const SENTINEL_OPEN = '<UNTRUSTED_WEB_CONTENT>'
const SENTINEL_CLOSE = '</UNTRUSTED_WEB_CONTENT>'

// Case-insensitive markers a webpage might use to try to inject instructions
// into a downstream LLM. We do not strip them — we quote them so the audit
// trail is preserved.
const INJECTION_MARKERS = [
  /ignore (?:all )?previous instructions/i,
  /you are now/i,
  /system\s*:/i,
  /assistant\s*:/i,
  /###\s*instruction/i,
  /<\s*system\s*>/i,
  /forget everything/i,
  /jailbreak/i
]

// Entity decoder kept tiny on purpose; covers the noisy 90% without pulling
// a library. Numeric entities handled via String.fromCharCode.
const NAMED_ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»',
  copy: '©', reg: '®', trade: '™'
})

function decodeEntities(input) {
  if (!input) return ''
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X'
      const num = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10)
      if (Number.isFinite(num) && num > 0 && num < 0x110000) return String.fromCodePoint(num)
      return full
    }
    const named = NAMED_ENTITIES[body.toLowerCase()]
    return typeof named === 'string' ? named : full
  })
}

/**
 * Extract visible text from an HTML string. Discards script/style/noscript,
 * collapses whitespace, decodes entities. Returns the bare text — sentinel
 * wrapping happens in `sanitizeWebText` so callers can choose to opt out.
 */
export function htmlToText(html) {
  if (typeof html !== 'string' || !html.length) return ''
  let body = html
  // 1. Kill script/style/noscript blocks (including content)
  body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  body = body.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  body = body.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
  body = body.replace(/<!--[\s\S]*?-->/g, ' ')
  // 2. Replace block elements with newlines so we keep some structure
  body = body.replace(/<\/?(?:p|div|li|tr|br|h[1-6]|section|article|header|footer|nav)\b[^>]*>/gi, '\n')
  // 3. Strip remaining tags
  body = body.replace(/<[^>]+>/g, ' ')
  // 4. Decode entities, normalize whitespace
  body = decodeEntities(body)
  body = body.replace(/[\t\r\f\v]+/g, ' ')
  body = body.replace(/[ ]{2,}/g, ' ')
  body = body.split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
  return body
}

/**
 * Quote lines that match a known prompt-injection marker. Returns a tuple
 * `{ body, flagged[] }` so the caller can record provenance in sources.json.
 */
export function quoteInjectionLines(text) {
  if (!text) return { body: '', flagged: [] }
  const flagged = []
  const lines = text.split('\n').map((line) => {
    if (!line) return line
    for (const marker of INJECTION_MARKERS) {
      if (marker.test(line)) {
        flagged.push(line)
        // Quote with a leading marker so any downstream extractor treats this
        // as a quoted observation, never an instruction. The text is preserved.
        return `> [quoted-from-untrusted-source] ${line}`
      }
    }
    return line
  })
  return { body: lines.join('\n'), flagged }
}

/**
 * Public surface used by web-research.js. Always returns the sentinel-wrapped
 * form so downstream extractors see an explicit boundary.
 *
 * @param {string} html
 * @param {object} [opts]
 * @param {number} [opts.maxBodyChars]  Truncate at this many chars (default 64KB)
 */
export function sanitizeWebText(html, opts = {}) {
  const maxBodyChars = opts.maxBodyChars ?? 64 * 1024
  let text = htmlToText(html)
  if (text.length > maxBodyChars) text = text.slice(0, maxBodyChars)
  const { body, flagged } = quoteInjectionLines(text)
  return {
    body: `${SENTINEL_OPEN}\n${body}\n${SENTINEL_CLOSE}`,
    rawTextLength: text.length,
    flagged,
    sanitized: true
  }
}

export { SENTINEL_OPEN, SENTINEL_CLOSE, INJECTION_MARKERS }
