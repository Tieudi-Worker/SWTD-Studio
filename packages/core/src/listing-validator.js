import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const SLOT_ROLES = {
  1: 'main',
  2: 'in-use',
  3: 'features',
  4: 'use-case',
  5: 'size-scale',
  6: 'gift-set',
  7: 'emotional',
  8: 'lifestyle-close'
}

const EXPECTED_DIM = 2000
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp']

function safeRequireSharp(runtimeRoot) {
  // Prefer the sharp shipped alongside the legacy runtime (already pinned at
  // ^0.33.5) to avoid forcing the desktop app to bundle its own native binary.
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

function pickSlotFile(listingDir, slotNum) {
  if (!fs.existsSync(listingDir)) return null
  let entries
  try {
    entries = fs.readdirSync(listingDir)
  } catch {
    return null
  }
  const role = SLOT_ROLES[slotNum]
  const tag = `_slot${slotNum}_`
  // Prefer files matching the canonical role suffix, then any file with the
  // `_slotN_` tag, ignoring `_raw` intermediates the pipeline cleans up.
  const candidates = entries
    .filter(name => {
      const lower = name.toLowerCase()
      if (!lower.includes(tag)) return false
      if (lower.includes('_raw')) return false
      const ext = path.extname(lower)
      return ALLOWED_EXT.includes(ext)
    })
    .sort((a, b) => {
      const ar = a.toLowerCase().includes(`_slot${slotNum}_${role}`) ? 0 : 1
      const br = b.toLowerCase().includes(`_slot${slotNum}_${role}`) ? 0 : 1
      return ar - br
    })
  return candidates[0] ? path.join(listingDir, candidates[0]) : null
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
 * Validate listing output for a SKU folder.
 *
 * Reads local files only — never makes API calls.
 *
 * @param {object} opts
 * @param {string} opts.skuPath        Absolute path to the SKU folder.
 * @param {string} [opts.runtimeRoot]  Optional override for sharp lookup.
 * @returns {Promise<{
 *   ok: boolean,
 *   listingDir: string,
 *   listingDirExists: boolean,
 *   slots: Array<{
 *     slot: number,
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
 *   summary: { found: number, missing: number, dimsOk: number, dimsBad: number, dimsUnchecked: number, sharpAvailable: boolean }
 * }>}
 */
export async function validateListingOutput({ skuPath, runtimeRoot }) {
  if (!skuPath || typeof skuPath !== 'string') {
    throw new Error('skuPath required')
  }
  const listingDir = path.join(skuPath, 'output', 'listing')
  const listingDirExists = fs.existsSync(listingDir)
  const sharp = safeRequireSharp(runtimeRoot)

  const slots = []
  const missing = []
  const invalidDims = []

  for (let n = 1; n <= 8; n++) {
    const role = SLOT_ROLES[n]
    const file = listingDirExists ? pickSlotFile(listingDir, n) : null
    const exists = !!file && fs.existsSync(file)

    if (!exists) {
      missing.push(n)
      slots.push({
        slot: n,
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
      dimensionsOk = probe.width === EXPECTED_DIM && probe.height === EXPECTED_DIM
      if (!dimensionsOk) invalidDims.push(n)
    }
    slots.push({
      slot: n,
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

  const found = slots.filter(s => s.exists).length
  const dimsOk = slots.filter(s => s.dimensionsOk === true).length
  const dimsBad = invalidDims.length
  const dimsUnchecked = slots.filter(s => s.exists && !s.dimensionsChecked).length

  return {
    ok: missing.length === 0 && invalidDims.length === 0,
    listingDir,
    listingDirExists,
    slots,
    missing,
    invalidDims,
    summary: {
      found,
      missing: missing.length,
      dimsOk,
      dimsBad,
      dimsUnchecked,
      sharpAvailable: !!sharp
    }
  }
}
