import React from 'react'
import { t } from '../../lib/i18n.js'

/**
 * Read-only chronological log of pipeline events for the current listing run.
 *
 * Fed by the ref-backed array `runTimelineRef` maintained in Shell.jsx —
 * every event that flows through `handlePipelineEvent` is pushed here.
 * Bumps `version` from a useState in Shell.jsx force-render this component
 * without re-rendering the entire Shell tree on every log line.
 *
 * Operator-facing in the Right Inspector Timeline tab so they can audit
 * which slot transitioned when, even after collapsing the slot grid.
 */

function formatTime(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toTimeString().slice(0, 8)
  } catch {
    return ''
  }
}

/**
 * Best-effort harvest of a `Slot N` reference from a log line, mirroring
 * lib/slot-progress.js#slotIdFromMessage. Keeps timeline rows aware of
 * which slot the line belongs to without re-running the full parser.
 */
function slotIdFromLine(line) {
  if (!line) return null
  const m = String(line).match(/(?:\[\s*)?slot[\s_-]*([1-8])\b/i)
  return m ? parseInt(m[1], 10) : null
}

/** Map an event into a flat timeline row. Returns null if the event
 *  doesn't carry meaningful state info (e.g. heartbeat). */
function rowFromEvent(evt, language) {
  if (!evt || !evt.kind) return null
  const ts = formatTime(evt.ts)
  if (evt.kind === 'start') {
    return { ts, slot: null, kind: 'start', label: `▸ ${t('timeline.start', language)} (${evt.bin || 'listing'})` }
  }
  if (evt.kind === 'end') {
    const labelKey = evt.aborted ? 'timeline.end_aborted'
      : evt.paused ? 'timeline.end_paused'
        : evt.ok ? 'timeline.end_ok' : 'timeline.end_err'
    return { ts, slot: null, kind: 'end', label: `■ ${t(labelKey, language)} (code=${evt.code ?? '?'})` }
  }
  if (evt.kind === 'log') {
    const slot = slotIdFromLine(evt.line)
    if (slot == null) return null
    const line = String(evt.line || '').slice(0, 120)
    // Cheap state hint inferred from the line text — exact same heuristics
    // as slot-progress.js so timeline + slot grid never disagree.
    let kind = 'log'
    if (/\berror\b|\bfail/i.test(line)) kind = 'failed'
    else if (/\b(done|ok|complete|saved)\b/i.test(line)) kind = 'success'
    else if (/\b(start|begin|generating)/i.test(line)) kind = 'generating'
    return { ts, slot, kind, label: line.replace(/^\[?slot[\s_-]*\d+\]?\s*/i, '') }
  }
  return null
}

export default function RunTimeline({ events, language = 'en' }) {
  const rows = []
  for (const evt of events || []) {
    const row = rowFromEvent(evt, language)
    if (row) rows.push(row)
  }
  if (rows.length === 0) {
    return (
      <div className="run-timeline run-timeline--empty">
        <p className="inspector__locked-copy">{t('timeline.empty', language)}</p>
      </div>
    )
  }
  return (
    <div className="run-timeline">
      <ol className="run-timeline__list">
        {rows.map((row, idx) => (
          <li
            key={idx}
            className={'run-timeline__row run-timeline__row--' + row.kind}
            aria-label={row.slot ? `Slot ${row.slot} ${row.kind}` : row.kind}
          >
            <span className="run-timeline__ts">{row.ts}</span>
            <span className="run-timeline__slot">{row.slot ? `S${row.slot}` : '—'}</span>
            <span className="run-timeline__label" title={row.label}>{row.label}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
