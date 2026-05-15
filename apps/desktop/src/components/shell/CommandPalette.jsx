import React, { useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../../lib/i18n.js'

/**
 * CommandPalette
 *
 * Modal command surface. Opens with Cmd/Ctrl+K (handled by Shell). Provides
 * fuzzy-ish substring search across four categories: Navigation, Actions,
 * SKUs, Settings.
 *
 * @typedef {Object} CommandItem
 * @property {string} id
 * @property {string} label
 * @property {string} group
 * @property {() => void} run
 * @property {string} [shortcut]
 * @property {string} [disabledReason]
 *
 * @typedef {Object} CommandPaletteProps
 * @property {() => void} onClose
 * @property {Array<{path:string,name:string,hasBrief:boolean}>} skus
 * @property {Array<{id:string,label:string,detail?:string}>} steps
 * @property {(stepId: string) => void} onNavigateStep
 * @property {(skuPath: string) => void} onChooseSku
 * @property {() => void} onPickWorkspace
 * @property {() => void} onRunListing
 * @property {() => void} onCancelListing
 * @property {() => void} onRevalidate
 * @property {() => void} onToggleLeftRail
 * @property {() => void} onToggleInspector
 * @property {() => void} onToggleDrawer
 * @property {string} [runDisabledReason]
 * @property {string} [cancelDisabledReason]
 * @property {string} [revalidateDisabledReason]
 * @property {Record<string, string>} [stepStates]    Map of stepId → state.
 */

const GROUPS = ['Navigation', 'Actions', 'SKUs', 'Settings']
const GROUP_LABEL_KEY = {
  Navigation: 'cmdk.group.navigation',
  Actions:    'cmdk.group.actions',
  SKUs:       'cmdk.group.skus',
  Settings:   'cmdk.group.settings'
}

/** @param {CommandPaletteProps} props */
export default function CommandPalette({
  onClose,
  skus,
  steps,
  onNavigateStep,
  onChooseSku,
  onPickWorkspace,
  onRunListing,
  onCancelListing,
  onRevalidate,
  onToggleLeftRail,
  onToggleInspector,
  onToggleDrawer,
  onToggleDensity,
  density,
  onToggleTheme,
  theme,
  onToggleLanguage,
  language = 'en',
  runDisabledReason,
  cancelDisabledReason,
  revalidateDisabledReason,
  stepStates = {}
}) {
  const lang = language
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const items = useMemo(() => {
    /** @type {CommandItem[]} */
    const base = []

    const goToFn = t('cmdk.action.go_to', lang)
    for (const s of steps) {
      const state = stepStates[s.id]
      const locked = state === 'locked'
      const stepLabel = t('step.' + s.id, lang) || s.label
      base.push({
        id: 'nav:' + s.id,
        group: 'Navigation',
        label: typeof goToFn === 'function' ? goToFn(stepLabel) : `Go to ${stepLabel}`,
        run: () => onNavigateStep(s.id),
        disabledReason: locked ? t('cmdk.reason.step_locked', lang) : undefined
      })
    }

    base.push({
      id: 'action:run',
      group: 'Actions',
      label: t('cmdk.action.run_listing', lang),
      shortcut: '⌘R',
      run: () => { onRunListing() },
      disabledReason: runDisabledReason
    })
    base.push({
      id: 'action:cancel',
      group: 'Actions',
      label: t('cmdk.action.cancel_run', lang),
      shortcut: '⌘.',
      run: () => { onCancelListing() },
      disabledReason: cancelDisabledReason
    })
    base.push({
      id: 'action:revalidate',
      group: 'Actions',
      label: t('cmdk.action.revalidate', lang),
      shortcut: '⌘I',
      run: () => { onRevalidate() },
      disabledReason: revalidateDisabledReason
    })
    base.push({
      id: 'action:pick',
      group: 'Actions',
      label: t('cmdk.action.pick_workspace', lang),
      shortcut: '⌘O',
      run: () => { onPickWorkspace() }
    })

    for (const sku of skus) {
      base.push({
        id: 'sku:' + sku.path,
        group: 'SKUs',
        label: sku.name,
        run: () => onChooseSku(sku.path),
        disabledReason: sku.hasBrief ? undefined : t('cmdk.reason.no_brief', lang)
      })
    }

    base.push({
      id: 'set:leftrail',
      group: 'Settings',
      label: t('cmdk.action.toggle_sidebar', lang),
      shortcut: '⌘B',
      run: () => { onToggleLeftRail() }
    })
    base.push({
      id: 'set:inspector',
      group: 'Settings',
      label: t('cmdk.action.toggle_inspector', lang),
      shortcut: '⌘\\',
      run: () => { onToggleInspector() }
    })
    base.push({
      id: 'set:drawer',
      group: 'Settings',
      label: t('cmdk.action.toggle_drawer', lang),
      shortcut: '⌘J',
      run: () => { onToggleDrawer() }
    })
    if (onToggleDensity) {
      base.push({
        id: 'set:density',
        group: 'Settings',
        label: density === 'compact'
          ? t('cmdk.action.density_to_comfortable', lang)
          : t('cmdk.action.density_to_compact', lang),
        run: () => { onToggleDensity() }
      })
    }
    if (onToggleTheme) {
      base.push({
        id: 'set:theme',
        group: 'Settings',
        label: theme === 'light'
          ? t('cmdk.action.theme_to_dark', lang)
          : t('cmdk.action.theme_to_light', lang),
        run: () => { onToggleTheme() }
      })
    }
    if (onToggleLanguage) {
      base.push({
        id: 'set:language',
        group: 'Settings',
        label: lang === 'vi'
          ? t('cmdk.action.lang_to_en', lang)
          : t('cmdk.action.lang_to_vi', lang),
        run: () => { onToggleLanguage() }
      })
    }

    return base
  }, [
    skus, steps, stepStates, lang,
    runDisabledReason, cancelDisabledReason, revalidateDisabledReason,
    onNavigateStep, onChooseSku, onPickWorkspace,
    onRunListing, onCancelListing, onRevalidate,
    onToggleLeftRail, onToggleInspector, onToggleDrawer,
    onToggleDensity, density,
    onToggleTheme, theme,
    onToggleLanguage
  ])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.trim().toLowerCase()
    return items.filter(it => it.label.toLowerCase().includes(q))
  }, [items, query])

  useEffect(() => { setSelected(0) }, [query])

  function runItem(it) {
    if (it.disabledReason) return
    it.run()
    onClose()
  }

  function onKey(e) {
    if (e.key === 'Escape')      { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown')   { e.preventDefault(); setSelected(i => Math.min(filtered.length - 1, i + 1)); return }
    if (e.key === 'ArrowUp')     { e.preventDefault(); setSelected(i => Math.max(0, i - 1)); return }
    if (e.key === 'Enter')       { e.preventDefault(); const it = filtered[selected]; if (it) runItem(it); return }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cmdk-selected="true"]`)
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' })
  }, [selected, filtered.length])

  const grouped = useMemo(() => {
    const byGroup = {}
    for (const g of GROUPS) byGroup[g] = []
    for (const it of filtered) {
      if (!byGroup[it.group]) byGroup[it.group] = []
      byGroup[it.group].push(it)
    }
    return byGroup
  }, [filtered])

  return (
    <div className="cmdk-backdrop" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={onBackdropClick(onClose)}>
      <div className="cmdk" onKeyDown={onKey}>
        <div className="cmdk__input-wrap">
          <input
            ref={inputRef}
            className="cmdk__input"
            type="text"
            placeholder={t('cmdk.placeholder', lang)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="cmdk__list" ref={listRef} role="listbox">
          {filtered.length === 0 && (() => {
            const emptyFn = t('cmdk.empty.title', lang)
            const title = typeof emptyFn === 'function' ? emptyFn(query.trim()) : `No matches for "${query.trim()}"`
            return (
              <div className="cmdk__empty">
                <span className="cmdk__empty-title">{title}</span>
                <span className="cmdk__empty-hint">{t('cmdk.empty.hint', lang)}</span>
              </div>
            )
          })()}
          {GROUPS.map(g => {
            const list = grouped[g]
            if (!list || list.length === 0) return null
            return (
              <div className="cmdk__group" key={g}>
                <div className="cmdk__group-head">
                  <span>{t(GROUP_LABEL_KEY[g] || 'cmdk.group.actions', lang)}</span>
                  <span className="cmdk__group-count">{list.length}</span>
                </div>
                {list.map(it => {
                  const idx = filtered.indexOf(it)
                  const isSelected = idx === selected
                  const className = [
                    'cmdk__item',
                    isSelected && 'cmdk__item--selected'
                  ].filter(Boolean).join(' ')
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className={className}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={!!it.disabledReason}
                      data-cmdk-selected={isSelected || undefined}
                      onMouseEnter={() => setSelected(idx)}
                      onClick={() => runItem(it)}
                      title={it.disabledReason}
                    >
                      <span className="cmdk__item-icon" aria-hidden="true">
                        {GROUP_ICON[g]}
                      </span>
                      <span className="cmdk__item-label">{it.label}</span>
                      {it.shortcut && <kbd className="cmdk__item-shortcut">{it.shortcut}</kbd>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="cmdk__footer">
          <span className="cmdk__footer-hint">
            <kbd>↑</kbd><kbd>↓</kbd> {t('cmdk.footer.navigate', lang)}
          </span>
          <span className="cmdk__footer-hint">
            <kbd>↵</kbd> {t('cmdk.footer.select', lang)}
          </span>
          <span className="cmdk__footer-hint">
            <kbd>esc</kbd> {t('cmdk.footer.close', lang)}
          </span>
        </div>
      </div>
    </div>
  )
}

const GROUP_ICON = {
  Navigation: '◇',
  Actions:    '▸',
  SKUs:       '·',
  Settings:   '⚙'
}

function onBackdropClick(close) {
  return function (e) {
    if (e.target === e.currentTarget) close()
  }
}
