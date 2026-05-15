/**
 * Brand context loader + parser.
 *
 * Reads `brand-dna.md` and `icp-cards.md` from disk following the
 * Boss-locked Q2 resolution rule: try SKU first, fall back to
 * workspace. If both are missing, return a context where every
 * brand/ICP value is null (composer will emit `[missing: …]`).
 *
 * The markdown structure is the SCALE-AI canonical layout
 * (brand-dna-builder.skill): top-level sections in ALL CAPS,
 * followed by `Field name: value` pairs. The IMAGE GENERATION
 * PROMPT MODIFIER paragraph is captured verbatim.
 *
 * Spec: docs/features/phase-2-template-engine/spec.md §2.US2 + Q2
 * Plan: docs/features/phase-2-template-engine/plan.md §4.4
 */

const api = typeof window !== 'undefined' ? window.swtd : undefined

/** Split markdown by ALL-CAPS section headings into a flat map. */
function splitSections(md) {
  if (!md || typeof md !== 'string') return {}
  // A "section header" line is ALL CAPS (allowing space, &, /, dash) with
  // no trailing punctuation, optionally preceded by ## markers.
  const lines = md.split(/\r?\n/)
  const sections = {}
  let current = null
  let buffer = []
  const HEADING = /^\s*#{0,3}\s*([A-Z][A-Z0-9 &/\-]{3,})\s*$/
  for (const line of lines) {
    const m = line.match(HEADING)
    if (m && /[A-Z]{2,}/.test(m[1])) {
      // Save the prior section
      if (current) sections[current] = buffer.join('\n').trim()
      current = m[1].trim()
      buffer = []
    } else if (current) {
      buffer.push(line)
    }
  }
  if (current) sections[current] = buffer.join('\n').trim()
  return sections
}

/** Pull `Key: value` (or `Key value`) pairs from a section body. */
function parseKeyValues(body) {
  if (!body) return {}
  const out = {}
  for (const line of body.split(/\r?\n/)) {
    // Match `Field name: value` or `Field name [hex]: value`
    const m = line.match(/^\s*([A-Z][A-Za-z][A-Za-z0-9 \-_/]*?)\s*(?:\[[^\]]+\])?\s*:\s*(.+)\s*$/)
    if (m) {
      const key = m[1].trim().toLowerCase().replace(/\s+/g, '_')
      out[key] = m[2].trim()
    }
  }
  return out
}

/** Soft color → human-readable name. Ported from meta-ads-generator-template
 *  (docs/audits/REPLIT_REFERENCE_DEEP_DIVE.md §2 — describeBrandColor). */
export function describeBrandColor(hex) {
  if (!hex || typeof hex !== 'string') return null
  const m = hex.match(/^#?([0-9a-f]{6})$/i)
  if (!m) return null
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lum = (max + min) / 2 / 255
  const sat = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255))
  // Hue family
  let family = 'gray'
  if (sat > 0.15) {
    if (r > g && r > b)       family = (g > b) ? 'orange' : 'red'
    else if (g > r && g > b)  family = (b > r) ? 'teal' : 'green'
    else if (b > r && b > g)  family = (r > g) ? 'purple' : 'blue'
    if (r > 200 && g > 200 && b < 100) family = 'yellow'
    if (r > 200 && g < 120 && b > 150) family = 'pink'
  }
  const tone = lum > 0.65 ? 'soft' : lum > 0.35 ? 'vibrant' : 'deep'
  if (family === 'gray') return lum > 0.7 ? 'light neutral' : (lum > 0.35 ? 'mid neutral' : 'deep neutral')
  return `${tone} ${family}`
}

/** Parse a brand-dna.md string into the variable map the composer expects. */
export function parseBrandDna(md) {
  const sections = splitSections(md || '')
  const overview = parseKeyValues(sections['BRAND OVERVIEW'])
  const visual = parseKeyValues(sections['VISUAL SYSTEM'])
  const product = parseKeyValues(sections['PRODUCT DETAILS'])
  const modifier = sections['IMAGE GENERATION PROMPT MODIFIER'] || null

  const primaryHex = visual.primary_color || null
  const accentHex = visual.accent_color || null

  return {
    values: {
      BRAND_NAME:                  overview.name,
      BRAND_TAGLINE:               overview.tagline,
      BRAND_POSITIONING:           overview.positioning,
      BRAND_VOICE_ADJECTIVES:      overview.voice_adjectives,
      BRAND_PRIMARY_COLOR:         primaryHex,
      BRAND_PRIMARY_COLOR_NAME:    describeBrandColor(primaryHex),
      BRAND_SECONDARY_COLOR:       visual.secondary_color,
      BRAND_ACCENT_COLOR:          accentHex,
      BRAND_FONT_PRIMARY:          visual.primary_font,
      BRAND_FONT_SECONDARY:        visual.secondary_font,
      // PRODUCT_PACKAGING_DESCRIPTION pulled from brand-dna PRODUCT DETAILS
      // (this is the brand's *typical* packaging — the brief.json variant is
      // SKU-specific and overrides via the spread order in buildContext).
      PRODUCT_PACKAGING_DESCRIPTION: product.physical_description
    },
    brandDnaModifier: modifier
  }
}

/** Parse icp-cards.md into the persona variables. Picks the first persona. */
export function parseIcpCards(md) {
  if (!md) return { values: {} }
  // Find the first persona block. Heuristic: a persona starts with a
  // header line containing the word PERSONA or a name in title case
  // followed by a sub-headline like "(buyer / user / champion)".
  const sections = splitSections(md)
  // SCALE-AI ICP format dimensions are typically: IDENTITY / LIFESTYLE AND VALUES /
  // THE SPECIFIC PAIN / BUYING TRIGGERS / OBJECTIONS AND HESITATIONS / LANGUAGE AND MEDIA
  const pain        = sections['THE SPECIFIC PAIN'] || sections['SPECIFIC PAIN'] || sections['PAIN'] || ''
  const triggers    = sections['BUYING TRIGGERS'] || sections['TRIGGERS'] || ''
  const objections  = sections['OBJECTIONS AND HESITATIONS'] || sections['OBJECTIONS'] || ''
  const language    = sections['LANGUAGE AND MEDIA'] || sections['LANGUAGE'] || ''
  const identityKvs = parseKeyValues(sections['IDENTITY'] || '')

  function flatten(body) {
    if (!body) return null
    // Collapse bullets + newlines into a `;`-joined line.
    return body.split(/\r?\n/)
      .map(l => l.replace(/^\s*[-*•]\s*/, '').trim())
      .filter(Boolean)
      .join('; ')
  }

  // Top VOC phrase: first quoted phrase or first bullet inside LANGUAGE AND MEDIA.
  let vocPhrase = null
  if (language) {
    const quoted = language.match(/"([^"\n]{4,})"/)
    if (quoted) vocPhrase = quoted[1]
    else {
      const firstBullet = language.split(/\r?\n/).find(l => /^\s*[-*•]/.test(l))
      if (firstBullet) vocPhrase = firstBullet.replace(/^\s*[-*•]\s*/, '').trim()
    }
  }

  return {
    values: {
      ICP_PERSONA_NAME: identityKvs.name || identityKvs.persona || null,
      ICP_PAIN:         flatten(pain),
      ICP_TRIGGER:      flatten(triggers),
      ICP_OBJECTION:    flatten(objections),
      ICP_VOC_PHRASE:   vocPhrase
    }
  }
}

/**
 * Read brand-dna.md + icp-cards.md from disk applying the Q2 rule.
 * Returns `{ brand, icp, source }` where source is per-file:
 *   { brandDna: 'sku'|'workspace'|'none', icpCards: 'sku'|'workspace'|'none' }
 *
 * Uses the new `swtd:read-brand-file` IPC (added in preload). If the
 * IPC is not available (e.g. running in plain renderer without
 * electron preload), returns empty context.
 *
 * @param {{ workspacePath: string, skuPath: string }} paths
 */
export async function loadBrandContext({ workspacePath, skuPath } = {}) {
  if (!api?.readBrandFile) {
    return {
      brand: { values: {} },
      icp: { values: {} },
      source: { brandDna: 'none', icpCards: 'none' }
    }
  }
  const [dnaRes, icpRes] = await Promise.all([
    api.readBrandFile({ workspacePath, skuPath, filename: 'brand-dna.md' }),
    api.readBrandFile({ workspacePath, skuPath, filename: 'icp-cards.md' })
  ])
  const brand = dnaRes?.ok ? parseBrandDna(dnaRes.content) : { values: {}, brandDnaModifier: null }
  const icp   = icpRes?.ok ? parseIcpCards(icpRes.content) : { values: {} }
  return {
    brand,
    icp,
    source: {
      brandDna: dnaRes?.source || 'none',
      icpCards: icpRes?.source || 'none'
    }
  }
}

/**
 * Merge brand + ICP + brief.json + Insight Brief + Creative Brief into the
 * flat context the Prompt Composer consumes. Spread order
 * (least → most specific): brand → icp → brief.json → InsightBrief →
 * CreativeBrief. Falsy values are dropped so a real value never gets
 * clobbered by null.
 *
 * Boss D6 (Phase 4): Insight Brief output feeds the composer directly via
 * the variable bag — templates that reference `{{PRODUCT_MATERIALS}}`,
 * `{{CUSTOMER_PAIN_POINTS}}`, `{{CREATIVE_MUST_SHOW}}`, etc. gain content
 * automatically when the operator has built a brief for the SKU. Plan §4.5.
 *
 * @param {{ brand?:object, icp?:object, brief?:object, insightBrief?:object, creativeBrief?:object }} args
 * @returns {{ values: Record<string,string>, brandDnaModifier?: string }}
 */
export function buildContext({ brand, icp, brief, insightBrief, creativeBrief } = {}) {
  const values = {}
  function spread(src) {
    if (!src?.values) return
    for (const [k, v] of Object.entries(src.values)) {
      if (v != null && v !== '') values[k] = v
    }
  }
  spread(brand)
  spread(icp)
  // brief.json fields → product variables
  if (brief) {
    if (brief.product_name) values.PRODUCT_NAME      = brief.product_name
    if (brief.category)     values.PRODUCT_CATEGORY  = brief.category
    if (brief.dimensions)   values.PRODUCT_DIMENSIONS = String(brief.dimensions)
    if (brief.occasion)     values.PRODUCT_OCCASION  = brief.occasion
    if (Array.isArray(brief.features) && brief.features.length) {
      values.FEATURE_LIST = brief.features.join(' · ')
    } else if (typeof brief.features === 'number' && brief.features > 0) {
      // brief.features may be just a count from validateSku — keep it useful
      values.FEATURE_LIST = `${brief.features} features`
    }
  }
  // Insight Brief fields → product/customer/market variables. Lists join
  // with ` · ` so they read naturally inside a prompt sentence.
  if (insightBrief) {
    const p = insightBrief.product || {}
    const c = insightBrief.customer || {}
    const m = insightBrief.market || {}
    if (p.name && !values.PRODUCT_NAME)         values.PRODUCT_NAME       = p.name
    if (p.category && !values.PRODUCT_CATEGORY) values.PRODUCT_CATEGORY   = p.category
    if (p.dimensions && !values.PRODUCT_DIMENSIONS) values.PRODUCT_DIMENSIONS = String(p.dimensions)
    if (p.useCase)                              values.PRODUCT_USE_CASE   = p.useCase
    if (Array.isArray(p.materials) && p.materials.length)             values.PRODUCT_MATERIALS = p.materials.join(' · ')
    if (Array.isArray(p.features) && p.features.length)               values.PRODUCT_FEATURES  = p.features.join(' · ')
    if (Array.isArray(p.differentiators) && p.differentiators.length) values.PRODUCT_DIFFERENTIATORS = p.differentiators.join(' · ')

    if (c.audience)                                                    values.CUSTOMER_AUDIENCE = c.audience
    if (Array.isArray(c.painPoints) && c.painPoints.length)            values.CUSTOMER_PAIN_POINTS = c.painPoints.join(' · ')
    if (Array.isArray(c.desires) && c.desires.length)                  values.CUSTOMER_DESIRES = c.desires.join(' · ')
    if (Array.isArray(c.buyingTriggers) && c.buyingTriggers.length)    values.CUSTOMER_BUYING_TRIGGERS = c.buyingTriggers.join(' · ')
    if (Array.isArray(c.language) && c.language.length)                values.CUSTOMER_LANGUAGE = c.language.join(' · ')

    if (m.marketplace)                                                 values.MARKET_MARKETPLACE = m.marketplace
    if (Array.isArray(m.competitors) && m.competitors.length)          values.MARKET_COMPETITORS = m.competitors.join(' · ')
    if (Array.isArray(m.visualPatterns) && m.visualPatterns.length)    values.MARKET_VISUAL_PATTERNS = m.visualPatterns.join(' · ')
    if (Array.isArray(m.claims) && m.claims.length)                    values.MARKET_CLAIMS = m.claims.join(' · ')
    if (Array.isArray(m.risks) && m.risks.length)                      values.MARKET_RISKS = m.risks.join(' · ')
  }
  // Creative Brief fields → creative-direction variables (most specific).
  // Fall back to the InsightBrief's embedded creativeDirection block if
  // the separate file has not been built yet.
  const direction = (creativeBrief && (creativeBrief.mustShow || creativeBrief.mustAvoid))
    ? creativeBrief
    : (insightBrief?.creativeDirection || null)
  if (direction) {
    if (direction.style)                                            values.CREATIVE_STYLE = direction.style
    if (direction.mood)                                             values.CREATIVE_MOOD  = direction.mood
    if (Array.isArray(direction.mustShow)  && direction.mustShow.length)  values.CREATIVE_MUST_SHOW  = direction.mustShow.join(' · ')
    if (Array.isArray(direction.mustAvoid) && direction.mustAvoid.length) values.CREATIVE_MUST_AVOID = direction.mustAvoid.join(' · ')
  }
  return {
    values,
    brandDnaModifier: brand?.brandDnaModifier || null
  }
}
