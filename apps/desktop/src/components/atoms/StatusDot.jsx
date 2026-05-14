import React from 'react'

/**
 * @typedef {'idle'|'running'|'done'|'error'|'locked'|'warning'} DotStatus
 * @typedef {'sm'|'md'|'lg'} DotSize
 *
 * @typedef {Object} StatusDotProps
 * @property {DotStatus} [status]
 * @property {DotSize} [size]
 * @property {string} [label]   Optional aria-label.
 */

/** @param {StatusDotProps} props */
export default function StatusDot({ status = 'idle', size = 'md', label }) {
  const className = [
    'atom-statusdot',
    `atom-statusdot--${status}`,
    `atom-statusdot--${size}`
  ].join(' ')

  return (
    <span
      className={className}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
