import React from 'react'
import Button from './Button.jsx'

/**
 * @typedef {Object} EmptyAction
 * @property {string} label
 * @property {() => void} [onClick]
 * @property {React.ReactNode} [icon]
 * @property {string} [shortcut]
 * @property {boolean} [disabled]
 * @property {string} [disabledReason]
 *
 * @typedef {'sm'|'md'|'lg'} EmptySize
 *
 * @typedef {Object} EmptyStateProps
 * @property {React.ReactNode} [icon]
 * @property {string} title
 * @property {React.ReactNode} [description]
 * @property {EmptyAction} [primaryAction]
 * @property {EmptyAction} [secondaryAction]
 * @property {EmptySize} [size]
 */

/** @param {EmptyStateProps} props */
export default function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  size = 'md'
}) {
  const btnSize = size === 'sm' ? 'sm' : 'md'

  return (
    <div className={`atom-empty atom-empty--${size}`}>
      {icon && <div className="atom-empty__icon" aria-hidden="true">{icon}</div>}
      <div className="atom-empty__title">{title}</div>
      {description && <div className="atom-empty__body">{description}</div>}
      {(primaryAction || secondaryAction) && (
        <div className="atom-empty__actions">
          {primaryAction && (
            <Button
              variant="primary"
              size={btnSize}
              leftIcon={primaryAction.icon}
              shortcut={primaryAction.shortcut}
              disabled={primaryAction.disabled}
              disabledReason={primaryAction.disabledReason}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              size={btnSize}
              leftIcon={secondaryAction.icon}
              shortcut={secondaryAction.shortcut}
              disabled={secondaryAction.disabled}
              disabledReason={secondaryAction.disabledReason}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
