const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');

/**
 * Cohesion Validator — Phase 2.5 post-listing pause/resume Vision check.
 *
 * Doctrine 2.1.2 [SET_COHERENCE_OK] stamp had no implementation before this.
 * Validator asks Claude Code to look at all 8 listing images and score
 * 4 dimensions (color / lighting / prop_style / mood) + identify drift.
 *
 * Soft enforcement: warns on drift, pipeline continues. User fixes via
 * --skip-slots slot{n} to regen the drift slot.
 */
class CohesionValidator {
  constructor() {
    this.log = createLogger('CohesionValidator');
  }

  validate(brief, listingResults, ctx, options = {}) {
    const enabled = options.cohesionValidator !== false;
    if (!enabled) return { ready: true, paused: false, reason: 'disabled' };

    const successSlots = (listingResults || []).filter(r => r && r.success);
    if (successSlots.length < 6) {
      this.log.info(`Only ${successSlots.length}/8 slots succeeded — skipping validator`);
      return { ready: true, paused: false, reason: 'insufficient-slots' };
    }

    const researchDir = ctx?.researchDir || path.join(process.cwd(), 'output', brief.sku);
    if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });

    const requestPath = path.join(researchDir, '_cohesion_request.json');
    const reportPath = path.join(researchDir, '_cohesion_report.json');

    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        this._processReport(report);
        return { ready: true, paused: false, report, reason: 'report-loaded' };
      } catch (err) {
        this.log.warn({ err: err.message }, 'Cohesion report invalid');
        return { ready: true, paused: false, reason: 'parse-error' };
      }
    }

    this._writeRequest(requestPath, brief, successSlots);
    this._printPause(requestPath, reportPath);
    return { ready: false, paused: true, reason: 'cohesion-validation-pending', requestPath, reportPath };
  }

  _writeRequest(requestPath, brief, slots) {
    const request = {
      _doc: 'Cohesion Validator. Claude Code reviews 8 slots, scores 4 dimensions, identifies drift, writes _cohesion_report.json.',
      _schema_version: 1,
      sku: brief.sku,
      slots: slots.map(s => ({ slot: s.slot, path: s.path })),
      scoring_dimensions: {
        color: 'Are color palettes consistent across all 8?',
        lighting: 'Is lighting key consistent (direction, temperature, hard/soft)?',
        prop_style: 'Are props consistent (same palette, same discipline)?',
        mood: 'Is mood register consistent (warm/cold, calm/busy)?'
      },
      output_schema: {
        scores: { color: '0-10', lighting: '0-10', prop_style: '0-10', mood: '0-10', overall: '0-10' },
        most_drift_slot: 'integer 1-8',
        drift_reason: 'string — one sentence why this slot drifts',
        recommendation: 'string — what to change',
        pass: 'boolean — true if overall >= 7'
      }
    };
    fs.writeFileSync(requestPath, JSON.stringify(request, null, 2));
  }

  _printPause(requestPath, reportPath) {
    this.log.info('═══════════════════════════════════════════════════════════');
    this.log.info('PAUSE: Cohesion Validation needs Claude Code Vision.');
    this.log.info(`  1. Read ${requestPath}`);
    this.log.info('  2. Read all 8 listing images via Read tool');
    this.log.info('  3. Score 4 dimensions: color, lighting, prop_style, mood');
    this.log.info('  4. Identify most-drift slot + reason');
    this.log.info(`  5. Write report to ${reportPath}`);
    this.log.info('  6. Re-run master.js — pipeline reads report and continues');
    this.log.info('═══════════════════════════════════════════════════════════');
  }

  _processReport(report) {
    const overall = report.scores?.overall || 0;
    if (overall >= 7) {
      this.log.info({ scores: report.scores }, `[SET_COHERENCE_OK] ${overall}/10 PASS`);
    } else {
      this.log.warn(
        { scores: report.scores, drift: report.most_drift_slot, reason: report.drift_reason, fix: report.recommendation },
        `[SET_COHERENCE_FAIL] ${overall}/10 — slot ${report.most_drift_slot} drifts. Run --skip-slots slot${report.most_drift_slot} to regen.`
      );
    }
  }
}

module.exports = CohesionValidator;
