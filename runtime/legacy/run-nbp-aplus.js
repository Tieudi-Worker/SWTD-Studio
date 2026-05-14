#!/usr/bin/env node
/**
 * Nano-Banana-Pro A+ Runner — 5-module Plan A or Plan B
 *
 * Generates 5 A+ Premium banners (1464×600) using Google nano-banana-pro.
 *  - Style + fidelity guide: images under input/aplus-ref/
 *  - Funnel: Plan A (Modular) hoặc Plan B (Storyboard) per brief.aplus_plan_style
 *  - Output: output/aplus-nbp-plan{A|B}/
 *
 * Map brief.aplus_modules overrides by M{n}_ prefix (not full slug) — cho phép
 * brief key "M1_open-scene" override funnel module n=1 dù funnel tên
 * "Collection Open Scene".
 *
 * Usage (run from handmade-media-agent/ or project root):
 *   node handmade-media-agent/run-nbp-aplus.js "<sku-folder>"
 *   node handmade-media-agent/run-nbp-aplus.js "<path>" --brief=brief-planA.json
 *   node handmade-media-agent/run-nbp-aplus.js "<path>" --plan=A
 *   node handmade-media-agent/run-nbp-aplus.js "<path>" --only=M1         # precheck
 *   node handmade-media-agent/run-nbp-aplus.js "<path>" --only=M2,M3      # subset
 *   node handmade-media-agent/run-nbp-aplus.js "<path>" --force           # regen
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, 'config', 'api-keys.env') });

const { KieClient }  = require('./utils/kie-client');
const { ensureSize } = require('./utils/image-utils');
const { buildGuards } = require('./utils/aplus-flow');

const MODEL = 'nano-banana-pro';
const ASPECT_RATIO = '16:9';

function loadModules(brief, planOverride) {
  const plan = (planOverride || brief.aplus_plan_style || 'B').toUpperCase();
  const type = brief.aplus_type === 'multi_asin' ? 'multi_asin' : 'single';
  const cfgName = type === 'multi_asin' ? 'aplus-type2-multi-asin.json' : 'aplus-type1-single.json';
  const cfgPath = path.join(__dirname, 'config', 'funnels', cfgName);
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const planKey = plan === 'A' ? 'plan_A_modular' : 'plan_B_storyboard';
  const block = cfg[planKey];
  if (!block || !block.modules) throw new Error(`Plan ${plan} modules not found in ${cfgName}`);
  return { plan, type, modules: block.modules };
}

function findImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort()
    .map(f => path.join(dir, f));
}

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Resolve brief override cho 1 funnel module.
 * Ưu tiên exact slug match `M{n}_{slug(m.name)}` — tránh pick nhầm khi
 * brief có nhiều key cùng prefix "M1_" (vd brief chứa cả Plan A và B modules).
 * Fallback: prefix match "M{n}_" nếu không có exact slug (cho brief với tên
 * custom không khớp funnel name).
 */
function resolveOverride(briefModules, m) {
  if (!briefModules) return { key: null, override: null };
  const exactKey = `M${m.n}_${slugify(m.name || `module${m.n}`)}`;
  if (briefModules[exactKey]) return { key: exactKey, override: briefModules[exactKey] };
  const prefix = `M${m.n}_`;
  for (const [k, v] of Object.entries(briefModules)) {
    if (k.startsWith(prefix)) return { key: k, override: v };
  }
  return { key: null, override: null };
}

function buildModulePromptLocal(m, override, brief, guards) {
  if (override && override.prompt) {
    return `${override.prompt}\n\n${guards}`;
  }
  // Fallback: derive from funnel layout
  const lines = [
    `Amazon A+ content banner, wide horizontal composition. Module: ${m.name || `M${m.n}`}.`,
    `Intent: ${m.intent || ''}`.trim(),
  ];
  if (m.layout) {
    lines.push('Layout:');
    for (const [zone, desc] of Object.entries(m.layout)) {
      lines.push(`  • ${zone.replace(/_/g, ' ')}: ${desc}`);
    }
  }
  return `${lines.join('\n')}\n\n${guards}`;
}

function argValue(name, fallback = null) {
  const hit = process.argv.find(x => x.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}
const flag = name => process.argv.includes(`--${name}`);

async function main() {
  const skuDir = path.resolve(process.argv[2] || '');
  if (!skuDir || !fs.existsSync(skuDir)) {
    console.error('Usage: node run-nbp-aplus.js "<sku-folder>" [--brief=brief-planA.json] [--plan=A|B] [--only=M1,M2,...] [--force]');
    process.exit(1);
  }

  const briefFile = argValue('brief', 'brief.json');
  const briefPath = path.join(skuDir, briefFile);
  if (!fs.existsSync(briefPath)) { console.error(`brief not found: ${briefPath}`); process.exit(1); }
  const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));

  const { plan, type, modules: allModules } = loadModules(brief, argValue('plan'));
  const planLabel = plan === 'A' ? 'A Modular' : 'B Storyboard';

  console.log(`\n[NBP-A+] ══════════════════════════════════`);
  console.log(`[NBP-A+] SKU   : ${brief.sku}`);
  console.log(`[NBP-A+] Brief : ${briefFile}`);
  console.log(`[NBP-A+] Model : ${MODEL}`);
  console.log(`[NBP-A+] Type  : ${type}`);
  console.log(`[NBP-A+] Plan  : ${planLabel} (${allModules.length} modules)`);
  console.log(`[NBP-A+] Ratio : ${ASPECT_RATIO} (→ ensureSize 1464×600)`);
  console.log(`[NBP-A+] ══════════════════════════════════\n`);

  const apiKey = process.env.KIE_KEY;
  if (!apiKey) { console.error('[NBP-A+] KIE_KEY missing in config/api-keys.env'); process.exit(1); }
  const kie = new KieClient(apiKey);

  const outDir = path.join(skuDir, 'output', `aplus-nbp-plan${plan}`);
  fs.mkdirSync(outDir, { recursive: true });
  kie.setCacheDir(outDir);

  const specs = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'image-specs.json'), 'utf8'));

  // ── Upload A+ reference images ──────────────────────────────────────
  const refDir   = path.join(skuDir, 'input', 'aplus-ref');
  const refFiles = findImages(refDir);
  if (!refFiles.length) {
    console.error(`[NBP-A+] No reference images found in ${refDir}`);
    process.exit(1);
  }

  // nano-banana-pro max_refs = 8, dư slot cho Parent's 6 refs
  const MAX_REFS = 8;
  const refsToUpload = refFiles.slice(0, MAX_REFS);
  console.log(`[NBP-A+] Uploading ${refsToUpload.length}/${refFiles.length} A+ reference images...`);
  const refUrls = [];
  for (const f of refsToUpload) {
    const url = await kie.uploadFromLocal(f, 'aplus-refs-nbp', {
      maxSize: 2048, quality: 95, format: 'jpeg',
    });
    refUrls.push(url);
    console.log(`  + ${path.basename(f).substring(0, 70)}`);
  }

  // ── Modules ─────────────────────────────────────────────────────────
  const onlyArg = argValue('only');
  const filterIds = onlyArg ? onlyArg.split(',').map(s => s.trim().toUpperCase()) : null;
  const FORCE = flag('force');

  const selected = allModules.filter(m => {
    if (!filterIds) return true;
    return filterIds.includes(`M${m.n}`);
  });

  const guards = buildGuards(brief);

  const ratioPrefix =
    `WIDE HORIZONTAL A+ BANNER — compose for a wide ~2.44:1 aspect ratio (1464×600). ` +
    `All headlines, product, and callouts must sit safely inside the central horizontal band; ` +
    `outer edges may be decorative background only. Avoid tall vertical compositions.\n\n`;

  // ── Generate ────────────────────────────────────────────────────────
  const briefModules = brief.aplus_modules || {};
  const results = [];

  for (const m of selected) {
    const { key: briefKey, override } = resolveOverride(briefModules, m);
    const moduleId = briefKey || `M${m.n}_${slugify(m.name || `module${m.n}`)}`;
    const finalPath = path.join(outDir, `${moduleId}.jpg`);

    if (fs.existsSync(finalPath)) {
      if (FORCE) {
        fs.unlinkSync(finalPath);
        console.log(`\n[NBP-A+] ${moduleId} — existing removed (--force)`);
      } else {
        console.log(`\n[NBP-A+] ${moduleId} — already exists, skipping`);
        results.push({ id: moduleId, ok: true, path: finalPath, skipped: true });
        continue;
      }
    }

    console.log(`\n[NBP-A+] ── ${moduleId} : ${m.name} ──`);
    if (!override) {
      console.log(`  (fallback layout from funnel — no brief override for M${m.n}_)`);
    }

    const scenePrompt = buildModulePromptLocal(m, override, brief, guards);
    const prompt = ratioPrefix + scenePrompt;
    console.log(`  Prompt (${prompt.split(/\s+/).length}w)`);

    const nbpInput = {
      prompt,
      image_input: refUrls,
      resolution: '2K',
      aspect_ratio: ASPECT_RATIO,
      output_format: 'jpg',
    };

    try {
      const result = await kie.run(MODEL, nbpInput, 'image', moduleId);
      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('No result URL in response');

      const rawPath = path.join(outDir, `_${moduleId}_raw.jpg`);
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      fs.writeFileSync(rawPath, Buffer.from(await resp.arrayBuffer()));

      await ensureSize(
        rawPath,
        specs.aplus_premium.width,
        specs.aplus_premium.height,
        specs.aplus_premium.quality,
        finalPath
      );
      if (fs.existsSync(rawPath) && rawPath !== finalPath) fs.unlinkSync(rawPath);

      console.log(`  OK → ${path.basename(finalPath)}`);
      results.push({ id: moduleId, ok: true, path: finalPath });
    } catch (err) {
      console.error(`  FAIL: ${err.message}`);
      results.push({ id: moduleId, ok: false, err: err.message });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────
  const ok = results.filter(r => r.ok).length;
  console.log(`\n[NBP-A+] ══ DONE ══════════════════════════════`);
  console.log(`[NBP-A+] ${ok}/${results.length} modules generated`);
  for (const r of results) {
    const icon = r.ok ? 'OK' : 'XX';
    const detail = r.ok
      ? (r.skipped ? `(skipped) ${path.basename(r.path)}` : path.basename(r.path))
      : r.err;
    console.log(`  [${icon}] ${r.id}: ${detail}`);
  }
  console.log(`[NBP-A+] Output: ${outDir}`);

  fs.writeFileSync(
    path.join(outDir, '_nbp_aplus_run.json'),
    JSON.stringify({
      model: MODEL,
      plan: planLabel,
      type,
      brief: briefFile,
      aspect_ratio: ASPECT_RATIO,
      modules: results,
      runAt: new Date().toISOString()
    }, null, 2)
  );
}

main().catch(err => {
  console.error('[NBP-A+] Fatal:', err.message);
  process.exit(1);
});
