const fs = require('fs');
const path = require('path');

const { ensureSize } = require('../utils/image-utils');
const { saveProgress, checkpointResult } = require('../utils/checkpoint');
const { runTasks } = require('../utils/pipeline-helpers');

/**
 * Listing Pipeline (Direct-Ref)
 * All 8 slots: upload product ref photos to nano-banana-2 + prompt → AI generates complete image → ensureSize.
 * No background removal, no composite, no callout graphics.
 */
class DirectRefPipeline {
  constructor({ kie, imageGen, log, projectRoot, sequential }) {
    this.kie = kie;
    this.imageGen = imageGen;
    this.log = log;
    this.projectRoot = projectRoot;
    this.sequential = sequential;
  }

  async run(brief, dna, theme, specs, outDir, inputImages) {
    const mode = this.sequential ? 'SEQUENTIAL' : 'PARALLEL';
    this.log.info(`Phase 2: Listing (8 Slots) — ${mode}`);

    const slotNums = [1, 2, 3, 4, 5, 6, 7, 8];
    const tasks = slotNums.map(n =>
      () => this._generate(n, brief, dna, theme, outDir, specs, inputImages)
    );

    const results = await runTasks(tasks, slotNums.map(n => ({ slot: n })), this.sequential);
    this.log.info(`Listing: ${results.filter(r => r.success).length}/8 slots OK`);
    return results;
  }

  async _generate(num, brief, dna, theme, outDir, specs, inputImages) {
    const cached = checkpointResult(outDir, `slot${num}`, this.log);
    if (cached) return cached;

    const names = { 1:'main', 2:'in-use', 3:'features', 4:'use-case', 5:'size-scale', 6:'gift-set', 7:'emotional', 8:'lifestyle-close' };
    const slotName = (num === 8 ? brief.slot8_type : null) || names[num];
    this.log.info(`[Slot ${num}] ${slotName} — generating`);

    const rawPath = path.join(outDir, `${brief.sku}_slot${num}_raw.jpg`);
    const finalPath = path.join(outDir, `${brief.sku}_slot${num}_${slotName}.jpg`);

    try {
      const prompt = this.imageGen.buildDirectRefPrompt(num, brief, dna, theme);
      const gen = await this.imageGen.generate(prompt, rawPath, {
        aspectRatio: '1:1', referenceImages: inputImages.slice(0, 5), brief, slotNumber: num
      });
      if (!gen.success) return { slot: num, success: false, reason: gen.error };

      await ensureSize(rawPath, specs.listing.width, specs.listing.height, specs.listing.quality, finalPath);
      if (fs.existsSync(rawPath) && rawPath !== finalPath) fs.unlinkSync(rawPath);

      // QC metrics — soft warning, doesn't block
      try {
        const QCMetrics = require('../utils/qc-metrics');
        const qc = new QCMetrics();
        const metrics = await qc.analyze(finalPath, num);
        const flags = qc.flag(metrics, num);
        if (flags.length > 0) {
          this.log.warn({ slot: num, flags }, `[QC] Slot ${num} has ${flags.length} flags`);
        }
        const metricsPath = path.join(outDir, `${brief.sku}_slot${num}_metrics.json`);
        fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
      } catch (err) {
        this.log.warn({ err: err.message }, `QC metrics failed for slot ${num}`);
      }

      this.log.info(`[Slot ${num}] OK`);
      const result = { slot: num, success: true, path: finalPath, mode: 'direct-ref' };
      saveProgress(outDir, `slot${num}`, result);
      return result;
    } catch (err) {
      this.log.error(`[Slot ${num}] Error: ${err.message}`);
      return { slot: num, success: false, reason: err.message };
    }
  }
}

module.exports = DirectRefPipeline;
