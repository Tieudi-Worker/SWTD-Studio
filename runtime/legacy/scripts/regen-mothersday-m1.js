/**
 * Regen M1 (Collection Hero) cho Handprint Mother's Day Collection.
 * Fix: (1) chất liệu FOMEX (PVC foam board) — KHÔNG phải canvas/wood;
 *      (2) easels phải có chân hoàn chỉnh (3-leg tripod) nhìn rõ;
 *      (3) bỏ toàn bộ disembodied hands/arms lạ — giữ composition sạch props-only.
 * Default: 21:9. Truyền --ratio=16:9 để regen 16:9.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', 'api-keys.env') });
const fs = require('fs');
const path = require('path');
const { KieClient } = require('../utils/kie-client');

const DATA_ROOT = path.resolve(__dirname, '..', '..', 'data');
const PARENT_DIR = path.join(DATA_ROOT, 'Handprint Sign Mother\'s Day');
const BASE_OUT_DIR = path.join(PARENT_DIR, '_parent_output', 'aplus', 'planA_modular');

const childRef = (folder, kind) =>
  path.join(PARENT_DIR, folder, `${folder} ${kind}.png`);

const REF_CATALOG = {
  heart_hero: childRef('MK DTHG130225i286 - Heart Flower Pink',              'M'),
  moon_hero:  childRef('MK TNHG200225i290 - To the moon and back handprint', 'M'),
  love_hero:  childRef('MK TNHG210225i320 - Handmade with love',             'M'),
  pot_hero:   childRef('MK TNHG230326i765 - Flower pot handprint',           'M'),
  mom_hero:   childRef('MK TNHG230326i766 - MOM handprint',                  'M'),
  mixer_hero: childRef('MK TNHG240326i767 - Dough mixer handprint',          'M'),
};

const GUARDS = `
CRITICAL PRODUCT FIDELITY (R2 — COPY-MODE): Each sign in image_input is the REAL PRODUCT PHOTO. Treat each as a pixel-level template. Copy the printed artwork EXACTLY from its reference — do NOT redesign, stylize, or simplify. Each variant has its OWN distinct pre-printed design; do NOT mix motifs across variants.

MATERIAL LOCK (CRITICAL): Every sign is made of FOMEX — a white RIGID PVC FOAM BOARD (also called PVC sign board / Forex / Komatex). It is a THIN FLAT RIGID SHEET roughly 5 mm thick with a clean matte white surface, perfectly flat edges, slightly soft velvety appearance. The edge profile must look like foam board — uniform thin white cross-section, NO wood grain, NO canvas weave, NO canvas wrap around stretcher bars, NO deep wooden panel, NO gallery-wrap thickness. Do NOT render these as canvas, wood plaque, MDF, acrylic, or paper. They are PRINTED FOMEX SIGNS. Edge thickness roughly 5 mm — visibly thin when seen at an angle. Surface: matte white FOMEX with sharp pre-printed artwork on the face.

COMMON FORM FACTOR (all 6 variants share):
  • Portrait-orientation rectangular FOMEX board, approx 8 × 10 inches, ~5 mm thick, clean white matte face.
  • Pre-printed decorative artwork occupying most of the face (variant-specific — see anchors below).
  • A deliberately BLANK zone where a child's painted handprint has been pressed (shown as a printed handprint — preserve its color, position, and shape).
  • Pre-printed Mother's Day theme text (variant-specific, in black or colored handwritten-style script).
  • A personalization field at the bottom showing a first name and/or year in cursive script.

PER-VARIANT FIDELITY ANCHORS:
  • HEART FLOWER PINK (i286): heart-shaped wreath of pink/red watercolor flowers + butterflies + small hearts. Pink/red handprint centered inside the heart. Black text above "TO THE WORLD, YOU ARE A MOM / BUT TO ME, YOU ARE THE WORLD". Black cursive "Happy Mother's Day" at bottom.
  • TO THE MOON AND BACK (i290): blue watercolor crescent moon on the left with clouds, scattered yellow stars. ORANGE/YELLOW handprint inside the moon's curve. Black text "I love you to the moon and back". Orange "HAPPY Mother's Day" cursive at bottom.
  • HANDMADE WITH LOVE (i320): TWO handprints (LEFT yellow, RIGHT pink) above a watercolor flower bouquet with pink ribbon. Black cursive "Handmade with love by" + personalized names at bottom.
  • FLOWER POT (i765): red handprint as flower bloom on green stem in cyan/teal flower pot with year heart "2026". Pink heart with florals + "HAPPY MOTHER'S DAY!" upper-right. Printed poem block on right. Name cursive at bottom.
  • MOM (i766): large pink "MOM" letters in floral-filled style, center "O" replaced by pink handprint. Black text above "To the world you are one person / but to me you are the world". "Happy Mother's Day" cursive + "Love, [name]" at bottom.
  • DOUGH MIXER (i767): pink watercolor stand mixer on the left with clear mixing bowl below. RED handprint dropping into the bowl. Black handwritten "Happy Mother's Day" upper-right + floral flourish. Printed poem inside the bowl. Name cursive at bottom.

NO EASEL RULE (CRITICAL — product does NOT include easels):
  This product is a FOMEX panel ONLY. It does NOT ship with any easel, tripod, or display stand. Do NOT render ANY wooden easel, mini tripod, pocket stand, or kickstand. Signs must be presented naturally WITHOUT stands: leaning against each other, leaning against a small kraft gift box, leaning against a vase of peonies, leaning against a folded linen napkin, leaning against the window frame, or laid FLAT on the tablecloth at a slight 3/4 overhead angle. The six signs form a natural staggered grouping where each one rests against a soft prop behind it. Zero wooden legs, zero dowels, zero easel shelves in the frame.

HUMAN PRESENCE RULE (CRITICAL — KEEP IT CLEAN):
  NO disembodied hands, arms, or body parts anywhere in the frame. NO floating hands reaching in from off-frame. NO mother's hand resting on anything. NO child's hand reaching. This is a props-only lifestyle still-life — only inanimate props, flowers, paint pots, cards, the FOMEX signs themselves. People are IMPLIED by the scene, never shown. If any hand or arm is rendered, it is a FAILURE. Zero arms, zero hands, zero fingers, zero elbows in the frame.

NO VARIANT-LABEL LEAK RULE (CRITICAL): The variant category words "HEART FLOWER PINK", "HEART FLOWER", "TO THE MOON", "TO THE MOON AND BACK", "HANDMADE WITH LOVE", "FLOWER POT", "MOM" (as a label), and "DOUGH MIXER" MUST NOT appear as printed text ON any sign face. These variant names ONLY belong in the bottom pill strip. The signs themselves show ONLY their native printed text from the reference photo (the Mother's Day quote/poem and a small personalization cursive name like "Laura 2026", "Ciara, Cody", "Darya"). Do NOT stamp the variant category name onto the product. Do NOT add any label, caption, or tag across the bottom of a sign that duplicates the pill-strip wording.

TEXT FIDELITY RULE (CRITICAL — render all printed text legibly and in full):
  • i286 Heart Flower Pink: render full black printed line above the heart "TO THE WORLD, YOU ARE A MOM / BUT TO ME, YOU ARE THE WORLD" + black cursive "Happy Mother's Day" below heart. Nothing else.
  • i290 To The Moon: render black printed "I love you to the moon and back" next to the moon + orange "HAPPY Mother's Day" cursive at bottom. Nothing else.
  • i320 Handmade With Love: render black cursive "Handmade with love by" + personalized names (e.g. "Ciara, Cody") below the bouquet. Nothing else.
  • i765 Flower Pot: render "HAPPY MOTHER'S DAY! I made this flower for you..." top-right + small printed poem block + personalization "Laura 2026" on the pot. Nothing else.
  • i766 MOM: render black printed "To the world you are one person / but to me you are the world" above + "Happy Mother's Day, Love, [Name]" cursive below. Nothing else.
  • i767 Dough Mixer: render "A CUP OF LOVE, A SPOONFUL OF CARE... THAT'S THE MAGIC THAT MAKES YOU, MOM." printed below the mixer + "Happy Mother's Day, Ciara" cursive at bottom. Nothing else.

SCALE ANCHOR (R3): each FOMEX sign is about 8 × 10 inches — roughly letter-paper size. Do NOT oversize.

TYPOGRAPHY LOCK (R1 — FREDOKA): Strictly TWO font families for BANNER overlays. Font 1 = FREDOKA BOLD (rounded friendly geometric sans-serif display) for banner headlines, CTA, callouts, pill labels. Font 2 = HANDWRITTEN CALLIGRAPHY ITALIC (Homemade Apple / Sacramento / Caveat family) for banner subheads, emotional captions. NO third font. The printed text ON the product itself stays in its native style.

VARIANT PARALLEL FIDELITY (R4): each of the 6 variants keeps its OWN pre-printed design, handprint color/position, and message. Do NOT let one variant's motif bleed into another. Same FOMEX form factor (white PVC foam board, 8×10 portrait, ~5mm thick) across all 6.

NEGATIVE CONSTRAINTS:
  • Do NOT render any hands, fingers, arms, elbows, or human body parts.
  • Do NOT render banner layout instructions, percentages, or zone labels as visible text.
  • Do NOT duplicate ribbon labels, headlines, or any text string within the same banner.
  • Do NOT invent new Mother's Day messages — keep each variant's pre-printed message unchanged.
  • Do NOT change the printed handprint color per variant (pink stays pink, orange stays orange, red stays red).
  • Do NOT merge variants into a single sign.
  • Do NOT render the signs as canvas, stretched canvas, wood plaque, MDF, acrylic, or paper — they are FOMEX (PVC foam board).
  • Do NOT render ANY wooden easel, tripod, mini display stand, kickstand, or shelf — this product ships as a FOMEX panel only. Signs lean against props or lie flat, never on easels.
  • Do NOT print variant category words ("HEART FLOWER PINK", "TO THE MOON", "HANDMADE WITH LOVE", "FLOWER POT", "MOM" as a caption, "DOUGH MIXER") onto the face of any sign — those only exist in the bottom pill strip.
  • Do NOT simplify or omit the native printed text blocks on each sign — full quotes, poems, and personalization cursive names must render clearly and match reference.
`;

const M1 = {
  id: 'M1_collection-hero',
  refs: ['heart_hero', 'moon_hero', 'mom_hero', 'pot_hero', 'love_hero', 'mixer_hero'],
  prompt: `Amazon A+ Type 2 Plan A banner, wide horizontal composition. COLLECTION HERO for the Handprint Sign Mother's Day family (six FOMEX signs).

TOP 28%: centered FREDOKA BOLD headline in deep rose-pink "#C03A58" on a soft warm-cream background: "Six Handprint Keepsakes. One Unforgettable Mother's Day." Below, smaller italic Calligraphy subhead in warm rose "pick the design that tells your mom's story — she paints the handprint, you paint the love".

MIDDLE 55%: full-width warm lifestyle HERO still-life on a sunlit cream linen tabletop near a bright window — NO people, NO hands, NO easels, props-only. ALL SIX FOMEX signs MUST be visible and clearly distinguishable — this is a 6-SIGN composition, not 5, not 4. Arrange left-to-right in a slightly staggered single wide row so every sign's face is visible:
  1) LEFT (position 1, front): Heart Flower Pink i286 — heart wreath + pink handprint inside + "TO THE WORLD YOU ARE A MOM..." text — leaning against a folded cream linen napkin.
  2) LEFT-CENTER (position 2, back): To The Moon And Back i290 — blue crescent moon + clouds + ORANGE/YELLOW handprint inside the moon + scattered yellow stars + "I love you to the moon and back" — leaning against the pink-and-white peony vase.
  3) CENTER-LEFT (position 3, front): Handmade With Love i320 — yellow handprint + pink handprint above a flower bouquet with pink ribbon + "Handmade with love by Ciara, Cody" — leaning against a small kraft gift box.
  4) CENTER-RIGHT (position 4, back, slightly raised on the gift box): MOM handprint i766 — floral pink MOM letters with handprint replacing center O + "To the world you are one person..." + "Happy Mother's Day, Love, Darya".
  5) RIGHT-CENTER (position 5, front): Flower Pot i765 — red handprint-flower on green stem in teal pot + heart with "2026" + "HAPPY MOTHER'S DAY!" + "Laura" — leaning against a small ceramic teacup.
  6) RIGHT (position 6, back): Dough Mixer i767 — pink stand mixer + clear bowl + red handprint dropping into bowl + poem + "Happy Mother's Day, Ciara" — leaning against the window frame.
All six signs are white matte FOMEX (thin rigid PVC foam board with visible ~5 mm flat edges, no canvas wrap, no wood grain). Surrounding props: the pink and white peony vase on the upper-left, a cream envelope with a pink wax seal, two small watercolor paint pots (pink + red), a kid's paintbrush laid flat, scattered rose petals, a few loose wildflower stems. Warm golden morning light streams from the upper-left. Soft domestic bokeh with out-of-focus greenery and window frame behind. STRICTLY NO WOODEN EASELS, NO TRIPODS, NO STANDS, NO HUMAN FIGURES, NO HANDS, NO ARMS, NO FINGERS anywhere in the frame. If any of the 6 signs is missing or merged with another, it is a FAILURE.

BOTTOM 17%: FREDOKA BOLD product-family strip — six small rounded pills horizontal, each in its variant's accent color, spaced evenly under the signs:
  "HEART FLOWER" (pink #E94B72) · "TO THE MOON" (navy-blue #3A4F8E) · "HANDMADE WITH LOVE" (yellow-pink #E8C04D) · "FLOWER POT" (teal #48B5C4) · "MOM" (rose #C03A58) · "DOUGH MIXER" (soft rose #D97E8E). Each pill FREDOKA BOLD uppercase white text.

All six variants preserve exact printed-artwork fidelity per their references, all on FOMEX board, NO easels anywhere, zero humans/hands in the frame. Warm emotional Mother's Day mood. ${GUARDS}`,
};

const args = process.argv.slice(2);
const ratioArg = args.find(a => a.startsWith('--ratio='));
const aspectRatio = ratioArg ? ratioArg.split('=')[1] : '21:9';
const ratioSlug = aspectRatio.replace(':', 'x');
const OUT_DIR = aspectRatio === '16:9' ? BASE_OUT_DIR : path.join(BASE_OUT_DIR, `${ratioSlug}_native`);
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);

  for (const k of M1.refs) {
    if (!REF_CATALOG[k] || !fs.existsSync(REF_CATALOG[k])) {
      console.error(`[FAIL] Missing ref: ${k} -> ${REF_CATALOG[k]}`);
      process.exit(1);
    }
  }

  console.log(`[REGEN-MD-M1] Ratio: ${aspectRatio} | Out: ${OUT_DIR}`);
  console.log(`[REGEN-MD-M1] Uploading 6 refs...`);
  const refUrls = {};
  for (const key of M1.refs) {
    refUrls[key] = await kie.uploadFromLocal(REF_CATALOG[key], 'product-refs', { maxSize: 2048, quality: 95, format: 'jpeg' });
    console.log(`  [${key}] cached`);
  }

  console.log(`\n[REGEN-MD-M1] Generating M1 (nano-banana-pro, 2K, ${aspectRatio})...\n`);
  const image_input = M1.refs.map(k => refUrls[k]);
  const input = {
    prompt: M1.prompt,
    image_input,
    resolution: '2K',
    aspect_ratio: aspectRatio,
    output_format: 'jpg',
  };
  try {
    const outputPath = path.join(OUT_DIR, `${M1.id}.jpg`);
    const result = await kie.run('nano-banana-pro', input, 'image', M1.id);
    const imageUrl = result.resultUrls?.[0];
    if (!imageUrl) throw new Error('no resultUrls');
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error(`download failed: ${imageResponse.status}`);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    console.log(`[REGEN-MD-M1] OK ${Math.round(buffer.length / 1024)}KB -> ${outputPath}`);
  } catch (err) {
    console.error(`[REGEN-MD-M1] FAIL ${err.message}`);
    process.exit(1);
  }
})();
