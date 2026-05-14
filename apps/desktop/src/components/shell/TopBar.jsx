import React from 'react'
import Input from '../atoms/Input.jsx'
import IconButton from '../atoms/IconButton.jsx'
import StatusChip from '../atoms/StatusChip.jsx'

const RUN_TO_CHIP = {
  idle:      { status: 'idle',      label: 'Idle' },
  running:   { status: 'running',   label: 'Running' },
  ok:        { status: 'complete',  label: 'Complete' },
  err:       { status: 'error',     label: 'Failed' },
  cancelled: { status: 'needs-fix', label: 'Cancelled' }
}

/**
 * @typedef {Object} TopBarProps
 * @property {string} workspace                Absolute path or empty.
 * @property {() => void} onPickWorkspace
 * @property {'idle'|'running'|'ok'|'err'|'cancelled'} runStatus
 * @property {string} commandQuery
 * @property {(value: string) => void} onCommandQueryChange
 * @property {() => void} onOpenCommandPalette
 * @property {() => void} [onOpenSettings]
 */

/** @param {TopBarProps} props */
export default function TopBar({
  workspace,
  onPickWorkspace,
  runStatus,
  commandQuery,
  onCommandQueryChange,
  onOpenCommandPalette,
  onOpenSettings
}) {
  const chip = RUN_TO_CHIP[runStatus] || RUN_TO_CHIP.idle
  const wsLabel = workspace ? shortenPath(workspace, 44) : 'No workspace'

  return (
    <div className="topbar">
      <div className="topbar__brand">
        <span className="topbar__mark" aria-hidden="true">◐</span>
        <span className="topbar__brand-text">
          <span className="topbar__brand-name">SWTD Studio</span>
          <span className="topbar__brand-sub">Operator Console</span>
        </span>
      </div>

      <button
        type="button"
        className="topbar__workspace"
        onClick={onPickWorkspace}
        title={workspace || 'Pick a workspace folder'}
      >
        <span className="topbar__workspace-key">WORKSPACE</span>
        <span className="topbar__workspace-val">{wsLabel}</span>
        <span className="topbar__workspace-caret" aria-hidden="true">⌄</span>
      </button>

      <div className="topbar__search">
        <Input
          type="search"
          size="sm"
          placeholder="Search SKUs, commands…"
          value={commandQuery}
          onChange={onCommandQueryChange}
          shortcut="⌘K"
          ariaLabel="Search"
          leftIcon={<SearchIcon />}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onOpenCommandPalette?.()
            }
          }}
        />
      </div>

      <div className="topbar__right">
        <StatusChip status={chip.status} size="sm">{chip.label}</StatusChip>
        <IconButton
          size="md"
          variant="ghost"
          icon={<GearIcon />}
          label="Settings"
          onClick={onOpenSettings}
        />
        <IconButton
          size="md"
          variant="ghost"
          icon={<UserIcon />}
          label="Account"
        />
      </div>
    </div>
  )
}

function shortenPath(p, max) {
  if (!p || p.length <= max) return p
  return '…' + p.slice(-(max - 1))
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5" />
      <line x1="11" y1="11" x2="14" y2="14" strokeLinecap="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" strokeLinecap="round" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="5.5" r="2.6" />
      <path d="M2.5 14c.8-2.7 3-4 5.5-4s4.7 1.3 5.5 4" strokeLinecap="round" />
    </svg>
  )
}
