#!/usr/bin/env node
/**
 * Father's Day Car Visor — nano-banana-pro Generation v3
 *
 * v3 improvements over v2:
 *   - CHARACTER LOCK: specific skin tone + hair color + clothing to enforce cross-slot consistency
 *   - PRODUCT GUARD v2: explicit PORTRAIT orientation (taller than wide), small spring visor clip
 *   - Slot 07 fix: daughter (not son) presenting gift, portrait frame orientation explicit
 *
 * Paradigm: Product refs từ input/product/ → image_input array
 *            Prompts mô tả SCENE only, KHÔNG mô tả product chi tiết
 *            Product identity = reference images (RULE-015)
 *
 * Source brief: data/MK CAR VISOR - DRIVE SAFE I LOVE YOU (FD1)/brief.json
 * Output:       data/MK CAR VISOR - DRIVE SAFE I LOVE YOU (FD1)/output/listing/
 *
 * Run:
 *   node scripts/fd-car-visor-nano-banana-v2.js
 *   node scripts/fd-car-visor-nano-banana-v2.js --slot 1        (chỉ 1 slot)
 *   node scripts/fd-car-visor-nano-banana-v2.js --dry-run        (xem prompts)
 *   node scripts/fd-car-visor-nano-banana-v2.js --regen slot3   (xóa + regen)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);

try { require('dotenv').config({ path: path.join(__dirname, '..', 'config', 'api-keys.env') }); } catch(e) {}

const { KieClient } = require('../utils/kie-client');
const { createLogger } = require('../utils/logger');

const log = createLogger('FD-NANO-V3');

// ─── Paths ────────────────────────────────────────────────────────────────────
const AGENT_ROOT = path.resolve(__dirname, '..');
const SKU_DIR    = path.resolve(AGENT_ROOT, '..', 'data', 'MK CAR VISOR - DRIVE SAFE I LOVE YOU (FD1)');
const BRIEF_PATH = path.join(SKU_DIR, 'brief.json');
const OUT_DIR    = path.join(SKU_DIR, 'output', 'listing');
const CACHE_DIR  = path.join(SKU_DIR, 'research');

// ─── CHARACTER LOCK — consistent across ALL 8 slots ──────────────────────────
// Skin tone + hair color + clothing locked to prevent cross-slot drift.
const FATHER = 'a light-skinned Caucasian father in his mid-30s, short neatly trimmed dark-brown beard, wearing a sky-blue chambray button-up shirt, warm brown eyes, gentle smile';
const DAUGHTER = 'his 6-year-old daughter with curly shoulder-length dark-brown hair, light skin, wearing a white t-shirt, big joyful smile';
const PHOTO_DESC = `a Father's Day portrait photo of ${FATHER} hugging ${DAUGHTER} outdoors under a bright clear blue sky — both laughing and looking happy`;

// ─── PRODUCT GUARD v2 — portrait orientation + correct clip type ──────────────
// Explicit: PORTRAIT (taller than wide), small spring visor clip (NOT clipboard binder clip)
const GUARD = [
  'Keep the product EXACTLY as in the reference images:',
  'PORTRAIT orientation — frame is TALLER than wide (4 inches tall × 3 inches wide), never rotated to landscape.',
  'Natural birch wood, rounded corners, 6mm thick.',
  'TOP: small narrow stainless steel spring-loaded visor clip (two slim parallel silver bars) — NOT a large binder clip.',
  'BOTTOM: cursive Drive Safe I Love You engraved script.',
  'Do NOT redesign, do NOT rotate, do NOT change clip style.'
].join(' ');

// ─── Negative prompt (shared) ─────────────────────────────────────────────────
const NEG = [
  'romantic couple, kissing, Valentine lovers, man woman kissing, red roses, heart decorations,',
  'warm amber tones, dark moody lighting, empty blank frame without photo, wall picture frame,',
  'landscape horizontal frame, binder clip, large clipboard clip,',
  'African American father, Asian father, bald man, woman, couple embracing romantically'
].join(' ');

// ─── 8 Slots ──────────────────────────────────────────────────────────────────
// Prompts: SCENE only. Product identity comes from reference images (RULE-015).
// Character description is consistent across all slots via PHOTO_DESC constant.
const SLOTS = [
  {
    num: 1,
    label: 'main_hero',
    outFile: 'FD3_01_main.jpg',
    prompt: [
      `The wooden car visor frame from the reference image, clipped to a real car sun visor.`,
      `Inside the frame window, ${PHOTO_DESC}.`,
      `Camera centered on product, gray car visor fabric fills background.`,
      `Natural car interior light, soft shadow beneath frame.`,
      `Sharp product focus, clean professional shot.`,
      GUARD
    ].join(' ')
  },
  {
    num: 2,
    label: 'driver_pov',
    outFile: 'FD3_02_driver_pov.jpg',
    prompt: [
      `Driver's perspective inside a bright modern car.`,
      `The wooden visor frame from the reference is clipped to the beige sun visor overhead.`,
      `Inside the frame, ${PHOTO_DESC}.`,
      `Morning light through windshield, fresh green trees outside.`,
      `Lower third shows dad's hands on steering wheel.`,
      `Sky-blue text strip at bottom: 'A reminder to drive safe from those we love'.`,
      `Cheerful Father's Day mood, bright and fresh.`,
      GUARD
    ].join(' ')
  },
  {
    num: 3,
    label: 'size_chart',
    outFile: 'FD3_03_size_chart.jpg',
    prompt: [
      `Product size infographic on clean white background.`,
      `LEFT: the wooden visor frame from the reference with ${PHOTO_DESC} inside the frame window.`,
      `Vertical dimension arrow on left (4 in / 10.16 cm), horizontal arrow at bottom (3 in / 7.6 cm).`,
      `RIGHT: the standalone photo print size (3 in / 7.5 cm height, 2.4 in / 6 cm width) with measurement arrows.`,
      `BOTTOM: two sky-blue rounded callout badges — 'Wooden 3-layer / 6mm thickness' with wood icon, 'Stainless Steel Visor Clip' with clip icon.`,
      `Sky-blue 'PRODUCT DETAIL' footer banner. Clean infographic, white background, sky-blue (#5BB3E0) accents.`,
      GUARD
    ].join(' ')
  },
  {
    num: 4,
    label: 'hand_car',
    outFile: 'FD3_04_hand_car.jpg',
    prompt: [
      `A hand holds the wooden visor frame from the reference in front of a car steering wheel.`,
      `Inside the frame window, ${PHOTO_DESC}.`,
      `Small stainless steel spring clip at top, 'Drive Safe I Love You' text readable at frame bottom.`,
      `Blurred car dashboard and steering wheel as background.`,
      `Natural window light, soft focus background.`,
      `Sky-blue banner at bottom: 'CHERISHED MEMORIES' in white text.`,
      GUARD
    ].join(' ')
  },
  {
    num: 5,
    label: 'display_grid',
    outFile: 'FD3_05_display_grid.jpg',
    prompt: [
      `2x2 display grid infographic on soft cream background.`,
      `The wooden visor frame from the reference (with ${PHOTO_DESC} inside) shown clipped to 4 different car visors:`,
      `Cell 01 top-left: beige fabric visor in a bright modern SUV interior.`,
      `Cell 02 top-right: dark visor in a family sedan.`,
      `Cell 03 bottom-left: gray visor in a pickup truck interior.`,
      `Cell 04 bottom-right: tan visor in a minivan.`,
      `Each cell: sky-blue numbered circle label (01-04) top-left corner, sky-blue caption bar at cell bottom.`,
      `Sky-blue header banner at top: 'FITS ANY CAR VISOR'. White dividers between cells.`,
      GUARD
    ].join(' ')
  },
  {
    num: 6,
    label: 'flatlay_gift',
    outFile: 'FD3_06_flatlay_gift.jpg',
    prompt: [
      `Overhead flat lay on a warm natural wooden table, visible wood grain.`,
      `CENTER: the wooden visor frame from the reference with ${PHOTO_DESC} inside.`,
      `SURROUNDING props: sky-blue gift box with white ribbon (top-left), Father's Day greeting card 'Happy Father's Day, Dad!' (bottom-left), small succulent plant in terracotta pot (top-right), kraft paper gift bag (bottom-right), scattered sky-blue star confetti.`,
      `Warm overhead natural light. Bright Father's Day palette: sky blue, sage green, natural wood. No red or pink.`,
      GUARD
    ].join(' ')
  },
  {
    num: 7,
    label: 'gift_moment',
    outFile: 'FD3_07_gift_moment.jpg',
    prompt: [
      `Heartwarming Father's Day indoor scene: ${DAUGHTER} (the same daughter from the photo inside the frame) presents the wooden visor frame with both hands to her kneeling, beaming ${FATHER}.`,
      `The PORTRAIT-orientation frame (taller than wide) from the reference shows the father-daughter portrait photo inside.`,
      `Bright living room, soft morning sunshine through window. Sky-blue gift bag on floor beside them.`,
      `Genuine joy on both faces — emotional Father's Day gift moment.`,
      `Sky-blue banner at bottom: 'Exquisite Package Will Make Great Gift' in white text.`,
      GUARD
    ].join(' ')
  },
  {
    num: 8,
    label: 'desk_hero',
    outFile: 'FD3_08_desk_hero.jpg',
    prompt: [
      `The wooden visor frame from the reference standing upright on a warm wooden desk.`,
      `Inside the frame window, ${PHOTO_DESC} fills the portrait opening.`,
      `Desk scene: open 'Happy Father's Day' greeting card propped beside frame (left), white ceramic coffee mug (right), folded reading glasses on desk surface.`,
      `Bright natural window light from upper-left, soft green garden bokeh in background.`,
      `Shallow depth of field, frame in sharp focus.`,
      `Sky-blue bottom banner: 'THE PERFECT FATHER'S DAY GIFT' in white text.`,
      GUARD
    ].join(' ')
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function uploadRefs(kie, refPaths) {
  const urls = [];
  for (const refPath of refPaths) {
    if (!fs.existsSync(refPath)) { log.warn(`Ref not found: ${refPath}`); continue; }
    log.info(`  Uploading ref: ${path.basename(refPath)}`);
    const url = await kie.uploadFromLocal(refPath, 'fd-car-visor-v3', { maxSize: 2048, quality: 95 });
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
  const dryRun   = args.includes('--dry-run');
  const regenArg = (() => { const i = args.indexOf('--regen'); return i !== -1 ? args[i + 1] : null; })();
  const onlySlot = (() => { const i = args.indexOf('--slot');  return i !== -1 ? parseInt(args[i + 1]) : null; })();

  log.info('═══════════════════════════════════════════════════════');
  log.info("Father's Day Car Visor — nano-banana-pro v3 (character lock)");
  log.info('═══════════════════════════════════════════════════════');
  log.info(`SKU dir: ${SKU_DIR}`);
  log.info(`Output:  ${OUT_DIR}`);
  if (dryRun) log.info('DRY RUN — no API calls');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const brief = JSON.parse(fs.readFileSync(BRIEF_PATH, 'utf8'));
  const negPrompt = (brief.negative_prompt || NEG) + ', ' + [
    'landscape horizontal frame', 'binder clip', 'large clipboard clip',
    'son boy presenting gift', 'dark-skinned father', 'Asian father', 'bald man'
  ].join(', ');

  if (dryRun) {
    log.info('\n=== CHARACTER DESCRIPTION ===');
    log.info(`Father:   "${FATHER}"`);
    log.info(`Daughter: "${DAUGHTER}"`);
    log.info('\n=== PRODUCT GUARD ===');
    log.info(GUARD);
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
      const result = await kie.run('nano-banana-pro', input, 'image', `v3-slot${slot.num}`);

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

  log.info('\n═══════════════════════════════════════════════════════');
  log.info('SUMMARY');
  log.info('═══════════════════════════════════════════════════════');
  log.info(`  ✓ OK:     ${results.ok.length}  [${results.ok.join(', ')}]`);
  log.info(`  → Skip:   ${results.skip.length}  [${results.skip.join(', ')}]`);
  log.info(`  ✗ Failed: ${results.fail.length}  [${results.fail.join(', ')}]`);
  log.info(`\nOutput: ${OUT_DIR}`);
}

main().catch(err => { log.error('Fatal:', err.message); process.exit(1); });
