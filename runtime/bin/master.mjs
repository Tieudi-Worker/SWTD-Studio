#!/usr/bin/env node
// runtime/bin/master.mjs — full HMA pipeline entry
// Usage: node bin/master.mjs <sku-folder> [flags]
import { runMaster } from '../lib/legacy-bridge.mjs';

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('Usage: master.mjs <sku-folder> [--only listing|aplus|video] [--skip-slots ...] [--dry-run] [--qc] [--no-web-research]');
  process.exit(1);
}

try {
  await runMaster(argv);
} catch (err) {
  console.error(`[hma-master] ${err.message}`);
  process.exit(1);
}
