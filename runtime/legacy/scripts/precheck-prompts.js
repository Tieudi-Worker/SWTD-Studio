#!/usr/bin/env node
/**
 * Offline prompt precheck for direct-ref listing slots (1..8).
 *
 * Builds every slot prompt locally via ImageGenerator.buildDirectRefPrompt,
 * runs it through promptGuard.sanitize, and reports violations — all without
 * a single KIE API call. Use before running the real pipeline to avoid
 * wasting credits on prompts that will trigger HARD limits or forbidden
 * phrases.
 *
 * Usage:
 *   node scripts/precheck-prompts.js briefs/<sku>.json
 *   node scripts/precheck-prompts.js briefs/<sku>.json --verbose
 *
 * Exit codes:
 *   0 — no HARD violations and no forbidden-phrase hits (safe to run pipeline)
 *   1 — HARD limit exceeded or forbidden phrases found (fix brief first)
 *   2 — brief file missing or invalid
 */
const fs = require('fs');
const path = require('path');

const ImageGenerator = require('../agents/image-generator');
const promptGuard = require('../utils/prompt-guard');

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];
const SLOT_LABELS = {
  1: 'hero_white',
  2: 'lifestyle_wide',
  3: 'infographic_features',
  4: 'use_case_demo',
  5: 'size_infographic',
  6: 'flat_lay_gift_set',
  7: 'emotional_group',
  8: 'lifestyle_closeup',
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const rawPath = args.find(a => !a.startsWith('--'));
  // Support both: brief.json path (legacy) and SKU folder path (new)
  let briefPath = rawPath;
  if (rawPath && !rawPath.endsWith('.json') && fs.existsSync(rawPath)) {
    // New mode: SKU folder → look for brief.json inside
    const candidate = path.join(rawPath, 'brief.json');
    if (fs.existsSync(candidate)) {
      briefPath = candidate;
    }
  }
  return {
    briefPath,
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

function loadBrief(briefPath) {
  if (!briefPath) {
    console.error('Usage: node scripts/precheck-prompts.js <brief.json|sku-folder> [--verbose]');
    process.exit(2);
  }
  const abs = path.isAbsolute(briefPath) ? briefPath : path.resolve(briefPath);
  if (!fs.existsSync(abs)) {
    console.error(`Brief not found: ${abs}`);
    process.exit(2);
  }
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    console.error(`Invalid JSON in brief: ${err.message}`);
    process.exit(2);
  }
}

function buildEmptyContext() {
  // buildDirectRefPrompt needs dna + theme, but _resolveVars only reads
  // optional fields with safe fallbacks, so empty stubs are fine.
  return {
    dna: { styleGuide: {}, productLock: {} },
    theme: {},
  };
}

function classify(violations) {
  let hardFail = false;
  let forbidden = false;
  let softOnly = false;
  for (const v of violations) {
    if (v.startsWith('HARD limit')) hardFail = true;
    else if (v.startsWith('forbidden phrase')) forbidden = true;
    else if (v.startsWith('soft limit')) softOnly = true;
  }
  return { hardFail, forbidden, softOnly };
}

function statusTag({ hardFail, forbidden, softOnly }) {
  if (hardFail || forbidden) return 'FAIL  ';
  if (softOnly) return 'WARN  ';
  return 'OK    ';
}

function installSanitizeCapture() {
  // Monkey-patch promptGuard.sanitize so every call — including the one
  // inside ImageGenerator._finalizePrompt — is captured with a silent logger.
  // Without this, the inner sanitize strips forbidden phrases BEFORE we see
  // them, and the verbose auto-warning clutters the output.
  const captured = {};
  const orig = promptGuard.sanitize;
  const silent = { warn: () => {}, error: () => {}, info: () => {}, debug: () => {} };
  promptGuard.sanitize = function patched(prompt, slotNumber, opts = {}) {
    const result = orig.call(this, prompt, slotNumber, { ...opts, log: silent });
    captured[slotNumber] = result;
    return result;
  };
  return {
    captured,
    restore() { promptGuard.sanitize = orig; },
  };
}

function main() {
  const { briefPath, verbose } = parseArgs(process.argv);
  const brief = loadBrief(briefPath);
  const { dna, theme } = buildEmptyContext();

  const gen = new ImageGenerator(null);
  // setDesignDNA is intentionally skipped — we only need prompt length analysis.

  const hook = installSanitizeCapture();
  const rows = [];
  let hardCount = 0;
  let forbiddenCount = 0;
  let softCount = 0;

  for (const slot of SLOTS) {
    try {
      gen.buildDirectRefPrompt(slot, brief, dna, theme);
    } catch (err) {
      rows.push({
        slot,
        label: SLOT_LABELS[slot],
        status: 'ERROR ',
        words: 0,
        violations: [`build failed: ${err.message}`],
        prompt: '',
      });
      hardCount++;
      continue;
    }

    const result = hook.captured[slot] || { violations: [], words: 0, prompt: '' };
    const { violations, words, prompt: clean } = result;
    const cls = classify(violations);
    if (cls.hardFail) hardCount++;
    if (cls.forbidden) forbiddenCount++;
    if (cls.softOnly && !cls.hardFail && !cls.forbidden) softCount++;

    rows.push({
      slot,
      label: SLOT_LABELS[slot],
      status: statusTag(cls),
      words,
      violations,
      prompt: clean,
    });
  }

  hook.restore();

  const sku = brief.sku || path.basename(briefPath, '.json');
  console.log(`\nPrompt precheck — ${sku}`);
  console.log('─'.repeat(72));
  console.log('Slot  Role                    Status  Words  Violations');
  console.log('─'.repeat(72));
  for (const r of rows) {
    const role = r.label.padEnd(22);
    const words = String(r.words).padStart(5);
    const vCount = r.violations.length;
    console.log(`  ${r.slot}   ${role}  ${r.status}  ${words}  ${vCount}`);
    if (r.violations.length) {
      for (const v of r.violations) console.log(`        - ${v}`);
    }
    if (verbose && r.prompt) {
      console.log(`        prompt: ${r.prompt}`);
    }
  }
  console.log('─'.repeat(72));

  const total = hardCount + forbiddenCount + softCount;
  if (hardCount || forbiddenCount) {
    console.log(`FAIL — ${hardCount} hard-limit, ${forbiddenCount} forbidden-phrase, ${softCount} soft-only`);
    console.log('Fix the brief before running the pipeline to avoid wasting credits.');
    process.exit(1);
  }
  if (softCount) {
    console.log(`WARN — ${softCount} slot(s) with soft-limit warnings only. Safe to run.`);
  } else {
    console.log('OK — all slots within hard limits and no forbidden phrases.');
  }
  process.exit(0);
}

main();
