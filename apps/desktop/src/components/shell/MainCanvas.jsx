import React from 'react'
import EmptyState from '../atoms/EmptyState.jsx'
import StatusChip from '../atoms/StatusChip.jsx'
import Button from '../atoms/Button.jsx'
import { LISTING_SLOT_META } from '../../lib/slot-progress.js'

const STEP_HEADERS = {
  intake:  { kicker: '01 · INTAKE',  title: 'Project & brief' },
  listing: { kicker: '02 · LISTING', title: '8-slot listing pipeline' },
  aplus:   { kicker: '03 · A+',      title: 'A+ premium modules' },
  video:   { kicker: '04 · VIDEO',   title: 'Product video' },
  qc:      { kicker: '05 · QC',      title: 'QC & export bundle' }
}

const STEP_PLACEHOLDER = {
  aplus: {
    body: 'A+ wires into runtime/bin/aplus.mjs in a later phase. Five modules at 1464×600, single + multi-ASIN plans.',
    items: ['M1 · hero', 'M2-M4 · feature deck', 'M5 · comparison / CTA', 'Multi-ASIN child fan-out']
  },
  video: {
    body: 'Storyboard generator + Kling 3.0 producer call. Output 1920×1080 MP4. Not wired in phase 1.',
    items: ['storyboard.json', 'Shot prompt synthesis', 'KIE video call', 'Mux + delivery']
  },
  qc: {
    body: 'Cohesion report, doctrine compliance, and ZIP export of the publish-ready bundle.',
    items: ['cohesion_report.json', 'Doctrine pass/fail', 'Rename & bundle']
  }
}

/**
 * @typedef {Object} MainCanvasProps
 * @property {string} step                       intake|listing|aplus|video|qc
 * @property {string} workspace
 * @property {string} skuPath
 * @property {{ ok:boolean, brief?:object, error?:string }|null} validation
 * @property {boolean} validating
 * @property {number}  skuCount
 * @property {() => void} onPickWorkspace
 * @property {{ status:string, lines:Array<{stream:string,line:string,ts:number}>, runId:string|null }} listingState
 */

/** @param {MainCanvasProps} props */
export default function MainCanvas({
  step,
  workspace,
  skuPath,
  validation,
  validating,
  skuCount,
  onPickWorkspace,
  listingState,
  slotStates,
  selectedSlots,
  onToggleSlot,
  onClearSlotSelection,
  onSelectAllSlots,
  onRunListing,
  onRunListingRegen,
  runDisabledReason,
  validatorReport,
  validatingOutput,
  onRefreshValidator
}) {
  const header = STEP_HEADERS[step] || STEP_HEADERS.intake
  const skuName = skuPath ? lastSegment(skuPath) : null
  const breadcrumb = workspace ? lastSegment(workspace) : '—'
  const meta = skuName
    ? `${breadcrumb} / ${skuName}`
    : `${breadcrumb}`

  return (
    <div className="canvas">
      <header className="canvas__header">
        <div className="canvas__breadcrumb" aria-label="Breadcrumb">
          <span className="canvas__crumb">{breadcrumb}</span>
          {skuName && <>
            <span className="canvas__crumb-sep" aria-hidden="true">/</span>
            <span className="canvas__crumb canvas__crumb--current">{skuName}</span>
          </>}
        </div>
        <div className="canvas__title-row">
          <div className="canvas__title-block">
            <span className="canvas__kicker">{header.kicker}</span>
            <h1 className="canvas__title">{header.title}</h1>
          </div>
          <div className="canvas__meta">{meta}</div>
        </div>
      </header>

      <div className="canvas__body">
        {!workspace && (
          <EmptyState
            size="lg"
            icon={<FolderIcon />}
            title="Pick a workspace to begin"
            description="Select the parent folder containing your SKU subdirectories. Each SKU should have a brief.json."
            primaryAction={{ label: 'Pick workspace', onClick: onPickWorkspace, shortcut: '⌘O' }}
          />
        )}

        {workspace && !skuPath && (
          <EmptyState
            size="lg"
            icon={<SkuIcon />}
            title="Select a SKU"
            description={skuCount > 0
              ? `${skuCount} SKU${skuCount === 1 ? '' : 's'} discovered. Click one in the left rail to load its brief.`
              : 'No SKUs discovered. Add SKU folders (each with brief.json) inside the workspace.'}
          />
        )}

        {workspace && skuPath && step === 'intake' && (
          <IntakeView validation={validation} validating={validating} workspace={workspace} skuPath={skuPath} />
        )}

        {workspace && skuPath && step === 'listing' && (
          <ListingView
            listingState={listingState}
            slotStates={slotStates || {}}
            selectedSlots={selectedSlots || new Set()}
            onToggleSlot={onToggleSlot}
            onClearSlotSelection={onClearSlotSelection}
            onSelectAllSlots={onSelectAllSlots}
            onRunListing={onRunListing}
            onRunListingRegen={onRunListingRegen}
            runDisabledReason={runDisabledReason}
            validatorReport={validatorReport}
            validatingOutput={validatingOutput}
            onRefreshValidator={onRefreshValidator}
          />
        )}

        {workspace && skuPath && (step === 'aplus' || step === 'video' || step === 'qc') && (
          <StepPlaceholder step={step} />
        )}
      </div>
    </div>
  )
}

function IntakeView({ validation, validating, workspace, skuPath }) {
  if (validating) {
    return (
      <div className="panel">
        <div className="panel__head">
          <span className="panel__title">Validating brief…</span>
        </div>
        <div className="panel__body">
          <SkeletonRows rows={4} />
        </div>
      </div>
    )
  }

  if (!validation?.ok) {
    return (
      <EmptyState
        size="md"
        icon={<WarningIcon />}
        title="Brief not validated"
        description={validation?.error || 'Use Re-validate in the inspector to parse brief.json.'}
      />
    )
  }

  const b = validation.brief || {}
  const fields = [
    { k: 'SKU',        v: b.sku },
    { k: 'Product',    v: b.product_name },
    { k: 'Category',   v: b.category },
    { k: 'Occasion',   v: b.occasion },
    { k: 'Dimensions', v: b.dimensions },
    { k: 'Materials',  v: b.materials != null ? `${b.materials} listed` : null },
    { k: 'Features',   v: b.features  != null ? `${b.features} listed`  : null }
  ]

  return (
    <div className="panel-stack">
      <div className="panel">
        <div className="panel__head">
          <span className="panel__title">Brief snapshot</span>
          <StatusChip status="complete" size="sm">Parsed</StatusChip>
        </div>
        <div className="panel__body">
          <dl className="brief-grid">
            {fields.map(f => (
              <div className="brief-grid__cell" key={f.k}>
                <dt className="brief-grid__k">{f.k}</dt>
                <dd className="brief-grid__v">{f.v || <span className="muted">—</span>}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <span className="panel__title">Paths</span>
        </div>
        <div className="panel__body">
          <PathRow k="workspace" v={workspace} />
          <PathRow k="sku" v={skuPath} />
          <PathRow k="brief" v={skuPath + '/brief.json'} />
        </div>
      </div>
    </div>
  )
}

function PathRow({ k, v }) {
  function copy() { try { navigator.clipboard?.writeText(v) } catch {} }
  return (
    <button type="button" className="path-row" onClick={copy} disabled={!v}>
      <span className="path-row__k">{k}</span>
      <span className="path-row__v">{v || <span className="muted">—</span>}</span>
      <span className="path-row__hint">copy</span>
    </button>
  )
}

function ListingView({
  listingState,
  slotStates,
  selectedSlots,
  onToggleSlot,
  onClearSlotSelection,
  onSelectAllSlots,
  onRunListing,
  onRunListingRegen,
  runDisabledReason,
  validatorReport,
  validatingOutput,
  onRefreshValidator
}) {
  const selectionCount = selectedSlots.size
  const running = listingState.status === 'running'
  const regenDisabledReason = runDisabledReason
    || (selectionCount === 0 ? 'Select one or more slots to regenerate' : undefined)

  const validatorByslot = React.useMemo(() => {
    const map = {}
    for (const s of validatorReport?.slots || []) map[s.slot] = s
    return map
  }, [validatorReport])

  return (
    <div className="panel-stack">
      <div className="panel">
        <div className="panel__head">
          <span className="panel__title">Listing slots</span>
          <span className="panel__meta">runtime/bin/listing.mjs</span>
        </div>
        <div className="panel__body">
          <div className="slot-toolbar">
            <div className="slot-toolbar__info">
              <span className="slot-toolbar__count">
                {selectionCount === 0
                  ? 'No slots selected'
                  : `${selectionCount} slot${selectionCount === 1 ? '' : 's'} selected`}
              </span>
              <button
                type="button"
                className="slot-toolbar__link"
                onClick={onSelectAllSlots}
                disabled={running}
              >Select all</button>
              <button
                type="button"
                className="slot-toolbar__link"
                onClick={onClearSlotSelection}
                disabled={running || selectionCount === 0}
              >Clear</button>
            </div>
            <div className="slot-toolbar__actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={onRunListing}
                disabled={!!runDisabledReason}
                disabledReason={runDisabledReason}
              >Run all 8</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onRunListingRegen}
                disabled={!!regenDisabledReason}
                disabledReason={regenDisabledReason}
              >
                {selectionCount > 0
                  ? `Regenerate ${selectionCount}`
                  : 'Regenerate selected'}
              </Button>
            </div>
          </div>

          <div className="slot-grid">
            {LISTING_SLOT_META.map(s => {
              const st = slotStates[s.id] || 'idle'
              const selected = selectedSlots.has(s.id)
              const v = validatorByslot[s.id]
              return (
                <SlotCard
                  key={s.id}
                  slot={s}
                  state={st}
                  selected={selected}
                  validator={v}
                  disabled={running}
                  onToggle={() => onToggleSlot && onToggleSlot(s.id)}
                />
              )
            })}
          </div>
        </div>
      </div>

      <ValidatorPanel
        report={validatorReport}
        validating={!!validatingOutput}
        onRefresh={onRefreshValidator}
      />
    </div>
  )
}

function SlotCard({ slot, state, selected, validator, disabled, onToggle }) {
  const stateClass = 'slot slot--' + state + (selected ? ' slot--selected' : '')
  const validatorBadge = validatorBadgeFor(state, validator)
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
      <div className="slot__label">{slot.label}</div>
      <div className="slot__role">{slot.role}</div>
      <div className="slot__footer">
        <span className="slot__state">{slotWord(state)}</span>
        {validatorBadge && (
          <span className={'slot__qc slot__qc--' + validatorBadge.tone} title={validatorBadge.title}>
            {validatorBadge.label}
          </span>
        )}
      </div>
    </button>
  )
}

function validatorBadgeFor(state, validator) {
  if (!validator) return null
  if (!validator.exists) return { tone: 'missing', label: 'missing', title: 'File not found on disk' }
  if (validator.dimensionsOk === true) {
    return { tone: 'ok', label: `${validator.width}×${validator.height}`, title: 'Dimensions OK' }
  }
  if (validator.dimensionsOk === false) {
    return {
      tone: 'bad',
      label: `${validator.width ?? '?'}×${validator.height ?? '?'}`,
      title: 'Expected 2000×2000'
    }
  }
  return { tone: 'unknown', label: 'unchecked', title: validator.dimensionsReason || 'sharp not available' }
}

function slotWord(st) {
  switch (st) {
    case 'done':    return 'done'
    case 'running': return 'live'
    case 'error':   return 'failed'
    case 'skipped': return 'skipped'
    default:        return 'pending'
  }
}

function ValidatorPanel({ report, validating, onRefresh }) {
  const noReport = !report
  const error = report && !report.summary && !Array.isArray(report.slots)
  const summary = report?.summary
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="panel__title">Output validator</span>
        <div className="panel__head-right">
          {summary && (
            <StatusChip
              status={report.ok ? 'complete' : 'needs-fix'}
              size="sm"
            >
              {report.ok ? 'Pass' : 'Issues'}
            </StatusChip>
          )}
          <button
            type="button"
            className="panel__head-action"
            onClick={onRefresh}
            disabled={validating}
          >
            {validating ? 'Checking…' : 'Re-check'}
          </button>
        </div>
      </div>
      <div className="panel__body">
        {noReport && (
          <p className="inspector__locked-copy">
            Run listing or click <em>Re-check</em> to validate <code>output/listing/</code>.
          </p>
        )}
        {error && (
          <p className="inspector__locked-copy">
            Validator error: <span className="muted">{report.error || 'unknown'}</span>
          </p>
        )}
        {summary && (
          <>
            <ul className="qc-checklist">
              <QcRow
                ok={summary.missing === 0}
                label="All 8 slot files present"
                detail={`${summary.found}/8 found${summary.missing ? ` · missing ${summary.missing}` : ''}`}
              />
              <QcRow
                ok={summary.dimsBad === 0 && (summary.dimsOk > 0 || summary.dimsUnchecked > 0)}
                label="Image dimensions 2000×2000"
                tone={summary.dimsBad > 0 ? 'bad' : (summary.dimsUnchecked > 0 ? 'unknown' : 'ok')}
                detail={
                  summary.sharpAvailable
                    ? `${summary.dimsOk} ok · ${summary.dimsBad} bad`
                    : 'unchecked — sharp not available in runtime'
                }
              />
              <QcRow
                ok
                tone="info"
                label="Output directory"
                detail={report.listingDirExists ? report.listingDir : '— folder not yet created'}
              />
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function QcRow({ ok, tone, label, detail }) {
  const computedTone = tone || (ok ? 'ok' : 'bad')
  return (
    <li className={'qc-row qc-row--' + computedTone}>
      <span className="qc-row__icon" aria-hidden="true">{qcIcon(computedTone)}</span>
      <span className="qc-row__label">{label}</span>
      <span className="qc-row__detail">{detail}</span>
    </li>
  )
}

function qcIcon(tone) {
  switch (tone) {
    case 'ok': return '✓'
    case 'bad': return '✕'
    case 'unknown': return '?'
    case 'info': return '·'
    default: return '·'
  }
}

function StepPlaceholder({ step }) {
  const c = STEP_PLACEHOLDER[step]
  if (!c) return null
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="panel__title">Not wired in phase 1</span>
        <StatusChip status="locked" size="sm">Locked</StatusChip>
      </div>
      <div className="panel__body">
        <p className="panel__paragraph">{c.body}</p>
        <ul className="step-roadmap">
          {c.items.map((it, i) => (
            <li key={i} className="step-roadmap__item">
              <span className="step-roadmap__no">{String(i + 1).padStart(2, '0')}</span>
              <span className="step-roadmap__label">{it}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SkeletonRows({ rows = 3 }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton skeleton--row" key={i} />
      ))}
    </div>
  )
}

function lastSegment(p) {
  if (!p) return ''
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || p
}

function FolderIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.3 1.5h5.1A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5z" strokeLinejoin="round" />
    </svg>
  )
}

function SkuIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2.5" y="3" width="11" height="10" rx="1" />
      <line x1="5" y1="6" x2="11" y2="6" strokeLinecap="round" />
      <line x1="5" y1="9" x2="9" y2="9" strokeLinecap="round" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M8 2l6 11H2L8 2z" strokeLinejoin="round" />
      <line x1="8" y1="6" x2="8" y2="9.5" strokeLinecap="round" />
      <circle cx="8" cy="11.3" r="0.4" fill="currentColor" />
    </svg>
  )
}
