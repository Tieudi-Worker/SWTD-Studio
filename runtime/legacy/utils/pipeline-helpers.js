const fs = require('fs');
const path = require('path');
const paths = require('./paths');

/** Load JSON file with fallback default */
function loadJson(filePath, fallback) {
  if (fs.existsSync(filePath)) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { /* corrupt file */ }
  }
  return fallback;
}

function loadBrief(p) {
  const r = path.resolve(p);
  if (!fs.existsSync(r)) throw new Error(`Brief not found: ${r}`);
  const b = JSON.parse(fs.readFileSync(r, 'utf8'));
  if (!b.sku || !b.product_name) throw new Error('Brief needs sku + product_name');
  return b;
}

function loadTheme(key, projectRoot, log) {
  const dir = paths.themeDir;
  const exact = loadJson(path.join(dir, `${key}.json`), null);
  if (exact) return exact;
  if (fs.existsSync(dir) && key) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json') && f.includes(key.split('_')[0])) return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
  }
  if (log) log.warn(`Theme pack not found for "${key}". Using default. Create references/theme-packs/${key}.json for accurate colors.`);
  return { colors:{primary:'#C41E3A',secondary:'#1B5E20',accent:'#FFD700',neutral:'#FFF'}, mood:['warm','inviting'], lighting:'soft natural lighting', surfaces:['wooden table'], lifestyle_contexts:['cozy home','gift moment'], visual_elements:[] };
}

function loadSpecs(projectRoot) {
  return loadJson(path.join(paths.configDir, 'image-specs.json'),
    { listing:{width:2000,height:2000,format:'jpeg',quality:95}, aplus_premium:{width:1464,height:600,format:'jpeg',quality:95} });
}

/**
 * Windows long path fix: Sharp/libvips can't read paths >260 chars.
 * Copies long-path images to a short temp dir and returns shortened paths.
 * Also rewrites brief.input_images to use short paths.
 * Returns { shortened, tempDir, tempMap }
 */
function shortenPaths(imagePaths, brief, projectRoot, log) {
  const needsShorten = process.platform === 'win32' && imagePaths.some(p => p.length > 250);
  if (!needsShorten) return { shortened: imagePaths, tempDir: null, tempMap: {} };

  const tmpDir = path.join(projectRoot, 'output', '_tmp_refs');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tempMap = {};

  if (log) log.info('Long paths detected (>260 chars) — copying refs to short temp path');

  const shortened = imagePaths.map((p, i) => {
    if (p.length <= 250) return p;
    const ext = path.extname(p) || '.jpg';
    const shortPath = path.join(tmpDir, `ref_${String(i).padStart(3, '0')}${ext}`);
    fs.copyFileSync(p, shortPath);
    tempMap[p] = shortPath;
    return shortPath;
  });

  if (brief && brief.input_images) {
    brief.input_images = brief.input_images.map(orig => {
      const resolved = path.resolve(projectRoot, orig);
      return tempMap[resolved] || orig;
    });
  }

  if (log) log.info(`Copied ${Object.keys(tempMap).length} files to short temp path`);
  return { shortened, tempDir: tmpDir, tempMap };
}

/**
 * Select best listing outputs to feed into A+ and Video as additional refs.
 * Priority: Slot 2 (in-use) > Slot 6 (gift-set) > Slot 7 (emotional) > others
 */
function selectBestOutputs(listingResults, count = 3) {
  if (!listingResults || !Array.isArray(listingResults)) return [];
  const priority = [2, 6, 7, 4, 8, 3, 5];
  const selected = [];
  for (const slotNum of priority) {
    if (selected.length >= count) break;
    const result = listingResults.find(r => r.slot === slotNum && r.success && r.path);
    if (result && fs.existsSync(result.path)) selected.push(result.path);
  }
  return selected;
}

function printSummary(brief, results, elapsed, dir, log) {
  const listingOk = results.listing ? results.listing.filter(r=>r.success).length : 0;
  const aplusOk = results.aplus ? results.aplus.filter(r=>r.success).length : 0;
  const videoOk = results.video?.success || false;
  const fails = [];
  if (results.listing) results.listing.filter(r=>!r.success).forEach(r=>fails.push(`Slot ${r.slot}: ${r.reason}`));
  if (results.aplus) results.aplus.filter(r=>!r.success).forEach(r=>fails.push(`A+ ${r.module}: ${r.reason}`));

  log.info({
    phase: 'complete', elapsedMin: parseFloat(elapsed),
    listing: results.listing ? `${listingOk}/8` : 'skipped',
    aplus: results.aplus ? `${aplusOk}/5` : 'skipped',
    video: results.video ? (videoOk ? 'ok' : 'failed') : 'skipped',
    failures: fails, outputDir: dir
  }, `Pipeline complete: ${brief.sku} (${elapsed} min)`);
}

/**
 * Run task functions in parallel or sequential.
 */
async function runTasks(taskFns, fallbackMeta, sequential) {
  if (sequential) {
    const results = [];
    for (let i = 0; i < taskFns.length; i++) {
      try { results.push(await taskFns[i]()); }
      catch (err) { results.push({ ...fallbackMeta[i], success: false, reason: err.message }); }
    }
    return results;
  }
  const settled = await Promise.allSettled(taskFns.map(fn => fn()));
  return settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { ...fallbackMeta[i], success: false, reason: r.reason?.message || 'Unknown error' };
  });
}

/**
 * Scan a product input folder for standard subfolders.
 *
 * Supports TWO folder layouts:
 *   NEW:    input/product/, input/listing-ref/, input/aplus-ref/, input/video-ref/
 *   LEGACY: reference/, Listing-temp/, Content A+-temp/ (or flat *.jpg files)
 *
 * Returns separate arrays for product images (→ API reference) vs template images
 * (→ design inspiration only, NEVER sent as API reference images).
 */
function scanInputFolder(folderPath, projectRoot, log) {
  const resolved = path.resolve(folderPath);
  if (!fs.existsSync(resolved)) throw new Error(`Input folder not found: ${resolved}`);

  const imgExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const listImages = (dir) => {
    if (!dir || !fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => imgExts.includes(path.extname(f).toLowerCase()))
      .sort()
      .map(f => path.join(dir, f));
  };

  const subdirs = fs.readdirSync(resolved).filter(f =>
    fs.statSync(path.join(resolved, f)).isDirectory()
  );

  // Detect layout: new (product/) vs legacy (reference/ or flat)
  const hasNewLayout = subdirs.some(d => d === 'product');
  const hasInputSubdir = subdirs.some(d => d === 'input');

  // If folderPath points to a SKU root with input/ subdir, descend into it
  const inputRoot = hasInputSubdir ? path.join(resolved, 'input') : resolved;
  const inputSubdirs = (inputRoot !== resolved)
    ? fs.readdirSync(inputRoot).filter(f => fs.statSync(path.join(inputRoot, f)).isDirectory())
    : subdirs;

  const hasProduct = inputSubdirs.some(d => d === 'product');

  let productDir, listingRefDir, aplusRefDir, videoRefDir;

  if (hasProduct) {
    // NEW LAYOUT: product/, listing-ref/, aplus-ref/, video-ref/
    productDir = path.join(inputRoot, 'product');
    listingRefDir = path.join(inputRoot, 'listing-ref');
    aplusRefDir = path.join(inputRoot, 'aplus-ref');
    videoRefDir = path.join(inputRoot, 'video-ref');
  } else {
    // LEGACY LAYOUT: reference/, Listing-temp/, Content A+-temp/
    const configPath = path.join(paths.configDir, 'research-config.json');
    const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
    const patterns = config.subfolder_patterns || {
      reference: ['reference', 'reference-product', 'ref'],
      listing: ['Listing-temp', 'Listing-template', 'listing'],
      aplus: ['Content A+-temp', 'Content A+-template', 'aplus']
    };

    const findSubdir = (type) => {
      const candidates = patterns[type] || [];
      for (const name of candidates) {
        const match = inputSubdirs.find(d => d.toLowerCase() === name.toLowerCase());
        if (match) return path.join(inputRoot, match);
      }
      return null;
    };

    productDir = findSubdir('reference');
    listingRefDir = findSubdir('listing');
    aplusRefDir = findSubdir('aplus');
    videoRefDir = null; // legacy layout has no video-ref
  }

  // Product images: ONLY from product/ (or reference/ in legacy)
  // These are the ONLY images sent to the AI model as reference
  let productImages = listImages(productDir);

  // Flat fallback: if no product subfolder found, scan root for images
  if (productImages.length === 0 && !hasProduct) {
    productImages = listImages(inputRoot);
    if (productImages.length > 0 && log) {
      log.warn(`No product/ subfolder — using ${productImages.length} flat images from root`);
    }
  }

  // Template images: NEVER sent to AI model as reference
  // Used by Design Director / research agents for design inspiration only
  const listingRefImages = listImages(listingRefDir);
  const aplusRefImages = listImages(aplusRefDir);
  const videoRefImages = listImages(videoRefDir);

  const result = {
    // Product shots → API reference (image_input)
    productDir,
    productImages,
    // Backward compat aliases
    referenceDir: productDir,
    referenceImages: productImages,
    // Template images → design inspiration only
    listingRefDir: listingRefDir,
    listingRefImages,
    aplusRefDir: aplusRefDir,
    aplusRefImages,
    videoRefDir: videoRefDir,
    videoRefImages,
    // Legacy aliases (for callers that still use old names)
    listingDir: listingRefDir,
    listingImages: listingRefImages,
    aplusDir: aplusRefDir,
    aplusImages: aplusRefImages,
    // Layout detection
    isNewLayout: hasProduct
  };

  log.info({
    folder: resolved,
    layout: hasProduct ? 'new' : 'legacy',
    product: productImages.length,
    listingRef: listingRefImages.length,
    aplusRef: aplusRefImages.length,
    videoRef: videoRefImages.length
  }, 'Scanned input folder');

  if (productImages.length === 0) {
    log.warn('No product images found! Slot 1 & 5 will fail.');
  }

  return result;
}

/**
 * Generate a brief JSON from a scanned input folder.
 */
function generateBriefFromFolder(folderPath, scanResult, projectRoot, log, options = {}) {
  const folderName = path.basename(folderPath);

  let sku, productName;
  const dashIdx = folderName.indexOf(' - ');
  if (dashIdx > 0) {
    sku = folderName.substring(0, dashIdx).trim();
    productName = folderName.substring(dashIdx + 3).trim();
  } else {
    sku = folderName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);
    productName = folderName;
  }

  const brief = {
    sku, product_name: productName, category: 'mixed', materials: [], dimensions: '',
    features: [], usp: '', niche: '', occasion: 'general_gift', seasonal_theme: '',
    target_audience: { buyer: '', recipient: '' }, price_range: '', competitor_asins: [],
    // Product images ONLY — these are sent to AI model as reference (image_input)
    input_images: scanResult.productImages.map(p => p.replace(/\\/g, '/')),
    // Template images — for design inspiration, NEVER sent as API reference
    listing_templates: scanResult.listingRefImages.map(p => p.replace(/\\/g, '/')),
    aplus_templates: scanResult.aplusRefImages.map(p => p.replace(/\\/g, '/')),
    video_templates: (scanResult.videoRefImages || []).map(p => p.replace(/\\/g, '/')),
    // Legacy aliases (backward compat)
    listing_reference: scanResult.listingRefDir ? scanResult.listingRefDir.replace(/\\/g, '/') + '/' : '',
    aplus_reference: scanResult.aplusRefDir ? scanResult.aplusRefDir.replace(/\\/g, '/') + '/' : '',
    color_preference: '', copy_style: 'emotional'
  };

  try {
    const { applyKeywordParse } = require('../agents/auto-research');
    applyKeywordParse(brief);
  } catch (err) {
    if (log) log.warn({ err: err.message }, 'Keyword parse failed');
  }

  // New mode: write brief.json to skuDir root. Legacy: write to briefs/{sku}.json
  let briefPath;
  if (options.skuDir) {
    briefPath = path.join(options.skuDir, 'brief.json');
  } else {
    const briefDir = path.join(projectRoot, 'briefs');
    if (!fs.existsSync(briefDir)) fs.mkdirSync(briefDir, { recursive: true });
    briefPath = path.join(briefDir, `${sku}.json`);
  }
  fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2), 'utf8');

  log.info({ sku, product: productName, category: brief.category, occasion: brief.occasion }, `Generated brief: ${briefPath}`);
  return briefPath;
}

module.exports = {
  loadJson, loadBrief, loadTheme, loadSpecs,
  shortenPaths, selectBestOutputs, printSummary, runTasks,
  scanInputFolder, generateBriefFromFolder
};
