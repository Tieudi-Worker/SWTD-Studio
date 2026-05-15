/**
 * @swtd-studio/compliance-core — public surface.
 *
 * `createComplianceEngine({ rulePacks, logger, messageKeyCheck })`
 * returns an engine bound to the loaded + frozen packs.
 *
 * Two invariants (mirroring `provider-core`):
 *   1. Zero `electron` imports here or under `src/**`. The package can run on
 *      a cloud backend with no swap; the Electron main wrapper composes the
 *      engine with its own filesystem writers + override store.
 *   2. The renderer NEVER imports from this package. Renderer talks IPC.
 *
 * Plan §3 (src/index.js) + §4.1.
 */

import { loadRulePack } from './rule-loader.js'
import { createRuleEngine, COMPLIANCE_ENGINE_VERSION } from './rule-engine.js'
import { createExtensionRegistry } from './extensions.js'
import { createLogger, NOOP_LOGGER } from './logger.js'
import {
  makeBriefSubject,
  makeCreativeBriefSubject,
  makePromptSubject,
  makeMetadataSubject,
  makeExportSubject
} from './subjects.js'
import { PREDICATE_KINDS } from './predicates/index.js'
import { COMPLIANCE_CORE_TYPES_VERSION } from './types.js'

export const COMPLIANCE_CORE_VERSION = '0.1.0'

/**
 * Build the Compliance Core instance.
 *
 * @param {object} opts
 * @param {ReadonlyArray<object>} opts.rulePacks                  Parsed pack objects (validated + frozen here)
 * @param {(key:string)=>boolean} [opts.messageKeyCheck]          Load-time i18n key check; the Electron main
 *                                                                wrapper passes a closure over its loaded
 *                                                                i18n table so missing keys fail loudly.
 * @param {object} [opts.logger]
 */
export function createComplianceEngine(opts = {}) {
  if (!Array.isArray(opts.rulePacks) || opts.rulePacks.length === 0) {
    throw new TypeError('createComplianceEngine: rulePacks[] required')
  }
  const logger = opts.logger || NOOP_LOGGER

  // Validate + freeze every pack at construction time. Rule packs are
  // immutable for the lifetime of the engine; bumping a rule requires a new
  // pack version (Plan §4.3).
  const frozenPacks = opts.rulePacks.map((p) => loadRulePack(p, {
    messageKeyCheck: opts.messageKeyCheck
  }))

  const extensions = createExtensionRegistry()
  const engine = createRuleEngine({ rulePacks: frozenPacks, extensions, logger })

  logger.info('compliance pack loaded', {
    packs: frozenPacks.map((p) => `${p.id}@${p.version}`),
    ruleCount: frozenPacks.reduce((n, p) => n + p.rules.length, 0)
  })

  return {
    version:       COMPLIANCE_CORE_VERSION,
    typesVersion:  COMPLIANCE_CORE_TYPES_VERSION,
    engineVersion: COMPLIANCE_ENGINE_VERSION,
    predicateKinds: PREDICATE_KINDS,

    /* Evaluation surface */
    evaluate:      engine.evaluate,
    evaluateAsync: engine.evaluateAsync,
    listRules:     engine.listRules,
    listRulePacks: engine.listRulePacks,

    /* Subject constructors — re-exported so callers don't need a second import */
    makeBriefSubject,
    makeCreativeBriefSubject,
    makePromptSubject,
    makeMetadataSubject,
    makeExportSubject,

    /* US8 extension seam (v1 = empty registry) */
    registerExtension: extensions.register,
    listExtensions:    extensions.list
  }
}

export { createLogger, NOOP_LOGGER } from './logger.js'
export { complianceError, isComplianceError } from './error.js'
export { loadRulePack } from './rule-loader.js'
export {
  makeBriefSubject,
  makeCreativeBriefSubject,
  makePromptSubject,
  makeMetadataSubject,
  makeExportSubject
} from './subjects.js'
export { worstOf, compareSeverity, isSeverity } from './severity.js'
export { PREDICATE_KINDS } from './predicates/index.js'
export { COMPLIANCE_CORE_TYPES_VERSION } from './types.js'
export { COMPLIANCE_ENGINE_VERSION } from './rule-engine.js'
