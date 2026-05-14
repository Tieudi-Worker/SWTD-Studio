#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false); // Prevent Windows EBUSY/EPERM file locks from libvips caching
try { require('dotenv').config({ path: path.join(__dirname, '..', 'config', 'api-keys.env') }); } catch(e) {}

const { KieClient } = require('../utils/kie-client');
const DesignDirector = require('./design-director');
const DesignDirectorV2 = require('./design-director-v2');
const ImageGenerator = require('./image-generator');
const VideoProducer = require('./video-producer');
const DirectRefPipeline = require('./directref-pipeline');
const AplusPipeline = require('./aplus-pipeline');
const { createLogger } = require('../utils/logger');
const { validateBrief } = require('../utils/brief-validator');
const { cleanupTemp } = require('../utils/checkpoint');
const { loadBrief, loadTheme, loadSpecs, shortenPaths, selectBestOutputs, printSummary, scanInputFolder, generateBriefFromFolder } = require('../utils/pipeline-helpers');
const { ensureSummary, attachKnowledgeHints, warnIfEmpty } = require('../utils/knowledge-loader');
const { clearSlots } = require('../utils/checkpoint');
const paths = require('../utils/paths');

function persistBriefMetadata(briefPath, brief, patch = {}) {
  const next = { ...brief, ...patch };
  fs.writeFileSync(briefPath, JSON.stringify(next, null, 2));
  return next;
}

function ensureWebResearchReady({ briefPath, brief, ctx, projectRoot, log, enabled = true, commandHint = null }) {
  if (!enabled) {
    return { ready: true, paused: false, skipped: true, brief };
  }

  const { generateWebResearchQueries, mergeWebResearch } = require('./auto-research');
  // Support both new ctx and legacy projectRoot param
  const researchDir = ctx ? ctx.researchDir : path.join(projectRoot || paths.agentRoot, 'output', brief.sku);
  const webResearchPath = path.join(researchDir, '_web_research.json');
  const queriesPath = path.join(researchDir, '_web_research_queries.json');

  if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });

  if (fs.existsSync(webResearchPath)) {
    let mergedBrief = brief;

    if (!brief.web_research_merged) {
      log.info('Web research results found — merging into brief');
      const merged = mergeWebResearch(briefPath, webResearchPath);
      if (merged) {
        mergedBrief = merged;
        log.info({ fieldsAdded: merged.web_research_fields_added || 0 }, 'Web research merged');
      }
    }

    mergedBrief = persistBriefMetadata(briefPath, mergedBrief, {
      web_research_required: true,
      web_research_source_path: path.resolve(webResearchPath)
    });

    return {
      ready: true,
      paused: false,
      brief: mergedBrief,
      sourcePath: webResearchPath,
      queriesPath
    };
  }

  let queryPayload = null;
  if (!fs.existsSync(queriesPath)) {
    queryPayload = generateWebResearchQueries(brief, projectRoot);
  }

  const waitingBrief = persistBriefMetadata(briefPath, brief, {
    web_research_required: true,
    web_research_merged: false,
    web_research_merged_at: null,
    web_research_source_path: path.resolve(webResearchPath),
    web_research_queries_path: path.resolve(queryPayload?.queriesPath || queriesPath)
  });

  log.info({ queriesPath: queryPayload?.queriesPath || queriesPath }, 'Web research required before generation');
  log.info('═══════════════════════════════════════════════════════════');
  log.info('ACTION REQUIRED: Claude Code must now run web searches.');
  log.info('');
  log.info('Queries saved at:');
  log.info(`  ${queryPayload?.queriesPath || queriesPath}`);
  log.info('');
  log.info('Instructions for Claude Code:');
  log.info('  1. Read _web_research_queries.json');
  log.info('  2. Run each query using firecrawl_search or web_search_exa');
  log.info('  3. Save results to _web_research.json (same folder)');
  log.info('  4. Re-run this command — pipeline will auto-merge and continue');
  if (commandHint) {
    log.info('');
    log.info(`Re-run: ${commandHint}`);
  }
  log.info('═══════════════════════════════════════════════════════════');

  return {
    ready: false,
    paused: true,
    reason: 'web-research-pending',
    brief: waitingBrief,
    queriesPath: queryPayload?.queriesPath || queriesPath,
    outputPath: webResearchPath
  };
}

class MasterAgent {
  constructor(options = {}) {
    this.log = createLogger('Master');

    const kieKey = process.env.KIE_KEY;
    const openclawBackend = process.env.HMA_IMAGE_BACKEND === 'openclaw';
    if (!kieKey && !openclawBackend) {
      this.log.fatal('No KIE_KEY found. Set in config/api-keys.env — https://kie.ai/api-key, or use --image-backend openclaw to emit a generation plan instead.');
      process.exit(1);
    }
    this.kie = (kieKey && !openclawBackend) ? new KieClient(kieKey) : null;
    this.apiKey = process.env.FAL_KEY || null; // legacy fallback

    // Concurrency settings
    this.concurrency = options.concurrency || 10;
    this.sequential = options.sequential || false;
    if (this.kie) this.kie.setConcurrency(this.concurrency);

    // Credit budget — hard cap on KIE calls per run
    const { CreditBudget } = require('../utils/credit-budget');
    this.creditBudget = new CreditBudget({
      softCap: options.softCreditCap || 40,
      hardCap: options.maxCredits || 60,
      log: this.log
    });
    if (this.kie) this.kie.setBudget(this.creditBudget);

    this.director = new DesignDirector();
    this.imageGen = this.kie ? new ImageGenerator(this.kie) : null;
    this.videoProducer = this.kie ? new VideoProducer(this.kie) : null;
    this.projectRoot = paths.agentRoot; // backward compat — prefer this.ctx in new code

    // Windows long path workaround state
    this._tempDir = null;
  }

  async run(briefPath, options = {}) {
    const startTime = Date.now();
    const { only = null, dryRun = false, numOptions = 1, research = false, webResearch = true, qc = false, skipSlots = [], visionDirector = true, conceptBrainstorm = true, cohesionValidator = true } = options;

    // Create SKU context — resolves all per-SKU paths
    this.ctx = options.ctx || paths.createLegacyContext(briefPath, this.projectRoot);

    // Adaptive timeout — video phase needs more headroom than listing/aplus.
    // Default: 30 min for listing/aplus only, 50 min when video is in scope.
    // Override: options.timeoutMs (from --timeout-min CLI flag).
    const includesVideo = !only || only === 'video';
    const defaultTimeoutMin = includesVideo ? 50 : 30;
    const PIPELINE_TIMEOUT_MS = options.timeoutMs || (defaultTimeoutMin * 60 * 1000);
    const timeoutTimer = !dryRun ? setTimeout(() => {
      this.log.fatal({ timeoutMin: PIPELINE_TIMEOUT_MS / 60000 }, 'Pipeline timeout exceeded. Aborting.');
      cleanupTemp(this._tempDir);
      process.exit(1);
    }, PIPELINE_TIMEOUT_MS) : null;

    let brief = loadBrief(briefPath);

    // Validate brief schema
    const validation = validateBrief(brief);
    if (!validation.valid) {
      this.log.error({ errors: validation.errors }, 'Brief validation failed');
      if (timeoutTimer) clearTimeout(timeoutTimer);
      return { success: false, errors: validation.errors };
    }
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(w => this.log.warn(w));
    }

    // Bind SKU to logger for all subsequent log lines
    this.log = createLogger('Master', { sku: brief.sku });

    // Knowledge base: ensure summary exists and attach hints to brief.
    // Runs on EVERY pipeline invocation (not just --research) so knowledge flows
    // without requiring users to remember a separate command.
    try {
      ensureSummary(paths.agentRoot, this.log);
      attachKnowledgeHints(brief, paths.agentRoot, this.log);
      warnIfEmpty(paths.agentRoot, this.log);
    } catch (err) {
      this.log.debug({ err: err.message }, '[Knowledge] loader skipped');
    }

    // Research Agent: auto-enrich brief if requested
    if (research && !brief.enriched) {
      try {
        const { enrichBrief } = require('./research-agent');
        brief = enrichBrief(briefPath);
        this.log.info('Brief enriched by Research Agent');
      } catch (err) {
        this.log.warn({ err: err.message }, 'Research enrichment failed, continuing with original brief');
        brief = loadBrief(briefPath);
      }
    } else if (!brief.enriched && brief.reference_folder) {
      this.log.info('TIP: Brief not enriched. Run with --research to auto-fill fields.');
    }

    // Web Research gate: always on by default for normal runs.
    try {
      const webGate = ensureWebResearchReady({
        briefPath,
        brief,
        ctx: this.ctx,
        log: this.log,
        enabled: webResearch,
        commandHint: `node agents/master.js "${briefPath}"${only ? ` --only ${only}` : ''}${dryRun ? ' --dry-run' : ''}${research ? ' --research' : ''}${qc ? ' --qc' : ''}${skipSlots.length ? ` --skip-slots ${skipSlots.join(',')}` : ''}`
      });
      if (webGate.brief) brief = webGate.brief;
      if (webGate.paused) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        return { success: true, paused: true, reason: webGate.reason, queriesPath: webGate.queriesPath };
      }
    } catch (err) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      return { success: false, errors: [err.message] };
    }

    const theme = loadTheme(brief.seasonal_theme || brief.occasion, paths.agentRoot, this.log);
    const specs = loadSpecs(paths.agentRoot);

    const mode = dryRun ? 'DRY RUN' : 'PRODUCTION';
    const parallel = this.sequential ? 'SEQUENTIAL' : `PARALLEL (×${this.concurrency})`;
    this.log.info({ product: brief.product_name, mode, parallel, only: only || 'all' }, `Pipeline start: ${brief.sku}`);

    const allResults = [];
    for (let opt = 1; opt <= numOptions; opt++) {
      const suffix = numOptions > 1 ? `/Option ${opt}` : '';
      const outputDir = this.ctx.outputDir;
      const listingDir = suffix ? path.join(outputDir, `listing${suffix}`) : this.ctx.listingDir;
      const aplusDir = suffix ? path.join(outputDir, `aplus${suffix}`) : this.ctx.aplusDir;
      const videoDir = suffix ? path.join(outputDir, `video${suffix}`) : this.ctx.videoDir;
      for (const dir of [outputDir, listingDir, aplusDir, videoDir]) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      }

      // Setup persistent upload cache (in research dir for new mode, output dir for legacy)
      if (this.kie) this.kie.setCacheDir(this.ctx.researchDir || outputDir);

      // --skip-slots: clear checkpoint entries for given slots so they regen
      // instead of resuming from cache. Safer than editing _progress.json by hand.
      if (skipSlots.length > 0) {
        const listingKeys = skipSlots.filter(s => /^slot[1-8]$/i.test(s)).map(s => s.toLowerCase());
        const aplusKeys = skipSlots.filter(s => /^aplus_m[1-5]$/i.test(s)).map(s => s.toLowerCase());
        if (listingKeys.length) clearSlots(listingDir, listingKeys, this.log);
        if (aplusKeys.length) clearSlots(aplusDir, aplusKeys, this.log);
      }

      if (opt === 1 || numOptions === 1) {
        this.log.info('Phase 1: Design Director (v2 Vision-aware)');
        const directorV2 = new DesignDirectorV2();
        const ddResult = directorV2.generateDesignDNA(brief, theme, this.ctx, { visionDirector });

        if (ddResult.paused) {
          this.log.info({ requestPath: ddResult.requestPath }, 'Pipeline paused for Vision Director');
          if (timeoutTimer) clearTimeout(timeoutTimer);
          return { success: true, paused: true, reason: ddResult.reason, requestPath: ddResult.requestPath };
        }

        this.designDNA = ddResult.dna;
        const dnaDir = (!this.ctx.isLegacy && this.ctx.researchDir) ? this.ctx.researchDir : outputDir;
        directorV2.saveDNA(this.designDNA, dnaDir);

        // Phase 1.5: Concept Brainstorm (Seduction Gate)
        const ConceptDirector = require('./concept-director');
        const conceptDir = new ConceptDirector();
        const conceptResult = conceptDir.ensureConcepts(brief, this.designDNA, this.ctx, { conceptBrainstorm });

        if (conceptResult.paused) {
          this.log.info({ requestPath: conceptResult.requestPath }, 'Pipeline paused for Concept Brainstorm');
          if (timeoutTimer) clearTimeout(timeoutTimer);
          return { success: true, paused: true, reason: conceptResult.reason, requestPath: conceptResult.requestPath };
        }
        brief = conceptResult.brief;
        this.log.info({ reason: conceptResult.reason }, 'Concept brainstorm phase complete');
      }

      if (this.imageGen) this.imageGen.setDesignDNA(this.designDNA);

      if (dryRun) {
        this.log.info({ creativeZones: !!this.designDNA.creativeZones, themeAnchors: !!this.designDNA.themeAnchors }, 'DRY RUN complete');
        if (this.kie) { try { await this.kie.checkCredit(); } catch(e) { this.log.warn({ err: e.message }, 'Credit check failed'); } }
        return { success: true, dryRun: true, designDNA: this.designDNA };
      }

      // Resolve input images once — relative to skuDir (new mode) or agentRoot (legacy)
      const imageBase = this.ctx.isLegacy ? paths.agentRoot : this.ctx.skuDir;
      let inputImages = (brief.input_images || [])
        .map(p => path.resolve(imageBase, p))
        .filter(p => fs.existsSync(p));

      // ═══ OpenClaw Backend: emit generation plan and exit (no KIE call) ═══
      if (process.env.HMA_IMAGE_BACKEND === 'openclaw') {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        return this._emitOpenclawPlan(brief, only, listingDir, aplusDir, inputImages);
      }

      // Windows long path fix
      const sp = shortenPaths(inputImages, brief, imageBase, this.log);
      inputImages = sp.shortened;
      if (sp.tempDir) this._tempDir = sp.tempDir;

      // Pre-upload all refs to KIE cache (shared by all pipelines)
      if (this.kie && inputImages.length > 0 && !this.sequential) {
        this.log.info('Pre-uploading reference images');
        await this.kie.preUpload(inputImages, 'product-refs', { maxSize: 768, quality: 85, format: 'jpeg' });
      }

      const results = { listing: null, aplus: null, video: null };

      // ═══ OUTPUT CHAIN: Listing → A+ → Video ═══

      // Phase 2: Listing (8 slots)
      if (!only || only === 'listing') {
        const listingPipeline = new DirectRefPipeline({
          kie: this.kie, imageGen: this.imageGen, log: this.log,
          projectRoot: this.projectRoot, sequential: this.sequential
        });
        results.listing = await listingPipeline.run(brief, this.designDNA, theme, specs, listingDir, inputImages);
      }

      // Phase 2.5: Cohesion Validation (pause/resume)
      if (results.listing && (!only || only === 'listing')) {
        const CohesionValidator = require('./cohesion-validator');
        const validator = new CohesionValidator();
        const cohesionResult = validator.validate(brief, results.listing, this.ctx, { cohesionValidator });

        if (cohesionResult.paused) {
          this.log.info({ requestPath: cohesionResult.requestPath }, 'Pipeline paused for Cohesion Validation');
          if (timeoutTimer) clearTimeout(timeoutTimer);
          return { success: true, paused: true, reason: cohesionResult.reason, requestPath: cohesionResult.requestPath };
        }
      }

      // Select best listing outputs as refs for A+ and Video
      const listingRefs = selectBestOutputs(results.listing, 3);
      if (listingRefs.length > 0) {
        this.log.info(`Chain: ${listingRefs.length} listing outputs → A+ & Video refs`);
      } else if (results.listing) {
        const failedSlots = results.listing.filter(r => !r.success).map(r => `Slot ${r.slot}`).join(', ');
        this.log.warn(`0 listing refs for A+/Video. Failed: ${failedSlots || 'none generated'}. Using input images only.`);
      }

      // Phase 3: A+ (5 modules)
      if (!only || only === 'aplus') {
        const aplusPipeline = new AplusPipeline({
          kie: this.kie, imageGen: this.imageGen,
          log: this.log, projectRoot: this.projectRoot, sequential: this.sequential
        });
        results.aplus = await aplusPipeline.run(brief, this.designDNA, theme, specs, aplusDir, inputImages, listingRefs, this.ctx);
      }

      // Select A+ hero for video
      const aplusHeroPath = results.aplus?.find(r => r.module === 1 && r.success)?.path || null;
      if (aplusHeroPath) this.log.info('Chain: A+ hero → Video ref');

      // Phase 4: Video
      if (!only || only === 'video') {
        const allVideoRefs = [...inputImages, ...listingRefs, ...(aplusHeroPath ? [aplusHeroPath] : [])];
        results.video = await this._runVideo(brief, this.designDNA, theme, videoDir, allVideoRefs);
      }

      allResults.push(results);
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      printSummary(brief, results, elapsed, listingDir, this.log);
    }

    // Phase 5: QC scan (optional)
    if (qc) {
      try {
        const { scanOutput } = require('./xp-agent');
        const scan = scanOutput(brief.sku);
        this.log.info({ listing: scan.listing.length, aplus: scan.aplus.length }, 'QC scan ready. Run: node agents/xp-agent.js qc --sku ' + brief.sku);
      } catch (err) {
        this.log.warn({ err: err.message }, 'QC scan failed');
      }
    }

    if (this.creditBudget) {
      const s = this.creditBudget.summary();
      this.log.info({ credits: s }, `Credit usage: ${s.total}/${s.hardCap}`);
    }

    cleanupTemp(this._tempDir);
    if (timeoutTimer) clearTimeout(timeoutTimer);

    return { success: true, results: allResults, outputDir: this.ctx.outputDir };
  }

  // ═══════════════════════════════════════
  //  VIDEO (kept here — small, tightly coupled to master flow)
  // ═══════════════════════════════════════

  async _runVideo(brief, dna, theme, outDir, inputImages) {
    const mode = this.sequential ? 'SEQUENTIAL' : 'PARALLEL';
    this.log.info(`Phase 4: Video TVC — ${mode}`);
    try {
      const result = this.videoProducer.generateStoryboard(brief, dna, theme);
      const sbPath = path.join(outDir, `${brief.sku}_video_storyboard.json`);
      fs.writeFileSync(sbPath, JSON.stringify(result.storyboard, null, 2));
      this.videoProducer.save(result.storyboard, path.dirname(outDir));

      let sceneImages = {};
      const videoStyle = brief.video_style || 'lifestyle';
      if (['lifestyle', 'tvc'].includes(videoStyle)) {
        this.log.info(`Video [${videoStyle}]: Reference Image is Truth. Bypassing AI start frame generation.`);
        for (let i = 1; i <= result.storyboard.scenes.length; i++) {
          sceneImages[i] = inputImages[0]; 
        }
      } else {
        sceneImages = await this.videoProducer.generateSceneImages(
          result.storyboard, outDir, inputImages, { parallel: !this.sequential }
        );
      }
      const videoResults = await this.videoProducer.generateVideos(result.storyboard, outDir, sceneImages, inputImages);
      const okCount = videoResults.filter(r => r.success).length;
      this.log.info(`Video: ${okCount}/${result.storyboard.scenes.length} scenes OK`);
      return { success: true, storyboardPath: sbPath, videoResults };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }
}

// ═══════════════════════════════════════
//  CLI ENTRY POINT
// ═══════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log('Usage: node agents/master.js <sku-folder>   [options]');
    console.log('       node agents/master.js <brief.json>   [options]  (legacy)');
    console.log('       node agents/master.js --from-folder <input-folder> [options]  (legacy)');
    console.log('\nOptions: --only listing|aplus|video, --options N, --concurrency N,');
    console.log('         --sequential, --dry-run, --research, --no-web-research,');
    console.log('         --no-vision-director, --no-concept-brainstorm, --no-cohesion-validator,');
    console.log('         --qc, --skip-slots slot2,slot4,');
    console.log('         --max-credits N (default 60), --soft-credit-cap N (default 40),');
    console.log('         --timeout-min N (default 30 listing/aplus, 50 if video included),');
    console.log('         --image-backend kie|openclaw (default: kie)');
    process.exit(1);
  }
  const agent = new MasterAgent({
    concurrency: args.includes('--concurrency') ? parseInt(args[args.indexOf('--concurrency')+1]) || 10 : 10,
    sequential: args.includes('--sequential'),
    maxCredits: args.includes('--max-credits') ? parseInt(args[args.indexOf('--max-credits')+1]) || 60 : 60,
    softCreditCap: args.includes('--soft-credit-cap') ? parseInt(args[args.indexOf('--soft-credit-cap')+1]) || 40 : 40
  });

  // Graceful shutdown — cleanup temp files on interrupt/terminate
  const shutdown = (signal) => {
    console.log(`\n[Master] ${signal} received — cleaning up...`);
    cleanupTemp(agent._tempDir);
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // ═══ Determine briefPath + ctx from CLI arg ═══
  let briefPath;
  let ctx;
  const firstArg = args.find(a => !a.startsWith('--'));

  if (args.includes('--from-folder')) {
    // LEGACY: --from-folder <input-folder>
    const folderIdx = args.indexOf('--from-folder') + 1;
    if (folderIdx >= args.length || args[folderIdx].startsWith('--')) {
      console.error('[FATAL] --from-folder requires a folder path');
      process.exit(1);
    }
    const scanResult = scanInputFolder(args[folderIdx], agent.projectRoot, agent.log);
    briefPath = generateBriefFromFolder(args[folderIdx], scanResult, agent.projectRoot, agent.log);

    try {
      const { autoResearch } = require('./auto-research');
      autoResearch(briefPath, scanResult);
    } catch (err) {
      agent.log.warn({ err: err.message }, 'Auto-research failed');
    }
  } else if (firstArg && firstArg.endsWith('.json')) {
    // LEGACY: direct brief.json path
    briefPath = firstArg;
  } else if (firstArg) {
    // NEW MODE: SKU folder path (data/{SKU}/)
    ctx = paths.createSkuContext(firstArg);

    // Ensure directories exist
    for (const dir of [ctx.outputDir, ctx.listingDir, ctx.aplusDir, ctx.videoDir, ctx.researchDir]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    // Auto-generate brief if it doesn't exist yet
    if (!fs.existsSync(ctx.briefPath)) {
      agent.log.info(`No brief.json found — scanning ${ctx.inputDir} to generate`);
      const scanResult = scanInputFolder(ctx.inputDir, agent.projectRoot, agent.log);
      // Write brief to SKU folder root (not briefs/)
      const brief = {
        sku: ctx.sku,
        product_name: ctx.sku,
        category: 'mixed', materials: [], dimensions: '',
        features: [], usp: '', niche: '', occasion: 'general_gift', seasonal_theme: '',
        target_audience: { buyer: '', recipient: '' }, price_range: '', competitor_asins: [],
        input_images: scanResult.productImages.map(p => path.relative(ctx.skuDir, p).replace(/\\/g, '/')),
        listing_templates: scanResult.listingRefImages.map(p => path.relative(ctx.skuDir, p).replace(/\\/g, '/')),
        aplus_templates: scanResult.aplusRefImages.map(p => path.relative(ctx.skuDir, p).replace(/\\/g, '/')),
        video_templates: (scanResult.videoRefImages || []).map(p => path.relative(ctx.skuDir, p).replace(/\\/g, '/')),
        color_preference: '', copy_style: 'emotional',
        video_style: 'lifestyle'
      };

      try {
        const { applyKeywordParse } = require('./auto-research');
        applyKeywordParse(brief);
      } catch (err) {
        agent.log.warn({ err: err.message }, 'Keyword parse failed');
      }

      fs.writeFileSync(ctx.briefPath, JSON.stringify(brief, null, 2), 'utf8');
      agent.log.info({ sku: ctx.sku }, `Generated brief: ${ctx.briefPath}`);

      try {
        const { autoResearch } = require('./auto-research');
        autoResearch(ctx.briefPath, scanResult);
      } catch (err) {
        agent.log.warn({ err: err.message }, 'Auto-research failed');
      }
    }

    briefPath = ctx.briefPath;
  } else {
    console.error('[FATAL] No brief or SKU folder specified');
    process.exit(1);
  }

  try {
    const skipSlotsArg = args.includes('--skip-slots') ? (args[args.indexOf('--skip-slots')+1] || '') : '';
    const skipSlots = skipSlotsArg.split(',').map(s => s.trim()).filter(Boolean);

    const r = await agent.run(briefPath, {
      ctx, // pass SKU context if available (new mode)
      only: args.includes('--only') ? args[args.indexOf('--only')+1] : null,
      dryRun: args.includes('--dry-run'),
      numOptions: args.includes('--options') ? parseInt(args[args.indexOf('--options')+1]) || 1 : 1,
      research: args.includes('--research') && !args.includes('--no-research'),
      webResearch: !args.includes('--no-web-research'),
      visionDirector: !args.includes('--no-vision-director'),
      conceptBrainstorm: !args.includes('--no-concept-brainstorm'),
      cohesionValidator: !args.includes('--no-cohesion-validator'),
      qc: args.includes('--qc'),
      skipSlots,
      timeoutMs: args.includes('--timeout-min')
        ? parseInt(args[args.indexOf('--timeout-min')+1]) * 60 * 1000
        : undefined
    });
    process.exit(r.paused ? 2 : (r.success ? 0 : 1));
  } catch (err) { console.error(`[FATAL] ${err.message}`); process.exit(1); }
}

// ══════════════════════════════════════
//  OpenClaw backend: emit generation plan (no KIE call)
//  Used when HMA_IMAGE_BACKEND=openclaw / --image-backend openclaw.
//  Output: data/<SKU>/output/<type>/_openclaw_plan.json with full prompt,
//  ref images, and target output paths for every slot/module. The OpenClaw
//  agent reads this plan and calls image_generate for each entry.
// ══════════════════════════════════════
MasterAgent.prototype._emitOpenclawPlan = function _emitOpenclawPlan(
  brief, only, listingDir, aplusDir, inputImages
) {
  const ImageGenerator = require('./image-generator');
  const planner = new ImageGenerator(null);
  if (this.designDNA) planner.setDesignDNA(this.designDNA);

  const plans = {};
  const dna = this.designDNA || {};
  const theme = {};

  if (!only || only === 'listing') {
    const slots = [1, 2, 3, 4, 5, 6, 7, 8];
    const names = { 1: 'main', 2: 'in-use', 3: 'features', 4: 'use-case', 5: 'size-scale', 6: 'gift-set', 7: 'emotional', 8: 'lifestyle-close' };
    const items = slots.map(n => {
      let prompt = '';
      try { prompt = planner.buildDirectRefPrompt(n, brief, dna, theme); } catch (e) { prompt = `[plan-error] ${e.message}`; }
      const role = (n === 8 ? brief.slot8_type : null) || names[n];
      return {
        kind: 'listing',
        slot: n,
        role,
        outputPath: path.join(listingDir, `${brief.sku}_slot${n}_${role}.jpg`),
        targetSize: { width: 2000, height: 2000 },
        aspectRatio: '1:1',
        prompt,
        referenceImages: inputImages.slice(0, 5),
      };
    });
    if (!fs.existsSync(listingDir)) fs.mkdirSync(listingDir, { recursive: true });
    const planPath = path.join(listingDir, '_openclaw_plan.json');
    fs.writeFileSync(planPath, JSON.stringify({ sku: brief.sku, kind: 'listing', items, createdAt: new Date().toISOString() }, null, 2));
    plans.listing = planPath;
    this.log.info({ planPath, items: items.length }, '[openclaw-backend] Listing plan written');
  }

  if (!only || only === 'aplus') {
    try {
      const { loadAplusFunnel, resolveRefCatalog, pickRefsByRecipe } = require('../utils/funnel-loader');
      const AplusPipeline = require('./aplus-pipeline');
      const aplusInst = new AplusPipeline({ kie: null, imageGen: planner, log: this.log, projectRoot: this.projectRoot, sequential: this.sequential });
      const funnel = loadAplusFunnel(brief, this.log);
      const skuDir = this.ctx?.skuDir || path.resolve(aplusDir, '..', '..');
      const refCatalog = resolveRefCatalog(brief, skuDir);
      const realProductRefs = (inputImages || []).filter(p => /[\\/]input[\\/]product[\\/]/.test(p));
      const otherInputs = (inputImages || []).filter(p => !realProductRefs.includes(p));
      const fallbackRefs = [...realProductRefs, ...otherInputs];
      const modules = funnel ? funnel.modules : aplusInst._legacyModules();
      const items = modules.map(m => {
        let prompt = '';
        try { prompt = aplusInst._promptForModule(m, brief, dna, theme, funnel); } catch (e) { prompt = `[plan-error] ${e.message}`; }
        const refs = pickRefsByRecipe(m.refRecipe, refCatalog, fallbackRefs, this.log);
        return {
          kind: 'aplus',
          module: m.n,
          name: m.name,
          role: m.role || `aplus_m${m.n}`,
          outputPath: path.join(aplusDir, `${brief.sku}_aplus_module${m.n}.jpg`),
          targetSize: { width: 1464, height: 600 },
          aspectRatio: '21:9',
          prompt,
          referenceImages: refs,
        };
      });
      if (!fs.existsSync(aplusDir)) fs.mkdirSync(aplusDir, { recursive: true });
      const planPath = path.join(aplusDir, '_openclaw_plan.json');
      fs.writeFileSync(planPath, JSON.stringify({ sku: brief.sku, kind: 'aplus', items, createdAt: new Date().toISOString() }, null, 2));
      plans.aplus = planPath;
      this.log.info({ planPath, items: items.length }, '[openclaw-backend] A+ plan written');
    } catch (err) {
      this.log.warn({ err: err.message }, '[openclaw-backend] A+ plan skipped');
    }
  }

  if (only === 'video' || (!only && process.env.HMA_IMAGE_BACKEND === 'openclaw')) {
    this.log.warn('[openclaw-backend] Video pipeline is KIE-only in Option A; skipped.');
  }

  return { success: true, openclawBackend: true, plans };
};

if (require.main === module) {
  main();
}

module.exports = { MasterAgent, ensureWebResearchReady, main };
