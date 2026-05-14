#!/usr/bin/env node
// runtime/bin/listing.mjs — 8-slot listing pipeline entry
// Usage: node bin/listing.mjs <sku-folder> [--skip-slots slot2,slot4]
import { runOnly } from '../lib/legacy-bridge.mjs';

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('Usage: listing.mjs <sku-folder> [--skip-slots ...]');
  process.exit(1);
}

try {
  await runOnly('listing', argv);
} catch (err) {
  console.error(`[hma-listing] ${err.message}`);
  process.exit(1);
}
