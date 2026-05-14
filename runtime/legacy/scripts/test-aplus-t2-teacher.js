/**
 * A+ Type 2 Multi-ASIN — Parent: Teacher Appreciation Gift Collection
 * Children: TNTD180326i744 Floral Plant Sign, i745 Best Teacher Ever Pencil Ribbon, i747 Flower Stake Card Holder
 * Plan A Modular. Font swap: Fredoka BOLD (same family as Baloo — rounded friendly display) + Calligraphy italic.
 *
 * Usage:
 *   node scripts/test-aplus-t2-teacher.js                        # default: M1 precheck 16:9
 *   node scripts/test-aplus-t2-teacher.js --full                 # all 5 modules at 16:9
 *   node scripts/test-aplus-t2-teacher.js --full --ratio=21:9    # all 5 modules at 21:9
 *   node scripts/test-aplus-t2-teacher.js --only=M2,M3 --ratio=16:9
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', 'api-keys.env') });
const fs = require('fs');
const path = require('path');
const { KieClient } = require('../utils/kie-client');

const DATA_ROOT = path.resolve(__dirname, '..', '..', 'data');
const BASE_OUT_DIR = path.join(DATA_ROOT, 'TNTD180326_teacher_parent', 'output', 'aplus', 'test');

// ═══ Ref catalog — listing-final renders per variant ═══
const REF_CATALOG = {
  // i744 — Floral Plant Sign (round, stake-down)
  floral_hero:    path.join(DATA_ROOT, 'TNTD180326i744', 'output', 'Listing Final',                 'MK TNTD180326i744 (1).png'),
  floral_life:    path.join(DATA_ROOT, 'TNTD180326i744', 'output', 'Listing Final',                 'MK TNTD180326i744 (4).png'),
  // i745 — Best Teacher Ever (pencil ribbon + pencil-heart, rectangle)
  pencil_hero:    path.join(DATA_ROOT, 'TNTD180326i745', 'output', 'listing', 'Listing final',      'MK TNTD180326i745 (1).png'),
  pencil_life:    path.join(DATA_ROOT, 'TNTD180326i745', 'output', 'listing', 'Listing final',      'MK TNTD180326i745 (4).png'),
  // i747 — Flower Stake Card Holder (stake + wildflower)
  stake_hero:     path.join(DATA_ROOT, 'TNTD180326i747', 'output', 'listing', 'Listing Final',      'MK TNTD180326i747 1.jpg'),
  stake_life:     path.join(DATA_ROOT, 'TNTD180326i747', 'output', 'listing', 'Listing Final',      'MK TNTD180326i747 4.jpg'),
};

// ═══ Shared guards (R1 + R2 + R3 + R4) ═══
const GUARDS = `
CRITICAL PRODUCT FIDELITY (R2): Preserve each variant EXACTLY as in its reference — do NOT redesign, merge, or simplify.
  • FLORAL PLANT SIGN (i744): a ROUND wooden disc (approx 4 inches / 10 cm diameter), thin plywood ~3mm. UPPER half of the disc has dense colorful UV-printed floral pattern (orange, red, teal flowers on white bg). LOWER half is natural bare wood with scalloped border, laser-engraved text "You're the reason we THRIVE!" horizontal + "Love." below. A thin flat wooden STAKE (~4 inches long) extends straight DOWN from the bottom center. Orientation rule: FLOWERS ALWAYS ON TOP, TEXT ALWAYS ON BOTTOM, STAKE ALWAYS POINTING DOWN.
  • BEST TEACHER EVER PENCIL RIBBON (i745): a small RECTANGULAR birch plywood card holder (approx 3.5 × 4.5 inches, thin ~6-8mm), softly rounded bottom corners, gentle scalloped/wavy top edge. Two-layer construction: back panel full size, front panel covers ONLY the lower half forming a TOP-SEAM POCKET (gift card slides DOWN from top). Decorative raised elements glued onto face: (1) 3D laser-cut "BEST TEACHER EVER" banner/ribbon in the UPPER-LEFT — stretched pennant with YELLOW pencil-tip ends on both sides (yellow paint + small pink eraser dots), "BEST" small left end, "TEACHER" large red/dark-brown script across middle, "EVER" medium right end; (2) 3D yellow pencil-heart icon in LOWER-RIGHT. Laser-etched cursive "to" upper-left, "from" below it, red/dark-brown ink. NO flowers, NO stake, NOT round.
  • FLOWER STAKE CARD HOLDER (i747): elongated wooden stake approx 4.33 × 8.46 inches — the UPPER portion is a decorative WILDFLOWER-SHAPED laser-cut wooden panel with a gift card slot; the LOWER portion is a pointed flat wooden stake for inserting into a potted plant. Natural wood tone with botanical wildflower motifs and appreciation-themed engraving. The gift card peeks out from the slot in the flower head.

Each variant has a DISTINCT form factor — do NOT swap silhouettes, do NOT merge features between variants, do NOT invent new variants.

SCALE ANCHOR (R3): Realistic proportions per variant:
  • i744 floral sign: 4-inch diameter disc + 4-inch stake = about the size of a small hand mirror; pokes out of a 4-6" potted plant.
  • i745 pencil ribbon holder: 3.5 × 4.5 inches — roughly credit-card-to-postcard, fits easily in one hand.
  • i747 flower stake: 4.33 × 8.46 inches — slender vertical, fits in a 6-inch pot and rises above the foliage like a garden marker.
All three are HANDHELD HANDMADE SCALE — none is furniture-size. Do NOT render oversized.

TYPOGRAPHY LOCK (R1 — FREDOKA EDITION): Strictly TWO font families throughout this banner. Font 1 = FREDOKA BOLD style (rounded friendly modern geometric sans-serif display — same family character as Baloo but with Fredoka's slightly more geometric personality) for all headlines, promise text, CTA buttons, callouts, product-name labels. Font 2 = HANDWRITTEN CALLIGRAPHY ITALIC style (Homemade Apple / Kalam / Caveat / Sacramento family) for accent captions, subheads, emotional flourishes, ribbon labels. NO third font. NO traditional serif. NO Helvetica. NO Baloo specifically. The display text must feel Fredoka-rounded (wide rounded terminals, friendly, warm).

VARIANT PARALLEL FIDELITY (R4): Where multiple variants appear together, each keeps its OWN silhouette + form + motif — floral-round-stake-down / pencil-ribbon-rectangle / wildflower-stake. Do NOT swap elements across variants. Each variant shares only the "handmade wood + teacher appreciation warmth" umbrella.
`;

// ═══ Per-banner modules ═══
const MODULES = [
  {
    id: 'M1_collection-hero',
    refs: ['floral_hero', 'pencil_hero', 'stake_hero'],
    prompt: `Amazon A+ Type 2 multi-ASIN banner, wide horizontal composition. PARENT BRAND HERO introducing the Teacher Appreciation Gift Collection.

TOP 28%: centered FREDOKA BOLD headline in warm forest-green "#2F5E3A" on warm cream background: "Three Handcrafted Ways To Say Thank You, Teacher." Underneath, a smaller italic Calligraphy subhead in warm rose "A wooden keepsake collection for the end of every school year."

MIDDLE 55%: full-width hero flat-lay on a warm cream linen surface with soft natural window light from the upper-left. Three teacher-appreciation gifts arranged left-to-right at IDENTICAL heights-of-eye:
  • LEFT: Floral Plant Sign (i744) poking upright out of a small terracotta 4-inch pot with a baby pothos plant — round disc upper half dense floral (orange/red/teal on white), lower half bare wood with "You're the reason we THRIVE!" engraved + scalloped border, stake going DOWN into soil.
  • CENTER slightly forward: Best Teacher Ever Pencil Ribbon card holder (i745) standing upright, front face toward camera — birch rectangle with 3D yellow-pencil ribbon "BEST TEACHER EVER" upper-left, yellow pencil-heart lower-right, a real gift card (standard blue Amazon) slid DOWN into the top-seam pocket so the lower half shows against bare upper wood.
  • RIGHT: Flower Stake Card Holder (i747) standing upright in a second small pot next to a succulent — slender wildflower-shaped wooden head with a gift card peeking out of the slot, slim pointed stake disappearing into soil.
Surrounding props tastefully scattered but sparse: a small stack of blank flash cards, a red apple, a wrapped gift-card envelope tied with twine, a few loose dried flower petals, a single yellow pencil. NO clutter. Warm morning light glow.

BOTTOM 17%: FREDOKA BOLD product-family strip — three small rounded pills horizontal under their respective products:
  "FLORAL PLANT SIGN" (terracotta pill #C96B4B)
  "BEST TEACHER EVER" (sunshine-yellow pill #F2B84B)
  "FLOWER STAKE HOLDER" (forest-green pill #2F5E3A)
Each pill in FREDOKA BOLD uppercase white text.

All three variants preserve exact form fidelity. Warm, trustworthy, gift-ready end-of-year mood. ${GUARDS}`,
  },
  {
    id: 'M2_pain-promise',
    refs: ['pencil_life', 'pencil_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal, SPLIT 50/50 umbrella-story module.

LEFT 50%: slightly desaturated warm scene — a parent's hands on a kitchen counter, holding a generic plain white gift card and a generic drugstore "Thank You" greeting card, looking uncertain. A bag of apples on the counter, a to-do list that says "teacher gift" with many question marks beside it. FREDOKA BOLD overlay top in warm forest-green "Teachers Shape Years. A Plain Gift Card Feels Like One Minute." Calligraphy italic subhead below in warm rose "You want the thank-you to actually land." Soft muted tones, no darkness.

RIGHT 50%: warm saturated transformation scene — the SAME parent's hands now sliding a real Amazon gift card DOWN into the TOP-SEAM pocket of the Best Teacher Ever pencil-ribbon card holder (i745, preserve EXACT reference: birch rectangle, 3D yellow pencil ribbon "BEST TEACHER EVER" upper-left, yellow pencil-heart lower-right, cursive "to / from" engraving, softly scalloped top edge, rounded bottom corners). The card's upper half disappears into the pocket, its lower half stays visible against the bare upper wood. About 55% of the gift card is still visible. The holder rests on a bright classroom-style wooden desk beside a red apple, a potted succulent, a few chalky white flower petals, a handwritten note "Mrs. Patel — thank you for everything." Warm afternoon window light. FREDOKA BOLD overlay in warm forest-green "A Handcrafted Keepsake They'll Actually Keep." Calligraphy italic caption in warm rose "the gift card becomes part of the gift."

Soft cream dividing seam between panels with a small warm arrow transitioning LEFT → RIGHT. ${GUARDS}`,
  },
  {
    id: 'M3_variant-matrix',
    refs: ['floral_hero', 'pencil_hero', 'stake_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal, PRODUCT MATRIX comparison grid on warm cream background.

TOP 15%: FREDOKA BOLD headline centered in warm forest-green: "Choose The Thank-You That Fits Your Teacher." Small Calligraphy italic subhead below in warm rose: "three handmade forms, one heartfelt gift."

MIDDLE 70%: horizontal 1×3 grid with thin warm-terracotta divider lines. Each cell:
  • Top of cell: the variant photographed face-on at its real handmade scale against a soft cream neutral backdrop with a VERY faint watermark motif in the background (floral motif / pencil motif / wildflower motif — 8% opacity).
  • Middle of cell: FREDOKA BOLD variant title in its accent color.
  • Bottom of cell: 3-line Calligraphy italic spec list separated by small dots — "Form · Best For · Size".

CELL 1 (LEFT — terracotta #C96B4B): Floral Plant Sign i744 (round disc, flowers UP, bare wood + "You're the reason we THRIVE!" engraved text DOWN, scalloped border, stake DOWN). Title "FLORAL PLANT SIGN". Specs: "Round wood disc + stake · For plant-loving teachers · 4" dia + 4" stake".
CELL 2 (CENTER — sunshine-yellow #F2B84B): Best Teacher Ever pencil-ribbon card holder i745 (birch rectangle, 3D yellow pencil ribbon upper-left, yellow pencil-heart lower-right, cursive to/from, scalloped top). Title "BEST TEACHER EVER". Specs: "Birch card holder · For a classic thank-you · 3.5 × 4.5 in".
CELL 3 (RIGHT — forest-green #2F5E3A): Flower Stake Card Holder i747 (elongated wooden stake with wildflower-shaped top panel + card slot, pointed lower stake). Title "FLOWER STAKE HOLDER". Specs: "Wildflower stake + slot · For gardener teachers · 4.33 × 8.46 in".

BOTTOM 15%: FREDOKA BOLD sub-strip centered in warm forest-green on cream: "All handcrafted · All gift-ready · All made to be kept."

All three variants keep their OWN silhouette + form + motif — do not merge. ${GUARDS}`,
  },
  {
    id: 'M4_decision-guide',
    refs: ['floral_hero', 'pencil_hero', 'stake_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal, DECISION GUIDE module on a soft cream-to-pale-sage gradient background with faint scattered botanical line art (very subtle, 6% opacity).

TOP 12%: FREDOKA BOLD headline centered in warm forest-green: "Which Teacher Are You Thanking?" Small Calligraphy italic subhead in warm rose: "find the form that tells their story."

MIDDLE 76%: THREE horizontal persona cards, equal width, separated by thin warm-terracotta vertical dividers. Each card:
  • Top third: a Calligraphy italic persona quote in warm rose (2 lines max).
  • Middle third: FREDOKA BOLD warm arrow "→" and a clear thumbnail photo (approx 1/3 card width) of the corresponding variant at correct scale.
  • Bottom third: FREDOKA BOLD product recommendation line in the variant's accent color.

CARD 1 (terracotta): Quote "My kid's Pre-K teacher keeps a jungle of plants on her windowsill." → thumbnail Floral Plant Sign (round disc + stake) → "FLORAL PLANT SIGN".
CARD 2 (sunshine-yellow): Quote "Mrs. Patel taught him to read this year. I want the classic thank-you." → thumbnail Best Teacher Ever pencil-ribbon card holder → "BEST TEACHER EVER".
CARD 3 (forest-green): Quote "Our science teacher grows a butterfly garden with her class." → thumbnail Flower Stake Card Holder → "FLOWER STAKE HOLDER".

BOTTOM 12%: FREDOKA BOLD CTA hint centered in warm forest-green: "Still deciding? Start with the Best Teacher Ever — it fits any desk."

All three thumbnails retain EXACT form fidelity per variant. ${GUARDS}`,
  },
  {
    id: 'M5_collection-cta',
    refs: ['floral_life', 'pencil_hero', 'stake_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal, closing COLLECTION CTA module SPLIT 55/45.

LEFT 55%: gift-ready flat lay shot from slight 3/4 top-down angle on a warm cream linen surface. All THREE teacher-appreciation gifts arranged in a gift-ready composition:
  • Floral Plant Sign at left, planted in a small terracotta pot with a baby pothos (stake down, floral disc upright, "You're the reason we THRIVE!" visible).
  • Best Teacher Ever pencil-ribbon card holder center slightly raised on a cream kraft gift box, with a standard blue Amazon gift card slid DOWN into the top-seam pocket (upper half hidden, lower half visible).
  • Flower Stake Card Holder at right, planted in a second small pot next to a succulent (wildflower head up, gift card peeking out of slot).
Surround: a cream linen runner, a sprig of eucalyptus, a kraft envelope with jute twine, a single yellow pencil, a red apple, a handwritten note "Mrs. Patel — thank you." Warm golden window light. Calligraphy italic overlay in warm rose top-left: "Three forms, one thank-you."

RIGHT 45%: solid warm forest-green block "#2F5E3A". FREDOKA BOLD cream headline at top: "One Teacher At A Time." Short FREDOKA body cream text smaller: "For the parent who remembers the year a teacher changed their kid — or the gardener, or the reader, or the plant-keeper. Each piece is laser-cut and hand-finished in our Vietnam workshop." Dual rounded-rectangle CTAs stacked: cream background forest-green FREDOKA BOLD text "Shop The Collection →" on top, warm-terracotta background cream FREDOKA BOLD text "Start With Best-Seller →" below. Bottom: three small cream FREDOKA BOLD trust badges horizontal: "⭐ Handmade  ·  🎁 Gift-Ready  ·  ✉ Ships Same-Week".

All three variants preserve exact form fidelity and scale. ${GUARDS}`,
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

  const uniqueRefKeys = [...new Set(toRun.flatMap(m => m.refs))];
  for (const k of uniqueRefKeys) {
    const p = REF_CATALOG[k];
    if (!p || !fs.existsSync(p)) {
      console.error(`[FAIL] Missing ref: ${k} -> ${p}`);
      process.exit(1);
    }
  }

  console.log(`[T2-TEACHER] Mode: ${isFullRun ? 'FULL 5' : onlyModule ? `ONLY ${onlyModule}` : 'PRECHECK M1 only'} | Ratio: ${aspectRatio} | Out: ${OUT_DIR}`);
  console.log(`[T2-TEACHER] Uploading ${uniqueRefKeys.length} unique refs...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    const localPath = REF_CATALOG[key];
    refUrls[key] = await kie.uploadFromLocal(localPath, 'product-refs', { maxSize: 768, quality: 85, format: 'jpeg' });
    console.log(`  [${key}] ${path.basename(localPath)} -> cached`);
  }

  console.log(`\n[T2-TEACHER] Generating ${toRun.length} banner(s) in parallel (nano-banana-pro, 2K, ${aspectRatio})...\n`);

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

  console.log('\n[T2-TEACHER] Summary:');
  for (const r of results) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.id}${r.ok ? '' : ' — ' + r.err}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[T2-TEACHER] ${passed}/${results.length} banners generated`);
  console.log(`[T2-TEACHER] Output: ${OUT_DIR}`);
})();
