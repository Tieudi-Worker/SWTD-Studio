import React, { useEffect, useRef } from 'react'
import IconButton from '../atoms/IconButton.jsx'

/**
 * @typedef {Object} LogLine
 * @property {string} stream    'stdout' | 'stderr' | 'sys'
 * @property {string} line
 * @property {number} ts
 *
 * @typedef {Object} ActivityDrawerProps
 * @property {boolean} expanded
 * @property {() => void} onToggle
 * @property {() => void} onClear
 * @property {LogLine[]} lines
 * @property {string} runStatus
 */

/** @param {ActivityDrawerProps} props */
export default function ActivityDrawer({ expanded, onToggle, onClear, lines, runStatus }) {
  const bodyRef = useRef(null)

  useEffect(() => {
    if (!expanded || !bodyRef.current) return
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [lines, expanded])

  const count = (lines || []).length
  const summary = count === 0
    ? 'no activity yet'
    : `${count} line${count === 1 ? '' : 's'}`

  return (
    <div className={'drawer' + (expanded ? ' drawer--expanded' : '')}>
      <div className="drawer__head">
        <button
          type="button"
          className="drawer__toggle"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls="drawer-body"
          title={expanded ? 'Collapse activity' : 'Expand activity'}
        >
          <span className="drawer__chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          <span className="drawer__title">Activity</span>
          <span className="drawer__summary">{summary}</span>
          {runStatus === 'running' && <span className="drawer__pulse" aria-hidden="true" />}
        </button>
        {expanded && (
          <div className="drawer__actions">
            <IconButton
              icon={<TrashIcon />}
              size="sm"
              variant="ghost"
              label="Clear log"
              onClick={onClear}
              disabled={count === 0}
              disabledReason="No log lines to clear"
            />
            <IconButton
              icon={<MinusIcon />}
              size="sm"
              variant="ghost"
              label="Collapse"
              onClick={onToggle}
            />
          </div>
        )}
      </div>

      {expanded && (
        <div className="drawer__body" id="drawer-body" ref={bodyRef}>
          {count === 0 && (
            <div className="drawer__empty">No log lines yet — run the pipeline to stream output.</div>
          )}
          {(lines || []).map((l, i) => (
            <div key={i} className={'drawer__line drawer__line--' + (l.stream || 'sys')}>
              <span className="drawer__ts">{fmtTs(l.ts)}</span>
              <span className="drawer__stream">{(l.stream || 'sys').padEnd(6).slice(0, 6)}</span>
              <span className="drawer__text">{l.line}</span>
            </div>
          ))}
          {runStatus === 'running' && <span className="drawer__cursor" aria-hidden="true" />}
        </div>
      )}
    </div>
  )
}

function fmtTs(ts) {
  if (!ts) return '            '
  const d = new Date(ts)
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M4.5 4l.6 9a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <line x1="3" y1="8" x2="13" y2="8" strokeLinecap="round" />
    </svg>
  )
}
