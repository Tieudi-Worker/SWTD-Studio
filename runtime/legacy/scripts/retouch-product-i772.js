#!/usr/bin/env node
/**
 * Pre-retouch product reference images for SKU MK TNTD030426i772.
 *
 * The actual product photos are yellow-amber birch. The fidelity guard in
 * agents/image-generator.js forces nano-banana-pro to preserve "same wood tone"
 * which conflicts with the bright/angelic prompt direction. The architectural
 * fix is to color-correct the reference images themselves so the AI's ground
 * truth is already pale-neutral.
 *
 * Reads brief.ref_catalog (7 curated refs), color-corrects each via Sharp,
 * writes to data/<SKU>/product-bright/. Originals untouched.
 *
 * Usage:
 *   node scripts/retouch-product-i772.js "../data/MK TNTD030426i772" --sample
 *   node scripts/retouch-product-i772.js "../data/MK TNTD030426i772" --all
 *   node scripts/retouch-product-i772.js "../data/MK TNTD030426i772" --all --saturation 0.65 --hue -12
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false); // Windows EBUSY guard, same as utils/image-utils.js

// Default profile for "yellow birch → pale neutral maple"
const DEFAULTS = {
  saturation: 0.55,
  hue: -8,
  brightness: 1.08,
  linearMul: 1.04,
  linearOff: -3,
  quality: 95,
};

// Sample target: the most visible hero ref. Must exist in brief.ref_catalog.
const SAMPLE_KEY = 'hero_three_pieces_layout';

function parseArgs(argv) {
  const args = argv.slice(2);
  const skuDir = args.find(a => !a.startsWith('--'));
  const flags = {
    sample: args.includes('--sample'),
    all: args.includes('--all'),
    normalize: args.includes('--normalize'),
  };
  // Optional numeric overrides
  const num = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : fallback;
  };
  const profile = {
    saturation: num('saturation', DEFAULTS.saturation),
    hue:        num('hue',        DEFAULTS.hue),
    brightness: num('brightness', DEFAULTS.brightness),
    linearMul:  num('linear-mul', DEFAULTS.linearMul),
    linearOff:  num('linear-off', DEFAULTS.linearOff),
    quality:    num('quality',    DEFAULTS.quality),
  };
  return { skuDir, flags, profile };
}

async function retouchOne(srcPath, dstPath, profile, normalize) {
  let pipeline = sharp(srcPath, { failOn: 'none' });
  if (normalize) {
    // Strip EXIF orientation completely so KIE doesn't double-rotate.
    // .rotate() with no arg + withMetadata({orientation: 1}) bakes pixel orientation in,
    // then strips the orientation tag.
    pipeline = pipeline.rotate().withMetadata({ orientation: 1 });
  } else {
    pipeline = pipeline.rotate(); // honor EXIF
  }
  await pipeline
    .modulate({
      saturation: profile.saturation,
      hue:        profile.hue,
      brightness: profile.brightness,
    })
    .linear(profile.linearMul, profile.linearOff)
    .jpeg({ quality: profile.quality })
    .toFile(dstPath);
}

async function main() {
  const { skuDir: rawSku, flags, profile } = parseArgs(process.argv);
  if (!rawSku) {
    console.error('Usage: node retouch-product-i772.js <sku-folder> [--sample | --all] [--saturation 0.55] [--hue -8] [--brightness 1.08]');
    process.exit(1);
  }
  if (!flags.sample && !flags.all) {
    console.error('Pass --sample (1 image for QC) or --all (process every ref in brief.ref_catalog).');
    process.exit(1);
  }

  const skuDir = path.resolve(rawSku);
  if (!fs.existsSync(skuDir)) { console.error(`SKU folder not found: ${skuDir}`); process.exit(1); }

  const briefPath = path.join(skuDir, 'brief.json');
  if (!fs.existsSync(briefPath)) { console.error(`brief.json not found: ${briefPath}`); process.exit(1); }
  const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));

  const refCatalog = brief.ref_catalog || {};
  const keys = Object.keys(refCatalog);
  if (keys.length === 0) { console.error('brief.ref_catalog is empty — nothing to retouch.'); process.exit(1); }

  const outDir = path.join(skuDir, 'product-bright');
  fs.mkdirSync(outDir, { recursive: true });

  const targets = flags.sample ? [SAMPLE_KEY] : keys;
  if (flags.sample && !refCatalog[SAMPLE_KEY]) {
    console.error(`Sample key "${SAMPLE_KEY}" not in ref_catalog. Available: ${keys.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n[Retouch] SKU dir   : ${skuDir}`);
  console.log(`[Retouch] Mode      : ${flags.sample ? 'SAMPLE (1 ref)' : `ALL (${keys.length} refs)`}`);
  console.log(`[Retouch] Profile   : sat=${profile.saturation} hue=${profile.hue} bright=${profile.brightness} linear=${profile.linearMul}/${profile.linearOff}`);
  console.log(`[Retouch] Normalize : ${flags.normalize ? 'YES (strip EXIF orientation)' : 'no'}`);
  console.log(`[Retouch] Output    : ${outDir}\n`);

  let ok = 0, fail = 0;
  // Always read from product/ (original photos), write to product-bright/.
  // brief.ref_catalog may point at product-bright/ already (after earlier brief edit) —
  // we only use it to learn WHICH filenames to retouch.
  const productOriginalDir = path.join(skuDir, 'product');
  for (const key of targets) {
    const relSrc = refCatalog[key];
    const filename = path.basename(relSrc);
    const srcAbs = path.join(productOriginalDir, filename);
    if (!fs.existsSync(srcAbs)) {
      console.error(`  [XX] ${key} — source missing: ${srcAbs}`);
      fail++;
      continue;
    }
    const dstAbs = path.join(outDir, filename);
    try {
      await retouchOne(srcAbs, dstAbs, profile, flags.normalize);
      const srcKb = (fs.statSync(srcAbs).size / 1024).toFixed(0);
      const dstKb = (fs.statSync(dstAbs).size / 1024).toFixed(0);
      console.log(`  [OK] ${key}: ${filename} (${srcKb}KB → ${dstKb}KB)`);
      ok++;
    } catch (err) {
      console.error(`  [XX] ${key}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n[Retouch] Done — ${ok} ok, ${fail} fail.`);
  if (flags.sample) {
    console.log(`[Retouch] QC the sample, then re-run with --all (or tweak profile via --saturation / --hue / --brightness).`);
  } else {
    console.log(`[Retouch] Update brief.json: replace "product/" → "product-bright/" in input_images[] and ref_catalog.*`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('[Retouch] Fatal:', err.message);
  process.exit(1);
});
