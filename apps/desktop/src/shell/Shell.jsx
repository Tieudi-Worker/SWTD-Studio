import React, { useCallback, useEffect, useMemo, useState } from 'react'

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

export default function Shell() {
  const [layout, setLayout] = useState(loadLayout)

  // Preserved Phase 1 state — wired in Step 5 to real slots.
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

  useEffect(() => {
    function onKey(e) {
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return
      const k = (e.key || '').toLowerCase()
      if (k === 'b') {
        e.preventDefault()
        toggleLeftRail()
      } else if (e.key === '\\') {
        e.preventDefault()
        toggleRightInspector()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleLeftRail, toggleRightInspector])

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
    setTab('listing')
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

  // Available to Step 5; intentionally unused here.
  const ctx = useMemo(() => ({
    tab, setTab,
    workspace, skuPath, skus, filter, setFilter,
    validation, validating,
    listingState,
    layout,
    toggleLeftRail, toggleRightInspector, toggleActivityDrawer,
    pickWorkspace, refreshSkus, chooseSku, revalidate, runListing, cancelListing
  }), [
    tab, workspace, skuPath, skus, filter,
    validation, validating, listingState, layout,
    toggleLeftRail, toggleRightInspector, toggleActivityDrawer,
    pickWorkspace, refreshSkus, chooseSku, revalidate, runListing, cancelListing
  ])

  const shellClass = [
    'shell',
    layout.leftRailCollapsed && 'shell--leftrail-collapsed',
    layout.rightInspectorCollapsed && 'shell--inspector-collapsed',
    layout.activityDrawerExpanded && 'shell--drawer-expanded'
  ].filter(Boolean).join(' ')

  return (
    <div className={shellClass} data-shell-ctx={ctx ? '1' : '0'}>
      <header className="shell__topbar" data-slot="topbar">
        <Placeholder label="TopBar" sub="44px · global controls" />
      </header>

      <aside className="shell__leftrail" data-slot="leftrail">
        <Placeholder
          label="LeftRail"
          sub={layout.leftRailCollapsed ? '48px · collapsed' : '240px · SKU navigator'}
          shortcut="⌘B / Ctrl+B"
        />
      </aside>

      <section className="shell__main" data-slot="main">
        <div className="shell__stepper" data-slot="stepper">
          <Placeholder label="Stepper" sub="40px · pipeline progress" />
        </div>
        <div className="shell__canvas" data-slot="canvas">
          <Placeholder label="MainCanvas" sub="active tab workspace" big />
        </div>
        <div className="shell__drawer" data-slot="drawer">
          <Placeholder
            label="ActivityDrawer"
            sub={layout.activityDrawerExpanded ? '280px · expanded' : '32px · collapsed'}
          />
        </div>
      </section>

      <aside className="shell__inspector" data-slot="inspector">
        <Placeholder
          label="RightInspector"
          sub={layout.rightInspectorCollapsed ? 'hidden' : '320px · contextual details'}
          shortcut="⌘\ / Ctrl+\\"
        />
      </aside>

      <footer className="shell__statusbar" data-slot="statusbar">
        <Placeholder label="StatusBar" sub="28px · system signals" inline />
      </footer>
    </div>
  )
}

function Placeholder({ label, sub, shortcut, big, inline }) {
  const className = [
    'shell-placeholder',
    big && 'shell-placeholder--big',
    inline && 'shell-placeholder--inline'
  ].filter(Boolean).join(' ')
  return (
    <div className={className}>
      <span className="shell-placeholder__label">{label}</span>
      {sub && <span className="shell-placeholder__sub">{sub}</span>}
      {shortcut && <kbd className="shell-placeholder__kbd">{shortcut}</kbd>}
    </div>
  )
}
