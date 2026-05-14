import React from 'react'
import StatusDot from './StatusDot.jsx'

const LABELS = {
  ready: 'Ready',
  idle: 'Idle',
  locked: 'Locked',
  running: 'Running',
  'needs-fix': 'Needs fix',
  error: 'Error',
  complete: 'Complete',
  paused: 'Review'
}

const DOT_FOR_STATUS = {
  ready: 'done',
  idle: 'idle',
  locked: 'locked',
  running: 'running',
  'needs-fix': 'warning',
  error: 'error',
  complete: 'done',
  paused: 'warning'
}

/**
 * @typedef {'ready'|'idle'|'locked'|'running'|'needs-fix'|'error'|'complete'|'paused'} ChipStatus
 * @typedef {'sm'|'md'} ChipSize
 *
 * @typedef {Object} StatusChipProps
 * @property {ChipStatus} status
 * @property {ChipSize} [size]
 * @property {React.ReactNode} [icon]    Replaces the default status dot.
 * @property {React.ReactNode} [children] Custom label; defaults to status text.
 */

/** @param {StatusChipProps} props */
export default function StatusChip({ status, size = 'md', icon, children }) {
  const label = children ?? LABELS[status] ?? status
  const className = [
    'atom-chip',
    `atom-chip--${status}`,
    `atom-chip--${size}`
  ].join(' ')

  return (
    <span className={className}>
      {icon
        ? <span className="atom-chip__icon" aria-hidden="true">{icon}</span>
        : <StatusDot status={DOT_FOR_STATUS[status] || 'idle'} size="sm" />}
      <span className="atom-chip__label">{label}</span>
    </span>
  )
}
