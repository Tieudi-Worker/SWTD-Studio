import React from 'react'
import { t } from '../../lib/i18n.js'

/**
 * InsightBriefViewer — read-only renderer for the Insight Brief + Creative
 * Brief JSON pair produced by `swtdProvider.researchInsight`.
 *
 * Plan §4.5: research output is consumed by the prompt composer, but the
 * operator also needs to inspect it to confirm extractions look right.
 * Sections: Product · Customer · Market · Creative Direction · Sources.
 *
 * The "Sources" section surfaces `flaggedPassages` — prompt-injection
 * candidates that the sanitizer quoted but kept for audit (Boss D8). The
 * operator should see those *quoted*, never executed.
 */
export default function InsightBriefViewer({ brief, creative, language = 'en' }) {
  if (!brief) {
    return (
      <div className="brief-viewer brief-viewer--empty">
        {t('research.brief.empty', language) || 'No Insight Brief yet for this SKU.'}
      </div>
    )
  }
  const product = brief.product || {}
  const customer = brief.customer || {}
  const market = brief.market || {}
  const direction = (creative && (creative.mustShow || creative.mustAvoid))
    ? creative
    : (brief.creativeDirection || {})
  const sources = brief.meta?.sources || []
  const generatedAt = brief.meta?.generatedAt ? new Date(brief.meta.generatedAt) : null

  return (
    <div className="brief-viewer">
      <div className="brief-viewer__head">
        <div className="brief-viewer__title">
          {t('research.brief.heading', language) || 'Insight Brief'}
        </div>
        {generatedAt && (
          <div className="brief-viewer__meta">
            {(() => {
              const fn = t('research.brief.generated_at', language)
              const stamp = generatedAt.toLocaleString()
              return typeof fn === 'function' ? fn(stamp) : stamp
            })()}
          </div>
        )}
      </div>

      <BriefSection title={t('research.brief.product', language) || 'Product'}>
        <BriefField label="Name" value={product.name} />
        <BriefField label="Category" value={product.category} />
        <BriefList  label="Materials" items={product.materials} />
        <BriefList  label="Features"  items={product.features} />
        <BriefList  label="Differentiators" items={product.differentiators} />
        <BriefField label="Dimensions" value={product.dimensions} />
        <BriefField label="Use case"  value={product.useCase} />
      </BriefSection>

      <BriefSection title={t('research.brief.customer', language) || 'Customer'}>
        <BriefField label="Audience"        value={customer.audience} />
        <BriefList  label="Pain points"     items={customer.painPoints} />
        <BriefList  label="Desires"         items={customer.desires} />
        <BriefList  label="Buying triggers" items={customer.buyingTriggers} />
        <BriefList  label="Customer language" items={customer.language} />
      </BriefSection>

      <BriefSection title={t('research.brief.market', language) || 'Market'}>
        <BriefField label="Marketplace"     value={market.marketplace} />
        <BriefList  label="Competitors"     items={market.competitors} />
        <BriefList  label="Visual patterns" items={market.visualPatterns} />
        <BriefList  label="Claims"          items={market.claims} />
        <BriefList  label="Claim risks"     items={market.risks} />
      </BriefSection>

      <BriefSection title={t('research.brief.creative_direction', language) || 'Creative direction'}>
        <BriefField label="Style"      value={direction.style} />
        <BriefField label="Mood"       value={direction.mood} />
        <BriefList  label="Must show"  items={direction.mustShow} />
        <BriefList  label="Must avoid" items={direction.mustAvoid} />
      </BriefSection>

      {sources.length > 0 && (
        <BriefSection title={t('research.brief.sources', language) || 'Sources'}>
          <ul className="brief-viewer__sources">
            {sources.map((src, idx) => (
              <li key={idx} className="brief-viewer__source">
                <a className="brief-viewer__source-link"
                   href={src.url}
                   target="_blank"
                   rel="noreferrer noopener">{src.url}</a>
                {Array.isArray(src.flaggedPassages) && src.flaggedPassages.length > 0 && (
                  <div className="brief-viewer__flagged" role="note">
                    <span className="brief-viewer__flagged-label">
                      {t('research.brief.flagged_label', language) || 'flagged passages (quoted, not executed):'}
                    </span>
                    <ul>
                      {src.flaggedPassages.map((line, i) => (
                        <li key={i}><code>{line}</code></li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </BriefSection>
      )}
    </div>
  )
}

function BriefSection({ title, children }) {
  return (
    <section className="brief-viewer__section">
      <h4 className="brief-viewer__section-title">{title}</h4>
      <div className="brief-viewer__section-body">
        {children}
      </div>
    </section>
  )
}

function BriefField({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="brief-viewer__field">
      <span className="brief-viewer__field-label">{label}</span>
      <span className="brief-viewer__field-value">{String(value)}</span>
    </div>
  )
}

function BriefList({ label, items }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <div className="brief-viewer__field">
      <span className="brief-viewer__field-label">{label}</span>
      <ul className="brief-viewer__chips">
        {items.map((item, i) => (
          <li key={i} className="brief-viewer__chip">{String(item)}</li>
        ))}
      </ul>
    </div>
  )
}
