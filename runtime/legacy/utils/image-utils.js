const sharp = require('sharp');
const fs = require('fs');

sharp.cache(false); // Prevent Windows EBUSY/EPERM file locks

/**
 * Image Utilities — Simplified
 * Only: ensureSize, compositeWithText, generateTextSVG, createAplusModule
 * BG removal, composite, callout graphics have been removed.
 */

async function compositeWithText(backgroundPath, textLayers, outputPath, options = {}) {
  const { width = 2000, height = 2000, quality = 95 } = options;
  let pipeline = sharp(backgroundPath).resize(width, height, { fit: 'cover' });

  const composites = textLayers.map(layer => ({
    input: Buffer.from(generateTextSVG(layer)),
    top: layer.y || 0,
    left: layer.x || 0
  }));

  if (composites.length) pipeline = pipeline.composite(composites);
  await pipeline.jpeg({ quality }).toFile(outputPath);
  console.log(`[Compositor] Created: ${outputPath}`);
  return outputPath;
}

function generateTextSVG(layer) {
  const {
    text = '', fontSize = 48, fontFamily = 'Arial', fontWeight = 'bold',
    color = '#FFFFFF', maxWidth = 800, lineHeight = 1.3, textAlign = 'left',
    shadow = false, bgColor = null, bgPadding = 20,
    width: svgWidth = 900, height: svgHeight = 200
  } = layer;

  const charsPerLine = Math.floor(maxWidth / (fontSize * 0.55));
  const lines = [];
  for (const paragraph of String(text).split(/\n+/)) {
    const words = paragraph.split(' ');
    let cur = '';
    for (const w of words) {
      if ((cur+' '+w).trim().length > charsPerLine && cur) { lines.push(cur.trim()); cur = w; }
      else cur = (cur+' '+w).trim();
    }
    if (cur) lines.push(cur.trim());
  }

  const totalH = lines.length * fontSize * lineHeight;
  const anchor = textAlign==='center' ? 'middle' : textAlign==='right' ? 'end' : 'start';
  const xPos = textAlign==='center' ? svgWidth/2 : textAlign==='right' ? svgWidth-20 : 20;

  const bgRect = bgColor ? `<rect x="0" y="0" width="${svgWidth}" height="${totalH+bgPadding*2}" rx="12" fill="${bgColor}" opacity="0.9"/>` : '';
  const shadowDef = shadow ? `<filter id="s"><feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.5"/></filter>` : '';
  const fAttr = shadow ? ' filter="url(#s)"' : '';

  const elems = lines.map((l, i) => {
    const y = (bgPadding||0) + fontSize + i*fontSize*lineHeight;
    return `<text x="${xPos}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}" text-anchor="${anchor}"${fAttr}>${escapeXml(l)}</text>`;
  }).join('');

  return `<svg width="${svgWidth}" height="${Math.ceil(totalH+(bgPadding||0)*2+20)}" xmlns="http://www.w3.org/2000/svg"><defs>${shadowDef}</defs>${bgRect}${elems}</svg>`;
}

function escapeXml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

async function createAplusModule(backgroundPath, textLayers, outputPath) {
  const meta = await sharp(backgroundPath).metadata();
  const width = meta.width || 1464;
  const height = meta.height || 600;
  const sx = width / 1464;
  const sy = height / 600;
  const scaledLayers = textLayers.map(layer => ({
    ...layer,
    x: Math.round((layer.x || 0) * sx),
    y: Math.round((layer.y || 0) * sy),
    fontSize: Math.round((layer.fontSize || 48) * Math.min(sx, sy)),
    maxWidth: Math.round((layer.maxWidth || layer.width || 800) * sx),
    width: Math.round((layer.width || 900) * sx),
    height: Math.round((layer.height || 200) * sy),
    bgPadding: layer.bgPadding == null ? layer.bgPadding : Math.round(layer.bgPadding * Math.min(sx, sy))
  }));
  return compositeWithText(backgroundPath, scaledLayers, outputPath, { width, height });
}

/**
 * Ensure exact output dimensions — called as final step on ALL outputs.
 */
async function ensureSize(inputPath, targetWidth, targetHeight, quality = 95, outputPath = null) {
  const out = outputPath || inputPath;
  const meta = await sharp(inputPath).metadata();

  if (meta.width !== targetWidth || meta.height !== targetHeight) {
    const tmpPath = inputPath + '.tmp.jpg';
    await sharp(inputPath)
      .rotate() // Auto-rotate by EXIF orientation
      .resize(targetWidth, targetHeight, { fit: 'cover' })
      .jpeg({ quality })
      .toFile(tmpPath);

    if (outputPath && outputPath !== inputPath) {
      fs.renameSync(tmpPath, outputPath);
    } else {
      fs.renameSync(tmpPath, inputPath);
    }
    console.log(`[Resize] ${meta.width}x${meta.height} → ${targetWidth}x${targetHeight}`);
  } else if (outputPath && outputPath !== inputPath) {
    fs.copyFileSync(inputPath, outputPath);
  }
}

module.exports = {
  compositeWithText, generateTextSVG,
  createAplusModule, ensureSize
};
