import React from 'react'

/**
 * @typedef {'primary'|'secondary'|'ghost'|'danger'} ButtonVariant
 * @typedef {'sm'|'md'} ButtonSize
 *
 * @typedef {Object} ButtonProps
 * @property {ButtonVariant} [variant]
 * @property {ButtonSize} [size]
 * @property {React.ReactNode} [leftIcon]
 * @property {React.ReactNode} [rightIcon]
 * @property {string} [shortcut]   Visual hint, e.g. "⌘↵". Does not bind keys.
 * @property {boolean} [disabled]
 * @property {string} [disabledReason] Tooltip shown when disabled.
 * @property {boolean} [loading]
 * @property {boolean} [fullWidth]
 * @property {(e: React.MouseEvent) => void} [onClick]
 * @property {React.ReactNode} [children]
 * @property {'button'|'submit'|'reset'} [type]
 * @property {string} [ariaLabel]
 */

/** @param {ButtonProps} props */
export default function Button({
  variant = 'secondary',
  size = 'md',
  leftIcon,
  rightIcon,
  shortcut,
  disabled = false,
  disabledReason,
  loading = false,
  fullWidth = false,
  onClick,
  children,
  type = 'button',
  ariaLabel
}) {
  const isDisabled = disabled || loading
  const tooltip = isDisabled && disabledReason ? disabledReason : undefined

  const className = [
    'atom-btn',
    `atom-btn--${variant}`,
    `atom-btn--${size}`,
    fullWidth && 'atom-btn--full',
    loading && 'atom-btn--loading',
    isDisabled && 'atom-btn--disabled'
  ].filter(Boolean).join(' ')

  return (
    <button
      type={type}
      className={className}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-label={ariaLabel}
      title={tooltip}
      onClick={isDisabled ? undefined : onClick}
    >
      {loading ? (
        <span className="atom-btn__spinner" aria-hidden="true" />
      ) : (
        leftIcon && <span className="atom-btn__icon atom-btn__icon--left">{leftIcon}</span>
      )}
      {children && <span className="atom-btn__label">{children}</span>}
      {rightIcon && !loading && (
        <span className="atom-btn__icon atom-btn__icon--right">{rightIcon}</span>
      )}
      {shortcut && <kbd className="atom-btn__kbd">{shortcut}</kbd>}
    </button>
  )
}
