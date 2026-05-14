#!/usr/bin/env node
/**
 * Batch Multi-SKU Runner
 *
 * Runs the pipeline sequentially for multiple briefs.
 * Reports success/failure summary at the end.
 *
 * Usage:
 *   node run-batch.js briefs/SKU1.json briefs/SKU2.json briefs/SKU3.json [--only listing]
 *   node run-batch.js briefs/*.json --only listing --research
 *   node run-batch.js --dir briefs/ [--only listing] [--research] [--qc]
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('./utils/logger');
const paths = require('./utils/paths');

const log = createLogger('Batch');

async function runBatch() {
  const args = process.argv.slice(2);

  if (!args.length) {
    console.log('Usage: node run-batch.js <data-folder>            (new — scan SKU subdirs)');
    console.log('       node run-batch.js <brief1.json> [...]      (legacy — brief files)');
    console.log('       node run-batch.js --dir <briefs-folder>    (legacy — briefs dir)');
    console.log('\nOptions: --only listing|aplus|video, --research, --qc, --dry-run, --sequential');
    process.exit(1);
  }

  // Parse SKU targets and flags
  // Supports: (1) data/ folder with SKU subdirs, (2) brief .json files, (3) --dir briefs/
  let skuTargets = []; // each: { arg: <path passed to master.js>, label: <display name> }
  const flags = [];

  // Detect first non-flag arg
  const firstArg = args.find(a => !a.startsWith('--'));

  if (args.includes('--dir')) {
    // LEGACY: --dir <briefs-folder> → list .json files
    const dirIdx = args.indexOf('--dir') + 1;
    const dir = args[dirIdx];
    if (!dir || !fs.existsSync(dir)) {
      console.error(`[Batch] Directory not found: ${dir}`);
      process.exit(1);
    }
    skuTargets = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && !f.startsWith('_'))
      .sort()
      .map(f => ({ arg: path.join(dir, f), label: path.basename(f, '.json') }));
  } else if (firstArg && !firstArg.endsWith('.json') && fs.existsSync(firstArg) && fs.statSync(firstArg).isDirectory()) {
    // NEW MODE: data/ folder → each subfolder is a SKU
    const dataDir = path.resolve(firstArg);
    skuTargets = fs.readdirSync(dataDir)
      .filter(d => {
        const fullPath = path.join(dataDir, d);
        return fs.statSync(fullPath).isDirectory() && !d.startsWith('_') && !d.startsWith('.');
      })
      .sort()
      .map(d => ({ arg: path.join(dataDir, d), label: d }));
  }

  // Also collect any .json files passed directly (legacy)
  for (const arg of args) {
    if (arg.startsWith('--')) {
      flags.push(arg);
      continue;
    }
    if (arg.endsWith('.json') && fs.existsSync(arg)) {
      skuTargets.push({ arg, label: path.basename(arg, '.json') });
    }
  }

  // Collect flag values (for child process)
  const flagArgs = args.slice();

  if (skuTargets.length === 0) {
    console.error('[Batch] No valid SKU folders or brief files found.');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(`  BATCH RUNNER — ${skuTargets.length} SKUs`);
  console.log('='.repeat(60));
  skuTargets.forEach((t, i) => console.log(`  ${i + 1}. ${t.label}`));
  console.log();

  const results = [];
  const batchStart = Date.now();

  for (let i = 0; i < skuTargets.length; i++) {
    const target = skuTargets[i];
    const sku = target.label;
    const skuStart = Date.now();

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  [${i + 1}/${skuTargets.length}] Processing: ${sku}`);
    console.log('─'.repeat(60));

    try {
      // Fork a child process for each SKU to isolate memory
      const { execFileSync } = require('child_process');

      // Remove --dir and its value, and non-flag args from flags
      const cleanFlags = [];
      for (let j = 0; j < flagArgs.length; j++) {
        if (flagArgs[j] === '--dir') { j++; continue; }
        if (!flagArgs[j].startsWith('--') && (flagArgs[j].endsWith('.json') || fs.existsSync(flagArgs[j]))) continue;
        cleanFlags.push(flagArgs[j]);
      }

      execFileSync('node', ['agents/master.js', target.arg, ...cleanFlags], {
        cwd: __dirname,
        stdio: 'inherit',
        env: process.env,
        timeout: 40 * 60 * 1000 // 40 min per SKU
      });

      const elapsed = ((Date.now() - skuStart) / 1000 / 60).toFixed(1);
      results.push({ sku, success: true, elapsed });
      log.info({ sku, elapsedMin: parseFloat(elapsed) }, `SKU complete: ${sku}`);

    } catch (err) {
      const elapsed = ((Date.now() - skuStart) / 1000 / 60).toFixed(1);
      const reason = err.status ? `exit code ${err.status}` : err.message;
      results.push({ sku, success: false, elapsed, reason });
      log.error({ sku, err: reason }, `SKU failed: ${sku}`);
      console.error(`[Batch] ${sku} FAILED: ${reason}`);
    }
  }

  // Summary
  const totalElapsed = ((Date.now() - batchStart) / 1000 / 60).toFixed(1);
  const okCount = results.filter(r => r.success).length;
  const failCount = results.length - okCount;

  console.log(`\n${'='.repeat(60)}`);
  console.log('  BATCH COMPLETE');
  console.log(`  Total: ${results.length} SKUs | OK: ${okCount} | Failed: ${failCount} | Time: ${totalElapsed} min`);
  console.log('='.repeat(60));

  if (failCount > 0) {
    console.log('\n  Failed SKUs:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ✗ ${r.sku} (${r.elapsed} min): ${r.reason}`);
    });
  }

  results.filter(r => r.success).forEach(r => {
    console.log(`  ✓ ${r.sku} (${r.elapsed} min)`);
  });

  log.info({ ok: okCount, failed: failCount, totalMin: parseFloat(totalElapsed) }, 'Batch complete');

  // Write batch report — to data dir if using folder mode, else output/
  const firstTarget = skuTargets[0];
  const reportBase = (firstTarget && !firstTarget.arg.endsWith('.json'))
    ? path.dirname(firstTarget.arg) // data/ folder
    : path.join(__dirname, 'output');
  const reportPath = path.join(reportBase, '_batch-report.json');
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    completedAt: new Date().toISOString(),
    totalSKUs: results.length,
    ok: okCount,
    failed: failCount,
    totalMinutes: parseFloat(totalElapsed),
    results
  }, null, 2));
  console.log(`\n  Report: ${reportPath}`);

  process.exit(failCount > 0 ? 1 : 0);
}

runBatch().catch(err => {
  console.error(`[Batch] FATAL: ${err.message}`);
  process.exit(1);
});
