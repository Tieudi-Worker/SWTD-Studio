#!/usr/bin/env node
// runtime/bin/precheck.mjs — offline prompt validation (no API call)
// Usage: node bin/precheck.mjs <sku-folder> [-v]
import { runPrecheck } from '../lib/legacy-bridge.mjs';

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('Usage: precheck.mjs <sku-folder> [-v]');
  process.exit(1);
}

try {
  await runPrecheck(argv);
} catch (err) {
  console.error(`[hma-precheck] ${err.message}`);
  process.exit(1);
}
