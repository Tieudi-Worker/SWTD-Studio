#!/usr/bin/env node
/**
 * Custom slot 9 generator for SKU MK-TNTD030426i772.
 *
 * User request: extra "lifestyle in-use" shot beyond the standard 8 slots,
 * using slot 4 as the primary product reference (its orientation + cavity
 * + ultrasound INSERTED came out best in the QC).
 *
 * Reference stack (in order — first ref is heaviest weight):
 *   1. slot 4 output (the "ground truth" composition that nailed F1-F8)
 *   2-6. product-bright/ refs (real product photos, color-corrected)
 *
 * Output: data/MK-TNTD030426i772/output/listing/MK-TNTD030426i772_slot9_lifestyle-use.jpg
 *
 * Usage:
 *   node handmade-media-agent/run-slot9-i772.js "../data/MK TNTD030426i772"
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, 'config', 'api-keys.env') });

const { KieClient }  = require('./utils/kie-client');
const { ensureSize } = require('./utils/image-utils');

const MODEL = 'nano-banana-pro';
const SLOT  = 9;
const SLOT_NAME = 'lifestyle-use';

async function main() {
  const skuDir = path.resolve(process.argv[2] || '');
  if (!skuDir || !fs.existsSync(skuDir)) {
    console.error('Usage: node run-slot9-i772.js "<sku-folder>"');
    process.exit(1);
  }

  const apiKey = process.env.KIE_KEY;
  if (!apiKey) { console.error('[Slot9] KIE_KEY missing'); process.exit(1); }

  const briefPath = path.join(skuDir, 'brief.json');
  if (!fs.existsSync(briefPath)) { console.error('brief.json not found'); process.exit(1); }
  const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));

  const outDir   = path.join(skuDir, 'output', 'listing');
  const finalPath = path.join(outDir, `${brief.sku}_slot${SLOT}_${SLOT_NAME}.jpg`);
  fs.mkdirSync(outDir, { recursive: true });

  const kie = new KieClient(apiKey);
  kie.setCacheDir(outDir);

  const specs = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'image-specs.json'), 'utf8'));

  console.log(`\n[Slot9] ══════════════════════════════════════`);
  console.log(`[Slot9] SKU   : ${brief.sku}`);
  console.log(`[Slot9] Model : ${MODEL}`);
  console.log(`[Slot9] Output: ${path.basename(finalPath)}`);
  console.log(`[Slot9] ══════════════════════════════════════\n`);

  // ── Reference stack ────────────────────────────────────────────────────
  // Use original product-bright refs (real product photos), NOT slot4 output —
  // slot 4 from previous runs misrendered the BOX as two flat cards. The real
  // product is one shallow wooden BOX with lift-off lid + heart knob.
  const refRoots = brief.ref_catalog || {};
  const refPaths = [];
  for (const key of Object.keys(refRoots)) {
    const rel = refRoots[key];
    const abs = path.isAbsolute(rel) ? rel : path.join(skuDir, rel);
    if (fs.existsSync(abs)) refPaths.push(abs);
  }
  const finalRefs = refPaths.slice(0, 6);

  console.log(`[Slot9] Uploading ${finalRefs.length} product-bright refs...`);
  const refUrls = [];
  for (let i = 0; i < finalRefs.length; i++) {
    const isAnchor = i === 0;
    const url = await kie.uploadFromLocal(
      finalRefs[i],
      'slot9-refs',
      isAnchor
        ? { maxSize: 2048, quality: 95, format: 'jpeg' }
        : { maxSize: 1024, quality: 90, format: 'jpeg' }
    );
    refUrls.push(url);
    console.log(`  + ${path.basename(finalRefs[i])}`);
  }

  // ── Prompt ────────────────────────────────────────────────────────────
  // Short and scene-focused per RULE-015. Product fidelity comes from
  // refs (anchor is slot 4 — already nails geometry, text orientation,
  // cavity, ultrasound INSERTED, pale maple wood).
  const prompt =
    `Wide warm lifestyle moment at a sunlit kitchen dining table on a soft cream linen runner. ` +
    `An expecting mother (left side, soft side-profile, cream knit sweater, small baby bump visible) ` +
    `has just lifted the LID off the wooden BOX (using the raised red heart knob on the lid as a grip) and now holds the OPEN box toward her husband — base in front showing inside cavity with the ultrasound photo INSERTED + 'Hi DADDY' text, lid (with heart knob) leaned beside on the table. ` +
    `Husband seated across the corner of the table (right side, soft denim shirt), leans in, hand reaching toward the box, eyes widening with surprise and joy — gentle smile, NOT melodramatic. ` +
    `Background: white peonies in a small ceramic vase, two warm coffee mugs steaming softly, blurred sheer-curtain window with bright morning daylight, soft bokeh. ` +
    `The OPEN BOX is the focal point centered between them — base with photo + lid with heart knob clearly visible. ` +
    `\n\n${this_fidelityGuard()} ` +
    `The product is ONE shallow wooden BOX (NOT two flat cards). Lid = flat top with raised RED HEART KNOB + 'SOMEONE WANTS TO SAY' rotated UP LEFT edge + 'HELLO...' rotated DOWN RIGHT edge. Base = matching square with raised wooden border walls + inside cavity holding 2x3 ultrasound photo INSERTED + 'Hi DADDY' rotated UP LEFT edge + 'I can't wait to meet you!' rotated DOWN RIGHT edge. Pale maple wood NOT yellow. ` +
    `Do NOT render two separate flat cards. Do NOT rotate text horizontally. Do NOT add a photo-frame bezel.` +
    `\n\nWarm bright airy lifestyle photography, 50mm f/2.5 shallow depth of field, fresh joyful angelic mood, photorealistic 4K.`;

  console.log(`\n[Slot9] Prompt length: ${prompt.split(/\s+/).length} words`);
  console.log(`[Slot9] Calling ${MODEL}...\n`);

  const apiInput = {
    prompt,
    image_input: refUrls,
    resolution: '2K',
    aspect_ratio: '1:1',
    output_format: 'jpg',
  };

  try {
    const result = await kie.run(MODEL, apiInput, 'image', `slot${SLOT}`);
    const imageUrl = result.resultUrls?.[0];
    if (!imageUrl) throw new Error('No result URL in response');

    const rawPath = path.join(outDir, `_slot${SLOT}_raw.jpg`);
    const resp = await fetch(imageUrl);
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    fs.writeFileSync(rawPath, Buffer.from(await resp.arrayBuffer()));

    await ensureSize(rawPath, specs.listing.width, specs.listing.height, specs.listing.quality, finalPath);
    if (fs.existsSync(rawPath) && rawPath !== finalPath) fs.unlinkSync(rawPath);

    console.log(`\n[Slot9] OK → ${path.basename(finalPath)}`);
    console.log(`[Slot9] Saved: ${finalPath}`);
  } catch (err) {
    console.error(`\n[Slot9] FAIL: ${err.message}`);
    process.exit(1);
  }
}

// Lightweight fidelity guard inline (avoids depending on ImageGenerator class)
function this_fidelityGuard() {
  return 'PRODUCT FIDELITY IS CRITICAL: reproduce the wood card set EXACTLY as in the reference images — same proportions, same engraved text positions, same wood tone, same surface finish, same heart, same cavity. Do NOT redesign or reinterpret the product. Only the scene, props, and lighting are new.';
}

main().catch(err => {
  console.error('[Slot9] Fatal:', err.message);
  process.exit(1);
});
