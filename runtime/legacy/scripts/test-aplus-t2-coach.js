/**
 * A+ Type 2 Multi-ASIN — Parent: COACH Card Holder Collection
 * Children: TNTD250326i769(1) Baseball, (2) Basketball, (3) Football
 * Plan A Modular (default per aplus-type2-multi-asin.json)
 * Per-banner ref strategy (R4) + R1 Typography + R2 Fidelity + R3 Scale
 *
 * Usage:
 *   node scripts/test-aplus-t2-coach.js            # default: M1 only (precheck)
 *   node scripts/test-aplus-t2-coach.js --full     # run all 5 modules
 *   node scripts/test-aplus-t2-coach.js --only=M3  # run specific module
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', 'api-keys.env') });
const fs = require('fs');
const path = require('path');
const { KieClient } = require('../utils/kie-client');

const DATA_ROOT = path.resolve(__dirname, '..', '..', 'data');
const BASE_OUT_DIR = path.join(DATA_ROOT, 'TNTD250326i769_parent', 'output', 'aplus', 'test');
// OUT_DIR is resolved after CLI arg parsing below (ratio-aware).

const listingFinal = (skuFolder, sport, idx) =>
  path.join(DATA_ROOT, skuFolder, 'output', 'Listing Final', `MK TNTD250326i769 (${sport}) (${idx}).png`);

// ═══ Ref catalog — listing-final renders (post-QC fidelity) ═══
const REF_CATALOG = {
  baseball_hero:     listingFinal('TNTD250326i769(1)', 'Baseball',   1),
  baseball_life:     listingFinal('TNTD250326i769(1)', 'Baseball',   4),
  basketball_hero:   listingFinal('TNTD250326i769(2)', 'Basketball', 1),
  basketball_life:   listingFinal('TNTD250326i769(2)', 'Basketball', 4),
  football_hero:     listingFinal('TNTD250326i769(3)', 'Football',   1),
  football_life:     listingFinal('TNTD250326i769(3)', 'Football',   4),
};

// ═══ Shared guards (R1 + R2 + R3) ═══
const GUARDS = `
CRITICAL PRODUCT FIDELITY (R2): Each wooden COACH card holder must render EXACTLY as in its reference — a FLAT multi-layer plywood plaque (approx 4 × 3 inches, thin profile). Preserve per variant: (Baseball) natural wood tone + white acrylic baseball with RED stitching + red accent; (Basketball) natural wood tone + ORANGE basketball element + orange accent; (Football) natural wood tone + BROWN/RED football element + brown accent. Each variant carries a white acrylic "Thank You" cursive topper. The word COACH is always a HOLLOW STENCIL CUTOUT cut completely THROUGH the front wood layer — NOT engraved, NOT painted, NOT solid wood. A horizontal internal cavity holds a gift card that slides IN FROM THE LEFT OR RIGHT SIDE EDGE, NEVER from the top. When a card is inserted, the card's blue/white color shows THROUGH the COACH letter shapes (see-through reverse-stencil effect: you read COACH in the card's color, not wood color). About 20% of the card protrudes from the side edge as a visual cue. DO NOT redesign, reimagine, or simplify any variant.

SCALE ANCHOR (R3): Each card holder is approximately 4 × 3 inches (10 × 7.5 cm) — credit-card to postcard size, thin profile. Realistic proportions: fits comfortably in one adult hand, about the size of a smartphone. On a desk beside a coffee mug, the holder is roughly the height of the mug. DO NOT render oversized (never larger than an open hardcover book).

TYPOGRAPHY LOCK (R1): Strictly TWO font families throughout this banner. Font 1 = BALOO 2 BOLD style (rounded friendly modern sans-serif display) for headlines, promise text, CTA buttons, callouts, product-name labels. Font 2 = HANDWRITTEN CALLIGRAPHY ITALIC style (Kalam / Caveat family) for accent captions, subheads, emotional flourishes. NO third font. NO traditional serif. NO Helvetica.

VARIANT PARALLEL FIDELITY: Where multiple variants appear in the same banner, each variant must keep its SPORT-SPECIFIC element (baseball white+red / basketball orange / football brown-red) and COLOR ACCENT. All three share the same wood-frame silhouette and the same COACH hollow-cutout + Thank-You acrylic topper — do NOT swap sport elements between variants, do NOT invent new sport variants.
`;

// ═══ Per-banner modules ═══
const MODULES = [
  {
    id: 'M1_collection-hero',
    refs: ['baseball_hero', 'basketball_hero', 'football_hero'],
    prompt: `Amazon A+ Type 2 multi-ASIN banner, wide horizontal 16:9 composition. PARENT BRAND HERO introducing the full COACH Card Holder collection.

TOP 28%: centered Baloo BOLD headline in rich warm brown "#5B3A1A" on cream background: "One Handcrafted Thank-You. Three Sports, One Coach." Underneath, a smaller italic Calligraphy subhead in warm red "A wooden gift card holder collection for the coaches who showed up."

MIDDLE 55%: full-width hero flat-lay on a warm golden-oak wooden plank surface with soft natural window light from the upper-left. Three COACH card holders arranged left-to-right in a loose overlapping triangular group, slightly angled toward camera, all at IDENTICAL SCALE (approx 4x3 inches each). LEFT: Baseball variant (white acrylic baseball + red stitching, red accent). CENTER slightly raised: Basketball variant (orange basketball element, orange accent). RIGHT: Football variant (brown-red football element, brown accent). Each holder shows the COACH hollow-cutout clearly from front; one of the three (center Basketball) has a gift card partially inserted from its side edge, card color visible through the COACH letters as the signature see-through effect. Surrounding props scattered tastefully but sparingly: a single baseball, a small orange basketball (compact, palm-sized), a mini football, a few kraft-paper gift tags with jute twine, one cream thank-you envelope. Avoid clutter.

BOTTOM 17%: Baloo product-family strip — three small pill labels aligned horizontally under their respective holders: "BASEBALL COACH" (red pill) · "BASKETBALL COACH" (orange pill) · "FOOTBALL COACH" (brown pill). Each pill uses Baloo BOLD uppercase white text.

All three holders must preserve EXACT reverse-stencil COACH hollow cutout structure, side-slot orientation, Thank-You acrylic topper, and per-variant color accent. Warm, trustworthy, gift-ready mood. No text in any other font. ${GUARDS}`,
  },
  {
    id: 'M2_pain-promise',
    refs: ['baseball_life', 'baseball_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal 16:9, SPLIT 50/50 umbrella-story module.

LEFT 50%: slightly desaturated warm scene — a parent (hands only, warm skin tone) standing in a living room in front of a plain white gift card and generic drugstore greeting card, looking uncertain. Shopping bag on the floor. Baloo BOLD overlay top in warm brown "The Coach Gave More Than A Season." Calligraphy italic subhead below in soft red "A plain gift card doesn't say enough." Soft muted tones, no darkness.

RIGHT 50%: warm saturated transformation scene — the SAME parent's hands now sliding an Amazon gift card horizontally into the side slot of a Baseball COACH card holder (preserve EXACT variant from reference: flat wooden plaque, white acrylic baseball with red stitching, COACH hollow-cutout revealing the inserted card's blue/white color through the letter shapes, Thank-You acrylic topper). About 20% of the card protrudes from the side edge. The holder sits on a warm wooden kitchen table with a handwritten note, a coffee mug, and a single baseball beside it. Warm afternoon window light. Baloo BOLD overlay in warm brown "A Handcrafted Thank-You They Keep Forever." Calligraphy italic caption in warm red "the gift card becomes part of the gift".

Soft cream dividing line with a small warm arrow transitioning LEFT → RIGHT. ${GUARDS}`,
  },
  {
    id: 'M3_variant-matrix',
    refs: ['baseball_hero', 'basketball_hero', 'football_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal 16:9, PRODUCT MATRIX comparison grid.

TOP 15%: Baloo BOLD headline centered in warm brown on cream background: "Choose The Variant That Matches Your Coach." Small Calligraphy italic subhead below: "same handcraft, three sports."

MIDDLE 70%: horizontal 1×3 grid with thin warm-cream divider lines. Each cell has:
• Top of cell: the variant card holder photographed face-on at 4x3 inch scale on a soft neutral cream backdrop with a subtle watermark of its sport-field pattern (baseball diamond / basketball court / football field — very faint, 10% opacity).
• Middle of cell: Baloo BOLD variant title in its accent color.
• Bottom of cell: 3-line Calligraphy italic spec list separated by small dots.

CELL 1 (LEFT — red accent): Baseball COACH holder (white acrylic baseball + red stitching, COACH hollow cutout, Thank-You topper). Title "BASEBALL COACH". Specs: "Multi-layer plywood · Side-slot card insert · For the diamond coach".
CELL 2 (CENTER — orange accent): Basketball COACH holder (orange basketball element, COACH hollow cutout, Thank-You topper). Title "BASKETBALL COACH". Specs: "Multi-layer plywood · Side-slot card insert · For the court coach".
CELL 3 (RIGHT — brown accent): Football COACH holder (brown-red football element, COACH hollow cutout, Thank-You topper). Title "FOOTBALL COACH". Specs: "Multi-layer plywood · Side-slot card insert · For the gridiron coach".

BOTTOM 15%: Baloo sub-strip centered in warm brown on cream: "All handcrafted · All gift-ready · All hold a standard gift card."

All three variants must be the SAME silhouette, SAME scale, SAME COACH hollow-cutout structure, differing ONLY by sport element + accent color. Do not invent extra variants. ${GUARDS}`,
  },
  {
    id: 'M4_decision-guide',
    refs: ['baseball_hero', 'basketball_hero', 'football_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal 16:9, DECISION GUIDE module on soft cream-to-pale-wood gradient background with subtle scattered jute-twine texture.

TOP 12%: Baloo BOLD headline centered in warm brown: "Which Season Did Your Coach Run?" Small Calligraphy italic subhead: "pick the variant that tells their story."

MIDDLE 76%: THREE horizontal persona cards, equal width, separated by thin warm-cream vertical dividers. Each card has:
• Top third: a Calligraphy italic persona quote in warm red (2 lines max).
• Middle third: a warm Baloo BOLD arrow "→" and a small BUT CLEAR thumbnail photo (approx 1/3 card width) of the corresponding variant card holder face-on at correct 4x3 inch scale.
• Bottom third: Baloo BOLD product recommendation line in the variant's accent color.

CARD 1 (red): Quote "My kid's Little League coach stayed late every Saturday." → thumbnail Baseball COACH holder → recommendation "BASEBALL COACH HOLDER".
CARD 2 (orange): Quote "Their basketball coach turned a bench warmer into a starter." → thumbnail Basketball COACH holder → recommendation "BASKETBALL COACH HOLDER".
CARD 3 (brown): Quote "Our football coach taught them to get back up." → thumbnail Football COACH holder → recommendation "FOOTBALL COACH HOLDER".

BOTTOM 12%: Baloo CTA hint centered in warm brown: "Not sure? Start with the sport your coach taught this season."

All three thumbnail holders must retain EXACT variant fidelity (sport element, accent color, COACH hollow cutout, Thank-You topper). Thumbnails are smaller but still legible. ${GUARDS}`,
  },
  {
    id: 'M5_collection-cta',
    refs: ['baseball_life', 'basketball_hero', 'football_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal 16:9, closing COLLECTION CTA module SPLIT 55/45.

LEFT 55%: gift-ready flat lay shot from slight 3/4 top-down angle on a warm walnut wooden plank. All THREE COACH card holders arranged in a gift-ready composition: Baseball holder at left (with a gift card partially inserted from the side edge, card color showing through the COACH cutout), Basketball holder center slightly raised on a small kraft gift box, Football holder at right. Surround: a cream linen runner, a sprig of eucalyptus, a kraft envelope with jute twine, a single Amazon gift card, a vintage whistle, scattered warm golden light. Calligraphy italic overlay in warm red top-left: "A thank-you, three ways." All three variants preserve exact fidelity and scale.

RIGHT 45%: solid warm-brown accent block "#5B3A1A". Baloo BOLD cream headline at top "Start With One. Thank Three Coaches." Short Baloo body cream text smaller: "For the parent whose kid plays more than one sport — or the coach who taught more than one game. Each holder is laser-cut and hand-finished in our Vietnam workshop." Dual rounded-rectangle CTAs stacked: cream background warm-brown Baloo BOLD text "Shop The Collection →" on top, warm-red background cream Baloo BOLD text "Start With Best-Seller →" below. Bottom: three small cream Baloo trust badges horizontal: "⭐ Handmade  ·  🎁 Gift-Ready  ·  ✉ Ships Same-Week".

${GUARDS}`,
  },
];

// ═══ CLI arg parsing ═══
const args = process.argv.slice(2);
const isFullRun = args.includes('--full');
const onlyArg = args.find(a => a.startsWith('--only='));
const onlyModule = onlyArg ? onlyArg.split('=')[1] : null;
const ratioArg = args.find(a => a.startsWith('--ratio='));
const aspectRatio = ratioArg ? ratioArg.split('=')[1] : '16:9';
const ratioSlug = aspectRatio.replace(':', 'x');
const OUT_DIR = aspectRatio === '16:9' ? BASE_OUT_DIR : path.join(BASE_OUT_DIR, `${ratioSlug}_native`);
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let toRun;
if (onlyModule) {
  const wanted = onlyModule.split(',').map(s => s.trim());
  toRun = MODULES.filter(m => wanted.some(w => m.id.startsWith(w)));
  if (!toRun.length) { console.error(`No module matches --only=${onlyModule}`); process.exit(1); }
} else if (isFullRun) {
  toRun = MODULES;
} else {
  toRun = [MODULES[0]]; // default: M1 precheck
}

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);

  // Verify ref files exist
  const uniqueRefKeys = [...new Set(toRun.flatMap(m => m.refs))];
  for (const k of uniqueRefKeys) {
    const p = REF_CATALOG[k];
    if (!p || !fs.existsSync(p)) {
      console.error(`[FAIL] Missing ref: ${k} -> ${p}`);
      process.exit(1);
    }
  }

  console.log(`[T2-COACH] Mode: ${isFullRun ? 'FULL 5' : onlyModule ? `ONLY ${onlyModule}` : 'PRECHECK M1 only'} | Ratio: ${aspectRatio} | Out: ${OUT_DIR}`);
  console.log(`[T2-COACH] Uploading ${uniqueRefKeys.length} unique refs...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    const localPath = REF_CATALOG[key];
    refUrls[key] = await kie.uploadFromLocal(localPath, 'product-refs', { maxSize: 768, quality: 85, format: 'jpeg' });
    console.log(`  [${key}] ${path.basename(localPath)} -> cached`);
  }

  console.log(`\n[T2-COACH] Generating ${toRun.length} banner(s) in parallel (nano-banana-pro, 2K, 16:9)...\n`);

  const results = [];
  await Promise.all(toRun.map(async (m) => {
    const image_input = m.refs.map(k => refUrls[k]);
    const input = {
      prompt: m.prompt,
      image_input,
      resolution: '2K',
      aspect_ratio: aspectRatio,
      output_format: 'jpg',
    };

    try {
      const outputPath = path.join(OUT_DIR, `${m.id}.jpg`);
      const result = await kie.run('nano-banana-pro', input, 'image', m.id);
      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('no resultUrls');
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error(`download failed: ${imageResponse.status}`);
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      console.log(`  [${m.id}] OK ${Math.round(buffer.length / 1024)}KB  refs=[${m.refs.join(',')}]`);
      results.push({ id: m.id, ok: true, path: outputPath });
    } catch (err) {
      console.error(`  [${m.id}] FAIL ${err.message}`);
      results.push({ id: m.id, ok: false, err: err.message });
    }
  }));

  console.log('\n[T2-COACH] Summary:');
  for (const r of results) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.id}${r.ok ? '' : ' — ' + r.err}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[T2-COACH] ${passed}/${results.length} banners generated`);
  console.log(`[T2-COACH] Output: ${OUT_DIR}`);
})();
