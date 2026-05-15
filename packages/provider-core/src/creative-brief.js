/**
 * Creative Brief writer.
 *
 * Derives a per-SKU `{ style, mood, mustShow, mustAvoid }` direction from an
 * existing InsightBrief and writes it to `<sku>/research/creative-brief.json`.
 *
 * The Prompt Composer (renderer-side) reads this artifact + the InsightBrief
 * and merges the values into the variable bag before composing per-slot
 * prompts. v1 reuses the `creativeDirection` block the InsightBrief already
 * produced so a future split can swap to a heavier LLM-driven writer without
 * touching the composer.
 *
 * Plan §4.5.
 */

import { promises as fs, existsSync } from 'node:fs'
import path from 'node:path'

const CREATIVE_BRIEF_VERSION = '0.1.0'

/**
 * @param {import('./types.js').InsightBrief} insightBrief
 * @param {string} skuPath
 */
export async function buildCreativeBrief(insightBrief, skuPath) {
  if (!insightBrief || typeof insightBrief !== 'object') {
    throw new TypeError('buildCreativeBrief: insightBrief required')
  }
  if (!skuPath || typeof skuPath !== 'string') {
    throw new TypeError('buildCreativeBrief: skuPath required')
  }
  const seed = insightBrief.creativeDirection || {}
  const brief = {
    style: seed.style || null,
    mood: seed.mood || null,
    mustShow: Array.isArray(seed.mustShow) ? [...seed.mustShow] : [],
    mustAvoid: Array.isArray(seed.mustAvoid) ? [...seed.mustAvoid] : [],
    meta: {
      generatedAt: Date.now(),
      version: CREATIVE_BRIEF_VERSION,
      sourceInsightBriefAt: insightBrief.meta?.generatedAt || null
    }
  }
  const researchDir = path.join(path.resolve(skuPath), 'research')
  if (!existsSync(researchDir)) await fs.mkdir(researchDir, { recursive: true })
  const briefPath = path.join(researchDir, 'creative-brief.json')
  await fs.writeFile(briefPath, JSON.stringify(brief, null, 2))
  return { brief, briefPath }
}

export async function getCreativeBrief(skuPath) {
  if (!skuPath || typeof skuPath !== 'string') return null
  const briefPath = path.join(path.resolve(skuPath), 'research', 'creative-brief.json')
  if (!existsSync(briefPath)) return null
  try { return JSON.parse(await fs.readFile(briefPath, 'utf8')) } catch { return null }
}
