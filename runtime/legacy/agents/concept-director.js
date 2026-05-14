const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { loadFunnel } = require('../utils/funnel-loader');

/**
 * Concept Director — Phase 1.5 Seduction Gate concept brainstorm.
 *
 * Pause/resume pattern:
 *   1. After DD v2 produces art_direction in DNA
 *   2. Write request with brief + art_direction + funnel + Seduction Gate template
 *   3. No result file → pause
 *   4. Claude Code brainstorms 3 concepts per slot, scores Seduction Gate, picks best
 *   5. Writes _slot_concepts_v2.json
 *   6. Re-run master.js → merges into brief.slot_concepts
 *
 * Auto-skip when:
 *   - options.conceptBrainstorm === false
 *   - User-provided slot_concepts already exist (≥4 slots)
 *   - DNA has no art_direction (DD v1 fallback)
 */
class ConceptDirector {
  constructor() {
    this.log = createLogger('ConceptDirector');
  }

  ensureConcepts(brief, dna, ctx, options = {}) {
    const enabled = options.conceptBrainstorm !== false;
    if (!enabled) return { ready: true, paused: false, brief, reason: 'disabled' };

    if (brief.slot_concepts && Object.keys(brief.slot_concepts).length >= 4) {
      this.log.info('User-provided slot_concepts present, skipping');
      return { ready: true, paused: false, brief, reason: 'user-provided' };
    }

    if (!dna || !dna.art_direction) {
      this.log.info('No art_direction in DNA, skipping');
      return { ready: true, paused: false, brief, reason: 'no-art-direction' };
    }

    const researchDir = ctx?.researchDir || path.join(process.cwd(), 'output', brief.sku);
    if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });

    const requestPath = path.join(researchDir, '_concept_brainstorm_request.json');
    const resultPath = path.join(researchDir, '_slot_concepts_v2.json');

    if (fs.existsSync(resultPath)) {
      try {
        const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        const raw = result.slot_concepts || result;
        // Flatten picked_concept to flat format — slot builders in image-generator.js
        // read concept.scene / concept.style directly, so we must unwrap the v2
        // nested structure {concepts, picked, picked_concept} → picked_concept fields.
        const flat = {};
        for (const [k, v] of Object.entries(raw)) {
          flat[k] = (v && v.picked_concept) ? v.picked_concept : v;
        }
        const merged = { ...brief, slot_concepts: flat };
        this.log.info('Concept brainstorm result merged (picked_concept flattened)');
        return { ready: true, paused: false, brief: merged, reason: 'merged' };
      } catch (err) {
        this.log.warn({ err: err.message }, 'Concept result invalid, continuing with original brief');
        return { ready: true, paused: false, brief, reason: 'parse-error' };
      }
    }

    this._writeRequest(requestPath, brief, dna);
    this._printPause(requestPath, resultPath);
    return { ready: false, paused: true, reason: 'concept-brainstorm-pending', requestPath, resultPath };
  }

  _writeRequest(requestPath, brief, dna) {
    const funnel = loadFunnel(brief.category || 'mixed');
    const request = {
      _doc: 'Concept Brainstorm. Claude Code brainstorms 3 concepts/slot, scores via Seduction Gate, picks best, writes _slot_concepts_v2.json.',
      _schema_version: 2,
      sku: brief.sku,
      brief_summary: {
        product_name: brief.product_name,
        category: brief.category,
        usp: brief.usp,
        occasion: brief.occasion,
        target_audience: brief.target_audience,
        features: brief.features
      },
      art_direction: dna.art_direction,
      hook_per_slot: dna.hook_per_slot,
      cohesion_anchors: dna.cohesion_anchors,
      product_observations: dna.product_observations,
      funnel: { category: funnel.category, slots: funnel.slots },
      seduction_gate_template: {
        WHO: 'Ai mua slot này nhắm tới? Trạng thái cảm xúc?',
        PAIN: 'Nỗi đau bền vững nào slot này chạm vào?',
        HOOK: 'Yếu tố visual nào bắt mắt 0.8s đầu?',
        PROOF: 'Scene chứng minh điều gì về sản phẩm?',
        FEEL: 'Cảm xúc cuối khi xem xong?'
      },
      output_schema: {
        slot_concepts: {
          slot1: {
            concepts: '[3 variants, each with scene/style/hook_element/seduction_scores]',
            picked: 'integer 1-3',
            picked_concept: 'object with scene, style, hook_element, props'
          },
          'slot2-slot8': '...same structure'
        }
      },
      doctrine_reference: 'doctrine 3.0 (Seduction Gate brief-time) and 3.1 (per-slot question mapping)'
    };
    fs.writeFileSync(requestPath, JSON.stringify(request, null, 2));
  }

  _printPause(requestPath, resultPath) {
    this.log.info('═══════════════════════════════════════════════════════════');
    this.log.info('PAUSE: Concept Brainstorm needs Claude Code.');
    this.log.info(`  1. Read ${requestPath}`);
    this.log.info('  2. For each of 8 slots, brainstorm 3 concept variants');
    this.log.info('  3. Score via Seduction Gate WHO/PAIN/HOOK/PROOF/FEEL ≥4/5');
    this.log.info('  4. Pick highest-scoring per slot');
    this.log.info(`  5. Write structured JSON to ${resultPath}`);
    this.log.info('  6. Re-run master.js — pipeline continues');
    this.log.info('═══════════════════════════════════════════════════════════');
  }
}

module.exports = ConceptDirector;
