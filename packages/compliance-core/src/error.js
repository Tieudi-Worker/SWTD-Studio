/**
 * ComplianceError factory + helpers.
 *
 * Mirrors Provider Core's `error.js` shape so renderer / log emitters can use
 * the same `name + reason + hint` discipline. Throwing strings is forbidden.
 *
 * Plan §4.10.
 */

/** @type {ReadonlySet<string>} */
const VALID_REASONS = new Set([
  'pack-invalid',
  'rule-invalid',
  'subject-invalid',
  'predicate-error',
  'override-invalid',
  'fix-not-applicable',
  'unknown'
])

/**
 * Build a structured ComplianceError.
 *
 * @param {string} reason   One of VALID_REASONS
 * @param {object} [extras]
 * @param {string} [extras.ruleId]
 * @param {string} [extras.packId]
 * @param {string} [extras.hint]
 */
export function complianceError(reason, extras = {}) {
  const safeReason = VALID_REASONS.has(reason) ? reason : 'unknown'
  const err = new Error(`[compliance] ${safeReason}${extras.hint ? `: ${extras.hint}` : ''}`)
  err.name = 'ComplianceError'
  err.reason = safeReason
  if (extras.ruleId) err.ruleId = extras.ruleId
  if (extras.packId) err.packId = extras.packId
  if (extras.hint)  err.hint  = String(extras.hint).slice(0, 500)
  return err
}

/**
 * True if the given value walks like a ComplianceError. Used by the Electron
 * main wrapper to decide whether to re-wrap or pass through.
 */
export function isComplianceError(err) {
  return err && err.name === 'ComplianceError' && typeof err.reason === 'string'
}
