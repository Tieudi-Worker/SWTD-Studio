import React, { useMemo, useState } from 'react'
import Input from '../atoms/Input.jsx'
import IconButton from '../atoms/IconButton.jsx'
import EmptyState from '../atoms/EmptyState.jsx'
import StatusDot from '../atoms/StatusDot.jsx'

/**
 * @typedef {Object} SkuItem
 * @property {string} path
 * @property {string} name
 * @property {boolean} hasBrief
 *
 * @typedef {Object} LeftRailProps
 * @property {boolean} collapsed
 * @property {() => void} onToggleCollapsed
 * @property {string} workspace
 * @property {() => void} onPickWorkspace
 * @property {() => void} onRefreshSkus
 * @property {SkuItem[]} skus
 * @property {string} filter
 * @property {(v: string) => void} onFilterChange
 * @property {string} skuPath
 * @property {(path: string) => void} onChooseSku
 * @property {{ ok:boolean, brief?:object, error?:string }|null} [validation]
 * @property {string} [runStatus]
 */

const COLLECTIONS = [
  { id: 'all',       label: 'All',       dot: 'idle' },
  { id: 'draft',     label: 'Draft',     dot: 'warning' },
  { id: 'ready',     label: 'Ready',     dot: 'done' },
  { id: 'needs-fix', label: 'Needs Fix', dot: 'error' },
  { id: 'complete',  label: 'Complete',  dot: 'done' }
]

function bucketize(skus, skuPath, validation, runStatus) {
  const draft = skus.filter(s => !s.hasBrief)
  const ready = skus.filter(s => s.hasBrief)
  const needsFix = (skuPath && validation && validation.ok === false)
    ? skus.filter(s => s.path === skuPath)
    : []
  const complete = (skuPath && runStatus === 'ok')
    ? skus.filter(s => s.path === skuPath)
    : []
  return {
    'all': skus,
    'draft': draft,
    'ready': ready,
    'needs-fix': needsFix,
    'complete': complete
  }
}

/** @param {LeftRailProps} props */
export default function LeftRail({
  collapsed,
  onToggleCollapsed,
  workspace,
  onPickWorkspace,
  onRefreshSkus,
  skus,
  filter,
  onFilterChange,
  skuPath,
  onChooseSku,
  validation,
  runStatus
}) {
  const [collection, setCollection] = useState('all')

  const buckets = useMemo(
    () => bucketize(skus, skuPath, validation, runStatus),
    [skus, skuPath, validation, runStatus]
  )

  const scoped = buckets[collection] || skus

  const filtered = useMemo(() => {
    if (!filter) return scoped
    const q = filter.toLowerCase()
    return scoped.filter(s => s.name.toLowerCase().includes(q))
  }, [scoped, filter])

  if (collapsed) {
    return (
      <div className="leftrail leftrail--collapsed" role="navigation" aria-label="SKU navigator (collapsed)">
        <div className="leftrail__collapsed-stack">
          <IconButton
            icon={<ChevronRightIcon />}
            label="Expand sidebar"
            size="md"
            variant="ghost"
            onClick={onToggleCollapsed}
          />
          <IconButton
            icon={<FolderIcon />}
            label="Pick workspace"
            size="md"
            variant="ghost"
            onClick={onPickWorkspace}
          />
          <IconButton
            icon={<RefreshIcon />}
            label="Refresh SKUs"
            size="md"
            variant="ghost"
            onClick={onRefreshSkus}
            disabled={!workspace}
            disabledReason="Pick a workspace first"
          />
        </div>
        <div className="leftrail__collapsed-count" aria-label={`${skus.length} SKUs`}>
          {skus.length}
        </div>
      </div>
    )
  }

  return (
    <div className="leftrail" role="navigation" aria-label="SKU navigator">
      <div className="leftrail__head">
        <span className="leftrail__title">Workspace</span>
        <IconButton
          icon={<ChevronLeftIcon />}
          label="Collapse sidebar"
          size="sm"
          variant="ghost"
          onClick={onToggleCollapsed}
        />
      </div>

      <button type="button" className="leftrail__workspace" onClick={onPickWorkspace} title={workspace || 'Pick a workspace'}>
        <FolderIcon />
        <span className="leftrail__workspace-text">
          {workspace
            ? <span className="leftrail__workspace-path">{shortPath(workspace, 30)}</span>
            : <span className="leftrail__workspace-empty">Select folder…</span>}
        </span>
      </button>

      <div className="leftrail__section-head">
        <span className="leftrail__section-title">Collections</span>
      </div>
      <ul className="leftrail__collections" role="list" aria-label="Collections">
        {COLLECTIONS.map(c => {
          const count = (buckets[c.id] || []).length
          const active = collection === c.id
          return (
            <li key={c.id}>
              <button
                type="button"
                className={'leftrail__collection' + (active ? ' leftrail__collection--active' : '')}
                onClick={() => setCollection(c.id)}
                aria-pressed={active}
              >
                <StatusDot status={c.dot} size="sm" />
                <span className="leftrail__collection-label">{c.label}</span>
                <span className="leftrail__collection-count">{count}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="leftrail__section-head">
        <span className="leftrail__section-title">SKUs</span>
        <span className="leftrail__section-count">
          {filtered.length}{filter || collection !== 'all' ? `/${skus.length}` : ''}
        </span>
      </div>

      <div className="leftrail__filter">
        <Input
          type="search"
          size="sm"
          placeholder="Filter…"
          value={filter}
          onChange={onFilterChange}
          disabled={!workspace}
          ariaLabel="Filter SKUs"
          leftIcon={<SearchIcon />}
        />
        <IconButton
          icon={<RefreshIcon />}
          label="Refresh"
          size="sm"
          variant="ghost"
          onClick={onRefreshSkus}
          disabled={!workspace}
          disabledReason="Pick a workspace first"
        />
      </div>

      <div className="leftrail__list">
        {!workspace && (
          <EmptyState
            size="sm"
            icon={<FolderIcon />}
            title="No workspace"
            description="Pick a folder containing SKU subdirectories."
            primaryAction={{ label: 'Pick workspace', onClick: onPickWorkspace }}
          />
        )}
        {workspace && filtered.length === 0 && (
          <EmptyState
            size="sm"
            icon={<SearchIcon />}
            title={filter ? 'No matches' : 'No SKUs'}
            description={filter ? 'Adjust the filter to find a SKU.' : 'This folder has no SKU subdirectories.'}
          />
        )}
        {filtered.map(s => {
          const active = s.path === skuPath
          return (
            <button
              type="button"
              key={s.path}
              className={'leftrail__sku' + (active ? ' leftrail__sku--active' : '')}
              onClick={() => onChooseSku(s.path)}
              title={s.path}
            >
              <StatusDot status={s.hasBrief ? 'done' : 'warning'} size="sm" />
              <span className="leftrail__sku-name">{s.name}</span>
              <span className="leftrail__sku-flag">{s.hasBrief ? 'brief' : 'no brief'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function shortPath(p, max) {
  if (!p || p.length <= max) return p
  return '…' + p.slice(-(max - 1))
}

function ChevronLeftIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="10 4 5 8 10 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="6 4 11 8 6 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.3 1.5h5.1A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5z" strokeLinejoin="round" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 8a5 5 0 1 1 1.5 3.5" strokeLinecap="round" />
      <polyline points="3 12 3.5 11 5 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5" />
      <line x1="11" y1="11" x2="14" y2="14" strokeLinecap="round" />
    </svg>
  )
}
