const fs = require('fs');
const path = require('path');

function progressPath(outputDir) {
  return path.join(outputDir, '_progress.json');
}

function loadProgress(outputDir) {
  const p = progressPath(outputDir);
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
  }
  return {};
}

function saveProgress(outputDir, key, data) {
  const p = progressPath(outputDir);
  const progress = loadProgress(outputDir);
  progress[key] = { ...data, completedAt: new Date().toISOString() };
  fs.writeFileSync(p, JSON.stringify(progress, null, 2));
}

/**
 * Check if a slot/module is already completed with a valid output file.
 * Returns the cached result if done, or null if needs (re)generation.
 */
function checkpointResult(outputDir, key, log) {
  const progress = loadProgress(outputDir);
  const entry = progress[key];
  if (entry && entry.success && entry.path && fs.existsSync(entry.path)) {
    if (log) log.info(`[Checkpoint] ${key} — skipping (already completed)`);
    return entry;
  }
  return null;
}

/** Clean up temp refs after pipeline */
function cleanupTemp(tempDir) {
  if (tempDir && fs.existsSync(tempDir)) {
    try { fs.rmSync(tempDir, { recursive: true }); } catch (e) { /* ignore */ }
  }
}

/**
 * Remove specific slot/module entries from _progress.json AND delete their
 * output files so the pipeline regenerates them on next run.
 * Used by master.js --skip-slots flag. Safer than hand-editing JSON.
 *
 * @param {string} outputDir - e.g. output/SKU/listing
 * @param {string[]} keys - e.g. ['slot2', 'slot4'] or ['aplus_m1']
 * @param {object} [log]
 */
function clearSlots(outputDir, keys, log) {
  if (!keys || keys.length === 0) return;
  const progress = loadProgress(outputDir);
  const cleared = [];
  for (const key of keys) {
    const entry = progress[key];
    if (entry && entry.path && fs.existsSync(entry.path)) {
      try { fs.unlinkSync(entry.path); } catch { /* ignore */ }
    }
    if (progress[key]) {
      delete progress[key];
      cleared.push(key);
    }
  }
  if (cleared.length) {
    fs.writeFileSync(progressPath(outputDir), JSON.stringify(progress, null, 2));
    if (log && log.info) log.info({ cleared }, `[Checkpoint] cleared ${cleared.length} entries — will regenerate`);
  }
}

module.exports = { progressPath, loadProgress, saveProgress, checkpointResult, cleanupTemp, clearSlots };
