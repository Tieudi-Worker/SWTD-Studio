import React from 'react'
import { t } from '../../lib/i18n.js'
import SlotTemplatePicker from './SlotTemplatePicker.jsx'

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

/** Pure tile: head + preview + label + state footer.
 *  Phase 3: a tmp-generated image (provider-adapter output) takes
 *  precedence over the validator's listing-folder preview. */
export function SlotCard({ slot, state, selected, validator, disabled, onToggle, language = 'en', tmpImage }) {
  const stateClass = 'slot slot--' + state + (selected ? ' slot--selected' : '')
  const validatorBadge = validatorBadgeFor(state, validator)
  const validatorPreviewSrc = validator?.exists && validator.file && typeof window !== 'undefined' && window.swtd?.assetUrl
    ? window.swtd.assetUrl(validator.file)
    : null
  const tmpPreviewSrc = tmpImage?.file && typeof window !== 'undefined' && window.swtd?.assetUrl
    ? window.swtd.assetUrl(tmpImage.file)
    : null
  const previewSrc = tmpPreviewSrc || validatorPreviewSrc
  // Use tmp generatedAt as the cache-buster when tmp wins; otherwise the
  // existing validator width×height tuple still busts the cache on regen.
  const previewKey = tmpPreviewSrc
    ? `tmp-${tmpImage.generatedAt}`
    : (previewSrc && validator ? `${validator.width}x${validator.height}` : '')
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
  language = 'en',
  /* Phase 2 — template engine */
  templateSelection,         // { templateId, angleId } | undefined
  composedPrompt,            // { text, missingVars: string[], … } | null
  onSetTemplate,             // (slotId, selection|null) => void
  /* Phase 3 — provider adapter */
  tmpImage,                  // { file, generatedAt, expiresAt, providerId, ... } | null
  generationError,           // string reason from last failed generate, or null
  onGenerate,                // (slotId) => void
  onCancelGenerate           // (slotId) => void
}) {
  const hasFile = !!validator?.exists
  const missingVars = composedPrompt?.missingVars || []
  const hasMissing = missingVars.length > 0
  const isGenerating = state === 'generating' || state === 'queued'
  const canGenerate = !!composedPrompt && !isGenerating && !!onGenerate
  const wrapClass = [
    'slot-card',
    `slot-card--${state}`,
    approval === 'approved'   && 'slot-card--approved',
    approval === 'needs-regen' && 'slot-card--needs-regen',
    hasMissing                 && 'slot-card--has-missing',
    tmpImage                   && 'slot-card--has-tmp'
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
  function handleGenerate(e) {
    stop(e)
    if (canGenerate) onGenerate(slot.id)
  }
  function handleCancelGenerate(e) {
    stop(e)
    onCancelGenerate && onCancelGenerate(slot.id)
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
        tmpImage={tmpImage}
      />
      <div className="slot-card__actions">
        {onGenerate && (
          isGenerating ? (
            <button
              type="button"
              className="slot-card__act slot-card__act--cancel"
              onClick={handleCancelGenerate}
              title="Cancel in-flight generation"
            >{t('slot.action.cancel', language)}</button>
          ) : (
            <button
              type="button"
              className={'slot-card__act slot-card__act--generate' + (canGenerate ? '' : ' slot-card__act--disabled')}
              onClick={handleGenerate}
              disabled={!canGenerate}
              title={
                !composedPrompt
                  ? t('slot.action.generate_no_template', language)
                  : 'Generate via active provider'
              }
            >{t('slot.action.generate', language)}</button>
          )
        )}
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
      {onSetTemplate && (
        <SlotTemplatePicker
          slotRole={slot.role}
          slotId={slot.id}
          selection={templateSelection}
          onChange={onSetTemplate}
          language={language}
        />
      )}
      {(tmpImage || generationError) && (
        <div className="slot-card__gen-status" onClick={stop}>
          {tmpImage && (() => {
            const daysLeft = Math.max(0, Math.round((tmpImage.expiresAt - Date.now()) / (24*60*60*1000)))
            const expFn = t('slot.gen.expires_in_days', language)
            const expLabel = typeof expFn === 'function' ? expFn(daysLeft) : ''
            const served = tmpImage.providerId || 'mock'
            // US6: surface fallback substitution. The first chain entry is
            // the originally-requested provider when the served provider
            // differs from it. Tooltip lists the chain so the operator
            // can see WHY the fallback happened.
            const chain = Array.isArray(tmpImage.fallbackChain) ? tmpImage.fallbackChain : []
            const requested = chain.length > 0 ? chain[0].providerId : served
            const substituted = chain.length > 0 && requested !== served
            const viaFn = t('provider.served_via', language)
            const viaLabel = typeof viaFn === 'function' ? viaFn(served) : `via ${served}`
            const tooltip = substituted
              ? `${viaLabel}\n` + chain.map((e) => `↳ ${e.providerId}: ${e.reason}${e.status ? ' (' + e.status + ')' : ''}`).join('\n')
              : viaLabel
            return (
              <>
                <span
                  className={
                    'slot-card__gen-tag slot-card__gen-tag--' + served
                    + (substituted ? ' slot-card__gen-tag--fallback' : '')
                  }
                  title={tooltip}
                >
                  {served.toUpperCase()} · {expLabel}
                  {substituted && (
                    <span className="slot-card__gen-tag-substitution" aria-hidden="true"> ⤿</span>
                  )}
                </span>
                {substituted && (
                  <span
                    className="slot-card__gen-tag slot-card__gen-tag--fallback-note"
                    title={tooltip}
                  >
                    {t('provider.fallback_used', language) || 'fallback used'}
                  </span>
                )}
              </>
            )
          })()}
          {generationError && (
            <span className="slot-card__gen-tag slot-card__gen-tag--error">
              {t('slot.gen.error.' + generationError, language) || t('slot.gen.error.unknown', language)}
            </span>
          )}
        </div>
      )}
      {composedPrompt && (
        <div className="slot-card__composed" onClick={stop}>
          <div className="slot-card__composed-head">
            <span className="slot-card__composed-title">{t('template.preview.heading', language)}</span>
            {hasMissing && (
              <span
                className="slot-card__composed-warn"
                title={missingVars.map(v => `[missing: ${v}]`).join('\n')}
              >
                {(() => {
                  const fn = t('template.warning.missing_var', language)
                  return typeof fn === 'function' ? fn(missingVars.length) : 'missing vars'
                })()}
              </span>
            )}
          </div>
          <div className="slot-card__composed-text">{composedPrompt.text}</div>
          <div className="slot-card__composed-meta">
            <span>{t('slot.prompt.saved_pending', language)}</span>
            {composedPrompt.includesBrandModifier && (
              <span className="slot-card__composed-tag">{t('template.modifier.included', language)}</span>
            )}
          </div>
        </div>
      )}
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
