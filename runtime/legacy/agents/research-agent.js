#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Research Agent — Helper Script
 *
 * This is NOT an autonomous agent. It provides helper functions for a workflow
 * where Claude Code (with Vision) does the actual image analysis.
 *
 * Flow:
 *   1. --scan     → list files in reference folder, group by competitor
 *   2. Claude Code views each image, analyzes, writes _analysis.json
 *   3. --enrich   → read _analysis.json + minimal brief → output enriched brief
 *   4. --organize → copy images into typed subfolders based on analysis
 *   5. --validate → check enriched brief has all required fields
 *   6. --full     → run scan + enrich + organize in sequence
 */

const paths = require('../utils/paths');
const PROJECT_ROOT = paths.agentRoot; // backward compat alias — migrate away over time

// ═══════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════

function loadConfig() {
  const configPath = path.join(paths.configDir, 'research-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Research config not found: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function loadTemplate() {
  const tplPath = path.join(paths.configDir, '_brief-template.json');
  // Fallback to old location for backward compatibility
  const legacyTplPath = path.join(PROJECT_ROOT, 'briefs', '_template.json');
  const actualTplPath = fs.existsSync(tplPath) ? tplPath : legacyTplPath;
  if (fs.existsSync(actualTplPath)) return JSON.parse(fs.readFileSync(actualTplPath, 'utf8'));
  return null;
}

// ═══════════════════════════════════════
//  1. SCAN — List & group reference files
// ═══════════════════════════════════════

function scanReferenceFolder(folderPath) {
  const absPath = path.resolve(PROJECT_ROOT, folderPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Reference folder not found: ${absPath}`);
  }

  const config = loadConfig();
  const allFiles = fs.readdirSync(absPath).filter(f => !f.startsWith('.') && !f.startsWith('_'));
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const dataExts = ['.json', '.txt', '.csv'];

  const images = [];
  const metadata = [];
  const subdirs = [];

  for (const file of allFiles) {
    const fullPath = path.join(absPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      subdirs.push(file);
      continue;
    }

    const ext = path.extname(file).toLowerCase();
    if (imageExts.includes(ext)) {
      images.push({ file, path: fullPath, type: classifyByFilename(file, config) });
    } else if (dataExts.includes(ext)) {
      metadata.push({ file, path: fullPath });
    }
  }

  // Group images by competitor prefix (e.g. competitor-01-main.jpg → competitor-01)
  const competitors = {};
  for (const img of images) {
    const match = img.file.match(/^(competitor-?\d+)/i) || img.file.match(/^(comp-?\d+)/i);
    const group = match ? match[1] : 'ungrouped';
    if (!competitors[group]) competitors[group] = [];
    competitors[group].push(img);
  }

  const result = {
    folder: absPath,
    total_images: images.length,
    total_metadata: metadata.length,
    existing_subdirs: subdirs,
    images,
    metadata,
    competitors,
    competitor_count: Object.keys(competitors).filter(k => k !== 'ungrouped').length
  };

  console.log('\n[Research] SCAN RESULTS');
  console.log(`  Folder: ${absPath}`);
  console.log(`  Images: ${images.length}`);
  console.log(`  Metadata files: ${metadata.length}`);
  console.log(`  Competitors: ${result.competitor_count}`);
  console.log(`  Existing subdirs: ${subdirs.join(', ') || 'none'}`);

  if (images.length > 0) {
    console.log('\n  Images found:');
    for (const img of images) {
      const typeTag = img.type ? ` [${img.type}]` : '';
      console.log(`    ${img.file}${typeTag}`);
    }
  }

  if (metadata.length > 0) {
    console.log('\n  Metadata files:');
    for (const m of metadata) {
      console.log(`    ${m.file}`);
    }
  }

  return result;
}

function classifyByFilename(filename, config) {
  const lower = filename.toLowerCase();
  const patterns = config.filename_patterns || {};
  for (const [type, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => lower.includes(kw))) return type;
  }
  return null;
}

// ═══════════════════════════════════════
//  2. CREATE ANALYSIS TEMPLATE
// ═══════════════════════════════════════

function createAnalysisTemplate(scanResult) {
  const template = {
    analyzed_at: null,
    folder: scanResult.folder,
    competitors_analyzed: scanResult.competitor_count,
    total_images_analyzed: scanResult.total_images,
    niche: '',
    category: '',

    per_image_analysis: scanResult.images.map(img => ({
      file: img.file,
      type: img.type || '',
      colors: [],
      layout: '',
      text_content: '',
      mood: '',
      notes: ''
    })),

    patterns: {
      avg_price: '',
      avg_rating: null,
      top_features: [],
      visual_style: '',
      headline_style: '',
      common_layouts: [],
      dominant_colors: [],
      image_type_distribution: {}
    },

    gaps: [],

    recommendations: {
      usp_angle: '',
      hero_headline: '',
      color_palette: [],
      must_include_slots: []
    },

    style_analysis: require('../utils/style-analyzer').getStyleAnalysisTemplate()
  };

  const outPath = path.join(scanResult.folder, '_analysis_template.json');
  fs.writeFileSync(outPath, JSON.stringify(template, null, 2));
  console.log(`\n[Research] Analysis template created: ${outPath}`);
  console.log('[Research] Claude Code should now view each image and fill in the analysis.');
  return outPath;
}

// ═══════════════════════════════════════
//  3. ENRICH BRIEF
// ═══════════════════════════════════════

function enrichBrief(briefPath, analysisPath) {
  const absBrief = path.resolve(PROJECT_ROOT, briefPath);
  if (!fs.existsSync(absBrief)) throw new Error(`Brief not found: ${absBrief}`);

  const brief = JSON.parse(fs.readFileSync(absBrief, 'utf8'));
  const config = loadConfig();
  const catDefaults = config.category_defaults[brief.category] || config.category_defaults.mixed;
  const occasionHL = config.occasion_headlines[brief.occasion] || config.occasion_headlines.general_gift;

  // Load analysis if provided
  let analysis = null;
  if (analysisPath) {
    const absAnalysis = path.resolve(PROJECT_ROOT, analysisPath);
    if (fs.existsSync(absAnalysis)) {
      analysis = JSON.parse(fs.readFileSync(absAnalysis, 'utf8'));
      console.log(`[Research] Loaded analysis: ${analysis.total_images_analyzed} images analyzed`);
    }
  } else if (brief.reference_folder) {
    // Auto-detect _analysis.json in reference folder
    const autoPath = path.join(path.resolve(PROJECT_ROOT, brief.reference_folder), '_analysis.json');
    if (fs.existsSync(autoPath)) {
      analysis = JSON.parse(fs.readFileSync(autoPath, 'utf8'));
      console.log(`[Research] Auto-loaded analysis from reference folder`);
    }
  }

  // Load knowledge summary if available
  let knowledge = null;
  const knowledgeSummaryPath = path.join(paths.knowledgeDir, '_summary.json');
  if (fs.existsSync(knowledgeSummaryPath)) {
    knowledge = JSON.parse(fs.readFileSync(knowledgeSummaryPath, 'utf8'));
    const ruleCount = knowledge.knowledge_rules?.length || 0;
    const tipsCount = knowledge.photography_tips?.length || 0;
    if (ruleCount > 0 || tipsCount > 0) {
      console.log(`[Research] Loaded knowledge base: ${ruleCount} rules, ${tipsCount} photography tips`);
    }
  }

  const enriched = { ...brief };

  // --- Features (5 bullet points) ---
  if (!enriched.features || enriched.features.length === 0) {
    if (analysis?.patterns?.top_features?.length >= 5) {
      enriched.features = analysis.patterns.top_features.slice(0, 5);
      console.log('[Research] Features: filled from competitor analysis');
    } else {
      enriched.features = catDefaults.features_template;
      console.log('[Research] Features: filled from category defaults');
    }
  }

  // --- USP ---
  if (!enriched.usp) {
    if (analysis?.recommendations?.usp_angle) {
      enriched.usp = analysis.recommendations.usp_angle;
      console.log('[Research] USP: filled from analysis recommendations');
    } else {
      enriched.usp = `The perfect ${brief.occasion?.replace(/_/g, ' ') || 'handcrafted'} gift — unique design you won't find anywhere else`;
      console.log('[Research] USP: filled from generic template');
    }
  }

  // --- Target Audience ---
  if (!enriched.target_audience || (!enriched.target_audience.buyer && !enriched.target_audience.recipient)) {
    enriched.target_audience = catDefaults.default_audience;
    console.log('[Research] Target audience: filled from category defaults');
  }

  // --- Feature Details (3x {visual, text} for Slot 3 infographic) ---
  if (!enriched.feature_details || enriched.feature_details.length < 3) {
    const features = enriched.features || [];
    const materials = (enriched.materials || []).join(' and ');
    enriched.feature_details = [
      {
        visual: `close-up of the structural base or mounting mechanism of the product`,
        text: features[0] || 'Premium construction'
      },
      {
        visual: `the full front face of the product showing the complete design and print`,
        text: features[1] || 'Beautiful design'
      },
      {
        visual: `extreme close-up showing the ${materials || 'material'} texture and finish quality`,
        text: features[2] || `High-quality ${materials || 'craftsmanship'}`
      }
    ];
    console.log('[Research] Feature details: generated from features + materials');
  }

  // --- Headlines ---
  if (!enriched.headline_text) {
    enriched.headline_text = analysis?.recommendations?.hero_headline || occasionHL.headline;
    console.log('[Research] Headline: filled');
  }
  if (!enriched.subheadline_text) {
    enriched.subheadline_text = occasionHL.subheadline;
    console.log('[Research] Subheadline: filled');
  }

  // --- Color Preference ---
  if (!enriched.color_preference) {
    if (analysis?.patterns?.dominant_colors?.length > 0) {
      enriched.color_preference = analysis.patterns.visual_style || analysis.patterns.dominant_colors.join(', ');
      console.log('[Research] Color preference: filled from analysis');
    } else {
      enriched.color_preference = catDefaults.default_color_preference;
      console.log('[Research] Color preference: filled from category defaults');
    }
  }

  // --- Copy Style ---
  if (!enriched.copy_style) {
    if (analysis?.patterns?.headline_style) {
      const style = analysis.patterns.headline_style.toLowerCase();
      if (style.includes('emotional')) enriched.copy_style = 'emotional';
      else if (style.includes('premium')) enriched.copy_style = 'premium';
      else if (style.includes('playful')) enriched.copy_style = 'playful';
      else if (style.includes('minimal') || style.includes('functional')) enriched.copy_style = 'minimal';
      else enriched.copy_style = catDefaults.default_copy_style;
    } else {
      enriched.copy_style = catDefaults.default_copy_style;
    }
    console.log(`[Research] Copy style: ${enriched.copy_style}`);
  }

  // --- Dimensions (from analysis product_details) ---
  if (!enriched.dimensions && analysis?.product_details?.dimensions) {
    const d = analysis.product_details.dimensions;
    // Extract inch values from strings like "11cm / 4.33in" or plain "4.33"
    const extractInches = (s) => {
      if (!s) return '';
      const inMatch = String(s).match(/([\d.]+)\s*in/i);
      if (inMatch) return inMatch[1];
      const num = parseFloat(s);
      return isNaN(num) ? '' : String(num);
    };
    const w = extractInches(d.width);
    const h = extractInches(d.height);
    if (w && h) {
      enriched.dimensions = `${w} x ${h}`;
      console.log(`[Research] Dimensions: ${enriched.dimensions} (from analysis)`);
    }
  }

  // --- Quantity (from analysis product_details) ---
  if (!enriched.quantity && analysis?.product_details?.quantity) {
    const qMatch = String(analysis.product_details.quantity).match(/(\d+)/);
    if (qMatch) {
      enriched.quantity = qMatch[1];
      console.log(`[Research] Quantity: ${enriched.quantity} (from analysis)`);
    }
  }

  // --- Seasonal Theme ---
  if (!enriched.seasonal_theme && enriched.occasion) {
    enriched.seasonal_theme = enriched.occasion;
    console.log('[Research] Seasonal theme: set to occasion');
  }

  // --- Use Case Description (Slot 4) ---
  if (!enriched.use_case_description) {
    if (analysis?.recommendations?.use_case) {
      enriched.use_case_description = analysis.recommendations.use_case;
    }
    // else: image-generator.js has its own categoryDefaults fallback
  }

  // --- Function Demo ---
  if (!enriched.function_demo) {
    if (analysis?.recommendations?.function_demo) {
      enriched.function_demo = analysis.recommendations.function_demo;
    }
  }

  // --- Competitor ASINs ---
  if ((!enriched.competitor_asins || enriched.competitor_asins.length === 0) && analysis) {
    const asins = [];
    for (const img of (analysis.per_image_analysis || [])) {
      if (img.asin) asins.push(img.asin);
    }
    if (asins.length > 0) {
      enriched.competitor_asins = [...new Set(asins)];
      console.log(`[Research] Competitor ASINs: ${enriched.competitor_asins.length} found`);
    }
  }

  // --- Slot Concepts (per-slot design from competitor analysis) ---
  if (analysis?.slot_concepts && Object.keys(analysis.slot_concepts).length > 0) {
    enriched.slot_concepts = analysis.slot_concepts;
    console.log(`[Research] Slot concepts: ${Object.keys(analysis.slot_concepts).length} slots with custom design`);
  }

  // --- Knowledge Base Integration ---
  if (knowledge) {
    // Attach niche-specific insights from knowledge base
    const nicheKey = enriched.category?.replace(/_/g, '-');
    const nicheInsights = knowledge.category_insights?.[nicheKey] || [];
    if (nicheInsights.length > 0) {
      enriched.knowledge_insights = nicheInsights;
      console.log(`[Research] Knowledge: ${nicheInsights.length} niche insights for "${nicheKey}"`);
    }

    // Attach photography tips
    if (knowledge.photography_tips?.length > 0) {
      enriched.knowledge_photography_tips = knowledge.photography_tips;
      console.log(`[Research] Knowledge: ${knowledge.photography_tips.length} photography tips attached`);
    }

    // Attach conversion tactics
    if (knowledge.conversion_tactics?.length > 0) {
      enriched.knowledge_conversion_tactics = knowledge.conversion_tactics;
      console.log(`[Research] Knowledge: ${knowledge.conversion_tactics.length} conversion tactics attached`);
    }

    // Attach general knowledge rules
    if (knowledge.knowledge_rules?.length > 0) {
      enriched.knowledge_rules = knowledge.knowledge_rules;
      console.log(`[Research] Knowledge: ${knowledge.knowledge_rules.length} general rules attached`);
    }
  }

  // --- Style Guide (from style_analysis in _analysis.json) ---
  if (analysis) {
    const { analyzeStyle, buildStyleGuide } = require('../utils/style-analyzer');
    const styleData = analyzeStyle(analysisPath || (brief.reference_folder ? path.join(path.resolve(PROJECT_ROOT, brief.reference_folder), '_analysis.json') : null));
    const styleGuide = buildStyleGuide(styleData, enriched);
    enriched._styleGuide = styleGuide;
    console.log(`[Research] Style guide: aesthetic="${styleGuide.aesthetic}", layout="${styleGuide.layoutPreset}", callout="${styleGuide.calloutPreset}"`);
  }

  // --- Web Research integration ---
  // Try research dir (new mode) first, then legacy output dir
  const briefDir = path.dirname(path.resolve(briefPath));
  const newWebResearch = path.join(briefDir, 'research', '_web_research.json');
  const legacyWebResearch = path.join(PROJECT_ROOT, 'output', brief.sku, '_web_research.json');
  const webResearchPath = fs.existsSync(newWebResearch) ? newWebResearch : legacyWebResearch;
  if (fs.existsSync(webResearchPath) && !enriched.web_research_merged) {
    try {
      const { mergeWebResearch } = require('./auto-research');
      const webMerged = mergeWebResearch(absBrief, webResearchPath);
      if (webMerged) {
        Object.assign(enriched, webMerged);
        console.log(`[Research] Web research auto-merged: ${webMerged.web_research_fields_added} fields`);
      }
    } catch (err) {
      console.warn(`[Research] Web research merge failed: ${err.message}`);
    }
  }

  // --- Enrichment metadata ---
  enriched.enriched = true;
  enriched.enriched_at = new Date().toISOString();
  enriched.enriched_by = 'research-agent';
  if (analysis) enriched.enrichment_source = analysisPath || 'auto-detected _analysis.json';
  if (knowledge) enriched.knowledge_source = 'knowledge/_summary.json';

  // Save
  fs.writeFileSync(absBrief, JSON.stringify(enriched, null, 2));
  console.log(`\n[Research] Enriched brief saved: ${absBrief}`);

  // Validate
  const validation = validateEnrichedBrief(enriched);
  if (validation.valid) {
    console.log('[Research] Validation: PASSED — all required fields present');
  } else {
    console.log(`[Research] Validation: ${validation.missing.length} missing fields`);
    validation.missing.forEach(f => console.log(`  - ${f}`));
  }
  if (validation.warnings.length > 0) {
    console.log(`[Research] Warnings:`);
    validation.warnings.forEach(w => console.log(`  - ${w}`));
  }

  return enriched;
}

// ═══════════════════════════════════════
//  4. ORGANIZE IMAGES into subfolders
// ═══════════════════════════════════════

function organizeImages(folderPath, analysisPath) {
  const absFolder = path.resolve(PROJECT_ROOT, folderPath);
  if (!fs.existsSync(absFolder)) throw new Error(`Folder not found: ${absFolder}`);

  const absAnalysis = path.resolve(PROJECT_ROOT, analysisPath || path.join(folderPath, '_analysis.json'));
  if (!fs.existsSync(absAnalysis)) {
    throw new Error(`Analysis file not found: ${absAnalysis}\nRun image analysis first, then try again.`);
  }

  const analysis = JSON.parse(fs.readFileSync(absAnalysis, 'utf8'));
  const config = loadConfig();
  const imageTypes = config.image_types;

  // Create subdirs
  for (const type of imageTypes) {
    const dir = path.join(absFolder, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  let moved = 0;
  let skipped = 0;

  for (const entry of (analysis.per_image_analysis || [])) {
    if (!entry.type || !entry.file) { skipped++; continue; }

    const srcPath = path.join(absFolder, entry.file);
    if (!fs.existsSync(srcPath)) { skipped++; continue; }

    // Validate type
    if (!imageTypes.includes(entry.type)) {
      console.warn(`[Research] Unknown type "${entry.type}" for ${entry.file}, skipping`);
      skipped++;
      continue;
    }

    const destDir = path.join(absFolder, entry.type);
    const destPath = path.join(destDir, entry.file);

    if (fs.existsSync(destPath)) { skipped++; continue; }

    fs.copyFileSync(srcPath, destPath);
    moved++;
  }

  console.log(`\n[Research] ORGANIZE COMPLETE`);
  console.log(`  Copied: ${moved} images into subfolders`);
  console.log(`  Skipped: ${skipped} (already exists, no type, or missing file)`);
  console.log(`  Subfolders: ${imageTypes.join(', ')}`);

  return { moved, skipped };
}

// ═══════════════════════════════════════
//  5. VALIDATE enriched brief
// ═══════════════════════════════════════

function validateEnrichedBrief(brief) {
  const missing = [];
  const warnings = [];

  // Required fields for pipeline
  const required = ['sku', 'product_name', 'category', 'materials', 'dimensions', 'features', 'input_images'];
  for (const field of required) {
    const val = brief[field];
    if (val === undefined || val === null || val === '') missing.push(field);
    else if (Array.isArray(val) && val.length === 0) missing.push(`${field} (empty array)`);
  }

  // Features should have 5 items
  if (brief.features && brief.features.length < 5) {
    warnings.push(`features has ${brief.features.length}/5 items`);
  }

  // Feature details should have 3 items
  if (brief.feature_details && brief.feature_details.length < 3) {
    warnings.push(`feature_details has ${brief.feature_details.length}/3 items`);
  }

  // Check feature_details structure
  if (brief.feature_details) {
    for (let i = 0; i < brief.feature_details.length; i++) {
      const fd = brief.feature_details[i];
      if (!fd.visual) warnings.push(`feature_details[${i}] missing "visual"`);
      if (!fd.text) warnings.push(`feature_details[${i}] missing "text"`);
    }
  }

  // Recommended fields
  const recommended = ['usp', 'occasion', 'target_audience', 'color_preference', 'copy_style'];
  for (const field of recommended) {
    if (!brief[field]) warnings.push(`${field} not set (recommended)`);
  }

  // Input images exist
  if (brief.input_images) {
    for (const img of brief.input_images) {
      const absImg = path.resolve(PROJECT_ROOT, img);
      if (!fs.existsSync(absImg)) warnings.push(`input_image not found: ${img}`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
    field_count: Object.keys(brief).length
  };
}

// ═══════════════════════════════════════
//  6. PARSE METADATA FILES
// ═══════════════════════════════════════

function parseMetadata(metadataFiles) {
  const competitors = [];

  for (const { file, path: filePath } of metadataFiles) {
    try {
      const ext = path.extname(file).toLowerCase();
      const content = fs.readFileSync(filePath, 'utf8');

      if (ext === '.json') {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          competitors.push(...data);
        } else {
          competitors.push(data);
        }
      } else if (ext === '.txt' || ext === '.csv') {
        // Try to extract structured data from text
        const entry = parseTextMetadata(content, file);
        if (entry) competitors.push(entry);
      }
    } catch (e) {
      console.warn(`[Research] Failed to parse ${file}: ${e.message}`);
    }
  }

  if (competitors.length > 0) {
    console.log(`\n[Research] Parsed ${competitors.length} competitor entries from metadata`);
    for (const c of competitors) {
      const price = c.price || c.price_range || '';
      const rating = c.rating || '';
      console.log(`  - ${(c.title || c.name || 'Unknown').substring(0, 60)} | ${price} | ${rating}`);
    }
  }

  return competitors;
}

function parseTextMetadata(content, filename) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const entry = { source_file: filename };

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('title:')) entry.title = line.substring(6).trim();
    else if (lower.startsWith('price:')) entry.price = line.substring(6).trim();
    else if (lower.startsWith('rating:')) entry.rating = parseFloat(line.substring(7).trim());
    else if (lower.startsWith('reviews:')) entry.reviews = parseInt(line.substring(8).trim());
    else if (lower.startsWith('asin:')) entry.asin = line.substring(5).trim();
    else if (lower.startsWith('bullet:') || lower.startsWith('feature:')) {
      if (!entry.bullets) entry.bullets = [];
      entry.bullets.push(line.substring(line.indexOf(':') + 1).trim());
    }
  }

  // If no structured data found, treat first line as title
  if (!entry.title && lines.length > 0) entry.title = lines[0];

  return entry;
}

// ═══════════════════════════════════════
//  CLI
// ═══════════════════════════════════════

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Research Agent — Helper Script for Claude Code Vision Workflow

Usage:
  node agents/research-agent.js <brief.json> --scan          Scan reference folder, list files
  node agents/research-agent.js <brief.json> --enrich        Enrich brief from analysis
  node agents/research-agent.js <brief.json> --validate      Validate enriched brief
  node agents/research-agent.js <brief.json> --full          Scan + create template + enrich
  node agents/research-agent.js --organize <folder> --analysis <path>   Organize images

Options:
  --analysis <path>     Path to _analysis.json (auto-detected if not specified)
  --verbose             Show detailed output

Workflow:
  1. Run --scan to list reference files
  2. Claude Code views each image and creates _analysis.json
  3. Run --enrich to auto-fill brief from analysis
  4. Run --organize to sort images into subfolders
  5. Run pipeline: node agents/master.js briefs/[sku].json
`);
    process.exit(0);
  }

  const hasFlag = (flag) => args.includes(flag);
  const getFlagValue = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  try {
    // --organize mode (no brief needed)
    if (hasFlag('--organize')) {
      const folder = getFlagValue('--organize');
      const analysisFile = getFlagValue('--analysis');
      if (!folder) throw new Error('--organize requires a folder path');
      organizeImages(folder, analysisFile);
      process.exit(0);
    }

    // Brief-based commands
    const briefPath = args.find(a => a.endsWith('.json') && !a.startsWith('--'));
    if (!briefPath) throw new Error('Brief JSON path required');

    const absBrief = path.resolve(PROJECT_ROOT, briefPath);
    if (!fs.existsSync(absBrief)) throw new Error(`Brief not found: ${absBrief}`);

    const brief = JSON.parse(fs.readFileSync(absBrief, 'utf8'));

    if (hasFlag('--scan') || hasFlag('--full')) {
      const refFolder = brief.reference_folder;
      if (!refFolder) throw new Error('Brief must have "reference_folder" field for scanning');

      const scanResult = scanReferenceFolder(refFolder);

      // Parse any metadata files found
      if (scanResult.metadata.length > 0) {
        parseMetadata(scanResult.metadata);
      }

      // Create analysis template
      createAnalysisTemplate(scanResult);

      console.log('\n[Research] NEXT STEP:');
      console.log('  Claude Code should now view each image and fill _analysis.json');
      console.log(`  Then run: node agents/research-agent.js ${briefPath} --enrich`);
    }

    if (hasFlag('--enrich') || hasFlag('--full')) {
      const analysisFile = getFlagValue('--analysis');
      enrichBrief(briefPath, analysisFile);
    }

    if (hasFlag('--validate')) {
      const validation = validateEnrichedBrief(brief);
      console.log('\n[Research] VALIDATION RESULT');
      console.log(`  Valid: ${validation.valid}`);
      console.log(`  Total fields: ${validation.field_count}`);
      if (validation.missing.length > 0) {
        console.log(`  Missing (${validation.missing.length}):`);
        validation.missing.forEach(f => console.log(`    - ${f}`));
      }
      if (validation.warnings.length > 0) {
        console.log(`  Warnings (${validation.warnings.length}):`);
        validation.warnings.forEach(w => console.log(`    - ${w}`));
      }
    }

  } catch (err) {
    console.error(`[Research] ERROR: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { scanReferenceFolder, enrichBrief, organizeImages, validateEnrichedBrief, parseMetadata };
