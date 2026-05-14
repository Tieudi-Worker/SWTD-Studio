#!/usr/bin/env node
/**
 * GPT Image 2 Listing Runner — SKU-specific fork for MK-TNTD030426i772
 * Pregnancy Announcement Wooden Slide-Card Keepsake.
 *
 * Forked from run-gpt2-listing.js because:
 *   - The original hardcodes input/product + input/listing-ref subfolders
 *     (this SKU keeps them at the data-folder root).
 *   - The original styleMatchPrefix is hardcoded for a Father's Day car visor.
 *   - Slot 1 override targeted "dad piggyback toddler" — irrelevant here.
 *
 * Usage:
 *   node handmade-media-agent/run-gpt2-listing-i772.js "D:\AI PROJECT\...\data\MK TNTD030426i772"
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

function findImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort()
    .map(f => path.join(dir, f));
}

function resolveSubfolder(skuDir, name) {
  const nested = path.join(skuDir, 'input', name);
  if (fs.existsSync(nested)) return nested;
  const flat = path.join(skuDir, name);
  if (fs.existsSync(flat)) return flat;
  return nested;
}

async function main() {
  const skuDir = path.resolve(process.argv[2] || '');
  if (!skuDir || !fs.existsSync(skuDir)) {
    console.error('Usage: node run-gpt2-listing-i772.js "<path-to-sku-folder>"');
    process.exit(1);
  }

  const briefPath = path.join(skuDir, 'brief.json');
  if (!fs.existsSync(briefPath)) { console.error('brief.json not found'); process.exit(1); }
  const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));

  console.log(`\n[GPT2] ══════════════════════════════════════`);
  console.log(`[GPT2] SKU   : ${brief.sku}`);
  console.log(`[GPT2] Model : ${MODEL}`);
  console.log(`[GPT2] Slots : ${SLOTS.join(', ')}`);
  console.log(`[GPT2] ══════════════════════════════════════\n`);

  const apiKey = process.env.KIE_KEY;
  if (!apiKey) { console.error('[GPT2] KIE_KEY missing in config/api-keys.env'); process.exit(1); }
  const kie = new KieClient(apiKey);

  const outDir = path.join(skuDir, 'output', 'listing-gpt2');
  fs.mkdirSync(outDir, { recursive: true });
  kie.setCacheDir(outDir);

  const specs = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'image-specs.json'), 'utf8'));

  const imageGen = new ImageGenerator(kie);
  const dna = { themeAnchors: {}, styleGuide: {}, creativeZones: {} };
  const theme = {
    mood:               ['warm', 'tender', 'joyful', 'anticipation'],
    lighting:           'soft natural window light, golden hour glow',
    surfaces:           ['cream linen', 'birch wood', 'nightstand', 'gift table'],
    lifestyle_contexts: ['home reveal moment', 'expecting mother sofa', 'grandparent surprise', 'baby shower gift table'],
  };

  // Product images
  const productDir   = resolveSubfolder(skuDir, 'product');
  const productFiles = findImages(productDir);
  if (productFiles.length === 0) { console.error(`[GPT2] No product images found in ${productDir}`); process.exit(1); }

  console.log(`[GPT2] Uploading ${productFiles.length} product images from ${path.basename(productDir)}/...`);
  const productUrls = [];
  // Cap at 8 product refs to keep payload tight; brief already curated to 7
  const productCap = Math.min(productFiles.length, 8);
  for (let i = 0; i < productCap; i++) {
    const f = productFiles[i];
    const opts = i === 0
      ? { maxSize: 2048, quality: 95, format: 'jpeg' }
      : { maxSize: 1024, quality: 90, format: 'jpeg' };
    const url = await kie.uploadFromLocal(f, 'product-refs', opts);
    productUrls.push(url);
    console.log(`  + ${path.basename(f)}`);
  }

  // Listing-ref style images
  const refDir   = resolveSubfolder(skuDir, 'listing-ref');
  const refFiles = findImages(refDir).slice(0, SLOTS.length);
  if (refFiles.length === 0) { console.error(`[GPT2] No listing-ref images found in ${refDir}`); process.exit(1); }

  console.log(`\n[GPT2] Uploading ${refFiles.length} listing-ref style images from ${path.basename(refDir)}/...`);
  const refUrls = [];
  for (const f of refFiles) {
    const url = await kie.uploadFromLocal(f, 'listing-refs', { maxSize: 1024, quality: 85, format: 'jpeg' });
    refUrls.push(url);
    console.log(`  + ${path.basename(f).substring(0, 70)}`);
  }

  const FORCE = process.argv.includes('--force');

  // SKU-specific style + product prefix.
  // Critical: listing-ref FIRST (style guide), product refs AFTER (fidelity).
  // Per CLAUDE.md design_inspiration_note: copy listing-ref styling/lighting,
  // but render the SQUARE+SQUARE product from product/ photos, NOT the round
  // frame shown in listing-ref.
  const styleMatchPrefix =
    `STYLE REFERENCE (FIRST IMAGE): match the lighting, color palette, lifestyle props, and overall photographic mood of the FIRST reference image. ` +
    `Use the same warm cream/dusty-rose tone, soft natural light, baby-themed props (florals, linen, soft fabrics), and gift-keepsake atmosphere. ` +
    `\n\nPRODUCT REFERENCE (REMAINING IMAGES): the actual product is the SQUARE birch plywood TWO-PIECE slide-card set shown in the remaining reference images — NOT the round frame in the first reference. ` +
    `Outer card is a square birch plywood plate engraved 'SOMEONE WANTS TO SAY' (rotated up the left edge) plus 'HELLO...' (down the right edge), with one small red wooden heart between the texts. ` +
    `Inner card is the same square birch plywood with a recessed rectangular slot in the middle holding a 2x3 inch ultrasound photo, engraved 'Hi DADDY' (rotated up the left edge) plus 'I can't wait to meet you!' (down the right edge). ` +
    `Both cards are roughly 5x5 inches and 6mm thick light-yellow birch plywood. Reproduce engraved text EXACTLY — same wording, same sans-serif font, same rotation, same placement. ` +
    `Do NOT render a round frame. Do NOT add a 2-heart cluster. Do NOT add cursive 'Precious Little One' text. ` +
    `Do NOT misspell, rephrase, or restyle the engraved text.\n\nSCENE:\n`;

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

    const scenePrompt = imageGen.buildDirectRefPrompt(slotNum, brief, dna, theme);
    const prompt = styleMatchPrefix + scenePrompt;
    console.log(`  Prompt (${prompt.split(' ').length}w): "${scenePrompt.substring(0, 100)}..."`);

    const refIdx    = Math.min(slotNum - 1, refUrls.length - 1);
    const inputUrls = [refUrls[refIdx], ...productUrls];

    const gptInput = { prompt, input_urls: inputUrls, nsfw_checker: true };

    try {
      const result   = await kie.run(MODEL, gptInput, 'image', `slot${slotNum}`);
      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('No result URL in response');

      const rawPath = path.join(outDir, `_slot${slotNum}_raw.jpg`);
      const resp    = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      fs.writeFileSync(rawPath, Buffer.from(await resp.arrayBuffer()));

      await ensureSize(rawPath, specs.listing.width, specs.listing.height, specs.listing.quality, finalPath);
      if (fs.existsSync(rawPath) && rawPath !== finalPath) fs.unlinkSync(rawPath);

      console.log(`  OK → ${path.basename(finalPath)}`);
      results.push({ slot: slotNum, success: true, path: finalPath });
    } catch (err) {
      console.error(`  FAIL: ${err.message}`);
      results.push({ slot: slotNum, success: false, error: err.message });
    }
  }

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
