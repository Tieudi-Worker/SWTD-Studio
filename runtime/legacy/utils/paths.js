/**
 * Centralized path resolver for HMA Agent.
 *
 * Separates two concerns:
 *   agentRoot  — code + global config (handmade-media-agent/)
 *   skuContext — per-SKU data (data/{SKU}/)
 *
 * Replaces 6 independent PROJECT_ROOT definitions across the codebase.
 */
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
//  AGENT ROOT — fixed, always handmade-media-agent/
// ═══════════════════════════════════════
const agentRoot = path.join(__dirname, '..');

// Global resources that live inside the agent
const configDir    = path.join(agentRoot, 'config');
const knowledgeDir = path.join(agentRoot, 'knowledge');
const xpDir        = path.join(agentRoot, 'xp');
const themeDir     = path.join(agentRoot, 'references', 'theme-packs');

// ═══════════════════════════════════════
//  SKU CONTEXT — per-job, external data dir
// ═══════════════════════════════════════

/**
 * Create a resolved context object for a single SKU job.
 *
 * @param {string} arg — CLI argument: either a folder path (new mode)
 *                        or a .json brief path (legacy mode)
 * @returns {object} ctx — all resolved paths for this SKU
 */
function createSkuContext(arg) {
  const resolved = path.resolve(arg);

  let skuDir, briefPath, sku;

  if (resolved.endsWith('.json')) {
    // LEGACY MODE: arg is a brief .json file inside old briefs/ dir
    // Derive skuDir from brief content or fall back to output/{sku}
    briefPath = resolved;
    try {
      const brief = JSON.parse(fs.readFileSync(resolved, 'utf8'));
      sku = brief.sku;
    } catch (e) {
      sku = path.basename(resolved, '.json');
    }
    // In legacy mode, SKU dir is output/{sku} under agent root
    // This keeps backward compatibility until migration
    skuDir = path.join(agentRoot, 'output', sku);
    // Brief stays where it is in legacy mode
  } else {
    // NEW MODE: arg is a SKU folder (data/{SKU}/)
    skuDir = resolved;
    briefPath = path.join(skuDir, 'brief.json');
    sku = path.basename(skuDir);
  }

  return {
    sku,
    skuDir,
    briefPath,
    isLegacy: resolved.endsWith('.json'),

    // Input directories
    inputDir:    path.join(skuDir, 'input'),
    productDir:  path.join(skuDir, 'input', 'product'),
    listingRef:  path.join(skuDir, 'input', 'listing-ref'),
    aplusRef:    path.join(skuDir, 'input', 'aplus-ref'),
    videoRef:    path.join(skuDir, 'input', 'video-ref'),

    // Output directories
    outputDir:   path.join(skuDir, 'output'),
    listingDir:  path.join(skuDir, 'output', 'listing'),
    aplusDir:    path.join(skuDir, 'output', 'aplus'),
    videoDir:    path.join(skuDir, 'output', 'video'),

    // Research / metadata
    researchDir: path.join(skuDir, 'research'),
  };
}

/**
 * Create a legacy-compatible context that mimics the old PROJECT_ROOT behavior.
 * Used during migration — old code that passes projectRoot gets the same results.
 *
 * @param {string} briefPath — path to brief .json
 * @param {string} projectRoot — old PROJECT_ROOT (agent dir)
 * @returns {object} ctx
 */
function createLegacyContext(briefPath, projectRoot) {
  let sku;
  try {
    const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
    sku = brief.sku;
  } catch (e) {
    sku = path.basename(briefPath, '.json');
  }

  const outputDir = path.join(projectRoot, 'output', sku);

  return {
    sku,
    skuDir: projectRoot, // In legacy mode, paths resolve from agent root
    briefPath: path.resolve(briefPath),
    isLegacy: true,

    inputDir:    path.join(projectRoot, 'input'),
    productDir:  path.join(projectRoot, 'input'),
    listingRef:  null,
    aplusRef:    null,
    videoRef:    null,

    outputDir,
    listingDir:  path.join(outputDir, 'listing'),
    aplusDir:    path.join(outputDir, 'aplus'),
    videoDir:    path.join(outputDir, 'video'),

    researchDir: outputDir, // legacy: research files live in output dir
  };
}

module.exports = {
  agentRoot,
  configDir,
  knowledgeDir,
  xpDir,
  themeDir,
  createSkuContext,
  createLegacyContext,
};
