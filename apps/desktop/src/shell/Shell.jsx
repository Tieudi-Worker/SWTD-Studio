import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopBar from '../components/shell/TopBar.jsx'
import LeftRail from '../components/shell/LeftRail.jsx'
import Stepper from '../components/shell/Stepper.jsx'
import MainCanvas from '../components/shell/MainCanvas.jsx'
import RightInspector from '../components/shell/RightInspector.jsx'
import StatusBar from '../components/shell/StatusBar.jsx'
import ActivityDrawer from '../components/shell/ActivityDrawer.jsx'
import CommandPalette from '../components/shell/CommandPalette.jsx'
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts.js'
import { deriveSlotStates, regenSlotsToArg, mergeStatesWithValidator } from '../lib/slot-progress.js'
import { deriveAplusStates, regenModulesToArg } from '../lib/aplus-progress.js'
import { deriveCanonicalSlotStates } from '../lib/slot-state-machine.js'
import { isMockActive, startMockRun } from '../lib/mock-pipeline.js'

const LAYOUT_KEY = 'swtd_ui_layout'

const DEFAULT_LAYOUT = {
  leftRailCollapsed: false,
  rightInspectorCollapsed: false,
  activityDrawerMode: 'collapsed',  /* 'collapsed' | 'summary' | 'expanded' */
  density: 'comfortable',           /* 'comfortable' | 'compact' */
  theme: 'dark',                    /* 'dark' | 'light' */
  language: 'en'                    /* 'en' | 'vi' */
}

function loadLayout() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LAYOUT_KEY) : null
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw)
    // Migrate legacy boolean `activityDrawerExpanded` → enum `activityDrawerMode`.
    if (parsed.activityDrawerMode == null && typeof parsed.activityDrawerExpanded === 'boolean') {
      parsed.activityDrawerMode = parsed.activityDrawerExpanded ? 'expanded' : 'collapsed'
    }
    return { ...DEFAULT_LAYOUT, ...parsed }
  } catch {
    return DEFAULT_LAYOUT
  }
}

const DRAWER_CYCLE = { collapsed: 'summary', summary: 'expanded', expanded: 'collapsed' }

// Per-SKU review state lives under a stable per-SKU key. SKU paths are
// absolute so they uniquely identify a workspace+SKU pair.
const REVIEW_KEY_PREFIX = 'swtd_review:'
const REVIEW_DEFAULT = { approvals: {}, overrides: {}, expanded: {} }

function loadSlotReview(skuPath) {
  if (!skuPath || typeof localStorage === 'undefined') return REVIEW_DEFAULT
  try {
    const raw = localStorage.getItem(REVIEW_KEY_PREFIX + skuPath)
    if (!raw) return REVIEW_DEFAULT
    const parsed = JSON.parse(raw)
    return {
      approvals: parsed?.approvals || {},
      overrides: parsed?.overrides || {},
      expanded:  parsed?.expanded  || {}
    }
  } catch {
    return REVIEW_DEFAULT
  }
}

function saveSlotReview(skuPath, state) {
  if (!skuPath || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(REVIEW_KEY_PREFIX + skuPath, JSON.stringify(state))
  } catch {
    /* quota or serialization failure — ignore */
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
    lines: [],
    pauseReason: null,
    cohesionRequestPath: null
  })
  const [commandQuery, setCommandQuery] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [selectedSlots, setSelectedSlots] = useState(() => new Set())
  const [pendingRegen, setPendingRegen] = useState(() => new Set())
  const [validatorReport, setValidatorReport] = useState(null)
  const [validatingOutput, setValidatingOutput] = useState(false)

  // Phase 3 — A+ run state. Parallel to listingState but for the A+
  // (5-module) pipeline. Event stream is routed by `bin` so the two
  // pipelines never cross-contaminate.
  const [aplusState, setAplusState] = useState({
    runId: null,
    status: 'idle',
    lines: [],
    pauseReason: null,
    cohesionRequestPath: null
  })
  const [selectedModules, setSelectedModules] = useState(() => new Set())
  const [pendingAplusRegen, setPendingAplusRegen] = useState(() => new Set())
  const [aplusValidatorReport, setAplusValidatorReport] = useState(null)
  const [aplusValidating, setAplusValidating] = useState(false)

  // Per-SKU review state. Persisted in localStorage so re-opening a SKU
  // restores the last review decisions and any saved prompt overrides.
  // Shape per SKU: { approvals: { [slotId]: 'approved'|'needs-regen' },
  //                  overrides: { [slotId]: string },
  //                  expanded:  { [slotId]: boolean } }
  // NOTE: prompt overrides are currently UI-only. The legacy listing
  // runtime does not yet accept per-slot prompt overrides; saving here
  // preserves operator intent for the day runtime support lands.
  const [slotReview, setSlotReview] = useState(
    () => ({ approvals: {}, overrides: {}, expanded: {} })
  )

  useEffect(() => { saveLayout(layout) }, [layout])

  // C4 — Sync density to <html data-density="..."> so the
  // [data-density="compact"] CSS overrides defined in tokens.css
  // take effect across the whole renderer.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-density', layout.density || 'comfortable')
  }, [layout.density])

  const toggleDensity = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      density: prev.density === 'compact' ? 'comfortable' : 'compact'
    }))
  }, [])

  // Sync theme to <html data-theme="..."> so [data-theme="light"]
  // token overrides in tokens.css take effect.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', layout.theme || 'dark')
  }, [layout.theme])

  const toggleTheme = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light'
    }))
  }, [])

  // Sync language to <html lang="..."> and data-language for CSS/UA hooks.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const lang = layout.language || 'en'
    document.documentElement.setAttribute('lang', lang)
    document.documentElement.setAttribute('data-language', lang)
  }, [layout.language])

  const toggleLanguage = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      language: prev.language === 'vi' ? 'en' : 'vi'
    }))
  }, [])

  const lang = layout.language || 'en'

  // B1 — auto-toggle inspector on SKU-presence transition.
  // Opens when a SKU is loaded, closes when returning to an empty
  // dashboard. We only react to *transitions* so manual toggles
  // inside the same SKU session are respected.
  const prevHasSkuRef = useRef(!!skuPath)
  useEffect(() => {
    const hasSku = !!skuPath
    if (hasSku !== prevHasSkuRef.current) {
      setLayout(prev => ({ ...prev, rightInspectorCollapsed: !hasSku }))
      prevHasSkuRef.current = hasSku
    }
  }, [skuPath])

  // Pipeline-event routing. The `start` event carries `bin: 'listing'` or
  // `bin: 'aplus'`; subsequent events for the same run only carry `runId`,
  // so we map runId → bin at start and use it to route log/end/error to
  // the correct state slice.
  const runBinByIdRef = useRef(new Map())

  // Run-timeline ref: chronological log of slot state transitions for the
  // current listing run. Kept in a ref so updates don't re-render Shell;
  // RunTimeline reads via timelineVersion below.
  const runTimelineRef = useRef([])
  const [runTimelineVersion, setRunTimelineVersion] = useState(0)
  function appendTimelineEvent(evt) {
    runTimelineRef.current.push(evt)
    setRunTimelineVersion(v => v + 1)
  }

  // Shared pipeline-event router. Real IPC and the mock pipeline both
  // flow through this so the reducer + timeline stay in lockstep.
  const handlePipelineEvent = useCallback((evt) => {
    const reducer = (prev) => {
        if (evt.kind === 'start') {
          return {
            runId: evt.runId,
            status: 'running',
            lines: [{
              stream: 'sys',
              line: `▸ start ${evt.bin}  ${evt.skuPath}  ${(evt.extraArgs || []).join(' ')}`.trim(),
              ts: evt.ts
            }],
            pauseReason: null,
            cohesionRequestPath: null
          }
        }
        if (evt.kind === 'log') {
          const trimmed = prev.lines.length > 4000 ? prev.lines.slice(-3000) : prev.lines
          return { ...prev, lines: [...trimmed, { stream: evt.stream, line: evt.line, ts: evt.ts }] }
        }
        if (evt.kind === 'end') {
          const status = evt.aborted
            ? 'cancelled'
            : (evt.paused ? 'paused' : (evt.ok ? 'ok' : 'err'))
          const tailLine = evt.paused
            ? `▸ paused  reason=${evt.pauseReason || 'cohesion-review'}  code=${evt.code}`
            : `▸ end  code=${evt.code}  aborted=${evt.aborted ? 'yes' : 'no'}`
          return {
            ...prev,
            status,
            pauseReason: evt.paused ? (evt.pauseReason || 'cohesion-review') : null,
            cohesionRequestPath: evt.paused ? (evt.cohesionRequestPath || null) : null,
            lines: [...prev.lines, { stream: 'sys', line: tailLine, ts: evt.ts }]
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
      }

      // Resolve which pipeline this event belongs to.
      let bin = evt.bin
      if (evt.kind === 'start') {
        if (evt.runId) runBinByIdRef.current.set(evt.runId, evt.bin)
      } else if (evt.runId && !bin) {
        bin = runBinByIdRef.current.get(evt.runId)
      }
      if ((evt.kind === 'end' || evt.kind === 'error') && evt.runId) {
        runBinByIdRef.current.delete(evt.runId)
      }

      if (bin === 'aplus') {
        setAplusState(reducer)
      } else {
        // Default + back-compat: anything not explicitly tagged aplus routes
        // to listing, which preserves the Phase 2 contract exactly.
        setListingState(reducer)
        // Timeline tracks listing only (A+ has its own progress chip row).
        appendTimelineEvent(evt)
      }
  }, [])

  useEffect(() => {
    if (!api?.onPipelineEvent) return
    return api.onPipelineEvent(handlePipelineEvent)
  }, [handlePipelineEvent])

  // Active mock-run cancel handle (null when no mock in flight).
  const mockCancelRef = useRef(null)

  const toggleLeftRail = useCallback(() => {
    setLayout(prev => ({ ...prev, leftRailCollapsed: !prev.leftRailCollapsed }))
  }, [])
  const toggleRightInspector = useCallback(() => {
    setLayout(prev => ({ ...prev, rightInspectorCollapsed: !prev.rightInspectorCollapsed }))
  }, [])
  const toggleActivityDrawer = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      activityDrawerMode: DRAWER_CYCLE[prev.activityDrawerMode] || 'summary'
    }))
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
      // When the picked folder IS a single SKU, jump straight to it — there
      // is exactly one option and forcing the user to click it adds friction.
      if (list?.mode === 'single' && list.items?.length === 1) {
        chooseSku(list.items[0].path)
      }
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
    setSelectedSlots(new Set())
    setPendingRegen(new Set())
    setValidatorReport(null)
    setSelectedModules(new Set())
    setPendingAplusRegen(new Set())
    setAplusValidatorReport(null)
    // Restore the review state for this SKU from localStorage.
    setSlotReview(loadSlotReview(target))
    if (!api) return
    setValidating(true)
    try {
      const v = await api.validateSku(target)
      setValidation(v)
    } finally {
      setValidating(false)
    }
    // Best-effort: probe existing output for this SKU so the validator badge
    // is populated before the user clicks "Run listing".
    api.validateListingOutput(target).then((r) => {
      if (r?.ok && r.report) setValidatorReport(r.report)
    }).catch(() => {})
    // Same best-effort probe for A+ output.
    if (api.validateAplusOutput) {
      api.validateAplusOutput(target).then((r) => {
        if (r?.ok && r.report) setAplusValidatorReport(r.report)
      }).catch(() => {})
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

  const runListing = useCallback(async (regenSlots) => {
    if (!skuPath || listingState.status === 'running') return
    const mockMode = isMockActive()
    if (!mockMode && (!api || !validation?.ok)) return
    const regenList = Array.isArray(regenSlots)
      ? regenSlots.filter(n => Number.isInteger(n) && n >= 1 && n <= 8)
      : []
    // Reset timeline for a fresh run so stale entries don't bleed across runs.
    runTimelineRef.current = []
    setRunTimelineVersion(v => v + 1)
    setListingState({ runId: null, status: 'running', lines: [] })
    setStep('listing')
    setLayout(prev => ({ ...prev, activityDrawerMode: 'expanded' }))
    setPendingRegen(new Set(regenList.length ? regenList : [1,2,3,4,5,6,7,8]))

    if (mockMode) {
      // Drive the shared event router with synthetic events so the same
      // reducer + timeline + slotStates path handles real and mock runs.
      mockCancelRef.current = startMockRun({
        slotIds: regenList.length ? regenList : undefined,
        emit: handlePipelineEvent,
        skuPath
      })
      return
    }

    const payload = { skuPath }
    if (regenList.length > 0) {
      payload.skipSlots = regenSlotsToArg(regenList)
    }
    const res = await api.runListing(payload)
    if (!res?.ok) {
      setListingState({
        runId: null,
        status: 'err',
        lines: [{ stream: 'stderr', line: `[start failed] ${res?.error || 'unknown'}`, ts: Date.now() }]
      })
      setPendingRegen(new Set())
    }
  }, [skuPath, validation, listingState.status, handlePipelineEvent])

  const runListingFull = useCallback(() => runListing(), [runListing])
  const runListingRegen = useCallback(() => {
    const ids = Array.from(selectedSlots)
    if (ids.length === 0) return runListing()
    return runListing(ids)
  }, [runListing, selectedSlots])

  const toggleSlotSelection = useCallback((slotId) => {
    setSelectedSlots(prev => {
      const next = new Set(prev)
      if (next.has(slotId)) next.delete(slotId); else next.add(slotId)
      return next
    })
  }, [])
  const clearSlotSelection = useCallback(() => setSelectedSlots(new Set()), [])
  const selectAllSlots = useCallback(() => {
    setSelectedSlots(new Set([1, 2, 3, 4, 5, 6, 7, 8]))
  }, [])

  // Persist slot-review state on every change. Keyed by current SKU path;
  // skips the write when no SKU is active to avoid clobbering with the
  // default empty shape.
  useEffect(() => {
    if (!skuPath) return
    saveSlotReview(skuPath, slotReview)
  }, [skuPath, slotReview])

  const setSlotApproval = useCallback((slotId, value) => {
    setSlotReview(prev => {
      const approvals = { ...prev.approvals }
      if (value == null) delete approvals[slotId]
      else approvals[slotId] = value
      return { ...prev, approvals }
    })
  }, [])

  const setSlotOverride = useCallback((slotId, value) => {
    setSlotReview(prev => {
      const overrides = { ...prev.overrides }
      const trimmed = (value || '').trim()
      if (!trimmed) delete overrides[slotId]
      else overrides[slotId] = value
      return { ...prev, overrides }
    })
  }, [])

  const toggleSlotExpanded = useCallback((slotId) => {
    setSlotReview(prev => {
      const expanded = { ...prev.expanded }
      expanded[slotId] = !expanded[slotId]
      return { ...prev, expanded }
    })
  }, [])

  const approveAllFoundSlots = useCallback(() => {
    setSlotReview(prev => {
      const approvals = { ...prev.approvals }
      for (const entry of validatorReport?.slots || []) {
        if (entry.exists) approvals[entry.slot] = 'approved'
      }
      return { ...prev, approvals }
    })
  }, [validatorReport])

  const revealSlotFile = useCallback(async (slotId) => {
    if (!api?.revealPath) return
    const entry = (validatorReport?.slots || []).find(s => s.slot === slotId)
    if (entry?.file) await api.revealPath(entry.file)
  }, [validatorReport])

  const revealListingFolder = useCallback(async () => {
    if (!api?.revealPath || !validatorReport?.listingDir) return
    await api.revealPath(validatorReport.listingDir)
  }, [validatorReport])

  // Manual export. Real ZIP packaging requires a backend change (new IPC +
  // archiver/zlib in main process), so this stage is intentionally light:
  // copy the approved slots' file paths to the clipboard and reveal the
  // listing folder in OS file manager. Operator can drag from there.
  //
  // Returns the number of approved paths copied, or null if no clipboard
  // access. UI surfaces this as a transient "copied" flash.
  const exportApprovedSlots = useCallback(async () => {
    if (!validatorReport?.slots) return null
    const approvedIds = Object.keys(slotReview.approvals)
      .filter(id => slotReview.approvals[id] === 'approved')
      .map(id => parseInt(id, 10))
      .filter(n => Number.isInteger(n))
    if (approvedIds.length === 0) return 0
    const approvedSet = new Set(approvedIds)
    const paths = (validatorReport.slots || [])
      .filter(s => approvedSet.has(s.slot) && s.exists && s.file)
      .map(s => s.file)
    let copied = 0
    if (paths.length > 0 && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(paths.join('\n'))
        copied = paths.length
      } catch {
        /* clipboard blocked — fall through to reveal */
      }
    }
    if (validatorReport.listingDir && api?.revealPath) {
      await api.revealPath(validatorReport.listingDir)
    }
    return copied
  }, [validatorReport, slotReview])

  const refreshValidator = useCallback(async () => {
    if (!api || !skuPath) return
    setValidatingOutput(true)
    try {
      const res = await api.validateListingOutput(skuPath)
      if (res?.ok && res.report) {
        setValidatorReport(res.report)
      } else {
        setValidatorReport({ ok: false, error: res?.error || 'validation failed', slots: [], summary: null })
      }
    } finally {
      setValidatingOutput(false)
    }
  }, [skuPath])

  // ── A+ run callbacks (mirror runListing / refreshValidator etc.) ──
  const runAplus = useCallback(async (regenModules) => {
    if (!api?.runAplus || !skuPath || !validation?.ok || aplusState.status === 'running') return
    const regenList = Array.isArray(regenModules)
      ? regenModules.filter(n => Number.isInteger(n) && n >= 1 && n <= 5)
      : []
    setAplusState({ runId: null, status: 'running', lines: [] })
    setStep('aplus')
    setLayout(prev => ({ ...prev, activityDrawerMode: 'expanded' }))
    setPendingAplusRegen(new Set(regenList))
    const payload = { skuPath }
    if (regenList.length > 0) {
      payload.skipModules = regenModulesToArg(regenList)
    }
    const res = await api.runAplus(payload)
    if (!res?.ok) {
      setAplusState({
        runId: null,
        status: 'err',
        lines: [{ stream: 'stderr', line: `[start failed] ${res?.error || 'unknown'}`, ts: Date.now() }]
      })
      setPendingAplusRegen(new Set())
    }
  }, [skuPath, validation, aplusState.status])

  const runAplusFull = useCallback(() => runAplus(), [runAplus])
  const runAplusRegen = useCallback(() => {
    const ids = Array.from(selectedModules)
    if (ids.length === 0) return runAplus()
    return runAplus(ids)
  }, [runAplus, selectedModules])

  const toggleModuleSelection = useCallback((moduleId) => {
    setSelectedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId)
      return next
    })
  }, [])
  const clearModuleSelection = useCallback(() => setSelectedModules(new Set()), [])
  const selectAllModules = useCallback(() => {
    setSelectedModules(new Set([1, 2, 3, 4, 5]))
  }, [])

  const refreshAplusValidator = useCallback(async () => {
    if (!api?.validateAplusOutput || !skuPath) return
    setAplusValidating(true)
    try {
      const res = await api.validateAplusOutput(skuPath)
      if (res?.ok && res.report) {
        setAplusValidatorReport(res.report)
      } else {
        setAplusValidatorReport({ ok: false, error: res?.error || 'validation failed', modules: [], summary: null })
      }
    } finally {
      setAplusValidating(false)
    }
  }, [skuPath])

  const cancelAplus = useCallback(async () => {
    if (!api || !aplusState.runId) return
    await api.cancelPipeline(aplusState.runId)
  }, [aplusState.runId])

  const cancelListing = useCallback(async () => {
    // Mock run cancellation: pull the saved cancel handle and clear it.
    if (mockCancelRef.current) {
      const cancel = mockCancelRef.current
      mockCancelRef.current = null
      try { cancel() } catch { /* nothing to do */ }
      return
    }
    if (!api || !listingState.runId) return
    await api.cancelPipeline(listingState.runId)
  }, [listingState.runId])

  const revealCohesionRequest = useCallback(async () => {
    if (!api || !listingState.cohesionRequestPath) return
    await api.revealPath(listingState.cohesionRequestPath)
  }, [listingState.cohesionRequestPath])

  // Re-run validator + clear regen pins whenever a listing run reaches a
  // terminal state. We don't refresh while running — the runner is actively
  // writing files and mid-run reads would be noisy. 'paused' is terminal too
  // (the child process has exited, awaiting human review).
  useEffect(() => {
    if (
      listingState.status === 'ok'
      || listingState.status === 'err'
      || listingState.status === 'cancelled'
      || listingState.status === 'paused'
    ) {
      setPendingRegen(new Set())
      if (skuPath) refreshValidator()
    }
  }, [listingState.status, skuPath, refreshValidator])

  // Same post-terminal refresh for the A+ pipeline.
  useEffect(() => {
    if (
      aplusState.status === 'ok'
      || aplusState.status === 'err'
      || aplusState.status === 'cancelled'
      || aplusState.status === 'paused'
    ) {
      setPendingAplusRegen(new Set())
      if (skuPath) refreshAplusValidator()
    }
  }, [aplusState.status, skuPath, refreshAplusValidator])

  const slotStates = useMemo(
    () => mergeStatesWithValidator(
      deriveSlotStates(listingState.lines, {
        pendingRegen: Array.from(pendingRegen),
        runStatus: listingState.status
      }),
      validatorReport
    ),
    [listingState.lines, listingState.status, pendingRegen, validatorReport]
  )

  // Canonical 6-state derivation (idle/queued/generating/success/failed/approved).
  // Layers on top of the legacy 5-state machine so existing inspector code
  // can keep its current semantics during the Phase 1 migration window.
  const canonicalSlotStates = useMemo(
    () => deriveCanonicalSlotStates({
      legacyStates: slotStates,
      pendingRegen: Array.from(pendingRegen),
      runStatus: listingState.status,
      approvals: slotReview.approvals
    }),
    [slotStates, pendingRegen, listingState.status, slotReview.approvals]
  )

  const aplusModuleStates = useMemo(
    () => deriveAplusStates(aplusState.lines, {
      pendingRegen: Array.from(pendingAplusRegen),
      runStatus: aplusState.status
    }),
    [aplusState.lines, aplusState.status, pendingAplusRegen]
  )

  const lastLine = useMemo(() => {
    const lines = listingState.lines
    return lines.length ? lines[lines.length - 1] : null
  }, [listingState.lines])

  const ready = !!(skuPath && validation?.ok)
  const running = listingState.status === 'running'
  const aplusRunning = aplusState.status === 'running'
  const anyRunning = running || aplusRunning

  const runDisabledReason = !skuPath
    ? 'Select a SKU first'
    : !validation?.ok
      ? (validation?.error || 'Brief is invalid — re-validate first')
      : anyRunning
        ? 'A run is already in progress'
        : undefined

  const cancelDisabledReason = !running ? 'No run in progress' : undefined
  const revalidateDisabledReason = !skuPath
    ? 'Select a SKU first'
    : validating
      ? 'Validation in progress'
      : undefined

  // A+ unlocks once Listing finishes successfully (ok) or paused-for-review.
  // The pipeline doctrine is sequential: A+ assembles around the listing
  // imagery, so we don't expose Run A+ before listing has produced output.
  const listingDone = listingState.status === 'ok' || listingState.status === 'paused'
  const aplusReady = ready && listingDone

  const runAplusDisabledReason = !skuPath
    ? 'Select a SKU first'
    : !validation?.ok
      ? (validation?.error || 'Brief is invalid — re-validate first')
      : !listingDone
        ? 'Run Listing first — A+ assembles around the 8 listing slots'
        : anyRunning
          ? 'A run is already in progress'
          : undefined

  const cancelAplusDisabledReason = !aplusRunning ? 'No A+ run in progress' : undefined

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
      if (listingState.status === 'paused')    return 'paused'
      if (listingState.status === 'err')       return 'error'
      if (listingState.status === 'cancelled') return 'error'
      return ready ? 'idle' : 'locked'
    })()
    const aplus = (() => {
      if (aplusState.status === 'running')   return 'running'
      if (aplusState.status === 'ok')        return 'done'
      if (aplusState.status === 'paused')    return 'paused'
      if (aplusState.status === 'err')       return 'error'
      if (aplusState.status === 'cancelled') return 'error'
      return aplusReady ? 'idle' : 'locked'
    })()
    const states = { intake, listing, aplus, video: 'locked', qc: 'locked' }
    const reasons = {
      intake:  skuPath ? (validation?.error || undefined) : 'Pick a SKU to load its brief',
      listing: ready ? undefined : 'Validate the brief before running listing',
      aplus:   aplusReady ? undefined : 'Run Listing first — A+ assembles around the 8 listing slots',
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
  }, [step, validation, validating, skuPath, listingState.status, aplusState.status, ready, aplusReady])

  const handleStepChange = useCallback((id) => setStep(id), [])

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  useKeyboardShortcuts({
    'mod+k':  () => setPaletteOpen(prev => !prev),
    'mod+r':  () => { if (!runDisabledReason) runListingFull() },
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
    layout.activityDrawerMode === 'summary' && 'shell--drawer-summary',
    layout.activityDrawerMode === 'expanded' && 'shell--drawer-expanded'
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
          density={layout.density}
          onToggleDensity={toggleDensity}
          theme={layout.theme}
          onToggleTheme={toggleTheme}
          language={lang}
          onToggleLanguage={toggleLanguage}
          mockMode={isMockActive()}
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
          language={lang}
        />
      </aside>

      <section className="shell__main">
        <div className="shell__stepper">
          <Stepper steps={stepEntries} activeId={step} onChange={handleStepChange} language={lang} />
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
            slotStates={canonicalSlotStates}
            selectedSlots={selectedSlots}
            onToggleSlot={toggleSlotSelection}
            onClearSlotSelection={clearSlotSelection}
            onSelectAllSlots={selectAllSlots}
            onRunListing={runListingFull}
            onRunListingRegen={runListingRegen}
            runDisabledReason={runDisabledReason}
            validatorReport={validatorReport}
            validatingOutput={validatingOutput}
            onRefreshValidator={refreshValidator}
            onRevealCohesionRequest={revealCohesionRequest}
            slotApprovals={slotReview.approvals}
            slotOverrides={slotReview.overrides}
            slotExpanded={slotReview.expanded}
            onSetSlotApproval={setSlotApproval}
            onSetSlotOverride={setSlotOverride}
            onToggleSlotExpanded={toggleSlotExpanded}
            onApproveAllFoundSlots={approveAllFoundSlots}
            onRevealSlotFile={revealSlotFile}
            onRevealListingFolder={revealListingFolder}
            onExportApprovedSlots={exportApprovedSlots}
            aplusState={aplusState}
            aplusModuleStates={aplusModuleStates}
            selectedModules={selectedModules}
            onToggleModule={toggleModuleSelection}
            onClearModuleSelection={clearModuleSelection}
            onSelectAllModules={selectAllModules}
            onRunAplus={runAplusFull}
            onRunAplusRegen={runAplusRegen}
            runAplusDisabledReason={runAplusDisabledReason}
            aplusValidatorReport={aplusValidatorReport}
            aplusValidating={aplusValidating}
            onRefreshAplusValidator={refreshAplusValidator}
            language={lang}
          />
        </div>
        <div className="shell__drawer">
          <ActivityDrawer
            mode={layout.activityDrawerMode}
            onToggle={toggleActivityDrawer}
            onClear={clearActivity}
            lines={listingState.lines}
            runStatus={listingState.status}
            language={lang}
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
          onRunListing={runListingFull}
          onRunListingRegen={runListingRegen}
          onCancelListing={cancelListing}
          runDisabledReason={runDisabledReason}
          cancelDisabledReason={cancelDisabledReason}
          revalidateDisabledReason={revalidateDisabledReason}
          slotStates={slotStates}
          selectedSlots={selectedSlots}
          onToggleSlot={toggleSlotSelection}
          onClearSlotSelection={clearSlotSelection}
          onSelectAllSlots={selectAllSlots}
          validatorReport={validatorReport}
          validatingOutput={validatingOutput}
          onRefreshValidator={refreshValidator}
          onRevealCohesionRequest={revealCohesionRequest}
          aplusState={aplusState}
          aplusModuleStates={aplusModuleStates}
          selectedModules={selectedModules}
          onToggleModule={toggleModuleSelection}
          onClearModuleSelection={clearModuleSelection}
          onSelectAllModules={selectAllModules}
          onRunAplus={runAplusFull}
          onRunAplusRegen={runAplusRegen}
          onCancelAplus={cancelAplus}
          runAplusDisabledReason={runAplusDisabledReason}
          cancelAplusDisabledReason={cancelAplusDisabledReason}
          aplusValidatorReport={aplusValidatorReport}
          aplusValidating={aplusValidating}
          onRefreshAplusValidator={refreshAplusValidator}
          language={lang}
          runTimeline={runTimelineRef.current}
          runTimelineVersion={runTimelineVersion}
        />
      </aside>

      <footer className="shell__statusbar">
        <StatusBar
          runStatus={listingState.status}
          lastLine={lastLine}
          onOpenShortcuts={openPalette}
          language={lang}
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
          onRunListing={runListingFull}
          onCancelListing={cancelListing}
          onRevalidate={revalidate}
          onToggleLeftRail={toggleLeftRail}
          onToggleInspector={toggleRightInspector}
          onToggleDrawer={toggleActivityDrawer}
          onToggleDensity={toggleDensity}
          density={layout.density}
          onToggleTheme={toggleTheme}
          theme={layout.theme}
          onToggleLanguage={toggleLanguage}
          language={lang}
          runDisabledReason={runDisabledReason}
          cancelDisabledReason={cancelDisabledReason}
          revalidateDisabledReason={revalidateDisabledReason}
          stepStates={stepStatesMap}
        />
      )}
    </div>
  )
}
