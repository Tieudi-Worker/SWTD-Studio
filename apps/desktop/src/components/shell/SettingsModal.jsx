import React from 'react'
import { t } from '../../lib/i18n.js'
import ProviderSettingsTab from './ProviderSettingsTab.jsx'
import ProviderPicker from './ProviderPicker.jsx'

const swtdProvider = typeof window !== 'undefined' ? window.swtdProvider : null

// Boss-locked order (D1 / plan §4.4 §4): OpenAI, Gemini, Kie.ai, Fal.ai,
// Custom. Mock is the always-available development fallback and surfaces
// through the Default Route section, not its own tab.
const TAB_ORDER = ['openai', 'gemini', 'kie', 'fal', 'custom']
const TAB_KEY_PREFIX = 'provider.settings.tab.'

/**
 * Settings modal — Phase 4.3 5-tab layout.
 *
 * Hosts one ProviderSettingsTab per Boss-locked provider, plus a Default
 * Route section that surfaces the renderer-side picker preference + the
 * fallback chain configured in main. The legacy Phase-3 picker has been
 * slimmed and now lives below the tab content as a route selector + a
 * "Use Mock fallback when no real provider configured" toggle.
 *
 * Plan §4.4 + spec §2 US1 / US6.
 */
export default function SettingsModal({ open, onClose, onActiveProviderChange, language = 'en' }) {
  const [providers, setProviders] = React.useState([])
  const [vaultInfo, setVaultInfo] = React.useState(null)
  const [customConfig, setCustomConfig] = React.useState(null)
  const [routeConfig, setRouteConfig] = React.useState(null)
  const [activeTab, setActiveTab] = React.useState('openai')

  const refresh = React.useCallback(async () => {
    if (!swtdProvider?.listProviders) return
    const [listRes, customRes, routeRes] = await Promise.all([
      swtdProvider.listProviders().catch(() => null),
      swtdProvider.getCustomConfig?.().catch(() => null),
      swtdProvider.getRouteConfig?.().catch(() => null)
    ])
    if (listRes?.ok) {
      setProviders(listRes.providers || [])
      setVaultInfo(listRes.vault || null)
    }
    if (customRes?.ok) setCustomConfig(customRes.config || null)
    if (routeRes?.ok) setRouteConfig(routeRes.route || null)
  }, [])

  React.useEffect(() => {
    if (!open) return
    refresh()
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, refresh])

  if (!open) return null

  const tabProviders = TAB_ORDER
    .map((id) => providers.find((p) => p.id === id))
    .filter(Boolean)
  const activeProvider = tabProviders.find((p) => p.id === activeTab) || tabProviders[0]

  const warningText = vaultInfo?.encryptionAvailable
    ? (t('provider.key.warning_v2', language) || 'API keys are stored via the OS keychain wrapper. Plaintext keys never leave main.')
    : (t('provider.key.warning_aes', language) || 'OS encryption unavailable on this host — keys are AES-encrypted on disk with a derived key. Configure a system keyring for stronger protection.')

  async function handleAllowMockFallback(next) {
    if (!swtdProvider?.setRouteConfig) return
    const r = await swtdProvider.setRouteConfig({ allowMockFallback: !!next }).catch(() => null)
    if (r?.ok) setRouteConfig(r.route)
  }

  async function handleSetPrimary(providerId) {
    if (!swtdProvider?.setRouteConfig) return
    const r = await swtdProvider.setRouteConfig({ primary: providerId }).catch(() => null)
    if (r?.ok) setRouteConfig(r.route)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card modal-card--settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-card__head">
          <h2 className="modal-card__title">{t('settings.title', language)}</h2>
          <button
            type="button"
            className="modal-card__close"
            onClick={onClose}
            aria-label={t('settings.close', language)}
          >×</button>
        </div>
        <div className="modal-card__body">
          <section className="settings-section">
            <h3 className="settings-section__title">
              {t('settings.provider.heading', language)}
            </h3>
            <div className="provider-picker__warning" role="note">⚠ {warningText}</div>

            <div className="provider-tabs" role="tablist" aria-label="Provider tabs">
              {tabProviders.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === p.id}
                  className={'provider-tabs__tab' + (activeTab === p.id ? ' provider-tabs__tab--active' : '')}
                  onClick={() => setActiveTab(p.id)}
                >
                  <span>{t(TAB_KEY_PREFIX + p.id, language) || p.label}</span>
                  {p.hasKey && <span className="provider-tabs__dot provider-tabs__dot--ok" aria-hidden="true" />}
                  {!p.hasKey && (p.authFields || []).some((f) => f.id === 'apiKey' && f.required) && (
                    <span className="provider-tabs__dot provider-tabs__dot--miss" aria-hidden="true" />
                  )}
                  {routeConfig?.primary === p.id && (
                    <span className="provider-tabs__pin" title={t('provider.route.primary', language) || 'Primary'}>★</span>
                  )}
                </button>
              ))}
            </div>

            <div className="provider-tabs__panel" role="tabpanel">
              {activeProvider ? (
                <ProviderSettingsTab
                  provider={activeProvider}
                  language={language}
                  initialCustomConfig={activeProvider.id === 'custom' ? customConfig : null}
                  onRefresh={refresh}
                />
              ) : (
                <div className="provider-tab__hint">{t('provider.loading', language) || 'Loading providers…'}</div>
              )}
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">
              {t('provider.route.heading', language) || 'Default route'}
            </h3>
            <p className="settings-section__hint">
              {t('provider.route.hint', language)
                || 'Pick the provider that the per-slot Generate button calls first. Fallback chain configuration is operator-managed below.'}
            </p>
            <ProviderPicker
              language={language}
              providers={tabProviders}
              routeConfig={routeConfig}
              onChange={(id) => {
                onActiveProviderChange?.(id)
                handleSetPrimary(id)
              }}
              onToggleMockFallback={handleAllowMockFallback}
            />
          </section>
        </div>
        <div className="modal-card__footer">
          <button
            type="button"
            className="atom-btn atom-btn--secondary atom-btn--sm"
            onClick={onClose}
          >{t('settings.close', language)}</button>
        </div>
      </div>
    </div>
  )
}
