/**
 * Rule-pack loader + validator.
 *
 * Takes a rule pack as either an in-memory object (e.g. `import` of JSON) or
 * a filesystem path (used by the smoke harness and the Electron main wrapper).
 * Validates the shape, deep-freezes the result, and returns the loaded pack.
 *
 * Validation failures throw `ComplianceError{ reason: 'pack-invalid' }` —
 * never partial-load, never silently drop bad rules. (Plan §3 / §4.3.)
 *
 * The package itself reads JSON via the injected `fs` shim only inside the
 * test harness; production usage in Electron main passes the parsed object
 * directly (`createComplianceEngine({ rulePacks: [require('...json')] })`).
 */

import { complianceError } from './error.js'
import { isKnownPredicateKind } from './predicates/index.js'
import { isSeverity } from './severity.js'

const VALID_STAGES = new Set([
  'insight-brief',
  'creative-brief',
  'prompt',
  'image-generate',
  'image-metadata',
  'export'
])

const SEMVER_RE = /^\d+\.\d+\.\d+$/

function deepFreeze(value, seen = new WeakSet()) {
  if (value == null || typeof value !== 'object') return value
  if (seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) {
    for (const v of value) deepFreeze(v, seen)
  } else {
    for (const v of Object.values(value)) deepFreeze(v, seen)
  }
  return Object.freeze(value)
}

function validatePredicate(predicate, packId, ruleId, depth = 0) {
  if (depth > 4) {
    throw complianceError('rule-invalid', { packId, ruleId, hint: 'predicate nesting too deep (>4)' })
  }
  if (!predicate || typeof predicate !== 'object') {
    throw complianceError('rule-invalid', { packId, ruleId, hint: 'predicate missing' })
  }
  if (typeof predicate.kind !== 'string' || !isKnownPredicateKind(predicate.kind)) {
    throw complianceError('rule-invalid', { packId, ruleId, hint: `unknown predicate kind: ${predicate.kind}` })
  }
  switch (predicate.kind) {
    case 'containsAnyTokens':
    case 'mustShowIncludes':
      if (!Array.isArray(predicate.tokens) || predicate.tokens.length === 0) {
        throw complianceError('rule-invalid', { packId, ruleId, hint: `${predicate.kind}: tokens[] required` })
      }
      for (const t of predicate.tokens) {
        if (typeof t !== 'string' || t.length === 0) {
          throw complianceError('rule-invalid', { packId, ruleId, hint: `${predicate.kind}: empty token` })
        }
      }
      break
    case 'containsRegex':
      if (typeof predicate.pattern !== 'string' || predicate.pattern.length === 0) {
        throw complianceError('rule-invalid', { packId, ruleId, hint: 'containsRegex: pattern required' })
      }
      try {
        // eslint-disable-next-line no-new
        new RegExp(predicate.pattern, typeof predicate.flags === 'string' ? predicate.flags : 'i')
      } catch (err) {
        throw complianceError('rule-invalid', { packId, ruleId, hint: `containsRegex: bad pattern: ${err.message}` })
      }
      break
    case 'tokenLooksLikeTrademark':
      if (predicate.seedBrands != null && !Array.isArray(predicate.seedBrands)) {
        throw complianceError('rule-invalid', { packId, ruleId, hint: 'tokenLooksLikeTrademark: seedBrands must be array' })
      }
      break
    case 'compositeAnyOf':
    case 'compositeAllOf':
      if (!Array.isArray(predicate.predicates) || predicate.predicates.length === 0) {
        throw complianceError('rule-invalid', { packId, ruleId, hint: `${predicate.kind}: predicates[] required` })
      }
      for (const child of predicate.predicates) validatePredicate(child, packId, ruleId, depth + 1)
      break
  }
}

function validateRule(rule, packId, seenIds, opts = {}) {
  if (!rule || typeof rule !== 'object') {
    throw complianceError('rule-invalid', { packId, hint: 'rule not an object' })
  }
  const ruleId = rule.id
  if (typeof ruleId !== 'string' || ruleId.length === 0) {
    throw complianceError('rule-invalid', { packId, hint: 'rule missing id' })
  }
  if (seenIds.has(ruleId)) {
    throw complianceError('rule-invalid', { packId, ruleId, hint: 'duplicate rule id' })
  }
  seenIds.add(ruleId)
  if (typeof rule.category !== 'string' || rule.category.length === 0) {
    throw complianceError('rule-invalid', { packId, ruleId, hint: 'category required' })
  }
  if (!isSeverity(rule.severity)) {
    throw complianceError('rule-invalid', { packId, ruleId, hint: `bad severity: ${rule.severity}` })
  }
  if (!Array.isArray(rule.appliesTo) || rule.appliesTo.length === 0) {
    throw complianceError('rule-invalid', { packId, ruleId, hint: 'appliesTo[] required' })
  }
  for (const stage of rule.appliesTo) {
    if (!VALID_STAGES.has(stage)) {
      throw complianceError('rule-invalid', { packId, ruleId, hint: `unknown stage: ${stage}` })
    }
  }
  if (typeof rule.messageKey !== 'string' || rule.messageKey.length === 0) {
    throw complianceError('rule-invalid', { packId, ruleId, hint: 'messageKey required' })
  }
  if (rule.suggestedFixKey != null && typeof rule.suggestedFixKey !== 'string') {
    throw complianceError('rule-invalid', { packId, ruleId, hint: 'suggestedFixKey must be string' })
  }
  if (!Array.isArray(rule.references)) {
    throw complianceError('rule-invalid', { packId, ruleId, hint: 'references[] required (may be empty array)' })
  }
  for (const ref of rule.references) {
    if (typeof ref !== 'string' || !/^https?:\/\//.test(ref)) {
      throw complianceError('rule-invalid', { packId, ruleId, hint: `bad reference URL: ${ref}` })
    }
  }
  validatePredicate(rule.predicate, packId, ruleId)
  if (opts.messageKeyCheck && !opts.messageKeyCheck(rule.messageKey)) {
    throw complianceError('rule-invalid', { packId, ruleId, hint: `messageKey not in i18n table: ${rule.messageKey}` })
  }
  if (opts.messageKeyCheck && rule.suggestedFixKey && !opts.messageKeyCheck(rule.suggestedFixKey)) {
    throw complianceError('rule-invalid', { packId, ruleId, hint: `suggestedFixKey not in i18n table: ${rule.suggestedFixKey}` })
  }
}

/**
 * Validate + freeze a rule pack.
 *
 * @param {object} pack            Parsed pack JSON
 * @param {object} [opts]
 * @param {(key:string)=>boolean} [opts.messageKeyCheck]   Optional caller hook
 *                                  to verify each `messageKey` resolves in the
 *                                  bundled i18n table. Used by the Electron
 *                                  main wrapper at boot.
 * @returns {object}              The frozen pack
 */
export function loadRulePack(pack, opts = {}) {
  if (!pack || typeof pack !== 'object') {
    throw complianceError('pack-invalid', { hint: 'pack not an object' })
  }
  if (typeof pack.id !== 'string' || pack.id.length === 0) {
    throw complianceError('pack-invalid', { hint: 'pack.id required' })
  }
  if (typeof pack.version !== 'string' || !SEMVER_RE.test(pack.version)) {
    throw complianceError('pack-invalid', { packId: pack.id, hint: 'pack.version must be semver x.y.z' })
  }
  if (typeof pack.publishedAt !== 'string' || pack.publishedAt.length === 0) {
    throw complianceError('pack-invalid', { packId: pack.id, hint: 'pack.publishedAt required' })
  }
  if (!Array.isArray(pack.marketplaces) || pack.marketplaces.length === 0) {
    throw complianceError('pack-invalid', { packId: pack.id, hint: 'pack.marketplaces[] required' })
  }
  if (typeof pack.engineMinVersion !== 'string' || !SEMVER_RE.test(pack.engineMinVersion)) {
    throw complianceError('pack-invalid', { packId: pack.id, hint: 'pack.engineMinVersion must be semver' })
  }
  if (!Array.isArray(pack.rules)) {
    throw complianceError('pack-invalid', { packId: pack.id, hint: 'pack.rules[] required' })
  }

  const seenIds = new Set()
  for (const rule of pack.rules) validateRule(rule, pack.id, seenIds, opts)

  return deepFreeze(pack)
}
