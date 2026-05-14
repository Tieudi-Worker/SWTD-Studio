#!/usr/bin/env node
// runtime/bin/single-skill.mjs — dispatcher for internal (model-only) HMA skills
// Usage: node bin/single-skill.mjs <skill> <sku-folder> [extra args]
//
// Skills supported:
//   research          → research-agent.js --full
//   research-scan     → research-agent.js --scan
//   research-enrich   → research-agent.js --enrich
//   research-validate → research-agent.js --validate
//   auto-research     → auto-research.js
//   knowledge         → knowledge-agent.js
//   xp                → xp-agent.js
//   xp-qc             → xp-agent.js qc --sku
//   xp-compile        → xp-agent.js compile
//   image-gen         → not directly invokable; called inside pipelines (no-op stub)
//   design-director   → not directly invokable; called inside pipelines (no-op stub)
//   vision-director   → not directly invokable; runs as Vision pause/resume gate
//   concept           → not directly invokable; runs as Vision pause/resume gate
//   cohesion          → not directly invokable; runs after listing pipeline
import {
  runResearchAgent,
  runAutoResearch,
  runKnowledgeAgent,
  runXpAgent,
} from '../lib/legacy-bridge.mjs';

const [skill, ...rest] = process.argv.slice(2);
if (!skill) {
  console.error('Usage: single-skill.mjs <skill> [args]');
  process.exit(1);
}

async function main() {
  switch (skill) {
    case 'research':
      return runResearchAgent([...rest, '--full']);
    case 'research-scan':
      return runResearchAgent([...rest, '--scan']);
    case 'research-enrich':
      return runResearchAgent([...rest, '--enrich']);
    case 'research-validate':
      return runResearchAgent([...rest, '--validate']);
    case 'auto-research':
      return runAutoResearch(rest);
    case 'knowledge':
      return runKnowledgeAgent(rest);
    case 'xp':
      return runXpAgent(rest);
    case 'xp-qc':
      return runXpAgent(['qc', ...rest]);
    case 'xp-compile':
      return runXpAgent(['compile']);

    case 'image-gen':
    case 'design-director':
    case 'vision-director':
    case 'concept':
    case 'cohesion':
      console.log(
        `[single-skill] '${skill}' is invoked from inside the pipeline; no direct CLI entry.`
      );
      console.log('  Trigger via /hma-master or /hma-listing.');
      return 0;

    default:
      console.error(`[single-skill] Unknown skill: ${skill}`);
      console.error('  Known: research, research-scan, research-enrich, research-validate,');
      console.error('         auto-research, knowledge, xp, xp-qc, xp-compile,');
      console.error('         image-gen, design-director, vision-director, concept, cohesion');
      process.exit(2);
  }
}

try {
  await main();
} catch (err) {
  console.error(`[single-skill:${skill}] ${err.message}`);
  process.exit(1);
}
