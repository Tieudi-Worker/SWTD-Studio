#!/usr/bin/env node
/**
 * HMA A+ Content CLI — generate A+ banners for any SKU using the proven flow.
 *
 * Usage:
 *   node scripts/aplus.js --sku="MK TNTD090425i392"                     # M1 precheck 16:9
 *   node scripts/aplus.js --sku="..." --full                            # all 5 modules 16:9
 *   node scripts/aplus.js --sku="..." --full --ratio=21:9               # all 5 modules 21:9
 *   node scripts/aplus.js --sku="..." --full --ratio=all                # 16:9 + 21:9 (10 banners)
 *   node scripts/aplus.js --sku="..." --only=M2,M3 --ratio=16:9         # specific modules
 *
 * Expects in brief.json:
 *   - aplus_type: "single" | "multi_asin"
 *   - aplus_plan_style: "A" | "B"
 *   - ref_catalog: { key: "relative/path.jpg" }      — paths relative to SKU root
 *   - aplus_product_guards (optional): SKU-specific R2 fidelity text
 *   - aplus_font_family (optional): default "Fredoka Bold"
 *   - aplus_modules (optional): { M1_xxx: { prompt, refs: [...] } } overrides per module
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', 'api-keys.env') });
const { KieClient } = require('../utils/kie-client');
const {
  resolveRefPaths,
  uploadRefsAtProperResolution,
  buildGuards,
  buildModulePrompt,
  runFullFlow,
  runAplusBatch,
} = require('../utils/aplus-flow');
const { createLogger } = require('../utils/logger');

// ═══ CLI args ═══
const args = process.argv.slice(2);
function arg(name, fallback = null) {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}
const flag = name => args.includes(`--${name}`);

const SKU = arg('sku');
if (!SKU) {
  console.error('Usage: node scripts/aplus.js --sku="<SKU>" [--full] [--ratio=16:9|21:9|all] [--only=M1,M2,...]');
  process.exit(1);
}
const ratioArg = arg('ratio', '16:9');
const onlyArg = arg('only');
const isFull = flag('full');

const DATA_ROOT = path.resolve(__dirname, '..', '..', 'data');
const SKU_DIR = path.join(DATA_ROOT, SKU);
if (!fs.existsSync(SKU_DIR)) {
  console.error(`[aplus] SKU folder not found: ${SKU_DIR}`);
  process.exit(1);
}

const BRIEF_PATH = path.join(SKU_DIR, 'brief.json');
if (!fs.existsSync(BRIEF_PATH)) {
  console.error(`[aplus] brief.json not found: ${BRIEF_PATH}`);
  process.exit(1);
}
const brief = JSON.parse(fs.readFileSync(BRIEF_PATH, 'utf8'));

// ═══ Resolve funnel config ═══
function loadFunnel(brief) {
  const type = brief.aplus_type || 'single';
  const plan = (brief.aplus_plan_style || (type === 'single' ? 'B' : 'A')).toUpperCase();
  const cfgName = type === 'single' ? 'aplus-type1-single.json' : 'aplus-type2-multi-asin.json';
  const cfgPath = path.join(__dirname, '..', 'config', 'funnels', cfgName);
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const planKey = plan === 'B' ? 'plan_B_storyboard' : 'plan_A_modular';
  const plan_block = cfg[planKey];
  if (!plan_block) throw new Error(`Funnel plan not found: ${planKey} in ${cfgName}`);
  return { type, plan, modules: plan_block.modules };
}

// ═══ Build per-module spec ═══
function buildModules(funnel, brief, filterIds) {
  const guards = buildGuards(brief);
  const list = funnel.modules.map(m => {
    const id = normalizeModuleId(m);
    const override = (brief.aplus_modules || {})[id] || {};
    const refs = override.refs || m.refs || m.ref_recipe || [];
    const prompt = buildModulePrompt({ ...m, id, refs, name: m.name }, brief, guards);
    return { id, name: m.name, refs, prompt };
  });
  if (!filterIds || !filterIds.length) return list;
  return list.filter(mod => filterIds.some(f => mod.id.startsWith(f)));
}

function normalizeModuleId(m) {
  if (m.id) return m.id;
  const slug = (m.name || `module${m.n}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `M${m.n}_${slug}`;
}

// ═══ Output dir ═══
function outDirFor(ratio) {
  const base = path.join(SKU_DIR, 'output', 'aplus', `hma_planB_${new Date().toISOString().slice(0, 10)}`);
  return ratio === '16:9' ? base : path.join(base, `${ratio.replace(':', 'x')}_native`);
}

// ═══ Main ═══
(async () => {
  const log = createLogger('APLUS');
  const kie = new KieClient(process.env.KIE_KEY);

  const funnel = loadFunnel(brief);
  log.info(`[aplus] SKU=${SKU} type=${funnel.type} plan=${funnel.plan} ratio=${ratioArg} mode=${isFull ? 'FULL' : (onlyArg ? `only ${onlyArg}` : 'precheck M1')}`);

  const refsAbs = resolveRefPaths(brief.ref_catalog, SKU_DIR);
  const refUrls = await uploadRefsAtProperResolution(kie, refsAbs, log);

  const filterIds = onlyArg ? onlyArg.split(',').map(s => s.trim()) : (isFull ? null : null);
  let modules = buildModules(funnel, brief, filterIds);
  if (!isFull && !onlyArg) modules = [modules[0]]; // default M1 precheck

  const ratios = ratioArg === 'all' ? ['16:9', '21:9'] : [ratioArg];

  for (const ratio of ratios) {
    const outDir = outDirFor(ratio);
    log.info(`[aplus] Batch ratio=${ratio} modules=${modules.length} out=${outDir}`);
    if (onlyArg) {
      const results = await runAplusBatch({ kie, modules, refUrls, aspectRatio: ratio, outDir, log });
      log.info(`[aplus] ${ratio}: ${results.filter(r => r.ok).length}/${results.length} OK`);
    } else {
      const flowResult = await runFullFlow({ kie, modules, refUrls, aspectRatio: ratio, outDir, log, skipPrecheck: modules.length <= 1 });
      log.info(`[aplus] ${ratio}: ${flowResult.passed}/${flowResult.total} OK`);
    }
  }
})().catch(err => {
  console.error(`[aplus] FATAL ${err.stack || err.message}`);
  process.exit(1);
});
