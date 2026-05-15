/**
 * Typed subject constructors + normalisation.
 *
 * Subject constructors are tiny — they tag a payload with its `kind`, `stage`,
 * and a small `source` block (skuPath, slotId, module, ...). The expensive
 * work happens inside `normalizeSubject` at evaluate-time: it walks the
 * payload and produces the view predicates actually consume:
 *
 *   {
 *     textPassages: [{ text, source }, ...],   // string passages to scan
 *     mustShow: string[],                      // Creative Brief / Export bundle
 *     mustAvoid: string[],                     // Creative Brief
 *     competitors: string[],                   // From Insight Brief market
 *     subjectMeta: { kind, stage, slotId?, module? }
 *   }
 *
 * The engine is responsible for handing this normalised view to predicates;
 * predicates never reach back into the raw payload.
 *
 * Plan §3 (subjects.js) + §4.4 (six hooks).
 */

import { complianceError } from './error.js'

/* -------------------------------------------------------------------------- */
/* Constructors                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Insight Brief subject — Hook 1 input. `payload` is the full InsightBrief
 * JSON produced by `provider-core/insight-brief.js`.
 */
export function makeBriefSubject(insightBrief, ctx = {}) {
  return Object.freeze({
    kind: 'brief',
    stage: 'insight-brief',
    payload: insightBrief || {},
    source: Object.freeze({
      skuPath: ctx.skuPath,
      path:    ctx.briefPath
    })
  })
}

/**
 * Creative Brief subject — Hook 2 input.
 */
export function makeCreativeBriefSubject(creativeBrief, ctx = {}) {
  return Object.freeze({
    kind: 'creative-brief',
    stage: 'creative-brief',
    payload: creativeBrief || {},
    source: Object.freeze({
      skuPath: ctx.skuPath,
      path:    ctx.creativePath
    })
  })
}

/**
 * Prompt subject — Hook 3 input (renderer-fired) and Hook 4 re-check
 * (pre-HTTP guard inside `generate-image`).
 */
export function makePromptSubject(args = {}) {
  if (typeof args.prompt !== 'string') {
    throw complianceError('subject-invalid', { hint: 'makePromptSubject: prompt required' })
  }
  return Object.freeze({
    kind: 'prompt',
    stage: args.stage === 'image-generate' ? 'image-generate' : 'prompt',
    payload: Object.freeze({
      prompt:     args.prompt,
      templateId: args.templateId,
      angleId:    args.angleId,
      mustShow:   Array.isArray(args.mustShow)  ? args.mustShow.slice()  : [],
      mustAvoid:  Array.isArray(args.mustAvoid) ? args.mustAvoid.slice() : []
    }),
    source: Object.freeze({
      skuPath: args.skuPath,
      slotId:  args.slotId
    })
  })
}

/**
 * Image-metadata subject — Hook 5 input. `payload` is the saved sidecar.
 */
export function makeMetadataSubject(sidecar, ctx = {}) {
  return Object.freeze({
    kind: 'image-metadata',
    stage: 'image-metadata',
    payload: sidecar || {},
    source: Object.freeze({
      skuPath: ctx.skuPath,
      slotId:  sidecar?.slotId ?? ctx.slotId,
      path:    ctx.sidecarPath
    })
  })
}

/**
 * Export-bundle subject — Hook 6 input. `slots` is a list of sidecars and
 * `overrides` is the active set; the wrapper that constructs this subject
 * is responsible for filtering expired overrides.
 *
 * @param {object} args
 * @param {string} args.skuPath
 * @param {Array<{ slotId, prompt?, mustShow?, mustAvoid?, model?, mode?, providerId? }>} args.slots
 */
export function makeExportSubject(args = {}) {
  return Object.freeze({
    kind: 'export-bundle',
    stage: 'export',
    payload: Object.freeze({
      slots: Array.isArray(args.slots) ? args.slots.slice() : []
    }),
    source: Object.freeze({
      skuPath: args.skuPath
    })
  })
}

/* -------------------------------------------------------------------------- */
/* Normalisation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Walk a value and yield every non-empty string. Arrays + plain objects are
 * walked. Strings are returned with a `source` path (dot-notation) so
 * findings can point back to where the offending text lived.
 *
 * Cycle-safe via WeakSet.
 *
 * @yields {{ text: string, source: string }}
 */
function* walkStrings(value, path = '', seen = new WeakSet()) {
  if (value == null) return
  if (typeof value === 'string') {
    if (value.length > 0) yield { text: value, source: path || '(root)' }
    return
  }
  if (typeof value === 'number' || typeof value === 'boolean') return
  if (typeof value !== 'object') return
  if (seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      yield* walkStrings(value[i], `${path}[${i}]`, seen)
    }
    return
  }
  for (const [k, v] of Object.entries(value)) {
    const nextPath = path ? `${path}.${k}` : k
    yield* walkStrings(v, nextPath, seen)
  }
}

function collectTextPassages(payload) {
  const out = []
  for (const passage of walkStrings(payload)) out.push(passage)
  return out
}

/**
 * Build the normalised view predicates consume.
 *
 * @param {object} subject
 * @returns {{
 *   textPassages: Array<{text:string, source:string}>,
 *   mustShow: string[],
 *   mustAvoid: string[],
 *   competitors: string[],
 *   subjectMeta: { kind:string, stage:string, slotId?: (string|number), module?: string }
 * }}
 */
export function normalizeSubject(subject) {
  if (!subject || typeof subject !== 'object' || typeof subject.kind !== 'string') {
    throw complianceError('subject-invalid', { hint: 'subject missing kind' })
  }
  const meta = {
    kind:   subject.kind,
    stage:  subject.stage,
    slotId: subject.source?.slotId,
    module: subject.source?.module
  }

  switch (subject.kind) {
    case 'brief': {
      const p = subject.payload || {}
      return {
        textPassages: collectTextPassages(p),
        mustShow:     [],
        mustAvoid:    [],
        competitors:  Array.isArray(p?.market?.competitors)
          ? p.market.competitors.filter((s) => typeof s === 'string' && s.length > 0)
          : [],
        subjectMeta:  meta
      }
    }
    case 'creative-brief': {
      const p = subject.payload || {}
      const mustShow  = Array.isArray(p.mustShow)  ? p.mustShow.filter((s) => typeof s === 'string')  : []
      const mustAvoid = Array.isArray(p.mustAvoid) ? p.mustAvoid.filter((s) => typeof s === 'string') : []
      return {
        textPassages: collectTextPassages(p),
        mustShow,
        mustAvoid,
        competitors:  [],
        subjectMeta:  meta
      }
    }
    case 'prompt': {
      const p = subject.payload || {}
      const passages = []
      if (typeof p.prompt === 'string' && p.prompt.length > 0) {
        passages.push({ text: p.prompt, source: 'prompt' })
      }
      const mustShow  = Array.isArray(p.mustShow)  ? p.mustShow.filter((s) => typeof s === 'string')  : []
      const mustAvoid = Array.isArray(p.mustAvoid) ? p.mustAvoid.filter((s) => typeof s === 'string') : []
      return {
        textPassages: passages,
        mustShow,
        mustAvoid,
        competitors:  [],
        subjectMeta:  meta
      }
    }
    case 'image-metadata': {
      const p = subject.payload || {}
      const passages = []
      const stringFields = ['prompt', 'model', 'mode', 'providerId', 'templateId', 'angleId']
      for (const k of stringFields) {
        if (typeof p[k] === 'string' && p[k].length > 0) {
          passages.push({ text: p[k], source: k })
        }
      }
      if (Array.isArray(p.mustShow)) {
        for (let i = 0; i < p.mustShow.length; i++) {
          if (typeof p.mustShow[i] === 'string') passages.push({ text: p.mustShow[i], source: `mustShow[${i}]` })
        }
      }
      return {
        textPassages: passages,
        mustShow:     Array.isArray(p.mustShow)  ? p.mustShow.filter((s)  => typeof s === 'string') : [],
        mustAvoid:    Array.isArray(p.mustAvoid) ? p.mustAvoid.filter((s) => typeof s === 'string') : [],
        competitors:  [],
        subjectMeta:  meta
      }
    }
    case 'export-bundle': {
      const passages = []
      const mustShow = []
      const slots = subject.payload?.slots || []
      for (let s = 0; s < slots.length; s++) {
        const slot = slots[s] || {}
        const slotPrefix = `slots[${s}]`
        const stringFields = ['prompt', 'model', 'mode', 'providerId', 'templateId', 'angleId']
        for (const k of stringFields) {
          if (typeof slot[k] === 'string' && slot[k].length > 0) {
            passages.push({ text: slot[k], source: `${slotPrefix}.${k}` })
          }
        }
        if (Array.isArray(slot.mustShow)) {
          for (let i = 0; i < slot.mustShow.length; i++) {
            if (typeof slot.mustShow[i] === 'string') {
              mustShow.push(slot.mustShow[i])
              passages.push({ text: slot.mustShow[i], source: `${slotPrefix}.mustShow[${i}]` })
            }
          }
        }
      }
      return {
        textPassages: passages,
        mustShow,
        mustAvoid:    [],
        competitors:  [],
        subjectMeta:  meta
      }
    }
    default:
      throw complianceError('subject-invalid', { hint: `unknown subject kind: ${subject.kind}` })
  }
}
