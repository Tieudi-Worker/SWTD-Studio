/**
 * Regen Teacher M1 Collection Hero — composite approach:
 * Pass M1 banner as layout template + 3 product hero refs for fidelity.
 * Model keeps background/text/pills, replaces products with exact ref copies.
 *
 * Runs both 16:9 and 21:9.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', 'api-keys.env') });
const fs = require('fs');
const path = require('path');
const { KieClient } = require('../utils/kie-client');

const DATA_ROOT = path.resolve(__dirname, '..', '..', 'data');
const OUT_16 = path.join(DATA_ROOT, 'TNTD180326_teacher_parent', 'output', 'aplus', 'test');
const OUT_21 = path.join(OUT_16, '21x9_native');

const REF_CATALOG = {
  m1_banner_16:  path.join(OUT_16, 'M1_collection-hero.jpg'),
  m1_banner_21:  path.join(OUT_21, 'M1_collection-hero 1 (1).jpg'),
  floral_hero:   path.join(DATA_ROOT, 'TNTD180326i744', 'output', 'Listing Final',            'MK TNTD180326i744 (1).png'),
  pencil_hero:   path.join(DATA_ROOT, 'TNTD180326i745', 'output', 'listing', 'Listing final', 'MK TNTD180326i745 (1).png'),
  stake_hero:    path.join(DATA_ROOT, 'TNTD180326i747', 'output', 'listing', 'Listing Final', 'MK TNTD180326i747 1.jpg'),
};

const COMPOSITE_PROMPT = `You are given a completed Amazon A+ banner layout AND three separate product reference photos. Your task is to REPLACE the product images inside the banner with EXACT faithful copies of the products from the reference photos, while keeping EVERYTHING ELSE in the banner untouched.

KEEP UNCHANGED: the headline text "Three Handcrafted Ways To Say Thank You, Teacher.", the subhead "A wooden keepsake collection for the end of every school year.", the three colored pill labels at the bottom ("FLORAL PLANT SIGN" / "BEST TEACHER EVER" / "FLOWER STAKE HOLDER"), all background surfaces, props (pencil, apple, terracotta pots, kraft envelope, flower petals), and overall warm cream lighting.

REPLACE the three products in-place with EXACT copies from the reference photos:

PRODUCT 1 — LEFT POSITION (currently in a terracotta pot with plant):
Replace with the EXACT Floral Plant Sign from reference: a ROUND wooden disc (approx 4-inch diameter). The UPPER HALF has a DENSE colorful floral UV-print pattern (bold orange, red, and teal flowers on white background — many overlapping petals, very vibrant and dense). The LOWER HALF is natural bare wood with a SCALLOPED BORDER dividing the floral from bare wood. Text on the lower half: "You're the reason We THRIVE!" in COLORFUL multi-color letters (each letter a different color — red, orange, teal, green) with "THRIVE!" being the largest word. Below that: "Love." in small script. A flat thin wooden STAKE extends straight DOWN from the bottom center. Copy the exact floral pattern density, the exact colorful multi-color letter styling, and the exact scalloped border from the reference. Keep the terracotta pot and plant from the banner layout.

PRODUCT 2 — CENTER POSITION (the card holder):
Replace with the EXACT Best Teacher Ever pencil-ribbon card holder from reference: a birch plywood RECTANGLE (approx 3.5 × 4.5 inches) with a softly SCALLOPED/WAVY TOP EDGE. At the top sits a 3D RAISED laser-cut PENNANT-SHAPED banner/ribbon — this is NOT a flat medal or simple badge, it is a STRETCHED PENNANT with a pointed tail on the right side. The pennant has YELLOW PENCIL-TIP ENDS on BOTH the left and right sides (bright yellow paint with small pink eraser accents at the tips). Text on the pennant reads: "BEST" in small letters vertically along the left pencil end, "TEACHER" in large dark-brown letters across the center, "EVER" on the right portion. Below the pennant on the front panel: laser-etched cursive "to" in the upper area and "from" below it (red/dark-brown ink). A 3D YELLOW PENCIL-HEART icon (a pencil bent into a heart outline) sits on the LOWER-RIGHT of the front panel. Copy the exact 3D raised pennant shape with pencil-tip ends from the reference photo — do NOT flatten it into a simple ribbon.

PRODUCT 3 — RIGHT POSITION (currently in a terracotta pot):
Replace with the EXACT Flower Stake Card Holder from reference: an elongated wooden stake with a decorative SCALLOPED-EDGE CLOUD/FLOWER-SHAPED wooden head panel at the top. The head has a WAVY PETAL BORDER (cloud-like scalloped silhouette, NOT a simple circle or oval). On the head panel: delicate WILDFLOWER ILLUSTRATION at the top (pink, red, yellow, orange, purple small flowers on stems — watercolor style), "Thank You" in large brown handwritten-style text below the flowers, "FOR HELPING ME GROW" in smaller brown uppercase text below that, and "FROM:............" with a dotted line at the bottom. The lower portion is a slim POINTED flat wooden stake inserted into the soil of the terracotta pot.

CRITICAL FOR PRODUCT 3:
- Do NOT show any gift card or Amazon card on/near this product. The product must appear CLEAN without any card — show only the wooden stake itself with its decorative flower head, fully visible from top to bottom.
- The wooden STAKE must be clearly visible going DOWN into the soil of the pot — the viewer should see the transition from wooden head → slim stake → soil.
- The terracotta pot MUST contain a LUSH GREEN PLANT with visible leaves (similar to the pothos plant in the left pot for Product 1). The flower stake is inserted among the green foliage, rising above the leaves. The pot should NOT be empty or only soil — it needs real greenery (a small succulent, trailing pothos, or leafy herb).
- Copy the exact scalloped/cloud petal border shape and the exact wildflower illustration style from the reference.

CRITICAL FIDELITY RULES:
- Each product must be a FAITHFUL COPY of its reference photo — same silhouette, same text, same decorative elements, same colors
- Do NOT reimagine, simplify, or modernize the products
- Do NOT swap elements between products
- Do NOT add text that is not in the reference
- The banner layout, pills, props, and lighting stay exactly as they are
- Products should sit naturally in their original positions within the banner scene

TYPOGRAPHY LOCK (R1 — FREDOKA): The headline "Three Handcrafted Ways To Say Thank You, Teacher." MUST be rendered in FREDOKA BOLD style — a ROUNDED, FRIENDLY, GEOMETRIC sans-serif display font with wide rounded terminals. The subhead "A wooden keepsake collection for the end of every school year." MUST be in HANDWRITTEN CALLIGRAPHY ITALIC style (Homemade Apple / Kalam / Caveat family). Do NOT use serif fonts, do NOT use traditional fonts, do NOT use Times New Roman or Garamond style. The text must match the same font family used in the other banners in this collection (M2-M5).

FRAMING RULE: All three products must be FULLY CONTAINED within the middle photo zone of the banner — between the headline/subhead text area at the top and the colored pill labels at the bottom. No product or any part of a product should overlap with, extend into, or break through the headline text area. Products stay BELOW the subhead line and ABOVE the pills. If a product is tall (like the plant sign or flower stake), scale it down slightly so it fits entirely within the middle zone.
`;

const JOBS = [
  {
    id: 'teacher_M1_composite_16x9',
    refs: ['m1_banner_16', 'floral_hero', 'pencil_hero', 'stake_hero'],
    aspectRatio: '16:9',
    outputDir: OUT_16,
    outputName: 'M1_collection-hero.jpg',
  },
  {
    id: 'teacher_M1_composite_21x9',
    refs: ['m1_banner_21', 'floral_hero', 'pencil_hero', 'stake_hero'],
    aspectRatio: '21:9',
    outputDir: OUT_21,
    outputName: 'M1_collection-hero.jpg',
  },
];

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);

  const uniqueRefKeys = [...new Set(JOBS.flatMap(j => j.refs))];
  for (const k of uniqueRefKeys) {
    if (!REF_CATALOG[k] || !fs.existsSync(REF_CATALOG[k])) {
      console.error(`[FAIL] Missing ref: ${k} -> ${REF_CATALOG[k]}`);
      process.exit(1);
    }
  }

  console.log(`[COMPOSITE] Uploading ${uniqueRefKeys.length} refs...`);
  const refUrls = {};
  for (const key of uniqueRefKeys) {
    refUrls[key] = await kie.uploadFromLocal(REF_CATALOG[key], 'product-refs', { maxSize: 1024, quality: 90, format: 'jpeg' });
    console.log(`  [${key}] cached`);
  }

  console.log(`\n[COMPOSITE] Generating 2 banners (16:9 + 21:9) in parallel...\n`);

  const results = [];
  await Promise.all(JOBS.map(async (j) => {
    const image_input = j.refs.map(k => refUrls[k]);
    const input = {
      prompt: COMPOSITE_PROMPT,
      image_input,
      resolution: '2K',
      aspect_ratio: j.aspectRatio,
      output_format: 'jpg',
    };
    try {
      const outPath = path.join(j.outputDir, j.outputName);
      const result = await kie.run('nano-banana-pro', input, 'image', j.id);
      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('no resultUrls');
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`download ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(outPath, buf);
      console.log(`  [${j.id}] OK ${Math.round(buf.length / 1024)}KB -> ${outPath}`);
      results.push({ id: j.id, ok: true });
    } catch (err) {
      console.error(`  [${j.id}] FAIL ${err.message}`);
      results.push({ id: j.id, ok: false, err: err.message });
    }
  }));

  console.log('\n[COMPOSITE] Summary:');
  for (const r of results) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.id}${r.ok ? '' : ' — ' + r.err}`);
  console.log(`\n[COMPOSITE] ${results.filter(r => r.ok).length}/${results.length} done`);
})();
