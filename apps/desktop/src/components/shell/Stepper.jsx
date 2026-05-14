import React from 'react'
import StatusDot from '../atoms/StatusDot.jsx'

/**
 * Pipeline steps presented as a horizontal progress strip.
 *
 * @typedef {'done'|'active'|'locked'|'error'|'paused'|'running'|'idle'} StepState
 *
 * @typedef {Object} StepDef
 * @property {string} id
 * @property {string} label
 * @property {string} [detail]
 *
 * @typedef {Object} StepEntry
 * @property {StepDef} step
 * @property {StepState} state
 * @property {string} [reason]    Shown on hover when state is 'locked' or 'error'.
 *
 * @typedef {Object} StepperProps
 * @property {StepEntry[]} steps
 * @property {string} activeId
 * @property {(id: string) => void} onChange
 */

const STATE_DOT = {
  done:    'done',
  active:  'running',
  running: 'running',
  locked:  'locked',
  error:   'error',
  paused:  'warning',
  idle:    'idle'
}

const STATE_WORD = {
  done:    'done',
  active:  'active',
  running: 'running',
  locked:  'locked',
  error:   'error',
  paused:  'review',
  idle:    'idle'
}

/** @param {StepperProps} props */
export default function Stepper({ steps, activeId, onChange }) {
  return (
    <ol className="stepper" role="list" aria-label="Pipeline steps">
      {steps.map((entry, i) => {
        const { step, state, reason } = entry
        const isActive = step.id === activeId
        const interactive = state !== 'locked'
        const className = [
          'stepper__step',
          `stepper__step--${state}`,
          isActive && 'stepper__step--current'
        ].filter(Boolean).join(' ')

        const title = (state === 'locked' || state === 'error' || state === 'paused') && reason ? reason : undefined

        return (
          <React.Fragment key={step.id}>
            <li className={className}>
              <button
                type="button"
                className="stepper__button"
                onClick={() => interactive && onChange(step.id)}
                disabled={!interactive}
                aria-disabled={!interactive}
                aria-current={isActive ? 'step' : undefined}
                title={title}
              >
                <span className="stepper__index">{String(i + 1).padStart(2, '0')}</span>
                <span className="stepper__dot"><StatusDot status={STATE_DOT[state]} size="sm" /></span>
                <span className="stepper__label">{step.label}</span>
                {step.detail && <span className="stepper__detail">{step.detail}</span>}
                <span className="stepper__state">{STATE_WORD[state]}</span>
              </button>
            </li>
            {i < steps.length - 1 && (
              <li className={'stepper__line' + (state === 'done' ? ' stepper__line--done' : '')} aria-hidden="true" />
            )}
          </React.Fragment>
        )
      })}
    </ol>
  )
}
