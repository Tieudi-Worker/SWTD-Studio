#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const paths = require('../utils/paths');
const PROJECT_ROOT = paths.agentRoot; // backward compat alias

function loadConfig() {
  const p = path.join(paths.configDir, 'research-config.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}

// ═══════════════════════════════════════
//  PHASE A: Keyword Parsing (instant)
// ═══════════════════════════════════════

/**
 * Parse product name + folder name to detect category, occasion, materials, niche.
 * Uses keyword matching from research-config.json → product_keywords.
 */
function keywordParse(brief) {
  const config = loadConfig();
  const keywords = config.product_keywords || {};
  const name = (brief.product_name || '').toLowerCase();

  const results = { category: null, occasion: null, materials: [], niche: null };

  // Match category (longest match first)
  if (keywords.category_map) {
    let bestCat = null, bestLen = 0;
    for (const [cat, terms] of Object.entries(keywords.category_map)) {
      for (const term of terms) {
        if (name.includes(term.toLowerCase()) && term.length > bestLen) {
          bestCat = cat;
          bestLen = term.length;
        }
      }
    }
    if (bestCat) results.category = bestCat;
  }

  // Match occasion (longest match first, skip generic "gift" if specific match found)
  if (keywords.occasion_map) {
    let bestOcc = null, bestLen = 0;
    for (const [occ, terms] of Object.entries(keywords.occasion_map)) {
      for (const term of terms) {
        if (name.includes(term.toLowerCase()) && term.length > bestLen) {
          bestOcc = occ;
          bestLen = term.length;
        }
      }
    }
    if (bestOcc) results.occasion = bestOcc;
  }

  // Match materials (all matches)
  if (keywords.materials_map) {
    for (const [mat, terms] of Object.entries(keywords.materials_map)) {
      for (const term of terms) {
        if (name.includes(term.toLowerCase()) && !results.materials.includes(mat)) {
          results.materials.push(mat);
        }
      }
    }
  }

  // Match niche (best match)
  if (keywords.niche_map) {
    let bestNiche = null, bestLen = 0;
    for (const [niche, terms] of Object.entries(keywords.niche_map)) {
      for (const term of terms) {
        if (name.includes(term.toLowerCase()) && term.length > bestLen) {
          bestNiche = niche;
          bestLen = term.length;
        }
      }
    }
    if (bestNiche) results.niche = bestNiche;
  }

  return results;
}

/**
 * Apply keyword parse results to brief, only filling empty fields.
 */
function applyKeywordParse(brief) {
  const parsed = keywordParse(brief);

  if (parsed.category && brief.category === 'mixed') {
    brief.category = parsed.category;
    console.log(`[AutoResearch] Category: ${parsed.category} (from product name)`);
  }
  if (parsed.occasion && (!brief.occasion || brief.occasion === 'general_gift')) {
    brief.occasion = parsed.occasion;
    console.log(`[AutoResearch] Occasion: ${parsed.occasion} (from product name)`);
  }
  if (parsed.materials.length > 0 && (!brief.materials || brief.materials.length === 0)) {
    brief.materials = parsed.materials;
    console.log(`[AutoResearch] Materials: ${parsed.materials.join(', ')} (from product name)`);
  }
  if (parsed.niche && !brief.niche) {
    brief.niche = parsed.niche;
    console.log(`[AutoResearch] Niche: ${parsed.niche} (from product name)`);
  }

  // Set seasonal_theme from occasion if empty
  if (!brief.seasonal_theme && brief.occasion) {
    brief.seasonal_theme = brief.occasion;
  }

  return brief;
}

// ═══════════════════════════════════════
//  PHASE B: Select Representative Images
// ═══════════════════════════════════════

/**
 * Select representative images from Listing-temp and reference folders.
 * Returns { listingImages: [], referenceImages: [] } with paths + selection reason.
 */
function selectRepresentativeImages(scanResult) {
  const selected = { listingImages: [], referenceImages: [] };

  // Listing-temp: pick diverse set (max 6)
  if (scanResult.listingImages && scanResult.listingImages.length > 0) {
    const imgs = scanResult.listingImages;
    // Prefer SL1500 (high quality Amazon images)
    const sl1500 = imgs.filter(p => p.includes('SL1500'));
    const others = imgs.filter(p => !p.includes('SL1500'));
    const pool = [...sl1500, ...others];

    // Pick evenly spaced from pool (max 6)
    const max = Math.min(6, pool.length);
    const step = Math.max(1, Math.floor(pool.length / max));
    for (let i = 0; i < pool.length && selected.listingImages.length < max; i += step) {
      selected.listingImages.push(pool[i]);
    }
    console.log(`[AutoResearch] Selected ${selected.listingImages.length}/${imgs.length} listing images for analysis`);
  }

  // Reference: pick first 3 different images
  if (scanResult.referenceImages && scanResult.referenceImages.length > 0) {
    const max = Math.min(3, scanResult.referenceImages.length);
    selected.referenceImages = scanResult.referenceImages.slice(0, max);
    console.log(`[AutoResearch] Selected ${selected.referenceImages.length}/${scanResult.referenceImages.length} reference images for analysis`);
  }

  return selected;
}

// ═══════════════════════════════════════
//  PHASE B2: Create Analysis from Vision
// ═══════════════════════════════════════

/**
 * Create _analysis.json from Claude Vision results.
 * Called by Claude Code after reading images.
 */
function createAnalysis(sku, visionData) {
  const analysis = {
    analyzed_at: new Date().toISOString(),
    analyzed_by: 'auto-research + claude-vision',
    total_images_analyzed: visionData.total_images || 0,
    patterns: {
      top_features: visionData.features || [],
      dominant_colors: visionData.colors || [],
      visual_style: visionData.visual_style || '',
      headline_style: visionData.headline_style || 'playful',
      common_layouts: visionData.layouts || [],
      image_type_distribution: visionData.type_distribution || {}
    },
    recommendations: {
      usp_angle: visionData.usp || '',
      hero_headline: visionData.headline || '',
      color_palette: visionData.color_palette || [],
      use_case: visionData.use_case || '',
      function_demo: visionData.function_demo || ''
    },
    // Per-slot design concepts extracted from competitor Listing-temp analysis
    slot_concepts: visionData.slot_concepts || {}
  };

  // Save to research dir (new mode) or output/{SKU}/ (legacy)
  const outDir = visionData._researchDir || path.join(PROJECT_ROOT, 'output', sku);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const analysisPath = path.join(outDir, '_analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  console.log(`[AutoResearch] Analysis saved: ${analysisPath}`);

  return analysisPath;
}

/**
 * Create analysis template (for standalone CLI without Claude Vision).
 */
function createAnalysisTemplate(sku, selectedImages) {
  const template = {
    analyzed_at: null,
    analyzed_by: null,
    total_images_analyzed: 0,
    _instructions: 'Fill this template by viewing each image. Then run --research to enrich brief.',
    _images_to_review: {
      listing: selectedImages.listingImages.map(p => path.basename(p)),
      reference: selectedImages.referenceImages.map(p => path.basename(p))
    },
    patterns: {
      top_features: ['[Feature 1 from competitor infographics]', '[Feature 2]', '[Feature 3]', '[Feature 4]', '[Feature 5]'],
      dominant_colors: ['[color1]', '[color2]'],
      visual_style: '[e.g. bright, playful, kid-friendly]',
      headline_style: '[emotional / premium / playful / minimal]',
      common_layouts: [],
      image_type_distribution: {}
    },
    recommendations: {
      usp_angle: '[What makes this product unique vs competitors]',
      hero_headline: '[Main headline for listing]',
      color_palette: [],
      use_case: '[Primary use case scene description]',
      function_demo: '[How the product works — key interaction]'
    }
  };

  const outDir = (selectedImages._researchDir) || path.join(PROJECT_ROOT, 'output', sku);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const templatePath = path.join(outDir, '_analysis_template.json');
  fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
  console.log(`[AutoResearch] Analysis template saved: ${templatePath}`);
  console.log(`[AutoResearch] → Fill template manually, or let Claude Code analyze images in conversation`);

  return templatePath;
}

// ═══════════════════════════════════════
//  PHASE C: Enrich (reuse research-agent)
// ═══════════════════════════════════════

/**
 * Main auto-research function.
 * 1. Keyword parse → fill basic fields
 * 2. Select representative images → output for Claude Vision
 * 3. Check/load existing _analysis.json
 * 4. Enrich brief
 * Returns { briefPath, analysisPath, selectedImages, needsVision }
 */
function autoResearch(briefPath, scanResult) {
  const absBrief = path.resolve(briefPath);
  if (!fs.existsSync(absBrief)) throw new Error(`Brief not found: ${absBrief}`);

  let brief = JSON.parse(fs.readFileSync(absBrief, 'utf8'));

  console.log('\n--- Auto-Research ---');

  // Phase A: Keyword parse
  brief = applyKeywordParse(brief);

  // Save keyword-parsed brief
  fs.writeFileSync(absBrief, JSON.stringify(brief, null, 2));

  // Phase B: Select representative images
  const selectedImages = selectRepresentativeImages(scanResult);

  // Check for existing analysis — try research dir first, then legacy output dir
  const skuDir = path.dirname(absBrief);
  const researchDir = path.join(skuDir, 'research');
  const legacyAnalysis = path.join(PROJECT_ROOT, 'output', brief.sku, '_analysis.json');
  const newAnalysis = path.join(researchDir, '_analysis.json');
  const analysisPath = fs.existsSync(newAnalysis) ? newAnalysis : legacyAnalysis;
  const hasAnalysis = fs.existsSync(analysisPath);

  if (hasAnalysis) {
    console.log(`[AutoResearch] Found cached analysis: ${analysisPath}`);
  } else {
    console.log(`[AutoResearch] No _analysis.json found — Claude Vision analysis needed`);
    createAnalysisTemplate(brief.sku, selectedImages);
  }

  // Phase C: Enrich brief (reuse research-agent)
  try {
    const { enrichBrief } = require('./research-agent');
    brief = enrichBrief(absBrief, hasAnalysis ? analysisPath : null);
    console.log('[AutoResearch] Brief enriched');
  } catch (err) {
    console.warn(`[AutoResearch] Enrichment failed: ${err.message}`);
    // Save at least the keyword-parsed version
    fs.writeFileSync(absBrief, JSON.stringify(brief, null, 2));
  }

  return {
    briefPath: absBrief,
    analysisPath: hasAnalysis ? analysisPath : null,
    selectedImages,
    needsVision: !hasAnalysis
  };
}

// ═══════════════════════════════════════
//  PHASE D: Web Research Queries
// ═══════════════════════════════════════

/**
 * Generate search queries for web research based on brief data.
 * These queries are designed for Claude Code MCP tools (firecrawl/exa).
 * Returns { queries: [], outputPath } — Claude Code runs the searches,
 * saves results to _web_research.json, then pipeline continues.
 */
function generateWebResearchQueries(brief, projectRoot = PROJECT_ROOT, researchDir = null) {
  const name = brief.product_name || '';
  const category = brief.category || 'handmade gift';
  const occasion = (brief.occasion || '').replace(/_/g, ' ');
  const materials = (brief.materials || []).join(' ');

  const queries = [];

  // 1. Direct competitor search on Amazon
  queries.push({
    id: 'competitor_listings',
    purpose: 'Find top competitor listings for pricing and features',
    query: `${name} Amazon best seller`,
    alt_query: `${category} ${occasion} gift Amazon top rated`,
    extract: ['price', 'rating', 'review_count', 'bullet_points', 'title']
  });

  // 2. Trending keywords for SEO
  queries.push({
    id: 'trending_keywords',
    purpose: 'Find trending search terms buyers use',
    query: `${category} ${occasion} gift trending keywords 2026`,
    alt_query: `Amazon ${category} search terms popular`,
    extract: ['keywords', 'search_volume_hint', 'related_terms']
  });

  // 3. Product photography inspiration
  queries.push({
    id: 'photography_trends',
    purpose: 'Find current listing photo trends for this category',
    query: `Amazon ${category} listing photography best practices`,
    alt_query: `${category} product photography trends ecommerce`,
    extract: ['photo_styles', 'layout_trends', 'color_trends']
  });

  // 4. Buyer persona and gifting context
  if (occasion) {
    queries.push({
      id: 'buyer_context',
      purpose: 'Understand buyer intent and gifting context',
      query: `${occasion} gift ideas ${materials || category} what buyers want`,
      alt_query: `best ${occasion} gifts handmade personalized`,
      extract: ['buyer_motivation', 'price_expectations', 'gift_preferences']
    });
  }

  // 5. Niche-specific insights
  if (brief.niche) {
    queries.push({
      id: 'niche_insights',
      purpose: 'Category-specific market intelligence',
      query: `${brief.niche.replace(/_/g, ' ')} market Amazon handmade`,
      alt_query: `${category} niche trends handcrafted gifts`,
      extract: ['market_size_hint', 'growth_trend', 'seasonal_peaks']
    });
  }

  // Save queries to research dir (new mode) or output/{sku}/ (legacy)
  const outDir = researchDir || path.join(projectRoot, 'output', brief.sku);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const queriesPath = path.join(outDir, '_web_research_queries.json');

  const payload = {
    generated_at: new Date().toISOString(),
    sku: brief.sku,
    product_name: name,
    total_queries: queries.length,
    queries,
    instructions: [
      'Claude Code: run each query using firecrawl_search or web_search_exa MCP tools.',
      'For the most relevant results, use firecrawl_scrape or crawling_exa to read full content.',
      'Save all results into _web_research.json in the same folder.',
      'Format: { results: { [query.id]: { source_urls: [], findings: {} } } }'
    ]
  };

  fs.writeFileSync(queriesPath, JSON.stringify(payload, null, 2));
  console.log(`[AutoResearch] Web research queries saved: ${queriesPath}`);
  console.log(`[AutoResearch] ${queries.length} queries ready for Claude Code MCP tools`);

  return { queries, queriesPath, outputPath: path.join(outDir, '_web_research.json') };
}

/**
 * Merge web research results into brief (non-destructive).
 * Reads _web_research.json and fills fields that are still empty.
 */
function mergeWebResearch(briefPath, webResearchPath) {
  if (!fs.existsSync(webResearchPath)) {
    console.log('[AutoResearch] No _web_research.json found — skipping web merge');
    return null;
  }

  const absBrief = path.resolve(briefPath);
  const brief = JSON.parse(fs.readFileSync(absBrief, 'utf8'));
  const research = JSON.parse(fs.readFileSync(webResearchPath, 'utf8'));
  const results = research.results || {};

  let merged = 0;

  // Competitor data → pricing context + features
  const compData = results.competitor_listings;
  if (compData) {
    if (!brief.market_context) {
      brief.market_context = {
        competitor_prices: compData.findings?.prices || [],
        avg_rating: compData.findings?.avg_rating || null,
        top_competitor_features: compData.findings?.common_features || [],
        source_urls: (compData.source_urls || []).slice(0, 5)
      };
      console.log('[AutoResearch] Merged: market_context from competitor research');
      merged++;
    }

    // Fill features from competitor data if still empty
    if ((!brief.features || brief.features.length === 0) && compData.findings?.common_features?.length >= 3) {
      brief.features = compData.findings.common_features.slice(0, 5);
      console.log('[AutoResearch] Merged: features from competitor research');
      merged++;
    }
  }

  // Trending keywords → SEO hints
  const kwData = results.trending_keywords;
  if (kwData && !brief.seo_keywords) {
    brief.seo_keywords = {
      primary: kwData.findings?.keywords || [],
      related: kwData.findings?.related_terms || [],
      source_urls: (kwData.source_urls || []).slice(0, 3)
    };
    console.log('[AutoResearch] Merged: seo_keywords from trending research');
    merged++;
  }

  // Photography trends → visual hints for design director
  const photoData = results.photography_trends;
  if (photoData && !brief.photography_hints) {
    brief.photography_hints = {
      styles: photoData.findings?.photo_styles || [],
      layout_trends: photoData.findings?.layout_trends || [],
      color_trends: photoData.findings?.color_trends || [],
      source_urls: (photoData.source_urls || []).slice(0, 3)
    };
    console.log('[AutoResearch] Merged: photography_hints from trend research');
    merged++;
  }

  // Buyer context → target audience + USP refinement
  const buyerData = results.buyer_context;
  if (buyerData) {
    if (!brief.buyer_insights) {
      brief.buyer_insights = {
        motivation: buyerData.findings?.buyer_motivation || '',
        price_expectations: buyerData.findings?.price_expectations || '',
        preferences: buyerData.findings?.gift_preferences || [],
        source_urls: (buyerData.source_urls || []).slice(0, 3)
      };
      console.log('[AutoResearch] Merged: buyer_insights from context research');
      merged++;
    }

    // Refine USP if still generic
    if (brief.usp && brief.usp.includes("won't find anywhere else") && buyerData.findings?.buyer_motivation) {
      brief.usp = buyerData.findings.buyer_motivation;
      console.log('[AutoResearch] Merged: USP refined from buyer motivation');
      merged++;
    }
  }

  // Niche insights
  const nicheData = results.niche_insights;
  if (nicheData && !brief.niche_insights) {
    brief.niche_insights = {
      market_hint: nicheData.findings?.market_size_hint || '',
      trend: nicheData.findings?.growth_trend || '',
      seasonal_peaks: nicheData.findings?.seasonal_peaks || [],
      source_urls: (nicheData.source_urls || []).slice(0, 3)
    };
    console.log('[AutoResearch] Merged: niche_insights from market research');
    merged++;
  }

  // Mark web research as merged
  brief.web_research_required = true;
  brief.web_research_merged = true;
  brief.web_research_merged_at = new Date().toISOString();
  brief.web_research_fields_added = merged;
  brief.web_research_source_path = path.resolve(webResearchPath);

  fs.writeFileSync(absBrief, JSON.stringify(brief, null, 2));
  console.log(`[AutoResearch] Web research merged: ${merged} fields added to brief`);

  return brief;
}

module.exports = {
  autoResearch, keywordParse, applyKeywordParse, selectRepresentativeImages,
  createAnalysis, createAnalysisTemplate, generateWebResearchQueries, mergeWebResearch
};
