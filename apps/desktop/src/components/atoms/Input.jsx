import React, { useId } from 'react'

/**
 * @typedef {'text'|'search'|'number'} InputType
 * @typedef {'sm'|'md'} InputSize
 *
 * @typedef {Object} InputProps
 * @property {InputType} [type]
 * @property {InputSize} [size]
 * @property {React.ReactNode} [leftIcon]
 * @property {React.ReactNode} [rightSlot]
 * @property {string} [placeholder]
 * @property {string|number} [value]
 * @property {(value: string) => void} [onChange]
 * @property {string} [error]
 * @property {string} [shortcut]      Visual hint, e.g. "⌘K". Does not bind keys.
 * @property {boolean} [disabled]
 * @property {string} [ariaLabel]
 * @property {string} [name]
 * @property {string} [autoComplete]
 * @property {(e: React.KeyboardEvent) => void} [onKeyDown]
 */

/** @param {InputProps} props */
export default function Input({
  type = 'text',
  size = 'md',
  leftIcon,
  rightSlot,
  placeholder,
  value,
  onChange,
  error,
  shortcut,
  disabled = false,
  ariaLabel,
  name,
  autoComplete,
  onKeyDown
}) {
  const errId = useId()
  const hasRight = !!(rightSlot || shortcut)

  const wrapClass = [
    'atom-input',
    `atom-input--${size}`,
    leftIcon && 'atom-input--has-left',
    hasRight && 'atom-input--has-right',
    error && 'atom-input--error',
    disabled && 'atom-input--disabled'
  ].filter(Boolean).join(' ')

  return (
    <div className="atom-input__wrap">
      <div className={wrapClass}>
        {leftIcon && (
          <span className="atom-input__left" aria-hidden="true">{leftIcon}</span>
        )}
        <input
          type={type}
          className="atom-input__field"
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          name={name}
          autoComplete={autoComplete}
        />
        {hasRight && (
          <span className="atom-input__right">
            {rightSlot}
            {shortcut && <kbd className="atom-input__kbd">{shortcut}</kbd>}
          </span>
        )}
      </div>
      {error && (
        <span id={errId} className="atom-input__error" role="alert">{error}</span>
      )}
    </div>
  )
}
