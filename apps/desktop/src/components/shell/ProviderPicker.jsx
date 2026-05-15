import React from 'react'
import { t } from '../../lib/i18n.js'
import {
  getActiveProviderId,
  setActiveProviderId
} from '../../lib/providers/registry.js'

/**
 * Provider picker — Phase 4.5 default-route selector + chain reorder.
 *
 * Lives inside `SettingsModal.jsx` below the 5-tab section. Key fields,
 * Save / Replace, and Test connection live inside `ProviderSettingsTab.jsx`
 * — this component only owns the route shape (primary + ordered fallback
 * chain + `allowMockFallback` toggle).
 *
 * The primary radio writes to both:
 *   - `setActiveProviderId(id)` — renderer-side picker preference
 *   - `swtdProvider.setRouteConfig({ primary: id })` via `onChange`
 *
 * Fallback chain reordering is implemented as per-row Up/Down + Add/Remove
 * buttons — fully keyboard-accessible without an extra dep. The parent
 * persists each change via `onSetFallbackChain([…])`.
 *
 * Plan §4.4 + §4.8 + spec §2 US6.
 */
export default function ProviderPicker({
  language = 'en',
  providers = [],
  routeConfig = null,
  onChange,
  onToggleMockFallback,
  onSetFallbackChain
}) {
  const [activeId, setActiveId] = React.useState(() => getActiveProviderId())

  React.useEffect(() => {
    if (routeConfig?.primary && routeConfig.primary !== activeId) {
      setActiveProviderId(routeConfig.primary)
      setActiveId(routeConfig.primary)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeConfig?.primary])

  function selectProvider(id) {
    setActiveProviderId(id)
    setActiveId(id)
    onChange?.(id)
  }

  const choices = providers.length > 0 ? providers : []
  const allowMock = !!routeConfig?.allowMockFallback
  const chain = Array.isArray(routeConfig?.fallbackChain) ? routeConfig.fallbackChain : []
  const primary = routeConfig?.primary || activeId

  // Providers eligible for the fallback chain: everything except the
  // currently-primary route. Mock is only eligible when allowMock is on.
  const eligible = choices.filter((p) =>
    p.id !== primary && (p.id !== 'mock' || allowMock)
  )
  const notInChain = eligible.filter((p) => !chain.includes(p.id))

  function moveUp(idx)   { if (idx <= 0) return; reorder(idx, idx - 1) }
  function moveDown(idx) { if (idx >= chain.length - 1) return; reorder(idx, idx + 1) }
  function reorder(from, to) {
    const next = chain.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onSetFallbackChain?.(next)
  }
  function addToChain(id) {
    if (!id || chain.includes(id)) return
    onSetFallbackChain?.([...chain, id])
  }
  function removeFromChain(id) {
    onSetFallbackChain?.(chain.filter((c) => c !== id))
  }

  function labelFor(id) {
    return choices.find((p) => p.id === id)?.label || id
  }

  return (
    <div className="provider-route">
      <div className="provider-route__sub-heading" id="primary-route-heading">
        {t('provider.route.primary', language) || 'Primary'}
      </div>
      {choices.length === 0 && (
        <div className="provider-tab__hint">{t('provider.loading', language) || 'Loading providers…'}</div>
      )}
      <div role="radiogroup" aria-labelledby="primary-route-heading">
        {choices.map((p) => {
          const requiresApiKey = (p.authFields || []).some((f) => f.id === 'apiKey' && f.required)
          const saved = !!p.hasKey
          const isActive = p.id === activeId
          return (
            <label
              key={p.id}
              className={'provider-route__row' + (isActive ? ' provider-route__row--active' : '')}
            >
              <input
                type="radio"
                name="provider-primary"
                checked={isActive}
                onChange={() => selectProvider(p.id)}
                aria-label={`Set ${p.label} as primary route`}
              />
              <span className="provider-route__label">{p.label}</span>
              {!requiresApiKey && (
                <span className="provider-route__tag provider-route__tag--mock">
                  {t('provider.tag.no_key', language)}
                </span>
              )}
              {requiresApiKey && saved && (
                <span className="provider-route__tag provider-route__tag--saved">
                  {t('provider.tag.saved', language)}
                </span>
              )}
              {requiresApiKey && !saved && (
                <span className="provider-route__tag provider-route__tag--missing">
                  {t('provider.tag.missing', language)}
                </span>
              )}
            </label>
          )
        })}
      </div>

      <div className="provider-route__sub-heading" id="chain-route-heading">
        {t('provider.route.fallback_chain', language) || 'Fallback chain'}
      </div>
      <p className="provider-route__chain-hint">
        {t('provider.route.fallback_chain_hint', language)
          || 'Tried top-to-bottom when the primary fails. Skipped silently for providers that don’t support the requested mode (e.g. edit).'}
      </p>
      {chain.length === 0 && (
        <div className="provider-route__chain-empty">
          {t('provider.route.fallback_chain_empty', language) || 'No fallback configured.'}
        </div>
      )}
      <ol className="provider-route__chain" aria-labelledby="chain-route-heading">
        {chain.map((id, idx) => {
          const provider = choices.find((p) => p.id === id)
          const isUnknown = !provider
          return (
            <li
              key={id}
              className={'provider-route__chain-row' + (isUnknown ? ' provider-route__chain-row--unknown' : '')}
            >
              <span className="provider-route__chain-pos" aria-hidden="true">{idx + 1}.</span>
              <span className="provider-route__chain-label">{labelFor(id)}</span>
              {isUnknown && (
                <span className="provider-route__tag provider-route__tag--missing">
                  {t('provider.route.unknown_chain_entry', language) || 'unknown provider'}
                </span>
              )}
              <span className="provider-route__chain-actions">
                <button
                  type="button"
                  className="provider-route__chain-btn"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  aria-label={`Move ${labelFor(id)} up in fallback chain`}
                  title="Move up"
                >▲</button>
                <button
                  type="button"
                  className="provider-route__chain-btn"
                  onClick={() => moveDown(idx)}
                  disabled={idx === chain.length - 1}
                  aria-label={`Move ${labelFor(id)} down in fallback chain`}
                  title="Move down"
                >▼</button>
                <button
                  type="button"
                  className="provider-route__chain-btn provider-route__chain-btn--danger"
                  onClick={() => removeFromChain(id)}
                  aria-label={`Remove ${labelFor(id)} from fallback chain`}
                  title="Remove from chain"
                >×</button>
              </span>
            </li>
          )
        })}
      </ol>

      {notInChain.length > 0 && (
        <div className="provider-route__chain-add">
          <label className="provider-route__chain-add-label" htmlFor="provider-chain-add-select">
            {t('provider.route.add_to_chain', language) || 'Add to chain:'}
          </label>
          <select
            id="provider-chain-add-select"
            className="provider-route__chain-add-select"
            value=""
            onChange={(e) => {
              const v = e.target.value
              if (v) addToChain(v)
              e.target.value = ''
            }}
          >
            <option value="" disabled>—</option>
            {notInChain.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      <label className="provider-route__toggle">
        <input
          type="checkbox"
          checked={allowMock}
          onChange={(e) => onToggleMockFallback?.(e.target.checked)}
        />
        <span>
          {t('provider.route.allow_mock_fallback', language)
            || 'Use Mock fallback when no real provider is configured'}
        </span>
      </label>
    </div>
  )
}
