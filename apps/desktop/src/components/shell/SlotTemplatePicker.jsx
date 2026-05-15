import React from 'react'
import { applicableTemplates, findTemplate } from '../../lib/template-library.js'
import { t } from '../../lib/i18n.js'

/**
 * Two-level template picker rendered inside SlotCard.jsx.
 *
 * Top select: template (filtered by slot role).
 * Bottom select: angle (filtered to the chosen template's angles[]).
 *
 * Native `<select>` for v1 — accessible, no popover state, smallest LOC.
 * Custom popover styling can come later if needed.
 *
 * Spec: docs/features/phase-2-template-engine/spec.md §2.US1 + §2.US3
 */
export default function SlotTemplatePicker({
  slotRole,
  selection,        // { templateId, angleId } | undefined
  onChange,         // (slot, { templateId, angleId } | null) => void
  slotId,
  language = 'en'
}) {
  const options = applicableTemplates(slotRole)
  if (options.length === 0) {
    return (
      <div className="slot-template-picker slot-template-picker--empty" aria-live="polite">
        <span className="slot-template-picker__label">{t('template.picker.empty', language)}</span>
      </div>
    )
  }

  const tplId = selection?.templateId || ''
  const tpl   = tplId ? findTemplate(tplId) : null
  const angId = selection?.angleId   || (tpl ? tpl.angles[0].id : '')

  function handleTemplateChange(e) {
    const next = e.target.value
    if (!next) {
      onChange(slotId, null)               // operator cleared the selection
      return
    }
    const t = findTemplate(next)
    if (!t) return
    onChange(slotId, { templateId: t.id, angleId: t.angles[0].id })
  }

  function handleAngleChange(e) {
    if (!tpl) return
    onChange(slotId, { templateId: tpl.id, angleId: e.target.value })
  }

  return (
    <div className="slot-template-picker" onClick={(e) => e.stopPropagation()}>
      <label className="slot-template-picker__row">
        <span className="slot-template-picker__label">{t('template.picker.label', language)}</span>
        <select
          className="slot-template-picker__select"
          value={tplId}
          onChange={handleTemplateChange}
        >
          <option value="">{t('template.picker.no_template', language)}</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </label>
      {tpl && tpl.angles.length > 0 && (
        <label className="slot-template-picker__row">
          <span className="slot-template-picker__label">{t('template.angle.label', language)}</span>
          <select
            className="slot-template-picker__select"
            value={angId}
            onChange={handleAngleChange}
          >
            {tpl.angles.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
