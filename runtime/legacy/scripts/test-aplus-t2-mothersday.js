/**
 * A+ Type 2 Multi-ASIN — Parent: Handprint Sign Mother's Day Collection
 * 6 variants: Heart Flower / To the moon / Handmade with love / Flower pot / MOM / Dough mixer.
 * Plan A Modular (default for Type 2).
 * Lifestyle-forward: every module features real Mom+Kid moments, not just product shots.
 *
 * Usage:
 *   node scripts/test-aplus-t2-mothersday.js                     # M1 precheck 16:9
 *   node scripts/test-aplus-t2-mothersday.js --full              # all 5 @ 16:9
 *   node scripts/test-aplus-t2-mothersday.js --full --ratio=21:9 # all 5 @ 21:9
 *   node scripts/test-aplus-t2-mothersday.js --only=M2,M3        # specific modules
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

// ═══ Ref catalog — 6 children × 3 shots each ═══
const REF_CATALOG = {
  // i286 — Heart Flower Pink
  heart_hero:    childRef('MK DTHG130225i286 - Heart Flower Pink',                   'M'),
  heart_action:  childRef('MK DTHG130225i286 - Heart Flower Pink',                   '2'),
  heart_display: childRef('MK DTHG130225i286 - Heart Flower Pink',                   '3'),
  // i290 — To the moon and back
  moon_hero:     childRef('MK TNHG200225i290 - To the moon and back handprint',      'M'),
  moon_action:   childRef('MK TNHG200225i290 - To the moon and back handprint',      '2'),
  moon_display:  childRef('MK TNHG200225i290 - To the moon and back handprint',      '3'),
  // i320 — Handmade with love
  love_hero:     childRef('MK TNHG210225i320 - Handmade with love',                  'M'),
  love_action:   childRef('MK TNHG210225i320 - Handmade with love',                  '2'),
  // i765 — Flower pot handprint
  pot_hero:      childRef('MK TNHG230326i765 - Flower pot handprint',                'M'),
  pot_action:    childRef('MK TNHG230326i765 - Flower pot handprint',                '2'),
  // i766 — MOM handprint
  mom_hero:      childRef('MK TNHG230326i766 - MOM handprint',                       'M'),
  mom_action:    childRef('MK TNHG230326i766 - MOM handprint',                       '2'),
  // i767 — Dough mixer handprint
  mixer_hero:    childRef('MK TNHG240326i767 - Dough mixer handprint',               'M'),
  mixer_action:  childRef('MK TNHG240326i767 - Dough mixer handprint',               '2'),
};

// ═══ Shared guards (R1-R4) ═══
const GUARDS = `
CRITICAL PRODUCT FIDELITY (R2 — COPY-MODE): The FIRST image in image_input is the REAL PRODUCT PHOTO. Treat it as a pixel-level template. Whenever a sign appears in this banner, copy it EXACTLY from its reference — do NOT redesign, stylize, or simplify the printed artwork. Each variant has its OWN distinct pre-printed design; do NOT mix motifs across variants.

MATERIAL LOCK (CRITICAL): Every sign is made of FOMEX — a white RIGID PVC FOAM BOARD (also called PVC sign board / Forex / Komatex). It is a THIN FLAT RIGID SHEET roughly 5 mm thick with a clean matte white surface, perfectly flat edges, slightly soft velvety appearance. The edge profile must look like foam board — uniform thin white cross-section, NO wood grain, NO canvas weave, NO canvas wrap around stretcher bars, NO deep wooden panel, NO gallery-wrap thickness. Do NOT render these as canvas, wood plaque, MDF, acrylic, or paper. They are PRINTED FOMEX SIGNS. Edge thickness roughly 5 mm — visibly thin when seen at an angle.

COMMON FORM FACTOR (all 6 variants share):
  • Portrait-orientation rectangular FOMEX board (approx 8 × 10 inches, ~5 mm thick), clean white matte face.
  • Pre-printed decorative artwork occupying most of the face (variant-specific — see per-variant anchors below).
  • A deliberately BLANK zone where a child's painted handprint has been pressed (shown as a printed handprint in the reference — preserve its color, position, and shape).
  • Pre-printed Mother's Day theme text (variant-specific quotes/poems in black or colored handwritten-style script).
  • A personalization field at the bottom showing a first name and/or year in cursive script.

PER-VARIANT FIDELITY ANCHORS:
  • HEART FLOWER PINK (i286): heart-shaped wreath of pink and red watercolor flowers with butterflies and small hearts. Pink/red handprint centered inside the heart. Black printed text above "TO THE WORLD, YOU ARE A MOM / BUT TO ME, YOU ARE THE WORLD". Black cursive "Happy Mother's Day" at bottom.
  • TO THE MOON AND BACK (i290): blue watercolor crescent moon on the left with clouds, scattered yellow stars. ORANGE/YELLOW handprint inside the moon's curve. Black printed text "I love you to the moon and back". Orange "HAPPY Mother's Day" with cursive at bottom.
  • HANDMADE WITH LOVE (i320): TWO handprints (LEFT = yellow, RIGHT = pink) positioned above a watercolor flower bouquet with pink ribbon. Black cursive "Handmade with love by" and personalized names (e.g. "Ciara, Cody") at bottom.
  • FLOWER POT (i765): red handprint rising like a flower bloom on a green stem, planted inside a cyan/teal flower pot with a heart showing year "2026". Pink heart with florals + "HAPPY MOTHER'S DAY!" text upper-right. Printed poem block on right. Name (e.g. "Laura") cursive at bottom.
  • MOM (i766): large pink "MOM" letters in floral-filled style, with the center "O" replaced by a pink handprint. Black printed text above "To the world you are one person / but to me you are the world". "Happy Mother's Day" cursive + "Love, [name]" at bottom.
  • DOUGH MIXER (i767): pink watercolor stand mixer on the left with clear mixing bowl below. RED handprint dropping into the bowl. Black handwritten "Happy Mother's Day" upper-right + floral flourish. Printed poem inside the bowl. Name (e.g. "Ciara") cursive at bottom.

NO EASEL RULE (CRITICAL — product does NOT include easels):
  The product is a FOMEX panel ONLY. It does NOT ship with any easel, tripod, or display stand. Do NOT render ANY wooden easel, mini tripod, pocket stand, kickstand, or display shelf anywhere a sign appears. Signs are shown leaning against props (gift box, vase, napkin, teacup, window frame, wall, each other), lying FLAT on a surface at a slight angle, held in hands (when a lifestyle human moment is explicitly required by the module), or shown face-on as a clean product photo. Zero wooden legs, zero dowels, zero easel shelves in the frame.

NO VARIANT-LABEL LEAK RULE (CRITICAL): The variant category words "HEART FLOWER PINK", "HEART FLOWER", "TO THE MOON", "TO THE MOON AND BACK", "HANDMADE WITH LOVE", "FLOWER POT", "MOM" (as a label), "DOUGH MIXER" MUST NOT appear as printed text ON any sign face. Those words only belong in banner pill labels / headlines / overlays — never printed onto the FOMEX product itself. The signs show ONLY their native printed text from reference (Mother's Day quote/poem + small personalization cursive name).

TEXT FIDELITY RULE (CRITICAL — render all printed text on signs legibly and in full per reference):
  • i286 Heart Flower Pink: "TO THE WORLD, YOU ARE A MOM / BUT TO ME, YOU ARE THE WORLD" above heart + "Happy Mother's Day" cursive below heart.
  • i290 To The Moon: "I love you to the moon and back" next to moon + "HAPPY Mother's Day" cursive at bottom.
  • i320 Handmade With Love: "Handmade with love by" + personalized names (e.g. "Ciara, Cody") below bouquet.
  • i765 Flower Pot: "HAPPY MOTHER'S DAY! I made this flower for you..." upper-right + small printed poem block on right + "Laura 2026" on pot.
  • i766 MOM: "To the world you are one person / but to me you are the world" above + "Happy Mother's Day, Love, [Name]" cursive below.
  • i767 Dough Mixer: "A CUP OF LOVE, A SPOONFUL OF CARE... THAT'S THE MAGIC THAT MAKES YOU, MOM." printed below mixer + "Happy Mother's Day, Ciara" cursive at bottom.

SCALE ANCHOR (R3): each FOMEX sign is about 8 × 10 inches — roughly the size of a standard sheet of letter paper, fits comfortably on a shelf or mom's desk. When held by a child (age 4-7), it covers their chest area. When held by an adult, fits in two hands. Do NOT oversize.

TYPOGRAPHY LOCK (R1 — FREDOKA): Strictly TWO font families for BANNER overlays (not the product's printed text). Font 1 = FREDOKA BOLD (rounded friendly geometric sans-serif display) for banner headlines, CTA, callouts, pill labels. Font 2 = HANDWRITTEN CALLIGRAPHY ITALIC (Homemade Apple / Sacramento / Caveat family) for banner subheads, emotional captions, ribbon labels. NO third font in banner overlays. The printed text ON the product itself stays in its native style (that is part of product fidelity).

VARIANT PARALLEL FIDELITY (R4): where multiple variants appear together, each keeps its OWN pre-printed design, handprint color/position, and message. Do NOT let one variant's motif bleed into another. Same FOMEX form factor (white PVC foam board, 8×10 portrait, ~5mm thick) across all variants.

NEGATIVE CONSTRAINTS:
  • Do NOT render banner layout instructions (percentages, zone labels, descriptive phrases) as visible text in the banner.
  • Do NOT duplicate ribbon labels, headlines, or any text string within the same banner.
  • Do NOT invent new Mother's Day messages — keep each variant's pre-printed message unchanged.
  • Do NOT change the printed handprint color per variant (pink stays pink, orange stays orange, red stays red).
  • Do NOT merge variants into a single sign.
  • Do NOT render signs as canvas, stretched canvas, wood plaque, MDF, acrylic, or paper — they are FOMEX.
  • Do NOT render ANY wooden easel, tripod, mini display stand, kickstand, or shelf.
  • Do NOT print variant category words onto any sign face.
  • Do NOT simplify or omit native printed text on signs — full quotes/poems and personalization names must render clearly.
`;

// ═══ Per-banner modules (Plan A Modular, lifestyle-forward) ═══
const MODULES = [
  {
    id: 'M1_collection-hero',
    refs: ['heart_hero', 'moon_hero', 'mom_hero', 'pot_hero', 'love_hero', 'mixer_hero'],
    prompt: `Amazon A+ Type 2 Plan A banner, wide horizontal composition. COLLECTION HERO for the Handprint Sign Mother's Day family.

TOP 28%: centered FREDOKA BOLD headline in deep rose-pink "#C03A58" on a soft warm-cream background: "Six Handprint Keepsakes. One Unforgettable Mother's Day." Below, smaller italic Calligraphy subhead in warm rose "pick the design that tells your mom's story — she paints the handprint, you paint the love".

MIDDLE 55%: full-width warm lifestyle HERO still-life on a sunlit cream linen tabletop near a bright window — NO people, NO hands, NO easels, props-only. ALL SIX FOMEX signs MUST be visible and clearly distinguishable — this is a 6-SIGN composition, not 5, not 4. Arrange left-to-right in a slightly staggered single wide row so every sign's face is visible:
  1) LEFT (front): Heart Flower Pink i286 — heart wreath + pink handprint inside + "TO THE WORLD YOU ARE A MOM..." — leaning against a folded cream linen napkin.
  2) LEFT-CENTER (back): To The Moon And Back i290 — blue crescent moon + clouds + ORANGE/YELLOW handprint inside + stars + "I love you to the moon and back" — leaning against the pink-and-white peony vase.
  3) CENTER-LEFT (front): Handmade With Love i320 — yellow + pink handprints above bouquet with pink ribbon + "Handmade with love by Ciara, Cody" — leaning against a small kraft gift box.
  4) CENTER-RIGHT (back, slightly raised on the gift box): MOM handprint i766 — floral pink MOM letters + handprint replacing center O + "To the world you are one person..." + "Love, Darya".
  5) RIGHT-CENTER (front): Flower Pot i765 — red handprint-flower + green stem + teal pot + "2026" + "HAPPY MOTHER'S DAY!" + "Laura" — leaning against a small ceramic teacup.
  6) RIGHT (back): Dough Mixer i767 — pink stand mixer + clear bowl + red handprint in bowl + poem + "Happy Mother's Day, Ciara" — leaning against the window frame.
All six signs are white matte FOMEX (thin rigid PVC foam board, visible ~5 mm flat edges, no canvas wrap, no wood grain). Surrounding props: the peony vase upper-left, a cream envelope with pink wax seal, two small watercolor paint pots (pink + red), a kid's paintbrush laid flat, scattered rose petals, loose wildflower stems. Warm golden morning light from the upper-left, soft domestic bokeh. STRICTLY NO WOODEN EASELS, NO TRIPODS, NO STANDS, NO HUMAN FIGURES, NO HANDS, NO ARMS, NO FINGERS in the frame. If any of the 6 signs is missing or merged, it is a FAILURE.

BOTTOM 17%: FREDOKA BOLD product-family strip — six small rounded pills horizontal, each in its variant's accent color, spaced evenly under the signs:
  "HEART FLOWER" (pink #E94B72) · "TO THE MOON" (navy-blue #3A4F8E) · "HANDMADE WITH LOVE" (yellow-pink #E8C04D) · "FLOWER POT" (teal #48B5C4) · "MOM" (rose #C03A58) · "DOUGH MIXER" (soft rose #D97E8E). Each pill FREDOKA BOLD uppercase white text.

All six variants preserve exact printed-artwork fidelity per their references. Warm emotional Mother's Day mood. ${GUARDS}`,
  },
  {
    id: 'M2_pain-promise',
    refs: ['moon_hero', 'moon_action', 'moon_display'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal, SPLIT 50/50 umbrella-story module featuring the "To The Moon And Back" variant as the emotional anchor.

The LEFT half shows a slightly desaturated warm scene — a mother in her 30s sitting alone at her kitchen table on Mother's Day morning, soft sunlight through the window behind her. On the table in front of her: a generic bouquet of supermarket flowers still wrapped in plastic, a store-bought card with a pre-printed message, and a small gift bag she hasn't opened. Her hand rests gently on the card, expression quietly wistful — not sad, just... expecting the usual. FREDOKA BOLD overlay in deep rose-pink "Every Mother's Day, The Same Flowers. The Same Card." Calligraphy italic subhead smaller in warm rose "she'd trade them all for something made by little hands."

A soft cream dividing seam with a small warm arrow transitions the viewer from LEFT to RIGHT.

The RIGHT half shows a warm saturated transformation scene — the SAME mother now smiling softly as her young child (age 4-6) proudly holds the completed "To The Moon And Back" FOMEX sign UP in both small hands toward mom (i290: preserve EXACTLY from reference — blue crescent moon with clouds, orange/yellow child-sized handprint inside the moon's curve, scattered yellow stars, black printed "I love you to the moon and back", orange "HAPPY Mother's Day" cursive at bottom). The sign is a thin white matte FOMEX panel (~5 mm thick, flat edges, no easel, no wooden stand, no tripod) held directly in the child's hands. Mom's eyes crinkle with genuine emotion. A cup of tea steams on the table, a small bowl of strawberries beside it. Warm morning light, soft out-of-focus kitchen in the background. FREDOKA BOLD overlay in deep rose-pink "A Handprint She'll Frame Forever." Calligraphy italic caption in warm rose "the gift she didn't know she needed."

${GUARDS}`,
  },
  {
    id: 'M3_variant-matrix',
    refs: ['heart_hero', 'moon_hero', 'love_hero', 'pot_hero', 'mom_hero', 'mixer_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal, PRODUCT MATRIX comparison grid — 2 rows × 3 columns = 6 cells on a warm cream background with very faint watercolor florals at 6% opacity.

TOP 13%: FREDOKA BOLD headline centered in deep rose-pink "Six Designs. One Mom Who Deserves All Of Them." Small italic Calligraphy subhead below in warm rose "find the quote, the color, the story that fits your family".

MIDDLE 74%: 2 × 3 grid with thin rose-pink divider lines. Each cell contains, top-to-bottom:
  • TOP: the variant FOMEX sign photographed face-on upright as a clean product shot (no easel, no tripod, no stand — just the thin matte white FOMEX panel slightly floating with a soft drop-shadow) on a clean cream backdrop with a faint watermark of its signature motif (heart wreath / moon / flower bouquet / flower pot / MOM letters / mixer — 8% opacity).
  • MIDDLE: FREDOKA BOLD variant title in its accent color (this title lives in the banner layout, NOT printed on the sign face).
  • BOTTOM: 2-line italic Calligraphy spec list (theme-line · best-for).

TOP ROW LEFT (pink accent): Heart Flower Pink i286 — preserve EXACTLY from reference (heart-shaped pink/red floral wreath + butterflies + pink handprint centered + "TO THE WORLD YOU ARE A MOM..." text). Title "HEART FLOWER PINK". Specs: "For the romantic mom · Hearts & flowers & first love".
TOP ROW CENTER (navy-blue accent): To The Moon i290 — preserve EXACTLY (blue crescent moon + clouds + orange handprint inside + scattered stars + "I love you to the moon and back"). Title "TO THE MOON". Specs: "For the dreamy mom · Bedtime stories & lullabies".
TOP ROW RIGHT (yellow-pink accent): Handmade With Love i320 — preserve EXACTLY (two handprints yellow+pink above a flower bouquet with pink ribbon). Title "HANDMADE WITH LOVE". Specs: "For the gardener mom · Two little hands, one bouquet".
BOTTOM ROW LEFT (teal accent): Flower Pot i765 — preserve EXACTLY (red handprint as flower on green stem in teal flower pot with year heart + poem block). Title "FLOWER POT". Specs: "For the nurturing mom · She helps us bloom".
BOTTOM ROW CENTER (rose accent): MOM handprint i766 — preserve EXACTLY (pink floral MOM letters, center O replaced by pink handprint, "To the world you are one person..." text). Title "MOM". Specs: "For the everyday hero mom · She is the world".
BOTTOM ROW RIGHT (soft rose accent): Dough Mixer i767 — preserve EXACTLY (pink stand mixer + red handprint into bowl + mixing poem). Title "DOUGH MIXER". Specs: "For the baking mom · Love is the secret ingredient".

BOTTOM 13%: FREDOKA BOLD sub-strip centered in deep rose-pink on cream: "All handcrafted · Paint kit ready · Name personalization included".

All six variants keep their OWN pre-printed artwork — do not merge. ${GUARDS}`,
  },
  {
    id: 'M4_decision-guide',
    refs: ['heart_hero', 'moon_hero', 'pot_hero', 'mom_hero', 'mixer_hero', 'love_hero'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal, DECISION GUIDE module on a soft cream-to-pale-rose gradient background with very subtle scattered watercolor petals at 5% opacity.

TOP 11%: FREDOKA BOLD headline centered in deep rose-pink "Which Mom Is Your Mom?" Small italic Calligraphy subhead in warm rose "match her love language to the design that tells her story".

MIDDLE 78%: SIX persona cards laid out in 2 rows × 3 columns (matching M3 matrix positions for visual continuity). Each card:
  • TOP third: italic Calligraphy persona quote in warm rose (2 lines max, quoted with soft quote-marks).
  • MIDDLE third: FREDOKA BOLD rose-pink arrow "→" plus a small clear thumbnail product photo of the corresponding variant FOMEX sign shown face-on as a clean floating panel with soft drop-shadow (no easel, no stand, approx 1/3 card width, still legible).
  • BOTTOM third: FREDOKA BOLD product recommendation line in the variant's accent color.

CARD TOP-LEFT (pink): Quote "My mom still tears up at wedding photos and grandma's old love letters." → thumbnail Heart Flower Pink i286 → "HEART FLOWER PINK".
CARD TOP-CENTER (navy): Quote "She read us the same bedtime story for ten years straight." → thumbnail To The Moon i290 → "TO THE MOON AND BACK".
CARD TOP-RIGHT (yellow-pink): Quote "Her garden outperforms every neighbor's, every spring." → thumbnail Handmade With Love i320 → "HANDMADE WITH LOVE".
CARD BOTTOM-LEFT (teal): Quote "She spent the whole pandemic teaching us about succulents." → thumbnail Flower Pot i765 → "FLOWER POT".
CARD BOTTOM-CENTER (rose): Quote "She says 'love you' when she hangs up, every single call." → thumbnail MOM handprint i766 → "MOM".
CARD BOTTOM-RIGHT (soft rose): Quote "Her kitchen smells like bread and cinnamon on Sunday mornings." → thumbnail Dough Mixer i767 → "DOUGH MIXER".

BOTTOM 11%: FREDOKA BOLD CTA hint centered in deep rose-pink: "Still not sure? Start with the MOM sign — it fits any mom in any home."

All six thumbnails preserve EXACT variant artwork per their references. ${GUARDS}`,
  },
  {
    id: 'M5_collection-cta',
    refs: ['mom_hero', 'moon_hero', 'pot_hero', 'heart_display'],
    prompt: `Amazon A+ Type 2 banner, wide horizontal, closing COLLECTION CTA module SPLIT 55/45.

LEFT 55% — gift-ready warm lifestyle FLAT LAY shot from a slight 3/4 top-down angle on a cream linen tablecloth with soft scattered dried rose petals. FOUR FOMEX signs arranged as if the buyer has ordered a few for different moms in the family — NO easels, NO stands, NO human hands: MOM handprint i766 lying flat-angled slightly-left atop a small kraft gift box tied with jute twine (the box has a pink wax seal), To The Moon i290 leaning upper-left against a small vase of pink peonies, Flower Pot i765 lying flat on the tablecloth lower-left beside a kid's paint palette and small paintbrush, and Heart Flower Pink i286 to the right propped against a folded cream linen napkin with a small sprig of eucalyptus. All signs are thin white matte FOMEX panels (~5 mm flat edges, no canvas, no wood). Scattered soft props: a cream envelope addressed in cursive "For Mom", a small teacup with steam, two watercolor paint pots (pink + red), a few loose wildflower stems. Warm late-morning golden light from the upper-left, soft domestic bokeh. Italic Calligraphy overlay in deep rose-pink in the upper-left corner "Handprints that outlast flowers."

RIGHT 45% — solid DEEP ROSE-PINK accent block "#C03A58". FREDOKA BOLD cream headline at the top "One Design Per Mom. Endless Love Per Handprint." FREDOKA body text smaller in cream: "For the mom who hangs every drawing on the fridge. For the grandma who kept your 1st-grade art project. For the mom-in-law who still calls on birthdays. Each sign is handcrafted, pre-printed, and ready for your child's paint + handprint — finished in our Vietnam workshop." Dual rounded-rectangle CTAs stacked: (1) cream background deep-rose-pink FREDOKA BOLD text "Shop The Collection →" on top; (2) soft-rose background cream FREDOKA BOLD text "Start With Best-Seller →" below. Bottom: three small cream FREDOKA BOLD trust badges horizontal: "⭐ Handmade  ·  🎁 Mother's Day Ready  ·  ✏ Name Personalized".

All four visible variants preserve exact fidelity. No duplicated text. ${GUARDS}`,
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

  console.log(`[T2-MOTHERSDAY] Mode: ${isFullRun ? 'FULL 5' : onlyModule ? `ONLY ${onlyModule}` : 'PRECHECK M1 only'} | Ratio: ${aspectRatio} | Out: ${OUT_DIR}`);
  console.log(`[T2-MOTHERSDAY] Uploading ${uniqueRefKeys.length} unique refs (high-res)...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    // All refs are real product photos → high-res upload per learned HMA rule.
    refUrls[key] = await kie.uploadFromLocal(REF_CATALOG[key], 'product-refs', { maxSize: 2048, quality: 95, format: 'jpeg' });
    console.log(`  [${key}] cached`);
  }

  console.log(`\n[T2-MOTHERSDAY] Generating ${toRun.length} banner(s) in parallel (nano-banana-pro, 2K, ${aspectRatio})...\n`);

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

  console.log('\n[T2-MOTHERSDAY] Summary:');
  for (const r of results) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.id}${r.ok ? '' : ' — ' + r.err}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[T2-MOTHERSDAY] ${passed}/${results.length} banners generated`);
  console.log(`[T2-MOTHERSDAY] Output: ${OUT_DIR}`);
})();
