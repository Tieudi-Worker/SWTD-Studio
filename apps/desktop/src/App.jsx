import React, { useEffect, useMemo, useRef, useState } from 'react'

const TABS = [
  { id: 'project',  idx: '01', label: 'Project' },
  { id: 'listing',  idx: '02', label: 'Listing · 8' },
  { id: 'aplus',    idx: '03', label: 'A+ · 5' },
  { id: 'video',    idx: '04', label: 'Video · 12–15s' },
  { id: 'qc',       idx: '05', label: 'QC / Export' },
  { id: 'settings', idx: '06', label: 'Settings' }
]

const api = typeof window !== 'undefined' ? window.swtd : undefined

export default function App() {
  const [tab, setTab] = useState('project')
  const [workspace, setWorkspace] = useState('')
  const [skuPath, setSkuPath] = useState('')
  const [validation, setValidation] = useState(null) // { ok, error?, brief? }
  const [skus, setSkus] = useState([])

  return (
    <div className="studio">
      <aside className="sidebar">
        <div className="brand">
          SWTD Studio
          <small>Amazon Media Workshop</small>
        </div>
        <nav className="nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={'nav-item' + (tab === t.id ? ' active' : '')}
              onClick={() => setTab(t.id)}
            >
              <span>{t.label}</span>
              <span className="idx">{t.idx}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          v0.1.0 · phase 1
        </div>
      </aside>

      <main className="workbench">
        <div className="workbench-inner">
          {tab === 'project' && (
            <ProjectPanel
              workspace={workspace}
              setWorkspace={setWorkspace}
              skuPath={skuPath}
              setSkuPath={setSkuPath}
              validation={validation}
              setValidation={setValidation}
              skus={skus}
              setSkus={setSkus}
            />
          )}
          {tab === 'listing' && (
            <ListingPanel skuPath={skuPath} validation={validation} />
          )}
          {tab === 'aplus' && <PlaceholderPanel kind="aplus" />}
          {tab === 'video' && <PlaceholderPanel kind="video" />}
          {tab === 'qc'    && <PlaceholderPanel kind="qc" />}
          {tab === 'settings' && <PlaceholderPanel kind="settings" />}
        </div>
      </main>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* Project tab                                                        */
/* ─────────────────────────────────────────────────────────────────── */

function ProjectPanel({
  workspace, setWorkspace,
  skuPath, setSkuPath,
  validation, setValidation,
  skus, setSkus
}) {
  const [busy, setBusy] = useState(false)

  async function pickWorkspace() {
    if (!api) return
    const res = await api.pickFolder({ title: 'Select project workspace' })
    if (!res?.canceled && res?.path) {
      setWorkspace(res.path)
      const list = await api.listSkus(res.path)
      setSkus(list?.items || [])
    }
  }

  async function pickSku() {
    if (!api) return
    const res = await api.pickFolder({
      title: 'Select SKU folder',
      defaultPath: workspace || undefined
    })
    if (!res?.canceled && res?.path) {
      setSkuPath(res.path)
      validate(res.path)
    }
  }

  async function validate(target = skuPath) {
    if (!api || !target) return
    setBusy(true)
    try {
      const v = await api.validateSku(target)
      setValidation(v)
    } finally {
      setBusy(false)
    }
  }

  async function refreshSkus() {
    if (!api || !workspace) return
    const list = await api.listSkus(workspace)
    setSkus(list?.items || [])
  }

  function chooseSku(target) {
    setSkuPath(target)
    validate(target)
  }

  return (
    <>
      <div className="eyebrow">Phase · 01 / Project</div>
      <h1 className="page-title">Workspace &amp; SKU brief</h1>
      <p className="page-lede">
        Point at the project workspace, then pick a single SKU folder. Each SKU must
        contain a <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-0)' }}>brief.json</code> at
        its root before the listing pipeline will run.
      </p>

      <section className="section">
        <div className="section-head">
          <h2>Workspace</h2>
          <span className="marker">Step 01 · 02</span>
        </div>

        <div className="field">
          <span className="field-label">Workspace</span>
          <input
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            placeholder="/path/to/data/"
          />
          <button className="btn" onClick={pickWorkspace}>Browse…</button>
        </div>

        <div className="field">
          <span className="field-label">SKU folder</span>
          <input
            value={skuPath}
            onChange={(e) => setSkuPath(e.target.value)}
            placeholder="/path/to/data/<SKU>/"
          />
          <button className="btn" onClick={pickSku}>Browse…</button>
        </div>

        <div className="field" style={{ gridTemplateColumns: '160px 1fr auto auto' }}>
          <span className="field-label">Validation</span>
          <div>
            <ValidationBadge validation={validation} busy={busy} hasPath={!!skuPath} />
          </div>
          <button className="btn ghost" onClick={refreshSkus} disabled={!workspace}>
            Refresh SKUs
          </button>
          <button className="btn primary" onClick={() => validate()} disabled={!skuPath || busy}>
            Re-validate
          </button>
        </div>

        {validation?.error && (
          <div style={{ marginTop: 6, color: 'var(--err)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            {validation.error}
          </div>
        )}
      </section>

      {validation?.ok && validation.brief && (
        <section className="section">
          <div className="section-head">
            <h2>Brief summary</h2>
            <span className="marker">brief.json · parsed</span>
          </div>
          <div className="card">
            <div className="brief-grid">
              <BriefCell k="SKU" v={validation.brief.sku} />
              <BriefCell k="Product" v={validation.brief.product_name} />
              <BriefCell k="Category" v={validation.brief.category} />
              <BriefCell k="Occasion" v={validation.brief.occasion} />
              <BriefCell k="Dimensions" v={validation.brief.dimensions} />
              <BriefCell k="Materials" v={validation.brief.materials != null ? `${validation.brief.materials} listed` : null} />
              <BriefCell k="Features"  v={validation.brief.features  != null ? `${validation.brief.features} listed`  : null} />
            </div>
          </div>
        </section>
      )}

      {skus.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>SKUs in workspace</h2>
            <span className="marker">{skus.length} folder{skus.length === 1 ? '' : 's'}</span>
          </div>
          <div className="sku-list">
            {skus.map(s => (
              <div key={s.path} className="sku-row">
                <button
                  className="btn ghost"
                  style={{ padding: '4px 10px', fontFamily: 'var(--font-mono)' }}
                  onClick={() => chooseSku(s.path)}
                >
                  {s.name}
                </button>
                <span className="meta">
                  {s.hasBrief ? 'brief.json ✓' : 'no brief'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function BriefCell({ k, v }) {
  return (
    <div className="brief-cell">
      <div className="k">{k}</div>
      <div className="v">{v || <span style={{ color: 'var(--ink-3)' }}>—</span>}</div>
    </div>
  )
}

function ValidationBadge({ validation, busy, hasPath }) {
  if (busy) return <Badge kind="running" label="Validating…" />
  if (!hasPath) return <Badge kind="idle" label="No SKU selected" />
  if (!validation) return <Badge kind="warn" label="Not validated" />
  if (validation.ok) return <Badge kind="ok" label="brief.json ok" />
  return <Badge kind="err" label="Invalid" />
}

function Badge({ kind, label }) {
  return (
    <span className={'badge ' + (kind || '')}>
      <span className="dot" />
      {label}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* Listing tab                                                        */
/* ─────────────────────────────────────────────────────────────────── */

function ListingPanel({ skuPath, validation }) {
  const [runId, setRunId] = useState(null)
  const [status, setStatus] = useState('idle') // idle | running | ok | err | cancelled
  const [lines, setLines] = useState([])
  const [tail, setTail] = useState(null)
  const bodyRef = useRef(null)

  useEffect(() => {
    if (!api?.onPipelineEvent) return
    return api.onPipelineEvent((evt) => {
      if (evt.kind === 'start') {
        setRunId(evt.runId)
        setStatus('running')
        setLines([{
          stream: 'sys',
          line: `▸ start ${evt.bin}  ${evt.skuPath}  ${(evt.extraArgs || []).join(' ')}`.trim(),
          ts: evt.ts
        }])
        setTail(evt.ts)
      } else if (evt.kind === 'log') {
        setLines((prev) => prev.length > 4000
          ? prev.slice(-3000).concat({ stream: evt.stream, line: evt.line, ts: evt.ts })
          : prev.concat({ stream: evt.stream, line: evt.line, ts: evt.ts }))
      } else if (evt.kind === 'end') {
        if (evt.aborted) setStatus('cancelled')
        else if (evt.ok) setStatus('ok')
        else setStatus('err')
        setLines((prev) => prev.concat({
          stream: 'sys',
          line: `▸ end  code=${evt.code}  aborted=${evt.aborted ? 'yes' : 'no'}`,
          ts: evt.ts
        }))
        setTail(null)
      } else if (evt.kind === 'error') {
        setStatus('err')
        setLines((prev) => prev.concat({ stream: 'stderr', line: `[ipc-error] ${evt.message}`, ts: evt.ts }))
        setTail(null)
      }
    })
  }, [])

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [lines])

  const ready = !!(skuPath && validation?.ok)
  const running = status === 'running'

  async function run() {
    if (!api || !ready || running) return
    setLines([])
    setStatus('running')
    const res = await api.runListing({ skuPath })
    if (!res?.ok) {
      setStatus('err')
      setLines([{ stream: 'stderr', line: `[start failed] ${res?.error || 'unknown'}`, ts: Date.now() }])
    }
  }

  async function cancel() {
    if (!api || !runId) return
    await api.cancelPipeline(runId)
  }

  return (
    <>
      <div className="eyebrow">Phase · 02 / Listing</div>
      <h1 className="page-title">8-slot listing pipeline</h1>
      <p className="page-lede">
        Runs <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-0)' }}>runtime/bin/listing.mjs</code> against the selected SKU
        and streams stdout/stderr here. Existing slots in <code style={{ fontFamily: 'var(--font-mono)' }}>_progress.json</code> are skipped.
      </p>

      <section className="section">
        <div className="section-head">
          <h2>Run controls</h2>
          <StatusBadge status={status} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={run} disabled={!ready || running}>
            ▶  Run listing
          </button>
          <button className="btn" onClick={cancel} disabled={!running}>
            ■  Cancel
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.08em' }}>
            {ready
              ? `Target  ${truncate(skuPath, 64)}`
              : 'Select & validate a SKU on the Project tab first.'}
          </span>
        </div>

        <div className="console">
          <div className="console-head">
            <span className="console-title">stdout · stderr</span>
            <span className="console-title" style={{ color: 'var(--ink-2)' }}>
              {lines.length} line{lines.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="console-body" ref={bodyRef}>
            {lines.length === 0 && (
              <span className="empty">No output yet. Hit Run listing to begin.</span>
            )}
            {lines.map((l, i) => (
              <span key={i} className={'console-line ' + lineClass(l.stream)}>
                <span className="ts">{fmtTs(l.ts)}</span>
                {l.line}
              </span>
            ))}
            {tail && <span className="console-cursor" />}
          </div>
        </div>
      </section>
    </>
  )
}

function StatusBadge({ status }) {
  switch (status) {
    case 'running':   return <Badge kind="running" label="Running" />
    case 'ok':        return <Badge kind="ok"      label="Completed" />
    case 'err':       return <Badge kind="err"     label="Failed" />
    case 'cancelled': return <Badge kind="warn"    label="Cancelled" />
    default:          return <Badge kind="idle"    label="Idle" />
  }
}

function lineClass(stream) {
  if (stream === 'stderr') return 'err'
  if (stream === 'sys')    return 'sys'
  return ''
}

function fmtTs(ts) {
  if (!ts) return '         '
  const d = new Date(ts)
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function truncate(str, max) {
  if (!str || str.length <= max) return str
  return '…' + str.slice(-(max - 1))
}

/* ─────────────────────────────────────────────────────────────────── */
/* Placeholder tabs                                                   */
/* ─────────────────────────────────────────────────────────────────── */

const PLACEHOLDER_COPY = {
  aplus: {
    eyebrow: 'Phase · 03 / A+',
    title:   'A+ Premium · 5 modules',
    body:    'Wires up to runtime/bin/aplus.mjs in a later phase. Single & multi-ASIN plans, M1–M5 at 1464×600.',
    roadmap: ['module M1 hero', 'M2–M4 feature deck', 'M5 comparison/CTA', 'multi-ASIN child fan-out']
  },
  video: {
    eyebrow: 'Phase · 04 / Video',
    title:   'Product video · 12–15s',
    body:    'Storyboard generator + Kling 3.0 producer call. Output 1920×1080 MP4. Not wired in Phase 1.',
    roadmap: ['storyboard.json', 'shot prompt synthesis', 'KIE video call', 'mux + delivery']
  },
  qc: {
    eyebrow: 'Phase · 05 / QC',
    title:   'QC & export bundle',
    body:    'Cohesion report, doctrine compliance, and ZIP export of the publish-ready bundle.',
    roadmap: ['cohesion_report.json', 'doctrine pass/fail', 'rename & bundle']
  },
  settings: {
    eyebrow: 'Phase · 06 / Settings',
    title:   'Settings & integrations',
    body:    'API keys, model routing, output paths, and theme. Reads from local config only — no secrets in repo.',
    roadmap: ['KIE_KEY (env)', 'output target dir', 'theme & font']
  }
}

function PlaceholderPanel({ kind }) {
  const copy = PLACEHOLDER_COPY[kind]
  if (!copy) return null
  return (
    <>
      <div className="eyebrow">{copy.eyebrow}</div>
      <h1 className="page-title">{copy.title}</h1>
      <p className="page-lede">{copy.body}</p>
      <section className="section">
        <div className="placeholder-card">
          <h3>Planned scope</h3>
          <div style={{ color: 'var(--ink-2)', fontSize: 13 }}>
            UI wiring deferred to a later phase. The runtime entry already exists; the desktop adapter will mirror the Listing tab pattern.
          </div>
          <div className="roadmap">
            {copy.roadmap.map((r, i) => (
              <div key={i}>· {r}</div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
