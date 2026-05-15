/**
 * Predicate registry — the small fixed set of predicate kinds that rule packs
 * can compose. Every predicate is a pure function that takes a normalised
 * subject view and a predicate config, and returns either `null` (no match)
 * or a `PredicateHit` describing the matched text + an excerpt.
 *
 * Plan §3 (predicates/) + §4.3 (rule-pack DSL).
 *
 * Allowed kinds:
 *   - containsAnyTokens
 *   - containsRegex
 *   - mustShowIncludes
 *   - tokenLooksLikeTrademark
 *   - compositeAnyOf
 *   - compositeAllOf
 *
 * Anything else fails validation in rule-loader.js — the engine never tries
 * to interpret unknown kinds. (Plan §5 Q3 — keep the DSL small + auditable.)
 */

import { complianceError } from '../error.js'
import { excerptAround } from '../excerpt.js'

export const PREDICATE_KINDS = Object.freeze([
  'containsAnyTokens',
  'containsRegex',
  'mustShowIncludes',
  'tokenLooksLikeTrademark',
  'compositeAnyOf',
  'compositeAllOf'
])

/**
 * @typedef {Object} PredicateHit
 * @property {string} matched      The literal substring that matched
 * @property {string} excerpt      Up to 200 chars of context around the match
 * @property {string} [source]     Which subject field the hit came from (e.g. 'mustShow[1]')
 */

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildTokenRegex(token, mode) {
  if (mode === 'literal') return null // signal indexOf path
  const esc = escapeRegex(token)
  const startsWithWord = /^\w/.test(token)
  const endsWithWord   = /\w$/.test(token)
  const prefix = startsWithWord ? '\\b' : ''
  const suffix = endsWithWord   ? '\\b' : ''
  return new RegExp(prefix + esc + suffix, 'i')
}

function findTokenInText(text, token, mode) {
  if (typeof text !== 'string' || text.length === 0) return null
  if (typeof token !== 'string' || token.length === 0) return null
  if (mode === 'literal') {
    const idx = text.toLowerCase().indexOf(token.toLowerCase())
    return idx < 0 ? null : { idx, length: token.length, matched: text.slice(idx, idx + token.length) }
  }
  const re = buildTokenRegex(token, mode)
  const m = re.exec(text)
  return m ? { idx: m.index, length: m[0].length, matched: m[0] } : null
}

/* -------------------------------------------------------------------------- */
/* Individual predicate implementations                                        */
/* -------------------------------------------------------------------------- */

function containsAnyTokens(norm, config) {
  if (!config || !Array.isArray(config.tokens) || config.tokens.length === 0) return null
  const mode = config.tokenMode || 'case-insensitive-word-boundary'
  for (const passage of norm.textPassages) {
    for (const token of config.tokens) {
      let hit = null
      if (config.regex) {
        try {
          const re = new RegExp(token, 'i')
          const m = re.exec(passage.text)
          if (m) hit = { idx: m.index, length: m[0].length, matched: m[0] }
        } catch (err) {
          throw complianceError('predicate-error', { hint: `bad regex token: ${token}` })
        }
      } else {
        hit = findTokenInText(passage.text, token, mode)
      }
      if (hit) {
        return {
          matched: hit.matched,
          excerpt: excerptAround(passage.text, hit.idx, hit.length),
          source: passage.source
        }
      }
    }
  }
  return null
}

function containsRegex(norm, config) {
  if (!config || typeof config.pattern !== 'string') return null
  let re
  try {
    re = new RegExp(config.pattern, typeof config.flags === 'string' ? config.flags : 'i')
  } catch (err) {
    throw complianceError('predicate-error', { hint: `bad regex pattern: ${config.pattern}` })
  }
  for (const passage of norm.textPassages) {
    const m = re.exec(passage.text)
    if (m) {
      return {
        matched: m[0],
        excerpt: excerptAround(passage.text, m.index, m[0].length),
        source: passage.source
      }
    }
  }
  return null
}

function mustShowIncludes(norm, config) {
  if (!config || !Array.isArray(config.tokens) || config.tokens.length === 0) return null
  const mode = config.tokenMode || 'case-insensitive-word-boundary'
  for (let i = 0; i < norm.mustShow.length; i++) {
    const entry = norm.mustShow[i]
    if (typeof entry !== 'string') continue
    for (const token of config.tokens) {
      const hit = findTokenInText(entry, token, mode)
      if (hit) {
        return {
          matched: hit.matched,
          excerpt: excerptAround(entry, hit.idx, hit.length),
          source: `mustShow[${i}]`
        }
      }
    }
  }
  return null
}

function tokenLooksLikeTrademark(norm, config) {
  const brands = []
  if (config && Array.isArray(config.seedBrands)) brands.push(...config.seedBrands)
  if (Array.isArray(norm.competitors)) brands.push(...norm.competitors)
  if (brands.length === 0) return null
  // Word-boundary match in any text passage.
  for (const passage of norm.textPassages) {
    for (const raw of brands) {
      const brand = typeof raw === 'string' ? raw.trim() : ''
      if (brand.length < 2) continue // skip noise like single letters
      const hit = findTokenInText(passage.text, brand, 'case-insensitive-word-boundary')
      if (hit) {
        return {
          matched: hit.matched,
          excerpt: excerptAround(passage.text, hit.idx, hit.length),
          source: passage.source
        }
      }
    }
  }
  return null
}

function compositeAnyOf(norm, config) {
  if (!config || !Array.isArray(config.predicates)) return null
  for (const child of config.predicates) {
    const hit = runPredicate(child, norm)
    if (hit) return hit
  }
  return null
}

function compositeAllOf(norm, config) {
  if (!config || !Array.isArray(config.predicates) || config.predicates.length === 0) return null
  let last = null
  for (const child of config.predicates) {
    const hit = runPredicate(child, norm)
    if (!hit) return null
    last = hit
  }
  // Return the last hit; its excerpt is the most specific evidence in the chain.
  return last
}

const REGISTRY = Object.freeze({
  containsAnyTokens,
  containsRegex,
  mustShowIncludes,
  tokenLooksLikeTrademark,
  compositeAnyOf,
  compositeAllOf
})

/**
 * Dispatch a single predicate config against the normalised subject view.
 *
 * @param {object} config        e.g. `{ kind: 'containsAnyTokens', tokens: [...] }`
 * @param {object} norm          Normalised subject view (see subjects.js)
 * @returns {PredicateHit|null}
 */
export function runPredicate(config, norm) {
  if (!config || typeof config.kind !== 'string') {
    throw complianceError('predicate-error', { hint: 'predicate missing kind' })
  }
  const fn = REGISTRY[config.kind]
  if (!fn) {
    throw complianceError('predicate-error', { hint: `unknown predicate kind: ${config.kind}` })
  }
  return fn(norm, config)
}

/** Exposed for the rule-loader so it can statically validate predicate kinds. */
export function isKnownPredicateKind(kind) {
  return PREDICATE_KINDS.includes(kind)
}
