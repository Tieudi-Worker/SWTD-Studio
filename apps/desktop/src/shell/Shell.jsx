import React, { useCallback, useEffect, useMemo, useState } from 'react'
import TopBar from '../components/shell/TopBar.jsx'
import LeftRail from '../components/shell/LeftRail.jsx'
import Stepper from '../components/shell/Stepper.jsx'
import MainCanvas from '../components/shell/MainCanvas.jsx'
import RightInspector from '../components/shell/RightInspector.jsx'
import StatusBar from '../components/shell/StatusBar.jsx'
import ActivityDrawer from '../components/shell/ActivityDrawer.jsx'
import CommandPalette from '../components/shell/CommandPalette.jsx'
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts.js'

const LAYOUT_KEY = 'swtd_ui_layout'

const DEFAULT_LAYOUT = {
  leftRailCollapsed: false,
  rightInspectorCollapsed: false,
  activityDrawerExpanded: false
}

function loadLayout() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LAYOUT_KEY) : null
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_LAYOUT, ...parsed }
  } catch {
    return DEFAULT_LAYOUT
  }
}

function saveLayout(layout) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
    }
  } catch {
    /* ignore */
  }
}

const api = typeof window !== 'undefined' ? window.swtd : undefined

const STEP_DEFS = [
  { id: 'intake',  label: 'Intake',  detail: 'brief.json' },
  { id: 'listing', label: 'Listing', detail: '8 slots' },
  { id: 'aplus',   label: 'A+',      detail: '5 modules' },
  { id: 'video',   label: 'Video',   detail: '12–15s' },
  { id: 'qc',      label: 'QC',      detail: 'bundle' }
]

export default function Shell() {
  const [layout, setLayout] = useState(loadLayout)

  const [step, setStep] = useState('intake')
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
  const [commandQuery, setCommandQuery] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => { saveLayout(layout) }, [layout])

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

  const toggleLeftRail = useCallback(() => {
    setLayout(prev => ({ ...prev, leftRailCollapsed: !prev.leftRailCollapsed }))
  }, [])
  const toggleRightInspector = useCallback(() => {
    setLayout(prev => ({ ...prev, rightInspectorCollapsed: !prev.rightInspectorCollapsed }))
  }, [])
  const toggleActivityDrawer = useCallback(() => {
    setLayout(prev => ({ ...prev, activityDrawerExpanded: !prev.activityDrawerExpanded }))
  }, [])

  const clearActivity = useCallback(() => {
    setListingState(prev => ({ ...prev, lines: [] }))
  }, [])

  const pickWorkspace = useCallback(async () => {
    if (!api) return
    const res = await api.pickFolder({ title: 'Select project workspace' })
    if (!res?.canceled && res?.path) {
      setWorkspace(res.path)
      const list = await api.listSkus(res.path)
      setSkus(list?.items || [])
    }
  }, [])

  const refreshSkus = useCallback(async () => {
    if (!api || !workspace) return
    const list = await api.listSkus(workspace)
    setSkus(list?.items || [])
  }, [workspace])

  const chooseSku = useCallback(async (target) => {
    if (!target) return
    setSkuPath(target)
    setStep('intake')
    if (!api) return
    setValidating(true)
    try {
      const v = await api.validateSku(target)
      setValidation(v)
    } finally {
      setValidating(false)
    }
  }, [])

  const revalidate = useCallback(async () => {
    if (!api || !skuPath) return
    setValidating(true)
    try {
      const v = await api.validateSku(skuPath)
      setValidation(v)
    } finally {
      setValidating(false)
    }
  }, [skuPath])

  const runListing = useCallback(async () => {
    if (!api || !skuPath || !validation?.ok || listingState.status === 'running') return
    setListingState({ runId: null, status: 'running', lines: [] })
    setStep('listing')
    setLayout(prev => ({ ...prev, activityDrawerExpanded: true }))
    const res = await api.runListing({ skuPath })
    if (!res?.ok) {
      setListingState({
        runId: null,
        status: 'err',
        lines: [{ stream: 'stderr', line: `[start failed] ${res?.error || 'unknown'}`, ts: Date.now() }]
      })
    }
  }, [skuPath, validation, listingState.status])

  const cancelListing = useCallback(async () => {
    if (!api || !listingState.runId) return
    await api.cancelPipeline(listingState.runId)
  }, [listingState.runId])

  const lastLine = useMemo(() => {
    const lines = listingState.lines
    return lines.length ? lines[lines.length - 1] : null
  }, [listingState.lines])

  const ready = !!(skuPath && validation?.ok)
  const running = listingState.status === 'running'

  const runDisabledReason = !skuPath
    ? 'Select a SKU first'
    : !validation?.ok
      ? (validation?.error || 'Brief is invalid — re-validate first')
      : running
        ? 'A run is already in progress'
        : undefined

  const cancelDisabledReason = !running ? 'No run in progress' : undefined
  const revalidateDisabledReason = !skuPath
    ? 'Select a SKU first'
    : validating
      ? 'Validation in progress'
      : undefined

  const lockedReason = ready
    ? 'This step ships in a later phase.'
    : 'Complete Intake (valid brief) and run Listing before unlocking later steps.'

  const stepEntries = useMemo(() => {
    const intake = validating
      ? 'running'
      : (validation?.ok ? 'done' : (skuPath ? 'error' : 'idle'))
    const listing = (() => {
      if (listingState.status === 'running')   return 'running'
      if (listingState.status === 'ok')        return 'done'
      if (listingState.status === 'err')       return 'error'
      if (listingState.status === 'cancelled') return 'error'
      return ready ? 'idle' : 'locked'
    })()
    const states = { intake, listing, aplus: 'locked', video: 'locked', qc: 'locked' }
    const reasons = {
      intake:  skuPath ? (validation?.error || undefined) : 'Pick a SKU to load its brief',
      listing: ready ? undefined : 'Validate the brief before running listing',
      aplus:   'A+ ships in a later phase',
      video:   'Video ships in a later phase',
      qc:      'QC ships in a later phase'
    }
    return STEP_DEFS.map(s => {
      const base = states[s.id]
      const isCurrent = step === s.id
      const showActive = isCurrent && (base === 'idle' || base === 'locked')
      return {
        step: { id: s.id, label: s.label, detail: s.detail },
        state: showActive ? 'active' : base,
        reason: reasons[s.id]
      }
    })
  }, [step, validation, validating, skuPath, listingState.status, ready])

  const handleStepChange = useCallback((id) => setStep(id), [])

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  useKeyboardShortcuts({
    'mod+k':  () => setPaletteOpen(prev => !prev),
    'mod+r':  () => { if (!runDisabledReason) runListing() },
    'mod+.':  () => { if (!cancelDisabledReason) cancelListing() },
    'mod+b':  toggleLeftRail,
    'mod+\\': toggleRightInspector,
    'mod+j':  toggleActivityDrawer,
    'mod+o':  pickWorkspace,
    'mod+i':  () => { if (!revalidateDisabledReason) revalidate() },
    'mod+/':  openPalette,
    'shift+?': openPalette,
    'escape': () => { if (paletteOpen) closePalette() }
  })

  const stepStatesMap = useMemo(() => {
    const out = {}
    for (const e of stepEntries) out[e.step.id] = e.state
    return out
  }, [stepEntries])

  const shellClass = [
    'shell',
    layout.leftRailCollapsed && 'shell--leftrail-collapsed',
    layout.rightInspectorCollapsed && 'shell--inspector-collapsed',
    layout.activityDrawerExpanded && 'shell--drawer-expanded'
  ].filter(Boolean).join(' ')

  return (
    <div className={shellClass}>
      <header className="shell__topbar">
        <TopBar
          workspace={workspace}
          onPickWorkspace={pickWorkspace}
          runStatus={listingState.status}
          commandQuery={commandQuery}
          onCommandQueryChange={setCommandQuery}
          onOpenCommandPalette={openPalette}
        />
      </header>

      <aside className="shell__leftrail">
        <LeftRail
          collapsed={layout.leftRailCollapsed}
          onToggleCollapsed={toggleLeftRail}
          workspace={workspace}
          onPickWorkspace={pickWorkspace}
          onRefreshSkus={refreshSkus}
          skus={skus}
          filter={filter}
          onFilterChange={setFilter}
          skuPath={skuPath}
          onChooseSku={chooseSku}
          validation={validation}
          runStatus={listingState.status}
        />
      </aside>

      <section className="shell__main">
        <div className="shell__stepper">
          <Stepper steps={stepEntries} activeId={step} onChange={handleStepChange} />
        </div>
        <div className="shell__canvas">
          <MainCanvas
            step={step}
            workspace={workspace}
            skuPath={skuPath}
            validation={validation}
            validating={validating}
            skuCount={skus.length}
            onPickWorkspace={pickWorkspace}
            listingState={listingState}
          />
        </div>
        <div className="shell__drawer">
          <ActivityDrawer
            expanded={layout.activityDrawerExpanded}
            onToggle={toggleActivityDrawer}
            onClear={clearActivity}
            lines={listingState.lines}
            runStatus={listingState.status}
          />
        </div>
      </section>

      <aside className="shell__inspector">
        <RightInspector
          step={step}
          skuPath={skuPath}
          validation={validation}
          validating={validating}
          listingState={listingState}
          lockedReason={lockedReason}
          onRevalidate={revalidate}
          onRunListing={runListing}
          onCancelListing={cancelListing}
          runDisabledReason={runDisabledReason}
          cancelDisabledReason={cancelDisabledReason}
          revalidateDisabledReason={revalidateDisabledReason}
        />
      </aside>

      <footer className="shell__statusbar">
        <StatusBar
          runStatus={listingState.status}
          lastLine={lastLine}
          onOpenShortcuts={openPalette}
        />
      </footer>

      {paletteOpen && (
        <CommandPalette
          onClose={closePalette}
          skus={skus}
          steps={STEP_DEFS}
          onNavigateStep={handleStepChange}
          onChooseSku={chooseSku}
          onPickWorkspace={pickWorkspace}
          onRunListing={runListing}
          onCancelListing={cancelListing}
          onRevalidate={revalidate}
          onToggleLeftRail={toggleLeftRail}
          onToggleInspector={toggleRightInspector}
          onToggleDrawer={toggleActivityDrawer}
          runDisabledReason={runDisabledReason}
          cancelDisabledReason={cancelDisabledReason}
          revalidateDisabledReason={revalidateDisabledReason}
          stepStates={stepStatesMap}
        />
      )}
    </div>
  )
}
