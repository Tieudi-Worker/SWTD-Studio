#!/usr/bin/env node
/**
 * One-off: transform 6 Valentine-themed car-visor listing images into
 * Father's Day theme via nano-banana-pro img-to-img editing.
 *
 * Source: ../data/MK CAR VISOR - DRIVE SAFE I LOVE YOU/MK {1..6}.png
 * Output: ../data/MK CAR VISOR - DRIVE SAFE I LOVE YOU/output/fathers-day/MK {1..6}.png
 *
 * Usage:
 *   node scripts/transform-fathers-day.js            # MK 1 only (test)
 *   node scripts/transform-fathers-day.js --all      # all 6 in parallel
 *   node scripts/transform-fathers-day.js --only=1,4 # specific
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'config', 'api-keys.env') });
const { KieClient } = require('../utils/kie-client');

const SOURCE_DIR = path.resolve(__dirname, '..', '..', 'data', 'MK CAR VISOR - DRIVE SAFE I LOVE YOU');
const OUT_DIR = path.join(SOURCE_DIR, 'output', 'fathers-day');

const FATHERS_DAY_PALETTE_NOTE =
  'Father\'s Day theme — fresh bright cheerful palette: crisp sky blue (#3FA9E0), ' +
  'clean white, soft mint (#B8E0D2), light coral accent (#F5A787). ' +
  'AVOID warm golden yellow, AVOID cozy sepia, AVOID romantic red or pink. ' +
  'Mood: clear, uplifting, playful, outdoor-bright.';

const DAD_KID_PHOTO_NOTE =
  'Replace the couple photo INSIDE the wooden visor frame with a candid bright outdoor sunny photo of a smiling dad with his happy young child (age 3-6) — piggyback ride or warm hug, genuine paternal bond, natural daylight in an outdoor park with trees and blue sky background, bright cheerful mood. ' +
  'This inset photo should match the style used in MK 1 (brown-shirt dad + blonde toddler piggyback in sunny park). ' +
  'Keep the wooden frame (natural birch, rounded corners, metal visor clip) and the engraved cursive "Drive Safe I Love You" text at the bottom of the frame EXACTLY as in the reference — do NOT redesign the frame or alter the script text.';

const FIDELITY_GUARD =
  'CRITICAL FIDELITY: preserve the exact wooden frame structure, metal clip, 3-layer plywood edge, and the engraved cursive "Drive Safe I Love You" script — reproduce these 1:1 from the reference image. ' +
  'Only replace: (a) the inset photo content, (b) background color accents, (c) banner color, (d) banner copy. ' +
  'Do NOT stylize, reinterpret, or simplify the wooden frame or its engraved text. ' +
  'Do NOT render layout instructions as visible text in the image.';

const TRANSFORMS = [
  {
    n: 1,
    file: 'MK 1.png',
    prompt:
      `Minimal edit — keep EVERYTHING from the reference image identical, change ONLY the photo content INSIDE the wooden visor frame. ` +
      `Replace the couple (man + woman with heart-shaped sunglasses and XOXO hearts wall background) inside the frame with a candid bright outdoor sunny photo of a smiling dad with his happy young child (age 5-8) — piggyback ride or warm hug, genuine paternal bond, natural daylight, bright playful mood. ` +
      `The inset photo's own background should be bright and cheerful (outdoor park, sky, greenery) — NOT warm golden yellow, NOT cozy sepia, NOT hearts. ` +
      `DO NOT add any new banners, stickers, badges, or "Happy Father's Day" text anywhere on the image. ` +
      `DO NOT change the car visor background color (keep the light gray headliner). ` +
      `DO NOT change the wooden frame, the metal clip, or the engraved cursive "Drive Safe I Love You" script at the bottom — reproduce these 1:1 from the reference. ` +
      `DO NOT change the framing, composition, crop, or aspect ratio. ` +
      `Only the inset photo content changes; everything else pixel-identical to reference.`
  },
  {
    n: 2,
    file: 'MK 2.png',
    prompt:
      `Minimal edit — keep EVERYTHING from the reference image identical, change ONLY: ` +
      `(1) the red border/dividers around the 4 panels → crisp sky blue (#3FA9E0). ` +
      `Keep all 4 panel layouts, the car visor + wooden frame view (upper-left), the metal clip close-up (upper-right), the metal clip bottom-left illustration with "Metal clip" label, and the 3 bullet points ("Easy Installation", "No tape or screw needed", "Just slide the metal clip into the frame") EXACTLY unchanged. ` +
      `Text color stays black, font stays the same, all positions identical. ` +
      `DO NOT change the photo inside the wooden frame in the upper-left panel (keep the empty wood surface with the center metal clip strip as in the reference). ` +
      `DO NOT add any new banners, stickers, or "Happy Father's Day" text. ` +
      `${FIDELITY_GUARD}`
  },
  {
    n: 3,
    file: 'MK 3.png',
    prompt:
      `Minimal edit — keep EVERYTHING from the reference image identical, change ONLY: ` +
      `(1) all red accent colors (the "PACKAGE include" script wordmark, the "Ready To Gift - Box" line, the dimension arrows + labels "PHOTO FIT 2.4 x 3 in / 6 x 7.5 cm" and "4 in - 10.16 cm" and "2.75 in - 7 cm", the bullet dots, the thickness callout label "Thickness : 3 Layer Wooden" and "0.6 cm / 0.24 in", the "Easy Installation" label) → crisp sky blue (#3FA9E0). ` +
      `(2) the gift box tissue paper pattern's red/pink geometric chunks → sky blue + mint + light coral mix (keep the orange + green + yellow chunks that already read as Father's-Day palette). ` +
      `Keep the wooden frame illustration (upper-left), the gift box illustration (upper-right), all dimension arrows + positions, the two round callouts at the bottom (thickness + easy installation), and every layout element EXACTLY unchanged. ` +
      `DO NOT add any new banners or "Happy Father's Day" text. ` +
      `${FIDELITY_GUARD}`
  },
  {
    n: 4,
    file: 'MK 4.png',
    prompt:
      `Minimal edit — keep the exact composition and crop, change ONLY these elements: ` +
      `(1) Replace the foreground couple (man + woman with heart-shaped sunglasses + XOXO/hearts wall background) with a candid outdoor sunny dad + young child (age 3-6) laughing together — playful piggyback or warm hug, natural outdoor daylight in a park with trees + blue sky, NO hearts, NO XOXO pattern; the wall background becomes bright sky blue with soft white clouds. ` +
      `(2) Replace the small photo INSIDE the wooden visor frame (currently showing a couple kissing at sunset) with the SAME dad-kid piggyback photo used in MK 1 (brown-shirt dad + blonde toddler, sunny park). ` +
      `(3) Change the bottom red banner to crisp sky blue (#3FA9E0). ` +
      `(4) Change the banner copy to exactly: "Turn your favorite moment into a daily 'I love you, Dad' on every ride." (white font, same position + size as reference). ` +
      `Keep the wooden visor frame, metal clip, cursive "Drive Safe I Love You" engraving, banner position, layout proportions EXACTLY unchanged. ` +
      `DO NOT add any extra banners or "Happy Father's Day" text. ` +
      `${FIDELITY_GUARD}`
  },
  {
    n: 5,
    file: 'MK 5.png',
    prompt:
      `Minimal edit — keep the exact in-car composition (driver wearing sunglasses profile on left, side mirror lower-right, the car visor with the wooden frame attached in upper-center) unchanged. Change ONLY: ` +
      `(1) Replace the couple photo INSIDE the wooden visor frame with the SAME dad-kid piggyback photo used in MK 1 (brown-shirt dad + blonde toddler, sunny outdoor park). ` +
      `(2) Change the bottom red banner to crisp sky blue (#3FA9E0). ` +
      `(3) Change the banner copy to exactly: "Keep your biggest fan right where you can see them — every mile matters." (white font, same position + size as reference). ` +
      `Keep the wooden frame, metal clip, cursive "Drive Safe I Love You" engraving, driver's head + sunglasses, interior, road blur, banner position EXACTLY unchanged. ` +
      `DO NOT add any extra banners or "Happy Father's Day" text. ` +
      `${FIDELITY_GUARD}`
  },
  {
    n: 6,
    file: 'MK 6.png',
    prompt:
      `Minimal edit — keep the exact composition (a hand holding the wooden visor frame in the foreground, blurred car side-mirror / parking lot background, natural outdoor daylight) unchanged. Change ONLY: ` +
      `(1) Replace the couple photo INSIDE the wooden visor frame (currently a blonde woman + brunette man with heart sunglasses on an XOXO/hearts wall) with the SAME dad-kid piggyback photo used in MK 1 (brown-shirt dad + blonde toddler, sunny outdoor park, NO hearts, NO XOXO). ` +
      `(2) Change the bottom red banner to crisp sky blue (#3FA9E0). ` +
      `(3) Change the banner copy to exactly: "A little reminder that Dad's love rides along — every drive, every day." (white font, same position + size as reference). ` +
      `Keep the holding hand, wooden frame, metal clip, cursive "Drive Safe I Love You" engraving, background car + parking lot blur, banner position EXACTLY unchanged. ` +
      `DO NOT add any extra banners or "Happy Father's Day" text. ` +
      `${FIDELITY_GUARD}`
  },
  {
    n: 7,
    file: 'MK 1.png',
    sourceDir: OUT_DIR,
    prompt:
      `Generate a NEW cheerful Father's Day morning gift-giving lifestyle scene. ` +
      `PRODUCT FIDELITY (copy from reference photo exactly — do NOT resize or redesign): The wooden visor photo frame is a SMALL object — approximately 2.75 × 4 inches — thin natural birch plywood, rounded corners, 3-layer plywood edge visible on sides, metal spring clip at the top center. Inside the frame: the dad-kid piggyback photo (brown-shirt dad + blonde toddler, sunny park, same as reference). Cursive "Drive Safe I Love You" laser-engraved at the bottom of the frame. Reproduce the frame at EXACTLY the same scale as shown in the reference — it fits comfortably inside one adult hand. Do NOT upscale or exaggerate the frame size. ` +
      `ANGLE CONSTRAINT: The frame must face the camera at the same 3/4 front angle as in the reference photo — wooden face visible, slight left tilt, frame held upright — NOT flat-lay, NOT top-down, NOT from the side. ` +
      `SCENE: A smiling dad (brown shirt) sits at a bright kitchen table with morning window light (sky blue + white tones). He holds the SMALL wooden frame upright in both hands at mid-chest level. His young blonde toddler (3-6 years old) stands beside him, one hand on dad's arm. The frame appears SMALL relative to dad's hands — correct product scale. Nearby: opened kraft paper, a simple "DAD" card, small ribbon. ` +
      `Mood: fresh, bright, natural light, candid. Palette: sky blue (#3FA9E0), crisp white, soft mint. NO warm golden yellow, NO cozy sepia, NO dim lighting. ` +
      `CRITICAL anti-drift guards: (1) frame must be SMALL — roughly postcard size in dad's hands; (2) frame angle must match reference 3/4 front view; (3) metal clip must be visible at top; (4) cursive text at bottom must be legible; (5) dad-kid inset photo must match reference. ` +
      `DO NOT render any overlay text, banners, stickers, logos, or "Happy Father's Day" words visible in the image. Square 1:1 composition.`
  },
  {
    n: 8,
    file: 'MK 1.png',
    sourceDir: OUT_DIR,
    prompt:
      `Generate a NEW outdoor car-ready lifestyle scene for a wooden visor photo frame. ` +
      `PRODUCT FIDELITY (copy from reference photo exactly — do NOT resize or redesign): The wooden visor photo frame is a SMALL object — approximately 2.75 × 4 inches — thin natural birch plywood, rounded corners, 3-layer plywood edge visible on sides, metal spring clip at the top center. Inside the frame: the dad-kid piggyback photo (brown-shirt dad + blonde toddler, sunny park, same as reference). Cursive "Drive Safe I Love You" laser-engraved at the bottom. This is a SMALL product — fits in one adult hand, roughly postcard size. Do NOT enlarge the product. ` +
      `ANGLE CONSTRAINT: The frame must be shown at the same 3/4 front angle as in the reference photo — wooden face and inset photo clearly visible, metal clip at top, cursive text at bottom. ` +
      `SCENE: Bright sunny morning, outdoor suburban driveway, car door open in background. A smiling dad (brown shirt) holds the SMALL wooden frame in one hand at chest height, showing it to his young blonde toddler (3-6 years old) who stands beside him pointing at the frame excitedly. The frame appears SMALL and lightweight in dad's hand — correct product scale. Background: blue sky, car interior glimpse, green lawn. ` +
      `Mood: fresh outdoor daylight, bright, joyful. Palette: sky blue (#3FA9E0), crisp white, natural greens. NO warm golden yellow filter, NO cozy sepia. ` +
      `CRITICAL anti-drift guards: (1) frame is SMALL — one-hand holdable, postcard size; (2) 3/4 front angle matching reference; (3) metal clip visible at top; (4) inset photo matches reference dad-kid piggyback; (5) product must NOT be the dominant object filling the frame — it is a small accessory held by a person. ` +
      `DO NOT render any overlay text, banners, stickers, logos, or "Happy Father's Day" words visible in the image. Square 1:1 composition.`
  }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const runAll = args.includes('--all');
  const onlyFlag = args.find(a => a.startsWith('--only='));
  if (onlyFlag) {
    const picks = onlyFlag.split('=')[1].split(',').map(s => parseInt(s.trim(), 10));
    return TRANSFORMS.filter(t => picks.includes(t.n));
  }
  return runAll ? TRANSFORMS : [TRANSFORMS[0]];
}

async function transformOne(kie, t) {
  const srcDir = t.sourceDir || SOURCE_DIR;
  const inputPath = path.join(srcDir, t.file);
  if (!fs.existsSync(inputPath)) {
    console.error(`[MK ${t.n}] Source missing: ${inputPath}`);
    return { n: t.n, success: false, reason: 'source missing' };
  }

  console.log(`[MK ${t.n}] Uploading reference (2048/95)…`);
  const refUrl = await kie.uploadFromLocal(inputPath, 'fathers-day-transform', { maxSize: 2048, quality: 95 });

  console.log(`[MK ${t.n}] Generating…`);
  const result = await kie.run('nano-banana-pro', {
    prompt: t.prompt,
    image_input: [refUrl],
    resolution: '2K',
    aspect_ratio: '1:1',
    output_format: 'jpg'
  }, 'image', `MK ${t.n}`);

  const urls = result.resultUrls || [];
  if (urls.length === 0) {
    console.error(`[MK ${t.n}] No resultUrls in response`);
    return { n: t.n, success: false, reason: 'no result url' };
  }

  const outPath = path.join(OUT_DIR, `MK ${t.n}.png`);
  const resp = await fetch(urls[0]);
  const buffer = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
  console.log(`[MK ${t.n}] OK → ${outPath} (${(buffer.length / 1024).toFixed(0)}KB)`);
  return { n: t.n, success: true, path: outPath };
}

async function main() {
  if (!process.env.KIE_KEY) {
    console.error('KIE_KEY not set in config/api-keys.env');
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const picks = parseArgs();
  console.log(`Transforming ${picks.length} image(s) to Father's Day theme…`);
  const kie = new KieClient(process.env.KIE_KEY);

  const results = await Promise.allSettled(picks.map(t => transformOne(kie, t)));
  const ok = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  console.log(`\nDone: ${ok}/${picks.length} success`);
  for (const r of results) {
    if (r.status === 'rejected') console.error('  FAIL:', r.reason.message || r.reason);
    else if (!r.value.success) console.error(`  MK ${r.value.n} FAIL:`, r.value.reason);
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
