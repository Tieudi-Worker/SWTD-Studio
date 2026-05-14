/**
 * Regen 3 specific A+ banners with fixed prompts:
 * 1. COACH M2 16:9 — remove leaked layout instruction text
 * 2. Teacher M3 16:9 — reinforce i745 banner text clarity
 * 3. Teacher M2 21:9 — fix label text leak + enforce Amazon card
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', 'api-keys.env') });
const fs = require('fs');
const path = require('path');
const { KieClient } = require('../utils/kie-client');

const DATA_ROOT = path.resolve(__dirname, '..', '..', 'data');

// ═══ Ref paths ═══
const coachLF = (skuFolder, sport, idx) =>
  path.join(DATA_ROOT, skuFolder, 'output', 'Listing Final', `MK TNTD250326i769 (${sport}) (${idx}).png`);

const REF_CATALOG = {
  // COACH
  baseball_hero:   coachLF('TNTD250326i769(1)', 'Baseball', 1),
  baseball_life:   coachLF('TNTD250326i769(1)', 'Baseball', 4),
  // Teacher
  floral_hero:     path.join(DATA_ROOT, 'TNTD180326i744', 'output', 'Listing Final',            'MK TNTD180326i744 (1).png'),
  pencil_hero:     path.join(DATA_ROOT, 'TNTD180326i745', 'output', 'listing', 'Listing final', 'MK TNTD180326i745 (1).png'),
  pencil_life:     path.join(DATA_ROOT, 'TNTD180326i745', 'output', 'listing', 'Listing final', 'MK TNTD180326i745 (4).png'),
  stake_hero:      path.join(DATA_ROOT, 'TNTD180326i747', 'output', 'listing', 'Listing Final', 'MK TNTD180326i747 1.jpg'),
};

// ═══ COACH guards ═══
const COACH_GUARDS = `
CRITICAL PRODUCT FIDELITY (R2): Each wooden COACH card holder must render EXACTLY as in its reference — a FLAT multi-layer plywood plaque (approx 4 × 3 inches, thin profile). Preserve per variant: (Baseball) natural wood tone + white acrylic baseball with RED stitching + red accent. Each variant carries a white acrylic "Thank You" cursive topper. The word COACH is always a HOLLOW STENCIL CUTOUT cut completely THROUGH the front wood layer — NOT engraved, NOT painted, NOT solid wood. A horizontal internal cavity holds a gift card that slides IN FROM THE LEFT OR RIGHT SIDE EDGE, NEVER from the top. When a card is inserted, the card's blue/white color shows THROUGH the COACH letter shapes. About 20% of the card protrudes from the side edge. DO NOT redesign or simplify.

SCALE ANCHOR (R3): Each card holder is approximately 4 × 3 inches — credit-card to postcard size, thin profile. Fits comfortably in one adult hand.

TYPOGRAPHY LOCK (R1): Strictly TWO font families. Font 1 = BALOO 2 BOLD style (rounded friendly modern sans-serif display) for headlines, CTA, callouts. Font 2 = HANDWRITTEN CALLIGRAPHY ITALIC style (Kalam / Caveat family) for accent captions, subheads. NO third font. NO serif. NO Helvetica.

CRITICAL: Do NOT render any layout instructions, percentage labels, or compositional notes as visible text in the banner. Only render the specified headline text, subhead text, and caption text. Any text describing the layout structure (like panel descriptions or zone labels) must NOT appear in the final image.
`;

// ═══ TEACHER guards ═══
const TEACHER_GUARDS = `
CRITICAL PRODUCT FIDELITY (R2): Preserve each variant EXACTLY as in its reference.
  • BEST TEACHER EVER PENCIL RIBBON (i745): a small RECTANGULAR birch plywood card holder (approx 3.5 × 4.5 inches). Two-layer construction forming a TOP-SEAM POCKET. Decorative raised elements: (1) 3D laser-cut "BEST TEACHER EVER" banner/ribbon — stretched pennant with YELLOW pencil-tip ends on both sides, "BEST" small left, "TEACHER" large center, "EVER" medium right; (2) 3D yellow pencil-heart icon LOWER-RIGHT. Laser-etched cursive "to" and "from" in red/dark-brown. The text on the ribbon must be SHARP and LEGIBLE — each word clearly separated, not overlapping or garbled.
  • FLORAL PLANT SIGN (i744): ROUND wooden disc (4" dia), colorful floral UV-print on upper half, bare wood with "You're the reason we THRIVE!" on lower half, flat stake pointing down.
  • FLOWER STAKE CARD HOLDER (i747): elongated wooden stake with WILDFLOWER-SHAPED head panel + gift card slot.

SCALE ANCHOR (R3): i744 = 4" disc + 4" stake. i745 = 3.5 × 4.5 in. i747 = 4.33 × 8.46 in. All handheld.

TYPOGRAPHY LOCK (R1 — FREDOKA): Font 1 = FREDOKA BOLD (rounded geometric sans-serif display). Font 2 = HANDWRITTEN CALLIGRAPHY ITALIC. NO third font. NO Baloo. NO serif.

CRITICAL: Do NOT render any layout instructions, percentage labels, compositional notes, or product-description labels as visible text. Only render the specified headline, subhead, caption, and spec text. Descriptions like "engraving", "cursive text", "front panel" must NOT appear as visible words in the final image.
`;

const REGENS = [
  // ─── FIX 1: COACH M2 16:9 — rewrite without "LEFT 50%:" / "RIGHT 50%:" labels ───
  {
    id: 'COACH_M2_pain-promise_v2',
    outputDir: path.join(DATA_ROOT, 'TNTD250326i769_parent', 'output', 'aplus', 'test'),
    outputName: 'M2_pain-promise.jpg',
    aspectRatio: '16:9',
    refs: ['baseball_life', 'baseball_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal 16:9, two-panel umbrella-story module split evenly into a desaturated left panel and a warm saturated right panel.

The left panel shows a slightly desaturated warm scene — a parent's hands (warm skin tone, no face) holding a plain white generic gift card and a generic drugstore greeting card on a living room coffee table. A shopping bag sits on the floor. Overlaid text: Baloo BOLD headline in warm brown "The Coach Gave More Than A Season." Below it, Calligraphy italic subhead in soft red "A plain gift card doesn't say enough." Soft muted tones, no darkness.

A soft cream dividing line with a small warm arrow transitions from the left panel to the right panel.

The right panel shows a warm saturated transformation scene — the same parent's hands now sliding an Amazon gift card horizontally into the side slot of a Baseball COACH card holder. Preserve the EXACT variant from reference: flat wooden plaque, white acrylic baseball with red stitching on top, COACH hollow-cutout revealing the inserted card's blue/white color through the letter shapes, "Thank You" acrylic cursive topper. About 20% of the card protrudes from the side edge. The holder sits on a warm wooden kitchen table with a handwritten note "Thanks Coach! — The Millers", a coffee mug, and a single baseball beside it. Warm afternoon window light. Overlaid text: Baloo BOLD headline in warm brown "A Handcrafted Thank-You They Keep Forever." Calligraphy italic caption in warm red "the gift card becomes part of the gift".

${COACH_GUARDS}`,
  },

  // ─── FIX 2: Teacher M3 16:9 — reinforce i745 text clarity ───
  {
    id: 'TEACHER_M3_variant-matrix_v2',
    outputDir: path.join(DATA_ROOT, 'TNTD180326_teacher_parent', 'output', 'aplus', 'test'),
    outputName: 'M3_variant-matrix.jpg',
    aspectRatio: '16:9',
    refs: ['floral_hero', 'pencil_hero', 'stake_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal 16:9, PRODUCT MATRIX comparison grid on warm cream background.

Top section: FREDOKA BOLD headline centered in warm forest-green: "Choose The Thank-You That Fits Your Teacher." Small Calligraphy italic subhead below in warm rose: "three handmade forms, one heartfelt gift."

Middle section: horizontal 1×3 grid with thin warm-terracotta divider lines. Each cell contains: a product photo face-on at real scale on soft cream backdrop, a FREDOKA BOLD variant title in its accent color, and a 3-line Calligraphy italic spec list.

Cell 1 (terracotta accent): Floral Plant Sign — the ROUND wooden disc (4" diameter) with colorful UV-printed flowers on the upper half, bare wood with scalloped border and "You're the reason we THRIVE!" text on the lower half, flat stake pointing down. Title "FLORAL PLANT SIGN". Specs: "Round wood disc + stake · For plant-loving teachers · 4 in dia + 4 in stake".

Cell 2 (sunshine-yellow accent): Best Teacher Ever — the birch RECTANGLE card holder with the 3D raised "BEST TEACHER EVER" yellow-pencil banner ribbon across the upper area. CRITICAL TEXT CLARITY: the banner ribbon must show three clearly separated, non-overlapping words — "BEST" on the left pencil end, "TEACHER" large across the middle, "EVER" on the right pencil end. Each word must be fully legible with clean spacing between them. Below the banner: yellow pencil-heart icon lower-right, cursive "to" and "from" engraved. Title "BEST TEACHER EVER". Specs: "Birch card holder · For a classic thank-you · 3.5 × 4.5 in".

Cell 3 (forest-green accent): Flower Stake Holder — the elongated WILDFLOWER-SHAPED wooden stake with decorative head panel and gift card slot, pointed lower stake. Title "FLOWER STAKE HOLDER". Specs: "Wildflower stake + slot · For gardener teachers · 4.33 × 8.46 in".

Bottom section: FREDOKA BOLD sub-strip centered in warm forest-green on cream: "All handcrafted · All gift-ready · All made to be kept."

All three variants keep their OWN distinct silhouette. ${TEACHER_GUARDS}`,
  },

  // ─── FIX 3: Teacher M2 21:9 — fix label leak + enforce Amazon card ───
  {
    id: 'TEACHER_M2_pain-promise_21x9_v2',
    outputDir: path.join(DATA_ROOT, 'TNTD180326_teacher_parent', 'output', 'aplus', 'test', '21x9_native'),
    outputName: 'M2_pain-promise.jpg',
    aspectRatio: '21:9',
    refs: ['pencil_life', 'pencil_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal 21:9, two-panel umbrella-story module split evenly into a desaturated left panel and a warm saturated right panel.

The left panel shows a slightly desaturated warm scene — a parent's hands on a kitchen counter, holding a generic plain white gift card and a generic drugstore "Thank You" greeting card, looking uncertain. A bag of apples on the counter, a notepad with "teacher gift" scribbled and question marks. FREDOKA BOLD overlay in warm forest-green "Teachers Shape Years. A Plain Gift Card Feels Like One Minute." Calligraphy italic subhead in warm rose "You want the thank-you to actually land." Soft muted tones.

A soft cream dividing seam with a small warm arrow transitions from left to right.

The right panel shows a warm saturated transformation scene — the same parent's hands now sliding a standard blue AMAZON gift card (with the recognizable Amazon arrow-smile logo) DOWN into the top-seam pocket of the Best Teacher Ever pencil-ribbon card holder. Preserve the EXACT i745 variant from reference: birch rectangle, 3D raised yellow-pencil "BEST TEACHER EVER" banner ribbon across the upper portion (three clearly separated words), 3D yellow pencil-heart icon on the lower-right, softly scalloped top edge, rounded bottom corners. The card's upper half disappears into the pocket while about 45% remains visible against the bare upper wood. The holder rests on a bright classroom-style wooden desk beside a red apple, a potted succulent, scattered white flower petals, and a handwritten note "Mrs. Patel — thank you for everything." Warm afternoon window light. FREDOKA BOLD overlay in warm forest-green "A Handcrafted Keepsake They'll Actually Keep." Calligraphy italic caption in warm rose "the gift card becomes part of the gift."

${TEACHER_GUARDS}`,
  },
];

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);

  // Verify + upload refs
  const uniqueRefKeys = [...new Set(REGENS.flatMap(r => r.refs))];
  for (const k of uniqueRefKeys) {
    if (!REF_CATALOG[k] || !fs.existsSync(REF_CATALOG[k])) {
      console.error(`[FAIL] Missing ref: ${k} -> ${REF_CATALOG[k]}`);
      process.exit(1);
    }
  }

  console.log(`[REGEN] Uploading ${uniqueRefKeys.length} refs...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    refUrls[key] = await kie.uploadFromLocal(REF_CATALOG[key], 'product-refs', { maxSize: 768, quality: 85, format: 'jpeg' });
    console.log(`  [${key}] cached`);
  }

  console.log(`\n[REGEN] Running ${REGENS.length} fixes in parallel...\n`);

  const results = [];
  await Promise.all(REGENS.map(async (r) => {
    if (!fs.existsSync(r.outputDir)) fs.mkdirSync(r.outputDir, { recursive: true });
    const image_input = r.refs.map(k => refUrls[k]);
    const input = {
      prompt: r.prompt,
      image_input,
      resolution: '2K',
      aspect_ratio: r.aspectRatio,
      output_format: 'jpg',
    };
    try {
      const outPath = path.join(r.outputDir, r.outputName);
      const result = await kie.run('nano-banana-pro', input, 'image', r.id);
      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('no resultUrls');
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`download ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(outPath, buf);
      console.log(`  [${r.id}] OK ${Math.round(buf.length / 1024)}KB -> ${outPath}`);
      results.push({ id: r.id, ok: true });
    } catch (err) {
      console.error(`  [${r.id}] FAIL ${err.message}`);
      results.push({ id: r.id, ok: false, err: err.message });
    }
  }));

  console.log('\n[REGEN] Summary:');
  for (const r of results) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.id}${r.ok ? '' : ' — ' + r.err}`);
  console.log(`\n[REGEN] ${results.filter(r => r.ok).length}/${results.length} fixes applied`);
})();
