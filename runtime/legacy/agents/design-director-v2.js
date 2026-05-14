const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const DesignDirectorV1 = require('./design-director');

/**
 * Design Director V2 — Vision-aware wrapper around v1.
 *
 * Pause/resume pattern (mirrors web research gate):
 *   1. Collect product + competitor reference paths from brief
 *   2. No result file yet → write request JSON, return paused=true
 *   3. Claude Code reads request, looks at images via Read tool,
 *      applies doctrine F1-F8 + Seduction Gate, writes result JSON
 *   4. Re-run master.js → v2 detects result → merges into DNA v2
 *
 * Falls back to v1 when:
 *   - options.visionDirector === false
 *   - No reference images on disk
 *   - Existing result file fails to parse
 */
class DesignDirectorV2 {
  constructor() {
    this.log = createLogger('DesignDirectorV2');
    this.v1 = new DesignDirectorV1();
  }

  generateDesignDNA(brief, theme, ctx, options = {}) {
    const enabled = options.visionDirector !== false;
    const researchDir = ctx?.researchDir || path.join(process.cwd(), 'output', brief.sku);
    if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });

    const requestPath = path.join(researchDir, '_design_director_request.json');
    const resultPath = path.join(researchDir, '_design_director_result.json');

    const refPaths = this._collectReferences(brief, ctx);
    if (!enabled || refPaths.length === 0) {
      this.log.info('Vision Director skipped — v1 fallback');
      const dnaV1 = this.v1.generateDesignDNA(brief, theme);
      return { dna: this._applyBrand(this._upgradeV1(dnaV1), brief), paused: false };
    }

    if (fs.existsSync(resultPath)) {
      try {
        const visionResult = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        const dnaV1 = this.v1.generateDesignDNA(brief, theme);
        const dna = this._mergeVision(dnaV1, visionResult);
        this.log.info('Vision Director: result merged');
        return { dna: this._applyBrand(dna, brief), paused: false };
      } catch (err) {
        this.log.warn({ err: err.message }, 'Vision result invalid — v1 fallback');
        return { dna: this._applyBrand(this._upgradeV1(this.v1.generateDesignDNA(brief, theme)), brief), paused: false };
      }
    }

    this._writeRequest(requestPath, brief, theme, refPaths);
    this._printPause(requestPath, resultPath);
    return { dna: null, paused: true, reason: 'vision-director-pending', requestPath, resultPath };
  }

  _applyBrand(dna, brief) {
    if (!brief.brand_id) return dna;
    const brandLoader = require('../utils/brand-style-loader');
    const brandStyle = brandLoader.loadBrandStyle(brief.brand_id);
    if (!brandStyle) return dna;
    const merged = brandLoader.mergeIntoDNA(dna, brandStyle);
    this.log.info({ brand_id: brief.brand_id }, 'Brand style merged into DNA');
    return merged;
  }

  _collectReferences(brief, ctx) {
    const refs = [];
    const baseDir = ctx?.skuDir || process.cwd();
    for (const p of (brief.input_images || [])) {
      const abs = path.resolve(baseDir, p);
      if (fs.existsSync(abs)) refs.push({ type: 'product', path: abs });
    }
    for (const p of (brief.listing_templates || [])) {
      const abs = path.resolve(baseDir, p);
      if (fs.existsSync(abs)) refs.push({ type: 'competitor', path: abs });
    }
    return refs.slice(0, 8);
  }

  _writeRequest(requestPath, brief, theme, refPaths) {
    const request = {
      _doc: 'Vision Director request. Claude Code reads images, applies doctrine F1-F8 + Seduction Gate, writes _design_director_result.json.',
      _schema_version: 2,
      sku: brief.sku,
      product: {
        name: brief.product_name,
        category: brief.category,
        materials: brief.materials,
        dimensions: brief.dimensions,
        features: brief.features,
        usp: brief.usp,
        occasion: brief.occasion,
        target_audience: brief.target_audience
      },
      reference_images: refPaths.map(r => ({
        type: r.type,
        path: r.path,
        instruction: r.type === 'product'
          ? 'Actual product. Read frozen elements F1-F8 from doctrine.'
          : 'Competitor listing. Extract style cues, lighting, composition. DO NOT copy text or layout.'
      })),
      theme_hint: {
        occasion: brief.occasion,
        seasonal: brief.seasonal_theme,
        mood: theme.mood,
        colors: theme.colors
      },
      output_schema: {
        art_direction: {
          style_reference: 'string — 1 sentence, e.g. "Kinfolk warm minimal, 85mm shallow DoF, golden hour rim"',
          lighting_recipe: 'string — directional setup, color temp, key/fill/rim',
          composition_principle: 'string — rule of thirds, leading lines, negative space %',
          color_grading: 'string — film stock or grading description',
          mood_descriptor: 'string — 3-5 words'
        },
        hook_per_slot: { 1: 'string', 2: 'string', 3: 'string', 4: 'string', 5: 'string', 6: 'string', 7: 'string', 8: 'string' },
        cohesion_anchors: {
          props: 'array of 3-5 props recurring across slots',
          lighting_key: 'string — the one lighting setup all 8 slots share',
          color_anchors: 'array of 3 hex colors — primary, secondary, accent'
        },
        product_observations: {
          frozen_elements: 'array — F1-F8 elements observed, MUST be preserved',
          unique_selling_visual: 'string — what is visually distinctive about this product'
        }
      },
      doctrine_reference: 'knowledge/doctrine/handmade-product-doctrine.md sections 1.1 (F1-F8) and 3.0 (Seduction Gate)'
    };
    fs.writeFileSync(requestPath, JSON.stringify(request, null, 2));
  }

  _printPause(requestPath, resultPath) {
    this.log.info('═══════════════════════════════════════════════════════════');
    this.log.info('PAUSE: Vision Design Director needs Claude Code Vision.');
    this.log.info(`  1. Read ${requestPath}`);
    this.log.info('  2. Use Read tool on every image in reference_images[]');
    this.log.info('  3. Apply doctrine F1-F8 + Seduction Gate per slot');
    this.log.info(`  4. Write structured JSON to ${resultPath}`);
    this.log.info('  5. Re-run master.js — pipeline detects result and continues');
    this.log.info('═══════════════════════════════════════════════════════════');
  }

  _mergeVision(dnaV1, visionResult) {
    return {
      ...dnaV1,
      v: 2,
      art_direction: visionResult.art_direction || null,
      hook_per_slot: visionResult.hook_per_slot || {},
      cohesion_anchors: visionResult.cohesion_anchors || null,
      product_observations: visionResult.product_observations || null,
      themeAnchors: visionResult.cohesion_anchors ? {
        ...dnaV1.themeAnchors,
        lightingKey: visionResult.cohesion_anchors.lighting_key || dnaV1.themeAnchors?.lightingKey,
        propPalette: visionResult.cohesion_anchors.props || dnaV1.themeAnchors?.propPalette
      } : dnaV1.themeAnchors,
      _vision_director_used: true,
      createdAt: new Date().toISOString()
    };
  }

  _upgradeV1(dnaV1) {
    return {
      ...dnaV1,
      v: 2,
      art_direction: null,
      hook_per_slot: {},
      cohesion_anchors: null,
      product_observations: null,
      _vision_director_used: false
    };
  }

  saveDNA(dna, outputDir) {
    return this.v1.saveDNA(dna, outputDir);
  }
}

module.exports = DesignDirectorV2;
