const fs = require('fs');
const path = require('path');

/**
 * Style Analyzer — Trích xuất style reference từ _analysis.json
 * và tạo styleGuide object cho Design DNA + callout-graphics sử dụng.
 *
 * Flow: _analysis.json → analyzeStyle() → buildStyleGuide() → brief._styleGuide
 */

const DEFAULTS = {
  overall_aesthetic: 'premium',
  layout_patterns: {
    slot5_infographic: {
      layout_type: 'two-view-with-dimensions',
      product_position: 'center-left',
      annotation_style: 'red-lines-with-labels',
      badge_position: 'bottom-left',
      background: 'pure-white'
    },
    slot3_features: {
      layout_type: 'product-center-callouts-below',
      callout_style: 'circle-icons-with-text',
      icon_shape: 'circle',
      icon_border: true,
      text_hierarchy: 'icon-title-description'
    },
    general_listing: {
      text_position: 'top-banner',
      text_bg: 'solid-white',
      border_style: 'none',
      shadow_usage: 'product-shadow'
    }
  },
  typography_style: {
    heading_weight: 'bold',
    heading_case: 'uppercase',
    body_weight: 'regular',
    color_contrast: 'dark-on-light',
    size_ratio: 'large-heading-small-body'
  },
  color_usage: {
    primary_role: 'accent-lines',
    accent_usage: 'dimension-lines',
    background_preference: 'white',
    accent_colors_hex: []
  },
  composition_rules: {
    whitespace: 'generous',
    element_density: 'balanced',
    product_prominence: 'dominant-80%',
    symmetry: 'centered'
  }
};

/**
 * Đọc _analysis.json, trả về style_analysis section.
 * Nếu không có style_analysis, trả về defaults.
 */
function analyzeStyle(analysisPath) {
  if (!analysisPath || !fs.existsSync(analysisPath)) return DEFAULTS;
  try {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
    if (analysis.style_analysis) return { ...DEFAULTS, ...analysis.style_analysis };
    // Backward-compatible: trích xuất style hints từ patterns cũ
    return _inferStyleFromPatterns(analysis);
  } catch { return DEFAULTS; }
}

/**
 * Trích xuất style hints từ _analysis.json cũ (không có style_analysis).
 * Dùng patterns.visual_style, common_layouts, dominant_colors.
 */
function _inferStyleFromPatterns(analysis) {
  const style = { ...DEFAULTS };
  const patterns = analysis.patterns || {};

  // Infer aesthetic from visual_style
  const vs = (patterns.visual_style || '').toLowerCase();
  if (vs.includes('minimal')) style.overall_aesthetic = 'minimalist';
  else if (vs.includes('premium') || vs.includes('elegant')) style.overall_aesthetic = 'premium';
  else if (vs.includes('playful') || vs.includes('fun') || vs.includes('bright')) style.overall_aesthetic = 'playful';
  else if (vs.includes('rustic') || vs.includes('wood') || vs.includes('natural')) style.overall_aesthetic = 'rustic';
  else if (vs.includes('modern') || vs.includes('clean')) style.overall_aesthetic = 'modern';

  // Infer accent colors
  if (patterns.dominant_colors?.length > 0) {
    style.color_usage = {
      ...style.color_usage,
      accent_colors_hex: patterns.dominant_colors.filter(c => c.startsWith('#'))
    };
  }

  // Infer layout from common_layouts
  const layouts = (patterns.common_layouts || []).map(l => l.toLowerCase());
  if (layouts.some(l => l.includes('callout') || l.includes('icon'))) {
    style.layout_patterns.slot3_features.callout_style = 'circle-icons-with-text';
  }
  if (layouts.some(l => l.includes('grid'))) {
    style.layout_patterns.slot3_features.layout_type = 'grid-layout';
  }

  return style;
}

/**
 * Từ style_analysis → tạo styleGuide object cho Design DNA và pipelines sử dụng.
 */
function buildStyleGuide(styleAnalysis, brief) {
  const sa = styleAnalysis || DEFAULTS;

  // Build prompt style suffix
  const promptParts = [];
  promptParts.push(_aestheticToPrompt(sa.overall_aesthetic));
  promptParts.push(_compositionToPrompt(sa.composition_rules));
  promptParts.push(_typographyToPrompt(sa.typography_style));

  // Per-slot style overrides
  const slotStyles = {};
  if (sa.layout_patterns?.slot3_features) {
    slotStyles[3] = { ...sa.layout_patterns.slot3_features };
  }
  if (sa.layout_patterns?.slot5_infographic) {
    slotStyles[5] = { ...sa.layout_patterns.slot5_infographic };
  }

  return {
    aesthetic: sa.overall_aesthetic || 'premium',
    promptStyleSuffix: promptParts.filter(Boolean).join(', '),
    layoutPreset: sa.layout_patterns?.slot3_features?.layout_type || 'product-center-callouts-below',
    calloutPreset: sa.layout_patterns?.slot3_features?.callout_style || 'circle-icons-with-text',
    typographyPreset: {
      headingCase: sa.typography_style?.heading_case || 'uppercase',
      headingWeight: sa.typography_style?.heading_weight || 'bold',
      bodyWeight: sa.typography_style?.body_weight || 'regular',
      sizeRatio: sa.typography_style?.size_ratio || 'large-heading-small-body'
    },
    colorRoles: {
      primaryRole: sa.color_usage?.primary_role || 'accent-lines',
      accentUsage: sa.color_usage?.accent_usage || 'dimension-lines',
      backgroundPreference: sa.color_usage?.background_preference || 'white',
      accentColors: sa.color_usage?.accent_colors_hex || []
    },
    compositionRules: {
      whitespace: sa.composition_rules?.whitespace || 'generous',
      elementDensity: sa.composition_rules?.element_density || 'balanced',
      productProminence: _parseProminence(sa.composition_rules?.product_prominence),
      symmetry: sa.composition_rules?.symmetry || 'centered'
    },
    generalListing: sa.layout_patterns?.general_listing || DEFAULTS.layout_patterns.general_listing,
    slotStyles
  };
}

/**
 * Điều chỉnh graphic-profile params dựa trên styleGuide.
 * Trả về profile mới (không mutate original).
 */
function applyStyleToProfile(graphicProfile, styleGuide) {
  if (!styleGuide) return graphicProfile;
  const profile = JSON.parse(JSON.stringify(graphicProfile));
  const preset = _getPresetForAesthetic(styleGuide.aesthetic);

  // Merge preset vào profile (preset overrides base)
  for (const [key, val] of Object.entries(preset)) {
    if (profile[key]) {
      profile[key] = { ...profile[key], ...val };
    } else {
      profile[key] = val;
    }
  }

  // Adjust typography
  if (styleGuide.typographyPreset) {
    const tp = styleGuide.typographyPreset;
    if (tp.headingWeight === 'extra-bold') {
      profile.heading = { ...profile.heading, textSize: Math.round((profile.heading?.textSize || 44) * 1.15) };
    } else if (tp.headingWeight === 'medium') {
      profile.heading = { ...profile.heading, textSize: Math.round((profile.heading?.textSize || 44) * 0.9) };
    }
  }

  return profile;
}

/**
 * Trả về style analysis template (dùng trong research-agent --scan).
 */
function getStyleAnalysisTemplate() {
  return {
    overall_aesthetic: '',
    layout_patterns: {
      slot5_infographic: {
        layout_type: '',
        product_position: '',
        annotation_style: '',
        badge_position: '',
        background: ''
      },
      slot3_features: {
        layout_type: '',
        callout_style: '',
        icon_shape: '',
        icon_border: null,
        text_hierarchy: ''
      },
      general_listing: {
        text_position: '',
        text_bg: '',
        border_style: '',
        shadow_usage: ''
      }
    },
    typography_style: {
      heading_weight: '',
      heading_case: '',
      body_weight: '',
      color_contrast: '',
      size_ratio: ''
    },
    color_usage: {
      primary_role: '',
      accent_usage: '',
      background_preference: '',
      accent_colors_hex: []
    },
    composition_rules: {
      whitespace: '',
      element_density: '',
      product_prominence: '',
      symmetry: ''
    }
  };
}

// ═══ Internal helpers ═══

function _aestheticToPrompt(aesthetic) {
  const map = {
    minimalist: 'clean minimalist composition, ample negative space, restrained color palette',
    editorial: 'editorial magazine layout, dramatic lighting, bold typography placement',
    premium: 'premium professional photography, refined composition, sophisticated color harmony',
    playful: 'vibrant playful composition, dynamic angles, cheerful bright colors',
    rustic: 'warm rustic aesthetic, natural textures, organic earthy tones',
    modern: 'modern clean design, geometric balance, contemporary color blocking'
  };
  return map[aesthetic] || map.premium;
}

function _compositionToPrompt(comp) {
  if (!comp) return '';
  const parts = [];
  if (comp.whitespace === 'generous') parts.push('generous whitespace');
  if (comp.whitespace === 'compact') parts.push('dense layout with minimal padding');
  if (comp.symmetry === 'rule-of-thirds') parts.push('rule-of-thirds composition');
  if (comp.symmetry === 'asymmetric') parts.push('dynamic asymmetric balance');
  if (comp.element_density === 'sparse') parts.push('sparse clean arrangement');
  return parts.join(', ');
}

function _typographyToPrompt(typo) {
  if (!typo) return '';
  const parts = [];
  if (typo.color_contrast === 'light-on-dark') parts.push('light text on dark background');
  if (typo.size_ratio === 'large-heading-small-body') parts.push('strong typographic hierarchy');
  return parts.join(', ');
}

function _parseProminence(str) {
  if (!str) return 0.6;
  const match = String(str).match(/(\d+)/);
  return match ? parseInt(match[1]) / 100 : 0.6;
}

function _getPresetForAesthetic(aesthetic) {
  const presets = {
    minimalist: {
      circleCallout: { borderWidth: 1, shadow: false, labelSize: 16 },
      featureBadge: { borderRadius: 8, shadow: false, textSize: 20 },
      divider: { strokeWidth: 1, opacity: 0.3 },
      heading: { textSize: 36, underline: false },
      countBadge: { shadow: false, textSize: 28 }
    },
    premium: {
      circleCallout: { borderWidth: 3, shadow: true, labelSize: 18 },
      featureBadge: { borderRadius: 12, shadow: true, textSize: 22 },
      divider: { strokeWidth: 2, opacity: 0.5 },
      heading: { textSize: 44, underline: false },
      countBadge: { shadow: true, textSize: 32 }
    },
    playful: {
      circleCallout: { borderWidth: 4, shadow: true, labelSize: 20 },
      featureBadge: { borderRadius: 16, shadow: true, textSize: 24 },
      divider: { strokeWidth: 3, opacity: 0.7 },
      heading: { textSize: 48, underline: false },
      countBadge: { shadow: true, textSize: 36 }
    },
    rustic: {
      circleCallout: { borderWidth: 2, shadow: true, labelSize: 18 },
      featureBadge: { borderRadius: 6, shadow: false, textSize: 22 },
      divider: { strokeWidth: 2, style: 'solid', opacity: 0.4 },
      heading: { textSize: 42, underline: false },
      countBadge: { shadow: false, textSize: 30 }
    },
    modern: {
      circleCallout: { borderWidth: 2, shadow: false, labelSize: 18 },
      featureBadge: { borderRadius: 4, shadow: false, textSize: 22 },
      divider: { strokeWidth: 1, opacity: 0.4 },
      heading: { textSize: 40, underline: false },
      countBadge: { shadow: false, textSize: 30 }
    }
  };
  return presets[aesthetic] || presets.premium;
}

module.exports = { analyzeStyle, buildStyleGuide, applyStyleToProfile, getStyleAnalysisTemplate, DEFAULTS };
