#!/usr/bin/env node
// Deterministic check for apps/desktop/electron/sku-discovery.cjs.
//
// Builds synthetic workspace layouts under a temp dir and asserts the
// discoverSkus() output for each. Exits non-zero on any failure.
//
// Run:   node scripts/check-sku-discovery.cjs

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const { discoverSkus } = require('../apps/desktop/electron/sku-discovery.cjs')

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'swtd-sku-check-'))

function mkdir(p) { fs.mkdirSync(p, { recursive: true }) }
function writeFile(p, content) {
  mkdir(path.dirname(p))
  fs.writeFileSync(p, content)
}

// ── Fixtures ────────────────────────────────────────────────────────────────
// 1) parent workspace with two valid SKUs and noise folders
const parent = path.join(ROOT, 'parent-ws')
mkdir(parent)
writeFile(path.join(parent, 'SKU-A', 'brief.json'), '{}')
writeFile(path.join(parent, 'SKU-B', 'input', 'product', 'hero.png'), 'x')
mkdir(path.join(parent, 'research'))                  // helper folder, no brief
mkdir(path.join(parent, 'tmp'))                       // helper folder, no brief
mkdir(path.join(parent, '.git'))                      // hidden, must skip
writeFile(path.join(parent, 'notes.md'), 'hi')        // file, not a dir
mkdir(path.join(parent, '.cache', 'input', 'product')) // hidden parent, must skip even with valid shape

// 2) single-SKU workspace (brief.json at root)
const single = path.join(ROOT, 'single-ws')
writeFile(path.join(single, 'brief.json'), '{}')
mkdir(path.join(single, 'research'))                  // sibling helper — must NOT be listed

// 3) single-SKU workspace via input/product (no brief)
const singleByProduct = path.join(ROOT, 'single-by-product')
mkdir(path.join(singleByProduct, 'input', 'product'))

// 4) empty / unrelated folder
const empty = path.join(ROOT, 'empty-ws')
mkdir(path.join(empty, 'random'))
mkdir(path.join(empty, 'docs'))

// 5) missing path
const missing = path.join(ROOT, 'does-not-exist')

// 6) input/product as a FILE, not a directory — must NOT be classified as SKU
const falsePositive = path.join(ROOT, 'false-positive')
mkdir(path.join(falsePositive, 'input'))
writeFile(path.join(falsePositive, 'input', 'product'), 'this is a file')

// ── Assertions ──────────────────────────────────────────────────────────────
const failures = []
function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    failures.push(`✗ ${name}\n    expected: ${e}\n    actual:   ${a}`)
  } else {
    console.log(`✓ ${name}`)
  }
}

;(async () => {
  const r1 = await discoverSkus(parent)
  check('parent-ws: mode=parent, 2 items, names sorted, briefs flagged',
    { ok: r1.ok, mode: r1.mode, names: r1.items.map(i => i.name), briefs: r1.items.map(i => i.hasBrief) },
    { ok: true, mode: 'parent', names: ['SKU-A', 'SKU-B'], briefs: [true, false] }
  )

  const r2 = await discoverSkus(single)
  check('single-ws: mode=single, one item, hasBrief=true',
    { ok: r2.ok, mode: r2.mode, count: r2.items.length, hasBrief: r2.items[0]?.hasBrief },
    { ok: true, mode: 'single', count: 1, hasBrief: true }
  )

  const r3 = await discoverSkus(singleByProduct)
  check('single-by-product: mode=single, hasBrief=false',
    { ok: r3.ok, mode: r3.mode, count: r3.items.length, hasBrief: r3.items[0]?.hasBrief },
    { ok: true, mode: 'single', count: 1, hasBrief: false }
  )

  const r4 = await discoverSkus(empty)
  check('empty-ws: mode=empty, no items',
    { ok: r4.ok, mode: r4.mode, count: r4.items.length },
    { ok: true, mode: 'empty', count: 0 }
  )

  const r5 = await discoverSkus(missing)
  check('missing path: ok=false',
    { ok: r5.ok, items: r5.items.length },
    { ok: false, items: 0 }
  )

  const r6 = await discoverSkus(falsePositive)
  // input/product is a file, not a dir → not a SKU; folder has nothing else → empty parent
  check('false-positive (input/product is a file): not classified as SKU',
    { ok: r6.ok, mode: r6.mode, count: r6.items.length },
    { ok: true, mode: 'empty', count: 0 }
  )

  // Cleanup
  fs.rmSync(ROOT, { recursive: true, force: true })

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed:\n` + failures.join('\n'))
    process.exit(1)
  }
  console.log('\nAll SKU discovery checks passed.')
})().catch(err => {
  fs.rmSync(ROOT, { recursive: true, force: true })
  console.error(err)
  process.exit(1)
})
