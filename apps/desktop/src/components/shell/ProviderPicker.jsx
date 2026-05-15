import React from 'react'
import { t } from '../../lib/i18n.js'
import { PROVIDERS } from '../../lib/providers/registry.js'
import {
  getKey, setKey, clearKey, maskKey,
  getActiveProviderId, setActiveProviderId
} from '../../lib/key-store.js'

/**
 * Provider picker UI mounted inside SettingsModal.
 *
 * Spec: docs/features/phase-3-model-adapter/spec.md §2.US1
 * Plan: docs/features/phase-3-model-adapter/plan.md §3 + §4.7
 *
 * Boss Q3 lock: lives in Settings modal; TopBar chip opens the modal.
 * Boss Q1 lock: keys persist in localStorage; warning chip is explicit.
 */
export default function ProviderPicker({ language = 'en', onChange }) {
  const [activeId, setActiveId] = React.useState(() => getActiveProviderId())
  // Track which providers have a saved key (boolean only — never the key text).
  const [keyStatus, setKeyStatus] = React.useState(() => {
    const out = {}
    for (const p of PROVIDERS) out[p.id] = !!getKey(p.id)
    return out
  })
  // Test-connection state per provider id.
  const [testResults, setTestResults] = React.useState({})
  const [revealId, setRevealId] = React.useState(null)         // which provider's key is shown right now
  const [keyDrafts, setKeyDrafts] = React.useState({})         // unsaved key input per provider

  // Auto-hide a revealed key after 30s so screenshots don't leak it.
  React.useEffect(() => {
    if (!revealId) return
    const t = setTimeout(() => setRevealId(null), 30_000)
    return () => clearTimeout(t)
  }, [revealId])

  function selectProvider(id) {
    setActiveProviderId(id)
    setActiveId(id)
    onChange?.(id)
  }

  function saveKey(providerId) {
    const draft = (keyDrafts[providerId] || '').trim()
    if (!draft) return
    setKey(providerId, draft)
    setKeyStatus(prev => ({ ...prev, [providerId]: true }))
    setKeyDrafts(prev => ({ ...prev, [providerId]: '' }))
    setTestResults(prev => ({ ...prev, [providerId]: null }))
  }

  function removeKey(providerId) {
    clearKey(providerId)
    setKeyStatus(prev => ({ ...prev, [providerId]: false }))
    setTestResults(prev => ({ ...prev, [providerId]: null }))
  }

  async function testConnection(provider) {
    const key = getKey(provider.id)
    if (provider.requiresApiKey && !key) {
      setTestResults(prev => ({ ...prev, [provider.id]: { ok: false, reason: 'invalid-key' } }))
      return
    }
    setTestResults(prev => ({ ...prev, [provider.id]: { pending: true } }))
    try {
      const r = await provider.testConnection(key)
      setTestResults(prev => ({ ...prev, [provider.id]: r }))
    } catch (err) {
      setTestResults(prev => ({ ...prev, [provider.id]: { ok: false, reason: 'network' } }))
    }
  }

  return (
    <div className="provider-picker">
      <div className="provider-picker__warning" role="note">
        ⚠ {t('provider.key.warning', language)}
      </div>
      {PROVIDERS.map((p) => {
        const isActive = p.id === activeId
        const saved = keyStatus[p.id]
        const test = testResults[p.id]
        const saved_key_value = saved ? getKey(p.id) : ''
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
              {!p.requiresApiKey && (
                <span className="provider-picker__tag provider-picker__tag--mock">
                  {t('provider.tag.no_key', language)}
                </span>
              )}
              {p.requiresApiKey && saved && (
                <span className="provider-picker__tag provider-picker__tag--saved">
                  {t('provider.tag.saved', language)}
                </span>
              )}
              {p.requiresApiKey && !saved && (
                <span className="provider-picker__tag provider-picker__tag--missing">
                  {t('provider.tag.missing', language)}
                </span>
              )}
            </label>

            {p.requiresApiKey && (
              <div className="provider-picker__key-row">
                {saved ? (
                  <>
                    <code className="provider-picker__masked-key">
                      {revealId === p.id ? saved_key_value : maskKey(saved_key_value)}
                    </code>
                    <button
                      type="button"
                      className="provider-picker__link"
                      onClick={() => setRevealId(revealId === p.id ? null : p.id)}
                    >
                      {revealId === p.id
                        ? t('provider.key.hide', language)
                        : t('provider.key.reveal', language)}
                    </button>
                    <button
                      type="button"
                      className="provider-picker__link provider-picker__link--danger"
                      onClick={() => removeKey(p.id)}
                    >
                      {t('provider.key.clear', language)}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="password"
                      className="provider-picker__input"
                      placeholder={t('provider.key.placeholder', language)}
                      value={keyDrafts[p.id] || ''}
                      onChange={(e) => setKeyDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="provider-picker__link"
                      onClick={() => saveKey(p.id)}
                      disabled={!(keyDrafts[p.id] || '').trim()}
                    >
                      {t('provider.key.save', language)}
                    </button>
                    {p.docsUrl && (
                      <a
                        href={p.docsUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="provider-picker__docs"
                      >{t('provider.key.get_one', language)} ↗</a>
                    )}
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
