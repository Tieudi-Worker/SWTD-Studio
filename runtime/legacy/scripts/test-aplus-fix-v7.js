/**
 * A+ Fix v7 — SKU TNTD180326i750
 * Regen 4 banner vẫn FAIL sau v6:
 *   planA_M1: jar thành standee cutout → FORCE held-in-hands real wood photography
 *   planA_M4: 4 panel jar flat sticker → larger jar, stronger "real wood product" per panel
 *   planB_M1: jar illustrated vector cartoon → FORCE photographic realism
 *   planB_M4: 3 panel jar flat sticker → larger jar + stronger real-wood guards
 *
 * Strategy: ref order hero_faceon FIRST (dominant), anti-flat rejection clause,
 * explicit "photograph not illustration" language.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', 'api-keys.env') });
const fs = require('fs');
const path = require('path');
const { KieClient } = require('../utils/kie-client');

const SKU_ROOT = path.resolve(__dirname, '..', '..', 'data', 'TNTD180326i750');
const OUT_DIR = path.join(SKU_ROOT, 'output', 'aplus', 'test');

const REF_CATALOG = {
  hero_faceon:    path.join(SKU_ROOT, 'input', 'product', '20260406_143301.jpg'),
  hero_lifestyle: path.join(SKU_ROOT, 'input', 'product', '20260406_143529.jpg'),
  tokens_topview: path.join(SKU_ROOT, 'input', 'product', '20260406_143209.jpg'),
};

const HARD_GUARDS = `
ABSOLUTE PRODUCT RENDERING RULE — IF VIOLATED, THE IMAGE IS REJECTED:
The reward jar in this banner must be rendered as a REAL PHOTOGRAPHIC 3D PHYSICAL WOODEN PRODUCT, identical in material and look to the first reference image (hero_faceon).
The jar IS: solid 3-layer birch plywood with clearly visible natural wood grain, real thickness (about 1 cm), a real cast shadow on the surface it sits on, honey-tan color, a clear acrylic panel on the front face, and rainbow gradient "REWARD JAR" lettering on the bottom curve of the wooden frame.
The jar IS NOT, UNDER ANY CIRCUMSTANCE: a flat 2D sticker, a paper cardboard standee, a vector illustration, a cartoon drawing, a transparent decal, a clipart graphic, a stylized outline, a sketch, or any non-photographic rendering. If the jar does not look like genuine product photography of real birch wood, the image is WRONG and must be regenerated.
RENDER STYLE: commercial product lifestyle photography, full-color photograph, real DSLR look, real lighting, real depth of field — NEVER illustration, NEVER vector art, NEVER flat graphic.

TOKENS FIDELITY — MATCH REFERENCE tokens_topview EXACTLY:
Every magnetic reward token visible inside the jar's acrylic panel OR scattered near it MUST be the intricate kid's sticker design:
- Pastel-colored circle (pink, blue, yellow, orange, mint, lavender)
- Center shows a BOLD NUMERAL: one of 1, 2, 3, 4, 5, 6, 7, 8, or 9
- Surrounding the numeral: tiny printed patterns — cartoon faces, checker squares, donut rings, star motifs, polka dots, flower prints
Tokens are NEVER: emoji stickers, smiley-face-only stickers, solid pastel dots, plain candy circles, rainbow blobs, abstract shapes. They ALWAYS have a visible numeral and pattern decoration matching the reference.

TYPOGRAPHY (R1): Exactly 2 fonts — rounded bold sans-serif display + handwritten calligraphy italic. No third font. No font-name words rendered as visible text. Every headline appears exactly once.

SCALE (R3): Jar = 6×8 inch hardcover-book-size. Smaller than a person's face, approximately chest-width of a child, never wider than a child's torso, never taller than 1/3 of a person's body height.
`;

const TESTS = [
  {
    id: 'planA_M1_hero-promise',
    refs: ['hero_faceon', 'tokens_topview', 'hero_lifestyle'],
    prompt: `Amazon A+ banner wide horizontal 16:9, SPLIT 40/60. LEFT 40%: coral-to-pastel-pink gradient background with small scattered star confetti; rounded bold sans-serif warm-white headline "Turn Every Small Win Into A Moment Kids Remember"; handwritten calligraphy italic sub-line "a handmade reward jar for daily behavior growth"; small rounded coral tag at bottom "Handmade in Vietnam".
RIGHT 60%: REAL COMMERCIAL PRODUCT LIFESTYLE PHOTOGRAPHY (NOT illustration). A mom in cream knit sweater kneels on a soft playmat rug beside her smiling 5-year-old boy in a striped shirt in a warm bright kitchen/playroom. The boy holds the REAL WOODEN REWARD JAR at chest level with BOTH HANDS firmly gripping the wooden frame. The jar is a REAL 3D BIRCH PLYWOOD PRODUCT — you can see clearly defined wood grain texture, the real 1 cm thickness of the plywood edge, a real cast shadow on the boy's body where the jar meets his chest, honey-tan wood color, rainbow "REWARD JAR" lettering at bottom. Behind the clear acrylic front, the reward tokens visible each show a numeral 1-9 and intricate printed pattern (matching reference tokens_topview exactly). Jar width matches the boy's chest width. Soft bookshelf + indoor plants out-of-focus background, warm morning light.
DO NOT render the jar standing on the floor alone like a cardboard standee. DO NOT make the jar a flat cutout on the playmat. The jar is HELD physically in the boy's hands, real wood, real product photography. ${HARD_GUARDS}`,
  },
  {
    id: 'planA_M4_use-case-narrative',
    refs: ['hero_faceon', 'tokens_topview', 'hero_lifestyle'],
    prompt: `Amazon A+ banner wide horizontal 16:9. HEADER top 18% — cream background, rounded bold sans-serif coral headline centered "One Jar. Four Ways To Grow Better Kids." Below, 4 EQUAL VERTICAL PANELS separated by thin coral vertical dividers.
In EVERY panel, the REAL WOODEN REWARD JAR must appear PROMINENTLY LARGE (occupying ~40% of the panel height), physically present as a REAL 3D BIRCH PLYWOOD PRODUCT photographed in the scene — visible wood grain, real thickness, real shadow, rainbow "REWARD JAR" lettering at bottom, intricate numbered tokens (1-9 with patterns) visible through the clear acrylic. Jar is ALWAYS either physically HELD by a person or standing upright on its own laser-cut wooden easel stand on a real surface. The jar is NEVER a flat sticker, NEVER a cutout pasted onto the scene, NEVER a vector illustration — ALWAYS real product photography.
PANEL 1 "POTTY TRAINING make milestones fun": a soft morning-lit bedroom corner. Mom kneeling with her toddler girl in pajamas; mom HOLDS the wooden reward jar at the toddler's eye level so the toddler can place a token onto the acrylic face. Real wood jar in mom's hands.
PANEL 2 "HOMEWORK reward consistency": warm study nook. A 7-year-old boy at an oak desk with an open notebook; the wooden reward jar stands upright on its wooden easel stand on the desk beside the notebook, clearly a real 3D product.
PANEL 3 "CHORES build daily habits": kitchen counter scene. Mom smiling beside her daughter; the wooden reward jar is HELD BY THE MOM at counter level as the daughter places a token onto it — real wood, held physically.
PANEL 4 "CLASSROOM celebrate class wins": classroom; a teacher holds the wooden reward jar up at the front of the class while kids raise hands at their desks — jar held in teacher's hands, real wood product, real shadow.
Bottom of each panel: rounded bold coral sans-serif label + handwritten calligraphy italic caption on a soft cream ribbon. ${HARD_GUARDS}`,
  },
  {
    id: 'planB_M1_open-scene',
    refs: ['hero_faceon', 'tokens_topview', 'hero_lifestyle'],
    prompt: `Amazon A+ banner wide horizontal 16:9, vertical stack 3-band layout.
TOP BAND exactly 12% height (thin strip only): pastel pink background, tiny scattered star confetti. NO rainbow arc. NO corner tag. NO font-name word anywhere. Do NOT render the word "Baloo" or any font family name as visible text.
MIDDLE BAND 18% height: cream/warm-white background. Rounded bold sans-serif coral headline centered "Turn Every Small Win Into A Moment Kids Remember." (exactly once). Below: handwritten calligraphy italic coral sub-line "a handmade reward jar — crafted in Vietnam, loved at home".
BOTTOM BAND 70% height — REAL COMMERCIAL PRODUCT LIFESTYLE PHOTOGRAPHY (NOT illustration, NOT vector, NOT cartoon drawing, NOT stylized sketch). Warm bright kid's bedroom. A 5-year-old boy in a blue knit sweater holds the REAL WOODEN REWARD JAR up toward the camera at his chest with both hands. His mom in a cream sweater smiles behind him slightly out of focus. Window daylight. The jar is a REAL 3D BIRCH PLYWOOD PRODUCT photographed in the scene — clearly visible honey-tan natural wood grain texture on the mason-jar-silhouette frame, real 1 cm plywood thickness at the edges, real cast shadow on the boy's sweater, rainbow gradient "REWARD JAR" lettering at bottom curve. Through the clear acrylic front panel, the reward tokens visible each show a bold numeral 1-9 with intricate surrounding pattern (cartoon face, checker, donut, or star) matching reference tokens_topview exactly.
DO NOT render the jar as a flat line-art sketch, vector illustration, cartoon drawing, or stylized outline. The jar must look like a REAL PHOTOGRAPH of a physical wooden product. ${HARD_GUARDS}`,
  },
  {
    id: 'planB_M4_milestones-pride',
    refs: ['hero_faceon', 'tokens_topview', 'hero_lifestyle'],
    prompt: `Amazon A+ banner wide horizontal 16:9. HEADER top 18% — cream background with tiny scattered pastel stars and polka dots at the very top edge only; rounded bold sans-serif coral headline centered "Raising kids who want to do the right thing."
Below the header, 3 EQUAL PANELS separated by thin coral vertical dividers with a subtle soft scalloped cream top curve inside each panel.
In EVERY panel, the REAL WOODEN REWARD JAR appears PROMINENTLY LARGE (occupying ~45% of the panel height), physically present as a REAL 3D BIRCH PLYWOOD PRODUCT. Visible natural wood grain, real thickness, real shadow, rainbow "REWARD JAR" lettering at the bottom, intricate numbered reward tokens visible through the clear acrylic (numerals 1-9 with pattern decoration matching reference tokens_topview). The jar is ALWAYS either held physically by a person OR standing upright on its wooden easel stand on a real surface. The jar is NEVER a flat sticker, NEVER a cutout, NEVER a decal, NEVER a vector illustration pasted into the scene.
PANEL 1 "First Dry Night": soft morning light bedroom. Toddler girl in pajamas stands next to her mom sitting on the bed; mom HOLDS the wooden reward jar physically at the toddler's eye level while the toddler places a token onto the acrylic face.
PANEL 2 "Shared Without Being Asked": warm playroom, two young siblings share toys at a small round wooden table; the wooden reward jar stands upright on its laser-cut wooden easel stand on the table between them; mom smiles clapping softly out-of-focus in the background.
PANEL 3 "Homework Done Proud": bright study nook; a 7-year-old boy at an oak desk writing in an open notebook; the wooden reward jar stands upright on its wooden easel stand on the desk beside the notebook — clearly a real 3D product, wood grain visible, real shadow.
Below each panel: handwritten calligraphy italic coral caption label on a soft curved cream ribbon. ${HARD_GUARDS}`,
  },
];

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);
  const uniqueRefKeys = [...new Set(TESTS.flatMap(t => t.refs))];
  console.log(`[Fix-v7] Uploading ${uniqueRefKeys.length} refs...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    refUrls[key] = await kie.uploadFromLocal(REF_CATALOG[key], 'product-refs', { maxSize: 768, quality: 85, format: 'jpeg' });
    console.log(`  [${key}] cached`);
  }

  console.log(`\n[Fix-v7] Regenerating ${TESTS.length} banners in parallel via nano-banana-pro...\n`);

  const results = [];
  await Promise.all(TESTS.map(async (t) => {
    const input = {
      prompt: t.prompt,
      image_input: t.refs.map(k => refUrls[k]),
      resolution: '2K',
      aspect_ratio: '16:9',
      output_format: 'jpg',
    };
    try {
      const outputPath = path.join(OUT_DIR, `${t.id}.jpg`);
      const result = await kie.run('nano-banana-pro', input, 'image', t.id);
      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('no resultUrls');
      const resp = await fetch(imageUrl);
      const buffer = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      console.log(`  [${t.id}] OK ${Math.round(buffer.length / 1024)}KB`);
      results.push({ id: t.id, ok: true });
    } catch (err) {
      console.error(`  [${t.id}] FAIL ${err.message}`);
      results.push({ id: t.id, ok: false, err: err.message });
    }
  }));

  console.log('\n[Fix-v7] Summary:');
  for (const r of results) console.log(`  ${r.ok ? 'OK' : 'FAIL'} ${r.id}${r.err ? ' — ' + r.err : ''}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[Fix-v7] ${passed}/${results.length} regen OK`);
})();
