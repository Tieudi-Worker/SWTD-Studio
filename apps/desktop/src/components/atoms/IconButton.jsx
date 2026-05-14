import React from 'react'

/**
 * @typedef {'primary'|'secondary'|'ghost'|'danger'} IconButtonVariant
 * @typedef {'sm'|'md'|'lg'} IconButtonSize
 *
 * @typedef {Object} IconButtonProps
 * @property {IconButtonVariant} [variant]
 * @property {IconButtonSize} [size]
 * @property {React.ReactNode} icon
 * @property {string} [label]           Used as aria-label and fallback title.
 * @property {boolean} [disabled]
 * @property {string} [disabledReason]
 * @property {boolean} [active]
 * @property {(e: React.MouseEvent) => void} [onClick]
 */

/** @param {IconButtonProps} props */
export default function IconButton({
  variant = 'ghost',
  size = 'md',
  icon,
  label,
  disabled = false,
  disabledReason,
  active = false,
  onClick
}) {
  const isDisabled = disabled
  const tooltip = isDisabled && disabledReason ? disabledReason : label

  const className = [
    'atom-iconbtn',
    `atom-iconbtn--${variant}`,
    `atom-iconbtn--${size}`,
    active && 'atom-iconbtn--active',
    isDisabled && 'atom-iconbtn--disabled'
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={className}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-label={label}
      aria-pressed={active || undefined}
      title={tooltip}
      onClick={isDisabled ? undefined : onClick}
    >
      <span className="atom-iconbtn__icon" aria-hidden="true">{icon}</span>
    </button>
  )
}
