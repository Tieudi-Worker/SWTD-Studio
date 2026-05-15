import React from 'react'
import { t } from '../../lib/i18n.js'

const swtdProvider = typeof window !== 'undefined' ? window.swtdProvider : null

/**
 * Generic single-provider Settings panel.
 *
 * Renders an authFields-driven form for one provider entry returned by
 * `swtdProvider.listProviders()`. Saves the secret apiKey through the
 * dedicated saveKey IPC; renders the saved state as `••••••••` (the
 * preload bridge architecturally cannot return the plaintext key after
 * save — SC2).
 *
 * The Custom Provider tab also persists the non-secret triple
 * (providerName / baseUrl / optional modelPrefix) via the
 * `saveCustomConfig` IPC; saving re-registers the adapter so the next
 * generateImage call routes through the configured base URL.
 *
 * Plan §4.4 + spec §2 US1.
 */
export default function ProviderSettingsTab({
  provider, language = 'en', initialCustomConfig = null, onRefresh
}) {
  const requiresApiKey = (provider.authFields || []).some((f) => f.id === 'apiKey' && f.required)
  const isCustom = provider.id === 'custom'

  // Local-only drafts — never persisted in renderer state across saves.
  const [draftKey, setDraftKey] = React.useState('')
  const [savingKey, setSavingKey] = React.useState(false)
  const [testResult, setTestResult] = React.useState(null)

  // Custom Provider config (non-secret) — operator types name + baseUrl +
  // optional modelPrefix here. Hydrated from `initialCustomConfig` so the
  // operator can review the current configuration without re-typing.
  const [customName, setCustomName] = React.useState(initialCustomConfig?.providerName || '')
  const [customBaseUrl, setCustomBaseUrl] = React.useState(initialCustomConfig?.baseUrl || '')
  const [customPrefix, setCustomPrefix] = React.useState(initialCustomConfig?.modelPrefix || '')
  const [savingCustom, setSavingCustom] = React.useState(false)
  const [customError, setCustomError] = React.useState(null)

  React.useEffect(() => {
    setCustomName(initialCustomConfig?.providerName || '')
    setCustomBaseUrl(initialCustomConfig?.baseUrl || '')
    setCustomPrefix(initialCustomConfig?.modelPrefix || '')
  }, [initialCustomConfig?.providerName, initialCustomConfig?.baseUrl, initialCustomConfig?.modelPrefix])

  function isValidUrl(url) {
    try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false }
  }

  async function saveKey() {
    const trimmed = draftKey.trim()
    if (!trimmed) return
    setSavingKey(true)
    try {
      const r = await swtdProvider.saveKey(provider.id, trimmed)
      if (!r?.ok) {
        setTestResult({ ok: false, reason: 'invalid-response' })
        return
      }
      setDraftKey('')
      setTestResult(null)
      onRefresh?.()
    } finally {
      setSavingKey(false)
    }
  }

  async function clearKey() {
    const r = await swtdProvider.clearKey(provider.id).catch(() => null)
    if (r?.ok) {
      setTestResult(null)
      onRefresh?.()
    }
  }

  async function testConnection() {
    setTestResult({ pending: true })
    const r = await swtdProvider.testProvider(provider.id).catch(() => ({ ok: false, reason: 'network' }))
    setTestResult(r)
  }

  async function saveCustomConfig() {
    setCustomError(null)
    if (!customName.trim()) {
      setCustomError(t('provider.settings.field.required', language) || 'Provider Name is required')
      return
    }
    if (!isValidUrl(customBaseUrl.trim())) {
      setCustomError(t('provider.settings.field.url_invalid', language) || 'Base URL must be a valid http(s) URL')
      return
    }
    setSavingCustom(true)
    try {
      const r = await swtdProvider.saveCustomConfig({
        providerName: customName.trim(),
        baseUrl: customBaseUrl.trim(),
        modelPrefix: customPrefix.trim() || null
      })
      if (!r?.ok) {
        setCustomError(r?.error || 'Save failed')
        return
      }
      onRefresh?.()
    } finally {
      setSavingCustom(false)
    }
  }

  async function clearCustomConfig() {
    const r = await swtdProvider.clearCustomConfig().catch(() => null)
    if (r?.ok) {
      setCustomName(''); setCustomBaseUrl(''); setCustomPrefix('')
      onRefresh?.()
    }
  }

  const saved = !!provider.hasKey
  const hasCustomConfig = isCustom && !!initialCustomConfig
  const apiKeyField = (provider.authFields || []).find((f) => f.id === 'apiKey')
  const selectFields = (provider.authFields || []).filter((f) => f.type === 'select')

  return (
    <div className="provider-tab">
      <div className="provider-tab__head">
        <div className="provider-tab__title">{provider.label}</div>
        <div className="provider-tab__cap-row">
          {provider.capabilities?.supportsGenerate && (
            <span className="provider-tab__cap">generate</span>
          )}
          {provider.capabilities?.supportsEdit && (
            <span className="provider-tab__cap provider-tab__cap--edit">edit</span>
          )}
          {requiresApiKey && saved && (
            <span className="provider-tab__cap provider-tab__cap--saved">
              {t('provider.tag.saved', language)}
            </span>
          )}
          {requiresApiKey && !saved && (
            <span className="provider-tab__cap provider-tab__cap--missing">
              {t('provider.tag.missing', language)}
            </span>
          )}
        </div>
      </div>

      {isCustom && (
        <div className="provider-tab__custom">
          <p className="provider-tab__hint">
            {t('provider.settings.custom.hint', language)
              || 'Configure an OpenAI-compatible endpoint (e.g. a 9router proxy). Provider Name and Base URL are required; Model Prefix is optional.'}
          </p>
          <label className="provider-tab__row">
            <span className="provider-tab__label">
              {t('provider.settings.field.providerName', language)} *
            </span>
            <input
              type="text"
              className="provider-tab__input"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. 9router"
            />
          </label>
          <label className="provider-tab__row">
            <span className="provider-tab__label">
              {t('provider.settings.field.baseUrl', language)} *
            </span>
            <input
              type="url"
              className="provider-tab__input"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="https://9router.example.com"
            />
          </label>
          <label className="provider-tab__row">
            <span className="provider-tab__label">
              {t('provider.settings.field.modelPrefix', language)}
            </span>
            <input
              type="text"
              className="provider-tab__input"
              value={customPrefix}
              onChange={(e) => setCustomPrefix(e.target.value)}
              placeholder="v1"
            />
          </label>
          {customError && (
            <div className="provider-tab__error" role="alert">{customError}</div>
          )}
          <div className="provider-tab__row provider-tab__row--actions">
            <button
              type="button"
              className="atom-btn atom-btn--primary atom-btn--sm"
              onClick={saveCustomConfig}
              disabled={savingCustom}
            >
              {t('provider.settings.save_config', language) || 'Save configuration'}
            </button>
            {hasCustomConfig && (
              <button
                type="button"
                className="atom-btn atom-btn--secondary atom-btn--sm"
                onClick={clearCustomConfig}
              >
                {t('provider.settings.clear_config', language) || 'Clear configuration'}
              </button>
            )}
          </div>
        </div>
      )}

      {requiresApiKey && (
        <div className="provider-tab__keyblock">
          <div className="provider-tab__label">
            {apiKeyField?.label || t('provider.settings.field.apiKey', language) || 'API Key'}
          </div>
          {saved ? (
            <div className="provider-tab__row provider-tab__row--actions">
              <code className="provider-picker__masked-key">••••••••</code>
              <button
                type="button"
                className="provider-picker__link provider-picker__link--danger"
                onClick={clearKey}
              >{t('provider.settings.replace_key', language) || t('provider.key.clear', language)}</button>
            </div>
          ) : (
            <div className="provider-tab__row provider-tab__row--actions">
              <input
                type="password"
                className="provider-tab__input"
                placeholder={t('provider.key.placeholder', language)}
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
              />
              <button
                type="button"
                className="atom-btn atom-btn--primary atom-btn--sm"
                onClick={saveKey}
                disabled={!draftKey.trim() || savingKey}
              >{t('provider.key.save', language)}</button>
            </div>
          )}
        </div>
      )}

      {selectFields.length > 0 && (
        <div className="provider-tab__defaults">
          <div className="provider-tab__label">
            {t('provider.settings.defaults_heading', language) || 'Default model / quality'}
          </div>
          {selectFields.map((f) => (
            <div key={f.id} className="provider-tab__row">
              <span className="provider-tab__sublabel">{f.label || f.id}</span>
              <span className="provider-tab__static">
                {f.default || (Array.isArray(f.options) ? f.options[0] : '—')}
              </span>
            </div>
          ))}
          <div className="provider-tab__hint provider-tab__hint--small">
            {t('provider.settings.defaults_locked_hint', language)
              || 'These defaults are locked in v1. Per-call overrides are supported via the image_generate input.'}
          </div>
        </div>
      )}

      <div className="provider-tab__test-row">
        <button
          type="button"
          className="provider-picker__link"
          onClick={testConnection}
          disabled={testResult?.pending}
        >{testResult?.pending ? t('provider.test.pending', language) : t('provider.test.button', language)}</button>
        {testResult && !testResult.pending && (
          <span
            className={
              'provider-picker__test-result provider-picker__test-result--'
              + (testResult.ok ? 'ok' : 'fail')
            }
          >
            {testResult.ok
              ? t('provider.test.ok', language)
              : (t('provider.test.fail.' + (testResult.reason || 'unknown'), language) || t('provider.test.fail.unknown', language))}
          </span>
        )}
      </div>
    </div>
  )
}
