#!/usr/bin/env node
/**
 * Phase 5 smoke harness — loads the v1 Amazon pack and every fixture under
 * `test/fixtures/*.json`, runs `evaluate(...)`, and asserts:
 *
 *   1. Each fixture's `expected.overall` matches the verdict's `overall`.
 *   2. Every ruleId in `expected.containsRuleIds` appears in the findings.
 *   3. No ruleId in `expected.notContainsRuleIds` appears in the findings.
 *   4. (Coverage gate) Every rule in the pack has at least one fixture
 *      that exercises it via `containsRuleIds`.
 *
 * Exits 0 on success, 1 otherwise. Pure Node 18+; no `apps/desktop/node_modules`
 * required. Wired into the Phase 5 P5.1 verification gate (tasks.md T028).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createComplianceEngine } from '../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACK_PATH = resolve(__dirname, '../rules/amazon/amazon-listing-v1.json')
const FIXTURES_DIR = resolve(__dirname, 'fixtures')

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function loadFixtures(dir) {
  /** @type {Array<{name?:string, _file:string, subject:object, expected:object}>} */
  const cases = []
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue
    const full = join(dir, entry)
    if (!statSync(full).isFile()) continue
    const raw = loadJson(full)
    const arr = Array.isArray(raw) ? raw : [raw]
    for (const c of arr) {
      if (!c || typeof c !== 'object') continue
      cases.push({ ...c, _file: entry })
    }
  }
  return cases
}

function runCase(engine, c) {
  const verdict = engine.evaluate(c.subject)
  /** @type {string[]} */
  const errs = []

  if (c.expected && typeof c.expected.overall === 'string') {
    if (verdict.overall !== c.expected.overall) {
      errs.push(`overall=${verdict.overall} expected=${c.expected.overall}`)
    }
  }
  const ids = new Set(verdict.findings.map((f) => f.ruleId))

  if (Array.isArray(c.expected?.containsRuleIds)) {
    for (const want of c.expected.containsRuleIds) {
      if (!ids.has(want)) errs.push(`missing ruleId=${want}`)
    }
  }
  if (Array.isArray(c.expected?.notContainsRuleIds)) {
    for (const not of c.expected.notContainsRuleIds) {
      if (ids.has(not)) errs.push(`unexpected ruleId=${not}`)
    }
  }

  // If expected.overall === 'pass', allow no findings at all (no extra check needed).
  return { verdict, errs }
}

function main() {
  const pack = loadJson(PACK_PATH)
  const engine = createComplianceEngine({ rulePacks: [pack] })
  const cases = loadFixtures(FIXTURES_DIR)

  let passCount = 0
  let failCount = 0
  /** @type {Array<{case:object, errs:string[], verdict:object}>} */
  const failures = []

  for (const c of cases) {
    const { verdict, errs } = runCase(engine, c)
    if (errs.length === 0) passCount++
    else {
      failCount++
      failures.push({ case: c, errs, verdict })
    }
  }

  // Coverage gate: every rule in the pack must be exercised by at least one
  // fixture's `containsRuleIds` entry. Composite-only rules count too.
  const triggered = new Set()
  for (const c of cases) {
    if (Array.isArray(c.expected?.containsRuleIds)) {
      for (const id of c.expected.containsRuleIds) triggered.add(id)
    }
  }
  const allRuleIds = pack.rules.map((r) => r.id)
  const missing = allRuleIds.filter((id) => !triggered.has(id))

  // Summary line — kept compact for runbook quoting.
  const summary = `${allRuleIds.length} rules · ${cases.length} fixtures · ${failCount} failures`
  console.log(summary)

  if (failures.length > 0) {
    console.error('')
    console.error('FAILURES:')
    for (const f of failures) {
      const label = f.case.name || '(unnamed)'
      console.error(`  - [${f.case._file}] ${label} → ${f.errs.join('; ')}`)
      console.error(`    actual.overall=${f.verdict.overall} actual.findings=[${f.verdict.findings.map((x) => x.ruleId).join(', ')}]`)
    }
    process.exit(1)
  }

  if (missing.length > 0) {
    console.error('')
    console.error(`COVERAGE GAP: ${missing.length} rules without a triggering fixture:`)
    for (const id of missing) console.error(`  - ${id}`)
    process.exit(1)
  }

  console.log('coverage: every pack rule is exercised by at least one fixture')
  process.exit(0)
}

try {
  main()
} catch (err) {
  console.error('SMOKE HARNESS CRASHED:', err?.stack || err)
  process.exit(2)
}
