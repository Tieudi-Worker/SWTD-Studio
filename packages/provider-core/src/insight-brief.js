/**
 * Insight Brief pipeline.
 *
 * Orchestrates webFetch + webSearch + lightweight extractors to produce a
 * structured `InsightBrief` JSON that the Creative Brief writer + Prompt
 * Composer consume downstream. Persists artifacts to
 *   <sku>/research/sources.json
 *   <sku>/research/insight-brief.json
 *
 * v1 extractors are heuristic/keyword-based on purpose — `karpathy-guidelines`
 * Rule "Use the model only for judgment calls": deterministic transforms
 * should be code, not LLM calls. When a future phase wires an LLM extractor
 * in, the sentinel-wrapped sanitized body is the input. Plan §4.5, D8.
 */

import { promises as fs, existsSync } from 'node:fs'
import path from 'node:path'

import { webFetch, webSearch, createMockSearchBackend } from './web-research.js'
import { providerError } from './error.js'
import { NOOP_LOGGER } from './logger.js'

const BRIEF_VERSION = '0.1.0'

const PRODUCT_KEYWORDS = [
  { key: 'materials', terms: ['wood', 'metal', 'plastic', 'leather', 'ceramic', 'glass', 'fabric', 'cotton', 'linen', 'silk', 'rubber', 'silicone', 'paper', 'cardboard', 'bamboo', 'acrylic'] },
  { key: 'features',  terms: ['waterproof', 'lightweight', 'durable', 'foldable', 'portable', 'adjustable', 'rechargeable', 'wireless', 'ergonomic', 'eco-friendly', 'reusable', 'compact'] }
]
const CUSTOMER_TRIGGERS = [
  'gift', 'birthday', 'anniversary', 'expecting', 'new mom', 'new dad', 'baby', 'wedding',
  'office', 'travel', 'kitchen', 'home', 'minimalist', 'luxury', 'budget', 'student',
  'pain', 'relief', 'comfort', 'safety', 'eco', 'sustainable', 'gift for her', 'gift for him'
]
const RISK_MARKERS = [
  'cure', 'treat', 'heal', 'guaranteed', 'fda approved', 'best in market', '100%'
]

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean).map((s) => String(s).trim()))).filter(Boolean)
}

function scanForTerms(text, terms) {
  if (!text) return []
  const lower = text.toLowerCase()
  return terms.filter((t) => lower.includes(t))
}

function excerpt(text, max = 280) {
  if (!text) return ''
  return text.replace(/\s+/g, ' ').slice(0, max)
}

function deriveCreativeDirection({ product, customer, market }) {
  const mustShow = uniq([
    ...product.materials.map((m) => `material: ${m}`),
    ...product.features.slice(0, 3).map((f) => `feature: ${f}`),
    ...customer.buyingTriggers.slice(0, 3).map((t) => `trigger: ${t}`)
  ])
  const mustAvoid = uniq([
    ...market.risks.map((r) => `claim risk: ${r}`),
    'AI-glossy generic background',
    'unrelated props'
  ])
  return {
    style: customer.audience?.includes('luxury') ? 'editorial' : 'lifestyle',
    mood: customer.painPoints.length > 0 ? 'reassuring' : 'aspirational',
    mustShow,
    mustAvoid
  }
}

/**
 * @param {import('./types.js').WebResearchInput} input
 * @param {object} ctx
 * @param {string} ctx.skuPath
 * @param {object} [ctx.searchBackend]   webSearch backend (default mock)
 * @param {object} [ctx.logger]
 * @param {AbortSignal} [ctx.signal]
 * @param {number} [ctx.fetchTimeoutMs]
 */
export async function buildInsightBrief(input, ctx = {}) {
  if (!input || typeof input !== 'object') {
    throw providerError('web-research', 'invalid-input', { hint: 'input object required' })
  }
  const skuPath = ctx.skuPath || input.skuPath
  if (!skuPath || typeof skuPath !== 'string') {
    throw providerError('web-research', 'invalid-input', { hint: 'skuPath required to persist brief' })
  }
  const logger = ctx.logger || NOOP_LOGGER
  const searchBackend = ctx.searchBackend || createMockSearchBackend()
  const urls = Array.isArray(input.urls) ? input.urls.filter(Boolean) : []
  const keywords = Array.isArray(input.keywords) ? input.keywords.filter(Boolean) : []

  /* 1. Fetch URLs in parallel — each result is sanitized + sentinel-wrapped. */
  const fetched = await Promise.all(urls.map(async (url) => {
    try {
      const r = await webFetch(url, { signal: ctx.signal, timeoutMs: ctx.fetchTimeoutMs })
      return r
    } catch (err) {
      logger.warn('insight-brief: webFetch failed', { url, hint: err.message })
      return null
    }
  }))
  const validFetches = fetched.filter(Boolean)

  /* 2. Search keyword + productName for additional market context. */
  const searchQueries = uniq([
    ...(input.productName ? [input.productName] : []),
    ...keywords
  ])
  const searchHits = []
  for (const q of searchQueries) {
    try {
      const hits = await webSearch(q, { backend: searchBackend, signal: ctx.signal })
      searchHits.push({ query: q, hits })
    } catch (err) {
      logger.warn('insight-brief: webSearch failed', { query: q, hint: err.message })
    }
  }

  /* 3. Aggregate the corpus + extract product / customer / market facts.    */
  const corpus = [
    input.productName,
    input.productInsight,
    input.customerInsight,
    ...validFetches.map((f) => f.textBody),
    ...searchHits.flatMap((s) => s.hits.map((h) => `${h.title} ${h.snippet}`))
  ].filter(Boolean).join('\n')

  const product = {
    name: input.productName || null,
    category: null,
    materials: scanForTerms(corpus, PRODUCT_KEYWORDS[0].terms),
    features: scanForTerms(corpus, PRODUCT_KEYWORDS[1].terms),
    differentiators: [],
    dimensions: null,
    useCase: null
  }
  const customer = {
    audience: input.customerInsight || null,
    painPoints: [],
    desires: [],
    buyingTriggers: scanForTerms(corpus, CUSTOMER_TRIGGERS),
    language: keywords.slice(0, 8)
  }
  const market = {
    marketplace: input.marketplace || null,
    competitors: validFetches.map((f) => {
      try { return new URL(f.url).hostname.replace(/^www\./, '') } catch { return null }
    }).filter(Boolean),
    visualPatterns: [],
    claims: [],
    risks: scanForTerms(corpus, RISK_MARKERS)
  }

  const creativeDirection = deriveCreativeDirection({ product, customer, market })

  /* 4. Provenance — record per-source flagged-passage audit trail.          */
  const sources = validFetches.map((f) => ({
    url: f.url,
    fetchedAt: f.fetchedAt,
    contentType: f.contentType,
    sanitized: f.sanitized,
    flaggedPassages: Array.isArray(f.flagged) ? f.flagged : [],
    excerpt: excerpt(f.textBody, 320)
  }))
  const searchProvenance = searchHits.map((s) => ({
    query: s.query,
    backend: searchBackend.id,
    hits: s.hits.map((h) => ({ title: h.title, url: h.url }))
  }))

  const brief = {
    product, customer, market, creativeDirection,
    meta: { generatedAt: Date.now(), version: BRIEF_VERSION, sources }
  }

  /* 5. Persist into <sku>/research/                                          */
  const researchDir = path.join(path.resolve(skuPath), 'research')
  if (!existsSync(researchDir)) await fs.mkdir(researchDir, { recursive: true })
  const briefPath = path.join(researchDir, 'insight-brief.json')
  const sourcesPath = path.join(researchDir, 'sources.json')
  await fs.writeFile(briefPath, JSON.stringify(brief, null, 2))
  await fs.writeFile(sourcesPath, JSON.stringify({
    fetched: sources,
    search: searchProvenance,
    generatedAt: brief.meta.generatedAt
  }, null, 2))

  return { brief, briefPath, sourcesPath }
}

/**
 * Read the persisted brief for an SKU. Returns null if not built yet.
 */
export async function getInsightBrief(skuPath) {
  if (!skuPath || typeof skuPath !== 'string') return null
  const briefPath = path.join(path.resolve(skuPath), 'research', 'insight-brief.json')
  if (!existsSync(briefPath)) return null
  try { return JSON.parse(await fs.readFile(briefPath, 'utf8')) } catch { return null }
}
