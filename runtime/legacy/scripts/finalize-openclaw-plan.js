#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function usage() {
  console.error('Usage: node runtime/legacy/scripts/finalize-openclaw-plan.js <_openclaw_plan.json>');
  process.exit(2);
}

async function ensureSize(inputPath, width, height) {
  const tmp = `${inputPath}.tmp-${Date.now()}.jpg`;
  await sharp(inputPath)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 95 })
    .toFile(tmp);
  fs.renameSync(tmp, inputPath);
}

function loadProgress(dir) {
  const p = path.join(dir, '_progress.json');
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function saveProgress(dir, progress) {
  fs.writeFileSync(path.join(dir, '_progress.json'), JSON.stringify(progress, null, 2));
}

async function main() {
  const planPath = process.argv[2];
  if (!planPath) usage();
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const dir = path.dirname(planPath);
  const progress = loadProgress(dir);
  let ok = 0;
  let missing = 0;

  for (const item of plan.items || []) {
    const out = item.outputPath;
    const key = item.kind === 'listing' ? `slot${item.slot}` : `aplus_m${item.module}`;
    if (!out || !fs.existsSync(out)) {
      progress[key] = {
        success: false,
        reason: 'openclaw_output_missing',
        expectedPath: out,
        completedAt: new Date().toISOString(),
      };
      missing++;
      continue;
    }
    if (item.targetSize?.width && item.targetSize?.height) {
      await ensureSize(out, item.targetSize.width, item.targetSize.height);
    }
    progress[key] = {
      success: true,
      path: out,
      mode: 'openclaw-image-generate',
      model: plan.model || 'default',
      completedAt: new Date().toISOString(),
    };
    ok++;
  }

  saveProgress(dir, progress);
  console.log(JSON.stringify({ ok, missing, progressPath: path.join(dir, '_progress.json') }, null, 2));
  process.exit(missing ? 1 : 0);
}

main().catch(err => {
  console.error(`[finalize-openclaw-plan] ${err.message}`);
  process.exit(1);
});
