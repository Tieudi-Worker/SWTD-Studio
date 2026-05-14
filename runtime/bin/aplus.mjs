#!/usr/bin/env node
// runtime/bin/aplus.mjs — 5-module A+ Premium pipeline entry
// Usage: node bin/aplus.mjs <sku-folder> [--skip-slots aplus_m3]
import { runOnly } from '../lib/legacy-bridge.mjs';

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('Usage: aplus.mjs <sku-folder> [--skip-slots aplus_m1,...]');
  process.exit(1);
}

try {
  await runOnly('aplus', argv);
} catch (err) {
  console.error(`[hma-aplus] ${err.message}`);
  process.exit(1);
}
