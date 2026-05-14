const fs = require('fs');
const path = require('path');

/**
 * Design Director Agent
 * Analyzes brief + reference → outputs Design DNA
 * Design DNA ensures all 8 images + A+ + video share consistent visual identity
 */

class DesignDirector {
  
  /**
   * Generate Design DNA from brief + theme
   * This runs FIRST before any image generation
   */
  generateDesignDNA(brief, theme) {
    console.log(`[DesignDirector] Generating Design DNA for ${brief.sku}...`);
    
    const dna = {
      sku: brief.sku,

      // Color system
      colorPalette: this._buildColorPalette(brief, theme),

      // Mood & atmosphere
      mood: this._determineMood(brief, theme),

      // Typography direction
      typography: this._selectTypography(brief),

      // Visual style tokens
      styleTokens: this._buildStyleTokens(brief, theme),

      // Prompt modifiers (appended to every AI prompt)
      globalPromptSuffix: this._buildGlobalSuffix(brief, theme),

      // Negative prompt — sourced directly from brief, no productLock indirection
      _negativePrompt: 'distortion, warped product, wrong text, font changes, color shift, fake texture, AI redraw, stylized product, cartoon product, deformed product, engraved text instead of cut-through, merged elements, flat single-layer construction'
        + (brief.negative_prompt_extra ? ', ' + brief.negative_prompt_extra : ''),

      // ═══ NEW: Creative Zones — 70/30 control ═══
      creativeZones: this._buildCreativeZones(),

      // ═══ NEW: Theme Anchors — cross-pipeline consistency ═══
      themeAnchors: this._buildThemeAnchors(brief, theme),

      // Style Guide (from competitor style analysis)
      styleGuide: brief._styleGuide || null,

      // Knowledge hints (from knowledge/_summary.json via knowledge-loader).
      // Soft influence data — downstream code may use opportunistically.
      // NOT auto-injected into prompts here because RULE-015 forbids bloating
      // prompt text. Use image-generator's prompt-guard-bounded suffix instead.
      knowledgeHints: {
        nicheInsights: brief.knowledge_insights || [],
        photographyTips: brief.knowledge_photography_tips || [],
        conversionTactics: brief.knowledge_conversion_tactics || [],
        generalRules: brief.knowledge_rules || []
      },

      // Generated timestamp
      createdAt: new Date().toISOString()
    };

    // Inject style suffix into globalPromptSuffix if styleGuide exists
    if (dna.styleGuide?.promptStyleSuffix) {
      dna.globalPromptSuffix = (dna.globalPromptSuffix || '') + ', ' + dna.styleGuide.promptStyleSuffix;
    }

    // Log knowledge hint counts so user sees the flow at a glance
    const k = dna.knowledgeHints;
    const totalHints = k.nicheInsights.length + k.photographyTips.length + k.conversionTactics.length + k.generalRules.length;
    if (totalHints > 0) {
      console.log(`  Knowledge: ${totalHints} hints (${k.nicheInsights.length} niche, ${k.photographyTips.length} photo, ${k.conversionTactics.length} conversion, ${k.generalRules.length} rules)`);
    }

    console.log(`[DesignDirector] Design DNA ready:`);
    console.log(`  Colors: ${dna.colorPalette}`);
    console.log(`  Mood: ${dna.mood}`);
    console.log(`  Style: ${dna.styleTokens.join(', ')}`);
    if (dna.styleGuide) console.log(`  StyleRef: ${dna.styleGuide.aesthetic} (${dna.styleGuide.layoutPreset})`);
    
    return dna;
  }

  _buildColorPalette(brief, theme) {
    // Priority: brief preference > theme colors > category default
    if (brief.color_preference) return brief.color_preference;
    
    if (theme.colors) {
      const c = theme.colors;
      return `${c.primary}, ${c.secondary}, ${c.accent}, ${c.neutral}`;
    }
    
    // Category defaults
    const categoryColors = {
      acrylic_ornament: 'vibrant jewel tones, rich colors with light transparency',
      wood_ornament: 'warm earth tones, natural wood browns, soft gold',
      paper_card: 'clean whites, soft pastels, elegant gold accents',
      jar: 'warm neutrals, cheerful accent colors, cozy tones',
      frame: 'classic wood tones, warm white, subtle gold',
      mixed: 'harmonious warm palette with accent colors'
    };
    
    return categoryColors[brief.category] || 'warm neutral tones with accent colors';
  }

  _determineMood(brief, theme) {
    const themeMood = (theme.mood || []).join(', ');
    
    const occasionMood = {
      christmas: 'warm, festive, magical, cozy',
      mothers_day: 'tender, loving, elegant, grateful',
      valentines: 'romantic, warm, passionate, intimate',
      easter: 'fresh, bright, cheerful, spring renewal',
      teacher_gift: 'appreciative, warm, thoughtful, professional',
      birthday: 'celebratory, joyful, special, bright',
      general_gift: 'heartfelt, meaningful, warm, premium'
    };
    
    return themeMood || occasionMood[brief.occasion] || 'warm and inviting';
  }

  _selectTypography(brief) {
    const styleMap = {
      emotional: { heading: 'Playfair Display', body: 'Open Sans', weight: 'bold' },
      premium: { heading: 'Montserrat', body: 'Lato', weight: '600' },
      playful: { heading: 'Poppins', body: 'Nunito', weight: 'bold' },
      minimal: { heading: 'Helvetica', body: 'Arial', weight: '500' }
    };
    
    return styleMap[brief.copy_style] || styleMap.emotional;
  }

  _buildStyleTokens(brief, theme) {
    const tokens = ['photorealistic', 'professional Amazon listing', 'high quality', '4K'];
    
    // Category-specific tokens
    const categoryTokens = {
      acrylic_ornament: ['translucent material', 'light catching', 'stained glass effect'],
      wood_ornament: ['natural wood grain', 'handcrafted feel', 'warm rustic'],
      paper_card: ['clean design', 'elegant typography', 'premium paper texture'],
      jar: ['cozy desk setting', 'cheerful', 'gift-ready presentation'],
      frame: ['keepsake quality', 'sentimental', 'display-worthy']
    };
    
    tokens.push(...(categoryTokens[brief.category] || []));
    
    // Seasonal tokens
    if (theme.visual_elements) {
      tokens.push(...theme.visual_elements.slice(0, 3));
    }
    
    return tokens;
  }

  _buildGlobalSuffix(brief, theme) {
    const mood = this._determineMood(brief, theme);
    const palette = this._buildColorPalette(brief, theme);

    return `${mood} atmosphere, color palette: ${palette}, ` +
      `${theme.lighting || 'soft natural lighting'}, ` +
      `no text on image, professional product photography. ` +
      `The product must remain exactly as photographed — no redesign, no color shift, no stylization.`;
  }

  // ═══════════════════════════════════════
  //  CREATIVE ZONES — 70/30 control
  // ═══════════════════════════════════════

  _buildCreativeZones() {
    return {
      // These MUST NOT change
      locked: [
        'product shape and geometry',
        'product colors and materials',
        'product text, labels, and prints',
        'product texture and finish',
        'product proportions and scale'
      ],
      // These CAN be creative (30% zone)
      creative: [
        'background scene and environment',
        'surrounding props and objects',
        'camera angle and composition',
        'layout and visual hierarchy',
        'lighting mood and direction',
        'lifestyle context and setting',
        'seasonal decorations around product'
      ],
      // Ratio: 0.3 = 30% creative, 70% faithful
      creativityLevel: 0.3,
      // Prompt hint for AI
      zoneInstruction: 'CREATIVE FREEDOM: You may be creative with the background scene, surrounding props, camera angle, and layout composition. LOCKED: The product itself must remain exactly as shown in reference images — no changes to shape, color, text, or texture.'
    };
  }

  // ═══════════════════════════════════════
  //  THEME ANCHORS — Cross-pipeline consistency
  // ═══════════════════════════════════════

  _buildThemeAnchors(brief, theme) {
    const mood = this._determineMood(brief, theme);
    const surfaces = theme.surfaces || ['wooden table'];
    const contexts = theme.lifestyle_contexts || ['cozy home setting'];
    const elements = theme.visual_elements || [];

    return {
      // Primary scene description (shared by listing, A+, video)
      primaryScene: `${contexts[0]}, ${mood} atmosphere, ${theme.lighting || 'soft natural lighting'}`,

      // 5-7 consistent props across all outputs
      propPalette: elements.slice(0, 7),

      // Unified lighting key
      lightingKey: theme.lighting || 'soft warm natural lighting from the left',

      // Camera approach
      cameraStyle: 'warm perspective, slightly overhead for flat lays, eye-level for lifestyle, shallow depth of field',

      // Surface consistency
      primarySurface: surfaces[0],

      // Scene variety hints (for different slots while maintaining theme)
      sceneVariations: [
        contexts[0] || 'product on display',
        contexts[1] || 'lifestyle moment',
        'close-up detail shot',
        'gift-giving scene',
        'flat lay arrangement'
      ]
    };
  }

  /**
   * Save Design DNA to file for reference and debugging
   */
  saveDNA(dna, outputDir) {
    const dnaPath = path.join(outputDir, `${dna.sku}_design-dna.json`);
    fs.writeFileSync(dnaPath, JSON.stringify(dna, null, 2));
    console.log(`[DesignDirector] DNA saved: ${dnaPath}`);
    return dnaPath;
  }
}

module.exports = DesignDirector;
