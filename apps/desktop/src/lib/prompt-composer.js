/**
 * Deterministic prompt composer for the listing slot templates.
 *
 * Pure function: same inputs always produce the same output. No LLM,
 * no network. Substitutes `{{NAME}}` placeholders from the brand
 * context, optionally prepends the Brand DNA modifier paragraph,
 * and reports every unresolved variable so the UI can surface a
 * warning chip on the affected slot.
 *
 * Spec: docs/features/phase-2-template-engine/spec.md §2.US2
 * Plan: docs/features/phase-2-template-engine/plan.md §4.3
 */

const VAR_PATTERN = /\{\{([A-Z][A-Z0-9_]*)\}\}/g

/**
 * Substitute `{{VARS}}` from a flat lookup table. Missing variables
 * are replaced with `[missing: NAME]` and collected in `missingVars`.
 *
 * @param {string} text
 * @param {Record<string,string>} values
 * @returns {{ text: string, missingVars: string[] }}
 */
function substitute(text, values) {
  const missing = new Set()
  const out = String(text || '').replace(VAR_PATTERN, (_, name) => {
    const value = values[name]
    if (value == null || value === '') {
      missing.add(name)
      return `[missing: ${name}]`
    }
    return String(value)
  })
  return { text: out, missingVars: Array.from(missing) }
}

/**
 * Compose the final prompt string for a single slot.
 *
 * Merge order (top → bottom of the output):
 *   1. Brand DNA modifier paragraph (unless template opts out OR context lacks one)
 *   2. Template body
 *   3. Angle's prompt_modifier (if non-empty)
 *
 * Then a single substitute pass replaces every `{{VAR}}`.
 *
 * @param {Object} args
 * @param {Object} args.template - a template object from template-library
 * @param {string} [args.angleId] - angle id; falls back to the first angle
 * @param {{ values: Record<string,string>, brandDnaModifier?: string }} args.context
 * @returns {{
 *   text: string,
 *   missingVars: string[],
 *   templateId: string,
 *   angleId: string,
 *   aspectRatio: string,
 *   includesBrandModifier: boolean
 * } | null}
 */
export function composePrompt({ template, angleId, context } = {}) {
  if (!template) return null
  const angle = template.angles.find(a => a.id === angleId) || template.angles[0]
  const includeModifier = template.include_brand_modifier !== false
  const modifier = includeModifier && context?.brandDnaModifier
    ? context.brandDnaModifier
    : null

  const parts = []
  if (modifier) parts.push(modifier)
  parts.push(template.body)
  if (angle?.prompt_modifier) parts.push(angle.prompt_modifier)
  const merged = parts.join('\n\n')

  const { text, missingVars } = substitute(merged, context?.values || {})

  return {
    text,
    missingVars,
    templateId: template.id,
    angleId: angle.id,
    aspectRatio: angle?.aspect_ratio || template.aspect_ratio || '1:1',
    includesBrandModifier: !!modifier
  }
}

/**
 * Compose every slot in one pass. Returns a map keyed by slot id.
 * Slots with no selection map to `null` (the runtime falls back to
 * its hardcoded prompt for those — Phase 1 compatibility).
 *
 * @param {Object} args
 * @param {Record<number,{templateId,angleId}>} args.selections
 * @param {Record<string, object>} args.templatesById
 * @param {{ values: Record<string,string>, brandDnaModifier?: string }} args.context
 * @returns {Record<number, ReturnType<composePrompt>|null>}
 */
export function composeAllSlots({ selections, templatesById, context }) {
  const out = {}
  for (const [slotId, sel] of Object.entries(selections || {})) {
    const template = templatesById[sel?.templateId]
    if (!template) { out[slotId] = null; continue }
    out[slotId] = composePrompt({ template, angleId: sel.angleId, context })
  }
  return out
}
