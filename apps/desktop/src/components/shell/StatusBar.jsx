import React from 'react'
import StatusDot from '../atoms/StatusDot.jsx'

const STATUS_TO_DOT = {
  idle:      'idle',
  running:   'running',
  ok:        'done',
  err:       'error',
  cancelled: 'warning'
}

const STATUS_WORD = {
  idle:      'idle',
  running:   'running',
  ok:        'complete',
  err:       'failed',
  cancelled: 'cancelled'
}

const SHORTCUTS = [
  { keys: '⌘K', label: 'Command' },
  { keys: '⌘R', label: 'Run' },
  { keys: '⌘.', label: 'Cancel' },
  { keys: '⌘B', label: 'Sidebar' },
  { keys: '⌘\\', label: 'Inspector' },
  { keys: '⌘J', label: 'Drawer' }
]

/**
 * @typedef {Object} StatusBarProps
 * @property {'idle'|'running'|'ok'|'err'|'cancelled'} runStatus
 * @property {{stream:string, line:string, ts:number}|null} lastLine
 * @property {() => void} [onOpenShortcuts]
 */

/** @param {StatusBarProps} props */
export default function StatusBar({ runStatus, lastLine, onOpenShortcuts }) {
  return (
    <div className="statusbar">
      <div className="statusbar__left">
        <StatusDot status={STATUS_TO_DOT[runStatus] || 'idle'} size="sm" />
        <span className="statusbar__runner">{STATUS_WORD[runStatus] || 'idle'}</span>
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
            <span className="statusbar__kbd-label">{s.label}</span>
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
