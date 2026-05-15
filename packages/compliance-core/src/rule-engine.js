/**
 * Compliance rule engine — pure evaluation.
 *
 * `evaluate(subject, ctx)` is pure-ish (it reads frozen rule packs + an
 * extension list; it does NOT touch the filesystem or the network). The
 * Electron main wrapper persists verdicts, consults overrides, and re-runs
 * hooks; the engine itself takes a subject in and returns a verdict.
 *
 * Plan §3 (rule-engine.js) + §4.1 + §4.4.
 */

import { complianceError } from './error.js'
import { runPredicate } from './predicates/index.js'
import { normalizeSubject } from './subjects.js'
import { worstOf } from './severity.js'

export const COMPLIANCE_ENGINE_VERSION = '0.1.0'

function findingIdFor(rule, subject) {
  const stage = subject.stage || 'unknown'
  const slotKey = subject.source?.slotId != null
    ? `slot-${subject.source.slotId}`
    : (subject.source?.module ? `module-${subject.source.module}` : 'global')
  return `${rule.id}::${stage}::${slotKey}`
}

function makeFinding(rule, subject, hit) {
  return {
    id:               findingIdFor(rule, subject),
    ruleId:           rule.id,
    category:         rule.category,
    severity:         rule.severity,
    stage:            subject.stage,
    slotId:           subject.source?.slotId,
    module:           subject.source?.module,
    excerpt:          hit?.excerpt,
    matchedToken:     hit?.matched,
    sourceField:      hit?.source,
    messageKey:       rule.messageKey,
    suggestedFixKey:  rule.suggestedFixKey,
    references:       rule.references.slice()
  }
}

function makeSubjectKey(subject) {
  return {
    kind:   subject.kind,
    stage:  subject.stage,
    slotId: subject.source?.slotId,
    module: subject.source?.module
  }
}

/**
 * Build an engine instance.
 *
 * @param {object} opts
 * @param {ReadonlyArray<object>} opts.rulePacks
 * @param {{ register: Function, forStage: Function, list: Function }} [opts.extensions]
 * @param {object} [opts.logger]
 */
export function createRuleEngine(opts = {}) {
  const packs = Array.isArray(opts.rulePacks) ? opts.rulePacks.slice() : []
  if (packs.length === 0) {
    throw complianceError('pack-invalid', { hint: 'at least one rule pack required' })
  }
  const extensions = opts.extensions || null
  const logger = opts.logger || null

  const rulePackVersions = packs.reduce((acc, p) => {
    acc[p.id] = p.version
    return acc
  }, /** @type {Object<string,string>} */ ({}))

  /**
   * @param {object} subject
   * @param {object} [ctx]    Free-form context; reserved for v2 extension wiring
   * @returns {import('./types.js').ComplianceVerdict}
   */
  function evaluate(subject, ctx = {}) {
    const norm = normalizeSubject(subject)
    /** @type {Array<object>} */
    const findings = []

    for (const pack of packs) {
      for (const rule of pack.rules) {
        if (!rule.appliesTo.includes(subject.stage)) continue
        let hit
        try {
          hit = runPredicate(rule.predicate, norm)
        } catch (err) {
          if (logger) logger.warn('predicate-error', { ruleId: rule.id, packId: pack.id, hint: err.hint })
          continue // a single bad rule does not poison the whole evaluation
        }
        if (hit) findings.push(makeFinding(rule, subject, hit))
      }
    }

    // Synchronous extensions only in v1. The seam supports async too (US8
    // vision adapter would be async), but no v1 extension is registered, so
    // we evaluate the sync path inline. Async extensions are folded via the
    // separate `evaluateAsync` path below.
    if (extensions && typeof ctx.includeExtensions !== 'boolean' ? true : ctx.includeExtensions) {
      const exts = extensions.forStage ? extensions.forStage(subject.stage) : []
      for (const ext of exts) {
        try {
          const extFindings = ext.evaluate(subject, { norm, ctx })
          if (Array.isArray(extFindings)) {
            for (const f of extFindings) findings.push(f)
          }
        } catch (err) {
          if (logger) logger.warn('extension-error', { extId: ext.id, hint: err?.message?.slice(0, 200) })
        }
      }
    }

    return {
      overall:           worstOf(findings),
      findings,
      evaluatedAt:       Date.now(),
      engineVersion:     COMPLIANCE_ENGINE_VERSION,
      rulePackVersions:  { ...rulePackVersions },
      subjectKey:        makeSubjectKey(subject)
    }
  }

  /**
   * Async variant — awaits any extension that returns a Promise.
   * v1 callers can keep using `evaluate(...)`; the async path lands when
   * the v2 vision adapter ships.
   */
  async function evaluateAsync(subject, ctx = {}) {
    const verdict = evaluate(subject, { ...ctx, includeExtensions: false })
    if (!extensions) return verdict
    const exts = extensions.forStage(subject.stage)
    if (exts.length === 0) return verdict
    const norm = normalizeSubject(subject)
    for (const ext of exts) {
      try {
        const extFindings = await ext.evaluate(subject, { norm, ctx })
        if (Array.isArray(extFindings)) {
          for (const f of extFindings) verdict.findings.push(f)
        }
      } catch (err) {
        if (logger) logger.warn('extension-error', { extId: ext.id, hint: err?.message?.slice(0, 200) })
      }
    }
    verdict.overall = worstOf(verdict.findings)
    return verdict
  }

  function listRules() {
    /** @type {Array<{packId:string, packVersion:string, rule:object}>} */
    const out = []
    for (const pack of packs) {
      for (const rule of pack.rules) out.push({ packId: pack.id, packVersion: pack.version, rule })
    }
    return out
  }

  function listRulePacks() {
    return packs.map((p) => ({
      id:           p.id,
      version:      p.version,
      publishedAt:  p.publishedAt,
      marketplaces: p.marketplaces.slice(),
      ruleCount:    p.rules.length,
      categories:   Array.from(new Set(p.rules.map((r) => r.category)))
    }))
  }

  return {
    evaluate,
    evaluateAsync,
    listRules,
    listRulePacks,
    engineVersion: COMPLIANCE_ENGINE_VERSION,
    rulePackVersions: { ...rulePackVersions }
  }
}
