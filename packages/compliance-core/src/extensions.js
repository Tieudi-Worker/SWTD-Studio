/**
 * Extension seam — US8 deferred vision adapter goes here.
 *
 * v1 ships with zero extensions. The Electron main wrapper can call
 * `registerExtension(...)` once a vision adapter exists in `provider-core/`
 * (or anywhere else). Extensions return additional `ComplianceFinding[]`
 * which the engine merges into the verdict.
 *
 * Plan §3 (extensions.js) + Spec §2 US8.
 */

import { complianceError } from './error.js'

const VALID_STAGES = new Set([
  'insight-brief',
  'creative-brief',
  'prompt',
  'image-generate',
  'image-metadata',
  'export'
])

/**
 * Build an extension registry.
 *
 * @returns {{
 *   register: (ext: object) => void,
 *   list: () => ReadonlyArray<object>,
 *   forStage: (stage: string) => ReadonlyArray<object>,
 *   clear: () => void
 * }}
 */
export function createExtensionRegistry() {
  /** @type {object[]} */
  const exts = []

  function register(ext) {
    if (!ext || typeof ext !== 'object') {
      throw complianceError('rule-invalid', { hint: 'extension must be an object' })
    }
    if (typeof ext.id !== 'string' || ext.id.length === 0) {
      throw complianceError('rule-invalid', { hint: 'extension.id required' })
    }
    if (typeof ext.evaluate !== 'function') {
      throw complianceError('rule-invalid', { hint: 'extension.evaluate must be a function' })
    }
    if (!Array.isArray(ext.appliesTo) || ext.appliesTo.length === 0) {
      throw complianceError('rule-invalid', { hint: 'extension.appliesTo[] required' })
    }
    for (const s of ext.appliesTo) {
      if (!VALID_STAGES.has(s)) {
        throw complianceError('rule-invalid', { hint: `extension.appliesTo: unknown stage: ${s}` })
      }
    }
    if (exts.some((e) => e.id === ext.id)) {
      throw complianceError('rule-invalid', { hint: `extension id already registered: ${ext.id}` })
    }
    exts.push(Object.freeze({ ...ext, appliesTo: Object.freeze(ext.appliesTo.slice()) }))
  }

  return {
    register,
    list:    () => Object.freeze(exts.slice()),
    forStage: (stage) => Object.freeze(exts.filter((e) => e.appliesTo.includes(stage))),
    clear:   () => { exts.length = 0 }
  }
}
