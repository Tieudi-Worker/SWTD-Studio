/**
 * Severity tier ordering for compliance findings.
 *
 * Plan §4 / Spec §2 US1 D1.
 *   info  < warn < block
 *
 * The verdict's `overall` is the worst non-overridden severity across findings.
 * `info` is informational — it never gates anything. `warn` is operator-visible
 * but does not gate. `block` gates generate (Hook 4) and export (Hook 6).
 */

const RANK = Object.freeze({
  pass:  0,
  info:  1,
  warn:  2,
  block: 3
})

/** Returns true if `severity` is the canonical severity vocabulary. */
export function isSeverity(severity) {
  return severity === 'info' || severity === 'warn' || severity === 'block'
}

/**
 * Compare two severities. Returns -1 / 0 / 1.
 */
export function compareSeverity(a, b) {
  const ra = RANK[a] ?? -1
  const rb = RANK[b] ?? -1
  if (ra < rb) return -1
  if (ra > rb) return 1
  return 0
}

/**
 * Aggregate severity across a list of findings.
 *
 * - Empty list or all-overridden → 'pass'.
 * - Otherwise → the worst non-overridden severity.
 *
 * `overridden` is set externally by the Electron-main wrapper after consulting
 * `<sku>/compliance/overrides.json`. The engine itself never reads overrides;
 * worstOf takes the wrapper's annotations as input.
 *
 * @param {Array<{severity: string, overridden?: boolean}>} findings
 */
export function worstOf(findings) {
  if (!Array.isArray(findings) || findings.length === 0) return 'pass'
  let worst = 'pass'
  for (const f of findings) {
    if (!f || f.overridden) continue
    if (!isSeverity(f.severity)) continue
    if (compareSeverity(f.severity, worst) > 0) worst = f.severity
  }
  return worst
}
