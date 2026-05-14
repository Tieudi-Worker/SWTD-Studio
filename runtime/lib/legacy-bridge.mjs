// runtime/lib/legacy-bridge.mjs
// v0.1 bridge: spawns legacy production Node scripts with proper env + cwd.
// Replace with native ESM ports in v0.2.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = resolve(__dirname, '..');
const OPENCLAW_HMA_ROOT = resolve(RUNTIME_ROOT, '..');

loadEnv({ path: resolve(RUNTIME_ROOT, '.env') });

function resolveLegacyRoot() {
  // v0.1.1 — legacy code is embedded at runtime/legacy/ (no external dep on production folder).
  // Override only if you intentionally want to point at a different copy.
  if (process.env.HMA_LEGACY_ROOT) {
    const p = resolve(process.env.HMA_LEGACY_ROOT);
    if (!existsSync(p)) {
      throw new Error(`HMA_LEGACY_ROOT override does not exist: ${p}`);
    }
    return p;
  }
  const embedded = resolve(RUNTIME_ROOT, 'legacy');
  if (!existsSync(embedded)) {
    throw new Error(
      `Embedded legacy code missing at ${embedded}. ` +
      `Run setup.ps1 / setup.sh, or re-extract the openclaw-hma bundle.`
    );
  }
  return embedded;
}

function resolveDataPath(arg) {
  if (!arg) return arg;
  if (isAbsolute(arg)) return arg;
  return resolve(process.cwd(), arg);
}

function imageBackend(argv = []) {
  const idx = argv.indexOf('--image-backend');
  return idx >= 0 ? argv[idx + 1] : (process.env.HMA_IMAGE_BACKEND || 'kie');
}

function assertKieKey(argv = []) {
  if (imageBackend(argv) === 'openclaw') return;
  if (!process.env.KIE_KEY || process.env.KIE_KEY === 'sk-replace-me' || process.env.KIE_KEY === '***') {
    console.error('[hma] KIE_KEY missing. Set it in runtime/.env, or pass --image-backend openclaw for plan-only image generation.');
    process.exit(2);
  }
}

export async function runLegacyScript(relPath, argv, options = {}) {
  assertKieKey(argv);
  const legacyRoot = resolveLegacyRoot();
  const scriptPath = resolve(legacyRoot, relPath);
  if (!existsSync(scriptPath)) {
    throw new Error(`Legacy script not found: ${scriptPath}`);
  }

  const resolvedArgv = argv.map((a, i) =>
    i === 0 && !a.startsWith('-') ? resolveDataPath(a) : a
  );

  const env = {
    ...process.env,
    KIE_KEY: process.env.KIE_KEY,
    HMA_IMAGE_BACKEND: imageBackend(argv),
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    ...(process.env.LOG_FILE ? { LOG_FILE: process.env.LOG_FILE } : {}),
    ...(options.extraEnv || {}),
  };

  return new Promise((resolve_, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...resolvedArgv], {
      cwd: legacyRoot,
      env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`Legacy script killed by signal: ${signal}`));
      // master.js uses code 2 to signal a paused pipeline (Vision / cohesion
      // request waiting for human review). Treat it as a non-error outcome so
      // callers can map it to a 'paused' UI state instead of generic failure.
      else if (code === 0 || code === 2) resolve_(code);
      else reject(new Error(`Legacy script exited with code ${code}`));
    });
  });
}

export async function runMaster(argv) {
  return runLegacyScript('agents/master.js', argv);
}

export async function runOnly(only, argv) {
  const passthrough = [...argv];
  const onlyIdx = passthrough.findIndex((a) => a === '--only');
  if (onlyIdx >= 0) {
    passthrough[onlyIdx + 1] = only;
  } else {
    passthrough.push('--only', only);
  }
  return runLegacyScript('agents/master.js', passthrough);
}

export async function runPrecheck(argv) {
  return runLegacyScript('scripts/precheck-prompts.js', argv);
}

export async function runResearchAgent(argv) {
  return runLegacyScript('agents/research-agent.js', argv);
}

export async function runXpAgent(argv) {
  return runLegacyScript('agents/xp-agent.js', argv);
}

export async function runKnowledgeAgent(argv) {
  return runLegacyScript('agents/knowledge-agent.js', argv);
}

export async function runAutoResearch(argv) {
  return runLegacyScript('agents/auto-research.js', argv);
}
