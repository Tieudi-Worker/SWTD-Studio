#!/usr/bin/env node
/**
 * Father's Day Car Visor — Theme Swap (Valentine → Father's Day)
 *
 * Source: MK CAR VISOR - DRIVE SAFE I LOVE YOU (PR1)
 * Output: MK CAR VISOR - DRIVE SAFE I LOVE YOU (FD1)
 *
 * Strategy: Flux Kontext Pro/Max edits each source listing image:
 *   - MK1 (slot1): mọi thứ giữ nguyên, chỉ swap ảnh trong frame → bố con
 *   - Slot 2-7:    swap ảnh trong frame + đổi theme → Father's Day (bright, sky blue)
 *   - Slot 8 (NEW):  tạo lifestyle hero mới chưa có trong bản gốc
 *
 * Run: node scripts/fd-car-visor-theme-swap.js
 *      node scripts/fd-car-visor-theme-swap.js --slot 1    (chỉ chạy 1 slot)
 *      node scripts/fd-car-visor-theme-swap.js --dry-run   (print prompts, no API call)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);

try { require('dotenv').config({ path: path.join(__dirname, '..', 'config', 'api-keys.env') }); } catch(e) {}

const { KieClient } = require('../utils/kie-client');
const { createLogger } = require('../utils/logger');

const log = createLogger('FD-VISOR');

// ─── Paths ────────────────────────────────────────────────────────────────────
const AGENT_ROOT   = path.resolve(__dirname, '..');
const DATA_ROOT    = path.resolve(AGENT_ROOT, '..', 'data');
const PR1_DIR      = path.join(DATA_ROOT, 'MK CAR VISOR - DRIVE SAFE I LOVE YOU (PR1)');
const FD1_DIR      = path.join(DATA_ROOT, 'MK CAR VISOR - DRIVE SAFE I LOVE YOU (FD1)');
const OUT_DIR      = path.join(FD1_DIR, 'output', 'listing');
const CACHE_DIR    = path.join(FD1_DIR, 'research');

// ─── Shared photo description (used in all slots) ────────────────────────────
const FATHER_CHILD_PHOTO = `a joyful Father's Day portrait photo of a cheerful father (mid-30s, short beard, wearing a casual sky-blue button-up shirt) and his young son (around 6 years old, bright smile, wearing a white t-shirt) hugging and laughing together outdoors, bright clear blue sky background, warm natural daylight`;

const FRAME_CONSTANT = `The wooden car sun visor frame itself must remain EXACTLY as-is: light natural birch maple wood with rounded corners, silver stainless steel metal clip at the top, cursive engraved script text 'Drive Safe I Love You' at the bottom of the frame.`;

// ─── Slot definitions ─────────────────────────────────────────────────────────
const SLOTS = [
  // ── MK1: ONLY swap photo inside frame, everything else pixel-identical ──
  {
    num: 1,
    label: 'MK1_main',
    srcFile: 'MAIN.jpg',
    outFile: 'FD1_01_main.jpg',
    model: 'flux-kontext-pro',
    prompt: [
      `Replace ONLY the portrait photograph visible inside the rectangular wooden car visor frame with ${FATHER_CHILD_PHOTO}.`,
      `${FRAME_CONSTANT}`,
      `Do NOT change anything else in the image: keep the gray fabric car sun visor, the silver clip, the exact same camera angle, the same background lighting. Only the photo inside the frame window changes.`
    ].join(' ')
  },

  // ── Slot 2: Installation guide — empty frame, change color tone ──
  {
    num: 2,
    label: 'FD2_installation',
    srcFile: '71fq4jgUcXL._AC_SL1500_.jpg',
    outFile: 'FD1_02_installation.jpg',
    model: 'flux-kontext-pro',
    prompt: [
      `This image shows a wooden car visor photo frame product installation guide (no photo inside the frame — the frame is intentionally empty to show the product structure).`,
      `Shift the color theme from warm Valentine tones to a fresh Father's Day palette: replace any warm brown, rust, or copper accent colors with sky blue (#5BB3E0) or sage green. Keep all dividers, text, product photography, metal clip close-up, and installation instructions exactly the same.`,
      `${FRAME_CONSTANT}`,
      `The frame should remain empty (no photo inside) — this is the correct product state for this informational slide.`
    ].join(' ')
  },

  // ── Slot 3: Size chart — swap couple photo + change brown banner ──
  {
    num: 3,
    label: 'FD3_size_chart',
    srcFile: '71J0WfvhuEL._AC_SL1500_.jpg',
    outFile: 'FD1_03_size_chart.jpg',
    model: 'flux-kontext-max',
    prompt: [
      `Replace every couple photograph in this size-chart image with ${FATHER_CHILD_PHOTO}.`,
      `The father-child photo appears in two locations: (1) inside the large wooden frame on the left side, and (2) as a standalone cropped photo on the right side — replace both with the same father-child image.`,
      `Change the warm dark-brown bottom banner to a sky blue (#5BB3E0) banner. Update the 'PRODUCT DETAIL' label text color to white.`,
      `Keep all dimension measurement arrows, measurement values (4in/10.16cm, 3in/7.6cm, 2.4in/6cm, 3in/7.5cm), callout bubbles ('Wooden 3-layer 6mm thickness', 'Stainless Steel Visor Clip'), and the overall infographic layout exactly the same.`,
      `${FRAME_CONSTANT}`
    ].join(' ')
  },

  // ── Slot 4: Driver POV — swap frame photo + blue overlay ──
  {
    num: 4,
    label: 'FD4_driver_pov',
    srcFile: '71vyyEYy2KL._AC_SL1500_.jpg',
    outFile: 'FD1_04_driver_pov.jpg',
    model: 'flux-kontext-max',
    prompt: [
      `This split-image shows a driver's POV (car visor with frame) and a second lifestyle shot below.`,
      `Replace the couple photo inside the wooden car visor frame with ${FATHER_CHILD_PHOTO}.`,
      `Change the warm dark brown/orange text overlay at the bottom half to a cheerful sky blue (#5BB3E0) color overlay.`,
      `Keep the driver's perspective, car interior, car sun visor hardware, and the white text 'A reminder to drive safe from those we love' in the overlay.`,
      `${FRAME_CONSTANT}`
    ].join(' ')
  },

  // ── Slot 5: Gift scene — Dad + child gifting moment ──
  {
    num: 5,
    label: 'FD5_gift_scene',
    srcFile: '81Bn2OIr-IL._AC_SL1500_.jpg',
    outFile: 'FD1_05_gift_scene.jpg',
    model: 'flux-kontext-max',
    prompt: [
      `Transform this into a heartwarming Father's Day gift scene.`,
      `Replace the romantic Valentine's Day couple in the car backseat with a Father's Day gifting moment: a young child (8-10 years old, big excited smile) handing a small gift box with a sky-blue ribbon to their beaming, surprised dad sitting in the car backseat. Both faces happy and genuine.`,
      `Replace the couple photo inside the wooden frame with ${FATHER_CHILD_PHOTO}.`,
      `Change any warm brown or copper accent colors to sky blue.`,
      `Keep the wooden car visor frame as the main product foreground, the 'Drive Safe I Love You' engraved text, the car interior background, and the text 'Exquisite Package Will Make Great Gift' in the lower right.`,
      `${FRAME_CONSTANT}`
    ].join(' ')
  },

  // ── Slot 6: Hand holding in car ──
  {
    num: 6,
    label: 'FD6_hand_car',
    srcFile: '81DaWZ+dgDL._AC_SL1500_.jpg',
    outFile: 'FD1_06_hand_car.jpg',
    model: 'flux-kontext-pro',
    prompt: [
      `Replace the couple photograph inside the wooden car visor frame with ${FATHER_CHILD_PHOTO}.`,
      `Change the warm dark brown/black bottom banner to a cheerful sky blue (#5BB3E0) color. Update the 'CHERISHED MEMORIES' text color to white.`,
      `Keep everything else exactly the same: the hand holding the frame, the steering wheel and car dashboard blurred background, and the 'Drive Safe I Love You' script text on the frame.`,
      `${FRAME_CONSTANT}`
    ].join(' ')
  },

  // ── Slot 7: Hand holding outdoor ──
  {
    num: 7,
    label: 'FD7_hand_outdoor',
    srcFile: '81odwHgKyhL._AC_SL1500_.jpg',
    outFile: 'FD1_07_hand_outdoor.jpg',
    model: 'flux-kontext-pro',
    prompt: [
      `Replace the couple photograph inside the wooden car visor frame with ${FATHER_CHILD_PHOTO}.`,
      `Change the warm dark brown bottom banner to sky blue (#5BB3E0). Update the 'WITH YOU ON EVERY DRIVE' text to white.`,
      `Keep everything else exactly the same: the hand holding the frame, the car side mirror and outdoor road background, and the 'Drive Safe I Love You' script text.`,
      `${FRAME_CONSTANT}`
    ].join(' ')
  },

  // ── Slot 8 (NEW): Father's Day hero lifestyle desk shot ──
  {
    num: 8,
    label: 'FD8_lifestyle_hero',
    srcFile: 'MAIN.jpg',  // Use MK1 as base reference for the product
    outFile: 'FD1_08_lifestyle_hero.jpg',
    model: 'flux-kontext-max',
    prompt: [
      `Completely reimagine this photo as a new Father's Day hero lifestyle shot.`,
      `Keep the exact same wooden car sun visor frame product (${FRAME_CONSTANT}).`,
      `New scene: the wooden frame is placed on a dad's clean wooden desk or side table, leaning against a open Father's Day card that reads 'Happy Father's Day'. ${FATHER_CHILD_PHOTO} is visible inside the frame.`,
      `Surrounding props: a white ceramic coffee mug, a small green succulent plant in a terracotta pot, a pair of glasses folded nearby. Soft warm natural window light from the upper left, shallow depth of field, blurred green background bokeh.`,
      `Color palette: sky blue, fresh sage green, natural wood — cheerful and bright, no warm red or romantic pink.`,
      `Bottom of image has a sky blue text banner reading: 'THE PERFECT FATHER'S DAY GIFT' in clean sans-serif white text.`,
      `Square 1:1 composition, Amazon listing quality, photorealistic.`
    ].join(' ')
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractUrl(result) {
  if (typeof result === 'string') return result;
  return result?.resultImageUrl || result?.resultUrls?.[0] || result?.url || result?.image_url || result?.output || null;
}

async function downloadAndResize(url, outPath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} downloading ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  await sharp(buf)
    .resize(2000, 2000, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 95 })
    .toFile(outPath);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlySlot = (() => { const i = args.indexOf('--slot'); return i !== -1 ? parseInt(args[i + 1]) : null; })();

  log.info('═══════════════════════════════════════════════════');
  log.info("Father's Day Car Visor — Flux Kontext Theme Swap");
  log.info('═══════════════════════════════════════════════════');
  log.info(`Source:  ${PR1_DIR}`);
  log.info(`Output:  ${OUT_DIR}`);
  if (dryRun) log.info('DRY RUN — no API calls');
  if (onlySlot) log.info(`Running only slot ${onlySlot}`);

  // Ensure dirs
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  if (dryRun) {
    for (const slot of SLOTS) {
      if (onlySlot && slot.num !== onlySlot) continue;
      log.info(`\n[Slot ${slot.num}] ${slot.label}`);
      log.info(`  src: ${slot.srcFile}`);
      log.info(`  out: ${slot.outFile}`);
      log.info(`  model: ${slot.model}`);
      log.info(`  prompt (${slot.prompt.split(' ').length} words):`);
      log.info(`  "${slot.prompt.substring(0, 120)}..."`);
    }
    return;
  }

  const kieKey = process.env.KIE_KEY;
  if (!kieKey) { log.error('KIE_KEY not set. Check config/api-keys.env'); process.exit(1); }
  const kie = new KieClient(kieKey);
  kie.setCacheDir(CACHE_DIR);

  const results = { ok: [], fail: [], skip: [] };

  for (const slot of SLOTS) {
    if (onlySlot && slot.num !== onlySlot) continue;

    const srcPath = path.join(PR1_DIR, slot.srcFile);
    const outPath = path.join(OUT_DIR, slot.outFile);

    log.info(`\n[Slot ${slot.num}/${SLOTS.length}] ${slot.label}`);

    // Checkpoint — skip if already done
    if (fs.existsSync(outPath)) {
      log.info(`  ✓ Already exists — skip`);
      results.skip.push(slot.label);
      continue;
    }

    if (!fs.existsSync(srcPath)) {
      log.warn(`  ✗ Source not found: ${srcPath}`);
      results.fail.push(slot.label);
      continue;
    }

    try {
      // 1. Upload source at high quality
      log.info(`  Uploading ${slot.srcFile}...`);
      const srcUrl = await kie.uploadFromLocal(srcPath, 'fd-car-visor', { maxSize: 2048, quality: 95 });
      log.info(`  Uploaded ✓`);

      // 2. Flux Kontext edit
      log.info(`  Running ${slot.model}...`);
      const result = await kie.fluxRun({
        model: slot.model,
        prompt: slot.prompt,
        input_image: srcUrl,
        seed: 42,
        outputFormat: 'jpeg',
      });

      const imageUrl = extractUrl(result);
      if (!imageUrl) {
        log.warn(`  No URL in result: ${JSON.stringify(result).substring(0, 200)}`);
        fs.writeFileSync(outPath.replace('.jpg', '_debug.json'), JSON.stringify(result, null, 2));
        results.fail.push(slot.label);
        continue;
      }

      // 3. Download + resize to 2000x2000
      log.info(`  Downloading + resizing to 2000x2000...`);
      await downloadAndResize(imageUrl, outPath);
      log.info(`  ✓ Saved → ${slot.outFile}`);
      results.ok.push(slot.label);

    } catch (err) {
      log.error(`  ✗ Error: ${err.message}`);
      fs.writeFileSync(outPath.replace('.jpg', '_error.txt'), err.message + '\n' + (err.stack || ''));
      results.fail.push(slot.label);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  log.info('\n═══════════════════════════════════════════════════');
  log.info('SUMMARY');
  log.info('═══════════════════════════════════════════════════');
  log.info(`  ✓ OK:     ${results.ok.length}  [${results.ok.join(', ')}]`);
  log.info(`  → Skip:   ${results.skip.length}  [${results.skip.join(', ')}]`);
  log.info(`  ✗ Failed: ${results.fail.length}  [${results.fail.join(', ')}]`);
  log.info(`\nOutput: ${OUT_DIR}`);
}

main().catch(err => { log.error('Fatal:', err.message); process.exit(1); });
