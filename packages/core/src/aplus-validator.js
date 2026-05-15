import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

/**
 * A+ Premium has 5 modules per SKU. IDs are m1..m5 to match the runtime's
 * `--skip-slots aplus_m1,...` argv convention.
 *
 * Roles are based on the standard 1464×600 Amazon A+ Premium layout:
 *   m1 — hero            (top banner / brand statement)
 *   m2 — feature deck I
 *   m3 — feature deck II
 *   m4 — feature deck III
 *   m5 — comparison / CTA
 */
const MODULE_ROLES = {
  1: 'hero',
  2: 'feature-1',
  3: 'feature-2',
  4: 'feature-3',
  5: 'cta'
}

const EXPECTED_WIDTH = 1464
const EXPECTED_HEIGHT = 600
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp']

function safeRequireSharp(runtimeRoot) {
  // Same fallback chain as listing-validator: prefer the sharp shipped with
  // the legacy runtime, fall back to the desktop package's own resolver.
  if (runtimeRoot) {
    try {
      const req = createRequire(path.join(runtimeRoot, 'legacy', 'package.json'))
      return req('sharp')
    } catch {
      /* fall through */
    }
  }
  try {
    const req = createRequire(import.meta.url)
    return req('sharp')
  } catch {
    return null
  }
}

/**
 * Tolerant file picker for one module under `output/aplus/`. The legacy A+
 * runtime's exact filename convention is not yet pinned in this repo, so we
 * try every reasonable pattern: `aplus_mN_*`, `mN_*`, `module-N*`, and
 * `module-0N*`. Skip `_raw` intermediates the pipeline may leave behind.
 */
function pickModuleFile(aplusDir, moduleNum) {
  if (!fs.existsSync(aplusDir)) return null
  let entries
  try {
    entries = fs.readdirSync(aplusDir)
  } catch {
    return null
  }
  const role = MODULE_ROLES[moduleNum]
  const padded = String(moduleNum).padStart(2, '0')
  const patterns = [
    `aplus_m${moduleNum}_`,
    `aplus_module${moduleNum}_`,
    `aplus_module-${moduleNum}_`,
    `aplus_module-${padded}_`,
    `m${moduleNum}_`,
    `module-${moduleNum}_`,
    `module-${padded}_`,
    `module_${moduleNum}_`
  ]
  const candidates = entries
    .filter(name => {
      const lower = name.toLowerCase()
      if (lower.includes('_raw')) return false
      const ext = path.extname(lower)
      if (!ALLOWED_EXT.includes(ext)) return false
      return patterns.some(p => lower.includes(p))
    })
    .sort((a, b) => {
      // Prefer files that also name the canonical role suffix.
      const ar = a.toLowerCase().includes(role) ? 0 : 1
      const br = b.toLowerCase().includes(role) ? 0 : 1
      return ar - br
    })
  return candidates[0] ? path.join(aplusDir, candidates[0]) : null
}

async function inspectImage(sharp, filePath) {
  if (!sharp) {
    return { width: null, height: null, checked: false, reason: 'sharp not available' }
  }
  try {
    const meta = await sharp(filePath).metadata()
    return {
      width: meta.width ?? null,
      height: meta.height ?? null,
      checked: true,
      reason: null
    }
  } catch (err) {
    return { width: null, height: null, checked: false, reason: err.message || String(err) }
  }
}

/**
 * Validate A+ Premium output for a SKU folder.
 *
 * Reads local files only — never makes API calls.
 *
 * @param {object} opts
 * @param {string} opts.skuPath       Absolute path to the SKU folder.
 * @param {string} [opts.runtimeRoot] Optional override for sharp lookup.
 * @returns {Promise<{
 *   ok: boolean,
 *   aplusDir: string,
 *   aplusDirExists: boolean,
 *   modules: Array<{
 *     module: number,
 *     role: string,
 *     file: string|null,
 *     exists: boolean,
 *     width: number|null,
 *     height: number|null,
 *     dimensionsChecked: boolean,
 *     dimensionsOk: boolean|null,
 *     dimensionsReason: string|null
 *   }>,
 *   missing: number[],
 *   invalidDims: number[],
 *   summary: {
 *     found: number,
 *     missing: number,
 *     dimsOk: number,
 *     dimsBad: number,
 *     dimsUnchecked: number,
 *     sharpAvailable: boolean,
 *     expectedWidth: number,
 *     expectedHeight: number
 *   }
 * }>}
 */
export async function validateAplusOutput({ skuPath, runtimeRoot }) {
  if (!skuPath || typeof skuPath !== 'string') {
    throw new Error('skuPath required')
  }
  const aplusDir = path.join(skuPath, 'output', 'aplus')
  const aplusDirExists = fs.existsSync(aplusDir)
  const sharp = safeRequireSharp(runtimeRoot)

  const modules = []
  const missing = []
  const invalidDims = []

  for (let n = 1; n <= 5; n++) {
    const role = MODULE_ROLES[n]
    const file = aplusDirExists ? pickModuleFile(aplusDir, n) : null
    const exists = !!file && fs.existsSync(file)

    if (!exists) {
      missing.push(n)
      modules.push({
        module: n,
        role,
        file: null,
        exists: false,
        width: null,
        height: null,
        dimensionsChecked: false,
        dimensionsOk: null,
        dimensionsReason: 'file missing'
      })
      continue
    }

    const probe = await inspectImage(sharp, file)
    let dimensionsOk = null
    if (probe.checked) {
      dimensionsOk = probe.width === EXPECTED_WIDTH && probe.height === EXPECTED_HEIGHT
      if (!dimensionsOk) invalidDims.push(n)
    }
    modules.push({
      module: n,
      role,
      file,
      exists: true,
      width: probe.width,
      height: probe.height,
      dimensionsChecked: probe.checked,
      dimensionsOk,
      dimensionsReason: probe.reason
    })
  }

  const found = modules.filter(m => m.exists).length
  const dimsOk = modules.filter(m => m.dimensionsOk === true).length
  const dimsBad = invalidDims.length
  const dimsUnchecked = modules.filter(m => m.exists && !m.dimensionsChecked).length

  return {
    ok: missing.length === 0 && invalidDims.length === 0,
    aplusDir,
    aplusDirExists,
    modules,
    missing,
    invalidDims,
    summary: {
      found,
      missing: missing.length,
      dimsOk,
      dimsBad,
      dimsUnchecked,
      sharpAvailable: !!sharp,
      expectedWidth: EXPECTED_WIDTH,
      expectedHeight: EXPECTED_HEIGHT
    }
  }
}
