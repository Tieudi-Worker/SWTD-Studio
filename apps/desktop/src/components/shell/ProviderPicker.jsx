import React from 'react'
import { t } from '../../lib/i18n.js'
import {
  loadProviders,
  getActiveProviderId,
  setActiveProviderId
} from '../../lib/providers/registry.js'

const swtdProvider = typeof window !== 'undefined' ? window.swtdProvider : null

/**
 * Provider picker UI mounted inside SettingsModal.
 *
 * Phase 4.2 rewrite (US1 minimal cut + US2 secure-key surface):
 *  - Provider list comes from `window.swtdProvider.listProviders()` (main
 *    process is now the single source of truth for the provider set).
 *  - Key fields write through `saveKey` / `clearKey` IPC; the renderer
 *    NEVER reads the plaintext key back. Saved state is rendered as a
 *    `••••` mask + Replace button. (SC2.)
 *  - The Phase 3 "Reveal (30 s)" feature is removed — the renderer
 *    architecturally cannot retrieve the key after save in Phase 4.
 *  - Test connection delegates to `testProvider` IPC.
 *  - 5-tab Settings layout + new-provider (Gemini/Kie/Custom) panels are
 *    P4.3 work; this picker still renders one row per provider in the
 *    existing single-list layout to preserve Phase 3 UI behavior.
 *
 * Spec: docs/features/phase-4-provider-core/spec.md US1 / US2 / US4
 * Plan: docs/features/phase-4-provider-core/plan.md §4.2 + §4.7
 */
export default function ProviderPicker({ language = 'en', onChange }) {
  const [providers, setProviders] = React.useState([])
  const [vaultInfo, setVaultInfo] = React.useState(null)
  const [activeId, setActiveId] = React.useState(() => getActiveProviderId())
  // Test-connection state per provider id.
  const [testResults, setTestResults] = React.useState({})
  // Unsaved key drafts per provider id. Never persisted beyond this component.
  const [keyDrafts, setKeyDrafts] = React.useState({})
  const [pendingSave, setPendingSave] = React.useState({})

  const refresh = React.useCallback(async () => {
    if (!swtdProvider?.listProviders) {
      setProviders([])
      return
    }
    const res = await swtdProvider.listProviders().catch(() => null)
    if (!res?.ok) { setProviders([]); return }
    setProviders(res.providers || [])
    setVaultInfo(res.vault || null)
  }, [])

  React.useEffect(() => { refresh() }, [refresh])

  function selectProvider(id) {
    setActiveProviderId(id)
    setActiveId(id)
    onChange?.(id)
  }

  async function saveKey(providerId) {
    const draft = (keyDrafts[providerId] || '').trim()
    if (!draft) return
    setPendingSave((p) => ({ ...p, [providerId]: true }))
    try {
      const r = await swtdProvider.saveKey(providerId, draft)
      if (!r?.ok) throw new Error(r?.error || 'save failed')
      // Clear local draft so plaintext is gone from renderer memory.
      setKeyDrafts((p) => ({ ...p, [providerId]: '' }))
      setTestResults((p) => ({ ...p, [providerId]: null }))
      await refresh()
    } catch (err) {
      setTestResults((p) => ({ ...p, [providerId]: { ok: false, reason: 'invalid-response' } }))
    } finally {
      setPendingSave((p) => ({ ...p, [providerId]: false }))
    }
  }

  async function removeKey(providerId) {
    const r = await swtdProvider.clearKey(providerId).catch(() => null)
    if (r?.ok) {
      setTestResults((p) => ({ ...p, [providerId]: null }))
      await refresh()
    }
  }

  async function testConnection(provider) {
    setTestResults((p) => ({ ...p, [provider.id]: { pending: true } }))
    const r = await swtdProvider.testProvider(provider.id).catch(() => ({ ok: false, reason: 'network' }))
    setTestResults((p) => ({ ...p, [provider.id]: r }))
  }

  const warningText = vaultInfo?.encryptionAvailable
    ? t('provider.key.warning_v2', language) || 'API keys are stored via the OS keychain wrapper. Plaintext keys never leave main.'
    : t('provider.key.warning_aes', language) || 'OS encryption unavailable on this host — keys are AES-encrypted on disk with a derived key. Configure a system keyring for stronger protection.'

  return (
    <div className="provider-picker">
      <div className="provider-picker__warning" role="note">
        ⚠ {warningText}
      </div>
      {providers.length === 0 && (
        <div className="provider-picker__hint" role="note">
          {t('provider.loading', language) || 'Loading providers…'}
        </div>
      )}
      {providers.map((p) => {
        const isActive = p.id === activeId
        const saved = !!p.hasKey
        const requiresApiKey = (p.authFields || []).some((f) => f.id === 'apiKey' && f.required)
        const test = testResults[p.id]
        return (
          <div
            key={p.id}
            className={'provider-picker__row' + (isActive ? ' provider-picker__row--active' : '')}
          >
            <label className="provider-picker__select-row">
              <input
                type="radio"
                name="provider-active"
                checked={isActive}
                onChange={() => selectProvider(p.id)}
              />
              <span className="provider-picker__label">{p.label}</span>
              {!requiresApiKey && (
                <span className="provider-picker__tag provider-picker__tag--mock">
                  {t('provider.tag.no_key', language)}
                </span>
              )}
              {requiresApiKey && saved && (
                <span className="provider-picker__tag provider-picker__tag--saved">
                  {t('provider.tag.saved', language)}
                </span>
              )}
              {requiresApiKey && !saved && (
                <span className="provider-picker__tag provider-picker__tag--missing">
                  {t('provider.tag.missing', language)}
                </span>
              )}
            </label>

            {requiresApiKey && (
              <div className="provider-picker__key-row">
                {saved ? (
                  <>
                    <code className="provider-picker__masked-key">••••••••</code>
                    <button
                      type="button"
                      className="provider-picker__link provider-picker__link--danger"
                      onClick={() => removeKey(p.id)}
                    >{t('provider.key.clear', language)}</button>
                  </>
                ) : (
                  <>
                    <input
                      type="password"
                      className="provider-picker__input"
                      placeholder={t('provider.key.placeholder', language)}
                      value={keyDrafts[p.id] || ''}
                      onChange={(e) => setKeyDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="provider-picker__link"
                      onClick={() => saveKey(p.id)}
                      disabled={!(keyDrafts[p.id] || '').trim() || !!pendingSave[p.id]}
                    >{t('provider.key.save', language)}</button>
                  </>
                )}
              </div>
            )}

            <div className="provider-picker__test-row">
              <button
                type="button"
                className="provider-picker__link"
                onClick={() => testConnection(p)}
                disabled={test?.pending}
              >
                {test?.pending
                  ? t('provider.test.pending', language)
                  : t('provider.test.button', language)}
              </button>
              {test && !test.pending && (
                <span
                  className={
                    'provider-picker__test-result provider-picker__test-result--'
                    + (test.ok ? 'ok' : 'fail')
                  }
                >
                  {test.ok
                    ? t('provider.test.ok', language)
                    : (t('provider.test.fail.' + (test.reason || 'unknown'), language) || t('provider.test.fail.unknown', language))}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
