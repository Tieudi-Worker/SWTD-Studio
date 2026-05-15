import React, { useEffect, useRef } from 'react'
import IconButton from '../atoms/IconButton.jsx'
import { t } from '../../lib/i18n.js'

/**
 * @typedef {Object} LogLine
 * @property {string} stream    'stdout' | 'stderr' | 'sys'
 * @property {string} line
 * @property {number} ts
 *
 * @typedef {'collapsed'|'summary'|'expanded'} DrawerMode
 *
 * @typedef {Object} ActivityDrawerProps
 * @property {DrawerMode} mode
 * @property {() => void} onToggle
 * @property {() => void} onClear
 * @property {LogLine[]} lines
 * @property {string} runStatus
 */

const SUMMARY_TAIL = 2

/** @param {ActivityDrawerProps} props */
export default function ActivityDrawer({ mode, onToggle, onClear, lines, runStatus, language = 'en' }) {
  const bodyRef = useRef(null)
  const expanded = mode === 'expanded'
  const summaryMode = mode === 'summary'
  const bodyVisible = expanded || summaryMode

  useEffect(() => {
    if (!expanded || !bodyRef.current) return
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [lines, expanded])

  const count = (lines || []).length
  const linesFn = t('drawer.lines', language)
  const summary = count === 0
    ? t('drawer.no_activity', language)
    : (typeof linesFn === 'function' ? linesFn(count) : `${count}`)

  // Summary mode: peek the most-recent N lines without giving the
  // drawer a scrollable body. Keeps the canvas dominant while still
  // showing fresh tail output.
  const visibleLines = summaryMode
    ? (lines || []).slice(-SUMMARY_TAIL)
    : (lines || [])

  const nextLabel = mode === 'collapsed'
    ? t('drawer.tip.peek', language)
    : (mode === 'summary' ? t('drawer.tip.expand', language) : t('drawer.tip.collapse', language))

  const chevron = mode === 'collapsed' ? '▸' : (mode === 'summary' ? '▹' : '▾')

  return (
    <div className={'drawer drawer--' + mode}>
      <div className="drawer__head">
        <button
          type="button"
          className="drawer__toggle"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls="drawer-body"
          title={nextLabel}
        >
          <span className="drawer__chevron" aria-hidden="true">{chevron}</span>
          <span className="drawer__title">{t('drawer.title', language)}</span>
          <span className="drawer__summary">{summary}</span>
          {runStatus === 'running' && <span className="drawer__pulse" aria-hidden="true" />}
        </button>
        {expanded && (
          <div className="drawer__actions">
            <IconButton
              icon={<TrashIcon />}
              size="sm"
              variant="ghost"
              label={t('drawer.clear', language)}
              onClick={onClear}
              disabled={count === 0}
              disabledReason={t('drawer.clear', language)}
            />
            <IconButton
              icon={<MinusIcon />}
              size="sm"
              variant="ghost"
              label={t('drawer.collapse', language)}
              onClick={onToggle}
            />
          </div>
        )}
      </div>

      {bodyVisible && (
        <div className="drawer__body" id="drawer-body" ref={bodyRef}>
          {count === 0 && (
            <div className="drawer__empty">{t('drawer.empty_hint', language)}</div>
          )}
          {visibleLines.map((l, i) => (
            <div key={i} className={'drawer__line drawer__line--' + (l.stream || 'sys')}>
              <span className="drawer__ts">{fmtTs(l.ts)}</span>
              <span className="drawer__stream">{(l.stream || 'sys').padEnd(6).slice(0, 6)}</span>
              <span className="drawer__text">{l.line}</span>
            </div>
          ))}
          {runStatus === 'running' && expanded && <span className="drawer__cursor" aria-hidden="true" />}
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
