#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Knowledge Agent — Knowledge Base Manager
 *
 * Works WITH Claude Code (not a replacement). Claude Code does the actual
 * research (WebSearch, WebFetch, Vision) and this agent manages the files.
 *
 * Commands:
 *   --list                          List all knowledge entries
 *   --add <category> <topic>        Create new knowledge file from template
 *   --search <keyword>              Search across all knowledge files
 *   --summary                       Generate knowledge summary for pipeline use
 *   --export                        Export actionable rules to config files
 *   --stats                         Show knowledge base statistics
 *   --validate                      Check for stale/empty knowledge files
 */

const paths = require('../utils/paths');
const PROJECT_ROOT = paths.agentRoot; // backward compat alias
const KNOWLEDGE_DIR = paths.knowledgeDir;
const INDEX_PATH = path.join(KNOWLEDGE_DIR, '_index.json');

// ═══════════════════════════════════════
//  INDEX MANAGEMENT
// ═══════════════════════════════════════

function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    return { version: '1.0.0', last_updated: null, total_entries: 0, entries: [] };
  }
  return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
}

function saveIndex(index) {
  index.last_updated = new Date().toISOString();
  index.total_entries = index.entries.length;
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

function rebuildIndex() {
  const index = loadIndex();
  const entries = [];
  const categories = Object.keys(index.categories || {});

  for (const cat of categories) {
    const catDir = path.join(KNOWLEDGE_DIR, cat);
    if (!fs.existsSync(catDir)) continue;

    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(catDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Extract title from first heading
      const title = (lines.find(l => l.startsWith('# ')) || '').replace('# ', '').trim();

      // Extract source
      const sourceLine = lines.find(l => l.startsWith('- ') && lines.indexOf(l) > 0 && lines[lines.indexOf(l) - 1]?.includes('Source'));
      const source = sourceLine ? sourceLine.replace('- ', '').trim() : '';

      // Check if it has real content (not just "pending" placeholders)
      const pendingCount = (content.match(/pending first research/gi) || []).length;
      const toBeFilledCount = (content.match(/to be filled/gi) || []).length;
      const hasContent = pendingCount === 0 && toBeFilledCount === 0;

      // Count non-empty sections
      const sections = content.split(/^## /m).length - 1;
      const filledSections = content.split(/^## /m).slice(1).filter(s => {
        const sectionContent = s.split('\n').slice(1).join('\n').trim();
        return sectionContent.length > 0 && !sectionContent.includes('to be filled') && !sectionContent.includes('pending');
      }).length;

      entries.push({
        category: cat,
        file: file,
        title: title,
        source: source,
        status: hasContent ? 'researched' : 'pending',
        sections: sections,
        filled_sections: filledSections,
        last_modified: fs.statSync(filePath).mtime.toISOString()
      });
    }
  }

  index.entries = entries;
  saveIndex(index);
  return index;
}

// ═══════════════════════════════════════
//  LIST — Show all knowledge entries
// ═══════════════════════════════════════

function listEntries() {
  const index = rebuildIndex();

  console.log('\n[Knowledge] KNOWLEDGE BASE');
  console.log(`  Total files: ${index.total_entries}`);
  console.log(`  Last updated: ${index.last_updated || 'never'}`);

  const byCategory = {};
  for (const entry of index.entries) {
    if (!byCategory[entry.category]) byCategory[entry.category] = [];
    byCategory[entry.category].push(entry);
  }

  for (const [cat, entries] of Object.entries(byCategory)) {
    const desc = index.categories?.[cat] || '';
    console.log(`\n  [${cat}] ${desc}`);
    for (const e of entries) {
      const statusIcon = e.status === 'researched' ? '✓' : '○';
      const fillRate = `${e.filled_sections}/${e.sections}`;
      console.log(`    ${statusIcon} ${e.title} (${e.file}) — ${fillRate} sections filled`);
    }
  }

  return index;
}

// ═══════════════════════════════════════
//  ADD — Create new knowledge file
// ═══════════════════════════════════════

function addEntry(category, topic) {
  const index = loadIndex();
  const validCategories = Object.keys(index.categories || {});

  if (!validCategories.includes(category)) {
    console.error(`[Knowledge] Invalid category: ${category}`);
    console.error(`  Valid: ${validCategories.join(', ')}`);
    process.exit(1);
  }

  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const filePath = path.join(KNOWLEDGE_DIR, category, `${slug}.md`);

  if (fs.existsSync(filePath)) {
    console.error(`[Knowledge] File already exists: ${filePath}`);
    process.exit(1);
  }

  const template = `# ${topic}

## Source
- (to be filled by Claude Code research)
- Category: ${category}
- Last verified: pending first research

## Key Findings
- (to be filled during research)

## Actionable Insights
- (to be filled during research — rules that can be applied to the pipeline)

## Raw Notes
- (to be filled during research)
`;

  const catDir = path.join(KNOWLEDGE_DIR, category);
  if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });

  fs.writeFileSync(filePath, template);
  console.log(`[Knowledge] Created: ${filePath}`);
  console.log(`[Knowledge] NEXT: Ask Claude Code to research "${topic}" and fill this file`);
  console.log(`  Example: "Research ${topic} for handmade products on Amazon and update knowledge/${category}/${slug}.md"`);

  rebuildIndex();
  return filePath;
}

// ═══════════════════════════════════════
//  SEARCH — Find across all knowledge
// ═══════════════════════════════════════

function searchKnowledge(keyword) {
  const results = [];
  const lowerKeyword = keyword.toLowerCase();

  const categories = fs.readdirSync(KNOWLEDGE_DIR).filter(f => {
    const stat = fs.statSync(path.join(KNOWLEDGE_DIR, f));
    return stat.isDirectory() && !f.startsWith('_');
  });

  for (const cat of categories) {
    const catDir = path.join(KNOWLEDGE_DIR, cat);
    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(catDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      const matches = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lowerKeyword)) {
          matches.push({ line: i + 1, text: lines[i].trim() });
        }
      }

      if (matches.length > 0) {
        results.push({ category: cat, file, path: filePath, matches });
      }
    }
  }

  console.log(`\n[Knowledge] SEARCH: "${keyword}"`);
  console.log(`  Found: ${results.length} files, ${results.reduce((s, r) => s + r.matches.length, 0)} matches`);

  for (const r of results) {
    console.log(`\n  [${r.category}/${r.file}]`);
    for (const m of r.matches.slice(0, 5)) {
      console.log(`    L${m.line}: ${m.text.substring(0, 100)}`);
    }
    if (r.matches.length > 5) console.log(`    ... and ${r.matches.length - 5} more`);
  }

  return results;
}

// ═══════════════════════════════════════
//  SUMMARY — Generate pipeline-ready summary
// ═══════════════════════════════════════

function generateSummary(outputPath) {
  const summary = {
    generated_at: new Date().toISOString(),
    knowledge_rules: [],
    slot_tips: {},
    category_insights: {},
    photography_tips: [],
    conversion_tactics: []
  };

  const categories = fs.readdirSync(KNOWLEDGE_DIR).filter(f => {
    return fs.statSync(path.join(KNOWLEDGE_DIR, f)).isDirectory() && !f.startsWith('_');
  });

  for (const cat of categories) {
    const catDir = path.join(KNOWLEDGE_DIR, cat);
    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(catDir, file), 'utf8');

      // Extract actionable insights (lines under "## Actionable Insights" or "## Insights for Pipeline")
      const insightSection = extractSection(content, ['Actionable Insights', 'Insights for Pipeline', 'Key Findings']);
      if (insightSection) {
        const bullets = insightSection.split('\n')
          .filter(l => l.startsWith('- ') && !l.includes('to be filled') && !l.includes('pending'))
          .map(l => l.replace('- ', '').trim())
          .filter(l => l.length > 0);

        for (const bullet of bullets) {
          summary.knowledge_rules.push({
            source: `${cat}/${file}`,
            rule: bullet
          });
        }
      }

      // Extract slot-specific tips
      const slotSection = extractSection(content, ['Slot Tips', 'Per-Slot', 'Image Slot']);
      if (slotSection) {
        const slotMatches = slotSection.match(/slot\s*(\d)/gi) || [];
        for (const match of slotMatches) {
          const num = match.replace(/\D/g, '');
          if (!summary.slot_tips[`slot${num}`]) summary.slot_tips[`slot${num}`] = [];
        }
      }

      // Category-specific insights for niches
      if (cat === 'niches') {
        const nicheKey = file.replace('.md', '');
        const findings = extractSection(content, ['Key Findings', 'Top Seller Patterns', 'Visual Trends']);
        if (findings) {
          summary.category_insights[nicheKey] = findings.split('\n')
            .filter(l => l.startsWith('- ') && !l.includes('to be filled'))
            .map(l => l.replace('- ', '').trim())
            .filter(l => l.length > 0);
        }
      }

      // Photography tips
      if (cat === 'photography') {
        const tips = extractSection(content, ['Lighting', 'Composition', 'Styling', 'Background']);
        if (tips) {
          const bullets = tips.split('\n')
            .filter(l => l.startsWith('- ') && !l.includes('to be filled'))
            .map(l => l.replace('- ', '').trim())
            .filter(l => l.length > 0);
          summary.photography_tips.push(...bullets);
        }
      }

      // Conversion tactics
      if (cat === 'amazon-listing') {
        const tactics = extractSection(content, ['High-Converting', 'Conversion', 'Best Practices']);
        if (tactics) {
          const bullets = tactics.split('\n')
            .filter(l => l.startsWith('- ') && !l.includes('to be filled'))
            .map(l => l.replace('- ', '').trim())
            .filter(l => l.length > 0);
          summary.conversion_tactics.push(...bullets);
        }
      }
    }
  }

  // Clean up empty arrays
  summary.knowledge_rules = summary.knowledge_rules.filter(r => r.rule.length > 0);
  summary.photography_tips = [...new Set(summary.photography_tips)];
  summary.conversion_tactics = [...new Set(summary.conversion_tactics)];

  const outPath = outputPath || path.join(KNOWLEDGE_DIR, '_summary.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(`\n[Knowledge] SUMMARY GENERATED: ${outPath}`);
  console.log(`  Rules: ${summary.knowledge_rules.length}`);
  console.log(`  Photography tips: ${summary.photography_tips.length}`);
  console.log(`  Conversion tactics: ${summary.conversion_tactics.length}`);
  console.log(`  Category insights: ${Object.keys(summary.category_insights).length} niches`);

  return summary;
}

function extractSection(content, headings) {
  for (const heading of headings) {
    const regex = new RegExp(`^## .*${heading}.*$`, 'mi');
    const match = content.match(regex);
    if (match) {
      const startIdx = content.indexOf(match[0]) + match[0].length;
      const nextSection = content.indexOf('\n## ', startIdx);
      const section = nextSection > 0
        ? content.substring(startIdx, nextSection).trim()
        : content.substring(startIdx).trim();
      if (section.length > 0) return section;
    }
  }
  return null;
}

// ═══════════════════════════════════════
//  EXPORT — Apply knowledge to config
// ═══════════════════════════════════════

function exportToConfig() {
  const summary = generateSummary();
  const configPath = path.join(paths.configDir, 'research-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  let changes = 0;

  // Add knowledge-derived insights to config
  if (summary.category_insights && Object.keys(summary.category_insights).length > 0) {
    if (!config.knowledge_insights) config.knowledge_insights = {};

    for (const [niche, insights] of Object.entries(summary.category_insights)) {
      if (insights.length > 0) {
        config.knowledge_insights[niche] = insights;
        changes++;
      }
    }
  }

  // Add photography tips
  if (summary.photography_tips.length > 0) {
    config.knowledge_photography_tips = summary.photography_tips;
    changes++;
  }

  // Add conversion tactics
  if (summary.conversion_tactics.length > 0) {
    config.knowledge_conversion_tactics = summary.conversion_tactics;
    changes++;
  }

  if (changes > 0) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\n[Knowledge] EXPORTED to research-config.json — ${changes} sections updated`);
  } else {
    console.log('\n[Knowledge] Nothing to export — research your knowledge files first');
  }

  return changes;
}

// ═══════════════════════════════════════
//  STATS — Overview
// ═══════════════════════════════════════

function showStats() {
  const index = rebuildIndex();

  const total = index.entries.length;
  const researched = index.entries.filter(e => e.status === 'researched').length;
  const pending = total - researched;
  const totalSections = index.entries.reduce((s, e) => s + e.sections, 0);
  const filledSections = index.entries.reduce((s, e) => s + e.filled_sections, 0);

  console.log('\n[Knowledge] STATISTICS');
  console.log(`  Total files: ${total}`);
  console.log(`  Researched: ${researched}`);
  console.log(`  Pending: ${pending}`);
  console.log(`  Sections: ${filledSections}/${totalSections} filled (${totalSections > 0 ? Math.round(filledSections / totalSections * 100) : 0}%)`);

  if (pending > 0) {
    console.log('\n  Pending research:');
    for (const e of index.entries.filter(e => e.status === 'pending')) {
      console.log(`    ○ knowledge/${e.category}/${e.file}`);
    }
    console.log('\n  To research, ask Claude Code:');
    console.log('    "Research [topic] and update knowledge/[category]/[file].md"');
  }

  return { total, researched, pending, filledSections, totalSections };
}

// ═══════════════════════════════════════
//  VALIDATE — Check for stale entries
// ═══════════════════════════════════════

function validateKnowledge() {
  const index = rebuildIndex();
  const issues = [];

  for (const entry of index.entries) {
    // Check empty files
    if (entry.filled_sections === 0) {
      issues.push({ type: 'empty', file: `${entry.category}/${entry.file}`, message: 'No sections filled — needs research' });
    }

    // Check stale files (older than 30 days)
    const age = Date.now() - new Date(entry.last_modified).getTime();
    const days = Math.floor(age / (1000 * 60 * 60 * 24));
    if (days > 30 && entry.status === 'researched') {
      issues.push({ type: 'stale', file: `${entry.category}/${entry.file}`, message: `Last modified ${days} days ago — may need refresh` });
    }

    // Check partially filled
    if (entry.filled_sections > 0 && entry.filled_sections < entry.sections) {
      issues.push({ type: 'partial', file: `${entry.category}/${entry.file}`, message: `${entry.filled_sections}/${entry.sections} sections filled` });
    }
  }

  console.log(`\n[Knowledge] VALIDATION — ${issues.length} issues found`);
  for (const issue of issues) {
    const icon = issue.type === 'empty' ? '!' : issue.type === 'stale' ? '~' : '?';
    console.log(`  ${icon} [${issue.type}] ${issue.file} — ${issue.message}`);
  }

  if (issues.length === 0) {
    console.log('  All knowledge files are in good shape.');
  }

  return issues;
}

// ═══════════════════════════════════════
//  CLI
// ═══════════════════════════════════════

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Knowledge Agent — Knowledge Base Manager for Handmade Media Agent

Usage:
  node agents/knowledge-agent.js --list                       List all knowledge entries
  node agents/knowledge-agent.js --add <category> <topic>     Create new knowledge file
  node agents/knowledge-agent.js --search <keyword>           Search across knowledge base
  node agents/knowledge-agent.js --summary                    Generate _summary.json for pipeline
  node agents/knowledge-agent.js --export                     Export knowledge rules to config
  node agents/knowledge-agent.js --stats                      Show statistics
  node agents/knowledge-agent.js --validate                   Check for stale/empty files

Categories: amazon-listing, photography, competitors, niches

Workflow (with Claude Code):
  1. Add topic:    node agents/knowledge-agent.js --add niches "teacher gifts"
  2. Research:     Ask Claude Code "Research teacher gifts on Amazon and update knowledge/niches/teacher-gifts.md"
  3. Summarize:    node agents/knowledge-agent.js --summary
  4. Export:       node agents/knowledge-agent.js --export
  5. Run pipeline: node agents/master.js briefs/[sku].json  (now enriched with knowledge)
`);
    process.exit(0);
  }

  const hasFlag = (flag) => args.includes(flag);
  const getFlagValue = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  try {
    if (hasFlag('--list')) {
      listEntries();
    } else if (hasFlag('--add')) {
      const category = getFlagValue('--add');
      const topic = args[args.indexOf('--add') + 2];
      if (!category || !topic) {
        throw new Error('--add requires <category> <topic>');
      }
      addEntry(category, topic);
    } else if (hasFlag('--search')) {
      const keyword = getFlagValue('--search');
      if (!keyword) throw new Error('--search requires a keyword');
      searchKnowledge(keyword);
    } else if (hasFlag('--summary')) {
      const outPath = getFlagValue('--output');
      generateSummary(outPath);
    } else if (hasFlag('--export')) {
      exportToConfig();
    } else if (hasFlag('--stats')) {
      showStats();
    } else if (hasFlag('--validate')) {
      validateKnowledge();
    } else {
      console.error(`[Knowledge] Unknown command: ${args[0]}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`[Knowledge] ERROR: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { searchKnowledge, generateSummary, exportToConfig, rebuildIndex, loadIndex };
