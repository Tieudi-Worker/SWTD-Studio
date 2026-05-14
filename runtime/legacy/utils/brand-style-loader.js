const fs = require('fs');
const path = require('path');

const BRAND_DIR = path.join(__dirname, '..', 'knowledge', 'brand-style');
const _cache = new Map();

function loadBrandStyle(brandId) {
  if (!brandId) return null;
  if (_cache.has(brandId)) return _cache.get(brandId);

  const filePath = path.join(BRAND_DIR, `${brandId}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`[BrandStyle] "${brandId}" not found at ${filePath}`);
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    _cache.set(brandId, data);
    return data;
  } catch (err) {
    console.warn(`[BrandStyle] Failed to load "${brandId}": ${err.message}`);
    return null;
  }
}

/**
 * Merge brand style into DNA. Vision-derived art_direction wins over brand
 * defaults (Vision is per-SKU, more specific). Brand always wins on props,
 * color anchors, and typography (brand-wide identity).
 *
 * Does NOT override product_observations.frozen_elements — those are sacred.
 */
function mergeIntoDNA(dna, brandStyle) {
  if (!brandStyle) return dna;
  const merged = { ...dna };

  // Brand sets defaults — Vision-derived art_direction wins if present
  if (!dna.art_direction || !dna._vision_director_used) {
    merged.art_direction = {
      ...(dna.art_direction || {}),
      style_reference: brandStyle.visual_identity?.art_direction_style_reference || dna.art_direction?.style_reference,
      lighting_recipe: brandStyle.visual_identity?.lighting_default || dna.art_direction?.lighting_recipe
    };
  }

  if (brandStyle.visual_identity?.color_anchors || brandStyle.visual_identity?.prop_palette) {
    merged.cohesion_anchors = {
      ...(dna.cohesion_anchors || {}),
      props: brandStyle.visual_identity?.prop_palette || dna.cohesion_anchors?.props || [],
      color_anchors: brandStyle.visual_identity?.color_anchors ? [
        brandStyle.visual_identity.color_anchors.primary,
        brandStyle.visual_identity.color_anchors.secondary,
        brandStyle.visual_identity.color_anchors.accent
      ].filter(Boolean) : dna.cohesion_anchors?.color_anchors || []
    };
  }

  if (brandStyle.typography) {
    merged.typography = {
      ...(dna.typography || {}),
      heading: brandStyle.typography.heading || dna.typography?.heading,
      body: brandStyle.typography.body || dna.typography?.body,
      weight: brandStyle.typography.weight_heading || dna.typography?.weight
    };
  }

  merged.brand_taste = {
    brand_id: brandStyle.brand_id,
    brand_name: brandStyle.brand_name,
    persona: brandStyle.persona,
    ethics: brandStyle.ethics
  };

  return merged;
}

module.exports = { loadBrandStyle, mergeIntoDNA, clearCache: () => _cache.clear() };
