import React from 'react'
import Button from '../atoms/Button.jsx'
import StatusChip from '../atoms/StatusChip.jsx'
import StatusDot from '../atoms/StatusDot.jsx'

const TABS_BY_STEP = {
  intake:  ['Brief', 'Health'],
  listing: ['Run', 'Slots'],
  aplus:   ['Plan'],
  video:   ['Plan'],
  qc:      ['Plan']
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
  onCancelListing,
  runDisabledReason,
  cancelDisabledReason,
  revalidateDisabledReason
}) {
  const tabs = TABS_BY_STEP[step] || ['Detail']
  const [active, setActive] = React.useState(tabs[0])
  React.useEffect(() => { setActive(tabs[0]) }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const skuName = skuPath ? lastSegment(skuPath) : null

  return (
    <div className="inspector">
      <div className="inspector__tabs" role="tablist">
        {tabs.map(t => (
          <button
            type="button"
            key={t}
            role="tab"
            aria-selected={active === t}
            className={'inspector__tab' + (active === t ? ' inspector__tab--active' : '')}
            onClick={() => setActive(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="inspector__scroll">
        <section className="inspector__section">
          <div className="inspector__section-head">Current SKU</div>
          <div className="inspector__sku">
            <span className="inspector__sku-name">{skuName || <span className="muted">none</span>}</span>
            <StatusChip
              status={validating ? 'running' : (validation?.ok ? 'ready' : (skuPath ? 'needs-fix' : 'idle'))}
              size="sm"
            />
          </div>
          {skuPath && <div className="inspector__sku-path" title={skuPath}>{shortPath(skuPath, 36)}</div>}
        </section>

        {step === 'intake' && (
          <>
            <section className="inspector__section">
              <div className="inspector__section-head">Brief health</div>
              <BriefHealth validation={validation} />
            </section>

            {active === 'Brief' && (
              <section className="inspector__section">
                <div className="inspector__section-head">Brief fields</div>
                <DefList items={briefFields(validation)} />
              </section>
            )}
          </>
        )}

        {step === 'listing' && (
          <section className="inspector__section">
            <div className="inspector__section-head">Listing run</div>
            <DefList items={[
              { k: 'status', v: listingState.status },
              { k: 'runId',  v: listingState.runId ? shortPath(listingState.runId, 24) : '—' },
              { k: 'lines',  v: String((listingState.lines || []).length) }
            ]} />
          </section>
        )}

        {(step === 'aplus' || step === 'video' || step === 'qc') && (
          <section className="inspector__section">
            <div className="inspector__section-head">Step locked</div>
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
              Run listing
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
              Re-validate brief
            </Button>
          </>
        )}

        {step === 'listing' && (
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
              Run listing
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
              Cancel run
            </Button>
          </>
        )}

        {(step === 'aplus' || step === 'video' || step === 'qc') && (
          <Button
            variant="secondary"
            size="md"
            fullWidth
            disabled
            disabledReason={lockedReason || 'Step not wired in phase 1.'}
          >
            Locked
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
