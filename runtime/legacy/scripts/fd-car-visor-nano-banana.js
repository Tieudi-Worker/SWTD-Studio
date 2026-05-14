#!/usr/bin/env node
/**
 * Father's Day Car Visor — nano-banana-pro Generation
 *
 * Paradigm: Product refs từ input/product/ → image_input array
 *            Prompts mô tả SCENE only, KHÔNG mô tả product chi tiết
 *            Product identity = reference images (RULE-015)
 *
 * Source brief: data/MK CAR VISOR - DRIVE SAFE I LOVE YOU (FD1)/brief.json
 * Output:       data/MK CAR VISOR - DRIVE SAFE I LOVE YOU (FD1)/output/listing/
 *
 * Run:
 *   node scripts/fd-car-visor-nano-banana.js
 *   node scripts/fd-car-visor-nano-banana.js --slot 1        (chỉ 1 slot)
 *   node scripts/fd-car-visor-nano-banana.js --dry-run        (xem prompts)
 *   node scripts/fd-car-visor-nano-banana.js --regen slot3   (xóa + regen)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);

try { require('dotenv').config({ path: path.join(__dirname, '..', 'config', 'api-keys.env') }); } catch(e) {}

const { KieClient } = require('../utils/kie-client');
const { createLogger } = require('../utils/logger');

const log = createLogger('FD-NANO');

// ─── Paths ────────────────────────────────────────────────────────────────────
const AGENT_ROOT = path.resolve(__dirname, '..');
const SKU_DIR    = path.resolve(AGENT_ROOT, '..', 'data', 'MK CAR VISOR - DRIVE SAFE I LOVE YOU (FD1)');
const BRIEF_PATH = path.join(SKU_DIR, 'brief.json');
const OUT_DIR    = path.join(SKU_DIR, 'output', 'listing');
const CACHE_DIR  = path.join(SKU_DIR, 'research');
const PROD_DIR   = path.join(SKU_DIR, 'input', 'product');

// ─── Father-child photo description (shared across all slots) ─────────────────
const PHOTO_DESC = 'a joyful Father\'s Day portrait of a smiling father (mid-30s, short beard, casual blue shirt) hugging his young daughter (around 6 years old, bright smile, white top, curly hair) outdoors with clear blue sky';

// ─── Fidelity guard (short — RULE-015) ───────────────────────────────────────
const GUARD = 'Keep the product identical to the reference images — same shape, same frame proportions, same clip style, same engraved text position. Do NOT redesign.';

// ─── Negative prompt (shared) ─────────────────────────────────────────────────
const NEG = 'romantic couple, kissing, Valentine lovers, man woman kissing, red roses, heart decorations, warm amber tones, dark moody lighting, empty blank frame without photo, wall picture frame, couple embracing romantically';

// ─── 8 Slots ──────────────────────────────────────────────────────────────────
// Prompts: SCENE only. ~60-120 words per slot. Product = reference images.
// Per RULE-015: avoid product text description. Scene drives the generation.
const SLOTS = [
  {
    num: 1,
    label: 'main_hero',
    outFile: 'FD2_01_main.jpg',
    prompt: [
      `The wooden car visor frame from the reference image, clipped to a real car sun visor.`,
      `Inside the frame window, ${PHOTO_DESC} is clearly visible.`,
      `Camera centered on product, gray car visor fabric fills background.`,
      `Natural car interior light, soft shadow beneath frame.`,
      `Sharp product focus, clean professional shot.`,
      `${GUARD}`
    ].join(' ')
  },
  {
    num: 2,
    label: 'driver_pov',
    outFile: 'FD2_02_driver_pov.jpg',
    prompt: [
      `Driver's perspective inside a bright modern car.`,
      `The wooden visor frame from the reference is clipped to the beige sun visor overhead.`,
      `Inside the frame, ${PHOTO_DESC}.`,
      `Morning light through windshield, fresh green trees outside.`,
      `Lower third shows dad's hands on steering wheel.`,
      `Sky-blue text strip at bottom: 'A reminder to drive safe from those we love'.`,
      `Cheerful Father's Day mood, bright and fresh.`,
      `${GUARD}`
    ].join(' ')
  },
  {
    num: 3,
    label: 'size_chart',
    outFile: 'FD2_03_size_chart.jpg',
    prompt: [
      `Product size infographic on clean white background.`,
      `LEFT: the wooden visor frame from the reference with ${PHOTO_DESC} inside the frame window.`,
      `Vertical dimension arrow on left (4 in / 10.16 cm), horizontal arrow at bottom (3 in / 7.6 cm).`,
      `RIGHT: the standalone photo print size (3 in / 7.5 cm height, 2.4 in / 6 cm width) with measurement arrows.`,
      `BOTTOM: two sky-blue rounded callout badges — 'Wooden 3-layer / 6mm thickness' with wood icon, 'Stainless Steel Visor Clip' with clip icon.`,
      `Sky-blue 'PRODUCT DETAIL' footer banner. Clean infographic, white background, sky-blue (#5BB3E0) accents.`,
      `${GUARD}`
    ].join(' ')
  },
  {
    num: 4,
    label: 'hand_car',
    outFile: 'FD2_04_hand_car.jpg',
    prompt: [
      `A hand holds the wooden visor frame from the reference in front of a car steering wheel.`,
      `Inside the frame window, ${PHOTO_DESC} is clearly visible.`,
      `Stainless steel clip at top, 'Drive Safe I Love You' text readable at frame bottom.`,
      `Blurred car dashboard and steering wheel as background.`,
      `Natural window light, soft focus background.`,
      `Sky-blue banner at bottom: 'CHERISHED MEMORIES' in white text.`,
      `${GUARD}`
    ].join(' ')
  },
  {
    num: 5,
    label: 'display_grid',
    outFile: 'FD2_05_display_grid.jpg',
    prompt: [
      `2x2 display grid infographic on soft cream background.`,
      `The wooden visor frame from the reference (with ${PHOTO_DESC} inside) shown in 4 different car visors:`,
      `Cell 01 top-left: beige fabric visor in a bright modern SUV.`,
      `Cell 02 top-right: black visor in a family sedan.`,
      `Cell 03 bottom-left: gray visor in a pickup truck interior.`,
      `Cell 04 bottom-right: tan visor in a minivan.`,
      `Each cell: sky-blue numbered circle label (01-04) top-left, sky-blue caption bar at cell bottom.`,
      `Sky-blue header banner: 'FITS ANY CAR VISOR'. Clean grid, white dividers between cells.`,
      `${GUARD}`
    ].join(' ')
  },
  {
    num: 6,
    label: 'flatlay_gift',
    outFile: 'FD2_06_flatlay_gift.jpg',
    prompt: [
      `Overhead flat lay on a natural warm wooden table.`,
      `CENTER: the wooden visor frame from the reference with ${PHOTO_DESC} inside.`,
      `SURROUNDING: sky-blue gift box with white ribbon, a Father's Day greeting card ('Happy Father's Day, Dad!'), small succulent plant in terracotta pot, kraft paper gift bag, scattered sky-blue confetti stars.`,
      `Warm overhead natural light, visible wood grain table surface.`,
      `Bright Father's Day palette: sky blue, sage green, natural wood. No red or pink.`,
      `${GUARD}`
    ].join(' ')
  },
  {
    num: 7,
    label: 'gift_moment',
    outFile: 'FD2_07_gift_moment.jpg',
    prompt: [
      `A young child (8 years old) presents the wooden visor frame with both hands to a kneeling, smiling dad.`,
      `The frame from the reference has ${PHOTO_DESC} inside its window.`,
      `Bright living room, soft morning sunshine through window.`,
      `Sky-blue gift bag and ribbon visible on floor beside them.`,
      `Genuine joy on both faces — heartwarming Father's Day moment.`,
      `Sky-blue bottom banner: 'Exquisite Package Will Make Great Gift'.`,
      `Warm golden morning light, emotional lifestyle photography.`,
      `${GUARD}`
    ].join(' ')
  },
  {
    num: 8,
    label: 'desk_hero',
    outFile: 'FD2_08_desk_hero.jpg',
    prompt: [
      `The wooden visor frame from the reference standing upright on a warm wooden desk.`,
      `Inside the frame window, ${PHOTO_DESC} fills the portrait opening.`,
      `Desk scene: open 'Happy Father\'s Day' greeting card propped beside frame, white ceramic coffee mug, folded reading glasses.`,
      `Bright natural window light from upper-left, soft green garden bokeh in background.`,
      `Shallow depth of field, frame is sharp focus.`,
      `Sky-blue bottom banner: 'THE PERFECT FATHER\'S DAY GIFT' in white text.`,
      `Warm sentimental keepsake mood, bright and fresh.`,
      `${GUARD}`
    ].join(' ')
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function uploadRefs(kie, refPaths) {
  const urls = [];
  for (const refPath of refPaths) {
    if (!fs.existsSync(refPath)) { log.warn(`Ref not found: ${refPath}`); continue; }
    log.info(`  Uploading ref: ${path.basename(refPath)}`);
    // High-quality upload per CLAUDE.md aplus-flow discovery: maxSize 2048 / quality 95
    const url = await kie.uploadFromLocal(refPath, 'fd-car-visor-refs', { maxSize: 2048, quality: 95 });
    urls.push(url);
  }
  return urls;
}

async function downloadAndResize(url, outPath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  await sharp(buf)
    .resize(2000, 2000, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 95 })
    .toFile(outPath);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun  = args.includes('--dry-run');
  const regenArg = (() => { const i = args.indexOf('--regen'); return i !== -1 ? args[i + 1] : null; })();
  const onlySlot = (() => { const i = args.indexOf('--slot');  return i !== -1 ? parseInt(args[i + 1]) : null; })();

  log.info('═══════════════════════════════════════════════════════');
  log.info("Father's Day Car Visor — nano-banana-pro Generation v2");
  log.info('═══════════════════════════════════════════════════════');
  log.info(`SKU dir: ${SKU_DIR}`);
  log.info(`Output:  ${OUT_DIR}`);
  if (dryRun) log.info('DRY RUN — no API calls');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  // Load brief
  const brief = JSON.parse(fs.readFileSync(BRIEF_PATH, 'utf8'));
  const negPrompt = brief.negative_prompt || NEG;

  if (dryRun) {
    log.info('\n=== PROMPTS PREVIEW ===');
    for (const slot of SLOTS) {
      if (onlySlot && slot.num !== onlySlot) continue;
      const words = slot.prompt.split(/\s+/).filter(Boolean).length;
      log.info(`\n[Slot ${slot.num}] ${slot.label} (${words} words)`);
      log.info(`  out: ${slot.outFile}`);
      log.info(`  prompt: "${slot.prompt.substring(0, 160)}..."`);
    }
    log.info('\n=== NEGATIVE PROMPT ===');
    log.info(negPrompt);
    return;
  }

  const kieKey = process.env.KIE_KEY;
  if (!kieKey) { log.error('KIE_KEY not set'); process.exit(1); }
  const kie = new KieClient(kieKey);
  kie.setCacheDir(CACHE_DIR);

  // Upload product reference images once (cached)
  const refPaths = (brief.input_images || []).map(p =>
    path.isAbsolute(p) ? p : path.join(SKU_DIR, p)
  );
  log.info('\nUploading product references...');
  const refUrls = await uploadRefs(kie, refPaths);
  log.info(`  ${refUrls.length}/${refPaths.length} refs uploaded`);

  if (refUrls.length === 0) {
    log.error('No reference images uploaded — abort');
    process.exit(1);
  }

  // Regen: delete specific slot output to force regen
  if (regenArg) {
    const regenSlot = SLOTS.find(s => s.label === regenArg || String(s.num) === regenArg);
    if (regenSlot) {
      const outPath = path.join(OUT_DIR, regenSlot.outFile);
      if (fs.existsSync(outPath)) { fs.unlinkSync(outPath); log.info(`Deleted ${regenSlot.outFile} for regen`); }
    }
  }

  const results = { ok: [], fail: [], skip: [] };

  for (const slot of SLOTS) {
    if (onlySlot && slot.num !== onlySlot) continue;

    const outPath = path.join(OUT_DIR, slot.outFile);
    log.info(`\n[Slot ${slot.num}/8] ${slot.label}`);

    // Checkpoint
    if (fs.existsSync(outPath)) {
      log.info('  ✓ Already exists — skip (use --regen to force)');
      results.skip.push(slot.label);
      continue;
    }

    try {
      const input = {
        prompt: slot.prompt,
        resolution: '2K',
        aspect_ratio: '1:1',
        output_format: 'jpg',
        image_input: refUrls,
        negative_prompt: negPrompt
      };

      log.info(`  Generating via nano-banana-pro (${slot.prompt.split(/\s+/).length} words)...`);
      const result = await kie.run('nano-banana-pro', input, 'image', `slot${slot.num}`);

      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error(`No resultUrl — raw: ${JSON.stringify(result).substring(0, 200)}`);

      log.info('  Downloading + resize to 2000x2000...');
      await downloadAndResize(imageUrl, outPath);
      log.info(`  ✓ Saved → ${slot.outFile}`);
      results.ok.push(slot.label);

    } catch (err) {
      log.error(`  ✗ ${err.message}`);
      fs.writeFileSync(outPath.replace('.jpg', '_error.txt'), err.message + '\n' + (err.stack || ''));
      results.fail.push(slot.label);
    }
  }

  // Summary
  log.info('\n═══════════════════════════════════════════════════════');
  log.info('SUMMARY');
  log.info('═══════════════════════════════════════════════════════');
  log.info(`  ✓ OK:     ${results.ok.length}  [${results.ok.join(', ')}]`);
  log.info(`  → Skip:   ${results.skip.length}  [${results.skip.join(', ')}]`);
  log.info(`  ✗ Failed: ${results.fail.length}  [${results.fail.join(', ')}]`);
  log.info(`\nOutput: ${OUT_DIR}`);
}

main().catch(err => { log.error('Fatal:', err.message); process.exit(1); });
