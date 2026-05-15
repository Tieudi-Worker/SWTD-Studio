import React from 'react'
import Input from '../atoms/Input.jsx'
import IconButton from '../atoms/IconButton.jsx'
import StatusChip from '../atoms/StatusChip.jsx'

const RUN_TO_CHIP = {
  idle:      { status: 'idle',      label: 'Idle' },
  running:   { status: 'running',   label: 'Running' },
  ok:        { status: 'complete',  label: 'Complete' },
  paused:    { status: 'paused',    label: 'Review' },
  err:       { status: 'error',     label: 'Failed' },
  cancelled: { status: 'needs-fix', label: 'Cancelled' }
}

/**
 * @typedef {Object} TopBarProps
 * @property {string} workspace                Absolute path or empty.
 * @property {() => void} onPickWorkspace
 * @property {'idle'|'running'|'ok'|'paused'|'err'|'cancelled'} runStatus
 * @property {string} commandQuery
 * @property {(value: string) => void} onCommandQueryChange
 * @property {() => void} onOpenCommandPalette
 * @property {() => void} [onOpenSettings]
 * @property {'comfortable'|'compact'} [density]
 * @property {() => void} [onToggleDensity]
 * @property {'dark'|'light'} [theme]
 * @property {() => void} [onToggleTheme]
 */

/** @param {TopBarProps} props */
export default function TopBar({
  workspace,
  onPickWorkspace,
  runStatus,
  commandQuery,
  onCommandQueryChange,
  onOpenCommandPalette,
  onOpenSettings,
  density,
  onToggleDensity,
  theme,
  onToggleTheme
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
          icon={theme === 'light' ? <SunIcon /> : <MoonIcon />}
          label={theme === 'light' ? 'Theme: light (switch to dark)' : 'Theme: dark (switch to light)'}
          onClick={onToggleTheme}
        />
        <IconButton
          size="md"
          variant="ghost"
          icon={density === 'compact' ? <DensityCompactIcon /> : <DensityComfortableIcon />}
          label={density === 'compact' ? 'Density: compact (switch to comfortable)' : 'Density: comfortable (switch to compact)'}
          active={density === 'compact'}
          onClick={onToggleDensity}
        />
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

function DensityComfortableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="3" y1="4" x2="13" y2="4" />
      <line x1="3" y1="8" x2="13" y2="8" />
      <line x1="3" y1="12" x2="13" y2="12" />
    </svg>
  )
}

function DensityCompactIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="3" y1="5" x2="13" y2="5" />
      <line x1="3" y1="8" x2="13" y2="8" />
      <line x1="3" y1="11" x2="13" y2="11" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="8" cy="8" r="2.6" />
      <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M13.5 9.4A5.5 5.5 0 1 1 6.6 2.5a4.5 4.5 0 0 0 6.9 6.9z" />
    </svg>
  )
}
