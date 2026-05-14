const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const promptGuard = require('../utils/prompt-guard');

/**
 * Image Generator Agent v5
 * Strategy: Brief data + slot_concepts → dynamic prompt builder → AI generates scene
 * slot_concepts come from auto-research Vision analysis of competitor Listing-temp images
 * API: KIE.ai nano-banana-pro (async: createTask → poll → download)
 *
 * Prompt Guard integration:
 *   - _structureRules() uses promptGuard.shouldInject() to decide whether to append
 *     product_structure / see_through_cutout_rule / lighting_harmony_rule / critical_structure.
 *   - Each direct-ref slot prompt is run through promptGuard.sanitize() before return.
 *   - Anti-patterns and per-slot limits live in config/prompts/slot-constraints.json
 *     and xp/prompt-anti-patterns.md.
 */
class ImageGenerator {
  constructor(kieClient) {
    this.kie = kieClient;
    this.retryMax = 3;
    this._creativeZoneHint = '';
    this._promptConfig = this._loadPromptConfig();
    this._funnelLoader = require('../utils/funnel-loader');
  }

  _funnelForBrief(brief) {
    return this._funnelLoader.loadFunnel(brief.category || 'mixed');
  }

  _loadPromptConfig() {
    const configPath = path.join(__dirname, '..', 'config', 'prompts', 'slot-prompts.json');
    try {
      if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.warn(`[ImageGen] Could not load prompt config: ${e.message}. Using built-in defaults.`);
    }
    return {};
  }

  setDesignDNA(dna) {
    // Negative prompt now sourced from dna directly (was via productLock)
    if (dna._negativePrompt) {
      this._negativePrompt = dna._negativePrompt;
    }
    if (dna.creativeZones?.zoneInstruction) {
      this._creativeZoneHint = dna.creativeZones.zoneInstruction;
    }
    this._knowledgeHints = dna.knowledgeHints || null;
  }

  /**
   * Pick up to 1 short knowledge tip (≤12 words) for a given slot.
   * Returns '' if none fit — safe no-op when knowledge base is empty.
   * Called from _finalizePrompt AFTER scene composition but BEFORE sanitize,
   * so prompt-guard still enforces word limits and strips violations.
   */
  _knowledgeTipFor(slotNumber) {
    const k = this._knowledgeHints;
    if (!k) return '';
    const slotBucket = {
      1: ['hero', 'white', 'main', 'clean', 'studio', 'shadow', 'centered', 'reference', 'fidelity'],
      2: ['lifestyle', 'scene', 'context', 'environment', 'desk', 'home'],
      3: ['feature', 'infograph', 'callout', 'detail', 'usp', 'construction'],
      4: ['use', 'case', 'demo', 'function', 'insertion', 'mechanism'],
      5: ['size', 'scale', 'dimension', 'measurement', 'reference', 'infograph'],
      6: ['gift', 'flat', 'lay', 'set', 'overhead', 'flatlay'],
      7: ['emotional', 'family', 'gift-giving', 'moment', 'recipient'],
      8: ['lifestyle', 'close', 'closeup', 'macro', 'detail', 'finish']
    }[slotNumber] || [];
    const rawAll = [...(k.photographyTips || []), ...(k.conversionTactics || []), ...(k.generalRules || [])];
    const all = rawAll.map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.rule || item.tip || item.text || '';
      return '';
    });
    const candidates = all.filter(t => {
      const wc = (t || '').trim().split(/\s+/).filter(Boolean).length;
      // Allow tips up to 18 words (was 12) — still safe under slot 1 max_words 80.
      if (wc === 0 || wc > 18) return false;
      const lower = t.toLowerCase();
      return slotBucket.some(kw => lower.includes(kw));
    });
    return candidates[0] ? ` ${candidates[0]}.` : '';
  }

  // ═══════════════════════════════════════
  //  UPLOAD — KIE.ai File Upload API
  // ═══════════════════════════════════════

  async uploadImage(localPath) {
    // Real product photos (input/product/*) uploaded at high-res to preserve
    // pennant, handprint, engraving, and other fidelity-critical details.
    // Default 768/85 caused compound hallucination when refs compressed to ~70KB.
    const isRealProduct = /[\\/]input[\\/]product[\\/]/.test(localPath);
    const opts = isRealProduct
      ? { maxSize: 2048, quality: 100, format: 'png' }
      : { maxSize: 2048, quality: 100, format: 'png' };
    return this.kie.uploadFromLocal(localPath, 'product-refs', opts);
  }

  // ═══════════════════════════════════════
  //  GENERATE — KIE.ai nano-banana-pro (async)
  // ═══════════════════════════════════════

  /**
   * Build per-model KIE input payload.
   *
   * gpt-image-2-image-to-image uses a different schema than the other image
   * models on KIE:
   *   - input_urls  (not image_input)
   *   - nsfw_checker
   *   - no resolution / aspect_ratio / output_format / negative_prompt
   *
   * Keeping this in one place lets model-routing + slot_model_override route any
   * slot to gpt-image-2 without the caller needing to know the payload shape.
   *
   * @param {string} model
   * @param {string} prompt
   * @param {string[]} imageUrls
   * @param {string} aspectRatio
   * @returns {Object} KIE task input
   */
  _buildModelInput(model, prompt, imageUrls, aspectRatio) {
    if (model === 'gpt-image-2-image-to-image') {
      const input = { prompt, nsfw_checker: true };
      if (imageUrls.length > 0) input.input_urls = imageUrls;
      return input;
    }
    const input = {
      prompt,
      resolution: '2K',
      aspect_ratio: aspectRatio,
      output_format: 'jpg'
    };
    if (imageUrls.length > 0) input.image_input = imageUrls;
    if (this._negativePrompt) input.negative_prompt = this._negativePrompt;
    return input;
  }

  async generate(prompt, outputPath, options = {}) {
    const { aspectRatio = '1:1', referenceImages = [], brief = {}, slotNumber = null } = options;

    const router = require('../utils/model-router');
    const isNumericSlot = typeof slotNumber === 'number';
    const model = isNumericSlot ? router.modelForSlot(slotNumber, brief) : 'nano-banana-pro';
    const maxRefs = router.maxRefsForModel(model);

    console.log(`[ImageGen] Slot ${slotNumber ?? '?'} via ${model}: "${prompt.substring(0, 100)}..."`);
    console.log(`[ImageGen] Refs: ${Math.min(referenceImages.length, maxRefs)}/${referenceImages.length}`);

    try {
      const imageUrls = [];
      for (const img of referenceImages.slice(0, maxRefs)) {
        imageUrls.push(img.startsWith('http') ? img : await this.uploadImage(img));
      }

      // Try primary + fallback chain (only when slot is numeric; string slots like
      // 'aplus_m1' stay on default single-model path to preserve legacy behavior).
      // Input is rebuilt per model because gpt-image-2-image-to-image uses
      // input_urls/nsfw_checker while other models use image_input/resolution/aspect_ratio.
      let result;
      let lastErr;
      let modelUsed = model;
      if (isNumericSlot) {
        const chain = [model, ...router.fallbackChain().filter(m => m !== model)];
        for (const tryModel of chain) {
          try {
            const tryInput = this._buildModelInput(tryModel, prompt, imageUrls, aspectRatio);
            result = await this.kie.run(tryModel, tryInput);
            if (tryModel !== model) {
              console.warn(`[ImageGen] Slot ${slotNumber}: ${model} failed — fallback ${tryModel}`);
            }
            modelUsed = tryModel;
            break;
          } catch (err) {
            lastErr = err;
            console.warn(`[ImageGen] ${tryModel} failed: ${err.message}`);
          }
        }
        if (!result) throw lastErr || new Error('All models failed');
      } else {
        const input = this._buildModelInput(model, prompt, imageUrls, aspectRatio);
        result = await this.kie.run(model, input);
      }

      const imageUrl = result.resultUrls?.[0];
      if (!imageUrl) throw new Error('No image URL in result');

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error(`Download failed: ${imageResponse.status}`);

      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, buffer);
      console.log(`[ImageGen] Saved: ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB)`);

      return { path: outputPath, success: true, model_used: modelUsed };
    } catch (error) {
      console.error(`[ImageGen] Error: ${error.message}`);
      return { path: null, success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════
  //  DATA RESOLVERS
  // ═══════════════════════════════════════

  _resolveVars(brief, dna, theme) {
    const dims = (brief.dimensions || '').split('x').map(s => s.trim());
    const parseWithCm = (inches) => {
      const num = parseFloat(inches);
      if (isNaN(num)) return inches;
      return `${(num * 2.54).toFixed(1)}cm / ${num}in`;
    };

    // Theme anchors take priority over raw theme — ensures all 8 slots
    // share the same lighting key, primary surface, and prop palette.
    // Runtime enforcement of doctrine 2.1.2 [SET_COHERENCE_OK] stamp.
    const anchors = dna.themeAnchors || {};

    return {
      productName: brief.product_name,
      materials: (brief.materials || []).join(', '),
      mood: (theme.mood || []).join(', ') || 'warm and inviting',
      lighting: anchors.lightingKey || theme.lighting || 'soft natural lighting',
      surface: anchors.primarySurface || theme.surfaces?.[0] || 'wooden table',
      context: theme.lifestyle_contexts?.[0] || 'cozy home setting',
      propPalette: anchors.propPalette || [],
      dimW: parseWithCm(dims[0] || ''),
      dimH: parseWithCm(dims[1] || ''),
      quantity: brief.quantity || '10',
      recipient: brief.target_audience?.recipient || 'the recipient',
      buyer: brief.target_audience?.buyer || 'gift buyer',
      usp: brief.usp || brief.product_name,
      headline: brief.headline_text || this._defaultHeadline(brief),
      subheadline: brief.subheadline_text || this._defaultSubheadline(brief),
      styleHint: dna.styleGuide?.promptStyleSuffix || ''
    };
  }

  _buildFeatureDetails(brief) {
    if (brief.feature_details && brief.feature_details.length >= 3) {
      return brief.feature_details.slice(0, 3);
    }
    const features = brief.features || [];
    const materials = (brief.materials || []).join(' and ');
    return [
      { visual: `close-up of the structural base or mounting part of the product`, text: features[0] || 'Premium construction' },
      { visual: `the full front face of the product showing the complete design`, text: features[1] || 'Beautiful design' },
      { visual: `extreme close-up showing the ${materials || 'material'} texture and finish quality`, text: features[2] || `High-quality ${materials || 'craftsmanship'}` }
    ];
  }

  _categoryUseCase(brief) {
    const defaults = this._promptConfig.use_case_defaults || {};
    const fallback = `being used as intended, a person's hand interacting with the product naturally, demonstrating its ${(brief.features || ['key feature'])[0].toLowerCase()}`;
    return defaults[brief.category] || fallback;
  }

  _buildEmotionalScene(brief) {
    const scenes = this._promptConfig.emotional_scenes || {};
    const fallback = 'A heartfelt gift-giving moment between two people, one presenting the product with a warm smile, bright indoor setting';
    return scenes[brief.occasion] || fallback;
  }

  _defaultHeadline(brief) {
    const headlines = this._promptConfig.headlines || {};
    return headlines[brief.occasion] || 'Made with love, given with heart';
  }

  _defaultSubheadline(brief) {
    const subs = this._promptConfig.subheadlines || {};
    return subs[brief.occasion] || 'A thoughtful gift for someone special';
  }


  // ═══════════════════════════════════════
  //  DIRECT-REF v3 — Scene-only prompts (~80-100 words)
  //
  //  Reference image carries product identity. Text describes SCENE only.
  //  Pattern: [scene description] + [product placement] + [fidelity guard] + [photography specs]
  //  Fidelity guard: "Keep the product identical to the reference - same shape, same printed design, same colors."
  // ═══════════════════════════════════════

  /** Short product reference — just enough to say WHAT is in the scene, not HOW it looks */
  _productRef(brief) {
    const cat = brief.category || '';
    const refs = {
      mixed: 'the product from the reference image',
      wood_ornament: 'this exact wooden ornament from the reference image',
      acrylic_ornament: 'this exact acrylic ornament from the reference image',
      paper_card: 'this exact wooden plant stake from the reference image',
      jar: 'this exact jar from the reference image',
      frame: 'this exact frame from the reference image',
    };
    return refs[cat] || 'the product from the reference image';
  }

  _fidelityGuard() {
    return 'PRODUCT FIDELITY IS CRITICAL: reproduce the product EXACTLY as it appears in the reference images — same proportions, same layout, same letter sizes, same text style, same decorative element positions, same wood tone, same surface finish. Do NOT redesign, resize, recompose, or reinterpret any element. The reference images are the source of truth for the product. Only the background, scene, and lighting are new.';
  }

  /**
   * Append brief-level structure rules + slot-level critical_structure to the prompt,
   * gated by per-slot constraints from config/prompts/slot-constraints.json.
   *
   * This is where text-dominance is controlled. If a slot's constraint says
   * inject_see_through_rule=false, the rule is skipped even if present in the brief.
   */
  _structureRules(brief, concept, slotNumber) {
    const parts = [];
    if (concept?.critical_structure && promptGuard.shouldInject('critical_structure', slotNumber)) {
      parts.push(`Product note: ${concept.critical_structure}`);
    }
    if (brief.product_structure && promptGuard.shouldInject('product_structure', slotNumber)) {
      parts.push(`Construction: ${brief.product_structure}`);
    }
    if (brief.see_through_cutout_rule && promptGuard.shouldInject('see_through_rule', slotNumber)) {
      parts.push(`See-through: ${brief.see_through_cutout_rule}`);
    }
    if (brief.lighting_harmony_rule && promptGuard.shouldInject('lighting_harmony_rule', slotNumber)) {
      parts.push(`Lighting: ${brief.lighting_harmony_rule}`);
    }
    return parts.length ? `\n\n${parts.join('\n')}` : '';
  }

  /**
   * Final sanitizer called right before returning a direct-ref prompt.
   * Applies forbidden-phrase scrubbing and logs word-count violations.
   */
  _finalizePrompt(prompt, slotNumber) {
    const withTip = prompt + this._knowledgeTipFor(slotNumber);
    const { prompt: withSafeguard, injected } = promptGuard.injectSafeguardPhrases(slotNumber, withTip);
    if (injected.length > 0) {
      console.log(`[ImageGen] Slot ${slotNumber}: ${injected.length} structural safeguard phrase(s) injected (RULE-016/017)`);
    }
    const { prompt: clean } = promptGuard.sanitize(withSafeguard, slotNumber);
    return clean;
  }

  buildDirectRefPrompt(slotNumber, brief, dna, theme) {
    const v = this._resolveVars(brief, dna, theme);
    const sc = brief.slot_concepts || {};
    const ref = this._productRef(brief);
    const guard = this._fidelityGuard();

    const funnel = this._funnelForBrief(brief);
    const slotFunnelMeta = funnel.slots?.find(s => s.n === slotNumber) || null;

    switch (slotNumber) {
      case 1: return this._buildDirectSlot1(ref, guard, v, brief, sc.slot1, slotFunnelMeta);
      case 2: return this._buildDirectSlot2(ref, guard, v, brief, sc.slot2, slotFunnelMeta);
      case 3: return this._buildDirectSlot3(ref, guard, v, brief, sc.slot3, slotFunnelMeta);
      case 4: return this._buildDirectSlot4(ref, guard, v, brief, sc.slot4, slotFunnelMeta);
      case 5: return this._buildDirectSlot5(ref, guard, v, brief, sc.slot5, slotFunnelMeta);
      case 6: return this._buildDirectSlot6(ref, guard, v, brief, sc.slot6, slotFunnelMeta);
      case 7: return this._buildDirectSlot7(ref, guard, v, brief, sc.slot7, slotFunnelMeta);
      case 8: return this._buildDirectSlot8(ref, guard, v, brief, sc.slot8, slotFunnelMeta);
      default: throw new Error(`No direct-ref template for slot ${slotNumber}`);
    }
  }

  _buildDirectSlot1(ref, guard, v, brief, concept) {
    // Read product frame % from image-specs (single source of truth)
    let framePct = 85;
    try {
      const specs = require('../config/image-specs.json');
      framePct = specs.main_image_rules?.product_frame_min_percent || 85;
    } catch (e) { /* fallback to 85 */ }

    const scene = concept?.scene
      ? `${concept.scene}. `
      : `This exact product from the reference images on a pure seamless white studio background. `;
    const prompt =
      `${scene}` +
      `${guard} Single hero shot, slightly angled 3/4 view to show depth. ` +
      `Product centered, fills approximately ${framePct}% of the frame (Amazon main image rule), soft natural contact shadow beneath. ` +
      `Professional Amazon main product image, clean soft studio lighting, photorealistic 4K.` +
      this._structureRules(brief, concept, 1);
    return this._finalizePrompt(prompt, 1);
  }

  _buildDirectSlot2(ref, guard, v, brief, concept) {
    const scene = concept?.scene || `${ref} inserted in a potted plant on ${v.surface}, ${v.context}`;
    const style = concept?.style || 'warm natural photography, shallow depth of field';
    const prompt =
      `${scene}. ${guard} ${style}, professional Amazon product lifestyle photography.` +
      this._structureRules(brief, concept, 2);
    return this._finalizePrompt(prompt, 2);
  }

  _buildDirectSlot3(ref, guard, v, brief, concept) {
    // Wave 2.5: if picked_concept provides a free-form scene, use it directly.
    // Falls back to legacy Wave 1 template with TOP/BOTTOM split when only
    // bg/bottom_layout fields are provided.
    if (concept?.scene) {
      const style = concept.style || 'clean infographic layout, photorealistic, 4K resolution';
      const prompt =
        `${concept.scene}. ${ref} is the exact product shown as the focal hero. ${guard} ` +
        `${style}.` +
        this._structureRules(brief, concept, 3);
      return this._finalizePrompt(prompt, 3);
    }
    const bg = concept?.bg || 'a clean white background';
    const details = this._buildFeatureDetails(brief);
    const bottomDesc = concept?.bottom_layout
      || `Three circular detail close-ups: ${details.map(d => d.visual).join(', ')}`;
    const prompt =
      `A professional Amazon product infographic on ${bg}. ` +
      `TOP: ${ref} as a large hero shot, well-lit. ${guard} ` +
      `BOTTOM: ${bottomDesc}. ` +
      `No text labels — text added in post-production. ` +
      `Clean infographic layout, photorealistic, 4K resolution.` +
      this._structureRules(brief, concept, 3);
    return this._finalizePrompt(prompt, 3);
  }

  _buildDirectSlot4(ref, guard, v, brief, concept) {
    const scene = concept?.scene || brief.use_case_description || this._categoryUseCase(brief);
    const style = concept?.style || 'casual smartphone snapshot style, natural imperfect lighting';
    const prompt =
      `${scene}. ${ref} is clearly visible. ${guard} ` +
      `${style}, slightly overhead camera angle, ` +
      `all props generic and unbranded, professional Amazon listing photography.` +
      this._structureRules(brief, concept, 4);
    return this._finalizePrompt(prompt, 4);
  }

  _buildDirectSlot5(ref, guard, v, brief, concept) {
    // Wave 2.5: prefer picked_concept.scene (free-form, supports grid layouts,
    // display-location collages, etc). Wave 1 layout-string format still works.
    // Default fallback = pure-white dimension-annotation infographic.
    let prompt;
    if (concept?.scene) {
      const style = concept.style || 'clean informative product diagram, photorealistic, 4K';
      prompt =
        `${concept.scene}. ${ref} is the exact product shown. ${guard} ` +
        `${style}.`;
    } else if (concept?.layout) {
      const bg = concept.bg || 'a clean neutral background';
      const style = concept.style || 'clean informative product diagram, photorealistic product, 4K';
      prompt =
        `A professional Amazon product size and component infographic on ${bg}. ` +
        `${ref} is shown according to this layout: ${concept.layout}. ${guard} ` +
        `${style}.`;
    } else {
      const dims = `width ${v.dimW}, height ${v.dimH}`;
      prompt =
        `A professional Amazon product size reference image on pure white background. ` +
        `${ref} shown with dimension annotation lines (${dims}). ${guard} ` +
        `Clean infographic, photorealistic, 4K resolution.`;
    }
    return this._finalizePrompt(prompt + this._structureRules(brief, concept, 5), 5);
  }

  _buildDirectSlot6(ref, guard, v, brief, concept) {
    const surface = concept?.bg || 'a rustic wooden table surface';
    const props = concept?.props || 'gift card, decorative items, confetti';
    const scene = concept?.scene;
    const base = scene
      ? `${scene}. ${guard} `
      : `An overhead flat lay photograph on ${surface}. ${ref} placed face-up in the center, clearly visible. ${guard} Surrounding items arranged aesthetically: ${props}. `;
    const prompt =
      base +
      `Warm golden natural lighting from above, overhead camera angle, ` +
      `all props generic and unbranded, styled flat lay photography, photorealistic, 4K.` +
      this._structureRules(brief, concept, 6);
    return this._finalizePrompt(prompt, 6);
  }

  _buildDirectSlot7(ref, guard, v, brief, concept) {
    const scene = concept?.scene || this._buildEmotionalScene(brief);
    const prompt =
      `${scene}. ${ref} is clearly visible as the focal point. ${guard} ` +
      `No rendered text, no text banners, no placeholder text in this image. ` +
      `All props generic and unbranded, emotional moment, ` +
      `professional Amazon product lifestyle photography, 4K.` +
      this._structureRules(brief, concept, 7);
    return this._finalizePrompt(prompt, 7);
  }

  _buildDirectSlot8(ref, guard, v, brief, concept) {
    const scene = concept?.scene || `${ref} displayed in ${v.context}`;
    const props = concept?.props || 'contextual items around';
    const style = concept?.style || 'warm close-up photography, shallow depth of field';
    const prompt =
      `Close-up lifestyle shot: ${scene}. ${guard} ` +
      `Surrounding props slightly soft focus: ${props}. ` +
      `Warm natural window light, soft bokeh, ${style}, ` +
      `professional Amazon listing photography, 4K.` +
      this._structureRules(brief, concept, 8);
    return this._finalizePrompt(prompt, 8);
  }
}

module.exports = ImageGenerator;
