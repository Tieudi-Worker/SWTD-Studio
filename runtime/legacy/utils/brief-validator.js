/**
 * Brief JSON Schema Validator
 *
 * Validates brief structure before pipeline runs.
 * Returns { valid, errors[], warnings[] } for clear diagnostics.
 */

const VALID_CATEGORIES = ['mixed', 'wood_ornament', 'acrylic_ornament', 'paper_card', 'jar', 'frame'];
const VALID_OCCASIONS = ['christmas', 'mothers_day', 'valentines', 'easter', 'teacher_gift', 'birthday', 'classroom_reward', 'general_gift', 'graduation'];

const REQUIRED_FIELDS = [
  { field: 'sku', type: 'string', msg: 'SKU identifier is required' },
  { field: 'product_name', type: 'string', msg: 'Product name is required' }
];

const RECOMMENDED_FIELDS = [
  { field: 'category', type: 'string', values: VALID_CATEGORIES },
  { field: 'materials', type: 'array', minLength: 1, msg: 'Materials help AI generate accurate textures' },
  { field: 'features', type: 'array', minLength: 1, msg: 'Features are used for Slot 3 infographic' },
  { field: 'dimensions', type: 'string', msg: 'Dimensions are used for Slot 5 size infographic' },
  { field: 'occasion', type: 'string', values: VALID_OCCASIONS },
  { field: 'input_images', type: 'array', minLength: 1, msg: 'At least 1 product reference image is required for Slot 1' }
];

const OPTIONAL_FIELDS = [
  'usp', 'niche', 'seasonal_theme', 'target_audience', 'price_range',
  'competitor_asins', 'slot8_text', 'slot8_type', 'quantity',
  'use_case_description', 'force_text_overlay', 'color_preference',
  'copy_style', 'headline_text', 'subheadline_text', 'feature_details',
  'slot_concepts', 'reference_folder', 'listing_reference', 'aplus_reference',
  'function_demo', 'enriched', 'brand_id', 'slot_model_override'
];

function validateBrief(brief, options = {}) {
  const { strict = false } = options;
  const errors = [];
  const warnings = [];

  if (!brief || typeof brief !== 'object') {
    return { valid: false, errors: ['Brief must be a JSON object'], warnings: [] };
  }

  // Required fields
  for (const { field, type, msg } of REQUIRED_FIELDS) {
    if (!brief[field]) {
      errors.push(`Missing required field "${field}": ${msg}`);
    } else if (type === 'string' && typeof brief[field] !== 'string') {
      errors.push(`Field "${field}" must be a string, got ${typeof brief[field]}`);
    }
  }

  // Recommended fields
  for (const rec of RECOMMENDED_FIELDS) {
    const val = brief[rec.field];

    if (val === undefined || val === null || val === '') {
      const level = strict ? errors : warnings;
      level.push(`Missing "${rec.field}": ${rec.msg || `Recommended for better output quality`}`);
      continue;
    }

    if (rec.type === 'string' && typeof val !== 'string') {
      errors.push(`Field "${rec.field}" must be a string, got ${typeof val}`);
    }

    if (rec.type === 'array') {
      if (!Array.isArray(val)) {
        errors.push(`Field "${rec.field}" must be an array, got ${typeof val}`);
      } else if (rec.minLength && val.length < rec.minLength) {
        warnings.push(`Field "${rec.field}" has ${val.length} items, recommended at least ${rec.minLength}`);
      }
    }

    if (rec.values && val && !rec.values.includes(val)) {
      warnings.push(`Field "${rec.field}" value "${val}" not in known values: ${rec.values.join(', ')}. Pipeline will use defaults.`);
    }
  }

  // Input images validation
  if (brief.input_images && Array.isArray(brief.input_images)) {
    if (brief.input_images.length === 0) {
      errors.push('input_images array is empty — Slot 1 (main image) will fail');
    } else if (brief.input_images.length < 2) {
      warnings.push('Only 1 input image — Slot 5 secondary image and richer AI refs will be missing');
    }
  }

  // Feature details for Slot 3
  if (brief.feature_details && Array.isArray(brief.feature_details)) {
    if (brief.feature_details.length < 3) {
      warnings.push(`feature_details has ${brief.feature_details.length}/3 items — Slot 3 will use fallback feature visuals`);
    }
    for (let i = 0; i < brief.feature_details.length; i++) {
      const fd = brief.feature_details[i];
      if (!fd.visual || !fd.text) {
        warnings.push(`feature_details[${i}] missing "visual" or "text" field`);
      }
    }
  }

  // Dimensions format
  if (brief.dimensions && typeof brief.dimensions === 'string') {
    if (!brief.dimensions.includes('x') && brief.dimensions.length > 0) {
      warnings.push(`dimensions "${brief.dimensions}" should be in "WxH" format (e.g., "4.5x6")`);
    }
  }

  // Slot concepts validation
  if (brief.slot_concepts && typeof brief.slot_concepts === 'object') {
    const validSlots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8'];
    for (const key of Object.keys(brief.slot_concepts)) {
      if (!validSlots.includes(key)) {
        warnings.push(`Unknown slot_concepts key "${key}" — valid keys: ${validSlots.join(', ')}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Print validation results to console.
 * Returns true if valid (no errors), false otherwise.
 */
function printValidation(brief, options = {}) {
  const result = validateBrief(brief, options);

  if (result.errors.length > 0) {
    console.error(`[Brief] VALIDATION FAILED (${result.errors.length} errors):`);
    result.errors.forEach(e => console.error(`  ✗ ${e}`));
  }

  if (result.warnings.length > 0) {
    console.warn(`[Brief] ${result.warnings.length} warnings:`);
    result.warnings.forEach(w => console.warn(`  ⚠ ${w}`));
  }

  if (result.valid && result.warnings.length === 0) {
    console.log('[Brief] Validation OK — all fields present');
  } else if (result.valid) {
    console.log(`[Brief] Validation OK — ${result.warnings.length} optional fields missing`);
  }

  return result.valid;
}

module.exports = { validateBrief, printValidation, VALID_CATEGORIES, VALID_OCCASIONS };
