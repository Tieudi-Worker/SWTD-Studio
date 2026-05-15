import React from 'react'
import StatusDot from '../atoms/StatusDot.jsx'
import { t } from '../../lib/i18n.js'

const STATUS_TO_DOT = {
  idle:      'idle',
  running:   'running',
  ok:        'done',
  paused:    'warning',
  err:       'error',
  cancelled: 'warning'
}

const STATUS_KEY = {
  idle:      'run.idle',
  running:   'run.running',
  ok:        'run.complete',
  paused:    'run.awaiting',
  err:       'run.failed',
  cancelled: 'run.cancelled'
}

const SHORTCUTS = [
  { keys: '⌘K', labelKey: 'kbd.command' },
  { keys: '⌘R', labelKey: 'kbd.run' },
  { keys: '⌘.', labelKey: 'kbd.cancel' },
  { keys: '⌘B', labelKey: 'kbd.sidebar' },
  { keys: '⌘\\', labelKey: 'kbd.inspector' },
  { keys: '⌘J', labelKey: 'kbd.drawer' }
]

/**
 * @typedef {Object} StatusBarProps
 * @property {'idle'|'running'|'ok'|'paused'|'err'|'cancelled'} runStatus
 * @property {{stream:string, line:string, ts:number}|null} lastLine
 * @property {() => void} [onOpenShortcuts]
 */

/** @param {StatusBarProps} props */
export default function StatusBar({ runStatus, lastLine, onOpenShortcuts, language = 'en' }) {
  return (
    <div className="statusbar">
      <div className="statusbar__left">
        <StatusDot status={STATUS_TO_DOT[runStatus] || 'idle'} size="sm" />
        <span className="statusbar__runner">{t(STATUS_KEY[runStatus] || 'run.idle', language)}</span>
      </div>

      <div className="statusbar__log" aria-live="polite">
        {lastLine ? (
          <>
            <span className={'statusbar__log-stream statusbar__log-stream--' + (lastLine.stream || 'sys')}>
              {(lastLine.stream || 'sys').padEnd(6).slice(0, 6)}
            </span>
            <span className="statusbar__log-line">{truncateLine(lastLine.line, 140)}</span>
          </>
        ) : (
          <span className="statusbar__log-empty">no log lines yet</span>
        )}
      </div>

      <button
        type="button"
        className="statusbar__shortcuts"
        onClick={onOpenShortcuts}
        title="Keyboard shortcuts (⌘?)"
      >
        {SHORTCUTS.map(s => (
          <span className="statusbar__kbd-pair" key={s.keys}>
            <kbd className="statusbar__kbd">{s.keys}</kbd>
            <span className="statusbar__kbd-label">{t(s.labelKey, language)}</span>
          </span>
        ))}
      </button>
    </div>
  )
}

function truncateLine(s, max) {
  if (!s) return ''
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}
