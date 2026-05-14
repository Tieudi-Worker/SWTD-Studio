/**
 * Plan A Fix — SKU TNTD180326i750
 * Regen M1, M2, M3, M5 (giữ M4). Fixes:
 *   M1: hard scale ratio + photoreal keyword
 *   M2: hard scale ratio + photoreal keyword
 *   M3: explicit anti-disc/anti-circle → flat mason-jar silhouette + restore callout 04
 *   M5: preserve intricate numbered token design + birch wood photoreal
 *
 * Drop edge_thickness ref entirely (blurry → caused M3 disc regression in v3).
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

// ═══ Enhanced safeguards v4 ═══
const GUARDS = `
CRITICAL PRODUCT FIDELITY (R2): The reward jar is a FLAT MASON-JAR SILHOUETTE FRAME made of natural birch plywood — NOT a circle, NOT a disc, NOT a rainbow medallion, NOT an illustrated sticker. It has the exact silhouette of a classic mason jar (with rounded jar shoulders, jar neck at top, curved bottom). Inside the silhouette window is a clear acrylic panel UV-printed with dozens of colorful reward tokens — each token is a circular sticker printed with a NUMERAL (1, 2, 3, 4, 5, 6, 7, 8, or 9) in the center on a pastel background (pink, blue, yellow, orange, green, purple) with INTRICATE PRINTED PATTERNS (cartoon faces, checker patterns, donuts, stars — not plain solid circles). Along the bottom curve: UV-printed rainbow "REWARD JAR" lettering with each letter a different bright color. Separate laser-cut wooden easel stand. PRESERVE exact silhouette, token intricate design, rainbow lettering colors from reference images. Do NOT simplify tokens. Do NOT render as circular disc or round medallion.

PHOTOREALISM (R2b): The jar must render as REAL PHOTOGRAPHY of a handcrafted wooden product — natural birch wood grain visible, real tactile texture, honest photographic lighting. NOT illustrated. NOT cartoon. NOT sticker art. NOT flat vector graphic. Think: studio product photography of a real handmade wood piece.

SCALE ANCHOR (R3): The jar is 6 × 8 inches (15 × 20 cm) — the size of a hardcover book. HARD RATIO: when a child or adult is in the same frame, the jar height must be NO MORE than 1/3 of the person's body height visible. Jar is NEVER larger than a person's head. When held in two hands, jar covers ONLY chest area (NOT torso-wide). On a desk beside a laptop, jar ≈ 1/3 the laptop's width.

TYPOGRAPHY LOCK (R1): 2 fonts only. Font 1 = BALOO 2 BOLD (rounded sans-serif display, coral or white) for headlines, CTA, callout numbers, stat bars. Font 2 = HANDWRITTEN CALLIGRAPHY ITALIC (Kalam/Caveat style) for accent captions, subheadlines, ribbon labels. NO third font.
`;

const TESTS = [
  {
    id: 'planA_M1_hero-promise',
    refs: ['hero_faceon', 'hero_lifestyle'],
    prompt: `Amazon A+ content banner wide horizontal, SPLIT. LEFT 40%: coral-to-pastel-pink gradient with star confetti, Baloo BOLD warm-white headline "Turn Every Small Win Into A Moment Kids Remember", italic Calligraphy subhead "a handmade reward jar for daily behavior growth", Baloo tag "Handmade in Vietnam" bottom. RIGHT 60%: REAL PHOTOGRAPHIC lifestyle shot of a warm mother in her 30s in cream knit sweater kneeling next to her smiling boy aged 5-6 in striped shirt. The boy holds the wooden reward jar (REAL BIRCH WOOD FRAME in mason-jar silhouette, NOT illustrated) at his chest level with both hands. STRICT SCALE: the jar height is approximately 1/3 of the boy's visible body height, the jar covers ONLY his chest (NOT his whole torso), the jar is NOT bigger than his head. 3-4 rainbow magnetic reward tokens stuck on the clear acrylic face. Warm morning window light, bright bedroom with rainbow rug and bookshelf softly blurred. Photorealistic product photography style, natural birch wood grain visible. ${GUARDS}`,
  },
  {
    id: 'planA_M2_pain-solution',
    refs: ['hero_lifestyle', 'hero_faceon'],
    prompt: `Amazon A+ content banner wide horizontal, SPLIT 50/50. LEFT HALF: slightly desaturated real living room, tired mother in gray t-shirt kneeling on rug with scattered wooden blocks and toys, small boy in background turning away, muted cool tones. Baloo overlay white top "Nagging. Repeating. Frustration." Small coral arrow transitions right. RIGHT HALF: warm real photographic scene — same mother smiling as her boy (age 5) gently places a rainbow magnetic token onto the clear acrylic face of the wooden reward jar. The jar stands on its laser-cut wooden easel stand on a warm oak kid's desk, loose rainbow magnetic tokens scattered on the desk surface in front. STRICT SCALE: the jar height is approximately half the boy's seated upper-body height, the jar is smaller than the boy's head. The boy's one hand only touches one corner of the jar face. REAL BIRCH WOOD PHOTOGRAPHY style, natural grain visible, NOT illustrated. Bright morning light, warm pastel bedroom bokeh. Baloo coral overlay "A jar. A token. A smile." Calligraphy caption "every good choice, a tiny ceremony". ${GUARDS}`,
  },
  {
    id: 'planA_M3_whats-in-box',
    refs: ['hero_faceon', 'hero_lifestyle'],
    prompt: `Amazon A+ content banner wide horizontal, "WHAT'S IN THE BOX" infographic on soft pastel pink-lavender gradient with scattered stars. Top: Baloo BOLD coral headline "WHAT'S IN THE BOX". CENTER of composition: the wooden reward jar rendered PHOTOREALISTIC as a FLAT MASON-JAR-SILHOUETTE FRAME with rounded jar shoulders, jar neck, curved bottom — NOT a circle, NOT a disc, NOT a rainbow medallion, NOT a round wooden plate. The flat frame has a clear acrylic panel window showing dozens of intricate numbered rainbow tokens (numerals 1-9 on pastel circles with detailed printed patterns), rainbow "REWARD JAR" lettering band along the bottom curve, laser-cut wooden easel stand beside it. AROUND the jar, arrange FIVE UNIQUE rounded-square white callout cards with coral Baloo numbered headers, EACH NUMBER APPEARING EXACTLY ONCE: 01, 02, 03, 04, 05 — all five numbers present, no duplicates, no missing. Card 01 top-left — macro 2-layer birch plywood edge + "3-Layer Birch Plywood / kid-safe smooth edges". Card 02 middle-left — macro clear acrylic with printed tokens + "UV-Printed Rainbow Tokens / fade-free vibrant colors". Card 03 top-right — pile of loose rainbow magnetic tokens + "52 Magnetic Tokens Included / durable and easy to stick". Card 04 middle-right — laser-cut wooden easel stand close-up + "Easel Stand Included / stands on any desk". Card 05 bottom-right — cream thank-you card + kraft envelope + "Ready-to-Gift Packaging". Thin coral connector lines from each card to the jar. All 5 callout numbers 01-05 MUST appear once each. ${GUARDS}`,
  },
  {
    id: 'planA_M5_handmade-cta',
    refs: ['hero_lifestyle', 'hero_faceon'],
    prompt: `Amazon A+ content banner wide horizontal, SPLIT 60/40. LEFT 60%: handmade authenticity, two stacked panels. TOP panel: warm workshop table, an artisan's hands (warm skin tone, no face) carefully fitting the UV-printed clear acrylic token panel into the birch plywood mason-jar-shape FRAME (REAL WOOD PHOTOGRAPHY, natural grain visible, NOT illustrated). Visible workshop tools: wooden ruler, sandpaper, wood shavings. Preserve exact token intricate design from reference — numerals 1-9 with detailed printed patterns on pastel circles. Baloo BOLD coral overlay "Handcrafted. Wrapped. Ready To Give." BOTTOM panel: open kraft gift box with cream tissue paper cradling the finished reward jar. STRICT SCALE: jar fits snugly inside a box about the size of a hardcover book. Printed cream thank-you card with pressed flowers beside. A few loose rainbow magnetic reward tokens (with intricate numbered design preserved from reference) scattered. Calligraphy italic "checked by human hands before it ships". RIGHT 40%: solid coral block. Calligraphy italic "A gift today." top. Baloo BOLD "A keepsake tomorrow." below. Baloo small body "Because the jar she fills with her first tokens is the same jar she'll show her own kids one day." Big rounded Baloo BOLD CTA button in soft white on coral "Start Rewarding Today →". Three small trust badges Baloo row: ⭐ Handmade / 🎁 Gift-Ready / 🛡 Kid-Safe. REAL WOOD PHOTOREALISTIC throughout — preserve token intricate design AND rainbow lettering exactly from reference. ${GUARDS}`,
  },
];

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);

  const uniqueRefKeys = [...new Set(TESTS.flatMap(t => t.refs))];
  console.log(`[PlanA-Fix] Uploading ${uniqueRefKeys.length} refs...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    refUrls[key] = await kie.uploadFromLocal(REF_CATALOG[key], 'product-refs', { maxSize: 768, quality: 85, format: 'jpeg' });
    console.log(`  [${key}] cached`);
  }

  console.log(`\n[PlanA-Fix] Regenerating ${TESTS.length} modules (M1, M2, M3, M5) in parallel...\n`);

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
      console.log(`  [${t.id}] ✓ ${Math.round(buffer.length / 1024)}KB  refs=[${t.refs.join(',')}]`);
      results.push({ id: t.id, ok: true });
    } catch (err) {
      console.error(`  [${t.id}] ✗ ${err.message}`);
      results.push({ id: t.id, ok: false, err: err.message });
    }
  }));

  console.log('\n[PlanA-Fix] Summary:');
  for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.id}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[PlanA-Fix] ${passed}/${results.length} regen OK (M4 unchanged)`);
})();
