/**
 * Plan B Fix v4 — SKU TNTD180326i750
 * Regen M1, M2, M3, M5 (giữ M4). Fixes:
 *   M1: Top decoration band reduced to ~12% (half) → more space for lifestyle photo bottom
 *   M2: Remove chaotic token-dot trail → replace with minimal stars + polka dots decoration only
 *   M3: Fix wrong product in "Colors that don't fade" + "Strong enough for tiny hands" panels
 *       → Add tokens_topview ref, stronger fidelity per panel
 *   M5: Fix package scene → match MK TNTD180326i750(1).png style
 *       (wooden table top-down, jar + scattered loose tokens + thank-you card + sticker sheet + crayons)
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
CRITICAL PRODUCT FIDELITY (R2): The reward jar is a FLAT MASON-JAR SILHOUETTE FRAME of natural birch plywood — rounded jar shoulders, jar neck, curved bottom, NOT circular disc, NOT round medallion. Clear acrylic panel inside the window shows dozens of colorful reward tokens — each token is a circle with a NUMERAL (1-9) on pastel background (pink/blue/yellow/orange/green/purple) with INTRICATE PRINTED PATTERNS (cartoon faces, checker, donuts, stars — NOT plain solid). Rainbow "REWARD JAR" lettering along bottom curve, each letter different color. Separate laser-cut wooden easel stand. Preserve exact silhouette + token intricate design + rainbow lettering exactly from reference images.

PHOTOREALISM (R2b): Render as REAL WOOD PRODUCT PHOTOGRAPHY — natural birch grain visible, real tactile texture, honest lighting. NOT illustrated, NOT cartoon, NOT sticker style.

SCALE ANCHOR (R3): Jar is 6×8 inches (15×20 cm) = hardcover book size. Jar height ≤ 1/3 of any person shown in frame. Jar never larger than person's head.

TYPOGRAPHY LOCK (R1): 2 fonts only — Baloo 2 Bold (display) + Calligraphy italic (Kalam/Caveat). NO third font.
`;

const TESTS = [
  {
    id: 'planB_M1_open-scene',
    refs: ['hero_faceon', 'hero_lifestyle'],
    prompt: `Amazon A+ content banner wide horizontal, REVISED LAYOUT — lifestyle photo dominates bottom 60%, decorative band reduced to thin strip top. TOP 12% (THIN): small decorative illustrated band on pastel pink — a slim rainbow arc with scattered golden stars and rainbow confetti dots (minimal, not overwhelming), Baloo tag coral uppercase "KIDS REWARD COLLECTION" top-right corner small. MIDDLE 28%: centered Baloo BOLD 3-line coral headline "Turn Every Small Win / Into A Moment Kids / Remember." + italic Calligraphy smaller coral subhead "a handmade reward jar — crafted in Vietnam, loved at home". BOTTOM 60% (EXPANDED): large warm lifestyle hero photo — a small boy aged 5-6 holding the wooden reward jar (REAL BIRCH WOOD PHOTOGRAPHY, mason-jar silhouette, preserve exact token intricate design + rainbow lettering from reference) with both hands at his chest level. STRICT SCALE: jar ≈ 1/3 body height, jar covers ONLY his chest NOT his torso, jar smaller than his head. 3-4 rainbow tokens stuck on acrylic face. Mother in cream sweater softly out of focus behind boy. Warm morning light, cream linen wall background. ${GUARDS}`,
  },
  {
    id: 'planB_M2_3-second-ritual',
    refs: ['hero_lifestyle', 'hero_faceon'],
    prompt: `Amazon A+ content banner wide horizontal, warm positive storyboard on soft pastel pink-to-coral gradient background. DECORATION STRATEGY: Only MINIMAL pattern decorations — a few scattered golden stars + small polka dot clusters + 2-3 small rainbow arcs as accent pattern. NO token-dot trail, NO scattered numbered tokens outside the circles (they clutter the frame). Decorations are subtle background pattern only — not busy, not overwhelming. LEFT 40%: italic Calligraphy script large coral headline "The 3-Second Ritual", italic Calligraphy smaller subhead coral "Kid picks a token. Sticks it on. Smiles.", Baloo body caption coral "Every good choice becomes a tiny ceremony." RIGHT 60%: three vertically stacked CIRCULAR macro moments in soft rounded coral frames: (top circle) small child's hand hovering over scattered rainbow magnetic reward tokens (preserve intricate token pattern from reference, don't simplify), (middle circle) child's fingers pressing a single token onto the clear acrylic face of the wooden reward jar, (bottom circle) the jar on its easel with 5-6 tokens stuck, child's happy smile softly peeking in edge. All three shots warm morning light, tender tone. REAL WOOD PHOTOREALISTIC. Between circles: minimal decoration only — one small star cluster, one small polka dot spread. NO swirling token trail. ${GUARDS}`,
  },
  {
    id: 'planB_M3_handcrafted-proof',
    refs: ['hero_lifestyle', 'tokens_topview'],
    prompt: `Amazon A+ content banner wide horizontal, "Handcrafted. Not Mass-Produced." on warm birch wood grain background, workshop ambient light. TOP CENTER: Baloo BOLD coral headline "Handcrafted. Not Mass-Produced." THREE horizontal macro close-ups separated by thin coral dividers: (LEFT macro) an INDUSTRIAL CNC LASER-CUTTING MACHINE with visible RED laser beam tracing the mason-jar silhouette on birch plywood, metal gantry frame, blue LED indicator light, wisps of smoke — CNC machine, NOT handheld tool. Calligraphy italic caption "cut one at a time". (CENTER macro) ONE authentic reward token from the actual product, extreme close-up under a round magnifying glass. The token MUST match reference images exactly: circular sticker with a numeral (e.g., 6 or 7) in the center on a pastel pink/blue/yellow background, INTRICATE PRINTED PATTERN around the numeral — cartoon face OR donut OR checker OR star detail, NOT a plain pastel circle, NOT a simplified sticker, NOT an abstract rainbow medallion. The token is exactly as shown in reference images from the jar. Calligraphy italic caption "colors that don't fade". (RIGHT macro) the ACTUAL wooden reward jar shown face-on (mason-jar silhouette flat birch plywood frame, rainbow "REWARD JAR" lettering visible at the bottom curve, dozens of intricate numbered tokens behind clear acrylic panel matching reference exactly), with ONE rainbow magnetic token suspended mid-air close to the front acrylic face showing magnet grip. Jar realistic 6×8 inch scale, REAL wood photography NOT illustrated. Calligraphy italic caption "strong enough for tiny hands". BOTTOM Baloo stat bar coral "Kid-safe • Handmade in Vietnam • 52 tokens in every jar". ${GUARDS}`,
  },
  {
    id: 'planB_M5_gift-keepsake-cta',
    refs: ['hero_lifestyle', 'hero_faceon', 'tokens_topview'],
    prompt: `Amazon A+ content banner wide horizontal, SPLIT 55/45. LEFT 55% — gift-ready flat lay TOP-DOWN on a warm rustic wooden table surface (visible wood planks grain). Composition inspired by the listing slot: centered the wooden reward jar (REAL BIRCH WOOD PHOTOGRAPHY, mason-jar silhouette, preserve exact token intricate design + rainbow "REWARD JAR" lettering from reference). Around the jar: a small sticker sheet with colorful reward stickers top-left, cream printed 'Thank You' card with flower illustration top-right, a blank cream lined note card middle-right, 2-3 loose crayons left edge, a small potted succulent top-left corner. Below the jar: generous scattering of LOOSE rainbow magnetic reward tokens (preserve intricate numbered design from reference, numerals 1-9 with cartoon/pattern detail) arranged in a natural arc. A few golden star confetti pieces subtle. Calligraphy italic overlay coral "A gift today." REAL WOOD PHOTOREALISTIC, warm natural daylight, authentic handmade feel — match the aesthetic of real Amazon lifestyle photography. RIGHT 45% — solid coral gradient block. Baloo BOLD soft cream "A Keepsake Tomorrow." Baloo body small "Because the jar she fills with her first tokens is the same jar she'll show her own kids one day." Big rounded Baloo BOLD CTA button cream on coral "Start Rewarding Today →". 3 small Baloo trust badges row: ⭐ Handmade · 🎁 Gift-Ready · 🛡 Kid-Safe. Bottom flourish: small rainbow arc illustrated, echoes M1 opening. ${GUARDS}`,
  },
];

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);

  const uniqueRefKeys = [...new Set(TESTS.flatMap(t => t.refs))];
  console.log(`[PlanB-Fix] Uploading ${uniqueRefKeys.length} refs...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    refUrls[key] = await kie.uploadFromLocal(REF_CATALOG[key], 'product-refs', { maxSize: 768, quality: 85, format: 'jpeg' });
    console.log(`  [${key}] cached`);
  }

  console.log(`\n[PlanB-Fix] Regenerating ${TESTS.length} modules (M1, M2, M3, M5) in parallel...\n`);

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

  console.log('\n[PlanB-Fix] Summary:');
  for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.id}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[PlanB-Fix] ${passed}/${results.length} regen OK (M4 unchanged)`);
})();
