/**
 * A+ Fix v6 — SKU TNTD180326i750
 * Regen 6 banner FAIL từ audit v5:
 *   planA_M1: tokens vẫn emoji → push intricate numeral 1-9 với pattern cartoon/checker
 *   planA_M2: scale + tokens + REMOVE duplicate "A jar. A token. A smile." (chỉ top)
 *   planA_M4: jar bị render flat-cutout/sticker → FORCE 3D real wood standing on easel stand
 *   planB_M1: chữ "Baloo" bake-in góc → cấm render font name; top band 12%; tokens intricate
 *   planB_M4: jar flat cutout 3 panel → FORCE 3D wood product standing on stand
 *   planB_M5: jar cartoon transparent → FORCE real birch wood product photography
 *
 * Pass v5/v4 (giữ nguyên, không regen): planA_M3, planA_M5, planB_M2, planB_M3
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
CRITICAL PRODUCT FIDELITY (R2) — THIS IS NOT NEGOTIABLE:
The reward jar is a REAL 3D PHYSICAL WOODEN PRODUCT photographed as genuine product photography. It is a natural birch plywood mason-jar-silhouette frame (3 layers of plywood, honey-tan natural wood grain clearly visible, real shadows, real depth). A clear acrylic panel on the front shows magnetic reward tokens behind it. The jar stands upright on its own matching laser-cut wooden easel stand. Rainbow gradient "REWARD JAR" lettering runs along the bottom curve of the jar frame.
THE JAR IS NEVER: a flat 2D sticker, a paper cutout, a transparent decal, a cartoon illustration, a see-through vector graphic, a clipart element, or a flat silhouette pasted onto a scene. It is ALWAYS: real wood, real thickness, real shadow, real standing product.

TOKENS FIDELITY (R2):
The magnetic reward tokens behind the acrylic panel MUST match the reference product photography EXACTLY:
- Circular magnetic tokens, approximately 1 inch (2.5 cm) diameter
- Each token has a pastel background (pink, blue, yellow, orange, mint green, or lavender)
- CENTER of each token shows a LARGE NUMERAL: 1, 2, 3, 4, 5, 6, 7, 8, or 9 in bold rounded typography
- Around the numeral: INTRICATE PRINTED PATTERNS — tiny cartoon faces, checker squares, donut rings, star bursts, flower motifs, polka dots, cloud shapes
Tokens are NEVER: plain emoji stickers, smiley-face only stickers, simplified candy-shape circles, solid-color dots, rainbow blobs, or generic rainbow medallions. They MUST look like the reference intricate kids' sticker design.

TYPOGRAPHY LOCK (R1):
Exactly 2 fonts throughout: (1) rounded bold sans-serif display (headlines, numbers, CTA button, stat text) + (2) handwritten calligraphy italic (accent captions, subheads, ribbon labels). No third font. No serif. DO NOT render the word "Baloo" or any font-name word as visible text in the banner. Each headline appears EXACTLY ONCE — no duplicate text, no repeated phrases.

SCALE ANCHOR (R3):
Jar is 6×8 inches (15×20 cm) = hardcover book size. In human scenes, jar is approximately the width of an adult's two hands joined, SMALLER than a person's face, never wider than a child's chest, never taller than 1/3 of a person's body height.
`;

const TESTS = [
  {
    id: 'planA_M1_hero-promise',
    refs: ['hero_faceon', 'hero_lifestyle', 'tokens_topview'],
    prompt: `Amazon A+ banner wide horizontal 16:9, SPLIT 40/60. LEFT 40%: coral-to-pastel-pink gradient with scattered small star confetti, rounded bold sans-serif warm-white headline "Turn Every Small Win Into A Moment Kids Remember", handwritten calligraphy italic subhead "a handmade reward jar for daily behavior growth", small rounded coral tag bottom "Handmade in Vietnam". RIGHT 60%: REAL PHOTOGRAPHIC LIFESTYLE — mom in cream knit sweater kneeling on a playmat beside her smiling 5-year-old boy in striped shirt in a warm kitchen/playroom with bookshelf and indoor plants soft-blurred. The boy holds the REAL WOODEN REWARD JAR at chest level with both hands. The jar is REAL 3D BIRCH PLYWOOD PRODUCT PHOTOGRAPHY with visible wood grain, real thickness, real shadow — jar width matches the boy's chest width exactly (NOT torso-wide, NOT head-height-sized). Through the clear acrylic front panel, the magnetic reward tokens visible are INTRICATE NUMBERED DESIGNS: pastel circles each with a bold numeral 1-9 in the center and detailed surrounding patterns (cartoon faces, checker squares, donut rings, star bursts) — tokens look EXACTLY like the reference product tokens, NOT emoji stickers, NOT plain smiley faces, NOT candy circles. Rainbow "REWARD JAR" lettering at jar bottom. Warm morning light, photorealistic. ${GUARDS}`,
  },
  {
    id: 'planA_M2_pain-solution',
    refs: ['hero_lifestyle', 'hero_faceon', 'tokens_topview'],
    prompt: `Amazon A+ banner wide horizontal 16:9, SPLIT 50/50. LEFT HALF: slightly desaturated real living room, tired mom in gray t-shirt kneeling on rug with scattered wooden blocks, small boy in background turning away, muted cool tones. Rounded bold sans-serif white text overlay LEFT CENTER "Nagging. Repeating. Frustration." Small coral arrow points right at the divider. RIGHT HALF: warm real photographic scene — same mom smiling as her 5-year-old boy in striped shirt places a magnetic reward token onto the clear acrylic face of the REAL WOODEN REWARD JAR. The jar stands on its laser-cut wooden easel stand on a warm oak kid's desk. A small handful of loose magnetic reward tokens on the desk near the jar. CRITICAL SCALE: jar is CONSERVATIVELY sized — approximately the width of the boy's open hand, clearly smaller than his head, smaller than a standard hardcover book. The boy's fingertip only touches a small area of the jar face. The jar is REAL 3D BIRCH PLYWOOD PRODUCT with visible wood grain, real shadow, standing upright on its own stand (NOT flat sticker, NOT cutout). Tokens visible through the acrylic match reference intricate numbered design exactly (numerals 1-9, cartoon/checker/donut patterns, NOT emoji). Bright warm morning light, pastel bedroom bokeh.
TEXT OVERLAY — RIGHT SIDE ONLY, ONE HEADLINE ONLY: Top-right corner rounded bold coral "A jar. A token. A smile." (appears EXACTLY ONCE). Below it, small calligraphy italic coral caption "every good choice, a tiny ceremony". DO NOT REPEAT the "A jar. A token. A smile." phrase anywhere else in the banner. NO bottom duplicate. Single instance only. ${GUARDS}`,
  },
  {
    id: 'planA_M4_use-case-narrative',
    refs: ['hero_faceon', 'hero_lifestyle', 'tokens_topview'],
    prompt: `Amazon A+ banner wide horizontal 16:9, HEADER + 4-panel grid. HEADER (top 15%): cream background with rounded bold sans-serif coral headline center "One Jar. Four Ways To Grow Better Kids." 4 VERTICAL PANELS below (25% width each), divided by thin coral vertical lines. Each panel shows a DIFFERENT real-life scenario, but the SAME REAL 3D WOODEN REWARD JAR product appears prominently in each — the jar is ALWAYS real birch plywood 3D photographic product, visible wood grain, real shadow, standing on its own laser-cut wooden easel stand OR held physically by a person (NEVER a flat sticker, NEVER a paper cutout, NEVER a transparent decal, NEVER a 2D illustration pasted onto the scene — ALWAYS real 3D wood product photography).
PANEL 1 "POTTY TRAINING make milestones fun": toddler girl in pajamas reaches up toward the wooden reward jar standing on a low wooden shelf in a soft-lit bathroom/bedroom corner, mom kneeling supportive.
PANEL 2 "HOMEWORK reward consistency": boy aged 7 at a warm oak study desk, the wooden reward jar standing beside his notebook on its wooden stand.
PANEL 3 "CHORES build daily habits": mom and daughter in kitchen, the wooden reward jar standing on the counter on its stand while the girl places a token on it.
PANEL 4 "CLASSROOM celebrate class wins": elementary classroom, teacher smiling, group of kids raising hands, the wooden reward jar standing on a classroom shelf or teacher's desk on its stand.
In every panel: tokens visible through jar acrylic are INTRICATE NUMBERED design (numerals 1-9, cartoon/checker patterns, NOT emoji). Bottom of each panel: rounded bold coral label + calligraphy italic caption. ${GUARDS}`,
  },
  {
    id: 'planB_M1_open-scene',
    refs: ['hero_faceon', 'hero_lifestyle', 'tokens_topview'],
    prompt: `Amazon A+ banner wide horizontal 16:9, vertical stack layout — 3 bands. TOP BAND (exactly 12% height — a THIN strip, NOT thick, NOT 40%): pastel pink background, small scattered star confetti only. NO rainbow. NO big corner tag. NO font-name tag anywhere. DO NOT render the word "Baloo" or any font family name. DO NOT show any collection-name tag in the corners. Leave the top band minimal and thin.
MIDDLE BAND (18% height): cream/warm-white background. Rounded bold sans-serif coral headline centered "Turn Every Small Win Into A Moment Kids Remember." (appears once). Below it, smaller handwritten calligraphy italic coral sub-line "a handmade reward jar — crafted in Vietnam, loved at home".
BOTTOM BAND (70% height — DOMINANT): full real photographic lifestyle — warm bright kid's bedroom, a smiling 5-year-old boy in blue sweater holding the REAL WOODEN REWARD JAR up toward the camera with both hands, his mom in cream sweater smiling behind him slightly out of focus. Window daylight. The jar is REAL 3D BIRCH PLYWOOD PRODUCT PHOTOGRAPHY — visible wood grain, real thickness, real depth, rainbow "REWARD JAR" lettering on bottom curve. Tokens behind the acrylic match reference intricate numbered design (numerals 1-9, cartoon/checker/donut patterns, NOT emoji stickers, NOT simple smiley faces). Jar size matches the boy's chest width exactly.
CRITICAL: NO font-name word visible anywhere in the banner. NO "Baloo". NO "Kids Reward Collection" tag. Clean minimal top. ${GUARDS}`,
  },
  {
    id: 'planB_M4_milestones-pride',
    refs: ['hero_faceon', 'hero_lifestyle', 'tokens_topview'],
    prompt: `Amazon A+ banner wide horizontal 16:9, HEADER + 3-panel row. HEADER (top 18%): cream background with small scattered pastel star + polka-dot pattern at the top edge only, rounded bold coral sans-serif headline center "Raising kids who want to do the right thing." 3 PANELS below (equal width), divided by thin coral vertical dividers with subtle scalloped top curve.
In every panel, the REAL WOODEN REWARD JAR is a REAL 3D BIRCH PLYWOOD PRODUCT — visible wood grain, real thickness, real shadow, standing on its own laser-cut wooden easel stand OR held physically. NEVER a flat sticker. NEVER a paper cutout. NEVER a transparent decal. ALWAYS real product photography. Tokens visible through the acrylic = intricate numbered 1-9 design with cartoon/checker patterns (NOT emoji, NOT simple dots).
PANEL 1 "First Dry Night": soft morning light bedroom, toddler girl in pajamas proudly placing a token onto the wooden reward jar standing on its wooden stand on a low dresser. Mom smiling.
PANEL 2 "Shared Without Being Asked": warm playroom, two siblings sharing toys at a small wooden table, the wooden reward jar standing on the table between them on its stand, mom clapping softly in the background.
PANEL 3 "Homework Done Proud": bright study nook, 7-year-old boy at his oak desk with open notebook, the wooden reward jar standing beside the notebook on its wooden stand.
Below each panel: handwritten calligraphy italic coral caption label on a soft curved cream ribbon. ${GUARDS}`,
  },
  {
    id: 'planB_M5_gift-keepsake-cta',
    refs: ['hero_faceon', 'tokens_topview', 'hero_lifestyle'],
    prompt: `Amazon A+ banner wide horizontal 16:9, SPLIT 60/40. LEFT 60%: TOP-DOWN FLAT LAY photograph on a warm rustic oak wooden table, natural daylight. Components arranged with clear breathing space:
- Center: the REAL WOODEN REWARD JAR lying flat on the table — REAL BIRCH PLYWOOD PRODUCT PHOTOGRAPHY, visible wood grain, real thickness, real shadow (NOT a cartoon illustration, NOT a transparent cutout). Through the clear acrylic front, the magnetic reward tokens visible are INTRICATE NUMBERED design matching reference exactly (pastel circles with numerals 1-9 and cartoon/checker/donut patterns — NOT emoji, NOT simple smiley circles).
- Upper-left: a printed sticker sheet with rainbow reward token stickers (matching the intricate reference design).
- Upper-right: a cream "Thank You" card with handwritten-style flower illustration, and a blank cream note card beside it.
- Lower-left edge: 2-3 colored crayons.
- Lower arc around the jar: a natural curve of loose magnetic reward tokens showing the intricate numbered design clearly (numerals 1-9, cartoon patterns, NOT rainbow emoji dots).
- Upper-left corner: small succulent plant in a terracotta pot.
Small handwritten calligraphy italic coral text overhead "A gift today".
RIGHT 40%: solid coral block. Rounded bold warm-white headline "A Keepsake Tomorrow." Small body text "Because the jar she fills with her first tokens is the same jar she'll show her own kids one day." Big rounded-rectangle bold warm-white CTA button with coral text "Start Rewarding Today →". 3 small trust-badge icons row: Handmade / Gift-Ready / Kid-Safe. ${GUARDS}`,
  },
];

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);
  const uniqueRefKeys = [...new Set(TESTS.flatMap(t => t.refs))];
  console.log(`[Fix-v6] Uploading ${uniqueRefKeys.length} refs...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    refUrls[key] = await kie.uploadFromLocal(REF_CATALOG[key], 'product-refs', { maxSize: 768, quality: 85, format: 'jpeg' });
    console.log(`  [${key}] cached`);
  }

  console.log(`\n[Fix-v6] Regenerating ${TESTS.length} banners in parallel via nano-banana-pro...\n`);

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

  console.log('\n[Fix-v6] Summary:');
  for (const r of results) console.log(`  ${r.ok ? 'OK' : 'FAIL'} ${r.id}${r.err ? ' — ' + r.err : ''}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[Fix-v6] ${passed}/${results.length} regen OK`);
})();
