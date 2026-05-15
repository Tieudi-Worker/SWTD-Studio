/**
 * Listing template library.
 *
 * Loads every JSON file under `packages/core/templates/listing/*.json` at
 * renderer startup via Vite's `import.meta.glob` (eager). Validates each
 * template against the minimal schema from `_SCHEMA.md`; invalid templates
 * are dropped with `console.error` so the operator console never blanks.
 *
 * Spec: docs/features/phase-2-template-engine/spec.md §2.US1
 * Schema: packages/core/templates/listing/_SCHEMA.md
 */

// Vite resolves this glob at build time. `eager: true` inlines the JSON
// payloads as ES module exports — no async loading at runtime.
// Path is relative to THIS file: apps/desktop/src/lib/ → ../../../../packages/...
// (4 ups: lib → src → desktop → apps → repo root).
const TEMPLATE_MODULES = import.meta.glob(
  '../../../../packages/core/templates/listing/*.json',
  { eager: true, import: 'default' }
)

const REQUIRED_FIELDS = ['id', 'name', 'version', 'slot_roles', 'body', 'angles']
const VALID_SLOT_ROLES = new Set([
  'main', 'in-use', 'features', 'use-case',
  'size-scale', 'gift-set', 'emotional', 'lifestyle-close'
])

function isValidTemplate(tpl, filename) {
  for (const field of REQUIRED_FIELDS) {
    if (tpl[field] == null || tpl[field] === '') {
      console.error(`[template-library] ${filename}: missing required field "${field}"`)
      return false
    }
  }
  if (!Array.isArray(tpl.slot_roles) || tpl.slot_roles.length === 0) {
    console.error(`[template-library] ${filename}: slot_roles must be a non-empty array`)
    return false
  }
  for (const role of tpl.slot_roles) {
    if (!VALID_SLOT_ROLES.has(role)) {
      console.error(`[template-library] ${filename}: unknown slot_role "${role}"`)
      return false
    }
  }
  if (!Array.isArray(tpl.angles) || tpl.angles.length === 0) {
    console.error(`[template-library] ${filename}: angles must be a non-empty array`)
    return false
  }
  for (const angle of tpl.angles) {
    if (!angle?.id || !angle?.name) {
      console.error(`[template-library] ${filename}: every angle needs id + name`)
      return false
    }
  }
  return true
}

/**
 * Frozen array of every loaded template, validated.
 * Sorted by filename for stable picker ordering.
 */
export const ALL_TEMPLATES = Object.freeze(
  Object.entries(TEMPLATE_MODULES)
    .filter(([_, tpl]) => isValidTemplate(tpl, _))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_, tpl]) => Object.freeze(tpl))
)

/**
 * Return every template that applies to the given slot role.
 * @param {string} slotRole — one of the 8 canonical roles
 * @returns {ReadonlyArray<object>}
 */
export function applicableTemplates(slotRole) {
  if (!slotRole) return []
  return ALL_TEMPLATES.filter(tpl => tpl.slot_roles.includes(slotRole))
}

/**
 * Look up a template by its `id`. Returns null if not found.
 * @param {string} templateId
 * @returns {object|null}
 */
export function findTemplate(templateId) {
  if (!templateId) return null
  return ALL_TEMPLATES.find(tpl => tpl.id === templateId) || null
}

/**
 * Resolve a (templateId, angleId) pair to the concrete angle object.
 * Falls back to the first angle if angleId is missing or unknown.
 * @returns {{ template: object, angle: object } | null}
 */
export function resolveSelection({ templateId, angleId } = {}) {
  const template = findTemplate(templateId)
  if (!template) return null
  const angle = template.angles.find(a => a.id === angleId) || template.angles[0]
  return { template, angle }
}
