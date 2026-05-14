/**
 * Plan A Fix v5 — SKU TNTD180326i750
 * Regen M1, M2, M5 (giữ M3 v4 + M4 v3). Fixes:
 *   M1: Add tokens_topview ref → force real token intricate design (no emoji sticker)
 *       + conservative jar scale matching MK(5).png reference
 *   M2: Same token fidelity fix + jar scale on desk smaller
 *   M5: Bottom package panel reorganize — all components visible with breathing space
 *       (inspired by MK(4).png WHAT'S INCLUDED clean separation layout)
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

const GUARDS = `
CRITICAL PRODUCT FIDELITY (R2): The reward jar is a FLAT MASON-JAR SILHOUETTE FRAME of natural birch plywood. Clear acrylic panel shows TOKENS that MUST match reference intricate printed design — circular stickers with NUMERALS 1, 2, 3, 4, 5, 6, 7, 8, or 9 in the center on pastel pink/blue/yellow/orange/green/purple backgrounds, surrounded by DETAILED PRINTED PATTERNS (cartoon faces, checker patterns, donut shapes, star motifs, flower prints). The tokens are NOT plain emoji stickers. NOT smiley face stickers. NOT simplified candy-shape circles. NOT rainbow medallions. They are exactly the tokens visible in the reference product photography with authentic intricate cartoon/pattern print design. Preserve rainbow "REWARD JAR" lettering at the bottom curve of the jar frame exactly from reference. Preserve separate laser-cut wooden easel stand. Render as REAL BIRCH WOOD PHOTOGRAPHY — natural wood grain visible, honest photographic lighting, NOT illustrated.

SCALE ANCHOR (R3): Jar is 6×8 inches (15×20 cm) = hardcover book size. In lifestyle shots where humans are present, the jar is approximately the width of an adult's two hands joined together, smaller than a person's face, and jar height is NEVER more than 1/3 of the person's body height visible. Match the realistic scale shown in the listing photography where the jar is held between 2 kneeling people at chest level.

TYPOGRAPHY LOCK (R1): 2 fonts only — rounded bold sans-serif display (used for headlines, CTA, callout numbers, stat bars) + handwritten calligraphy italic (used for accent captions, subheadlines, ribbon labels). NO third font. NO serif. NO font-name words visible in the banner (do NOT render the word "Baloo" or font names as text).
`;

const TESTS = [
  {
    id: 'planA_M1_hero-promise',
    refs: ['hero_faceon', 'hero_lifestyle', 'tokens_topview'],
    prompt: `Amazon A+ content banner wide horizontal, SPLIT layout. LEFT 40%: coral-to-pastel-pink gradient with scattered star confetti, rounded bold sans-serif warm-white headline "Turn Every Small Win Into A Moment Kids Remember", italic calligraphy subhead "a handmade reward jar for daily behavior growth", small tag bottom "Handmade in Vietnam". RIGHT 60%: REAL PHOTOGRAPHIC LIFESTYLE — a mother in 30s in cream knit sweater kneeling beside her smiling boy aged 5-6 in striped shirt, playing together on a soft playmat rug in a bright kitchen/playroom setting. The boy holds the wooden reward jar at chest level with both hands. CRITICAL SCALE REFERENCE: the jar size and positioning must match the listing photography where the jar is approximately the width of the boy's chest (NOT torso-wide), held at chest level between the mom and boy, the jar is clearly smaller than the boy's head. The jar is real birch wood product photography — natural wood grain visible, mason-jar silhouette, rainbow "REWARD JAR" lettering band at bottom, dozens of INTRICATE REAL NUMBERED REWARD TOKENS behind the clear acrylic panel (tokens must match reference intricate design — circular stickers with numerals 1-9 and detailed cartoon/checker/donut/star patterns, NOT simplified emoji, NOT smiley faces, NOT candy shapes). Warm morning light, bookshelf + indoor plants softly blurred background. Photorealistic product photography style. ${GUARDS}`,
  },
  {
    id: 'planA_M2_pain-solution',
    refs: ['hero_lifestyle', 'hero_faceon', 'tokens_topview'],
    prompt: `Amazon A+ content banner wide horizontal, SPLIT 50/50. LEFT HALF: slightly desaturated real living room, tired mother in gray t-shirt kneeling on rug with scattered wooden blocks and toys, small boy in background turning away, muted cool tones. Rounded bold sans-serif overlay white top "Nagging. Repeating. Frustration." Small coral arrow transitions right. RIGHT HALF: warm real photographic scene — same mother smiling warmly as her boy aged 5 in striped shirt gently places a rainbow magnetic reward token onto the clear acrylic face of the wooden reward jar. The jar stands on its laser-cut wooden easel stand on a warm oak kid's desk, a handful of loose magnetic reward tokens scattered on the desk. CRITICAL SCALE: the jar on the desk is conservatively sized — approximately the width of the boy's hand-span, clearly smaller than his head, smaller than a standard hardcover book, smaller than half the width of a 13-inch laptop. The boy's hand only touches one small corner of the jar face. The jar is REAL BIRCH WOOD PHOTOGRAPHY with INTRICATE NUMBERED REWARD TOKENS behind the acrylic panel matching reference exactly (numerals 1-9, detailed cartoon/checker/donut patterns, NOT emoji stickers, NOT smiley faces, NOT simplified candies). Bright warm morning light, pastel bedroom bokeh. Rounded bold coral overlay "A jar. A token. A smile." Calligraphy italic caption coral "every good choice, a tiny ceremony". ${GUARDS}`,
  },
  {
    id: 'planA_M5_handmade-cta',
    refs: ['hero_lifestyle', 'hero_faceon', 'tokens_topview'],
    prompt: `Amazon A+ content banner wide horizontal, SPLIT 60/40. LEFT 60%: handmade authenticity in two stacked panels. TOP panel: warm workshop table, an artisan's hands (warm skin tone, no face visible) carefully fitting the UV-printed clear acrylic token panel into the birch plywood mason-jar-shape frame. Real wood photography. Visible tools: wooden ruler, sandpaper, wood shavings. Rounded bold coral headline overlay "Handcrafted. Wrapped. Ready To Give." Calligraphy italic caption "checked by human hands before it ships". BOTTOM panel: TOP-DOWN FLAT LAY on a warm rustic wooden table, all KIT COMPONENTS arranged with CLEAR BREATHING SPACE between each item (inspired by an organized "What's Included" layout — no piles, no overlap). Layout: (center-left) the wooden reward jar with tokens intricate design visible inside, rainbow lettering; (top-right) a printed cream "Thank You" card with flower illustration; (middle-right) a blank cream lined note card; (bottom) a neat natural arc of loose rainbow magnetic reward tokens showing intricate numbered design (matching reference exactly — NOT emoji stickers); (left edge) 2-3 crayons; (top-left corner) a small sticker sheet with colorful reward stickers; (right of jar) the laser-cut wooden easel stand shown separately; (bottom-right) a kraft envelope. Open kraft gift box partially visible upper-left with cream tissue paper. All items clearly visible, well-separated, organized. Warm natural daylight, real wood photography. RIGHT 40%: solid coral block. Calligraphy italic "A gift today." top. Rounded bold "A keepsake tomorrow." below. Small body "Because the jar she fills with her first tokens is the same jar she'll show her own kids one day." Big rounded-rectangle bold CTA button in soft white on coral "Start Rewarding Today →". 3 small trust badges row: ⭐ Handmade / 🎁 Gift-Ready / 🛡 Kid-Safe. ${GUARDS}`,
  },
];

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);
  const uniqueRefKeys = [...new Set(TESTS.flatMap(t => t.refs))];
  console.log(`[PlanA-Fix-v5] Uploading ${uniqueRefKeys.length} refs...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    refUrls[key] = await kie.uploadFromLocal(REF_CATALOG[key], 'product-refs', { maxSize: 768, quality: 85, format: 'jpeg' });
    console.log(`  [${key}] cached`);
  }

  console.log(`\n[PlanA-Fix-v5] Regenerating M1, M2, M5 in parallel...\n`);

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
      console.log(`  [${t.id}] ✓ ${Math.round(buffer.length / 1024)}KB`);
      results.push({ id: t.id, ok: true });
    } catch (err) {
      console.error(`  [${t.id}] ✗ ${err.message}`);
      results.push({ id: t.id, ok: false, err: err.message });
    }
  }));

  console.log('\n[PlanA-Fix-v5] Summary:');
  for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.id}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[PlanA-Fix-v5] ${passed}/${results.length} regen OK`);
})();
