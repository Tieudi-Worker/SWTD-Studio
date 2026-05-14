#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const paths = require('../utils/paths');
const PROJECT_ROOT = paths.agentRoot;
const XP_DIR = paths.xpDir;

// Default data directory — external to HMA agent
const DEFAULT_DATA_DIR = path.join(PROJECT_ROOT, '..', 'data');

/**
 * Resolve per-SKU output directory.
 * Checks: (1) absolute path, (2) data/{SKU}/output, (3) legacy output/{SKU}
 */
function resolveSkuOutput(skuOrPath, dataDir) {
  // Already an existing path
  if (fs.existsSync(skuOrPath)) return skuOrPath;
  // New mode: data/{SKU}/output
  const newPath = path.join(dataDir || DEFAULT_DATA_DIR, skuOrPath, 'output');
  if (fs.existsSync(newPath)) return newPath;
  // Legacy: output/{SKU} inside HMA
  const legacyPath = path.join(PROJECT_ROOT, 'output', skuOrPath);
  if (fs.existsSync(legacyPath)) return legacyPath;
  return newPath; // default to new path (will error downstream if missing)
}

/**
 * Resolve per-SKU research directory (scorecards, reports).
 */
function resolveSkuResearch(skuOrPath, dataDir) {
  if (fs.existsSync(skuOrPath)) return skuOrPath;
  const newPath = path.join(dataDir || DEFAULT_DATA_DIR, skuOrPath, 'research');
  if (fs.existsSync(newPath)) return newPath;
  const legacyPath = path.join(PROJECT_ROOT, 'output', skuOrPath);
  if (fs.existsSync(legacyPath)) return legacyPath;
  return newPath;
}

const XP_FILES = [
  'prompts', 'materials', 'lifestyle', 'niche', 'themes',
  'layouts', 'configs', 'errors', 'slots', 'insights'
];

const WEIGHTS = {
  productAccuracy: 0.30,
  visualQuality: 0.25,
  composition: 0.20,
  conversionRelevance: 0.15,
  brandConsistency: 0.10
};

// ═══════════════════════════════════════
//  SCAN — List output files for QC review
// ═══════════════════════════════════════

function scanOutput(skuOrPath, dataDir) {
  const outputPath = resolveSkuOutput(skuOrPath, dataDir);

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Output folder not found: ${outputPath}`);
  }

  const sku = path.basename(outputPath);
  const result = { sku, outputPath, listing: [], aplus: [], video: [], other: [] };

  // Scan listing/
  const listingDir = path.join(outputPath, 'listing');
  if (fs.existsSync(listingDir)) {
    const files = fs.readdirSync(listingDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f)).sort();
    for (const f of files) {
      const fp = path.join(listingDir, f);
      const stat = fs.statSync(fp);
      const slotMatch = f.match(/slot(\d)/);
      result.listing.push({
        slot: slotMatch ? parseInt(slotMatch[1]) : 0,
        filename: f,
        path: fp,
        sizeMB: (stat.size / (1024 * 1024)).toFixed(2)
      });
    }
  }

  // Scan aplus/
  const aplusDir = path.join(outputPath, 'aplus');
  if (fs.existsSync(aplusDir)) {
    const files = fs.readdirSync(aplusDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f)).sort();
    for (const f of files) {
      const fp = path.join(aplusDir, f);
      const stat = fs.statSync(fp);
      const modMatch = f.match(/module(\d)/);
      result.aplus.push({
        module: modMatch ? parseInt(modMatch[1]) : 0,
        filename: f,
        path: fp,
        sizeMB: (stat.size / (1024 * 1024)).toFixed(2)
      });
    }
  }

  // Scan video/
  const videoDir = path.join(outputPath, 'video');
  if (fs.existsSync(videoDir)) {
    const files = fs.readdirSync(videoDir).sort();
    for (const f of files) {
      const fp = path.join(videoDir, f);
      const stat = fs.statSync(fp);
      result.video.push({
        filename: f,
        path: fp,
        sizeMB: (stat.size / (1024 * 1024)).toFixed(2)
      });
    }
  }

  // Scan root (design-dna, scorecard, etc.)
  const rootFiles = fs.readdirSync(outputPath).filter(f => !fs.statSync(path.join(outputPath, f)).isDirectory());
  for (const f of rootFiles) {
    result.other.push({ filename: f, path: path.join(outputPath, f) });
  }

  return result;
}

// ═══════════════════════════════════════
//  SCORECARD — Create/save QC scores
// ═══════════════════════════════════════

function createScorecard(sku, scores) {
  const scorecard = {
    sku,
    createdAt: new Date().toISOString(),
    images: {},
    overall: { score: 0, pass: false, totalImages: 0, passCount: 0 }
  };

  let totalWeighted = 0;
  let count = 0;

  for (const [key, data] of Object.entries(scores)) {
    const weighted = _calcWeightedScore(data);
    const status = weighted >= 7.0 ? 'PASS' : weighted >= 5.0 ? 'NEEDS IMPROVEMENT' : 'REDO';

    scorecard.images[key] = {
      scores: data,
      weightedScore: parseFloat(weighted.toFixed(2)),
      status,
      notes: data.notes || '',
      lessons: data.lessons || []
    };

    totalWeighted += weighted;
    count++;
    if (weighted >= 7.0) scorecard.overall.passCount++;
  }

  scorecard.overall.totalImages = count;
  scorecard.overall.score = count > 0 ? parseFloat((totalWeighted / count).toFixed(2)) : 0;
  scorecard.overall.pass = scorecard.overall.score >= 7.0;

  // Save to research dir (new mode) or output/{sku} (legacy)
  const researchDir = resolveSkuResearch(sku);
  if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });
  const outPath = path.join(researchDir, 'scorecard.json');
  fs.writeFileSync(outPath, JSON.stringify(scorecard, null, 2));
  console.log(`[XP] Scorecard saved: ${outPath}`);
  console.log(`[XP] Overall: ${scorecard.overall.score}/10 (${scorecard.overall.passCount}/${count} PASS)`);

  return scorecard;
}

function _calcWeightedScore(data) {
  // Support both camelCase (programmatic) and snake_case (Claude Vision QC) keys
  const scores = data.scores || data; // Claude Vision QC nests under .scores
  return (
    (scores.productAccuracy || scores.product_accuracy || 0) * WEIGHTS.productAccuracy +
    (scores.visualQuality || scores.visual_quality || 0) * WEIGHTS.visualQuality +
    (scores.composition || 0) * WEIGHTS.composition +
    (scores.conversionRelevance || scores.conversion_relevance || 0) * WEIGHTS.conversionRelevance +
    (scores.brandConsistency || scores.brand_consistency || 0) * WEIGHTS.brandConsistency
  );
}

// ═══════════════════════════════════════
//  LOG XP — Append entries to XP files
// ═══════════════════════════════════════

function logXP(entries) {
  if (!Array.isArray(entries)) entries = [entries];
  const today = new Date().toISOString().split('T')[0];
  const logged = [];

  for (const entry of entries) {
    const { category, sku, score, context, whatHappened, lesson, rule, evidence } = entry;

    if (!XP_FILES.includes(category)) {
      console.warn(`[XP] Unknown category '${category}', skipping`);
      continue;
    }

    const filePath = path.join(XP_DIR, `${category}.md`);
    let content = fs.readFileSync(filePath, 'utf8');

    // Get next XP ID
    const idMatches = content.match(/### XP-(\d+)/g);
    const maxId = idMatches
      ? Math.max(...idMatches.map(m => parseInt(m.match(/\d+/)[0])))
      : 0;
    const nextId = String(maxId + 1).padStart(3, '0');
    const xpId = `XP-${nextId}`;

    // Build entry block
    const entryBlock = [
      `### ${xpId} | ${today} | Score: ${score}/10 | SKU: ${sku}`,
      `**Context:** ${context}`,
      `**What happened:** ${whatHappened}`,
      `**Lesson:** ${lesson}`,
      rule ? `**Rule:** ${rule}` : null,
      evidence ? `**Evidence:** ${evidence}` : null
    ].filter(Boolean).join('\n');

    // Insert after "## Entry LOG" line
    const logMarker = '## Entry LOG';
    const logIdx = content.indexOf(logMarker);
    if (logIdx === -1) {
      console.warn(`[XP] No '${logMarker}' section in ${category}.md, skipping`);
      continue;
    }

    // Find the end of the line after marker
    const afterMarker = content.indexOf('\n', logIdx) + 1;
    // Skip blank line or "(no entries yet)"
    let insertPos = afterMarker;
    const afterContent = content.substring(afterMarker);
    const noEntriesMatch = afterContent.match(/^\n*\(no entries yet\)\n*/);
    if (noEntriesMatch) {
      insertPos = afterMarker + noEntriesMatch[0].length;
      // Remove "(no entries yet)" placeholder
      content = content.substring(0, afterMarker) + '\n' + content.substring(insertPos);
      insertPos = afterMarker + 1;
    } else {
      insertPos = afterMarker;
      // Add blank line before first entry if needed
      if (!afterContent.startsWith('\n')) {
        content = content.substring(0, insertPos) + '\n' + content.substring(insertPos);
        insertPos += 1;
      }
    }

    content = content.substring(0, insertPos) + entryBlock + '\n\n' + content.substring(insertPos);

    // Update metadata
    const newCount = (idMatches ? idMatches.length : 0) + 1;
    content = content.replace(/- Total entries: \d+/, `- Total entries: ${newCount}`);
    content = content.replace(/- Last updated: .*/, `- Last updated: ${today}`);

    fs.writeFileSync(filePath, content);
    console.log(`[XP] Logged ${xpId} → ${category}.md`);
    logged.push({ xpId, category, lesson });
  }

  // Update _index.md
  if (logged.length > 0) {
    _updateIndex(logged);
  }

  return logged;
}

function _updateIndex(newEntries) {
  const indexPath = path.join(XP_DIR, '_index.md');
  let content = fs.readFileSync(indexPath, 'utf8');

  // Update total entries count
  let totalEntries = 0;
  for (const cat of XP_FILES) {
    const fp = path.join(XP_DIR, `${cat}.md`);
    const c = fs.readFileSync(fp, 'utf8');
    const m = c.match(/- Total entries: (\d+)/);
    const count = m ? parseInt(m[1]) : 0;
    totalEntries += count;

    // Update per-file row in table
    const topRule = c.match(/- Top rule: (.+)/);
    const topRuleText = topRule ? topRule[1] : '-';
    const rowRegex = new RegExp(`\\| ${cat}\\.md \\| \\d+ \\| .+ \\|`);
    content = content.replace(rowRegex, `| ${cat}.md | ${count} | ${topRuleText} |`);
  }

  content = content.replace(/- Total entries: \d+/, `- Total entries: ${totalEntries}`);
  content = content.replace(/- Last QC run: .*/, `- Last QC run: ${new Date().toISOString().split('T')[0]}`);

  // Update latest entries section
  const latestMarker = '## Latest Entries';
  const latestIdx = content.indexOf(latestMarker);
  if (latestIdx >= 0) {
    const latestEnd = content.indexOf('\n---', latestIdx + latestMarker.length);
    const latestEntries = newEntries.slice(0, 5).map(e =>
      `- **${e.xpId}** (${e.category}): ${e.lesson.substring(0, 80)}`
    ).join('\n');

    const beforeLatest = content.substring(0, latestIdx + latestMarker.length);
    const afterLatest = latestEnd >= 0 ? content.substring(latestEnd) : '\n\n---';
    content = beforeLatest + '\n\n' + latestEntries + '\n' + afterLatest;
  }

  fs.writeFileSync(indexPath, content);
}

// ═══════════════════════════════════════
//  COMPILE — Find repeated lessons → rules
// ═══════════════════════════════════════

function compileRules() {
  const allEntries = [];

  // Parse all XP files
  for (const cat of XP_FILES) {
    const fp = path.join(XP_DIR, `${cat}.md`);
    const content = fs.readFileSync(fp, 'utf8');
    const entryRegex = /### (XP-\d+) \| .+ \| Score: ([\d.]+)\/10 \| SKU: (.+)\n\*\*Context:\*\* (.+)\n\*\*What happened:\*\* (.+)\n\*\*Lesson:\*\* (.+)/g;

    let match;
    while ((match = entryRegex.exec(content)) !== null) {
      allEntries.push({
        id: match[1],
        score: parseFloat(match[2]),
        sku: match[3],
        context: match[4],
        whatHappened: match[5],
        lesson: match[6],
        category: cat
      });
    }
  }

  if (allEntries.length < 3) {
    console.log(`[XP] Only ${allEntries.length} entries — need at least 3 to compile rules`);
    return [];
  }

  // Group similar lessons by keyword overlap
  const groups = _groupSimilarLessons(allEntries);
  const suggestedRules = [];

  for (const group of groups) {
    if (group.entries.length >= 3) {
      suggestedRules.push({
        rule: group.commonLesson,
        verified: group.entries.length,
        sourceEntries: group.entries.map(e => e.id),
        categories: [...new Set(group.entries.map(e => e.category))],
        avgScore: parseFloat((group.entries.reduce((s, e) => s + e.score, 0) / group.entries.length).toFixed(1))
      });
    }
  }

  if (suggestedRules.length === 0) {
    console.log('[XP] No patterns found with 3+ occurrences yet');
  } else {
    console.log(`[XP] Found ${suggestedRules.length} rule candidates:`);
    suggestedRules.forEach((r, i) => {
      console.log(`  ${i + 1}. "${r.rule}" (verified ${r.verified}x, avg score ${r.avgScore})`);
    });
  }

  return suggestedRules;
}

function _groupSimilarLessons(entries) {
  const groups = [];

  for (const entry of entries) {
    const words = _extractKeywords(entry.lesson);
    let matched = false;

    for (const group of groups) {
      const overlap = _keywordOverlap(words, group.keywords);
      if (overlap >= 0.5) { // 50%+ keyword overlap = similar lesson
        group.entries.push(entry);
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.push({
        keywords: words,
        commonLesson: entry.lesson,
        entries: [entry]
      });
    }
  }

  return groups;
}

function _extractKeywords(text) {
  const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with',
    'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither',
    'this', 'that', 'these', 'those', 'it', 'its', 'than', 'more', 'very']);
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
}

function _keywordOverlap(a, b) {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let overlap = 0;
  for (const w of setA) { if (setB.has(w)) overlap++; }
  return overlap / Math.min(setA.size, setB.size);
}

// ═══════════════════════════════════════
//  APPLY RULES — Promote into OpenClaw rule files
// ═══════════════════════════════════════

function applyRules(rules) {
  if (!rules || rules.length === 0) {
    console.log('[XP] No rules to apply');
    return;
  }

  const antiPatternsPath = path.resolve(PROJECT_ROOT, '..', '..', '_shared', 'rules', 'prompt-anti-patterns.md');
  let content = fs.readFileSync(antiPatternsPath, 'utf8');

  const sectionHeader = '## XP RULES (Auto-compiled)';
  const startMarker = '<!-- XP_AUTO_RULES_START -->';
  const endMarker = '<!-- XP_AUTO_RULES_END -->';

  const existingRuleIds = [...content.matchAll(/### RULE-(\d+)/g)].map(m => parseInt(m[1], 10));
  let nextRuleNum = existingRuleIds.length ? Math.max(...existingRuleIds) + 1 : 1;

  const rulesBlock = rules.map((r) => {
    const ruleId = `RULE-${String(nextRuleNum++).padStart(3, '0')}`;
    return [
      `### ${ruleId}: ${r.rule.substring(0, 60)}`,
      `- **Rule:** ${r.rule}`,
      `- **Verified:** ${r.verified} times (avg score: ${r.avgScore})`,
      `- **Source:** ${r.sourceEntries.join(', ')}`,
      `- **Categories:** ${r.categories.join(', ')}`
    ].join('\n');
  }).join('\n\n');

  const fullSection = [
    sectionHeader,
    '',
    '> Auto-promoted from `runtime/legacy/xp/_compiled-candidates.json` for OpenClaw consumption.',
    '> Managed block: rerunning `xp-agent apply-rules` replaces this block, not the hand-written doctrine above.',
    '',
    startMarker,
    rulesBlock,
    endMarker,
    ''
  ].join('\n');

  if (content.includes(startMarker) && content.includes(endMarker)) {
    const blockRegex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
    content = content.replace(blockRegex, `${startMarker}\n${rulesBlock}\n${endMarker}`);
    if (!content.includes(sectionHeader)) {
      content = `${sectionHeader}\n\n${startMarker}\n${rulesBlock}\n${endMarker}\n\n${content}`;
    }
  } else if (content.includes('## Maintenance')) {
    content = content.replace('## Maintenance', `${fullSection}\n## Maintenance`);
  } else {
    content = content.trimEnd() + `\n\n${fullSection}`;
  }

  fs.writeFileSync(antiPatternsPath, content);
  console.log(`[XP] Applied ${rules.length} rules to ${antiPatternsPath}`);

  // Also update XP files with compiled rules
  for (const rule of rules) {
    for (const cat of rule.categories) {
      _addCompiledRuleToFile(cat, rule);
    }
  }
}

function _addCompiledRuleToFile(category, rule) {
  const fp = path.join(XP_DIR, `${category}.md`);
  let content = fs.readFileSync(fp, 'utf8');

  const compiledMarker = '## COMPILED RULES';
  const compiledIdx = content.indexOf(compiledMarker);
  if (compiledIdx < 0) return;

  // Get next RULE ID in this file
  const ruleMatches = content.match(/### RULE-(\d+)/g);
  const maxRuleId = ruleMatches
    ? Math.max(...ruleMatches.map(m => parseInt(m.match(/\d+/)[0])))
    : 0;
  const ruleId = `RULE-${String(maxRuleId + 1).padStart(3, '0')}`;

  const ruleBlock = [
    `### ${ruleId}: ${rule.rule.substring(0, 60)}`,
    `- **Rule:** ${rule.rule}`,
    `- **Verified:** ${rule.verified} times`,
    `- **Source entries:** ${rule.sourceEntries.join(', ')}`
  ].join('\n');

  // Remove placeholder if present
  content = content.replace(/\(no compiled rules yet\)\n?/, '');

  // Insert after compiled rules header
  const afterMarker = content.indexOf('\n', compiledIdx) + 1;
  content = content.substring(0, afterMarker) + '\n' + ruleBlock + '\n' + content.substring(afterMarker);

  // Update top rule in metadata
  content = content.replace(/- Top rule: .*/, `- Top rule: ${rule.rule.substring(0, 50)}`);

  fs.writeFileSync(fp, content);
}

// ═══════════════════════════════════════
//  REPORT — Generate QC summary
// ═══════════════════════════════════════

function generateReport(sku, dataDir) {
  const researchDir = resolveSkuResearch(sku, dataDir);
  const scorecardPath = path.join(researchDir, 'scorecard.json');
  if (!fs.existsSync(scorecardPath)) {
    console.log(`[XP] No scorecard found for ${sku}`);
    return null;
  }

  const scorecard = JSON.parse(fs.readFileSync(scorecardPath, 'utf8'));

  // Find related XP entries
  const relatedEntries = [];
  for (const cat of XP_FILES) {
    const fp = path.join(XP_DIR, `${cat}.md`);
    const content = fs.readFileSync(fp, 'utf8');
    const regex = new RegExp(`### (XP-\\d+) \\| .+ \\| Score: [\\d.]+/10 \\| SKU: ${sku}`, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      relatedEntries.push({ id: match[1], category: cat });
    }
  }

  const report = [
    `# QC Report: ${sku}`,
    `**Date:** ${scorecard.createdAt}`,
    `**Overall Score:** ${scorecard.overall.score}/10 (${scorecard.overall.pass ? 'PASS' : 'NEEDS IMPROVEMENT'})`,
    `**Images:** ${scorecard.overall.passCount}/${scorecard.overall.totalImages} passed`,
    '',
    '## Per-Image Scores',
    ...Object.entries(scorecard.images).map(([key, img]) =>
      `- **${key}:** ${img.weightedScore}/10 ${img.status}${img.notes ? ` — ${img.notes}` : ''}`
    ),
    '',
    '## XP Entries Created',
    relatedEntries.length > 0
      ? relatedEntries.map(e => `- ${e.id} (${e.category})`).join('\n')
      : '(none)',
    ''
  ].join('\n');

  const reportPath = path.join(researchDir, `qc-report_${new Date().toISOString().split('T')[0]}.md`);
  fs.writeFileSync(reportPath, report);
  console.log(`[XP] Report saved: ${reportPath}`);
  console.log(report);

  return report;
}

// ═══════════════════════════════════════
//  STATS — Show XP system overview
// ═══════════════════════════════════════

function showStats() {
  console.log('\n[XP] System Stats');
  console.log('─'.repeat(40));

  let totalEntries = 0;
  let totalRules = 0;

  for (const cat of XP_FILES) {
    const fp = path.join(XP_DIR, `${cat}.md`);
    if (!fs.existsSync(fp)) { console.log(`  ${cat}: (file missing)`); continue; }
    const content = fs.readFileSync(fp, 'utf8');
    const entryCount = (content.match(/### XP-\d+/g) || []).length;
    const ruleCount = (content.match(/### RULE-\d+/g) || []).length;
    totalEntries += entryCount;
    totalRules += ruleCount;
    console.log(`  ${cat.padEnd(12)} ${String(entryCount).padStart(3)} entries  ${String(ruleCount).padStart(2)} rules`);
  }

  console.log('─'.repeat(40));
  console.log(`  TOTAL        ${String(totalEntries).padStart(3)} entries  ${String(totalRules).padStart(2)} rules`);

  // Count scorecards — scan data/ (new) then legacy output/
  let scorecardCount = 0;
  const dataDir = DEFAULT_DATA_DIR;
  if (fs.existsSync(dataDir)) {
    scorecardCount += fs.readdirSync(dataDir).filter(d => {
      const full = path.join(dataDir, d);
      return fs.statSync(full).isDirectory() &&
        (fs.existsSync(path.join(full, 'research', 'scorecard.json')) ||
         fs.existsSync(path.join(full, 'output', 'scorecard.json')));
    }).length;
  }
  const legacyOutput = path.join(PROJECT_ROOT, 'output');
  if (fs.existsSync(legacyOutput)) {
    scorecardCount += fs.readdirSync(legacyOutput).filter(d =>
      fs.statSync(path.join(legacyOutput, d)).isDirectory() &&
      fs.existsSync(path.join(legacyOutput, d, 'scorecard.json'))
    ).length;
  }
  console.log(`  Scorecards:  ${scorecardCount}`);
  console.log('');
}

// ═══════════════════════════════════════
//  CLI
// ═══════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const hasFlag = (flag) => args.includes(flag);
  const getFlagValue = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  if (!args.length) {
    console.log(`
XP Agent — Self-learning system for Handmade Media Agent

Usage:
  node agents/xp-agent.js scan --sku <SKU> [--data <dir>]    List output files for QC review
  node agents/xp-agent.js log --sku <SKU> --scores <path>    Log XP entries from scorecard
  node agents/xp-agent.js compile                            Find repeated lessons → suggest rules
  node agents/xp-agent.js apply-rules                        Apply compiled rules to CLAUDE.md
  node agents/xp-agent.js report --sku <SKU> [--data <dir>]  Generate QC report
  node agents/xp-agent.js stats                              Show XP system overview
  node agents/xp-agent.js qc --sku <SKU> [--data <dir>]      Full QC flow (scan + review guide)

Options:
  --data <dir>    Data directory (default: ../data)

Workflow:
  1. Pipeline runs → output in data/{SKU}/output/
  2. Claude Code views output images (Vision) → scores each image
  3. Claude Code creates scorecard → runs 'log' to save XP entries
  4. After 5+ SKU runs → 'compile' to find patterns → 'apply-rules' to update CLAUDE.md
`);
    process.exit(0);
  }

  const command = args[0];
  const sku = getFlagValue('--sku');
  const dataDir = getFlagValue('--data') || DEFAULT_DATA_DIR;

  switch (command) {
    case 'scan': {
      if (!sku) { console.error('[XP] --sku required'); process.exit(1); }
      const scan = scanOutput(sku, dataDir);
      console.log(`\n[XP] Output scan: ${scan.sku}`);
      console.log(`[XP] Path: ${scan.outputPath}\n`);

      if (scan.listing.length) {
        console.log('Listing images:');
        scan.listing.forEach(f => console.log(`  Slot ${f.slot}: ${f.filename} (${f.sizeMB}MB)`));
      }
      if (scan.aplus.length) {
        console.log('\nA+ modules:');
        scan.aplus.forEach(f => console.log(`  Module ${f.module}: ${f.filename} (${f.sizeMB}MB)`));
      }
      if (scan.video.length) {
        console.log('\nVideo files:');
        scan.video.forEach(f => console.log(`  ${f.filename} (${f.sizeMB}MB)`));
      }

      const total = scan.listing.length + scan.aplus.length + scan.video.length;
      console.log(`\n[XP] Total: ${total} files ready for QC review`);
      console.log('[XP] Claude Code: view each image → score → create scorecard → log XP');
      break;
    }

    case 'log': {
      if (!sku) { console.error('[XP] --sku required'); process.exit(1); }
      const scoresPath = getFlagValue('--scores');
      if (!scoresPath) { console.error('[XP] --scores <path> required'); process.exit(1); }

      const resolved = path.resolve(scoresPath);
      if (!fs.existsSync(resolved)) { console.error(`[XP] Scorecard not found: ${resolved}`); process.exit(1); }

      const scorecard = JSON.parse(fs.readFileSync(resolved, 'utf8'));
      const entries = [];

      // Extract lessons from scorecard
      // Supports both formats:
      //   - String array: ["lesson1", "lesson2"] (from Claude Vision QC)
      //   - Object array: [{ lesson, category, context }] (from programmatic scorecard)
      for (const [key, img] of Object.entries(scorecard.images || {})) {
        // Resolve score: try weightedScore, then final_score (Claude Vision QC format)
        const imgScore = img.weightedScore ?? img.final_score ?? 0;

        if (img.lessons && img.lessons.length > 0) {
          for (const lessonObj of img.lessons) {
            // Handle string lessons (Claude Vision QC format)
            if (typeof lessonObj === 'string') {
              entries.push({
                category: 'slots',
                sku,
                score: imgScore,
                context: key,
                whatHappened: `${key} scored ${imgScore}`,
                lesson: lessonObj,
                rule: null,
                evidence: null
              });
            } else {
              // Object format (programmatic scorecard)
              entries.push({
                category: lessonObj.category || 'slots',
                sku,
                score: imgScore,
                context: lessonObj.context || key,
                whatHappened: lessonObj.whatHappened || `${key} scored ${imgScore}`,
                lesson: lessonObj.lesson,
                rule: lessonObj.rule || null,
                evidence: lessonObj.evidence || null
              });
            }
          }
        }

      }

      if (entries.length === 0) {
        console.log('[XP] No lessons found in scorecard. Add lessons to image entries.');
      } else {
        logXP(entries);
        console.log(`[XP] Logged ${entries.length} XP entries from scorecard`);
      }
      break;
    }

    case 'compile': {
      const rules = compileRules();
      if (rules.length > 0) {
        console.log('\n[XP] Review rules above. To apply: node agents/xp-agent.js apply-rules');
        const rulesPath = path.join(XP_DIR, '_compiled-candidates.json');
        fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
        console.log(`[XP] Candidates saved: ${rulesPath}`);
      }
      break;
    }

    case 'apply-rules': {
      const candidatesPath = path.join(XP_DIR, '_compiled-candidates.json');
      if (!fs.existsSync(candidatesPath)) {
        console.error('[XP] No compiled candidates. Run compile first.');
        process.exit(1);
      }
      const rules = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
      applyRules(rules);
      console.log(`[XP] Rules applied. Candidates kept for audit: ${candidatesPath}`);
      break;
    }

    case 'report': {
      if (!sku) { console.error('[XP] --sku required'); process.exit(1); }
      generateReport(sku, dataDir);
      break;
    }

    case 'stats': {
      showStats();
      break;
    }

    case 'qc': {
      if (!sku) { console.error('[XP] --sku required'); process.exit(1); }
      const scan = scanOutput(sku, dataDir);
      console.log(`\n[XP] QC Review for: ${scan.sku}`);
      console.log(`[XP] Path: ${scan.outputPath}\n`);

      if (scan.listing.length) {
        console.log('Listing images to review:');
        scan.listing.forEach(f => console.log(`  Slot ${f.slot}: ${f.path}`));
      }
      if (scan.aplus.length) {
        console.log('\nA+ modules to review:');
        scan.aplus.forEach(f => console.log(`  Module ${f.module}: ${f.path}`));
      }

      const total = scan.listing.length + scan.aplus.length;
      console.log(`\n[XP] ${total} images ready for Vision review`);
      console.log('[XP] Claude Code workflow:');
      console.log('  1. View each image above (Read tool)');
      console.log('  2. Score using rubric: xp/_scoring-rubric.md');
      console.log('  3. Create scorecard with lessons (graphics auto-evaluated)');
      const scorecardHint = path.join(resolveSkuResearch(sku, dataDir), 'scorecard.json');
      console.log(`  4. Log: node agents/xp-agent.js log --sku ${sku} --scores ${scorecardHint}`);
      console.log('  Note: Callout graphics (circles, badges, dividers) are auto-evaluated');
      break;
    }

    default:
      console.error(`[XP] Unknown command: ${command}`);
      console.log('Run without args for help');
      process.exit(1);
  }
}

// Only run CLI when called directly (not when required as module)
if (require.main === module) {
  main().catch(err => { console.error(`[XP FATAL] ${err.message}`); process.exit(1); });
}

module.exports = { scanOutput, createScorecard, logXP, compileRules, applyRules, generateReport };
