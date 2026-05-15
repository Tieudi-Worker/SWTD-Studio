import React from 'react'
import Button from '../atoms/Button.jsx'
import StatusChip from '../atoms/StatusChip.jsx'
import StatusDot from '../atoms/StatusDot.jsx'
import { LISTING_SLOT_META } from '../../lib/slot-progress.js'
import { APLUS_MODULE_META } from '../../lib/aplus-progress.js'
import { t } from '../../lib/i18n.js'
import RunTimeline from './RunTimeline.jsx'

const TABS_BY_STEP = {
  intake:  [{ id: 'Brief',      key: 'tab.brief' },
            { id: 'Validation', key: 'tab.validation' },
            { id: 'History',    key: 'tab.history' }],
  listing: [{ id: 'Run',      key: 'tab.run' },
            { id: 'Slots',    key: 'tab.slots' },
            { id: 'Timeline', key: 'tab.timeline' },
            { id: 'QC',       key: 'tab.qc' }],
  aplus:   [{ id: 'Run',     key: 'aplus.tab.run' },
            { id: 'Modules', key: 'aplus.tab.modules' },
            { id: 'QC',      key: 'aplus.tab.qc' }],
  video:   [{ id: 'Plan',  key: 'tab.plan' }],
  qc:      [{ id: 'Plan',  key: 'tab.plan' }]
}

/**
 * @typedef {Object} RightInspectorProps
 * @property {string} step
 * @property {string} skuPath
 * @property {{ ok:boolean, brief?:object, error?:string }|null} validation
 * @property {boolean} validating
 * @property {{ status:string, lines:Array, runId:string|null }} listingState
 * @property {string} [lockedReason]
 * @property {() => void} onRevalidate
 * @property {() => void} onRunListing
 * @property {() => void} onCancelListing
 * @property {string} [runDisabledReason]
 * @property {string} [cancelDisabledReason]
 * @property {string} [revalidateDisabledReason]
 */

/** @param {RightInspectorProps} props */
export default function RightInspector({
  step,
  skuPath,
  validation,
  validating,
  listingState,
  lockedReason,
  onRevalidate,
  onRunListing,
  onRunListingRegen,
  onCancelListing,
  runDisabledReason,
  cancelDisabledReason,
  revalidateDisabledReason,
  slotStates,
  selectedSlots,
  onToggleSlot,
  onClearSlotSelection,
  onSelectAllSlots,
  validatorReport,
  validatingOutput,
  onRefreshValidator,
  onRevealCohesionRequest,
  /* A+ (Phase 3) */
  aplusState,
  aplusModuleStates,
  selectedModules,
  onToggleModule,
  onClearModuleSelection,
  onSelectAllModules,
  onRunAplus,
  onRunAplusRegen,
  onCancelAplus,
  runAplusDisabledReason,
  cancelAplusDisabledReason,
  aplusValidatorReport,
  aplusValidating,
  onRefreshAplusValidator,
  language = 'en',
  runTimeline = [],
  /* eslint-disable-next-line no-unused-vars -- forces re-render when events append */
  runTimelineVersion = 0
}) {
  const tabs = TABS_BY_STEP[step] || [{ id: 'Detail', key: 'tab.plan' }]
  const [active, setActive] = React.useState(tabs[0].id)
  React.useEffect(() => { setActive(tabs[0].id) }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const skuName = skuPath ? lastSegment(skuPath) : null

  return (
    <div className="inspector">
      <div className="inspector__tabs" role="tablist">
        {tabs.map(tab => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            className={'inspector__tab' + (active === tab.id ? ' inspector__tab--active' : '')}
            onClick={() => setActive(tab.id)}
          >
            {t(tab.key, language)}
          </button>
        ))}
      </div>

      <div className="inspector__scroll">
        <section className="inspector__section">
          <div className="inspector__section-head">{t('inspector.section.current_sku', language)}</div>
          <div className="inspector__sku">
            <span className="inspector__sku-name">{skuName || <span className="muted">none</span>}</span>
            <StatusChip
              status={validating ? 'running' : (validation?.ok ? 'ready' : (skuPath ? 'needs-fix' : 'idle'))}
              size="sm"
            />
          </div>
          {skuPath && <div className="inspector__sku-path" title={skuPath}>{shortPath(skuPath, 36)}</div>}
        </section>

        {step === 'intake' && active === 'Brief' && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('inspector.section.brief_fields', language)}</div>
            <DefList items={briefFields(validation)} />
          </section>
        )}

        {step === 'intake' && active === 'Validation' && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('inspector.section.brief_health', language)}</div>
            <BriefHealth validation={validation} />
          </section>
        )}

        {step === 'intake' && active === 'History' && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('inspector.section.recent_changes', language)}</div>
            <History
              skuPath={skuPath}
              validation={validation}
              validating={validating}
              listingState={listingState}
            />
          </section>
        )}

        {step === 'listing' && active === 'Run' && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('inspector.section.listing_run', language)}</div>
            <DefList items={[
              { k: 'status', v: listingState.status },
              { k: 'runId',  v: listingState.runId ? shortPath(listingState.runId, 24) : '—' },
              { k: 'lines',  v: String((listingState.lines || []).length) }
            ]} />
            {listingState.status === 'paused' && (
              <div className="inspector__paused-note">
                <p className="inspector__locked-copy">
                  All 8 slots saved. Phase&nbsp;2.5 is waiting for a
                  <code> _cohesion_report.json</code> next to the request.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={onRevealCohesionRequest}
                  disabled={!listingState.cohesionRequestPath || !onRevealCohesionRequest}
                  disabledReason={
                    !listingState.cohesionRequestPath
                      ? 'Request path not captured from logs'
                      : undefined
                  }
                >
                  {t('inspector.action.open_cohesion', language)}
                </Button>
              </div>
            )}
          </section>
        )}

        {step === 'listing' && active === 'Slots' && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('inspector.section.slot_progress', language)}</div>
            <SlotList
              slotStates={slotStates || {}}
              selectedSlots={selectedSlots || new Set()}
              validatorReport={validatorReport}
              onToggleSlot={onToggleSlot}
              disabled={listingState.status === 'running'}
            />
            <SlotSelectionActions
              selectedSlots={selectedSlots || new Set()}
              onSelectAllSlots={onSelectAllSlots}
              onClearSlotSelection={onClearSlotSelection}
            />
          </section>
        )}

        {step === 'listing' && active === 'Timeline' && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('timeline.heading', language)}</div>
            <RunTimeline events={runTimeline} language={language} />
          </section>
        )}

        {step === 'listing' && active === 'QC' && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('inspector.section.output_validator', language)}</div>
            <ValidatorSummary
              report={validatorReport}
              validating={!!validatingOutput}
              onRefresh={onRefreshValidator}
            />
          </section>
        )}

        {step === 'aplus' && active === 'Run' && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('aplus.inspector.run_section', language)}</div>
            <DefList items={[
              { k: 'status', v: aplusState?.status || 'idle' },
              { k: 'runId',  v: aplusState?.runId ? shortPath(aplusState.runId, 24) : '—' },
              { k: 'lines',  v: String((aplusState?.lines || []).length) }
            ]} />
          </section>
        )}

        {step === 'aplus' && active === 'Modules' && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('aplus.inspector.modules_section', language)}</div>
            <ModuleList
              moduleStates={aplusModuleStates || {}}
              selectedModules={selectedModules || new Set()}
              validatorReport={aplusValidatorReport}
              onToggleModule={onToggleModule}
              disabled={aplusState?.status === 'running'}
              language={language}
            />
            <div className="slot-list__actions">
              <button type="button" className="slot-toolbar__link" onClick={onSelectAllModules}>
                {t('aplus.toolbar.select_all', language)}
              </button>
              <button
                type="button"
                className="slot-toolbar__link"
                onClick={onClearModuleSelection}
                disabled={(selectedModules?.size || 0) === 0}
              >
                {t('aplus.toolbar.clear', language)} ({selectedModules?.size || 0})
              </button>
            </div>
          </section>
        )}

        {step === 'aplus' && active === 'QC' && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('aplus.inspector.qc_section', language)}</div>
            <AplusValidatorSummary
              report={aplusValidatorReport}
              validating={!!aplusValidating}
              onRefresh={onRefreshAplusValidator}
              language={language}
            />
          </section>
        )}

        {(step === 'video' || step === 'qc') && (
          <section className="inspector__section">
            <div className="inspector__section-head">{t('inspector.section.step_locked', language)}</div>
            <p className="inspector__locked-copy">
              {lockedReason || 'This step ships in a later phase. Complete Intake and Listing first.'}
            </p>
          </section>
        )}
      </div>

      <div className="inspector__actions">
        {step === 'intake' && (
          <>
            <Button
              variant="primary"
              size="md"
              fullWidth
              leftIcon={<PlayIcon />}
              shortcut="⌘R"
              onClick={onRunListing}
              disabled={!!runDisabledReason}
              disabledReason={runDisabledReason}
            >
              {t('inspector.action.run_listing', language)}
            </Button>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              leftIcon={<RefreshIcon />}
              onClick={onRevalidate}
              disabled={!!revalidateDisabledReason}
              disabledReason={revalidateDisabledReason}
            >
              {t('inspector.action.revalidate', language)}
            </Button>
          </>
        )}

        {step === 'listing' && (() => {
          const regenFn = t('inspector.action.regen_n', language)
          const selCount = selectedSlots ? selectedSlots.size : 0
          const regenLabel = selCount > 0 && typeof regenFn === 'function'
            ? regenFn(selCount)
            : t('inspector.action.regen_selected', language)
          return (
            <>
              <Button
                variant="primary"
                size="md"
                fullWidth
                leftIcon={<PlayIcon />}
                shortcut="⌘R"
                onClick={onRunListing}
                disabled={!!runDisabledReason}
                disabledReason={runDisabledReason}
              >
                {t('inspector.action.run_all_8', language)}
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                leftIcon={<RefreshIcon />}
                onClick={onRunListingRegen}
                disabled={
                  !!runDisabledReason || !selectedSlots || selectedSlots.size === 0
                }
                disabledReason={
                  runDisabledReason
                    || (!selectedSlots || selectedSlots.size === 0
                        ? 'Select one or more slots to regenerate'
                        : undefined)
                }
              >
                {regenLabel}
              </Button>
              <Button
                variant="danger"
                size="md"
                fullWidth
                leftIcon={<StopIcon />}
                shortcut="⌘."
                onClick={onCancelListing}
                disabled={!!cancelDisabledReason}
                disabledReason={cancelDisabledReason}
              >
                {t('inspector.action.cancel', language)}
              </Button>
            </>
          )
        })()}

        {step === 'aplus' && (() => {
          const aplusRegenFn = t('aplus.action.regen_n', language)
          const aplusSelCount = selectedModules ? selectedModules.size : 0
          const aplusRegenLabel = aplusSelCount > 0 && typeof aplusRegenFn === 'function'
            ? aplusRegenFn(aplusSelCount)
            : t('aplus.action.regen_selected', language)
          return (
            <>
              <Button
                variant="primary"
                size="md"
                fullWidth
                leftIcon={<PlayIcon />}
                onClick={onRunAplus}
                disabled={!!runAplusDisabledReason}
                disabledReason={runAplusDisabledReason}
              >
                {t('aplus.action.run_all_5', language)}
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                leftIcon={<RefreshIcon />}
                onClick={onRunAplusRegen}
                disabled={
                  !!runAplusDisabledReason || !selectedModules || selectedModules.size === 0
                }
                disabledReason={
                  runAplusDisabledReason
                    || (!selectedModules || selectedModules.size === 0
                        ? t('aplus.reason.select_modules', language)
                        : undefined)
                }
              >
                {aplusRegenLabel}
              </Button>
              <Button
                variant="danger"
                size="md"
                fullWidth
                leftIcon={<StopIcon />}
                onClick={onCancelAplus}
                disabled={!!cancelAplusDisabledReason}
                disabledReason={cancelAplusDisabledReason}
              >
                {t('inspector.action.cancel', language)}
              </Button>
            </>
          )
        })()}

        {(step === 'video' || step === 'qc') && (
          <Button
            variant="secondary"
            size="md"
            fullWidth
            disabled
            disabledReason={lockedReason || 'Step not wired in phase 1.'}
          >
            {t('inspector.action.locked', language)}
          </Button>
        )}
      </div>
    </div>
  )
}

function briefFields(validation) {
  const b = validation?.brief || {}
  return [
    { k: 'sku',        v: b.sku },
    { k: 'product',    v: b.product_name },
    { k: 'category',   v: b.category },
    { k: 'occasion',   v: b.occasion },
    { k: 'dimensions', v: b.dimensions },
    { k: 'materials',  v: b.materials != null ? String(b.materials) : null },
    { k: 'features',   v: b.features  != null ? String(b.features)  : null }
  ]
}

function BriefHealth({ validation }) {
  const b = validation?.brief || {}
  const items = [
    { k: 'brief.json valid',  ok: !!validation?.ok },
    { k: 'sku id',            ok: !!b.sku },
    { k: 'product name',      ok: !!b.product_name },
    { k: 'category',          ok: !!b.category },
    { k: 'materials (≥1)',    ok: !!(b.materials > 0) },
    { k: 'features (≥1)',     ok: !!(b.features  > 0) },
    { k: 'occasion',          ok: !!b.occasion },
    { k: 'dimensions',        ok: !!b.dimensions }
  ]
  const done = items.filter(i => i.ok).length
  const pct = Math.round((done / items.length) * 100)
  return (
    <>
      <div className="health">
        <div className="health__bar"><div className="health__bar-fill" style={{ width: pct + '%' }} /></div>
        <div className="health__count">{done}/{items.length}</div>
      </div>
      <ul className="health__list">
        {items.map(i => (
          <li key={i.k} className={'health__item' + (i.ok ? ' health__item--ok' : '')}>
            <StatusDot status={i.ok ? 'done' : 'idle'} size="sm" />
            <span className="health__label">{i.k}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function History({ skuPath, validation, validating, listingState }) {
  const events = []
  if (skuPath) {
    events.push({ kind: 'sku', label: 'SKU loaded', detail: lastSegment(skuPath) })
  }
  if (validating) {
    events.push({ kind: 'running', label: 'Validating brief', detail: '—' })
  } else if (validation) {
    events.push({
      kind: validation.ok ? 'ok' : 'err',
      label: validation.ok ? 'Brief validated' : 'Validation failed',
      detail: validation.ok ? 'all checks passed' : (validation.error || 'invalid')
    })
  }
  if (listingState?.runId) {
    const kind = listingState.status === 'ok'
      ? 'ok'
      : listingState.status === 'paused'
        ? 'paused'
        : listingState.status === 'err' || listingState.status === 'cancelled'
          ? 'err'
          : 'running'
    const label = listingState.status === 'paused'
      ? 'Listing run paused for cohesion review'
      : `Listing run ${listingState.status}`
    events.push({ kind, label, detail: listingState.runId })
  }

  if (!events.length) {
    return <p className="inspector__locked-copy">No activity yet. Pick a SKU to populate history.</p>
  }

  return (
    <ul className="history">
      {events.map((e, i) => (
        <li key={i} className={'history__row history__row--' + e.kind}>
          <StatusDot
            status={
              e.kind === 'ok' ? 'done'
                : e.kind === 'err' ? 'error'
                : e.kind === 'running' ? 'running'
                : e.kind === 'paused' ? 'warning'
                : 'idle'
            }
            size="sm"
          />
          <span className="history__label">{e.label}</span>
          <span className="history__detail" title={e.detail}>{e.detail}</span>
        </li>
      ))}
    </ul>
  )
}

function SlotList({ slotStates, selectedSlots, validatorReport, onToggleSlot, disabled }) {
  const validatorByslot = React.useMemo(() => {
    const map = {}
    for (const s of validatorReport?.slots || []) map[s.slot] = s
    return map
  }, [validatorReport])

  return (
    <ul className="slot-list">
      {LISTING_SLOT_META.map(s => {
        const state = slotStates[s.id] || 'idle'
        const selected = selectedSlots.has(s.id)
        const v = validatorByslot[s.id]
        return (
          <li key={s.id} className={'slot-list__row slot-list__row--' + state}>
            <label className="slot-list__check">
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => onToggleSlot && onToggleSlot(s.id)}
              />
              <span className="slot-list__check-box" aria-hidden="true" />
            </label>
            <span className="slot-list__no">{String(s.id).padStart(2, '0')}</span>
            <span className="slot-list__role">{s.role}</span>
            <span className="slot-list__state">{slotWord(state)}</span>
            <span className={'slot-list__qc slot-list__qc--' + (v ? validatorTone(v) : 'none')}>
              {v ? validatorChip(v) : '—'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function SlotSelectionActions({ selectedSlots, onSelectAllSlots, onClearSlotSelection }) {
  const count = selectedSlots.size
  return (
    <div className="slot-list__actions">
      <button type="button" className="slot-toolbar__link" onClick={onSelectAllSlots}>Select all</button>
      <button
        type="button"
        className="slot-toolbar__link"
        onClick={onClearSlotSelection}
        disabled={count === 0}
      >
        Clear ({count})
      </button>
    </div>
  )
}

function ValidatorSummary({ report, validating, onRefresh }) {
  const summary = report?.summary
  return (
    <>
      <div className="qc-summary-head">
        <StatusChip
          status={summary ? (report.ok ? 'complete' : 'needs-fix') : 'idle'}
          size="sm"
        >
          {summary ? (report.ok ? 'Pass' : 'Issues') : 'No data'}
        </StatusChip>
        <button
          type="button"
          className="slot-toolbar__link"
          onClick={onRefresh}
          disabled={validating}
        >
          {validating ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      {!summary && !report?.error && (
        <p className="inspector__locked-copy">
          Run listing or click <em>Re-check</em> to validate <code>output/listing/</code>.
        </p>
      )}

      {report?.error && (
        <p className="inspector__locked-copy">Validator error: {report.error}</p>
      )}

      {summary && (
        <ul className="qc-checklist">
          <li className={'qc-row qc-row--' + (summary.missing === 0 ? 'ok' : 'bad')}>
            <span className="qc-row__icon" aria-hidden="true">{summary.missing === 0 ? '✓' : '✕'}</span>
            <span className="qc-row__label">8 files present</span>
            <span className="qc-row__detail">{summary.found}/8</span>
          </li>
          <li className={'qc-row qc-row--' + (summary.dimsBad === 0
              ? (summary.dimsUnchecked > 0 ? 'unknown' : 'ok')
              : 'bad')}>
            <span className="qc-row__icon" aria-hidden="true">
              {summary.dimsBad === 0
                ? (summary.dimsUnchecked > 0 ? '?' : '✓')
                : '✕'}
            </span>
            <span className="qc-row__label">2000×2000</span>
            <span className="qc-row__detail">
              {summary.sharpAvailable
                ? `${summary.dimsOk}/${summary.dimsOk + summary.dimsBad + summary.dimsUnchecked}`
                : 'unchecked'}
            </span>
          </li>
          {!summary.sharpAvailable && (
            <li className="qc-row qc-row--info">
              <span className="qc-row__icon" aria-hidden="true">·</span>
              <span className="qc-row__label">sharp unavailable</span>
              <span className="qc-row__detail">dimensions skipped</span>
            </li>
          )}
        </ul>
      )}
    </>
  )
}

function slotWord(state) {
  switch (state) {
    case 'done':    return 'done'
    case 'running': return 'live'
    case 'error':   return 'failed'
    case 'skipped': return 'skipped'
    default:        return 'pending'
  }
}

function ModuleList({ moduleStates, selectedModules, validatorReport, onToggleModule, disabled, language }) {
  const validatorByModule = React.useMemo(() => {
    const map = {}
    for (const m of validatorReport?.modules || []) map[m.module] = m
    return map
  }, [validatorReport])

  return (
    <ul className="slot-list">
      {APLUS_MODULE_META.map(mod => {
        const state = moduleStates[mod.id] || 'idle'
        const selected = selectedModules.has(mod.id)
        const v = validatorByModule[mod.id]
        return (
          <li key={mod.id} className={'slot-list__row slot-list__row--' + state}>
            <label className="slot-list__check">
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => onToggleModule && onToggleModule(mod.id)}
              />
              <span className="slot-list__check-box" aria-hidden="true" />
            </label>
            <span className="slot-list__no">{String(mod.id).padStart(2, '0')}</span>
            <span className="slot-list__role">{mod.role}</span>
            <span className="slot-list__state">{t('aplus.module.state.' + state, language)}</span>
            <span className={'slot-list__qc slot-list__qc--' + (v ? validatorTone(v) : 'none')}>
              {v ? validatorChip(v) : '—'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function AplusValidatorSummary({ report, validating, onRefresh, language }) {
  const summary = report?.summary
  return (
    <>
      <div className="qc-summary-head">
        <StatusChip
          status={summary ? (report.ok ? 'complete' : 'needs-fix') : 'idle'}
          size="sm"
        >
          {summary
            ? (report.ok ? t('aplus.qc.status_pass', language) : t('aplus.qc.status_issues', language))
            : t('aplus.qc.status_nodata', language)}
        </StatusChip>
        <button
          type="button"
          className="slot-toolbar__link"
          onClick={onRefresh}
          disabled={validating}
        >
          {validating ? t('aplus.validator.checking', language) : t('aplus.validator.recheck', language)}
        </button>
      </div>

      {!summary && !report?.error && (
        <p className="inspector__locked-copy">
          {t('aplus.validator.no_report', language)}
        </p>
      )}

      {report?.error && (
        <p className="inspector__locked-copy">Validator error: {report.error}</p>
      )}

      {summary && (
        <ul className="qc-checklist">
          <li className={'qc-row qc-row--' + (summary.missing === 0 ? 'ok' : 'bad')}>
            <span className="qc-row__icon" aria-hidden="true">{summary.missing === 0 ? '✓' : '✕'}</span>
            <span className="qc-row__label">5 files present</span>
            <span className="qc-row__detail">{summary.found}/5</span>
          </li>
          <li className={'qc-row qc-row--' + (summary.dimsBad === 0
              ? (summary.dimsUnchecked > 0 ? 'unknown' : 'ok')
              : 'bad')}>
            <span className="qc-row__icon" aria-hidden="true">
              {summary.dimsBad === 0
                ? (summary.dimsUnchecked > 0 ? '?' : '✓')
                : '✕'}
            </span>
            <span className="qc-row__label">{summary.expectedWidth}×{summary.expectedHeight}</span>
            <span className="qc-row__detail">
              {summary.sharpAvailable
                ? `${summary.dimsOk}/${summary.dimsOk + summary.dimsBad + summary.dimsUnchecked}`
                : 'unchecked'}
            </span>
          </li>
          {!summary.sharpAvailable && (
            <li className="qc-row qc-row--info">
              <span className="qc-row__icon" aria-hidden="true">·</span>
              <span className="qc-row__label">sharp unavailable</span>
              <span className="qc-row__detail">dimensions skipped</span>
            </li>
          )}
        </ul>
      )}
    </>
  )
}

function validatorTone(v) {
  if (!v.exists) return 'bad'
  if (v.dimensionsOk === true) return 'ok'
  if (v.dimensionsOk === false) return 'bad'
  return 'unknown'
}

function validatorChip(v) {
  if (!v.exists) return 'missing'
  if (v.dimensionsOk === true) return `${v.width}×${v.height}`
  if (v.dimensionsOk === false) return `${v.width ?? '?'}×${v.height ?? '?'}`
  return '·'
}

function DefList({ items }) {
  return (
    <dl className="deflist">
      {items.map(({ k, v }) => (
        <div className="deflist__row" key={k}>
          <dt className="deflist__k">{k}</dt>
          <dd className="deflist__v">{v ? v : <span className="muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

function shortPath(p, max) {
  if (!p || p.length <= max) return p
  return '…' + p.slice(-(max - 1))
}

function lastSegment(p) {
  if (!p) return ''
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || p
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 3v10l9-5z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
      <rect x="4" y="4" width="8" height="8" rx="1" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 8a5 5 0 1 1 1.5 3.5" strokeLinecap="round" />
      <polyline points="3 12 3.5 11 5 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
