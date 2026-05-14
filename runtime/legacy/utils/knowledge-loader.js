/**
 * Knowledge Loader — auto-generate & attach knowledge base hints to briefs.
 *
 * Fixes 2 bugs in the pre-existing knowledge flow:
 *  1. `_summary.json` was documented but NEVER auto-generated → dead code.
 *  2. `design-director.js` and `image-generator.js` never READ the knowledge_* fields
 *     that research-agent set on the brief → hints were lost.
 *
 * This module wires both ends:
 *  - `ensureSummary(projectRoot, log)`   — regenerates _summary.json if missing or stale.
 *  - `attachKnowledgeHints(brief, log)`  — non-destructive attach to brief for pipeline reads.
 *  - `pickRelevantTips(brief, slotNum)`  — bounded picker so downstream code doesn't blow
 *                                          up prompt length (respects RULE-015 text dominance).
 */
const fs = require('fs');
const path = require('path');

const KNOWLEDGE_DIR_REL = 'knowledge';
const SUMMARY_FILE = '_summary.json';
const INDEX_FILE = '_index.json';

/**
 * Ensure `knowledge/_summary.json` exists and is fresh.
 * Regenerates if:
 *   - missing, OR
 *   - older than the newest knowledge/*.md file
 *
 * Returns { generated: boolean, path: string | null, reason: string }
 */
function ensureSummary(projectRoot, log) {
  const knowledgeDir = path.join(projectRoot, KNOWLEDGE_DIR_REL);
  if (!fs.existsSync(knowledgeDir)) {
    return { generated: false, path: null, reason: 'no knowledge dir' };
  }

  const summaryPath = path.join(knowledgeDir, SUMMARY_FILE);
  const needRegen = (() => {
    if (!fs.existsSync(summaryPath)) return 'missing';
    const summaryMtime = fs.statSync(summaryPath).mtimeMs;
    const newestMd = _newestMdMtime(knowledgeDir);
    if (newestMd > summaryMtime) return 'stale';
    return null;
  })();

  if (!needRegen) {
    return { generated: false, path: summaryPath, reason: 'fresh' };
  }

  try {
    const { generateSummary } = require('../agents/knowledge-agent');
    generateSummary(summaryPath);
    if (log && log.info) {
      log.info({ reason: needRegen }, `[Knowledge] _summary.json auto-generated`);
    }
    return { generated: true, path: summaryPath, reason: needRegen };
  } catch (err) {
    if (log && log.warn) {
      log.warn({ err: err.message }, '[Knowledge] auto-generate failed');
    }
    return { generated: false, path: null, reason: `error: ${err.message}` };
  }
}

/**
 * Load parsed _summary.json, or null if missing/invalid.
 */
function loadSummary(projectRoot) {
  const summaryPath = path.join(projectRoot, KNOWLEDGE_DIR_REL, SUMMARY_FILE);
  if (!fs.existsSync(summaryPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Attach knowledge hints to a brief non-destructively.
 * Only fills fields that are missing or empty. Preserves user overrides.
 *
 * Mutates and returns the brief for chaining.
 */
function attachKnowledgeHints(brief, projectRoot, log) {
  const summary = loadSummary(projectRoot);
  if (!summary) return brief;

  const nicheKey = (brief.category || '').replace(/_/g, '-');
  const nicheInsights = summary.category_insights?.[nicheKey] || [];
  const photoTips = summary.photography_tips || [];
  const conversionTactics = summary.conversion_tactics || [];
  const generalRules = (summary.knowledge_rules || []).map(r => r.rule || r);

  let attached = 0;
  if (nicheInsights.length && !brief.knowledge_insights?.length) {
    brief.knowledge_insights = nicheInsights;
    attached += nicheInsights.length;
  }
  if (photoTips.length && !brief.knowledge_photography_tips?.length) {
    brief.knowledge_photography_tips = photoTips;
    attached += photoTips.length;
  }
  if (conversionTactics.length && !brief.knowledge_conversion_tactics?.length) {
    brief.knowledge_conversion_tactics = conversionTactics;
    attached += conversionTactics.length;
  }
  if (generalRules.length && !brief.knowledge_rules?.length) {
    brief.knowledge_rules = generalRules;
    attached += generalRules.length;
  }

  if (attached > 0 && log && log.info) {
    log.info({
      niche: nicheInsights.length,
      photoTips: photoTips.length,
      conversion: conversionTactics.length,
      rules: generalRules.length,
    }, `[Knowledge] ${attached} hints attached to brief`);
  } else if (attached === 0 && log && log.debug) {
    log.debug('[Knowledge] No hints available (summary empty or all fields already set)');
  }

  return brief;
}

/**
 * Warn if knowledge files are mostly empty (filled_sections / sections < 0.3).
 * Called once on master.js startup when --verbose or first run.
 */
function warnIfEmpty(projectRoot, log) {
  const indexPath = path.join(projectRoot, KNOWLEDGE_DIR_REL, INDEX_FILE);
  if (!fs.existsSync(indexPath)) return;
  try {
    const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const entries = idx.entries || [];
    if (entries.length === 0) return;
    const totalSections = entries.reduce((a, e) => a + (e.sections || 0), 0);
    const filledSections = entries.reduce((a, e) => a + (e.filled_sections || 0), 0);
    const ratio = totalSections > 0 ? filledSections / totalSections : 0;
    if (ratio < 0.3 && log && log.warn) {
      log.warn({
        filled: filledSections,
        total: totalSections,
        ratio: Math.round(ratio * 100) + '%',
      }, '[Knowledge] Knowledge base mostly empty — fill knowledge/*.md to improve pipeline guidance');
    }
  } catch {
    /* ignore */
  }
}

/**
 * Pick 1–2 relevant hints for a given slot. Bounded to avoid text dominance.
 * Returns array of short strings (≤15 words each). Empty array if nothing fits.
 *
 * Not currently injected into prompts — exposed for future opportunistic use
 * by image-generator with Prompt Guard enforcement.
 */
function pickRelevantTips(brief, slotNumber, limit = 1) {
  const pool = [];
  const slotFocus = {
    1: 'hero_white',
    2: 'lifestyle',
    3: 'features',
    4: 'use-case',
    5: 'size',
    6: 'gift',
    7: 'emotional',
    8: 'lifestyle_closeup',
  }[slotNumber] || '';

  for (const tip of (brief.knowledge_photography_tips || [])) {
    if (_wordCount(tip) <= 15) pool.push(tip);
  }
  for (const tactic of (brief.knowledge_conversion_tactics || [])) {
    if (_wordCount(tactic) <= 15 && slotFocus && tactic.toLowerCase().includes(slotFocus.split('_')[0])) {
      pool.unshift(tactic);
    }
  }
  return pool.slice(0, limit);
}

// ─── internals ──────────────────────────────────────────

function _newestMdMtime(knowledgeDir) {
  let newest = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('_')) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const m = fs.statSync(full).mtimeMs;
        if (m > newest) newest = m;
      }
    }
  };
  walk(knowledgeDir);
  return newest;
}

function _wordCount(s) {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

module.exports = {
  ensureSummary,
  loadSummary,
  attachKnowledgeHints,
  warnIfEmpty,
  pickRelevantTips,
};
