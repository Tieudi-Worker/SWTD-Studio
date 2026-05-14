/**
 * End-to-end verification of HMA core A+ ref resolution fixes.
 * Calls `AplusPipeline.run()` directly with proper ctx for a real SKU to
 * confirm: (1) ctx.skuDir routing works, (2) ref_catalog resolves to real
 * product photos, (3) image-generator uploads at high-res, (4) warnings
 * fire when catalog is empty.
 *
 * Runs M1 only (precheck) to minimize credit burn.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', 'api-keys.env') });

const { KieClient } = require('../utils/kie-client');
const ImageGenerator = require('../agents/image-generator');
const AplusPipeline = require('../agents/aplus-pipeline');
const { createLogger } = require('../utils/logger');
const paths = require('../utils/paths');

const SKU = 'MK TNTD090425i392';
const DATA_ROOT = path.resolve(__dirname, '..', '..', 'data');
const SKU_DIR = path.join(DATA_ROOT, SKU);

(async () => {
  const log = createLogger('VERIFY');
  const kie = new KieClient(process.env.KIE_KEY);
  const imageGen = new ImageGenerator(kie);

  const briefPath = path.join(SKU_DIR, 'brief.json');
  const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));

  // Build minimal ctx with the critical skuDir field
  const ctx = { skuDir: SKU_DIR, sku: SKU, agentRoot: paths.agentRoot };

  // inputImages should include real product photos so the pipeline can
  // fall back properly if ref_catalog is missing. Source them from brief.
  const inputImages = (brief.input_images || []).map(p =>
    path.isAbsolute(p) ? p : path.join(SKU_DIR, p)
  ).filter(p => fs.existsSync(p));

  // For this verification, pretend we have no listing refs — prove real
  // product refs are picked up via ref_catalog, not via fallback.
  const listingRefs = [];

  // Minimal DNA + theme shells so _promptForModule doesn't crash
  const designDNA = {
    cohesion_anchors: {
      props: ['paintbrush', 'paint pots', 'kraft gift box'],
      lighting_key: 'warm soft natural light from camera-left',
      color_anchors: ['warm red-brown', 'cream birch']
    },
    art_direction: { mood_descriptor: 'warm Father\'s Day morning' },
    colorPalette: 'warm cream + red-brown accent',
    themeAnchors: { lightingKey: 'warm soft natural light from camera-left' }
  };
  const theme = { mood: ['warm', 'heartfelt'] };
  const specs = {};

  // Use separate output folder so we don't clobber existing approved batch
  const aplusDir = path.join(SKU_DIR, 'output', 'aplus', 'hma_verify_' + Date.now());
  fs.mkdirSync(aplusDir, { recursive: true });

  // MOCK imageGen.generate to skip actual KIE gen but still run uploadImage
  // (so we see the high-res upload log). 0 credits burned.
  const originalGenerate = imageGen.generate.bind(imageGen);
  imageGen.generate = async function(prompt, outputPath, options = {}) {
    const { referenceImages = [] } = options;
    log.info(`[mock-gen] slot=${options.slotNumber} refs=${referenceImages.length}`);
    for (const img of referenceImages) {
      const url = await this.uploadImage(img);
      log.info(`[mock-gen] ref: ${path.basename(img)} → ${url.slice(0, 80)}...`);
    }
    // Return failure to short-circuit per-module post-processing (sharp/overlay)
    // while still exercising the ref resolution + upload path we want to verify.
    return { success: false, error: 'MOCK: ref-resolution verification only, skipping actual gen' };
  };

  const pipeline = new AplusPipeline({
    kie, imageGen, log, projectRoot: paths.agentRoot, sequential: true
  });

  log.info(`[verify] SKU=${SKU} aplusDir=${aplusDir}`);
  log.info(`[verify] inputImages=${inputImages.length} listingRefs=${listingRefs.length}`);
  log.info(`[verify] brief.ref_catalog keys: [${Object.keys(brief.ref_catalog || {}).join(', ')}]`);

  const results = await pipeline.run(brief, designDNA, theme, specs, aplusDir, inputImages, listingRefs, ctx);
  const ok = results.filter(r => r.success).length;
  log.info(`[verify] ${ok}/${results.length} modules OK → ${aplusDir}`);
  log.info(`[verify] Verification checklist:`);
  log.info(`[verify]  (a) ctx.skuDir used: PASS if no "[A+ refs] ref_catalog resolved to EMPTY" warning above`);
  log.info(`[verify]  (b) high-res upload: PASS if "Uploaded: MEDIA_MK... (>100KB)" appears for real refs`);
  log.info(`[verify]  (c) no silent fallback: PASS if no "[ref] recipe ... NOT found" warning`);
})().catch(err => {
  console.error('[verify] FATAL', err.stack || err.message);
  process.exit(1);
});
