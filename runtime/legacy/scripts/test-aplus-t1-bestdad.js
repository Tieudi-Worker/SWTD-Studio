/**
 * A+ Type 1 Single — SKU: MK TNTD090425i392
 * Best Dad Ever Hands Down DIY Handprint Wooden Plaque (Father's Day)
 * Plan B Storyboard (default for Type 1 per doctrine).
 * Font: Fredoka Bold + Calligraphy Italic. Per-banner refs.
 *
 * Usage:
 *   node scripts/test-aplus-t1-bestdad.js                       # M1 precheck 16:9
 *   node scripts/test-aplus-t1-bestdad.js --full                # all 5 at 16:9
 *   node scripts/test-aplus-t1-bestdad.js --full --ratio=21:9   # all 5 at 21:9
 *   node scripts/test-aplus-t1-bestdad.js --only=M2,M3 --ratio=16:9
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', 'api-keys.env') });
const fs = require('fs');
const path = require('path');
const { KieClient } = require('../utils/kie-client');

const SKU_ROOT = path.resolve(__dirname, '..', '..', 'data', 'MK TNTD090425i392');
const BASE_OUT_DIR = path.join(SKU_ROOT, 'output', 'aplus', 'planB_storyboard');

const LST = (n, label) => path.join(SKU_ROOT, 'output', 'listing', `MK TNTD090425i392_slot${n}_${label}.jpg`);
const INP = (name) => path.join(SKU_ROOT, 'input', 'product', name);

const REF_CATALOG = {
  // ─── REAL PRODUCT PHOTOS (primary fidelity source — ALWAYS include in every module) ───
  real_hero:        INP('MEDIA MK  HANDSDOWN BEST DAD EVER.jpg'),      // studio face-on, all details crisp
  real_lifestyle:   INP('MEDIA MK  HANDSDOWN BEST DAD EVER 3.jpg'),    // handheld with deer-tapestry bg, 2024 year visible
  // ─── Listing renders (scene/composition context only — NEVER as sole product ref) ───
  hero_studio:      LST(1, 'main'),
  scene_inuse:      LST(2, 'in-use'),
  feat_detail:      LST(3, 'features'),
  usecase_close:    LST(4, 'use-case'),
  display_grid:     LST(5, 'size-scale'),
  gift_flatlay:     LST(6, 'gift-set'),
  emotional_dad:    LST(7, 'emotional'),
  lifestyle_desk:   LST(8, 'lifestyle-close'),
};

const GUARDS = `
=== COPY-MODE PRODUCT FIDELITY (R2) ===

The FIRST image in image_input is the REAL PRODUCT PHOTO. Treat it as a PIXEL-LEVEL TEMPLATE. Whenever the wooden plaque appears in this banner, copy it EXACTLY from the real-photo reference — same silhouette, same pennant shape, same text placement, same handprint pattern, same easel. Do NOT stylize, do NOT flatten, do NOT reinterpret. If in doubt, copy directly from the reference.

EXACT PLAQUE ANATOMY (what you must replicate pixel-faithfully):

(1) PLAQUE BODY — a FLAT natural-birch plywood rectangle approx 8 × 10 inches, rounded corners, thin profile. Light natural birch tone.

(2) UPPER-LEFT — 3D LAYERED PENNANT (a single continuous pennant shape, NOT separate text blocks):
    • PENNANT COLOR (CRITICAL): the pennant body is CREAM / LIGHT NATURAL BIRCH WOOD color — the SAME cream-birch tone as the plaque body, just slightly lighter. The pennant is NEVER red, NEVER maroon, NEVER painted, NEVER any bold color. It is unpainted natural wood. Only the TEXT on the pennant is red-brown.
    • The pennant is a CONTINUOUS banner shape — imagine a real cloth pennant: a curved/wavy horizontal ribbon that is WIDER on the left and TAPERS as it extends right, with a soft ribbon-droop on the far right.
    • FORKED TAIL ORIENTATION: on the LEFT edge of the pennant (not right, not top, not bottom — LEFT), a CREAM-WHITE FORKED TAIL with exactly THREE fringe strips extending leftward (three thin rectangular fingers of cream-white painted wood pointing AWAY from the pennant body, pointing LEFT).
    • The pennant body is glued on top of the plaque as a raised 3D layer (slight soft shadow beneath).
    • Text RENDERED ON the pennant surface, reading left-to-right as ONE unified banner: "BEST" in small letters aligned vertically at the left fork (almost stacked), "DAD" in LARGE bold rounded red-brown 3D letters occupying the center of the pennant, "EVER" in medium red-brown letters on the right half of the pennant. The three words must appear ON the pennant shape — NOT as three separate wooden blocks placed next to each other.
    • Do NOT split "BEST / DAD / EVER" into three separate rectangular signs. It is ONE pennant banner with all three words painted/raised on it.

(3) UPPER-RIGHT — "HANDS DOWN!" TEXT (small, positioned RIGHT of pennant):
    • Small laser-engraved dark red-brown text in rounded handwritten-style sans
    • Split onto TWO LINES: "HANDS" on top line, "DOWN!" on bottom line (with exclamation mark)
    • Height of these letters ≈ the "EVER" letters on the pennant — NOT a big headline, NOT the largest text on the plaque
    • Positioned in the upper-right area of the plaque, to the right of the pennant

(4) CENTER — HANDPRINT ZONE (copy the EXACT arrangement from the real photo):
    • FOUR child-sized handprints overlapping in TWO vertical pair columns:
      - LEFT pair: a SMALL TEAL-GREEN handprint (upper, fingers-up) slightly overlapped by a LARGE YELLOW handprint below it (bottom, fingers-up)
      - RIGHT pair: a SMALL RED handprint (upper, fingers-up) slightly overlapped by a LARGE GREEN handprint below it (bottom, fingers-up)
    • Handprints are imperfect, genuine, with visible paint texture and occasional drips
    • NOT two tidy centered handprints — it is FOUR overlapping prints in the layout above

(5) BOTTOM — ENGRAVED CAPTION (two lines, red-brown, rounded handwritten sans):
    • Line 1: "HAPPY FATHER'S DAY 2024" (the year "2024" MUST appear at the end)
    • Line 2: "FROM YOUR BIGGEST FAN!"
    • Line 2 has slightly heavier strokes than Line 1

(6) EASEL STAND (CRITICAL — do NOT render as solid dark wood):
    • Two NATURAL BIRCH WOOD curved legs, SAME wood tone as the main plaque body (NOT espresso-stained, NOT black, NOT a different dark wood).
    • Each leg shows a visible DARK LINE along the edges where the laser cut through the plywood — this is a LASER-CUT EDGE BURN, about 1-2mm thick. The main face of each leg is birch, only the cut edges are dark.
    • The legs have rounded/curved feet.

=== NEGATIVE CONSTRAINTS ===

• PENNANT COLOR: the pennant is CREAM / LIGHT NATURAL BIRCH WOOD. Do NOT render the pennant as RED, MAROON, CRIMSON, ORANGE, BLUE, or any painted color. It is unpainted cream-birch wood — only its TEXT is red-brown.
• PENNANT FORK DIRECTION: the forked tail with 3 fringes is on the LEFT edge of the pennant (pointing leftward), NEVER on the right, top, or bottom.
• Do NOT render the pennant as three separate square wooden blocks saying BEST / DAD / EVER.
• Do NOT make "HANDS DOWN!" a large top-center headline. It is small, in the upper-right corner of the plaque.
• Do NOT omit or alter the "2024" in the bottom caption.
• Do NOT render the easel as solid espresso/dark/black wood. Easel is birch with dark laser-cut edges ONLY.
• Do NOT invent new designs, flowers, patterns, or words in the center blank zone.
• Do NOT duplicate ribbon labels, headline text, or any text element twice in one banner. Each text string appears EXACTLY ONCE.
• Do NOT render the plaque with only 1 or 2 handprints. There are always FOUR overlapping handprints in the center: teal-green + yellow (left column), red + green (right column).

SCALE ANCHOR (R3): The plaque is 8 × 10 inches — roughly the size of a standard sheet of letter paper. When held by a child age 4-6, it covers their chest area (NOT their whole torso). When held by an adult, it fits comfortably in two hands. On a home office desk, it's slightly smaller than a 13-inch laptop. Do NOT render oversized (never larger than a TV screen).

TYPOGRAPHY LOCK (R1 — FREDOKA): Strictly TWO font families. Font 1 = FREDOKA BOLD style (rounded friendly geometric sans-serif display) for all banner headlines, CTA buttons, callout numbers, promise text. Font 2 = HANDWRITTEN CALLIGRAPHY ITALIC style (Homemade Apple / Kalam / Caveat family) for accent captions, subheads, emotional flourishes, ribbon labels. NO third font. NO traditional serif. NO Helvetica. Engraved product text on the plaque itself (BEST DAD EVER / HANDS DOWN / HAPPY FATHER'S DAY) keeps its native rounded handwritten-engraving style — that is part of the product fidelity, not a third banner font.

COMPOSITION RULE: All banner text (headline + subhead + body + CTAs) must stay within the designated text zones. The product photo stays within the designated photo zone. Do NOT let the product overlap with or break through the headline/subhead text area. Do NOT render any layout instructions, percentage labels, or descriptive labels (like "LEFT 50%" or "HERO SHOT") as visible text in the banner.
`;

const MODULES = [
  {
    id: 'M1_open-scene',
    refs: ['real_hero', 'real_lifestyle'],
    prompt: `Amazon A+ Type 1 Plan B OPENING HERO banner, wide horizontal composition, editorial magazine-cover style, SPLIT LAYOUT 60/40.

LEFT 60% — FULL-BLEED LIFESTYLE HERO PHOTO (edge-to-edge, no white frame):
A warm Father's Day morning scene in a cozy living room. A dad in his mid-30s wearing a soft knit sweater sits on a cream linen couch, warm morning sunlight streaming through a window behind him creating a soft golden rim light on his face and hair. He is looking down at the FINISHED painted handprint plaque that he is holding UPRIGHT in both hands at chest-height, clearly displayed toward the camera. A small child (age 4-6) sits beside him leaning in, smiling with pride — the child's face is visible in 3/4 view. The plaque is the undisputed visual FOCAL POINT of the photo, occupying the visual center — roughly the width of the dad's torso, clearly readable, all four handprints (green+yellow left column, red+green right column) visible, the cream pennant with BEST DAD EVER text clearly readable, HANDS DOWN! small on the right, bottom caption "HAPPY FATHER'S DAY 2024 / FROM YOUR BIGGEST FAN!" visible, sitting on its natural birch easel. A coffee mug steams gently on a side table. Soft domestic bokeh. Warm cinematic tones. No text overlays on this photo side.

RIGHT 40% — CLEAN TEXT BLOCK on solid warm-cream background (#F7EFE3):
Vertically centered, left-aligned composition:
  • TOP: small Fredoka BOLD tag in warm red-brown (#C84B3E) uppercase reading "A FATHER'S DAY KEEPSAKE" with thin horizontal rule lines on either side.
  • MIDDLE: large Fredoka BOLD 3-line headline in warm red-brown reading "Best Dad Ever." on line 1, "Hands Down." on line 2, with a small red-brown heart icon between the two lines (optional decoration).
  • BELOW HEADLINE: italic Calligraphy subhead in warm brown "a DIY handprint keepsake — / handcrafted in Vietnam, loved forever."
  • BOTTOM: three small Fredoka trust badges horizontal in warm red-brown: "⭐ Handmade · 🎁 Father's Day Ready · 🖐 Paint-Safe Birch".

A small rainbow-arc illustration accent curves gently at the top-right corner of the right panel as a subtle decorative flourish. The overall feel: premium, editorial, emotional, NOT cluttered. No third color or font. No rainbow trails crossing between panels. ${GUARDS}`,
  },
  {
    id: 'M2_craft-moment',
    refs: ['real_hero', 'real_lifestyle'],
    prompt: `Amazon A+ Type 1 Plan B banner, wide horizontal composition, THE CRAFT MOMENT — the 3-second DIY ritual on soft warm cream background with scattered pastel paint-splatter dots flowing diagonally.

LEFT 40%: italic Calligraphy script headline in warm red-brown "The 3-Minute Father's Day Ritual" (large), italic Calligraphy subhead smaller "Paint their palms. Press. Remember forever.", Fredoka body caption smaller "One blank plaque. Two tiny hands. A keepsake Dad will keep for decades."

RIGHT 60%: three vertically stacked CIRCULAR macro moments in soft rounded warm-brown frames:
  (top circle) close-up of a child's hand (age 4-6) being painted yellow with a small paintbrush by a parent's hand, small washable-paint pots in the blurred foreground.
  (middle circle) close-up of the child pressing their paint-covered hand DOWN onto the BLANK birch center of the plaque laying flat on a warm kitchen table. The BEST DAD EVER 3D pennant is visible upper-left, HANDS DOWN! upper-right, engraved caption at bottom. The center is still mostly blank birch with just the fresh wet handprint being made.
  (bottom circle) the FINISHED plaque standing on its natural birch easel with FOUR overlapping child handprints fully pressed onto the center — teal-green + yellow on the left column, red + green on the right column, exactly as in the real product reference — wet paint glistening slightly in warm window light, child's proud smile softly peeking from the edge of the frame. The cream pennant with forked-left tail + "BEST DAD EVER" + "HANDS DOWN!" upper-right + "HAPPY FATHER'S DAY 2024 / FROM YOUR BIGGEST FAN!" at the bottom are all visible.

All three circles: warm morning kitchen light, tender tone, NO darkness. Rainbow paint-splatter dots + small star confetti trail connects the three circles and loops back to the left text. Plaque scale realistic throughout (8×10 in). ${GUARDS}`,
  },
  {
    id: 'M3_handcrafted-proof',
    refs: ['real_hero', 'real_lifestyle'],
    prompt: `Amazon A+ Type 1 Plan B banner, wide horizontal composition, "Handcrafted. Not Mass-Produced." on warm birch wood grain background with workshop ambient light.

TOP CENTER: Fredoka BOLD warm red-brown headline "Handcrafted. Not Mass-Produced." Below, italic Calligraphy subhead in warm brown "every plaque is laser-cut from real birch plywood, finished by hand".

THREE horizontal macro close-ups separated by thin warm-brown divider lines, each with a small italic Calligraphy caption below:

(LEFT macro) an INDUSTRIAL CNC LASER-CUTTING MACHINE with a visible RED laser beam tracing the plaque's rounded rectangle silhouette on a sheet of birch plywood, metal gantry frame, blue LED indicator light, small wisps of smoke rising. This must be a CNC laser cutter machine, NOT a handheld woodburning tool, NOT pyrography, NOT a soldering iron. Caption: "cut one at a time".

(CENTER macro) close-up overhead of the 3D RAISED BEST DAD EVER pennant (preserve EXACT shape with forked tail on the left + engraved BEST / DAD / EVER text) being carefully glued onto the birch plaque face by a craftsperson's hand (warm skin, no face visible), small wood shavings on the workbench, natural daylight. Caption: "layered by hand".

(RIGHT macro) the wooden easel stand being slotted into the back of the finished plaque — close-up showing the two laser-cut birch triangular legs connecting into the slot on the plaque's back, natural birch wood grain clear and tactile. Caption: "stands on any desk".

BOTTOM small centered Fredoka stat bar in warm red-brown: "Birch plywood · Handmade in Vietnam · Ready to paint". ${GUARDS}`,
  },
  {
    id: 'M4_emotional-milestone',
    refs: ['real_hero', 'real_lifestyle'],
    prompt: `Amazon A+ Type 1 Plan B banner, wide horizontal composition, emotional milestone storyboard on warm cream background with scattered pastel paint-splatter dots and small star confetti.

TOP: Fredoka BOLD warm red-brown headline "The Gift He'll Remember — Long After The Paint Dries." This headline appears as a SINGLE LINE (or wraps at the em-dash onto line 2 if needed), rendered EXACTLY ONCE at the top of the banner. Do NOT repeat, duplicate, or echo any portion of this headline anywhere else in the banner.

THREE horizontal family vignettes separated by soft warm-brown ribbon dividers. In ALL three vignettes the plaque must have the IDENTICAL fidelity (CREAM/LIGHT-BIRCH pennant body upper-left with forked LEFT tail 3 fringes — pennant body is cream-birch natural wood, NOT red, NOT maroon — "BEST / DAD / EVER" red-brown text ON the pennant, HANDS DOWN! small 2-line upper-right, FOUR overlapping child handprints on the blank center (teal-green+yellow left column, red+green right column), engraved HAPPY FATHER'S DAY 2024 / FROM YOUR BIGGEST FAN! at bottom, on the NATURAL BIRCH wooden easel stand):

(LEFT vignette) warm Father's Day morning living room, a small child (age 4-6) hands the FINISHED plaque on its easel to a smiling dad on the couch. Dad's face shows genuine joy, soft rim light on his face from the morning window. Coffee mug + small Father's Day card beside them. Italic Calligraphy ribbon label "The First Look".

(CENTER vignette) the plaque displayed on a dad's home office desk between a framed family photo and a coffee mug, soft afternoon golden light through a window, a small plant and reading glasses nearby. Italic Calligraphy ribbon label "Every Working Day".

(RIGHT vignette) several YEARS LATER — the same plaque now sits on a mantel or living room shelf, handprints slightly faded but still visible, beside a framed family photo. The dad (now older) walks past and smiles quietly. Italic Calligraphy ribbon label "Ten Years From Now".

Rainbow paint-splatter trail weaves between the three vignettes. Each ribbon label appears exactly once. Plaque scale realistic (8×10 in) throughout. ${GUARDS}`,
  },
  {
    id: 'M5_gift-keepsake-cta',
    refs: ['real_hero', 'real_lifestyle'],
    prompt: `Amazon A+ Type 1 Plan B banner, wide horizontal composition, closing module SPLIT 55/45.

LEFT 55% — gift-ready flat lay on warm oak plank top-down: the FINISHED painted plaque centered slightly left on its NATURAL BIRCH wooden easel stand (preserve exact fidelity — CREAM/LIGHT-BIRCH pennant body upper-left with forked-left tail 3 fringes + "BEST / DAD / EVER" text on the pennant in red-brown (pennant body is NOT red, NOT maroon — it is unpainted cream-birch wood), HANDS DOWN! small 2-line upper-right, FOUR overlapping child handprints on the blank center (teal-green+yellow left column, red+green right column), engraved HAPPY FATHER'S DAY 2024 / FROM YOUR BIGGEST FAN! at bottom). Surround: four open washable-paint pots (red, yellow, blue, green) with small splatters, a small paintbrush, a kid's craft apron folded to the side, a Father's Day greeting card with a rainbow wax seal, a kraft gift box, scattered paint-splatter dots across the plank. Italic Calligraphy caption overlay in warm red-brown "A gift today."

RIGHT 45% — solid warm red-brown gradient block (#C84B3E). Fredoka BOLD soft cream headline at top "A Keepsake For A Lifetime." Fredoka body small in cream: "Because the yellow handprint he makes today is the same handprint Dad will show his grandkids one day." Big rounded-rectangle Fredoka BOLD CTA button in cream background on warm red-brown text: "Start The Keepsake →". Below the button: 3 small Fredoka trust badges horizontal in cream: "⭐ Handmade  ·  🎁 Father's Day Ready  ·  🖐 Paint-Safe Birch". Bottom flourish: a small rainbow arc illustrated, echoing the opening module, closing the storybook loop. ${GUARDS}`,
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
    if (!REF_CATALOG[k] || !fs.existsSync(REF_CATALOG[k])) {
      console.error(`[FAIL] Missing ref: ${k} -> ${REF_CATALOG[k]}`);
      process.exit(1);
    }
  }

  console.log(`[T1-BESTDAD] Mode: ${isFullRun ? 'FULL 5' : onlyModule ? `ONLY ${onlyModule}` : 'PRECHECK M1 only'} | Ratio: ${aspectRatio} | Out: ${OUT_DIR}`);
  console.log(`[T1-BESTDAD] Uploading ${uniqueRefKeys.length} unique refs...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    // CRITICAL: real product refs uploaded at high resolution so the model can copy pennant/handprint/easel details pixel-faithfully.
    const isRealRef = key.startsWith('real_');
    const uploadOpts = isRealRef
      ? { maxSize: 2048, quality: 95, format: 'jpeg' }
      : { maxSize: 768,  quality: 85, format: 'jpeg' };
    refUrls[key] = await kie.uploadFromLocal(REF_CATALOG[key], 'product-refs', uploadOpts);
    console.log(`  [${key}] cached`);
  }

  console.log(`\n[T1-BESTDAD] Generating ${toRun.length} banner(s) in parallel (nano-banana-pro, 2K, ${aspectRatio})...\n`);

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
      results.push({ id: m.id, ok: true });
    } catch (err) {
      console.error(`  [${m.id}] FAIL ${err.message}`);
      results.push({ id: m.id, ok: false, err: err.message });
    }
  }));

  console.log('\n[T1-BESTDAD] Summary:');
  for (const r of results) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.id}${r.ok ? '' : ' — ' + r.err}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[T1-BESTDAD] ${passed}/${results.length} banners generated`);
  console.log(`[T1-BESTDAD] Output: ${OUT_DIR}`);
})();
