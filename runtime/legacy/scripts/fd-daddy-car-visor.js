#!/usr/bin/env node
/**
 * Father's Day Car Visor v2 — Đồng nhất nhân vật + sản phẩm
 *
 * Strategy v2:
 *   Step 0: Gen "canonical family photo" (_family_ref.jpg) — 1 lần duy nhất
 *   Step 1-8: Mỗi slot dùng _family_ref.jpg làm ref → nhân vật đồng nhất
 *             + product ref (Main.jpg / empty frame) → sản phẩm đồng nhất
 *             + CHARACTER LOCK + PRODUCT LOCK inject đầu mỗi prompt
 *
 * Output: FD2_01_main.jpg ... FD2_08_gift_moment.jpg
 *
 * Run:
 *   node scripts/fd-daddy-car-visor.js              # full 8 slots
 *   node scripts/fd-daddy-car-visor.js --slot 0     # chỉ gen family ref
 *   node scripts/fd-daddy-car-visor.js --slot 3     # chỉ slot 3
 *   node scripts/fd-daddy-car-visor.js --dry-run    # preview prompts
 *   node scripts/fd-daddy-car-visor.js --skip 2,5   # bỏ qua slot đã ok
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');
sharp.cache(false);

try { require('dotenv').config({ path: path.join(__dirname, '..', 'config', 'api-keys.env') }); } catch(e) {}

const { KieClient } = require('../utils/kie-client');
const { createLogger } = require('../utils/logger');

const log = createLogger('FD-DAD-V2');

// ─── Paths ────────────────────────────────────────────────────────────────────
const AGENT_ROOT   = path.resolve(__dirname, '..');
const DATA_ROOT    = path.resolve(AGENT_ROOT, '..', 'data');
const SKU_DIR      = path.join(DATA_ROOT, 'MK CAR VISOR - DRIVE SAFE, DADDY WE LOVE YOU (PR1)');
const OUT_DIR      = path.join(SKU_DIR, 'output', 'fathers-day');
const CACHE_DIR    = path.join(SKU_DIR, 'research');
const FAMILY_REF   = path.join(OUT_DIR, '_family_ref.jpg');

// Source product images
const SRC_MAIN     = path.join(SKU_DIR, 'Main.jpg');
const SRC_EMPTY    = path.join(SKU_DIR, '81yGwKHyKkL._AC_SL1500_.jpg');  // empty frame
const SRC_CLOSEUP  = path.join(SKU_DIR, '81Z4XLXzc+L._AC_SL1500_.jpg'); // close-up hand-held

// ─── Character + Product lock strings ────────────────────────────────────────
// Inject vào đầu mỗi prompt để lock nhân vật và sản phẩm.
const CHAR_LOCK =
  `Use the EXACT same family from the reference photo: ` +
  `dad mid-30s, short dark hair, light blue casual shirt, warm genuine smile; ` +
  `boy ~7 curly brown hair, blue t-shirt; ` +
  `girl ~5 curly brown hair, coral-pink dress. ` +
  `Same faces, same clothing, same hair throughout.`;

const PROD_LOCK =
  `SAME wooden car visor frame as reference: ` +
  `natural birch wood, rounded corners, hand-drawn heart engravings on both sides, ` +
  `engraved cursive "Drive Safe, Daddy! We Love You" at bottom, stainless steel spring clip at top.`;

// ─── Step 0 — Canonical family reference ─────────────────────────────────────
const FAMILY_REF_PROMPT =
  `Professional lifestyle portrait, 1:1 square, bright outdoor park setting. ` +
  `Father: mid-30s, short dark brown hair, clean-shaven, light sky-blue casual button-up shirt, ` +
  `wide genuine smile, athletic build. ` +
  `Son: ~7 years old, curly brown hair, blue crew-neck t-shirt, laughing smile. ` +
  `Daughter: ~5 years old, curly brown hair, coral-pink sleeveless dress, joyful expression. ` +
  `All three together — dad in center, both kids hugging him and laughing, ` +
  `lush green park grass and trees behind, clear blue sky, bright natural sunlight. ` +
  `Vibrant, cheerful, photorealistic portrait photography.`;

// ─── Slot prompts (scene description — CHAR_LOCK + PROD_LOCK prepended in code) ─
// Brief's actual scenes (loaded dynamically below) + hand-crafted for slots needing precision

// ─── Brief ────────────────────────────────────────────────────────────────────
const BRIEF_PATH = path.join(SKU_DIR, 'brief.json');
if (!fs.existsSync(BRIEF_PATH)) { console.error('brief.json not found'); process.exit(1); }
const brief = JSON.parse(fs.readFileSync(BRIEF_PATH, 'utf8'));
const sc    = brief.slot_concepts || {};
function briefScene(n) { return sc[`slot${n}`]?.prompt || sc[`slot${n}`]?.scene || ''; }

// ─── Slot definitions ─────────────────────────────────────────────────────────
// refs: array of local file paths to upload as reference images
// prompt: scene description (CHAR_LOCK + PROD_LOCK auto-prepended)
// addCharLock / addProdLock: booleans to control injection
const SLOTS = [
  // ── Slot 1: Main — car visor exact reproduction, only photo inside swapped
  {
    num:    1,
    label:  'main',
    outFile:'FD2_01_main.jpg',
    refs:   [SRC_MAIN, FAMILY_REF],
    addCharLock: true,
    addProdLock: true,
    prompt:
      `Exact reproduction of the source car visor scene. ` +
      `Keep identical: gray fabric car sun visor, car interior background, camera angle, lighting. ` +
      `Photo inside the frame window: the dad and two kids from the reference family photo, ` +
      `laughing together in a sunny green park. ` +
      `Photorealistic Amazon product photography.`,
  },

  // ── Slot 2: Hand hold — sky-blue bg, confetti, Happy Father's Day
  {
    num:    2,
    label:  'hand-hold',
    outFile:'FD2_02_hand_hold.jpg',
    refs:   [SRC_CLOSEUP, FAMILY_REF],
    addCharLock: true,
    addProdLock: true,
    prompt:
      `Close-up of a hand holding the wooden car visor frame against a soft sky-blue gradient background. ` +
      `Inside the frame: the reference family photo — dad + boy + girl laughing in park. ` +
      `Background has subtle confetti of tiny mint-green stars scattered lightly. ` +
      `Top-right: "Happy Father's Day" in fresh navy cursive script. ` +
      `Bright studio lighting, product photography, 1:1 square.`,
  },

  // ── Slot 3: Product detail infographic
  {
    num:    3,
    label:  'product-detail',
    outFile:'FD2_03_product_detail.jpg',
    refs:   [SRC_EMPTY, FAMILY_REF],
    addCharLock: false,
    addProdLock: true,
    prompt: briefScene(4) ||
      `Clean product detail infographic on soft sky-blue background. ` +
      `Center-left: wooden car visor frame upright, empty photo slot open. ` +
      `Dimension arrows: height "3.97 in ~ 10.1 cm", width "2.75 in ~ 7 cm", diagonal "FIT 2.3 x 3.5 in". ` +
      `Three callout circles right: "Your Picture Here" showing family photo, ` +
      `"Stainless Steel Visor Clip" showing metal clip, "Wooden Layer 1-2-3" showing edge. ` +
      `Title: PRODUCT DETAIL bold navy. No warm colors.`,
  },

  // ── Slot 4: Perfect Gift — split marketing layout
  {
    num:    4,
    label:  'perfect-gift',
    outFile:'FD2_04_perfect_gift.jpg',
    refs:   [FAMILY_REF, SRC_MAIN],
    addCharLock: true,
    addProdLock: true,
    prompt:
      `Amazon listing marketing image, square 1:1. ` +
      `Left 55%: lifestyle photo of the dad sitting on bright green park grass, ` +
      `two kids holding the wooden car visor frame out toward him as a Father's Day gift, ` +
      `blue sky, morning light. ` +
      `Right 45%: sky-blue (#EBF5FB) panel. Bold text stack: "PERFECT" large navy block, ` +
      `"Father's Day" coral script, "GIFT" large navy block, "for Dad!" teal script. ` +
      `Bottom-right inset: the wooden frame on the gray car visor. ` +
      `Mint teal separator line between halves. No warm gold or pink.`,
  },

  // ── Slot 5: Installation / Display locations grid
  {
    num:    5,
    label:  'display-locations',
    outFile:'FD2_05_display_locations.jpg',
    refs:   [SRC_MAIN, SRC_EMPTY],
    addCharLock: false,
    addProdLock: true,
    prompt:
      `Amazon product infographic, white background with sky-blue teal accent dividers. ` +
      `2x2 grid of four equal rounded-square cells, each showing the wooden frame in a different location: ` +
      `Cell 1: frame clipped to car sun visor interior (driver's perspective); ` +
      `Cell 2: frame on car dashboard leaning against windshield; ` +
      `Cell 3: hand holding frame outdoors, blue sky background; ` +
      `Cell 4: frame wrapped in clear gift bag with blue ribbon and "Happy Father's Day" card beside it. ` +
      `Each cell has a numbered circle top-left and a short label bottom. ` +
      `Header: "DISPLAY ANYWHERE" bold navy. Clean, fresh, no warm tones.`,
  },

  // ── Slot 6: Flat lay — Father's Day styled overhead
  {
    num:    6,
    label:  'flatlay',
    outFile:'FD2_06_flatlay.jpg',
    refs:   [SRC_EMPTY, FAMILY_REF],
    addCharLock: true,
    addProdLock: true,
    prompt:
      `Father's Day flat lay, overhead top-down view, 1:1 square. ` +
      `Background: soft mint green craft paper. ` +
      `Center: the wooden car visor frame showing the reference family photo inside. ` +
      `Surrounding props: "World's Best Dad" greeting card, men's sunglasses, car keys, ` +
      `small green succulent in terracotta pot, blue satin ribbon, tiny blue star confetti. ` +
      `Natural bright daylight from top-left. ` +
      `Color palette: mint, sky-blue, white, light coral accents. No warm yellow or amber.`,
  },

  // ── Slot 7: Lifestyle — dad driving, frame visible on visor
  {
    num:    7,
    label:  'lifestyle-driving',
    outFile:'FD2_07_lifestyle_driving.jpg',
    refs:   [SRC_MAIN, FAMILY_REF],
    addCharLock: true,
    addProdLock: true,
    prompt:
      `Lifestyle photography inside a car, 1:1 square. ` +
      `The reference dad (blue shirt) sits in driver seat, relaxed warm smile, ` +
      `glancing up at the car sun visor above. ` +
      `The wooden frame is clipped to the visor — visible showing the reference family photo inside. ` +
      `Bright cool morning light through windshield, car interior background. ` +
      `Bottom navy text bar: "Keep them close — every mile of the journey" white italic. ` +
      `Photorealistic editorial lifestyle photography.`,
  },

  // ── Slot 8: Gift moment — kids gifting dad through car window
  {
    num:    8,
    label:  'gift-moment',
    outFile:'FD2_08_gift_moment.jpg',
    refs:   [FAMILY_REF, SRC_MAIN],
    addCharLock: true,
    addProdLock: true,
    prompt:
      `Emotional Father's Day lifestyle photo, 1:1 square. ` +
      `The reference dad (blue shirt) sits in driver seat of parked car, window down, ` +
      `huge surprised delighted smile. ` +
      `The reference boy reaches through the car window holding the wooden frame out as a gift; ` +
      `the reference girl stands beside him bouncing excitedly. ` +
      `Suburban morning, clear blue sky, green trees. ` +
      `Bright natural morning light (NOT warm golden hour). Kids radiating pure joy. ` +
      `Bottom navy banner: "A little reminder that love rides with you" white text. ` +
      `Photorealistic editorial photography.`,
  },
];

// ─── Build final prompt: prepend locks ───────────────────────────────────────
function buildPrompt(slot) {
  const parts = [];
  if (slot.addCharLock) parts.push(CHAR_LOCK);
  if (slot.addProdLock) parts.push(PROD_LOCK);
  parts.push(slot.prompt);
  return parts.join(' ');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractUrl(result) {
  if (typeof result === 'string') return result;
  return result?.resultImageUrl || result?.resultUrls?.[0] || result?.url || result?.image_url || null;
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

async function nanoBananaRun(kie, prompt, refs, label) {
  const imageUrls = [];
  for (const refPath of refs) {
    if (!fs.existsSync(refPath)) { log.warn(`  Ref missing: ${path.basename(refPath)}`); continue; }
    const url = await kie.uploadFromLocal(refPath, 'fd-dad-v2', { maxSize: 2048, quality: 95 });
    imageUrls.push(url);
    log.info(`  Ref uploaded: ${path.basename(refPath)}`);
  }
  const input = { prompt, resolution: '2K', aspect_ratio: '1:1', output_format: 'jpg' };
  if (imageUrls.length > 0) input.image_input = imageUrls;
  log.info(`  Running nano-banana-pro (${imageUrls.length} refs) — ${label}...`);
  const result = await kie.run('nano-banana-pro', input);
  const url = extractUrl(result);
  if (!url) throw new Error(`No URL in result: ${JSON.stringify(result).substring(0, 200)}`);
  return url;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args      = process.argv.slice(2);
  const dryRun    = args.includes('--dry-run');
  const onlySlot  = (() => { const i = args.indexOf('--slot'); return i !== -1 ? parseInt(args[i + 1]) : null; })();
  const skipSlots = (() => {
    const i = args.indexOf('--skip');
    if (i === -1) return new Set();
    return new Set((args[i + 1] || '').split(',').map(Number));
  })();

  log.info('═══════════════════════════════════════════════════════════');
  log.info("Father's Day — Drive Safe, Daddy! We Love You  ·  v2");
  log.info('  Character consistency + Product consistency lock');
  log.info('═══════════════════════════════════════════════════════════');
  log.info(`Output: ${OUT_DIR}`);
  if (dryRun)   log.info('DRY RUN — no API calls');
  if (onlySlot !== null) log.info(`Only slot ${onlySlot}`);
  if (skipSlots.size)    log.info(`Skip slots: ${[...skipSlots].join(', ')}`);

  fs.mkdirSync(OUT_DIR,   { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  if (dryRun) {
    // Step 0
    log.info('\n[Step 0] Canonical family ref');
    log.info(`  out: ${FAMILY_REF}`);
    log.info(`  exists: ${fs.existsSync(FAMILY_REF)}`);
    log.info(`  prompt (${FAMILY_REF_PROMPT.split(' ').length}w): "${FAMILY_REF_PROMPT.substring(0, 100)}..."`);
    // Slots
    for (const slot of SLOTS) {
      if (onlySlot !== null && slot.num !== onlySlot) continue;
      if (skipSlots.has(slot.num)) continue;
      const full = buildPrompt(slot);
      log.info(`\n[Slot ${slot.num}] ${slot.label}`);
      log.info(`  refs:   ${slot.refs.map(r => path.basename(r)).join(', ')}`);
      log.info(`  prompt: (${full.split(' ').length}w) "${full.substring(0, 120)}..."`);
    }
    return;
  }

  const kieKey = process.env.KIE_KEY;
  if (!kieKey) { log.error('KIE_KEY not set'); process.exit(1); }
  const kie = new KieClient(kieKey);
  kie.setCacheDir(CACHE_DIR);

  // ── Step 0: Generate canonical family reference ────────────────────────────
  if (onlySlot === null || onlySlot === 0) {
    if (fs.existsSync(FAMILY_REF)) {
      log.info(`\n[Step 0] Family ref already exists — skip`);
    } else {
      log.info(`\n[Step 0] Generating canonical family reference photo...`);
      log.info(`  prompt (${FAMILY_REF_PROMPT.split(' ').length}w): "${FAMILY_REF_PROMPT.substring(0, 80)}..."`);
      try {
        const input = { prompt: FAMILY_REF_PROMPT, resolution: '2K', aspect_ratio: '1:1', output_format: 'jpg' };
        const result = await kie.run('nano-banana-pro', input);
        const url = extractUrl(result);
        if (!url) throw new Error(`No URL: ${JSON.stringify(result).substring(0, 200)}`);
        await downloadAndResize(url, FAMILY_REF);
        log.info(`  ✓ Family ref saved → _family_ref.jpg`);
      } catch (err) {
        log.error(`  ✗ Family ref failed: ${err.message}`);
        log.error('  Cannot continue without family ref. Exiting.');
        process.exit(1);
      }
    }
    if (onlySlot === 0) return;
  }

  // ── Slots 1–8 ──────────────────────────────────────────────────────────────
  const results = { ok: [], fail: [], skip: [] };

  for (const slot of SLOTS) {
    if (onlySlot !== null && slot.num !== onlySlot) continue;
    if (skipSlots.has(slot.num)) { results.skip.push(slot.label); continue; }

    const outPath = path.join(OUT_DIR, slot.outFile);
    log.info(`\n[Slot ${slot.num}/8] ${slot.label}`);

    if (fs.existsSync(outPath)) {
      log.info(`  ✓ Already exists — skip`);
      results.skip.push(slot.label);
      continue;
    }

    try {
      const fullPrompt = buildPrompt(slot);
      const imageUrl   = await nanoBananaRun(kie, fullPrompt, slot.refs, slot.label);
      await downloadAndResize(imageUrl, outPath);
      log.info(`  ✓ Saved → ${slot.outFile}`);
      results.ok.push(slot.label);
    } catch (err) {
      log.error(`  ✗ Error: ${err.message}`);
      fs.writeFileSync(outPath.replace('.jpg', '_error.txt'), `${err.message}\n${err.stack || ''}`);
      results.fail.push(slot.label);
    }
  }

  log.info('\n═══════════════════════════════════════════════════════════');
  log.info('SUMMARY');
  log.info(`  ✓ OK:     ${results.ok.length}  [${results.ok.join(', ')}]`);
  log.info(`  → Skip:   ${results.skip.length}  [${results.skip.join(', ')}]`);
  log.info(`  ✗ Failed: ${results.fail.length}  [${results.fail.join(', ')}]`);
  log.info(`\nOutput: ${OUT_DIR}`);
}

main().catch(err => { log.error('Fatal:', err.message); process.exit(1); });
