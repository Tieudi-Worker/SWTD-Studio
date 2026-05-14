/**
 * A+ Content Flow — reusable orchestrator.
 *
 * Proven pattern (April 2026, TNTD250326i769 + TNTD180326_teacher + TNTD090425i392):
 *   - Real product photos from `input/product/` are PRIMARY fidelity source
 *   - Uploaded at high-res (maxSize 2048, quality 95) to avoid compound hallucination
 *   - COPY-MODE GUARDS injected into every prompt with per-SKU product anchors
 *   - R1 (typography lock) + R2 (fidelity) + R3 (scale) + R4 (per-banner refs)
 *   - M1 precheck → batch M2-M5 pattern for cost-efficient QC
 *   - Multi-ratio support (16:9 + 21:9) from same prompt
 *
 * Consumed by `scripts/aplus.js` CLI and can be wired into the main pipeline.
 */
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
//  Path helpers
// ═══════════════════════════════════════

function skuRoot(dataRoot, sku) {
  return path.join(dataRoot, sku);
}

function isRealProductRef(absPath) {
  return /[\\/]input[\\/]product[\\/]/.test(absPath);
}

// ═══════════════════════════════════════
//  Ref resolution
// ═══════════════════════════════════════

/**
 * Resolve ref catalog entries to absolute paths.
 * Accepts both absolute paths and paths relative to SKU root.
 */
function resolveRefPaths(refCatalog, skuDir) {
  const resolved = {};
  for (const [key, rel] of Object.entries(refCatalog || {})) {
    if (!rel) continue;
    resolved[key] = path.isAbsolute(rel) ? rel : path.join(skuDir, rel);
  }
  return resolved;
}

/**
 * Upload refs with per-source upload options.
 * Real product photos (input/product/) use high-res (2048px/q95) to preserve
 * pennant/handprint/engraving detail. Listing renders use default (768px/q85).
 */
async function uploadRefsAtProperResolution(kie, resolvedCatalog, log) {
  const urls = {};
  for (const [key, p] of Object.entries(resolvedCatalog)) {
    if (!fs.existsSync(p)) {
      throw new Error(`[aplus-flow] Missing ref: ${key} -> ${p}`);
    }
    const opts = isRealProductRef(p)
      ? { maxSize: 2048, quality: 95, format: 'jpeg' }
      : { maxSize: 768,  quality: 85, format: 'jpeg' };
    urls[key] = await kie.uploadFromLocal(p, 'product-refs', opts);
    if (log) log.info(`[aplus-flow] ref ${key} (${opts.maxSize}px) cached`);
  }
  return urls;
}

// ═══════════════════════════════════════
//  GUARDS builder — COPY-MODE fidelity
// ═══════════════════════════════════════

/**
 * Build GUARDS block injected into every module prompt.
 *
 * If brief.aplus_product_guards is a string, uses it verbatim as the R2
 * product fidelity anchor text. Otherwise derives a generic anchor from
 * brief.product_structure.
 *
 * Always appends R1 (typography lock), R3 (scale), and global negative
 * constraints (anti-leak, no duplicate labels).
 */
function buildGuards(brief) {
  const r2 = brief.aplus_product_guards
    || `The product in the reference image must be reproduced with pixel-level faithfulness — same silhouette, same engraved text, same decorative elements, same colors. Preserve all handcrafted details visible in the reference. ${brief.product_structure || ''}`;

  const font = brief.aplus_font_family || 'Fredoka Bold';
  const scaleHint = brief.dimensions
    ? `The product is approximately ${brief.dimensions}. Render realistic proportions per this size reference.`
    : 'Render realistic handheld-scale proportions — do NOT oversize.';

  return `
=== COPY-MODE PRODUCT FIDELITY (R2) ===

The FIRST image in image_input is the REAL PRODUCT PHOTO. Treat it as a PIXEL-LEVEL TEMPLATE. Whenever the product appears in this banner, copy it EXACTLY from the real-photo reference. Do NOT stylize, reinterpret, or simplify.

${r2}

=== SCALE ANCHOR (R3) ===

${scaleHint}

=== TYPOGRAPHY LOCK (R1) ===

Strictly TWO font families throughout this banner. Font 1 = ${font} style (rounded friendly display) for headlines, CTA, callouts. Font 2 = HANDWRITTEN CALLIGRAPHY ITALIC (Kalam / Caveat family) for accent captions, subheads. NO third font. NO traditional serif. NO Helvetica.

=== NEGATIVE CONSTRAINTS ===

• Do NOT render layout instructions, percentage labels, or descriptive design labels (like "LEFT 50%" or "HERO SHOT") as visible text in the banner.
• Do NOT duplicate ribbon labels, captions, or any piece of text within the same banner.
• Do NOT add text that is not explicitly specified in the module prompt.
• Do NOT reinterpret the product — copy the reference photo.
`;
}

// ═══════════════════════════════════════
//  Module prompt builder
// ═══════════════════════════════════════

/**
 * Build full prompt for a module by combining:
 *   1. Module's layout/intent from funnel config
 *   2. Per-module scene text from brief.aplus_modules[id] override (if any)
 *   3. GUARDS block
 */
function buildModulePrompt(module, brief, guards) {
  const override = (brief.aplus_modules || {})[module.id];
  if (override && override.prompt) {
    return `${override.prompt}\n\n${guards}`;
  }
  // Derive from funnel module layout (fallback)
  const lines = [
    `Amazon A+ content banner, wide horizontal composition. Module: ${module.name || module.id}.`,
    `Intent: ${module.intent || ''}`.trim(),
  ];
  if (module.layout) {
    lines.push('Layout:');
    for (const [zone, desc] of Object.entries(module.layout)) {
      lines.push(`  • ${zone.replace(/_/g, ' ')}: ${desc}`);
    }
  }
  return `${lines.join('\n')}\n\n${guards}`;
}

// ═══════════════════════════════════════
//  Batch runner
// ═══════════════════════════════════════

/**
 * Generate a single banner module.
 */
async function generateOneModule({ kie, imageGen, module, refUrls, aspectRatio, outDir, log }) {
  const image_input = (module.refs || []).map(k => refUrls[k]).filter(Boolean);
  if (!image_input.length) {
    return { id: module.id, ok: false, err: 'no refs resolved' };
  }
  const outputPath = path.join(outDir, `${module.id}.jpg`);
  try {
    // Use raw kie.run if imageGen isn't provided — keeps us independent of
    // image-generator.js abstractions that may downgrade ref resolution.
    const input = {
      prompt: module.prompt,
      image_input,
      resolution: '2K',
      aspect_ratio: aspectRatio,
      output_format: 'jpg',
    };
    const result = await kie.run('nano-banana-pro', input, 'image', module.id);
    const imageUrl = result.resultUrls && result.resultUrls[0];
    if (!imageUrl) throw new Error('no resultUrls');
    const resp = await fetch(imageUrl);
    if (!resp.ok) throw new Error(`download ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(outputPath, buf);
    if (log) log.info(`[aplus-flow] ${module.id} OK ${Math.round(buf.length / 1024)}KB`);
    return { id: module.id, ok: true, path: outputPath, sizeKB: Math.round(buf.length / 1024) };
  } catch (err) {
    if (log) log.error(`[aplus-flow] ${module.id} FAIL ${err.message}`);
    return { id: module.id, ok: false, err: err.message };
  }
}

/**
 * Run a set of modules in parallel at one aspect ratio.
 */
async function runAplusBatch({ kie, modules, refUrls, aspectRatio, outDir, log }) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (log) log.info(`[aplus-flow] Generating ${modules.length} modules @ ${aspectRatio} → ${outDir}`);
  const results = await Promise.all(modules.map(m =>
    generateOneModule({ kie, module: m, refUrls, aspectRatio, outDir, log })
  ));
  return results;
}

// ═══════════════════════════════════════
//  Full flow — precheck → batch
// ═══════════════════════════════════════

/**
 * Orchestrate: M1 precheck (if !skipPrecheck) then batch remaining modules.
 * Returns { precheck, results, passed, total }.
 */
async function runFullFlow({ kie, modules, refUrls, aspectRatio, outDir, log, skipPrecheck }) {
  if (!modules || !modules.length) return { results: [], passed: 0, total: 0 };
  // Ensure outDir exists before any module runs (precheck or batch).
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  if (!skipPrecheck && modules.length > 1) {
    const [m1, ...rest] = modules;
    const pre = await generateOneModule({ kie, module: m1, refUrls, aspectRatio, outDir, log });
    if (!pre.ok) {
      return { precheck: pre, results: [pre], passed: 0, total: modules.length };
    }
    const restResults = await runAplusBatch({ kie, modules: rest, refUrls, aspectRatio, outDir, log });
    const all = [pre, ...restResults];
    return { precheck: pre, results: all, passed: all.filter(r => r.ok).length, total: all.length };
  }

  const results = await runAplusBatch({ kie, modules, refUrls, aspectRatio, outDir, log });
  return { results, passed: results.filter(r => r.ok).length, total: results.length };
}

module.exports = {
  skuRoot,
  isRealProductRef,
  resolveRefPaths,
  uploadRefsAtProperResolution,
  buildGuards,
  buildModulePrompt,
  generateOneModule,
  runAplusBatch,
  runFullFlow,
};
