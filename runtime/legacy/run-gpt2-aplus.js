#!/usr/bin/env node
/**
 * GPT Image 2 A+ Runner — 5-module Plan B Storyboard
 *
 * Generates 5 A+ Premium banners (1464×600) using gpt-image-2-image-to-image.
 *  - Style + fidelity guide: images under input/aplus-ref/ (first = primary style)
 *  - Funnel: Plan B Storyboard (config/funnels/aplus-type1-single.json)
 *  - Output: output/aplus-gpt2/  (separate folder, won't overwrite existing A+)
 *
 * Usage (run from handmade-media-agent/ or project root):
 *   node handmade-media-agent/run-gpt2-aplus.js "<path-to-sku-folder>"
 *   node handmade-media-agent/run-gpt2-aplus.js "<path>" --only=M1         # precheck
 *   node handmade-media-agent/run-gpt2-aplus.js "<path>" --only=M2,M3      # subset
 *   node handmade-media-agent/run-gpt2-aplus.js "<path>" --force           # regen
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, 'config', 'api-keys.env') });

const { KieClient }  = require('./utils/kie-client');
const { ensureSize } = require('./utils/image-utils');
const { buildGuards, buildModulePrompt } = require('./utils/aplus-flow');

const MODEL = 'gpt-image-2-image-to-image';

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

function moduleIdOf(m) {
  const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `M${m.n}_${slug}`;
}

function argValue(name, fallback = null) {
  const hit = process.argv.find(x => x.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}
const flag = name => process.argv.includes(`--${name}`);

async function main() {
  const skuDir = path.resolve(process.argv[2] || '');
  if (!skuDir || !fs.existsSync(skuDir)) {
    console.error('Usage: node run-gpt2-aplus.js "<sku-folder>" [--only=M1,M2,...] [--force]');
    process.exit(1);
  }

  const briefFile = argValue('brief', 'brief.json');
  const briefPath = path.join(skuDir, briefFile);
  if (!fs.existsSync(briefPath)) { console.error(`brief not found: ${briefPath}`); process.exit(1); }
  const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));

  const { plan, type, modules: allModules } = loadModules(brief, argValue('plan'));
  const planLabel = plan === 'A' ? 'A Modular' : 'B Storyboard';

  console.log(`\n[GPT2-A+] ═════════════════════════════════`);
  console.log(`[GPT2-A+] SKU   : ${brief.sku}`);
  console.log(`[GPT2-A+] Brief : ${briefFile}`);
  console.log(`[GPT2-A+] Model : ${MODEL}`);
  console.log(`[GPT2-A+] Type  : ${type}`);
  console.log(`[GPT2-A+] Plan  : ${planLabel} (5 modules)`);
  console.log(`[GPT2-A+] ═════════════════════════════════\n`);

  const apiKey = process.env.KIE_KEY;
  if (!apiKey) { console.error('[GPT2-A+] KIE_KEY missing in config/api-keys.env'); process.exit(1); }
  const kie = new KieClient(apiKey);

  const outDir = path.join(skuDir, 'output', `aplus-gpt2-plan${plan}`);
  fs.mkdirSync(outDir, { recursive: true });
  kie.setCacheDir(outDir);

  const specs = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'image-specs.json'), 'utf8'));

  // ── Upload A+ reference images (primary style + product fidelity) ───
  const refDir   = path.join(skuDir, 'input', 'aplus-ref');
  const refFiles = findImages(refDir);
  if (!refFiles.length) {
    console.error(`[GPT2-A+] No reference images found in ${refDir}`);
    process.exit(1);
  }

  console.log(`[GPT2-A+] Uploading ${refFiles.length} A+ reference images...`);
  const refUrls = [];
  for (const f of refFiles) {
    const url = await kie.uploadFromLocal(f, 'aplus-refs', {
      maxSize: 2048, quality: 95, format: 'jpeg',
    });
    refUrls.push(url);
    console.log(`  + ${path.basename(f).substring(0, 70)}`);
  }

  // ── Modules ─────────────────────────────────────────────────────────
  const modules = allModules;
  const onlyArg = argValue('only');
  const filterIds = onlyArg ? onlyArg.split(',').map(s => s.trim().toUpperCase()) : null;
  const FORCE = flag('force');

  const selected = modules.filter(m => {
    if (!filterIds) return true;
    return filterIds.includes(`M${m.n}`);
  });

  const guards = buildGuards(brief);

  const ratioPrefix =
    `WIDE HORIZONTAL A+ BANNER — compose for a wide ~2.44:1 aspect ratio (1464×600). ` +
    `All headlines, the product, and callouts must sit safely inside the central horizontal band; ` +
    `outer edges may be decorative background only. Avoid tall vertical compositions.\n\n`;

  // ── Generate ────────────────────────────────────────────────────────
  const results = [];
  for (const m of selected) {
    const moduleId  = moduleIdOf(m);
    const finalPath = path.join(outDir, `${moduleId}.jpg`);

    if (fs.existsSync(finalPath)) {
      if (FORCE) {
        fs.unlinkSync(finalPath);
        console.log(`\n[GPT2-A+] ${moduleId} — existing removed (--force)`);
      } else {
        console.log(`\n[GPT2-A+] ${moduleId} — already exists, skipping`);
        results.push({ id: moduleId, ok: true, path: finalPath, skipped: true });
        continue;
      }
    }

    console.log(`\n[GPT2-A+] ── ${moduleId} : ${m.name} ──────────────────`);

    const scenePrompt = buildModulePrompt({ id: moduleId, ...m }, brief, guards);
    const prompt      = ratioPrefix + scenePrompt;
    console.log(`  Prompt (${prompt.split(/\s+/).length}w)`);

    const gptInput = { prompt, input_urls: refUrls, nsfw_checker: true };

    try {
      const result   = await kie.run(MODEL, gptInput, 'image', moduleId);
      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('No result URL in response');

      const rawPath = path.join(outDir, `_${moduleId}_raw.jpg`);
      const resp    = await fetch(imageUrl);
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
  console.log(`\n[GPT2-A+] ══ DONE ═══════════════════════════════`);
  console.log(`[GPT2-A+] ${ok}/${results.length} modules generated`);
  for (const r of results) {
    const icon   = r.ok ? 'OK' : 'XX';
    const detail = r.ok
      ? (r.skipped ? `(skipped) ${path.basename(r.path)}` : path.basename(r.path))
      : r.err;
    console.log(`  [${icon}] ${r.id}: ${detail}`);
  }
  console.log(`[GPT2-A+] Output: ${outDir}`);

  fs.writeFileSync(
    path.join(outDir, '_gpt2_aplus_run.json'),
    JSON.stringify({ model: MODEL, plan: planLabel, type, brief: briefFile, modules: results, runAt: new Date().toISOString() }, null, 2)
  );
}

main().catch(err => {
  console.error('[GPT2-A+] Fatal:', err.message);
  process.exit(1);
});
