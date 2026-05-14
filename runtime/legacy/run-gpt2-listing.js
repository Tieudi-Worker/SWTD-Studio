#!/usr/bin/env node
/**
 * GPT Image 2 Listing Runner
 * Generates 6 listing images using gpt-image-2-image-to-image.
 * - Style/scene guide: listing-ref images (1 per slot)
 * - Product reference: input/product/ images
 * - Output: output/listing-gpt2/  (separate folder, won't overwrite existing listing)
 *
 * Usage (run from handmade-media-agent/ or project root):
 *   node handmade-media-agent/run-gpt2-listing.js "D:\AI PROJECT\...\data\MK CAR VISOR - Drive Safe We Love You (PR2)"
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, 'config', 'api-keys.env') });

const { KieClient }   = require('./utils/kie-client');
const ImageGenerator  = require('./agents/image-generator');
const { ensureSize }  = require('./utils/image-utils');

const MODEL = 'gpt-image-2-image-to-image';
const SLOTS = [1, 2, 3, 4, 5, 6];
const SLOT_NAMES = {
  1: 'main',
  2: 'in-use',
  3: 'features',
  4: 'use-case',
  5: 'size-scale',
  6: 'gift-set',
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function findImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort()
    .map(f => path.join(dir, f));
}

// ─────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────

async function main() {
  const skuDir = path.resolve(process.argv[2] || '');
  if (!skuDir || !fs.existsSync(skuDir)) {
    console.error('Usage: node run-gpt2-listing.js "<path-to-sku-folder>"');
    process.exit(1);
  }

  // Load brief
  const briefPath = path.join(skuDir, 'brief.json');
  if (!fs.existsSync(briefPath)) { console.error('brief.json not found'); process.exit(1); }
  const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));

  console.log(`\n[GPT2] ══════════════════════════════════════`);
  console.log(`[GPT2] SKU   : ${brief.sku}`);
  console.log(`[GPT2] Model : ${MODEL}`);
  console.log(`[GPT2] Slots : ${SLOTS.join(', ')}`);
  console.log(`[GPT2] ══════════════════════════════════════\n`);

  // KIE client
  const apiKey = process.env.KIE_KEY;
  if (!apiKey) { console.error('[GPT2] KIE_KEY missing in config/api-keys.env'); process.exit(1); }
  const kie = new KieClient(apiKey);

  // Output dir
  const outDir = path.join(skuDir, 'output', 'listing-gpt2');
  fs.mkdirSync(outDir, { recursive: true });
  kie.setCacheDir(outDir);

  // Image specs
  const specs = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'image-specs.json'), 'utf8'));

  // Prompt builder (uses existing slot_concepts from brief)
  const imageGen = new ImageGenerator(kie);
  const dna = { themeAnchors: {}, styleGuide: {}, creativeZones: {} };
  const theme = {
    mood:               ["bright", "cheerful", "Father's Day", "joyful"],
    lighting:           "bright natural daylight",
    surfaces:           ["clean white studio", "car interior", "outdoor driveway"],
    lifestyle_contexts: ["Father's Day morning", "dad driving", "suburban driveway"],
  };

  // ── Upload product images ──────────────────────────────────────────────
  const productDir   = path.join(skuDir, 'input', 'product');
  const productFiles = findImages(productDir);
  if (productFiles.length === 0) { console.error('[GPT2] No product images found in input/product/'); process.exit(1); }

  console.log(`[GPT2] Uploading ${productFiles.length} product images...`);
  const productUrls = [];
  for (const f of productFiles) {
    const isMain = /main/i.test(path.basename(f));
    const opts   = isMain
      ? { maxSize: 2048, quality: 95, format: 'jpeg' }   // high-res for main product
      : { maxSize: 1024, quality: 90, format: 'jpeg' };
    const url = await kie.uploadFromLocal(f, 'product-refs', opts);
    productUrls.push(url);
    console.log(`  + ${path.basename(f)}`);
  }

  // ── Upload listing-ref images (one per slot) ───────────────────────────
  const refDir   = path.join(skuDir, 'input', 'listing-ref');
  const refFiles = findImages(refDir).slice(0, SLOTS.length);   // max 6 refs
  if (refFiles.length === 0) { console.error('[GPT2] No listing-ref images found in input/listing-ref/'); process.exit(1); }

  console.log(`\n[GPT2] Uploading ${refFiles.length} listing-ref style images...`);
  const refUrls = [];
  for (const f of refFiles) {
    const url = await kie.uploadFromLocal(f, 'listing-refs', { maxSize: 1024, quality: 85, format: 'jpeg' });
    refUrls.push(url);
    console.log(`  + ${path.basename(f).substring(0, 70)}`);
  }

  // Force regen flag — delete existing outputs if --force
  const FORCE = process.argv.includes('--force');

  // ── Style-match prefix (applied to every slot) ──
  // Puts listing-ref at position [0] → gpt-image-2 treats it as the primary base.
  // Product images provide fidelity details (engraved text, wood grain, clip).
  const styleMatchPrefix =
    `STYLE REFERENCE (FIRST IMAGE): replicate the exact layout, typography, banner design, ` +
    `infographic composition, color palette, and overall visual style of the FIRST reference image. ` +
    `Match the Father's Day theme, sky blue (#4A90D9) accent color, bright fresh palette, and every design element (headers, labels, icons, decorative accents). ` +
    `\n\nPRODUCT REFERENCE (REMAINING IMAGES): use the actual wooden car visor photo frame shown in the other reference images. ` +
    `The product is a rectangular birch plywood frame with rounded corners, laser-engraved cursive text "Drive Safe We Love You" at the bottom of the frame, ` +
    `and a stainless steel clip at the top. Reproduce the engraved text EXACTLY — same cursive script font, same wording "Drive Safe We Love You", same placement along the bottom border. ` +
    `Do NOT misspell, rephrase, omit, or restyle the engraved text. Preserve natural birch wood tone, 3-layer construction, metal clip geometry.\n\nSCENE:\n`;

  // ── Generate slots ─────────────────────────────────────────────────────
  const results = [];

  for (const slotNum of SLOTS) {
    const slotName  = SLOT_NAMES[slotNum];
    const finalPath = path.join(outDir, `slot${slotNum}_${slotName}.jpg`);

    if (fs.existsSync(finalPath)) {
      if (FORCE) {
        fs.unlinkSync(finalPath);
        console.log(`\n[GPT2] Slot ${slotNum} — existing removed (--force)`);
      } else {
        console.log(`\n[GPT2] Slot ${slotNum} (${slotName}) — already exists, skipping`);
        results.push({ slot: slotNum, success: true, path: finalPath, skipped: true });
        continue;
      }
    }

    console.log(`\n[GPT2] ── Slot ${slotNum} : ${slotName} ──────────────────`);

    // Build scene prompt from brief's slot_concepts
    let scenePrompt = imageGen.buildDirectRefPrompt(slotNum, brief, dna, theme);

    // Slot 1 override: replace dad+toddler with family of 3
    if (slotNum === 1) {
      scenePrompt = scenePrompt.replace(
        /dad piggyback laughing toddler, blue sky/i,
        'a family of three (dad, mom, and a young child 4-6 years old) smiling warmly together with a blue sky background'
      );
    }

    const prompt = styleMatchPrefix + scenePrompt;
    console.log(`  Prompt (${prompt.split(' ').length}w): "${scenePrompt.substring(0, 100)}..."`);

    // input_urls = [listing-ref FIRST as primary style guide] + [product refs for fidelity]
    const refIdx    = Math.min(slotNum - 1, refUrls.length - 1);
    const inputUrls = [refUrls[refIdx], ...productUrls];

    const gptInput = { prompt, input_urls: inputUrls, nsfw_checker: true };

    try {
      const result   = await kie.run(MODEL, gptInput, 'image', `slot${slotNum}`);
      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('No result URL in response');

      // Download
      const rawPath = path.join(outDir, `_slot${slotNum}_raw.jpg`);
      const resp    = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      fs.writeFileSync(rawPath, Buffer.from(await resp.arrayBuffer()));

      // Resize → 2000×2000 @ 95q
      await ensureSize(rawPath, specs.listing.width, specs.listing.height, specs.listing.quality, finalPath);
      if (fs.existsSync(rawPath) && rawPath !== finalPath) fs.unlinkSync(rawPath);

      console.log(`  OK → ${path.basename(finalPath)}`);
      results.push({ slot: slotNum, success: true, path: finalPath });
    } catch (err) {
      console.error(`  FAIL: ${err.message}`);
      results.push({ slot: slotNum, success: false, error: err.message });
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const ok = results.filter(r => r.success).length;
  console.log(`\n[GPT2] ══ DONE ═══════════════════════════════`);
  console.log(`[GPT2] ${ok}/${SLOTS.length} slots generated`);
  for (const r of results) {
    const icon   = r.success ? 'OK' : 'XX';
    const detail = r.success
      ? (r.skipped ? `(skipped) ${path.basename(r.path)}` : path.basename(r.path))
      : r.error;
    console.log(`  [${icon}] Slot ${r.slot}: ${detail}`);
  }
  console.log(`[GPT2] Output: ${outDir}`);

  fs.writeFileSync(
    path.join(outDir, '_gpt2_run.json'),
    JSON.stringify({ model: MODEL, slots: results, runAt: new Date().toISOString() }, null, 2)
  );
}

main().catch(err => {
  console.error('[GPT2] Fatal:', err.message);
  process.exit(1);
});
