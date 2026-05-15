/**
 * Dev-only mock pipeline that drives the renderer's listing state machine
 * without invoking the real runtime / FAL / OpenAI.
 *
 * Activates only when ALL of:
 *   - `import.meta.env.DEV` (Vite dev or `vite build` with mode=development)
 *   - `VITE_SWTD_MOCK_PIPELINE === '1'` in env, OR `?mock=1` in URL
 *
 * Production builds tree-shake every reference here because `import.meta.env.DEV`
 * is replaced with `false` at build time, but we additionally guard with a
 * runtime check so the symbols can be safely imported from non-dev contexts.
 *
 * Emits the same event shape as the real `swtd:pipeline-event` IPC stream
 * (kind: 'start'|'log'|'end'), so Shell.jsx's reducer doesn't need a special
 * code path — the mock just feeds the existing pipeline. Slot transitions
 * propagate through the normal deriveSlotStates → deriveCanonicalSlotStates
 * derivation chain.
 */

const DEFAULT_DELAYS = Object.freeze({
  queuedAt:        200,   // ms after start before all slots reach queued
  generatingStep:  500,   // ms between consecutive slots entering generating
  generatingHold:  3500,  // ms each slot stays in generating
  endTailroom:     500    // ms after last slot resolves before 'end'
})

let MOCK_ACTIVE = null

/**
 * Returns true if mocked mode is currently active. Renderer code can guard
 * UI affordances (a "MOCK" badge in the TopBar) with this.
 */
export function isMockActive() {
  if (typeof window === 'undefined') return false
  if (MOCK_ACTIVE != null) return MOCK_ACTIVE
  try {
    const isDev = !!(import.meta.env && import.meta.env.DEV)
    if (!isDev) { MOCK_ACTIVE = false; return false }
    const envFlag = import.meta.env.VITE_SWTD_MOCK_PIPELINE === '1'
    const urlFlag = typeof window.location !== 'undefined'
      && /[?&]mock=1\b/.test(window.location.search || '')
    MOCK_ACTIVE = !!(envFlag || urlFlag)
  } catch {
    MOCK_ACTIVE = false
  }
  return MOCK_ACTIVE
}

/**
 * Pick one slot to fail (deterministic across one run). Returns an id from
 * `slotIds`, or `null` if `failProbability` says we shouldn't fail any.
 */
function pickFailureSlot(slotIds, failProbability) {
  if (failProbability <= 0 || !slotIds.length) return null
  // Math.random() per spec — random failure exists to exercise the failed UI.
  // The failure pick is independent of slot order so demos vary.
  if (Math.random() > failProbability) return null
  const idx = Math.floor(Math.random() * slotIds.length)
  return slotIds[idx] ?? null
}

/**
 * Run a mocked listing pipeline. Emits start → queued log events → staggered
 * generating + success/failed log events → end, on setTimeout cadences.
 *
 * @param {Object} args
 * @param {number[]} [args.slotIds]        - which slots to run; defaults to 1..8
 * @param {(evt:any)=>void} args.emit      - sink for synthetic IPC events
 * @param {string}   [args.skuPath]        - cosmetic; surfaces in start event
 * @param {number}   [args.failProbability]- 0..1, probability that ONE slot fails
 * @param {Object}   [args.delays]         - override default cadences
 * @returns {()=>void} cancel function — call to abort pending timers and emit 'end' with aborted=true
 */
export function startMockRun({
  slotIds,
  emit,
  skuPath = 'mock://sku',
  failProbability = 0.2,
  delays
} = {}) {
  if (typeof emit !== 'function') throw new Error('startMockRun: emit is required')
  const ids = (Array.isArray(slotIds) && slotIds.length > 0) ? [...slotIds] : [1,2,3,4,5,6,7,8]
  const d = { ...DEFAULT_DELAYS, ...(delays || {}) }
  const runId = `mock-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  const timers = new Set()
  let cancelled = false

  function schedule(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id)
      if (!cancelled) fn()
    }, ms)
    timers.add(id)
  }

  // Start event mirrors main.cjs pipeline-event 'start' shape.
  emit({ kind: 'start', bin: 'listing', runId, skuPath, extraArgs: ['--mock'], ts: Date.now() })

  // Queued banner — emit a single sys line so the activity drawer shows it.
  schedule(() => {
    emit({ kind: 'log', stream: 'sys', line: `▸ mock queue ${ids.map(i=>`slot${i}`).join(',')}`, ts: Date.now() })
  }, d.queuedAt)

  // Pick the failing slot up front (deterministic across this run).
  const failingId = pickFailureSlot(ids, failProbability)

  // Each slot: emit "generating" log at staggered start, "done" or "error" after hold.
  ids.forEach((id, idx) => {
    const startAt = d.queuedAt + 100 + idx * d.generatingStep
    const endAt = startAt + d.generatingHold
    schedule(() => {
      emit({ kind: 'log', stream: 'stdout', line: `[Slot ${id}] starting generation`, ts: Date.now() })
    }, startAt)
    schedule(() => {
      if (id === failingId) {
        emit({ kind: 'log', stream: 'stderr', line: `[Slot ${id}] error: mock failure for demo`, ts: Date.now() })
      } else {
        emit({ kind: 'log', stream: 'stdout', line: `[Slot ${id}] done — saved (mock)`, ts: Date.now() })
      }
    }, endAt)
  })

  // End event after the last slot resolves.
  const lastSlotEnd = d.queuedAt + 100 + (ids.length - 1) * d.generatingStep + d.generatingHold
  schedule(() => {
    emit({
      kind: 'end',
      runId,
      ok: failingId == null,
      paused: false,
      aborted: false,
      code: failingId == null ? 0 : 1,
      ts: Date.now()
    })
  }, lastSlotEnd + d.endTailroom)

  return function cancel() {
    if (cancelled) return
    cancelled = true
    for (const tid of timers) clearTimeout(tid)
    timers.clear()
    emit({
      kind: 'end',
      runId,
      ok: false,
      paused: false,
      aborted: true,
      code: 130,
      ts: Date.now()
    })
  }
}
