import React from 'react'
import EmptyState from '../atoms/EmptyState.jsx'
import StatusChip from '../atoms/StatusChip.jsx'
import Button from '../atoms/Button.jsx'
import { LISTING_SLOT_META } from '../../lib/slot-progress.js'
import { APLUS_MODULE_META } from '../../lib/aplus-progress.js'
import { t } from '../../lib/i18n.js'
import { SlotCard, SlotCardReview } from './SlotCard.jsx'

const STEP_KICKER = {
  intake:  '01 · INTAKE',
  listing: '02 · LISTING',
  aplus:   '03 · A+',
  video:   '04 · VIDEO',
  qc:      '05 · QC'
}
const STEP_TITLE_KEY = {
  intake:  'canvas.title.intake',
  listing: 'canvas.title.listing',
  aplus:   'canvas.title.aplus',
  video:   'canvas.title.video',
  qc:      'canvas.title.qc'
}

const STEP_PLACEHOLDER = {
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
  onRefreshValidator,
  onRevealCohesionRequest,
  /* Phase 4 review state */
  slotApprovals,
  slotOverrides,
  slotExpanded,
  onSetSlotApproval,
  onSetSlotOverride,
  onToggleSlotExpanded,
  onApproveAllFoundSlots,
  onRevealSlotFile,
  onRevealListingFolder,
  onExportApprovedSlots,
  /* A+ pipeline (Phase 3) */
  aplusState,
  aplusModuleStates,
  selectedModules,
  onToggleModule,
  onClearModuleSelection,
  onSelectAllModules,
  onRunAplus,
  onRunAplusRegen,
  runAplusDisabledReason,
  aplusValidatorReport,
  aplusValidating,
  onRefreshAplusValidator,
  language = 'en'
}) {
  const kicker = STEP_KICKER[step] || STEP_KICKER.intake
  const title = t(STEP_TITLE_KEY[step] || 'canvas.title.intake', language)
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
            <span className="canvas__kicker">{kicker}</span>
            <h1 className="canvas__title">{title}</h1>
          </div>
          <div className="canvas__meta">{meta}</div>
        </div>
      </header>

      <div className="canvas__body">
        {!workspace && (
          <EmptyState
            size="lg"
            icon={<FolderIcon />}
            title={t('canvas.empty.no_workspace', language)}
            description={t('canvas.empty.no_workspace_hint', language)}
            primaryAction={{ label: t('leftrail.action.pick_workspace', language), onClick: onPickWorkspace, shortcut: '⌘O' }}
          />
        )}

        {workspace && !skuPath && (() => {
          const hintFn = t('canvas.empty.no_sku_hint', language)
          const hint = typeof hintFn === 'function' ? hintFn(skuCount) : ''
          return (
            <EmptyState
              size="lg"
              icon={<SkuIcon />}
              title={t('canvas.empty.no_sku', language)}
              description={hint}
            />
          )
        })()}

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
            onRevealCohesionRequest={onRevealCohesionRequest}
            slotApprovals={slotApprovals || {}}
            slotOverrides={slotOverrides || {}}
            slotExpanded={slotExpanded || {}}
            onSetSlotApproval={onSetSlotApproval}
            onSetSlotOverride={onSetSlotOverride}
            onToggleSlotExpanded={onToggleSlotExpanded}
            onApproveAllFoundSlots={onApproveAllFoundSlots}
            onRevealSlotFile={onRevealSlotFile}
            onRevealListingFolder={onRevealListingFolder}
            onExportApprovedSlots={onExportApprovedSlots}
            language={language}
          />
        )}

        {workspace && skuPath && step === 'aplus' && (
          <AplusView
            aplusState={aplusState || { status: 'idle', lines: [] }}
            moduleStates={aplusModuleStates || {}}
            selectedModules={selectedModules || new Set()}
            onToggleModule={onToggleModule}
            onClearModuleSelection={onClearModuleSelection}
            onSelectAllModules={onSelectAllModules}
            onRunAplus={onRunAplus}
            onRunAplusRegen={onRunAplusRegen}
            runAplusDisabledReason={runAplusDisabledReason}
            validatorReport={aplusValidatorReport}
            validating={aplusValidating}
            onRefreshValidator={onRefreshAplusValidator}
            language={language}
          />
        )}

        {workspace && skuPath && (step === 'video' || step === 'qc') && (
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
  onRefreshValidator,
  onRevealCohesionRequest,
  slotApprovals,
  slotOverrides,
  slotExpanded,
  onSetSlotApproval,
  onSetSlotOverride,
  onToggleSlotExpanded,
  onApproveAllFoundSlots,
  onRevealSlotFile,
  onRevealListingFolder,
  onExportApprovedSlots,
  language = 'en'
}) {
  const selectionCount = selectedSlots.size
  const running = listingState.status === 'running'
  const paused = listingState.status === 'paused'
  const regenDisabledReason = runDisabledReason
    || (selectionCount === 0 ? 'Select one or more slots to regenerate' : undefined)

  const validatorByslot = React.useMemo(() => {
    const map = {}
    for (const s of validatorReport?.slots || []) map[s.slot] = s
    return map
  }, [validatorReport])

  const foundCount = (validatorReport?.slots || []).filter(s => s.exists).length
  const approvedCount = Object.values(slotApprovals || {}).filter(v => v === 'approved').length

  // Transient "copied N paths" flash after an export action. Clears itself
  // after 2.5s; no toast library, no portal — local state only.
  const [exportFlash, setExportFlash] = React.useState(null)
  const handleExport = React.useCallback(async () => {
    if (!onExportApprovedSlots) return
    const copied = await onExportApprovedSlots()
    if (copied == null) return
    setExportFlash(copied)
    const id = setTimeout(() => setExportFlash(null), 2500)
    return () => clearTimeout(id)
  }, [onExportApprovedSlots])

  return (
    <div className="panel-stack">
      {paused && (
        <CohesionPauseBanner
          requestPath={listingState.cohesionRequestPath}
          onReveal={onRevealCohesionRequest}
        />
      )}

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
              <button
                type="button"
                className="slot-toolbar__link"
                onClick={onApproveAllFoundSlots}
                disabled={running || foundCount === 0}
                title={foundCount === 0 ? 'No slot files on disk yet' : undefined}
              >Approve all found ({foundCount})</button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRunListing}
                disabled={!!runDisabledReason}
                disabledReason={runDisabledReason}
              >Run all 8</Button>
              <Button
                variant="secondary"
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

          <div className="slot-toolbar__review-info">
            <span>{approvedCount}/{foundCount || 0} approved</span>
            <div className="slot-toolbar__review-actions">
              {validatorReport?.listingDir && (
                <button
                  type="button"
                  className="slot-toolbar__link"
                  onClick={onRevealListingFolder}
                  title={validatorReport.listingDir}
                >Reveal output folder</button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={approvedCount === 0}
                disabledReason={approvedCount === 0 ? 'No slots approved yet' : undefined}
                title="Copy approved slot file paths + reveal folder"
              >
                {exportFlash != null
                  ? `Copied ${exportFlash} path${exportFlash === 1 ? '' : 's'} ✓`
                  : `Export approved (${approvedCount})`}
              </Button>
            </div>
          </div>

          <div className="slot-grid">
            {LISTING_SLOT_META.map(s => {
              const st = slotStates[s.id] || 'idle'
              const selected = selectedSlots.has(s.id)
              const v = validatorByslot[s.id]
              return (
                <SlotCardReview
                  key={s.id}
                  slot={s}
                  state={st}
                  selected={selected}
                  validator={v}
                  disabled={running}
                  onToggle={() => onToggleSlot && onToggleSlot(s.id)}
                  approval={slotApprovals[s.id]}
                  override={slotOverrides[s.id] || ''}
                  expanded={!!slotExpanded[s.id]}
                  onSetApproval={onSetSlotApproval}
                  onSetOverride={onSetSlotOverride}
                  onToggleExpanded={onToggleSlotExpanded}
                  onReveal={onRevealSlotFile}
                  language={language}
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

function AplusView({
  aplusState,
  moduleStates,
  selectedModules,
  onToggleModule,
  onClearModuleSelection,
  onSelectAllModules,
  onRunAplus,
  onRunAplusRegen,
  runAplusDisabledReason,
  validatorReport,
  validating,
  onRefreshValidator,
  language
}) {
  const selectionCount = selectedModules.size
  const running = aplusState.status === 'running'
  const regenDisabledReason = runAplusDisabledReason
    || (selectionCount === 0 ? t('aplus.reason.select_modules', language) : undefined)

  const validatorByModule = React.useMemo(() => {
    const map = {}
    for (const m of validatorReport?.modules || []) map[m.module] = m
    return map
  }, [validatorReport])

  const selectionFn = t('aplus.toolbar.selection', language)
  const selectionLabel = selectionCount === 0
    ? t('aplus.toolbar.no_selection', language)
    : (typeof selectionFn === 'function' ? selectionFn(selectionCount) : '')

  const regenFn = t('aplus.action.regen_n', language)
  const regenLabel = selectionCount > 0 && typeof regenFn === 'function'
    ? regenFn(selectionCount)
    : t('aplus.action.regen_selected', language)

  return (
    <div className="panel-stack">
      <div className="panel">
        <div className="panel__head">
          <span className="panel__title">{t('aplus.panel.title', language)}</span>
          <span className="panel__meta">{t('aplus.panel.subtitle', language)}</span>
        </div>
        <div className="panel__body">
          <div className="slot-toolbar">
            <div className="slot-toolbar__info">
              <span className="slot-toolbar__count">{selectionLabel}</span>
              <button
                type="button"
                className="slot-toolbar__link"
                onClick={onSelectAllModules}
                disabled={running}
              >{t('aplus.toolbar.select_all', language)}</button>
              <button
                type="button"
                className="slot-toolbar__link"
                onClick={onClearModuleSelection}
                disabled={running || selectionCount === 0}
              >{t('aplus.toolbar.clear', language)}</button>
            </div>
            <div className="slot-toolbar__actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={onRunAplus}
                disabled={!!runAplusDisabledReason}
                disabledReason={runAplusDisabledReason}
              >{t('aplus.action.run_all_5', language)}</Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRunAplusRegen}
                disabled={!!regenDisabledReason}
                disabledReason={regenDisabledReason}
              >{regenLabel}</Button>
            </div>
          </div>

          <div className="slot-grid">
            {APLUS_MODULE_META.map(mod => {
              const st = moduleStates[mod.id] || 'idle'
              const selected = selectedModules.has(mod.id)
              const v = validatorByModule[mod.id]
              return (
                <SlotCard
                  key={mod.id}
                  slot={mod}
                  state={st}
                  selected={selected}
                  validator={v}
                  disabled={running}
                  onToggle={() => onToggleModule && onToggleModule(mod.id)}
                  language={language}
                />
              )
            })}
          </div>
        </div>
      </div>

      <AplusValidatorPanel
        report={validatorReport}
        validating={!!validating}
        onRefresh={onRefreshValidator}
        language={language}
      />
    </div>
  )
}

function AplusValidatorPanel({ report, validating, onRefresh, language }) {
  const noReport = !report
  const error = report && !report.summary && !Array.isArray(report.modules)
  const summary = report?.summary
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="panel__title">{t('aplus.validator.title', language)}</span>
        <div className="panel__head-right">
          {summary && (
            <StatusChip
              status={report.ok ? 'complete' : 'needs-fix'}
              size="sm"
            >
              {report.ok ? t('aplus.qc.status_pass', language) : t('aplus.qc.status_issues', language)}
            </StatusChip>
          )}
          <button
            type="button"
            className="panel__head-action"
            onClick={onRefresh}
            disabled={validating}
          >
            {validating ? t('aplus.validator.checking', language) : t('aplus.validator.recheck', language)}
          </button>
        </div>
      </div>
      <div className="panel__body">
        {noReport && (
          <p className="inspector__locked-copy">
            {t('aplus.validator.no_report', language)}
          </p>
        )}
        {error && (
          <p className="inspector__locked-copy">
            Validator error: <span className="muted">{report.error || 'unknown'}</span>
          </p>
        )}
        {summary && (() => {
          const presentFn = t('aplus.validator.files_present', language)
          const missingFn = t('aplus.validator.files_missing', language)
          const presentLabel = summary.missing === 0
            ? (typeof presentFn === 'function' ? presentFn(summary.found) : `All 5 found`)
            : (typeof missingFn === 'function' ? missingFn(summary.found, summary.missing) : `${summary.found}/5`)
          return (
            <ul className="qc-checklist">
              <QcRow
                ok={summary.missing === 0}
                label={presentLabel.split(' (')[0]}
                detail={`${summary.found}/5${summary.missing ? ` · missing ${summary.missing}` : ''}`}
              />
              <QcRow
                ok={summary.dimsBad === 0 && (summary.dimsOk > 0 || summary.dimsUnchecked > 0)}
                label={t('aplus.validator.dimensions', language)}
                tone={summary.dimsBad > 0 ? 'bad' : (summary.dimsUnchecked > 0 ? 'unknown' : 'ok')}
                detail={
                  summary.sharpAvailable
                    ? `${summary.dimsOk} ok · ${summary.dimsBad} bad`
                    : t('aplus.validator.dims_unchecked', language)
                }
              />
              <QcRow
                ok
                tone="info"
                label={t('aplus.validator.output_dir', language)}
                detail={report.aplusDirExists ? report.aplusDir : t('aplus.validator.dir_missing', language)}
              />
            </ul>
          )
        })()}
      </div>
    </div>
  )
}

function CohesionPauseBanner({ requestPath, onReveal }) {
  // Surface the Phase 2.5 cohesion pause as a guided next-step, not a failure.
  // The 8 listing slots finished successfully — master.js exited with code 2
  // to request a Claude Code Vision review and a `_cohesion_report.json` file
  // next to the request JSON. Re-running the pipeline picks up the report and
  // continues.
  const shortPath = requestPath ? shortenPath(requestPath, 64) : null
  return (
    <div className="panel panel--paused">
      <div className="panel__head">
        <span className="panel__title">8/8 generated · waiting for cohesion review</span>
        <StatusChip status="paused" size="sm">Review</StatusChip>
      </div>
      <div className="panel__body">
        <p className="panel__paragraph">
          The 8 slot images are saved. Phase&nbsp;2.5 wants Claude Code to score
          color, lighting, prop style, and mood, then write
          <code> _cohesion_report.json</code> next to the request. Re-run the
          listing once the report is in place — the pipeline will resume.
        </p>
        {requestPath && (
          <div className="cohesion-banner__path" title={requestPath}>
            <span className="cohesion-banner__path-k">request</span>
            <code className="cohesion-banner__path-v">{shortPath}</code>
          </div>
        )}
        <div className="cohesion-banner__actions">
          <Button
            variant="primary"
            size="sm"
            onClick={onReveal}
            disabled={!requestPath || !onReveal}
            disabledReason={!requestPath ? 'Request path not captured from logs' : undefined}
          >
            Open Cohesion Request
          </Button>
        </div>
      </div>
    </div>
  )
}

function shortenPath(p, max) {
  if (!p) return ''
  if (p.length <= max) return p
  return '…' + p.slice(-(max - 1))
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
