#!/usr/bin/env node
/**
 * run-sku.js — Simple command to run full pipeline for a new SKU
 *
 * Usage (in Claude Code conversation):
 *   node run-sku.js "./input/SKU - Product Name..."
 *   node run-sku.js "./input/SKU - Product Name..." --only listing
 *   node run-sku.js "./input/SKU - Product Name..." --dry-run
 *
 * This script handles:
 *   1. Scan input folder (reference, Listing-temp, A+)
 *   2. Generate skeleton brief
 *   3. Keyword parse (instant)
 *   4. Check for cached _analysis.json
 *   5. If no analysis: OUTPUT image list for Claude Code Vision
 *   6. After Vision analysis: enrich brief + run pipeline
 *
 * The script is designed to be called from Claude Code conversation.
 * When _analysis.json is missing, it prints the image paths and STOPS.
 * Claude Code then reads images, creates analysis, and re-runs with --continue.
 */
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./utils/logger');
const { scanInputFolder, generateBriefFromFolder } = require('./utils/pipeline-helpers');
const { ensureWebResearchReady } = require('./agents/master');

const paths = require('./utils/paths');
const PROJECT_ROOT = paths.agentRoot; // backward compat alias

function main() {
  const args = process.argv.slice(2);

  if (!args.length) {
    console.log('Usage: node run-sku.js <sku-folder>     [options]   (new — data/{SKU}/)');
    console.log('       node run-sku.js <input-folder>   [options]   (legacy — input/{SKU}/)');
    console.log('');
    console.log('Options: --only listing|aplus|video, --dry-run, --continue, --no-web-research');
    console.log('');
    console.log('Examples:');
    console.log('  node run-sku.js "../data/SKU123"                          # new mode');
    console.log('  node run-sku.js "./input/SKU123 - My Product Name"        # legacy');
    console.log('  node run-sku.js "../data/SKU123" --only listing');
    console.log('  node run-sku.js "../data/SKU123" --continue               # after Vision');
    process.exit(1);
  }

  const folderPath = args[0];
  const isContinue = args.includes('--continue');
  const isDryRun = args.includes('--dry-run');
  const noWebResearch = args.includes('--no-web-research');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

  // Step 1: Scan folder
  console.log('\n' + '='.repeat(60));
  console.log('  RUN-SKU: Auto Pipeline for New SKU');
  console.log('='.repeat(60));

  const resolved = path.resolve(folderPath);
  if (!fs.existsSync(resolved)) {
    console.error(`[FATAL] Folder not found: ${resolved}`);
    process.exit(1);
  }

  // Parse SKU + product name from folder name
  const folderName = path.basename(resolved);
  let sku, productName;
  const dashIdx = folderName.indexOf(' - ');
  if (dashIdx > 0) {
    sku = folderName.substring(0, dashIdx).trim();
    productName = folderName.substring(dashIdx + 3).trim();
  } else {
    sku = folderName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);
    productName = folderName;
  }

  console.log(`\n[RunSKU] SKU: ${sku}`);
  console.log(`[RunSKU] Product: ${productName}`);
  const log = createLogger('RunSKU', { sku });

  // Step 2: Scan subfolders
  const scanResult = scanInputFolder(folderPath, PROJECT_ROOT, log);

  // Step 3: Generate brief + keyword parse
  const briefPath = generateBriefFromFolder(folderPath, scanResult, PROJECT_ROOT, log);

  const { autoResearch, selectRepresentativeImages } = require('./agents/auto-research');
  const research = autoResearch(briefPath, scanResult);
  const webGate = ensureWebResearchReady({
    briefPath,
    brief: JSON.parse(fs.readFileSync(briefPath, 'utf8')),
    projectRoot: PROJECT_ROOT,
    log,
    enabled: !noWebResearch,
    commandHint: `node run-sku.js "${folderPath}"${isContinue ? ' --continue' : ''}${only ? ` --only ${only}` : ''}${isDryRun ? ' --dry-run' : ''}${noWebResearch ? ' --no-web-research' : ''}`
  });

  // Step 4: Check analysis
  const analysisPath = path.join(PROJECT_ROOT, 'output', sku, '_analysis.json');
  const hasAnalysis = fs.existsSync(analysisPath);

  if ((!hasAnalysis && !isContinue) || webGate.paused) {
    // Still missing required research inputs — output instructions and stop.
    console.log('\n' + '='.repeat(60));
    console.log('  RESEARCH INPUTS NEEDED');
    console.log('='.repeat(60));

    const selected = selectRepresentativeImages(scanResult);

    if (!hasAnalysis && !isContinue) {
      console.log('\nNo _analysis.json found. Claude Code needs to analyze competitor images.');
      console.log('');

      if (selected.listingImages.length > 0) {
        console.log('=== LISTING IMAGES (competitors) — analyze for features, colors, layout ===');
        selected.listingImages.forEach((p, i) => {
          console.log(`  [${i+1}] ${p}`);
        });
      }

      if (selected.referenceImages.length > 0) {
        console.log('\n=== REFERENCE IMAGES (our product) — analyze for dimensions, details ===');
        selected.referenceImages.forEach((p, i) => {
          console.log(`  [${i+1}] ${p}`);
        });
      }

      console.log('\n--- VISION INSTRUCTIONS ---');
      console.log('1. Read each image above using Read tool');
      console.log('2. Analyze: features, colors, dimensions, visual style, headlines');
      console.log('3. Create _analysis.json using:');
      console.log(`   const { createAnalysis } = require('./agents/auto-research');`);
      console.log(`   createAnalysis('${sku}', visionData);`);
      console.log(`4. Re-run: node run-sku.js "${folderPath}" --continue ${only ? '--only ' + only : ''}${isDryRun ? ' --dry-run' : ''}${noWebResearch ? ' --no-web-research' : ''}`);
      console.log('');
    }

    if (webGate.paused) {
      console.log('--- WEB RESEARCH INSTRUCTIONS ---');
      console.log(`1. Read: ${webGate.queriesPath}`);
      console.log('2. Run each query via MCP search/scrape tools');
      console.log(`3. Save results to: ${webGate.outputPath}`);
      console.log(`4. Re-run: node run-sku.js "${folderPath}" --continue${only ? ` --only ${only}` : ''}${isDryRun ? ' --dry-run' : ''}${noWebResearch ? ' --no-web-research' : ''}`);
      console.log('');
    }

    // Also save a manifest for easy reference
    const manifest = {
      sku,
      product_name: productName,
      brief_path: briefPath,
      needs_vision: !hasAnalysis,
      needs_web_research: !!webGate.paused,
      web_queries_path: webGate.queriesPath || null,
      web_output_path: webGate.outputPath || null,
      listing_images: selected.listingImages,
      reference_images: selected.referenceImages,
      instructions: 'Complete pending vision and/or web research tasks, then re-run with --continue'
    };
    const manifestPath = path.join(PROJECT_ROOT, 'output', sku, '_vision_manifest.json');
    const outDir = path.join(PROJECT_ROOT, 'output', sku);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[RunSKU] Manifest saved: ${manifestPath}`);

    process.exit(2);
  }

  // Step 5: Analysis exists (or --continue) — run pipeline
  if (hasAnalysis) {
    console.log(`\n[RunSKU] Analysis found: ${analysisPath}`);
    // Re-enrich brief with analysis
    try {
      const { enrichBrief } = require('./agents/research-agent');
      enrichBrief(briefPath, analysisPath);
      console.log('[RunSKU] Brief re-enriched with analysis data');
    } catch (err) {
      console.warn(`[RunSKU] Re-enrichment warning: ${err.message}`);
    }
  }

  // Build CLI args for master.js
  const masterArgs = [briefPath];
  if (only) masterArgs.push('--only', only);
  if (isDryRun) masterArgs.push('--dry-run');
  if (noWebResearch) masterArgs.push('--no-web-research');

  console.log(`\n[RunSKU] Running pipeline: node agents/master.js ${masterArgs.join(' ')}`);

  // Run master.js as subprocess to keep clean separation
  const { execSync } = require('child_process');
  try {
    execSync(`node agents/master.js ${masterArgs.map(a => `"${a}"`).join(' ')}`, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      timeout: 600000 // 10 min timeout
    });
    console.log('\n[RunSKU] Pipeline complete!');
  } catch (err) {
    console.error(`\n[RunSKU] Pipeline failed: ${err.message}`);
    process.exit(1);
  }
}

main();
