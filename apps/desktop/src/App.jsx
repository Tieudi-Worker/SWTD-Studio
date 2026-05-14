import React, { useEffect, useMemo, useRef, useState } from 'react'

const TABS = [
  { id: 'project',  idx: '01', label: 'Project' },
  { id: 'listing',  idx: '02', label: 'Listing' },
  { id: 'aplus',    idx: '03', label: 'A+' },
  { id: 'video',    idx: '04', label: 'Video' },
  { id: 'qc',       idx: '05', label: 'QC' },
  { id: 'settings', idx: '06', label: 'Settings' }
]

const PIPELINE_STAGES = [
  { id: 'intake',  no: '01', label: 'INTAKE',  detail: 'brief.json' },
  { id: 'listing', no: '02', label: 'LISTING', detail: '8 slots' },
  { id: 'aplus',   no: '03', label: 'A+',      detail: '5 modules' },
  { id: 'video',   no: '04', label: 'VIDEO',   detail: '12–15s' },
  { id: 'qc',      no: '05', label: 'QC',      detail: 'bundle' }
]

const api = typeof window !== 'undefined' ? window.swtd : undefined

export default function App() {
  const [tab, setTab] = useState('project')
  const [workspace, setWorkspace] = useState('')
  const [skuPath, setSkuPath] = useState('')
  const [validation, setValidation] = useState(null)
  const [validating, setValidating] = useState(false)
  const [skus, setSkus] = useState([])
  const [filter, setFilter] = useState('')

  const [listingState, setListingState] = useState({
    runId: null,
    status: 'idle',
    lines: []
  })

  useEffect(() => {
    if (!api?.onPipelineEvent) return
    return api.onPipelineEvent((evt) => {
      setListingState(prev => {
        if (evt.kind === 'start') {
          return {
            runId: evt.runId,
            status: 'running',
            lines: [{
              stream: 'sys',
              line: `▸ start ${evt.bin}  ${evt.skuPath}  ${(evt.extraArgs || []).join(' ')}`.trim(),
              ts: evt.ts
            }]
          }
        }
        if (evt.kind === 'log') {
          const trimmed = prev.lines.length > 4000 ? prev.lines.slice(-3000) : prev.lines
          return { ...prev, lines: [...trimmed, { stream: evt.stream, line: evt.line, ts: evt.ts }] }
        }
        if (evt.kind === 'end') {
          const status = evt.aborted ? 'cancelled' : (evt.ok ? 'ok' : 'err')
          return {
            ...prev,
            status,
            lines: [...prev.lines, {
              stream: 'sys',
              line: `▸ end  code=${evt.code}  aborted=${evt.aborted ? 'yes' : 'no'}`,
              ts: evt.ts
            }]
          }
        }
        if (evt.kind === 'error') {
          return {
            ...prev,
            status: 'err',
            lines: [...prev.lines, { stream: 'stderr', line: `[ipc-error] ${evt.message}`, ts: evt.ts }]
          }
        }
        return prev
      })
    })
  }, [])

  async function pickWorkspace() {
    if (!api) return
    const res = await api.pickFolder({ title: 'Select project workspace' })
    if (!res?.canceled && res?.path) {
      setWorkspace(res.path)
      const list = await api.listSkus(res.path)
      setSkus(list?.items || [])
    }
  }

  async function refreshSkus() {
    if (!api || !workspace) return
    const list = await api.listSkus(workspace)
    setSkus(list?.items || [])
  }

  async function chooseSku(target) {
    if (!target) return
    setSkuPath(target)
    if (!api) return
    setValidating(true)
    try {
      const v = await api.validateSku(target)
      setValidation(v)
    } finally {
      setValidating(false)
    }
  }

  async function revalidate() {
    if (!api || !skuPath) return
    setValidating(true)
    try {
      const v = await api.validateSku(skuPath)
      setValidation(v)
    } finally {
      setValidating(false)
    }
  }

  async function runListing() {
    if (!api || !skuPath || !validation?.ok || listingState.status === 'running') return
    setListingState({ runId: null, status: 'running', lines: [] })
    setTab('listing')
    const res = await api.runListing({ skuPath })
    if (!res?.ok) {
      setListingState({
        runId: null,
        status: 'err',
        lines: [{ stream: 'stderr', line: `[start failed] ${res?.error || 'unknown'}`, ts: Date.now() }]
      })
    }
  }

  async function cancelListing() {
    if (!api || !listingState.runId) return
    await api.cancelPipeline(listingState.runId)
  }

  const filteredSkus = useMemo(() => {
    if (!filter) return skus
    const q = filter.toLowerCase()
    return skus.filter(s => s.name.toLowerCase().includes(q))
  }, [skus, filter])

  const stageStatuses = useMemo(() => ({
    intake:  validating ? 'running' : (validation?.ok ? 'ok' : (skuPath ? 'warn' : 'idle')),
    listing: listingState.status,
    aplus:   'locked',
    video:   'locked',
    qc:      'locked'
  }), [validation, validating, skuPath, listingState.status])

  const ready = !!(skuPath && validation?.ok)
  const running = listingState.status === 'running'

  return (
    <div className="studio">
      <Topbar
        tab={tab}
        setTab={setTab}
        workspace={workspace}
        skuPath={skuPath}
        runStatus={listingState.status}
        pickWorkspace={pickWorkspace}
      />

      <aside className="leftrail">
        <SkuRail
          workspace={workspace}
          skus={filteredSkus}
          totalSkus={skus.length}
          filter={filter}
          setFilter={setFilter}
          skuPath={skuPath}
          chooseSku={chooseSku}
          pickWorkspace={pickWorkspace}
          refreshSkus={refreshSkus}
        />
      </aside>

      <main className="canvas">
        <PipelineStrip stages={PIPELINE_STAGES} statuses={stageStatuses} activeTab={tab} setTab={setTab} />

        <div className="canvas-body">
          {tab === 'project'  && <ProjectView skuPath={skuPath} validation={validation} validating={validating} workspace={workspace} skus={skus} />}
          {tab === 'listing'  && <ListingView skuPath={skuPath} validation={validation} listingState={listingState} />}
          {tab === 'aplus'    && <PlaceholderView kind="aplus" />}
          {tab === 'video'    && <PlaceholderView kind="video" />}
          {tab === 'qc'       && <PlaceholderView kind="qc" />}
          {tab === 'settings' && <PlaceholderView kind="settings" />}
        </div>
      </main>

      <aside className="rightrail">
        <ControlRail
          skuPath={skuPath}
          validation={validation}
          validating={validating}
          listingState={listingState}
          ready={ready}
          running={running}
          revalidate={revalidate}
          runListing={runListing}
          cancelListing={cancelListing}
        />
      </aside>
    </div>
  )
}

/* ───────────────────────────────────────────────────────────── */
/* Topbar                                                        */
/* ───────────────────────────────────────────────────────────── */

function Topbar({ tab, setTab, workspace, skuPath, runStatus, pickWorkspace }) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="brand-mark">◐</div>
        <div className="brand-text">
          <span className="brand-name">SWTD STUDIO</span>
          <span className="brand-sub">Amazon Media Console · v0.1.0</span>
        </div>
      </div>

      <button className="workspace-pill" onClick={pickWorkspace} title="Change workspace">
        <span className="pill-key">WORKSPACE</span>
        <span className="pill-val">{workspace ? truncate(workspace, 48) : 'no workspace selected'}</span>
        <span className="pill-caret">⌄</span>
      </button>

      <nav className="topbar-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={'tab' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-no">{t.idx}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="topbar-status">
        <span className="status-key">RUNNER</span>
        <StatusBadge status={runStatus} compact />
      </div>
    </header>
  )
}

/* ───────────────────────────────────────────────────────────── */
/* Left rail — SKU list                                          */
/* ───────────────────────────────────────────────────────────── */

function SkuRail({
  workspace, skus, totalSkus, filter, setFilter, skuPath, chooseSku, pickWorkspace, refreshSkus
}) {
  return (
    <>
      <div className="rail-section">
        <div className="rail-head">
          <span className="rail-title">Workspace</span>
          <button className="iconbtn" onClick={pickWorkspace} title="Pick workspace">⤓</button>
        </div>
        <div className="rail-path">
          {workspace ? truncate(workspace, 36) : <span className="muted">— select to begin —</span>}
        </div>
      </div>

      <div className="rail-section grow">
        <div className="rail-head">
          <span className="rail-title">SKUs</span>
          <span className="rail-count">{skus.length}/{totalSkus}</span>
        </div>

        <div className="rail-filter">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter…"
            disabled={!workspace}
          />
          <button className="iconbtn" onClick={refreshSkus} disabled={!workspace} title="Refresh">↻</button>
        </div>

        <div className="rail-list">
          {!workspace && (
            <div className="rail-empty">Pick a workspace folder to discover SKUs.</div>
          )}
          {workspace && skus.length === 0 && (
            <div className="rail-empty">No SKU folders found.</div>
          )}
          {skus.map(s => {
            const active = s.path === skuPath
            return (
              <button
                key={s.path}
                className={'sku-row' + (active ? ' active' : '')}
                onClick={() => chooseSku(s.path)}
              >
                <span className={'sku-dot ' + (s.hasBrief ? 'ok' : 'warn')} />
                <span className="sku-name">{s.name}</span>
                <span className="sku-flag">{s.hasBrief ? 'BRIEF' : '—'}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rail-foot">
        <span>phase 1 · listing only</span>
      </div>
    </>
  )
}

/* ───────────────────────────────────────────────────────────── */
/* Pipeline strip                                                */
/* ───────────────────────────────────────────────────────────── */

const STAGE_TO_TAB = {
  intake: 'project',
  listing: 'listing',
  aplus: 'aplus',
  video: 'video',
  qc: 'qc'
}

function PipelineStrip({ stages, statuses, activeTab, setTab }) {
  return (
    <div className="pipestrip">
      {stages.map((s, i) => {
        const status = statuses[s.id] || 'idle'
        const isActive = STAGE_TO_TAB[s.id] === activeTab
        return (
          <React.Fragment key={s.id}>
            <button
              className={'pipestage status-' + status + (isActive ? ' active' : '')}
              onClick={() => setTab(STAGE_TO_TAB[s.id])}
            >
              <div className="pipestage-head">
                <span className="pipestage-no">{s.no}</span>
                <StageDot status={status} />
              </div>
              <div className="pipestage-label">{s.label}</div>
              <div className="pipestage-detail">{s.detail}</div>
              <div className="pipestage-state">{stageWord(status)}</div>
            </button>
            {i < stages.length - 1 && <div className={'pipeline-arrow ' + (status === 'ok' ? 'on' : '')} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function StageDot({ status }) {
  return <span className={'stage-dot stage-' + status} />
}

function stageWord(status) {
  switch (status) {
    case 'ok':        return 'ready'
    case 'running':   return 'live'
    case 'err':       return 'failed'
    case 'warn':      return 'invalid'
    case 'cancelled': return 'cancelled'
    case 'locked':    return 'locked'
    default:          return 'idle'
  }
}

/* ───────────────────────────────────────────────────────────── */
/* Project view (center)                                         */
/* ───────────────────────────────────────────────────────────── */

function ProjectView({ skuPath, validation, validating, workspace, skus }) {
  const briefFields = [
    { k: 'SKU',         v: validation?.brief?.sku },
    { k: 'Product',     v: validation?.brief?.product_name },
    { k: 'Category',    v: validation?.brief?.category },
    { k: 'Occasion',    v: validation?.brief?.occasion },
    { k: 'Dimensions',  v: validation?.brief?.dimensions },
    { k: 'Materials',   v: validation?.brief?.materials != null ? `${validation.brief.materials} listed` : null },
    { k: 'Features',    v: validation?.brief?.features  != null ? `${validation.brief.features} listed`  : null }
  ]

  const skuName = skuPath ? skuPath.split(/[\\/]/).filter(Boolean).pop() : null

  return (
    <>
      <SectionHeader
        kicker="01 · INTAKE"
        title="Project & brief"
        meta={skuName ? `target · ${skuName}` : `workspace · ${truncate(workspace, 48) || '—'}`}
      />

      {!skuPath && (
        <div className="emptystate">
          <div className="emptystate-mark">SKU</div>
          <div className="emptystate-title">Select a SKU from the rail</div>
          <div className="emptystate-body">
            {workspace
              ? `${skus.length} SKU folder${skus.length === 1 ? '' : 's'} discovered. Click one in the left rail to load its brief.`
              : 'Pick a workspace first using the top bar or left rail.'}
          </div>
        </div>
      )}

      {skuPath && (
        <>
          <div className="cardgrid two">
            <div className="card">
              <div className="card-head">
                <span className="card-title">Brief snapshot</span>
                <span className="card-meta">
                  {validating
                    ? 'validating…'
                    : validation?.ok
                      ? 'brief.json · parsed'
                      : 'brief missing or invalid'}
                </span>
              </div>
              {validation?.ok && validation.brief ? (
                <div className="brief-grid">
                  {briefFields.map(f => <BriefCell key={f.k} k={f.k} v={f.v} />)}
                </div>
              ) : (
                <div className="card-err">
                  {validation?.error || 'No parsed brief yet. Re-validate from the right control panel.'}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-head">
                <span className="card-title">Asset requirements</span>
                <span className="card-meta">phase 1 · listing</span>
              </div>
              <Checklist validation={validation} />
            </div>
          </div>

          <div className="card span">
            <div className="card-head">
              <span className="card-title">Path</span>
              <span className="card-meta">click rows to copy</span>
            </div>
            <div className="pathblock">
              <PathRow k="workspace" v={workspace} />
              <PathRow k="sku" v={skuPath} />
              <PathRow k="brief" v={skuPath ? skuPath + '/brief.json' : ''} />
            </div>
          </div>
        </>
      )}
    </>
  )
}

function PathRow({ k, v }) {
  function copy() {
    if (!v) return
    try { navigator.clipboard?.writeText(v) } catch {}
  }
  return (
    <button className="path-row" onClick={copy} disabled={!v}>
      <span className="path-k">{k}</span>
      <span className="path-v">{v || <span className="muted">—</span>}</span>
      <span className="path-copy">copy</span>
    </button>
  )
}

function Checklist({ validation }) {
  const items = [
    { k: 'brief.json',         ok: !!validation?.ok },
    { k: 'sku id',             ok: !!validation?.brief?.sku },
    { k: 'product name',       ok: !!validation?.brief?.product_name },
    { k: 'category',           ok: !!validation?.brief?.category },
    { k: 'materials (≥1)',     ok: !!(validation?.brief?.materials > 0) },
    { k: 'features (≥1)',      ok: !!(validation?.brief?.features  > 0) },
    { k: 'occasion',           ok: !!validation?.brief?.occasion },
    { k: 'dimensions',         ok: !!validation?.brief?.dimensions }
  ]
  const total = items.length
  const done = items.filter(i => i.ok).length
  return (
    <>
      <div className="checklist-summary">
        <div className="bar"><div className="bar-fill" style={{ width: `${(done / total) * 100}%` }} /></div>
        <div className="checklist-count">{done}/{total} ready</div>
      </div>
      <ul className="checklist">
        {items.map(i => (
          <li key={i.k} className={i.ok ? 'ok' : 'pending'}>
            <span className="check-mark">{i.ok ? '✓' : '·'}</span>
            <span className="check-label">{i.k}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function BriefCell({ k, v }) {
  return (
    <div className="brief-cell">
      <div className="k">{k}</div>
      <div className="v">{v || <span className="muted">—</span>}</div>
    </div>
  )
}

/* ───────────────────────────────────────────────────────────── */
/* Listing view (center)                                         */
/* ───────────────────────────────────────────────────────────── */

const LISTING_SLOTS = [
  { id: 1, label: 'Title' },
  { id: 2, label: 'Bullet 1' },
  { id: 3, label: 'Bullet 2' },
  { id: 4, label: 'Bullet 3' },
  { id: 5, label: 'Bullet 4' },
  { id: 6, label: 'Bullet 5' },
  { id: 7, label: 'Description' },
  { id: 8, label: 'Search Terms' }
]

function ListingView({ skuPath, validation, listingState }) {
  const bodyRef = useRef(null)
  const { lines, status } = listingState

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [lines])

  const slotState = useMemo(() => deriveSlotState(lines), [lines])
  const ready = !!(skuPath && validation?.ok)
  const skuName = skuPath ? skuPath.split(/[\\/]/).filter(Boolean).pop() : '—'

  return (
    <>
      <SectionHeader
        kicker="02 · LISTING"
        title="8-slot pipeline"
        meta={ready ? `target · ${skuName}` : 'select & validate a SKU first'}
      />

      <div className="card span">
        <div className="card-head">
          <span className="card-title">Slots</span>
          <span className="card-meta">runtime/bin/listing.mjs</span>
        </div>
        <div className="slotgrid">
          {LISTING_SLOTS.map(s => {
            const st = slotState[s.id] || 'idle'
            return (
              <div key={s.id} className={'slot status-' + st}>
                <div className="slot-no">{String(s.id).padStart(2, '0')}</div>
                <div className="slot-label">{s.label}</div>
                <div className="slot-state">{slotWord(st)}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card span console-card">
        <div className="card-head">
          <span className="card-title">Process log</span>
          <span className="card-meta">
            stdout · stderr · {lines.length} line{lines.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="console-body" ref={bodyRef}>
          {lines.length === 0 && (
            <span className="empty">
              No output yet. Use the right panel to run the pipeline.
            </span>
          )}
          {lines.map((l, i) => (
            <span key={i} className={'console-line ' + lineClass(l.stream)}>
              <span className="ts">{fmtTs(l.ts)}</span>
              <span className="stream">{(l.stream || '   ').padEnd(6).slice(0, 6)}</span>
              {l.line}
            </span>
          ))}
          {status === 'running' && <span className="console-cursor" />}
        </div>
      </div>
    </>
  )
}

function slotWord(status) {
  switch (status) {
    case 'ok':      return 'done'
    case 'running': return 'live'
    case 'err':     return 'failed'
    case 'skip':    return 'skipped'
    default:        return 'pending'
  }
}

function deriveSlotState(lines) {
  const state = {}
  for (const l of lines) {
    const m = l.line && l.line.match(/slot[\s_-]*(\d+)/i)
    if (!m) continue
    const id = parseInt(m[1], 10)
    if (id < 1 || id > 8) continue
    if (/skip/i.test(l.line))        state[id] = 'skip'
    else if (/fail|error/i.test(l.line)) state[id] = 'err'
    else if (/done|ok|complete/i.test(l.line)) state[id] = 'ok'
    else state[id] = 'running'
  }
  return state
}

/* ───────────────────────────────────────────────────────────── */
/* Right rail — control panel                                    */
/* ───────────────────────────────────────────────────────────── */

function ControlRail({
  skuPath, validation, validating, listingState,
  ready, running, revalidate, runListing, cancelListing
}) {
  const skuName = skuPath ? skuPath.split(/[\\/]/).filter(Boolean).pop() : null

  return (
    <>
      <div className="rail-section">
        <div className="rail-head">
          <span className="rail-title">Current SKU</span>
          <StatusBadge status={validating ? 'running' : (validation?.ok ? 'ok' : (skuPath ? 'warn' : 'idle'))} compact />
        </div>
        <div className="current-sku">
          <div className="current-sku-name">{skuName || <span className="muted">none selected</span>}</div>
          <div className="current-sku-path">{skuPath ? truncate(skuPath, 38) : <span className="muted">pick from rail</span>}</div>
        </div>
      </div>

      <div className="rail-section">
        <div className="rail-head"><span className="rail-title">Brief</span></div>
        {validation?.ok && validation.brief ? (
          <div className="kv-list">
            <KV k="sku" v={validation.brief.sku} />
            <KV k="product" v={validation.brief.product_name} />
            <KV k="category" v={validation.brief.category} />
            <KV k="materials" v={validation.brief.materials != null ? String(validation.brief.materials) : null} />
            <KV k="features" v={validation.brief.features != null ? String(validation.brief.features) : null} />
          </div>
        ) : (
          <div className="rail-empty small">
            {validation?.error || (skuPath ? 'Not validated yet.' : '—')}
          </div>
        )}
      </div>

      <div className="rail-section">
        <div className="rail-head"><span className="rail-title">Listing run</span></div>
        <div className="kv-list">
          <KV k="status" v={statusWord(listingState.status)} />
          <KV k="runId"  v={listingState.runId ? truncate(listingState.runId, 28) : '—'} />
          <KV k="lines"  v={String(listingState.lines.length)} />
        </div>
      </div>

      <div className="rail-section actions">
        <div className="rail-head"><span className="rail-title">Actions</span></div>
        <button
          className="bigbtn primary"
          onClick={runListing}
          disabled={!ready || running}
        >
          <span className="bigbtn-icon">▶</span>
          <span className="bigbtn-label">RUN LISTING</span>
          <span className="bigbtn-sub">{ready ? '8 slots · streaming logs' : 'select & validate a SKU'}</span>
        </button>
        <button
          className="bigbtn danger"
          onClick={cancelListing}
          disabled={!running}
        >
          <span className="bigbtn-icon">■</span>
          <span className="bigbtn-label">CANCEL</span>
          <span className="bigbtn-sub">abort current run</span>
        </button>
        <button
          className="bigbtn ghost"
          onClick={revalidate}
          disabled={!skuPath || validating}
        >
          <span className="bigbtn-icon">↻</span>
          <span className="bigbtn-label">RE-VALIDATE</span>
          <span className="bigbtn-sub">re-read brief.json</span>
        </button>
      </div>

      <div className="rail-foot">
        <span>{ready ? 'all systems go' : 'awaiting input'}</span>
        <span className={'pulse-dot ' + (running ? 'on' : 'off')} />
      </div>
    </>
  )
}

function KV({ k, v }) {
  return (
    <div className="kv">
      <span className="kv-k">{k}</span>
      <span className="kv-v">{v || <span className="muted">—</span>}</span>
    </div>
  )
}

function statusWord(s) {
  switch (s) {
    case 'running':   return 'running'
    case 'ok':        return 'completed'
    case 'err':       return 'failed'
    case 'cancelled': return 'cancelled'
    default:          return 'idle'
  }
}

/* ───────────────────────────────────────────────────────────── */
/* Placeholder view                                              */
/* ───────────────────────────────────────────────────────────── */

const PLACEHOLDER_COPY = {
  aplus: {
    kicker: '03 · A+',
    title:  'A+ Premium · 5 modules',
    body:   'Wires up to runtime/bin/aplus.mjs in a later phase. Single & multi-ASIN plans. M1–M5 at 1464×600.',
    roadmap: ['module M1 · hero', 'M2–M4 · feature deck', 'M5 · comparison / CTA', 'multi-ASIN child fan-out']
  },
  video: {
    kicker: '04 · VIDEO',
    title:  'Product video · 12–15s',
    body:   'Storyboard generator + Kling 3.0 producer call. Output 1920×1080 MP4. Not wired in phase 1.',
    roadmap: ['storyboard.json', 'shot prompt synthesis', 'KIE video call', 'mux + delivery']
  },
  qc: {
    kicker: '05 · QC',
    title:  'QC & export bundle',
    body:   'Cohesion report, doctrine compliance, and ZIP export of the publish-ready bundle.',
    roadmap: ['cohesion_report.json', 'doctrine pass/fail', 'rename & bundle']
  },
  settings: {
    kicker: '06 · SETTINGS',
    title:  'Settings & integrations',
    body:   'API keys, model routing, output paths, and theme. Reads from local config only — no secrets in repo.',
    roadmap: ['KIE_KEY (env)', 'output target dir', 'theme & font']
  }
}

function PlaceholderView({ kind }) {
  const c = PLACEHOLDER_COPY[kind]
  if (!c) return null
  return (
    <>
      <SectionHeader kicker={c.kicker} title={c.title} meta="not wired · phase 1" />
      <div className="card span placeholder">
        <div className="placeholder-body">{c.body}</div>
        <div className="placeholder-grid">
          {c.roadmap.map((r, i) => (
            <div key={i} className="placeholder-cell">
              <span className="placeholder-no">{String(i + 1).padStart(2, '0')}</span>
              <span className="placeholder-label">{r}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ───────────────────────────────────────────────────────────── */
/* Shared bits                                                   */
/* ───────────────────────────────────────────────────────────── */

function SectionHeader({ kicker, title, meta }) {
  return (
    <header className="sectionhead">
      <div className="sectionhead-left">
        <div className="sectionhead-kicker">{kicker}</div>
        <h1 className="sectionhead-title">{title}</h1>
      </div>
      {meta && <div className="sectionhead-meta">{meta}</div>}
    </header>
  )
}

function StatusBadge({ status, compact }) {
  const map = {
    running:   { kind: 'running',   label: 'RUNNING' },
    ok:        { kind: 'ok',        label: 'READY' },
    err:       { kind: 'err',       label: 'FAILED' },
    warn:      { kind: 'warn',      label: 'INVALID' },
    cancelled: { kind: 'warn',      label: 'CANCELLED' },
    locked:    { kind: 'locked',    label: 'LOCKED' },
    idle:      { kind: 'idle',      label: 'IDLE' }
  }
  const m = map[status] || map.idle
  return (
    <span className={'badge ' + m.kind + (compact ? ' compact' : '')}>
      <span className="dot" />
      {m.label}
    </span>
  )
}

function lineClass(stream) {
  if (stream === 'stderr') return 'err'
  if (stream === 'sys')    return 'sys'
  return ''
}

function fmtTs(ts) {
  if (!ts) return '            '
  const d = new Date(ts)
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function truncate(str, max) {
  if (!str || str.length <= max) return str
  return '…' + str.slice(-(max - 1))
}
