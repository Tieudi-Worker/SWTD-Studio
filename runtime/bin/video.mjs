#!/usr/bin/env node
// runtime/bin/video.mjs — Kling 3.0 video pipeline entry
// Usage: node bin/video.mjs <sku-folder>
import { runOnly } from '../lib/legacy-bridge.mjs';

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('Usage: video.mjs <sku-folder>');
  process.exit(1);
}

try {
  await runOnly('video', argv);
} catch (err) {
  console.error(`[hma-video] ${err.message}`);
  process.exit(1);
}
