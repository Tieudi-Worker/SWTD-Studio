/**
 * Compliance Core — JSDoc type contracts.
 *
 * Single source of truth for the public surface of `@swtd-studio/compliance-core`.
 * No runtime exports beyond a single `version` string; this file exists so the
 * shape is greppable and reviewable in one place.
 *
 * Spec:  docs/features/phase-5-amazon-compliance-engine/spec.md
 * Plan:  docs/features/phase-5-amazon-compliance-engine/plan.md §4.3, §4.5, §4.7, §4.10
 */

export const COMPLIANCE_CORE_TYPES_VERSION = '0.1.0'

/* -------------------------------------------------------------------------- */
/* Severity                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Verdict severity tier. Plan §4 D1.
 *   info  → surfaced but does not gate anything
 *   warn  → operator should review; does NOT gate generate / export
 *   block → gates generate (Hook 4) and export (Hook 6) until overridden or fixed
 *
 * @typedef {'info'|'warn'|'block'} ComplianceSeverity
 */

/**
 * The pipeline stage the subject came from. Used to filter rules via `appliesTo[]`.
 *
 * @typedef {'insight-brief'|'creative-brief'|'prompt'|'image-generate'|'image-metadata'|'export'} ComplianceStage
 */

/* -------------------------------------------------------------------------- */
/* Subject (engine input)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The typed input to `evaluate(...)`. Subjects carry enough context (slot id,
 * SKU path, stage) for the engine to attribute findings.
 *
 * @typedef {Object} ComplianceSubject
 * @property {('brief'|'creative-brief'|'prompt'|'image-metadata'|'export-bundle')} kind
 * @property {ComplianceStage} stage
 * @property {Object} payload                Free-form; shape depends on `kind`
 * @property {Object} [source]               Provenance (path, slotId, etc.)
 * @property {string} [source.skuPath]
 * @property {(string|number)} [source.slotId]
 * @property {string} [source.module]        A+ module id when applicable
 * @property {string} [source.templateId]
 * @property {string} [source.angleId]
 * @property {string} [source.path]          On-disk path to the persisted source artifact
 */

/* -------------------------------------------------------------------------- */
/* Rule                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} CompliancePredicateContainsAnyTokens
 * @property {'containsAnyTokens'} kind
 * @property {string[]} tokens                 Plain strings or regex source if `regex:true`
 * @property {('case-insensitive-word-boundary'|'literal')} [tokenMode]
 * @property {boolean} [regex]                 Treat tokens as regex sources (use sparingly)
 */

/**
 * @typedef {Object} CompliancePredicateContainsRegex
 * @property {'containsRegex'} kind
 * @property {string} pattern                  Regex source
 * @property {string} [flags]                  Default 'i'
 */

/**
 * @typedef {Object} CompliancePredicateMustShowIncludes
 * @property {'mustShowIncludes'} kind
 * @property {string[]} tokens
 * @property {('case-insensitive-word-boundary'|'literal')} [tokenMode]
 */

/**
 * @typedef {Object} CompliancePredicateTokenLooksLikeTrademark
 * @property {'tokenLooksLikeTrademark'} kind
 * @property {string[]} [seedBrands]           Additional brand strings to match (Insight Brief
 *                                              competitors merged in at evaluate-time via ctx)
 */

/**
 * @typedef {Object} CompliancePredicateComposite
 * @property {('compositeAnyOf'|'compositeAllOf')} kind
 * @property {CompliancePredicate[]} predicates
 */

/**
 * @typedef {(CompliancePredicateContainsAnyTokens
 *           |CompliancePredicateContainsRegex
 *           |CompliancePredicateMustShowIncludes
 *           |CompliancePredicateTokenLooksLikeTrademark
 *           |CompliancePredicateComposite)} CompliancePredicate
 */

/**
 * @typedef {Object} ComplianceRule
 * @property {string} id                        Unique within the pack (e.g. 'amazon.medical.cures-or-treats')
 * @property {string} category                  'medical-health-claim' | 'misleading-badge' | …
 * @property {ComplianceSeverity} severity
 * @property {ComplianceStage[]} appliesTo
 * @property {CompliancePredicate} predicate
 * @property {string} messageKey                i18n key for operator-facing copy
 * @property {string} [suggestedFixKey]         i18n key for the suggested-fix copy
 * @property {string[]} references              Amazon-policy URLs (baked-in, never fetched at runtime)
 */

/**
 * @typedef {Object} ComplianceRulePack
 * @property {string} id                        e.g. 'amazon-listing-v1'
 * @property {string} version                   Semver
 * @property {string} publishedAt               ISO date
 * @property {string[]} marketplaces            ['amazon-us']
 * @property {string} engineMinVersion          Minimum compatible engine version
 * @property {ComplianceRule[]} rules
 */

/* -------------------------------------------------------------------------- */
/* Finding + Verdict (engine output)                                           */
/* -------------------------------------------------------------------------- */

/**
 * A single rule firing on a subject.
 *
 * @typedef {Object} ComplianceFinding
 * @property {string} id                        Stable id: `${ruleId}::${stage}::${slotOrModuleKey}`
 * @property {string} ruleId
 * @property {string} category
 * @property {ComplianceSeverity} severity
 * @property {ComplianceStage} stage
 * @property {(string|number)} [slotId]
 * @property {string} [module]
 * @property {string} [excerpt]                  ≤ 200 chars, raw payload excerpt around the match
 * @property {string} messageKey
 * @property {string} [suggestedFixKey]
 * @property {string[]} references
 * @property {boolean} [overridden]              Set by the Electron-main wrapper after consulting overrides.json
 */

/**
 * @typedef {Object} ComplianceVerdict
 * @property {('pass'|'warn'|'block')} overall   Worst non-overridden severity; 'pass' if no findings
 * @property {ComplianceFinding[]} findings
 * @property {number} evaluatedAt                Date.now() at evaluate() entry
 * @property {string} engineVersion
 * @property {Object<string,string>} rulePackVersions  packId → version of every pack consulted
 * @property {Object} [subjectKey]                A small summary of which subject was evaluated, for traceability
 * @property {string} [subjectKey.kind]
 * @property {ComplianceStage} [subjectKey.stage]
 * @property {(string|number)} [subjectKey.slotId]
 * @property {string} [subjectKey.module]
 */

/* -------------------------------------------------------------------------- */
/* Override                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Per-finding operator-acknowledged override. Plan §4.5 / D4.
 *
 * @typedef {Object} ComplianceOverride
 * @property {string} id                         e.g. 'ovr_2026-05-15T12-31-44Z_a7b9'
 * @property {string} findingId                  `${ruleId}::${stage}::${slotOrModuleKey}`
 * @property {string} ruleId
 * @property {string} subjectKey
 * @property {string} reason                     ≥ 8, ≤ 280 chars (validated in main wrapper)
 * @property {string} operator                   Operator name attached server-side (no client substitution)
 * @property {number} createdAt
 * @property {number} expiresAt                  createdAt + 7 days by default
 */

/* -------------------------------------------------------------------------- */
/* Extension (US8 vision-adapter seam)                                          */
/* -------------------------------------------------------------------------- */

/**
 * An optional extension that participates in evaluation, e.g. a future
 * image-vision adapter. v1 ships with zero extensions; the seam is in place
 * so v2 is a wiring change, not an engine rewrite.
 *
 * @typedef {Object} ComplianceExtension
 * @property {string} id
 * @property {string} version
 * @property {ComplianceStage[]} appliesTo
 * @property {(subject: ComplianceSubject, ctx: Object) => ComplianceFinding[] | Promise<ComplianceFinding[]>} evaluate
 */

/* -------------------------------------------------------------------------- */
/* ComplianceError                                                              */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {('pack-invalid'|'rule-invalid'|'subject-invalid'|'predicate-error'
 *           |'override-invalid'|'fix-not-applicable'|'unknown')} ComplianceErrorReason
 */

/**
 * @typedef {Object} ComplianceError
 * @property {'ComplianceError'} name
 * @property {ComplianceErrorReason} reason
 * @property {string} [ruleId]
 * @property {string} [packId]
 * @property {string} [hint]
 */
