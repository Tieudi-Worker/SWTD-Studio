import React from 'react'
import { t } from '../../lib/i18n.js'
import {
  getActiveProviderId,
  setActiveProviderId
} from '../../lib/providers/registry.js'

/**
 * Provider picker — Phase 4.3 slim default-route selector.
 *
 * Lives inside `SettingsModal.jsx` below the 5-tab section. Key fields,
 * Save / Replace, and Test connection moved into `ProviderSettingsTab.jsx`
 * — this component only picks the primary provider for the per-slot
 * Generate button and toggles `allowMockFallback`.
 *
 * The radio selection writes to both:
 *   - `setActiveProviderId(id)` — renderer-side picker preference
 *   - `swtdProvider.setRouteConfig({ primary: id })` via the parent's
 *     `onChange` handler — main-side fallback router primary
 *
 * Plan §4.4 + spec §2 US6.
 */
export default function ProviderPicker({
  language = 'en',
  providers = [],
  routeConfig = null,
  onChange,
  onToggleMockFallback
}) {
  const [activeId, setActiveId] = React.useState(() => getActiveProviderId())

  // Keep renderer pref + main route config in sync when the modal opens
  // with a different primary already configured (e.g. a previous session).
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

  return (
    <div className="provider-route">
      {choices.length === 0 && (
        <div className="provider-tab__hint">{t('provider.loading', language) || 'Loading providers…'}</div>
      )}
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
