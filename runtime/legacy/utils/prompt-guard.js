/**
 * Prompt Guard — runtime sanitizer for image-gen prompts.
 *
 * Enforces the rules in xp/prompt-anti-patterns.md and config/prompts/slot-constraints.json.
 * Called by image-generator.js before every KIE.ai API call.
 *
 * Responsibilities:
 *  - Look up per-slot constraints (max words, forbidden phrases, inject flags).
 *  - Check the prompt, log violations, and optionally strip forbidden phrases.
 *  - Expose helper `shouldInject(field, slotNumber)` so the prompt builder can
 *    decide whether to include see_through_cutout_rule / lighting_harmony_rule / etc.
 *  - NEVER silently rewrite product-identity content; only strip clearly harmful
 *    anti-pattern phrases (negations, layer-spec dumps).
 */
const fs = require('fs');
const path = require('path');

const CONSTRAINTS_PATH = path.join(__dirname, '..', 'config', 'prompts', 'slot-constraints.json');

let _cache = null;
let _cacheStat = 0;

function loadConstraints() {
  try {
    const stat = fs.statSync(CONSTRAINTS_PATH).mtimeMs;
    if (_cache && stat === _cacheStat) return _cache;
    _cache = JSON.parse(fs.readFileSync(CONSTRAINTS_PATH, 'utf8'));
    _cacheStat = stat;
    return _cache;
  } catch (err) {
    return {
      global: {
        max_words: 250,
        hard_max_words: 350,
        forbidden_phrases: [],
        inject_see_through_rule: false,
        inject_lighting_harmony_rule: false,
        inject_product_structure: false,
        inject_critical_structure: true,
      },
    };
  }
}

function slotConfig(slotNumber) {
  const all = loadConstraints();
  // Allow numeric slot IDs (1-8) and string keys like 'video_scene'
  const key = typeof slotNumber === 'number'
    ? `slot${slotNumber}`
    : String(slotNumber);
  const slot = all[key] || {};
  return { ...all.global, ...slot };
}

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Check whether a given inject field should be included for this slot.
 * Used by image-generator.js _structureRules() to gate:
 *   - see_through_cutout_rule
 *   - lighting_harmony_rule
 *   - product_structure
 *   - critical_structure
 *
 * @param {string} field - one of: 'see_through_rule' | 'lighting_harmony_rule' | 'product_structure' | 'critical_structure'
 * @param {number} slotNumber
 * @returns {boolean}
 */
function shouldInject(field, slotNumber) {
  const cfg = slotConfig(slotNumber);
  const key = `inject_${field}`;
  return cfg[key] !== false;
}

/**
 * Should Flux Kontext Pro be used as a FALLBACK (option 2) for this slot
 * when the primary nano-banana-pro output fails QC?
 * Primary model is always nano-banana-pro.
 */
function fallbackFluxKontext(slotNumber) {
  const cfg = slotConfig(slotNumber);
  return cfg.fallback_flux_kontext === true;
}

/**
 * Inject slot-level `safeguard_phrases` from slot-constraints.json into the prompt.
 *
 * Used to enforce LOCKED structural invariants (RULE-016 slot 3 features+size,
 * RULE-017 slot 5 grid-display-locations) that MUST appear in every prompt for
 * that slot regardless of Vision concept content. Idempotent — skips any
 * phrase already present (case-insensitive substring match).
 *
 * Called from image-generator.js _finalizePrompt() BEFORE sanitize(), so that
 * word-count limits are enforced against the final prompt including safeguards.
 *
 * @param {number|string} slotNumber
 * @param {string} prompt
 * @returns {{ prompt: string, injected: string[] }}
 */
function injectSafeguardPhrases(slotNumber, prompt) {
  const cfg = slotConfig(slotNumber);
  const phrases = cfg.safeguard_phrases || [];
  if (!Array.isArray(phrases) || phrases.length === 0) {
    return { prompt: prompt || '', injected: [] };
  }

  const base = (prompt || '').trim();
  const lower = base.toLowerCase();
  const injected = [];
  const toAdd = [];

  for (const phrase of phrases) {
    if (!phrase || typeof phrase !== 'string') continue;
    const key = phrase.toLowerCase().substring(0, 40);
    if (lower.includes(key)) continue;
    toAdd.push(phrase);
    injected.push(phrase);
  }

  if (toAdd.length === 0) return { prompt: base, injected: [] };

  const suffix = ' STRUCTURAL SAFEGUARDS: ' + toAdd.join('. ') + '.';
  return { prompt: base + suffix, injected };
}

/**
 * Sanitize a final prompt string.
 * - Logs hard-word-limit violations.
 * - Strips forbidden anti-pattern phrases when a clean replacement exists.
 * - Returns { prompt, violations } so caller can log or act on them.
 *
 * @param {string} prompt
 * @param {number} slotNumber
 * @param {object} [opts] - { log?: logger }
 * @returns {{ prompt: string, violations: string[], words: number }}
 */
function sanitize(prompt, slotNumber, opts = {}) {
  const log = opts.log || console;
  const cfg = slotConfig(slotNumber);
  const violations = [];

  let out = prompt || '';
  const forbiddenAll = [
    ...(cfg.forbidden_phrases || []),
    ...(cfg.forbidden_phrases_extra || []),
  ];

  for (const phrase of forbiddenAll) {
    if (!phrase) continue;
    const re = new RegExp(escapeRegex(phrase), 'gi');
    if (re.test(out)) {
      violations.push(`forbidden phrase: "${phrase}"`);
      out = out.replace(re, '');
    }
  }

  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

  const words = countWords(out);
  if (cfg.max_words && words > cfg.max_words) {
    violations.push(`soft limit exceeded: ${words} > ${cfg.max_words} words`);
  }
  if (cfg.hard_max_words && words > cfg.hard_max_words) {
    violations.push(`HARD limit exceeded: ${words} > ${cfg.hard_max_words} words`);
  }

  // Hook visual soft warning (doctrine 3.0 — 0.8s visual hook)
  if (typeof slotNumber === 'number') {
    const hookCheck = checkHookPresence(out, slotNumber);
    if (!hookCheck.hasHook) {
      console.warn(`[PromptGuard] Slot ${slotNumber}: Hook visual missing. Consider adding rim light, golden hour, glow, or shallow DoF.`);
    }
  }

  if (violations.length && log && log.warn) {
    log.warn({
      slot: slotNumber,
      words,
      violations,
      snippet: out.substring(0, 140),
    }, `[PromptGuard] slot${slotNumber} violations: ${violations.length}`);
  }

  return { prompt: out, violations, words };
}

/**
 * Check whether a prompt contains at least one hook-visual vocabulary word
 * for slots where hooks are required (doctrine 3.0).
 * Non-required slots always report hasHook=true so callers can short-circuit.
 *
 * @param {string} prompt
 * @param {number} slotNumber
 * @returns {{ hasHook: boolean, vocab_matched: string|null, reason?: string }}
 */
function checkHookPresence(prompt, slotNumber) {
  const cfg = loadConstraints();
  const required = cfg.global?.hook_required_slots || [];
  if (!required.includes(slotNumber)) return { hasHook: true, vocab_matched: null, reason: 'slot not required' };

  const vocab = cfg.global?.hook_vocabulary || [];
  if (vocab.length === 0) return { hasHook: true, vocab_matched: null, reason: 'no vocab configured' };

  const lower = (prompt || '').toLowerCase();
  for (const word of vocab) {
    if (lower.includes(word.toLowerCase())) return { hasHook: true, vocab_matched: word };
  }
  return { hasHook: false, vocab_matched: null };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  sanitize,
  shouldInject,
  fallbackFluxKontext,
  injectSafeguardPhrases,
  slotConfig,
  loadConstraints,
  countWords,
  checkHookPresence,
};
