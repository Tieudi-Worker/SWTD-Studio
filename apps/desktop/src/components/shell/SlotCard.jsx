import React from 'react'
import { t } from '../../lib/i18n.js'

/**
 * SlotCard — single listing-slot tile with preview, state badge, and a
 * per-slot review action row (✓ OK / ⚠ Regen / ⌖ Open / ▸ prompt).
 *
 * Extracted from MainCanvas.jsx in Phase 1 so the file isn't 1000+ lines
 * and the slot rendering can be exercised in isolation. The card is a
 * <button>, so the surrounding form must handle aria-pressed for select.
 *
 * Canonical 6-state names (Phase 1): idle / queued / generating /
 * success / failed / approved. Legacy names (running, done, error,
 * skipped) still render correctly via the slotWord fallback below.
 */

const STATE_KEY = {
  idle:       'slot.state.idle',
  queued:     'slot.state.queued',
  generating: 'slot.state.generating',
  success:    'slot.state.success',
  failed:     'slot.state.failed',
  approved:   'slot.state.approved'
}

function slotWord(state, language) {
  const key = STATE_KEY[state]
  if (key) return t(key, language)
  /* Legacy fallbacks for inspector + A+ chip rows */
  switch (state) {
    case 'done':    return t('slot.state.success', language)
    case 'running': return t('slot.state.generating', language)
    case 'error':   return t('slot.state.failed', language)
    case 'skipped': return 'skipped'
    default:        return t('slot.state.idle', language)
  }
}

function validatorBadgeFor(state, validator) {
  if (!validator) return null
  if (!validator.exists) return { tone: 'missing', label: 'missing', title: 'File not found on disk' }
  if (validator.dimensionsOk === true) {
    return { tone: 'ok', label: `${validator.width}×${validator.height}`, title: 'Dimensions OK' }
  }
  if (validator.dimensionsOk === false) {
    return { tone: 'bad', label: `${validator.width ?? '?'}×${validator.height ?? '?'}`, title: 'Expected 2000×2000' }
  }
  return { tone: 'unknown', label: 'unchecked', title: validator.dimensionsReason || 'sharp not available' }
}

/** Skeleton-shimmer / image / placeholder by canonical state. */
function SlotPreview({ previewSrc, previewKey, state, validator }) {
  if (state === 'generating' || state === 'running') {
    return (
      <div className="slot__preview slot__preview--running" aria-hidden="true">
        <div className="slot__preview-shimmer" />
      </div>
    )
  }
  if (state === 'queued') {
    return (
      <div className="slot__preview slot__preview--queued" aria-hidden="true">
        <span className="slot__preview-hint">queued</span>
      </div>
    )
  }
  if (previewSrc && (state === 'success' || state === 'approved' || state === 'done')) {
    return (
      <div className="slot__preview">
        <img
          src={`${previewSrc}?k=${encodeURIComponent(previewKey)}`}
          alt=""
          className="slot__preview-img"
          loading="lazy"
          decoding="async"
        />
      </div>
    )
  }
  const isError =
    state === 'failed' || state === 'error' ||
    (validator && !validator.exists && state !== 'idle' && state !== 'queued')
  return (
    <div className={'slot__preview slot__preview--empty' + (isError ? ' slot__preview--missing' : '')} aria-hidden="true">
      <span className="slot__preview-hint">{isError ? 'missing' : 'no preview'}</span>
    </div>
  )
}

/** Pure tile: head + preview + label + state footer. */
export function SlotCard({ slot, state, selected, validator, disabled, onToggle, language = 'en' }) {
  const stateClass = 'slot slot--' + state + (selected ? ' slot--selected' : '')
  const validatorBadge = validatorBadgeFor(state, validator)
  const previewSrc = validator?.exists && validator.file && typeof window !== 'undefined' && window.swtd?.assetUrl
    ? window.swtd.assetUrl(validator.file)
    : null
  const previewKey = previewSrc && validator ? `${validator.width}x${validator.height}` : ''
  return (
    <button
      type="button"
      className={stateClass}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      title={validator?.file ? validator.file : undefined}
    >
      <div className="slot__head">
        <span className="slot__no">{String(slot.id).padStart(2, '0')}</span>
        <span className={'slot__check' + (selected ? ' slot__check--on' : '')} aria-hidden="true">
          {selected ? '✓' : ''}
        </span>
      </div>
      <SlotPreview previewSrc={previewSrc} previewKey={previewKey} state={state} validator={validator} />
      <div className="slot__label">{slot.label}</div>
      <div className="slot__role">{slot.role}</div>
      <div className="slot__footer">
        <span className="slot__state">{slotWord(state, language)}</span>
        {validatorBadge && (
          <span className={'slot__qc slot__qc--' + validatorBadge.tone} title={validatorBadge.title}>
            {validatorBadge.label}
          </span>
        )}
      </div>
    </button>
  )
}

/** Wrapper with per-slot review controls + collapsible prompt editor. */
export function SlotCardReview({
  slot, state, selected, validator, disabled, onToggle,
  approval, override, expanded,
  onSetApproval, onSetOverride, onToggleExpanded, onReveal,
  language = 'en'
}) {
  const hasFile = !!validator?.exists
  const wrapClass = [
    'slot-card',
    `slot-card--${state}`,
    approval === 'approved'   && 'slot-card--approved',
    approval === 'needs-regen' && 'slot-card--needs-regen'
  ].filter(Boolean).join(' ')

  function stop(e) { e.stopPropagation() }
  function handleApprove(e) {
    stop(e)
    onSetApproval && onSetApproval(slot.id, approval === 'approved' ? null : 'approved')
  }
  function handleNeedsRegen(e) {
    stop(e)
    onSetApproval && onSetApproval(slot.id, approval === 'needs-regen' ? null : 'needs-regen')
  }
  function handleReveal(e) {
    stop(e)
    onReveal && onReveal(slot.id)
  }
  function handleExpand(e) {
    stop(e)
    onToggleExpanded && onToggleExpanded(slot.id)
  }

  return (
    <div className={wrapClass}>
      <SlotCard
        slot={slot}
        state={state}
        selected={selected}
        validator={validator}
        disabled={disabled}
        onToggle={onToggle}
        language={language}
      />
      <div className="slot-card__actions">
        <button
          type="button"
          className={'slot-card__act' + (approval === 'approved' ? ' slot-card__act--on' : '')}
          onClick={handleApprove}
          title="Mark slot OK"
        >{t('slot.action.approve', language)}</button>
        <button
          type="button"
          className={'slot-card__act' + (approval === 'needs-regen' ? ' slot-card__act--warn' : '')}
          onClick={handleNeedsRegen}
          title="Flag slot for regenerate"
        >{t('slot.action.regen', language)}</button>
        <button
          type="button"
          className="slot-card__act"
          onClick={handleReveal}
          disabled={!hasFile}
          title={hasFile ? validator.file : 'No file on disk yet'}
        >{t('slot.action.open', language)}</button>
        <button
          type="button"
          className={'slot-card__act slot-card__act--toggle' + (expanded ? ' slot-card__act--on' : '')}
          onClick={handleExpand}
          title="Edit prompt override"
          aria-expanded={expanded}
        >{expanded ? '▾' : '▸'} {t('slot.action.prompt', language)}</button>
      </div>
      {expanded && (
        <div className="slot-card__override" onClick={stop}>
          <textarea
            className="slot-card__override-input"
            placeholder={t('slot.prompt.placeholder', language)}
            value={override}
            onChange={(e) => onSetOverride && onSetOverride(slot.id, e.target.value)}
            rows={3}
          />
          <div className="slot-card__override-hint">
            {t('slot.prompt.saved_pending', language)}
          </div>
        </div>
      )}
    </div>
  )
}

export default SlotCardReview
