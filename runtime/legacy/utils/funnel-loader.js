const fs = require('fs');
const path = require('path');

const FUNNELS_DIR = path.join(__dirname, '..', 'config', 'funnels');
const _cache = new Map();

function loadFunnel(category) {
  if (_cache.has(category)) return _cache.get(category);

  let matched = null;
  try {
    const files = fs.readdirSync(FUNNELS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(FUNNELS_DIR, f), 'utf8'));
        if ((data.applicable_to || []).includes(category)) { matched = data; break; }
      } catch (e) { /* skip invalid */ }
    }
  } catch (e) { /* dir missing */ }

  if (!matched) {
    try {
      const def = JSON.parse(fs.readFileSync(path.join(FUNNELS_DIR, '_default.json'), 'utf8'));
      matched = def.extends
        ? JSON.parse(fs.readFileSync(path.join(FUNNELS_DIR, def.extends), 'utf8'))
        : def;
    } catch (e) {
      matched = { category: '_hardcoded', slots: _hardcoded() };
    }
  }

  _cache.set(category, matched);
  return matched;
}

function _hardcoded() {
  return [
    { n: 1, role: 'STOP', intent: 'hero white', concept_template: 'hero_white' },
    { n: 2, role: 'IMAGINE', intent: 'lifestyle wide', concept_template: 'lifestyle_wide' },
    { n: 3, role: 'FEATURES', intent: 'infographic', concept_template: 'infographic_features' },
    { n: 4, role: 'USE_CASE', intent: 'demo', concept_template: 'use_case_demo' },
    { n: 5, role: 'SIZE', intent: 'size infographic', concept_template: 'size_infographic' },
    { n: 6, role: 'GIFT', intent: 'flat lay', concept_template: 'flat_lay_gift_set' },
    { n: 7, role: 'EMOTIONAL', intent: 'gift moment', concept_template: 'emotional_group' },
    { n: 8, role: 'CLOSE', intent: 'lifestyle closeup', concept_template: 'lifestyle_closeup' }
  ];
}

// ═══════════════════════════════════════════════════════════
//  A+ Funnel Loader — Type 1 (single) / Type 2 (multi_asin)
// ═══════════════════════════════════════════════════════════

const APLUS_TYPE_FILES = {
  single: 'aplus-type1-single.json',
  multi_asin: 'aplus-type2-multi-asin.json'
};

const APLUS_PLAN_KEYS = {
  A: 'plan_A_modular',
  B: 'plan_B_storyboard'
};

function loadAplusFunnel(brief, log) {
  const rawType = brief.aplus_type;
  const type = rawType === 'multi_asin' ? 'multi_asin' : 'single';
  const configPath = path.join(FUNNELS_DIR, APLUS_TYPE_FILES[type]);

  if (!fs.existsSync(configPath)) {
    log?.warn?.(`[AplusFunnel] config not found: ${configPath} — using legacy`);
    return null;
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    log?.warn?.(`[AplusFunnel] parse failed: ${err.message}`);
    return null;
  }

  const defaultPlan = config.default_plan || (type === 'single' ? 'B' : 'A');
  const requested = brief.aplus_plan_style;
  const planLetter = requested === 'A' || requested === 'B' ? requested : defaultPlan;
  const planKey = APLUS_PLAN_KEYS[planLetter];
  const plan = config[planKey];

  if (!plan || !Array.isArray(plan.modules) || plan.modules.length === 0) {
    log?.warn?.(`[AplusFunnel] plan ${planLetter} missing/empty — using legacy`);
    return null;
  }

  return {
    type,
    planLetter,
    planKey,
    description: plan._description || '',
    modules: plan.modules.map((m, i) => ({
      n: m.n || i + 1,
      name: m.name || `Module ${i + 1}`,
      role: m.role || 'UNTAGGED',
      intent: m.intent || '',
      layout: m.layout || {},
      refRecipe: m.ref_recipe || [],
      refStrategyNote: m.ref_strategy_note || '',
      visualThreadBridge: m.visual_thread_bridge || '',
      ribbonOverlays: m.ribbon_overlays || '',
      typographyPriority: m.typography_priority || '',
      seductionGate: m.seduction_gate || {}
    }))
  };
}

function resolveRefCatalog(brief, skuDir) {
  const catalog = brief.ref_catalog || {};
  const resolved = {};
  for (const [role, relPath] of Object.entries(catalog)) {
    if (!relPath || typeof relPath !== 'string') continue;
    const abs = path.isAbsolute(relPath) ? relPath : path.join(skuDir, relPath);
    if (fs.existsSync(abs)) resolved[role] = abs;
  }
  return resolved;
}

function pickRefsByRecipe(refRecipe, refCatalog, fallbackRefs = [], log = null) {
  if (!Array.isArray(refRecipe) || refRecipe.length === 0) {
    return (fallbackRefs || []).slice(0, 3);
  }
  const picked = [];
  const missing = [];
  for (const role of refRecipe) {
    const ref = refCatalog[role];
    if (ref && !picked.includes(ref)) picked.push(ref);
    else if (!ref) missing.push(role);
  }
  if (picked.length === 0) {
    // Silent fallback is the root cause of compound hallucination — warn loudly.
    log?.warn?.(`[ref] recipe [${refRecipe.join(',')}] NOT found in refCatalog [${Object.keys(refCatalog).join(',') || 'EMPTY'}]. Falling back to ${(fallbackRefs || []).length} fallback refs — risk of compound hallucination if fallback contains AI-generated images.`);
    return (fallbackRefs || []).slice(0, 3);
  }
  if (missing.length > 0) {
    log?.warn?.(`[ref] recipe partial match: missing roles [${missing.join(',')}] in catalog. Using ${picked.length} picked refs.`);
  }
  return picked.slice(0, 3);
}

module.exports = {
  loadFunnel,
  clearCache: () => _cache.clear(),
  loadAplusFunnel,
  resolveRefCatalog,
  pickRefsByRecipe
};
