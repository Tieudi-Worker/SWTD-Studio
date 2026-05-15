/**
 * Canonical slot state machine for the 8-slot listing pipeline.
 *
 * Six canonical UI states (spec.md §2.US1):
 *   idle       — slot has never been queued this run, no file on disk
 *   queued     — slot pending in current run, not yet started
 *   generating — slot is actively being produced
 *   success    — slot finished successfully (file on disk + validated)
 *   failed     — slot failed (runtime error or validator rejection)
 *   approved   — operator confirmed slot is ready (manual export gate)
 *
 * Legacy → canonical mapping bridges the existing 5-state derivation
 * (`slot-progress.js`: idle/running/done/error/skipped) onto this set.
 * The migration is deterministic and lossless for the 5 source states;
 * `queued` and `approved` are layered on top from run + approval context.
 */

export const SLOT_STATES = Object.freeze([
  'idle',
  'queued',
  'generating',
  'success',
  'failed',
  'approved'
])

/**
 * Legal transitions per spec.md §4.1. Used for assert-style guards in
 * the mock pipeline and for the run timeline's transition labels.
 */
export const TRANSITIONS = Object.freeze({
  idle:       ['queued'],
  queued:     ['generating', 'failed', 'idle'],
  generating: ['success', 'failed'],
  success:    ['approved', 'queued'],
  failed:     ['queued', 'idle'],
  approved:   ['queued']
})

const LEGACY_TO_CANONICAL = {
  idle:    'idle',
  running: 'generating',
  done:    'success',
  error:   'failed',
  // 'skipped' covers two cases:
  //   (a) explicit --skip-slots: slot was deliberately not regenerated this
  //       run; treat as idle for current-run visualization. Validator's disk
  //       truth (already merged upstream in mergeStatesWithValidator) will
  //       promote to 'success' if a prior file is on disk.
  //   (b) checkpoint-skipped: legacy parser also writes 'done' for this case.
  skipped: 'idle'
}

/**
 * Translate a single legacy state token into the canonical set.
 * Falls back to 'idle' for unknown tokens (never throws).
 * @param {string} legacy
 * @returns {'idle'|'queued'|'generating'|'success'|'failed'|'approved'}
 */
export function legacyToCanonical(legacy) {
  return LEGACY_TO_CANONICAL[legacy] || 'idle'
}

/**
 * Derive the canonical 6-state map for all 8 listing slots.
 *
 * @param {Object} args
 * @param {Record<number,string>} [args.legacyStates] - output of mergeStatesWithValidator(deriveSlotStates(...), validatorReport)
 * @param {Iterable<number>}      [args.pendingRegen] - slot IDs queued for current run
 * @param {string}                [args.runStatus]    - 'idle' | 'running' | 'ok' | 'err' | 'paused' | 'cancelled'
 * @param {Record<number,string>} [args.approvals]    - per-slot operator approval ('approved'|'needs-regen'|undefined)
 * @returns {Record<number,'idle'|'queued'|'generating'|'success'|'failed'|'approved'>}
 */
export function deriveCanonicalSlotStates({
  legacyStates = {},
  pendingRegen = [],
  runStatus = 'idle',
  approvals = {}
} = {}) {
  const regenSet = new Set(pendingRegen)
  const out = {}
  for (let id = 1; id <= 8; id++) {
    const legacy = legacyStates[id] || 'idle'
    let canonical = legacyToCanonical(legacy)
    if (canonical === 'idle' && runStatus === 'running' && regenSet.has(id)) {
      canonical = 'queued'
    }
    if (approvals[id] === 'approved' && canonical === 'success') {
      canonical = 'approved'
    }
    out[id] = canonical
  }
  return out
}

/**
 * Apply a single transition with guard. Returns either the new state, or
 * the prior state if the transition is illegal. Logs (when DEV) but never
 * throws — UI must stay alive in the face of malformed runtime events.
 *
 * @param {string} prior
 * @param {string} next
 * @returns {string}
 */
export function applyTransition(prior, next) {
  if (!SLOT_STATES.includes(next)) return prior
  if (!SLOT_STATES.includes(prior)) return next
  const allowed = TRANSITIONS[prior] || []
  if (!allowed.includes(next)) return prior
  return next
}
