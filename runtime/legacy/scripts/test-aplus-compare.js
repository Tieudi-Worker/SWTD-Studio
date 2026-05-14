/**
 * A+ Plan Comparison Test v3 — SKU TNTD180326i750 Reward Jar
 *
 * Gen 10 banners (5 Plan A modular + 5 Plan B storyboard) with:
 *   R1 — Typography lock (Baloo Bold + Calligraphy italic, strictly 2 fonts)
 *   R2 — Product fidelity F1-F8 (no reimagine, process shots precise)
 *   R3 — Scale anchor (6x8in book-size, realistic proportion vs human)
 *   R4 — Per-banner ref selection (each module picks refs suited to its visual need)
 *
 * Output: data/TNTD180326i750/output/aplus/test/
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', 'api-keys.env') });
const fs = require('fs');
const path = require('path');
const { KieClient } = require('../utils/kie-client');

const SKU_ROOT = path.resolve(__dirname, '..', '..', 'data', 'TNTD180326i750');
const OUT_DIR = path.join(SKU_ROOT, 'output', 'aplus', 'test');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ═══ Ref catalog — named roles for per-banner selection ═══
const REF_CATALOG = {
  hero_faceon:       path.join(SKU_ROOT, 'input', 'product', '20260406_143301.jpg'),   // Flat face-on, clean silhouette + tokens overview
  tokens_topview:    path.join(SKU_ROOT, 'input', 'product', '20260406_143209.jpg'),   // Top-down front, tokens + rainbow band visible
  hero_lifestyle:    path.join(SKU_ROOT, 'input', 'product', '20260406_143529.jpg'),   // Jar on easel + loose tokens scattered (lifestyle + magnetic feature)
  edge_thickness:    path.join(SKU_ROOT, 'input', 'product', '20260406_143237.jpg'),   // 3/4 angle showing 2-layer edge thickness
};

// ═══ R1 + R2 + R3 safeguards (shared) ═══
const GUARDS = `
CRITICAL PRODUCT FIDELITY (R2): The wooden reward jar must render EXACTLY as shown in the reference images — a FLAT frame cut in the silhouette of a classic mason jar (NOT a 3D container). Preserve: the rainbow "REWARD JAR" lettering band along the bottom curve, dozens of colorful numbered reward tokens (intricate printed designs on pastel pink/blue/yellow/orange/green circles, numerals 1-9) UV-printed behind a clear acrylic panel, the separate laser-cut wooden easel stand. DO NOT redesign, reimagine, or simplify the token graphic. DO NOT alter the jar silhouette.

SCALE ANCHOR (R3): The reward jar is 6 × 8 inches (15 × 20 cm) — the size of a hardcover book, thin profile ~10mm. Realistic proportions: when held by a child aged 4-7, the jar covers ONLY their chest area (NOT their whole torso). When on a desk beside a 13-inch laptop, the jar is about 1/3 to 1/2 the laptop's width. In an adult's two hands, the jar fits comfortably. DO NOT render the product oversized.

TYPOGRAPHY LOCK (R1): Strictly TWO font families throughout this banner — no more, no less. Font 1 = BALOO 2 BOLD style: rounded, friendly, modern sans-serif display (coral #F4735F or soft white) for all headlines, big promise text, CTA buttons, callout numbers (01-05), stat bars. Font 2 = HANDWRITTEN CALLIGRAPHY ITALIC style (Kalam / Caveat / Homemade Apple family) for accent captions, subheadlines, emotional flourishes, ribbon labels. NO third font. NO traditional serif. NO Helvetica.
`;

const TESTS = [
  // ═══════════════════════════════════════════════════════════════
  //  PLAN A — MODULAR FORMULA
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'planA_M1_hero-promise',
    refs: ['hero_faceon', 'tokens_topview'],
    prompt: `Amazon A+ content banner, wide horizontal composition, SPLIT layout. LEFT 40%: coral-to-pastel-pink vertical gradient background with subtle star confetti, overlaid with big BOLD Baloo headline "Turn Every Small Win Into A Moment Kids Remember" (warm white on coral), italic Calligraphy subhead "a handmade reward jar for daily behavior growth", small tag bottom in Baloo "Handmade in Vietnam". RIGHT 60%: full-bleed lifestyle photo — a warm mother in her 30s in a cream knit sweater kneeling next to a smiling boy aged 5-6 in striped shirt, the boy is HOLDING the wooden reward jar with both hands at his chest level. IMPORTANT SCALE: the jar covers ONLY his chest area (NOT his whole torso, NOT larger than his face-to-belly), realistic 6x8 inch book-size — reference the exact jar silhouette from images. 3-4 rainbow tokens already stuck on the jar's clear acrylic face, warm morning window light, bright bedroom softly blurred with rainbow rug and bookshelf. ${GUARDS}`,
  },
  {
    id: 'planA_M2_pain-solution',
    refs: ['hero_lifestyle', 'hero_faceon'],
    prompt: `Amazon A+ content banner, wide horizontal composition, SPLIT into two equal halves. LEFT HALF: slightly desaturated living room scene, a tired mother in gray t-shirt kneeling on rug with scattered wooden blocks and toys around her, small boy in background turning away, muted cool tones; Baloo BOLD overlay top "Nagging. Repeating. Frustration." in soft white. SMALL coral arrow transitions to right half. RIGHT HALF: warm saturated scene, the same mother now smiling watching her boy (age 5) gently place a rainbow magnetic token onto the clear acrylic face of the wooden reward jar standing on a warm oak kid's desk (jar on its laser-cut wooden easel stand, loose rainbow tokens scattered on the desk surface in front). CRITICAL SCALE: the jar is 6x8 inches — about half the width of a laptop, the boy's hand touches only one corner of the jar face, NOT bigger than his head. Bright morning light, warm pastel bedroom bokeh; Baloo overlay text "A jar. A token. A smile." in coral. Calligraphy italic caption "every good choice, a tiny ceremony". ${GUARDS}`,
  },
  {
    id: 'planA_M3_whats-in-box',
    refs: ['hero_lifestyle', 'edge_thickness', 'hero_faceon'],
    prompt: `Amazon A+ content banner, wide horizontal composition, "WHAT'S IN THE BOX" feature-callout infographic on soft pastel pink and lavender gradient background with subtle scattered star decorations. CENTER: the wooden reward jar displayed flat head-on (preserve flat mason-jar silhouette, intricate rainbow token design behind clear acrylic, rainbow "REWARD JAR" lettering at bottom, laser-cut wooden easel stand beside). AROUND the jar, FIVE UNIQUE rounded-square white callout cards with coral Baloo-bold numbered headers appearing EXACTLY ONCE each: 01, 02, 03, 04, 05. Card 01 — macro of 2-layer birch plywood edge visible at the jar side + label "3-Layer Birch Plywood / kid-safe smooth edges". Card 02 — macro of clear acrylic face with printed tokens + label "UV-Printed Rainbow Tokens / fade-free vibrant colors". Card 03 — pile of loose rainbow magnetic tokens + label "52 Magnetic Tokens Included / durable and easy to stick". Card 04 — laser-cut wooden easel stand detail + label "Easel Stand / stands on any desk". Card 05 — cream thank-you card + kraft envelope + label "Ready-to-Gift Packaging". Thin coral connector lines link cards to the jar. Top of banner: Baloo BOLD headline "WHAT'S IN THE BOX" in coral. Each numeral 01-05 appears only one time total. ${GUARDS}`,
  },
  {
    id: 'planA_M4_use-case-narrative',
    refs: ['hero_faceon', 'tokens_topview'],
    prompt: `Amazon A+ content banner, wide horizontal composition, "One Jar. Four Ways To Grow Better Kids." — 4 vertical columns of equal width on soft pastel cream background with thin coral dividers. Top Baloo BOLD headline spans full width in coral. In EVERY column, the reward jar must appear with the EXACT SAME silhouette and SAME rainbow "REWARD JAR" band and tokens (use the reference images as single source of truth — do not vary the jar design between panels). COLUMN 1 "POTTY TRAINING": toddler girl age 3 with mom in bathroom, the jar HANGING on the wall at her reach height (jar realistic 6x8 inch size — about the height of a small hand towel), she reaches up to stick a token. Calligraphy italic "make milestones fun". COLUMN 2 "HOMEWORK": boy age 7 at wood desk, jar standing on the desk beside an open notebook (jar about half the width of a laptop). Calligraphy italic "reward consistency". COLUMN 3 "CHORES": family kitchen scene, jar on a fridge door (jar about the height of a letter-size paper), girl age 5 helping with dishes. Calligraphy italic "build daily habits". COLUMN 4 "CLASSROOM": elementary classroom, teacher's desk with the jar displayed (jar about the size of a small desk organizer), children raising hands. Calligraphy italic "celebrate class wins". Each column's label uppercase Baloo bold coral below the scene. ${GUARDS}`,
  },
  {
    id: 'planA_M5_handmade-cta',
    refs: ['hero_lifestyle', 'hero_faceon'],
    prompt: `Amazon A+ content banner, wide horizontal composition, SPLIT 60/40. LEFT 60%: handmade authenticity. TOP HALF: warm workshop table, an artisan's hands (warm skin tone, no face) carefully fitting the UV-printed clear acrylic token panel into the birch plywood mason-jar-shape frame, visible tools (ruler, sandpaper, wood shavings). BOTTOM HALF: open kraft gift box with cream tissue paper cradling the finished reward jar (realistic 6x8 inch size fits snugly in a hardcover-book-sized box), printed cream thank-you card with pressed flowers beside it, a few loose rainbow tokens scattered. Baloo BOLD headline "Handcrafted. Wrapped. Ready To Give." in coral. Calligraphy italic caption "checked by human hands before it ships". RIGHT 40%: solid coral background block. Calligraphy italic "A gift today." on top. Baloo BOLD "A keepsake tomorrow." below. Short Baloo body "Because the jar she fills with her first tokens is the same jar she'll show her own kids one day." Big rounded-rectangle Baloo BOLD CTA button in soft white on coral "Start Rewarding Today →". Three small trust badges in row: ⭐ Handmade / 🎁 Gift-Ready / 🛡 Kid-Safe. ${GUARDS}`,
  },
  // ═══════════════════════════════════════════════════════════════
  //  PLAN B — STORYBOARD SEAMLESS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'planB_M1_open-scene',
    refs: ['hero_faceon', 'tokens_topview'],
    prompt: `Amazon A+ content banner, wide horizontal composition, OPEN SCENE storybook narrative. TOP 25%: decorative illustrated band on pastel pink gradient — rainbow arc across the top, scattered golden stars and rainbow confetti dots, small Baloo tag in coral uppercase "KIDS REWARD COLLECTION". MIDDLE 50%: center-aligned Baloo BOLD 3-line headline in coral "Turn Every Small Win / Into A Moment Kids / Remember." Italic Calligraphy subhead in softer coral "a handmade reward jar — crafted in Vietnam, loved at home". BOTTOM 25%: warm lifestyle hero — a small boy aged 5-6 holding the wooden reward jar with both hands at chest level. CRITICAL SCALE: the jar covers only his chest width, NOT wider than his shoulders, realistic 6x8 inch book-size. Rainbow tokens already stuck on, proud little smile, mother in cream sweater softly out of focus behind, warm morning light, cream linen wall background. A trail of rainbow token dots and mini rainbow arcs flows diagonally from top-right confetti down through the middle headline into the hero photo bottom-left. ${GUARDS}`,
  },
  {
    id: 'planB_M2_3-second-ritual',
    refs: ['hero_lifestyle', 'hero_faceon'],
    prompt: `Amazon A+ content banner, wide horizontal composition, warm positive storyboard on soft pastel pink-to-coral gradient with scattered rainbow token dots and golden star confetti flowing diagonally top-left to bottom-right. LEFT 40%: italic Calligraphy script headline "The 3-Second Ritual" large coral, italic Calligraphy subhead smaller "Kid picks a token. Sticks it on. Smiles.", Baloo body caption "Every good choice becomes a tiny ceremony." RIGHT 60%: three vertically stacked CIRCULAR macro moments in soft rounded coral frames: (top circle) a small child's hand hovering over scattered rainbow magnetic reward tokens (preserve intricate token design exactly from reference — do not simplify), (middle circle) child's fingers pressing a single token onto the clear acrylic face of the wooden reward jar, (bottom circle) the jar on its easel with 5-6 tokens stuck at varied playful angles, child's happy smile softly peeking from edge. All three shots: warm morning light, tender tone, NO darkness. Rainbow token dots + star confetti + mini rainbow arcs trail connects the three circles and loops back to the left text. Jar scale realistic throughout. ${GUARDS}`,
  },
  {
    id: 'planB_M3_handcrafted-proof',
    refs: ['hero_lifestyle'],
    prompt: `Amazon A+ content banner, wide horizontal composition, "Handcrafted. Not Mass-Produced." on warm birch wood grain background with workshop ambient light. TOP CENTER: Baloo BOLD coral headline "Handcrafted. Not Mass-Produced." THREE horizontal macro close-ups separated by thin coral divider lines: (LEFT macro) an INDUSTRIAL CNC LASER-CUTTING MACHINE with a visible RED laser beam tracing the mason-jar silhouette on birch plywood, metal gantry frame, blue LED indicator light, small wisps of smoke — this must be a CNC laser cutter machine, NOT a handheld woodburning tool, NOT pyrography, NOT soldering iron. Calligraphy italic caption "cut one at a time". (CENTER macro) a single rainbow reward token from the product (preserve EXACT intricate printed design from reference image — numerals on pastel colored circles with detailed patterns) seen extreme close-up under a round magnifying glass, crystal-clear UV ink detail. Calligraphy italic caption "colors that don't fade". (RIGHT macro) a rainbow magnetic token suspended mid-air being pulled by the magnet behind the clear acrylic face of the wooden reward jar, the jar shown face-on at realistic 6x8 inch scale, rainbow "REWARD JAR" band visible at bottom, tokens behind acrylic preserved. Calligraphy italic caption "strong enough for tiny hands". BOTTOM small centered Baloo stat bar coral "Kid-safe • Handmade in Vietnam • 52 tokens in every jar". ${GUARDS}`,
  },
  {
    id: 'planB_M4_milestones-pride',
    refs: ['hero_faceon', 'hero_lifestyle', 'tokens_topview'],
    prompt: `Amazon A+ content banner, wide horizontal composition, emotional milestone storyboard on warm cream background with scattered rainbow token dots and star confetti. TOP: Baloo BOLD coral headline "Raising kids who want to do the right thing." THREE horizontal family vignettes separated by soft coral ribbon dividers. In ALL three vignettes the reward jar must have the IDENTICAL silhouette + rainbow "REWARD JAR" band + token pattern (use reference images as single source of truth — do NOT vary jar design between vignettes). (LEFT vignette) warm morning bedroom, a small girl age 4 in pajamas proudly sticking a token on the reward jar hanging on her wall (jar at her chest level, realistic 6x8 inch book-size), mom kneeling smiling. Calligraphy italic ribbon label "First Dry Night". (CENTER vignette) bright playroom, two siblings a boy age 6 and girl age 4 standing beside the reward jar on a low shelf (jar normal book-size), both reaching to stick a shared token, mom clapping in background. Calligraphy italic ribbon label "Shared Without Being Asked" appearing ONCE only, not duplicated. (RIGHT vignette) a kid's study desk in afternoon light, boy age 7 closing a completed homework notebook and sticking a token on the jar standing on the desk (jar about half a laptop width), small triumphant smile. Calligraphy italic ribbon label "Homework Done Proud". Rainbow token trail weaves between the three vignettes. Each ribbon label appears exactly once. ${GUARDS}`,
  },
  {
    id: 'planB_M5_gift-keepsake-cta',
    refs: ['hero_lifestyle', 'hero_faceon'],
    prompt: `Amazon A+ content banner, wide horizontal composition, closing module SPLIT 55/45. LEFT 55% — gift-ready flat lay on warm oak plank top-down: the wooden reward jar centered slightly left (realistic 6x8 inch book-size, preserve silhouette + rainbow band + token design from reference), laser-cut wooden easel stand laid beside, open kraft gift box with cream tissue paper spilling upper-left, cream printed thank-you card with pressed flowers bottom-left, scattered rainbow magnetic reward tokens across the plank (preserve intricate token design), a small stubby pencil, a kraft envelope with a rainbow wax seal, golden star confetti pieces. Calligraphy italic caption overlay "A gift today." in coral. RIGHT 45% — solid coral gradient block. Baloo BOLD headline "A Keepsake Tomorrow." in soft cream. Baloo body small "Because the jar she fills with her first tokens is the same jar she'll show her own kids one day." Big rounded-rectangle Baloo BOLD CTA button in cream on coral: "Start Rewarding Today →". Below the button, 3 small Baloo trust badges horizontal: ⭐ Handmade  ·  🎁 Gift-Ready  ·  🛡 Kid-Safe. Bottom flourish: a rainbow arc illustrated echoing the opening module, closing the storybook loop. ${GUARDS}`,
  },
];

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);

  // Dedup + upload all unique refs used across tests
  const uniqueRefKeys = [...new Set(TESTS.flatMap(t => t.refs))];
  console.log(`[TEST v3] Uploading ${uniqueRefKeys.length} unique ref images...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    const localPath = REF_CATALOG[key];
    if (!localPath) throw new Error(`Unknown ref key: ${key}`);
    refUrls[key] = await kie.uploadFromLocal(localPath, 'product-refs', { maxSize: 768, quality: 85, format: 'jpeg' });
    console.log(`  [${key}] ${path.basename(localPath)} -> cached`);
  }

  console.log(`\n[TEST v3] Generating ${TESTS.length} banners in parallel (16:9, 2K, per-banner refs)...\n`);

  const results = [];
  await Promise.all(TESTS.map(async (t) => {
    const image_input = t.refs.map(k => refUrls[k]);
    const input = {
      prompt: t.prompt,
      image_input,
      resolution: '2K',
      aspect_ratio: '16:9',
      output_format: 'jpg',
    };

    try {
      const outputPath = path.join(OUT_DIR, `${t.id}.jpg`);
      const result = await kie.run('nano-banana-pro', input, 'image', t.id);
      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('no resultUrls');
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error(`download failed: ${imageResponse.status}`);
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      console.log(`  [${t.id}] ✓ ${Math.round(buffer.length / 1024)}KB  refs=[${t.refs.join(',')}]`);
      results.push({ id: t.id, ok: true });
    } catch (err) {
      console.error(`  [${t.id}] ✗ ${err.message}`);
      results.push({ id: t.id, ok: false, err: err.message });
    }
  }));

  console.log('\n[TEST v3] Summary:');
  for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.id}${r.ok ? '' : ' — ' + r.err}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[TEST v3] ${passed}/${results.length} banners generated`);
  console.log(`[TEST v3] Output: ${OUT_DIR}`);
})();
