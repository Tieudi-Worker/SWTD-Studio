import React from 'react'
import { t } from '../../lib/i18n.js'
import ProviderPicker from './ProviderPicker.jsx'

/**
 * Settings modal — Phase 3.
 *
 * Hosts the ProviderPicker for now. Future settings (theme overrides,
 * density toggle, etc.) can land in the same modal as collapsible sections.
 *
 * Closes on Escape or backdrop click. Submit-style "OK" not needed: the
 * picker autosaves every change.
 */
export default function SettingsModal({ open, onClose, onActiveProviderChange, language = 'en' }) {
  React.useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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
            <h3 className="settings-section__title">{t('settings.provider.heading', language)}</h3>
            <p className="settings-section__hint">{t('settings.provider.hint', language)}</p>
            <ProviderPicker language={language} onChange={onActiveProviderChange} />
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
