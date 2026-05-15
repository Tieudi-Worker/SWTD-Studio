/**
 * Excerpt helper — pulls a ≤ 200-char passage out of a payload around the
 * offending match so findings carry just enough context for the operator
 * to recognise what triggered the rule.
 *
 * Plan §3 (excerpt.js) + §4.3 (verdict shape: `excerpt?: string` ≤ 200 chars).
 */

const MAX = 200

/**
 * Extract a window around `matchIndex` of length `matchLength`. Trims to word
 * boundaries where reasonable; never returns more than 200 chars.
 *
 * @param {string} text
 * @param {number} matchIndex
 * @param {number} [matchLength]
 * @returns {string}
 */
export function excerptAround(text, matchIndex, matchLength = 0) {
  if (typeof text !== 'string' || text.length === 0) return ''
  if (typeof matchIndex !== 'number' || matchIndex < 0) matchIndex = 0
  const len = Math.max(0, matchLength)

  // Aim for ~80 chars of context on each side of the match.
  const radius = Math.max(0, Math.floor((MAX - len) / 2))
  let start = Math.max(0, matchIndex - radius)
  let end   = Math.min(text.length, matchIndex + len + radius)

  // Snap to whitespace boundaries when possible (within a small window) to
  // avoid cutting mid-word, but never grow beyond the cap.
  if (start > 0) {
    const snap = text.lastIndexOf(' ', start)
    if (snap !== -1 && start - snap < 20) start = snap + 1
  }
  if (end < text.length) {
    const snap = text.indexOf(' ', end)
    if (snap !== -1 && snap - end < 20) end = snap
  }

  let out = text.slice(start, end).replace(/\s+/g, ' ').trim()
  if (out.length > MAX) out = out.slice(0, MAX - 1) + '…'
  if (start > 0)            out = '…' + out
  if (end   < text.length) out = out + '…'
  return out
}

/**
 * Convenience: extract an excerpt for a known matched substring. Returns an
 * empty string if `match` is not found inside `text`.
 */
export function excerptForMatch(text, match) {
  if (typeof text !== 'string' || typeof match !== 'string' || match.length === 0) return ''
  const idx = text.toLowerCase().indexOf(match.toLowerCase())
  if (idx < 0) return ''
  return excerptAround(text, idx, match.length)
}
