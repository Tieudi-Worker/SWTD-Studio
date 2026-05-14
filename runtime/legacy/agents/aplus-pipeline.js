const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);

const { createAplusModule } = require('../utils/image-utils');
const { saveProgress, checkpointResult } = require('../utils/checkpoint');
const { runTasks } = require('../utils/pipeline-helpers');
const { loadAplusFunnel, resolveRefCatalog, pickRefsByRecipe } = require('../utils/funnel-loader');

/**
 * A+ Sequence Architect — config-driven (RULE-020).
 *
 * Reads `brief.aplus_type` + `brief.aplus_plan_style` to load the matching
 * funnel config (Type 1 single / Type 2 multi_asin × Plan A modular / Plan B
 * storyboard) and drives 5 modules from that config. Falls back to legacy
 * hardcoded module list if config unavailable.
 */
class AplusPipeline {
  constructor({ kie, imageGen, log, projectRoot, sequential }) {
    this.kie = kie;
    this.imageGen = imageGen;
    this.log = log;
    this.projectRoot = projectRoot;
    this.sequential = sequential;
  }

  async run(brief, dna, theme, specs, outDir, inputImages, listingRefs = [], ctx = null) {
    const mode = this.sequential ? 'SEQUENTIAL' : 'PARALLEL';

    const funnel = loadAplusFunnel(brief, this.log);
    // Prefer explicit ctx.skuDir (robust across new/legacy modes); fall back
    // to deriving from outDir for backwards compatibility when ctx not passed.
    const skuDir = ctx?.skuDir || path.resolve(outDir, '..', '..');
    const refCatalog = resolveRefCatalog(brief, skuDir);
    // Real product photos (input/product/*) must come first; listing renders
    // are demoted because they are AI outputs that can compound-hallucinate.
    const realProductRefs = (inputImages || []).filter(p => /[\\/]input[\\/]product[\\/]/.test(p));
    const otherInputs = (inputImages || []).filter(p => !realProductRefs.includes(p));
    const fallbackRefs = [...realProductRefs, ...otherInputs, ...listingRefs];
    if (Object.keys(refCatalog).length === 0) {
      this.log.warn(`[A+ refs] ref_catalog resolved to EMPTY at skuDir=${skuDir}. Check brief.ref_catalog paths. Falling back to ${realProductRefs.length} real product photos + ${otherInputs.length} other inputs + ${listingRefs.length} listing refs.`);
    }

    let modules;
    if (funnel) {
      this.log.info(`Phase 3: A+ ${funnel.type} / Plan ${funnel.planLetter} (${funnel.modules.length} modules) — ${mode}`);
      modules = funnel.modules;
    } else {
      this.log.info(`Phase 3: A+ legacy (5 modules) — ${mode}`);
      modules = this._legacyModules();
    }

    const tasks = modules.map(m => () =>
      this._generateModule(m, brief, dna, theme, specs, outDir, refCatalog, fallbackRefs, funnel)
    );
    const results = await runTasks(tasks, modules.map(m => ({ module: m.n })), this.sequential);
    this.log.info(`A+ Sequence: ${results.filter(r => r.success).length}/${modules.length} modules OK`);
    return results;
  }

  _legacyModules() {
    return [
      { n: 1, name: 'Brand Emotion Hero', role: 'LEGACY_BRAND_HERO' },
      { n: 2, name: 'USP Icons Grid', role: 'LEGACY_USP_ICONS' },
      { n: 3, name: 'Storytelling Lifestyle', role: 'LEGACY_STORYTELLING' },
      { n: 4, name: 'Tech Specs Infographic', role: 'LEGACY_SPECS' },
      { n: 5, name: 'Gift CTA', role: 'LEGACY_GIFT_CTA' }
    ];
  }

  async _generateModule(m, brief, dna, theme, specs, outDir, refCatalog, fallbackRefs, funnel) {
    const cached = checkpointResult(outDir, `aplus_m${m.n}`, this.log);
    if (cached) return cached;

    this.log.info(`[A+ ${m.n}] ${m.name}`);
    const rawPath = path.join(outDir, `${brief.sku}_aplus_m${m.n}_raw.jpg`);
    const finalPath = path.join(outDir, `${brief.sku}_aplus_module${m.n}.jpg`);

    const prompt = this._promptForModule(m, brief, dna, theme, funnel);
    const refs = pickRefsByRecipe(m.refRecipe, refCatalog, fallbackRefs, this.log);

    const gen = await this.imageGen.generate(prompt, rawPath, {
      aspectRatio: '21:9',
      referenceImages: refs,
      brief,
      slotNumber: `aplus_m${m.n}`
    });
    if (!gen.success) return { module: m.n, success: false, reason: gen.error };

    const overlayEnabled = brief.force_text_overlay === true;

    if (overlayEnabled) {
      const textLayers = this._textForModule(m.n, brief, dna);
      if (textLayers.length) await createAplusModule(rawPath, textLayers, finalPath);
      else if (finalPath !== rawPath) fs.copyFileSync(rawPath, finalPath);
    } else if (finalPath !== rawPath) {
      fs.copyFileSync(rawPath, finalPath);
    }

    // Keep raw KIE download for QC/versioning. Never delete generated raw media.
    const result = { module: m.n, success: true, path: finalPath };
    saveProgress(outDir, `aplus_m${m.n}`, result);
    return result;
  }

  // ═══════════════════════════════════════
  //  PROMPT BUILDERS — dispatch by role
  // ═══════════════════════════════════════

  _promptForModule(m, brief, dna, theme, funnel) {
    const briefPrompt = brief.aplus_module_prompts?.[`M${m.n}`] || brief.aplus_module_prompts?.[`m${m.n}`];
    if (briefPrompt && typeof briefPrompt === 'string' && briefPrompt.trim()) {
      return briefPrompt.trim();
    }

    const builders = {
      BRAND_OPENING: this._promptOpenScene.bind(this),
      TRANSFORMATION_ARC: this._promptDailyRitual.bind(this),
      CRAFTSMANSHIP_AUTHORITY: this._promptHandcraftedProof.bind(this),
      EMOTIONAL_CLIMAX: this._promptMilestones.bind(this),
      CLOSE_CONVERSION: this._promptGiftKeepsakeCTA.bind(this),

      FAMILY_BRAND_HERO: this._promptCollectionHero.bind(this),
      UMBRELLA_STORY: this._promptSharedPain.bind(this),
      VARIANT_COMPARISON: this._promptProductMatrix.bind(this),
      FIT_MATCHMAKING: this._promptDecisionGuide.bind(this),
      CLOSE_CONVERSION_COLLECTION: this._promptCollectionCTA.bind(this),

      LEGACY_BRAND_HERO: this._promptBrandHeroLegacy.bind(this),
      LEGACY_USP_ICONS: this._promptUSPIconsLegacy.bind(this),
      LEGACY_STORYTELLING: this._promptStorytellingLegacy.bind(this),
      LEGACY_SPECS: this._promptSpecsLegacy.bind(this),
      LEGACY_GIFT_CTA: this._promptGiftCTALegacy.bind(this)
    };
    const fn = builders[m.role] || builders.LEGACY_BRAND_HERO;
    return fn(brief, dna, theme, m);
  }

  _cohesion(dna) {
    const c = dna.cohesion_anchors || {};
    return {
      props: (c.props || []).slice(0, 3).join(', ') || 'minimal styled props',
      lighting: c.lighting_key || dna.themeAnchors?.lightingKey || 'warm soft natural light from camera-left',
      colors: (c.color_anchors || []).join(', ') || dna.colorPalette || 'warm natural tones'
    };
  }

  // ─── Plan B — Storyboard Seamless (Type 1 single-ASIN) ───

  _promptOpenScene(brief, dna, theme, m) {
    const { props, lighting } = this._cohesion(dna);
    const mood = dna.art_direction?.mood_descriptor || (theme.mood || []).join(', ') || 'warm and inviting';
    return (
      `Full-bleed 21:9 brand opening scene with a decorative top band (soft rainbow arc + star confetti + accent motif) flowing diagonally top-right to bottom-left. ` +
      `Middle clean reading zone for a 3-line bold headline + italic script subhead rendered natively in image. ` +
      `Bottom half: warm lifestyle hero featuring the exact product from reference images with a pair of hands or a person partially visible interacting softly, surrounded by ${props}. ` +
      `${lighting}, ${mood} atmosphere, shallow depth of field with ambient bokeh. Photorealistic, 4K.`
    );
  }

  _promptDailyRitual(brief, dna, theme, m) {
    const { lighting } = this._cohesion(dna);
    return (
      `21:9 layout. LEFT 40%: clean warm pastel panel with generous clean reading zone for an italic script headline + body caption rendered natively in image. ` +
      `RIGHT 60%: 3 vertically stacked circular macro close-ups in soft rounded frames showing a positive 3-second ritual with the exact product from reference images — (1) a hand reaching for a component, (2) the core action moment, (3) the finished result with a soft emotional beat. ` +
      `A gentle dotted trail and small star confetti connect the 3 circles and loop back to the left panel. ` +
      `${lighting}, positive uplifting tone, no pain or negative imagery. Photorealistic, 4K.`
    );
  }

  _promptHandcraftedProof(brief, dna, theme, m) {
    return (
      `21:9 craftsmanship proof banner on warm birch workshop background. ` +
      `TOP 10%: a clean top band with a bold headline rendered natively in image. ` +
      `MIDDLE 80%: 3 horizontal macro close-ups separated by thin accent dividers — (1) process shot of laser cutter or hand-working wood with visible wood shavings, (2) extreme detail close-up of the product surface grain and engraved linework, (3) functional detail of a real mechanical element of the product. ` +
      `BOTTOM 10%: narrow negative band for a 3-cue trust bar rendered natively in image. ` +
      `Warm directional workshop light, high tactile fidelity, shallow depth of field. Photorealistic, 4K.`
    );
  }

  _promptMilestones(brief, dna, theme, m) {
    const { props, lighting } = this._cohesion(dna);
    return (
      `21:9 emotional milestones banner. ` +
      `TOP 10%: a clean top band with a bold emotional headline rendered natively in image. ` +
      `MIDDLE 80%: 3 horizontal family-moment vignettes separated by soft ribbon dividers. The exact same product from reference images appears in each vignette with identical silhouette and design. Each vignette is a different warm family scene with ${props}. ` +
      `A soft dotted trail weaves between the 3 vignettes. Soft ribbon zones above each vignette with italic script milestone labels rendered natively in image. ` +
      `${lighting}, genuine candid emotion, shallow depth of field. Photorealistic, 4K.`
    );
  }

  _promptGiftKeepsakeCTA(brief, dna, theme, m) {
    const { props, lighting, colors } = this._cohesion(dna);
    return (
      `21:9 gift-ready close banner. ` +
      `LEFT 55%: top-down flat lay on warm wood plank — the exact product from reference images partially nested in an open kraft gift box with tissue paper, surrounded by ${props} and loose scattered decorative elements. Top-left includes a tasteful italic native text zone rendered directly in image. ` +
      `RIGHT 45%: solid accent color block (${colors}) with generous clean reading zone for a bold headline, body copy, a rounded CTA button, and a 3-badge trust row rendered natively in image. A subtle rainbow arc motif on the accent block echoes the opening banner for visual thread continuity. ` +
      `${lighting}, premium gift photography, warm golden rim. Photorealistic, 4K.`
    );
  }

  // ─── Plan A — Modular (Type 2 multi-ASIN placeholders) ───

  _promptCollectionHero(brief, dna, theme, m) {
    const { props, lighting, colors } = this._cohesion(dna);
    const childNames = (brief.child_asins || []).map(c => c.display_name || c.sku).filter(Boolean).slice(0, 5).join(', ') || 'the collection';
    return (
      `21:9 collection hero banner. TOP 30%: clean top zone for parent-brand headline + script subhead rendered natively in image. ` +
      `MIDDLE 55%: warm lifestyle flat lay or standing arrangement showing all products of the collection side by side — ${childNames} — each rendered faithfully from its reference images, with consistent scale and handcraft feel, surrounded by ${props}. ` +
      `BOTTOM 15%: narrow strip includes the product-family name row rendered natively in image. ` +
      `${lighting}, cohesive color palette: ${colors}. Photorealistic, 4K.`
    );
  }

  _promptSharedPain(brief, dna, theme, m) {
    const { lighting } = this._cohesion(dna);
    return (
      `21:9 umbrella-story split banner. LEFT 50%: soft relatable daily scene (no dark tone) with a clean top zone for a bold umbrella-pain headline rendered natively in image. ` +
      `RIGHT 50%: transformation scene featuring the primary product from reference images in a positive moment of use, with a clean zone for a solution statement rendered natively in image. ` +
      `${lighting}, warm emotional tone. Photorealistic, 4K.`
    );
  }

  _promptProductMatrix(brief, dna, theme, m) {
    const childCount = Math.min((brief.child_asins || []).length || 3, 4);
    return (
      `21:9 comparison grid banner. TOP 15%: a clean top band with a bold headline rendered natively in image. ` +
      `MIDDLE 70%: ${childCount}-cell horizontal grid. Each cell shows one product variant from reference images on a clean neutral plate, with consistent lighting and scale. Each cell includes a clear lower caption zone with a native product name + short spec list rendered in image. ` +
      `BOTTOM 15%: a narrow bottom band with a short supporting tagline rendered natively in image. ` +
      `Thin accent dividers between cells. Photorealistic, 4K.`
    );
  }

  _promptDecisionGuide(brief, dna, theme, m) {
    return (
      `21:9 decision-guide banner. TOP 10%: negative band for a bold headline rendered natively in image. ` +
      `MIDDLE 80%: 3 horizontal persona cards with soft rounded frames. Each card has a small product thumbnail (from reference images) on the right and a clear left text zone with an italic persona quote + bold product recommendation rendered natively in image. Thin arrow motifs between quote and thumbnail. ` +
      `BOTTOM 10%: a narrow bottom band with a CTA hint rendered natively in image. ` +
      `Warm neutral background with subtle paper texture. Photorealistic, 4K.`
    );
  }

  _promptCollectionCTA(brief, dna, theme, m) {
    const { props, lighting, colors } = this._cohesion(dna);
    return (
      `21:9 collection CTA banner. LEFT 55%: gift-ready flat lay showing multiple products from the collection together in one arrangement with ${props}, on warm wood plank. Upper area includes a tasteful italic native text line rendered directly in image. ` +
      `RIGHT 45%: solid accent color block (${colors}) with native consumer-facing text: bold headline, body copy, dual CTA buttons, and a 3-badge trust row rendered directly in the image. ` +
      `${lighting}, premium brand presentation. Photorealistic, 4K.`
    );
  }

  // ─── Legacy prompts (fallback when funnel config unavailable) ───

  _promptBrandHeroLegacy(brief, dna, theme) {
    const { props, lighting, colors } = this._cohesion(dna);
    const mood = dna.art_direction?.mood_descriptor || (theme.mood || []).join(', ') || 'warm and inviting';
    return (
      `Cinematic full-bleed brand hero scene: the exact product from reference images displayed prominently in a ${mood} setting. ` +
      `Surrounding scene includes ${props}, all unbranded. ` +
      `${lighting}, soft rim light catching the product, shallow depth of field with bokeh background. ` +
      `Wide 21:9 panoramic. Clean clean reading zone on the LEFT for headline native text rendered directly in image. ` +
      `Color palette: ${colors}. Photorealistic, professional brand photography, 4K.`
    );
  }

  _promptUSPIconsLegacy(brief, dna, theme) {
    const { colors } = this._cohesion(dna);
    const features = (brief.features || []).slice(0, 4);
    const cells = features.length > 0
      ? features.map((f, i) => `Cell ${i + 1}: macro detail showing ${String(f).toLowerCase()}`).join('. ')
      : 'Each cell shows a different macro detail of the product';
    return (
      `A horizontal 4-cell grid layout on a ${colors} gradient background. ` +
      `Each cell shows an extreme close-up macro detail of the exact product from reference images, illustrating one feature: ` +
      cells + '. ' +
      `Consistent lighting and color treatment across all 4 cells. Wide 21:9 layout. Subtle thin dividers between cells. Photorealistic, 4K.`
    );
  }

  _promptStorytellingLegacy(brief, dna, theme) {
    const { props, lighting } = this._cohesion(dna);
    const context = theme.lifestyle_contexts?.[1] || theme.lifestyle_contexts?.[0] || 'cozy home setting';
    const mood = dna.art_direction?.mood_descriptor || 'warm thoughtful';
    return (
      `Wide cinematic storytelling scene: the exact product from reference images integrated naturally into ${context}. ` +
      `Surrounding ${props}, all unbranded. A pair of hands or a person partially visible interacting softly. ` +
      `${lighting}, golden hour warmth, ${mood} atmosphere. Wide 21:9 panoramic with deep depth and visual hierarchy. ` +
      `The right side includes a clean native body-copy zone rendered directly in image. Photorealistic, 4K.`
    );
  }

  _promptSpecsLegacy(brief, dna, theme) {
    const { colors } = this._cohesion(dna);
    return (
      `Clean technical specs background: soft ${colors} gradient with subtle paper texture. ` +
      `LEFT side: minimal isometric or top-down product silhouette in ghost outline (light gray). ` +
      `RIGHT side: clean clean reading zone for specs text placement. ` +
      `Subtle handmade craft hint at corners (faint pencil sketch lines, small wood grain texture). Wide 21:9 layout. Minimalist professional infographic, 4K.`
    );
  }

  _promptGiftCTALegacy(brief, dna, theme) {
    const { props, lighting, colors } = this._cohesion(dna);
    return (
      `Warm gift presentation: the exact product from reference images partially nested in an open kraft gift box with tissue paper, ` +
      `surrounded by ${props}, on a ${theme.surfaces?.[0] || 'wooden table'}. ` +
      `${lighting}, gentle warm key, soft fill, golden rim from behind catching the product edge. ` +
      `Wide 21:9 panoramic. The left side includes native CTA + trust-badge text rendered directly in image. Color palette: ${colors}. Photorealistic, premium gift photography, 4K.`
    );
  }

  // ═══════════════════════════════════════
  //  TEXT OVERLAY BUILDERS (compatible with v1 createAplusModule)
  // ═══════════════════════════════════════

  _tl(text, x, y, fontSize, overrides = {}) {
    return { text, x, y, fontSize, textAlign: 'left', shadow: false, bgColor: '#FFFFFF', bgPadding: 14, ...overrides };
  }

  _textForModule(num, brief, dna) {
    const heading = dna.typography?.heading || 'Arial';
    const body = dna.typography?.body || 'Arial';
    const ap = (text, x, y, sz, ov = {}) => this._tl(text, x, y, sz, {
      color: '#FFFFFF', shadow: true, bgColor: undefined, bgPadding: undefined, ...ov
    });

    const c = {
      1: [
        ap('The First Hello, Made To Keep', 58, 52, 42, { fontFamily: heading, fontWeight: 'bold', maxWidth: 650, width: 720, height: 115 }),
        ap('Handmade wooden pregnancy announcement keepsakes for Daddy, Grandpa, and baby reveal moments.', 58, 174, 22, { fontFamily: body, fontWeight: '600', maxWidth: 650, width: 720, height: 95 }),
        ap('For Daddy · For Grandpa · Universal Baby Reveal', 58, 520, 22, { fontFamily: body, fontWeight: '700', maxWidth: 760, width: 820, height: 55 })
      ],
      2: [
        ap('Turn A Tiny Secret Into Their Favorite Memory', 58, 60, 36, { fontFamily: heading, fontWeight: 'bold', maxWidth: 630, width: 700, height: 110 }),
        ap('A reveal gift they can hold, open, and keep long after the first happy tears.', 58, 195, 22, { fontFamily: body, fontWeight: '600', maxWidth: 610, width: 700, height: 85 }),
        ap('A simple announcement', 70, 475, 18, { fontFamily: body, fontWeight: '700', maxWidth: 320, width: 380, height: 45 }),
        ap('A keepsake moment', 850, 475, 18, { fontFamily: body, fontWeight: '700', maxWidth: 360, width: 420, height: 45 })
      ],
      3: [
        ap('Choose The Reveal That Fits Your Story', 56, 38, 34, { fontFamily: heading, fontWeight: 'bold', maxWidth: 760, width: 840, height: 85 }),
        ap('For Daddy\nBest for husband reveals\nHi Daddy message', 70, 405, 20, { fontFamily: body, fontWeight: '700', maxWidth: 350, width: 410, height: 135 }),
        ap('For Grandpa\nBest for grandpa-to-be\nLittle secret message', 535, 405, 20, { fontFamily: body, fontWeight: '700', maxWidth: 350, width: 410, height: 135 }),
        ap('Universal Baby Reveal\nBest for family keepsakes\nComing Soon message', 1000, 405, 20, { fontFamily: body, fontWeight: '700', maxWidth: 360, width: 420, height: 135 })
      ],
      4: [
        ap('Not Sure Which One To Pick?', 62, 42, 36, { fontFamily: heading, fontWeight: 'bold', maxWidth: 650, width: 720, height: 88 }),
        ap('For the first person you want to call “Daddy”\nChoose For Daddy', 80, 425, 19, { fontFamily: body, fontWeight: '700', maxWidth: 360, width: 410, height: 115 }),
        ap('For the proudest future grandpa\nChoose For Grandpa', 535, 425, 19, { fontFamily: body, fontWeight: '700', maxWidth: 360, width: 410, height: 115 }),
        ap('For a neutral family reveal or nursery display\nChoose Universal Baby Reveal', 990, 425, 19, { fontFamily: body, fontWeight: '700', maxWidth: 380, width: 430, height: 115 })
      ],
      5: [
        ap('More Than A Card. A First Keepsake.', 855, 82, 38, { fontFamily: heading, fontWeight: 'bold', maxWidth: 500, width: 560, height: 120 }),
        ap('Personal, handmade, and ready to become part of the baby story.', 855, 230, 22, { fontFamily: body, fontWeight: '600', maxWidth: 480, width: 550, height: 85 }),
        ap('Start With One · Build The Collection', 855, 350, 24, { fontFamily: body, fontWeight: '800', maxWidth: 500, width: 560, height: 60 }),
        ap('Handmade Wood · Ultrasound Frame · Gift-Ready Moment', 855, 495, 18, { fontFamily: body, fontWeight: '700', maxWidth: 500, width: 560, height: 60 })
      ]
    };
    return c[num] || [];
  }
}

module.exports = AplusPipeline;
