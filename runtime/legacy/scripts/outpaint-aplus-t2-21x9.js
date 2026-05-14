/**
 * Outpaint 16:9 → 21:9 cho bộ A+ Type 2 COACH.
 * Pipeline: sharp pad canvas (white edges) → nano-banana-pro fills edges → seamless 21:9.
 *
 * Input : data/TNTD250326i769_parent/output/aplus/test/M{1..5}_*.jpg (16:9)
 * Output: data/TNTD250326i769_parent/output/aplus/test/21x9/M{1..5}_*.jpg
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', 'api-keys.env') });
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { KieClient } = require('../utils/kie-client');

const SRC_DIR = path.resolve(__dirname, '..', '..', 'data', 'TNTD250326i769_parent', 'output', 'aplus', 'test');
const OUT_DIR = path.join(SRC_DIR, '21x9');
const TMP_DIR = path.join(SRC_DIR, '_tmp_padded');
for (const d of [OUT_DIR, TMP_DIR]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

const BANNERS = [
  'M1_collection-hero.jpg',
  'M2_pain-promise.jpg',
  'M3_variant-matrix.jpg',
  'M4_decision-guide.jpg',
  'M5_collection-cta.jpg',
];

const OUTPAINT_PROMPT = `This is a wide 21:9 Amazon A+ content banner. The CENTER region already contains a completed and approved composition — product photography, typography, text, call-to-action, trust badges, and scene elements. You must NOT alter, redraw, reposition, or restyle anything in the completed center region.

Your ONLY task: seamlessly fill the WHITE VERTICAL STRIPS on the LEFT and RIGHT edges of the canvas by continuing the existing background scene outward. Match the exact same:
  - background surface / texture / wood grain / fabric / gradient
  - lighting direction, color temperature, shadow behavior
  - props, scatter, or pattern motifs (gently continue them, do not invent new prominent objects)
  - color palette and atmosphere

Rules:
  - Do NOT add new text, new products, new people, or new focal elements on the lateral strips.
  - Do NOT draw a seam, border, frame, or vignette between center and edges — it must read as ONE continuous wide photograph.
  - Keep the lateral strips as pure background continuation. Subtle tasteful props (e.g. a stray jute twine, an extra leaf, scattered confetti) are acceptable IF they match what already appears near the edges of the center region.
  - Preserve the exact aspect ratio 21:9. Output must be a single seamless wide banner.

Quality: photo-real continuation, no obvious seams, professional A+ banner finish.`;

async function padTo21x9(srcPath, dstPath) {
  const img = sharp(srcPath);
  const meta = await img.metadata();
  const h = meta.height;
  const w = meta.width;
  const targetW = Math.round(h * 21 / 9);
  if (targetW <= w) {
    // Already wider than 21:9 — shouldn't happen for 16:9 input.
    await img.toFile(dstPath);
    return { targetW, targetH: h };
  }
  const padEach = Math.round((targetW - w) / 2);
  await img
    .extend({
      top: 0,
      bottom: 0,
      left: padEach,
      right: padEach,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .jpeg({ quality: 92 })
    .toFile(dstPath);
  return { targetW, targetH: h, padEach };
}

(async () => {
  const kie = new KieClient(process.env.KIE_KEY);

  console.log(`[OUTPAINT] Padding ${BANNERS.length} banners to 21:9 canvas...`);
  const prepped = [];
  for (const name of BANNERS) {
    const src = path.join(SRC_DIR, name);
    if (!fs.existsSync(src)) { console.error(`[SKIP] missing ${name}`); continue; }
    const padded = path.join(TMP_DIR, name);
    const info = await padTo21x9(src, padded);
    console.log(`  [pad] ${name}  ${info.padEach}px each side → ${info.targetW}x${info.targetH}`);
    prepped.push({ name, padded });
  }

  console.log(`\n[OUTPAINT] Uploading ${prepped.length} padded canvases...`);
  for (const p of prepped) {
    p.url = await kie.uploadFromLocal(p.padded, 'outpaint-src', { maxSize: 1600, quality: 90, format: 'jpeg' });
  }

  console.log(`\n[OUTPAINT] Generating seamless 21:9 extensions in parallel (nano-banana-pro, 2K)...\n`);

  const results = [];
  await Promise.all(prepped.map(async (p) => {
    const id = p.name.replace(/\.jpg$/, '');
    const input = {
      prompt: OUTPAINT_PROMPT,
      image_input: [p.url],
      resolution: '2K',
      aspect_ratio: '21:9',
      output_format: 'jpg',
    };
    try {
      const outPath = path.join(OUT_DIR, p.name);
      const result = await kie.run('nano-banana-pro', input, 'image', id);
      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('no resultUrls');
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`download ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(outPath, buf);
      console.log(`  [${id}] OK ${Math.round(buf.length / 1024)}KB`);
      results.push({ id, ok: true, path: outPath });
    } catch (err) {
      console.error(`  [${id}] FAIL ${err.message}`);
      results.push({ id, ok: false, err: err.message });
    }
  }));

  console.log('\n[OUTPAINT] Summary:');
  for (const r of results) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.id}${r.ok ? '' : ' — ' + r.err}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[OUTPAINT] ${passed}/${results.length} banners extended to 21:9`);
  console.log(`[OUTPAINT] Output: ${OUT_DIR}`);
})();
