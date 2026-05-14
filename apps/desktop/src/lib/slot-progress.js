/**
 * Slot progress parser.
 *
 * Derives per-slot state from a stream of pipeline log lines emitted by
 * runtime/bin/listing.mjs (which spawns runtime/legacy/agents/master.js +
 * directref-pipeline.js).
 *
 * Tolerant to both pretty pino output and structured JSON-per-line, and to
 * minor message rewording. We look at the `msg` field if the line parses as
 * JSON, otherwise treat the raw line as the message.
 *
 * State values:
 *   idle      — no signal yet
 *   running   — slot has started
 *   done      — slot finished successfully (or checkpoint-skipped)
 *   error     — slot failed
 *   skipped   — slot explicitly skipped via --skip-slots (or "skip" in log)
 */

export const LISTING_SLOT_COUNT = 8

export const LISTING_SLOT_META = [
  { id: 1, role: 'main',            label: 'Hero · white background' },
  { id: 2, role: 'in-use',          label: 'In-use lifestyle' },
  { id: 3, role: 'features',        label: 'Features infographic' },
  { id: 4, role: 'use-case',        label: 'Use case' },
  { id: 5, role: 'size-scale',      label: 'Size · grid' },
  { id: 6, role: 'gift-set',        label: 'Gift / flat-lay' },
  { id: 7, role: 'emotional',       label: 'Emotional moment' },
  { id: 8, role: 'lifestyle-close', label: 'Lifestyle closeup' }
]

function extractMessage(rawLine) {
  if (!rawLine) return ''
  const trimmed = rawLine.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed)
      if (obj && typeof obj.msg === 'string') return obj.msg
    } catch {
      /* fall through */
    }
  }
  return trimmed
}

function slotIdFromMessage(msg) {
  // Accept "[Slot 3] ...", "Slot 3 ...", "slot3 ...", "slot_3 ..."
  const m = msg.match(/(?:\[\s*)?slot[\s_-]*([1-8])\b/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return n >= 1 && n <= 8 ? n : null
}

/**
 * Compute per-slot state from a buffer of log lines.
 *
 * @param {Array<{stream:string, line:string}>} lines
 * @param {{ pendingRegen?: number[], runStatus?: string }} [opts]
 * @returns {Record<number, 'idle'|'running'|'done'|'error'|'skipped'>}
 */
export function deriveSlotStates(lines, opts = {}) {
  /** @type {Record<number, string>} */
  const state = {}
  const pendingRegen = new Set(opts.pendingRegen || [])

  for (const entry of lines || []) {
    const msg = extractMessage(entry.line)
    if (!msg) continue

    // Reset on "cleared" checkpoint message (skip-slots takes effect).
    if (/\[Checkpoint\].*cleared/i.test(msg)) {
      // Try to harvest a slot list from the message (best-effort).
      const ids = [...msg.matchAll(/slot[\s_-]*([1-8])/gi)].map(x => parseInt(x[1], 10))
      for (const id of ids) state[id] = 'idle'
      continue
    }

    const id = slotIdFromMessage(msg)
    if (!id) continue

    if (/\[checkpoint\].*skipping/i.test(msg)) {
      state[id] = 'done'
      continue
    }
    if (/--skip-slots|explicitly skipped/i.test(msg)) {
      state[id] = 'skipped'
      continue
    }
    if (/\berror\b|\bfail(ed|ure)?\b|\bexception\b/i.test(msg)) {
      state[id] = 'error'
      continue
    }
    if (/\b(ok|done|complete[d]?|saved|finished)\b/i.test(msg) || /\bsuccess\b/i.test(msg)) {
      state[id] = 'done'
      continue
    }
    if (/generating|starting|begin|start\b/i.test(msg)) {
      state[id] = 'running'
      continue
    }
    // Unknown but mentions slot → assume running unless already terminal.
    if (!state[id]) state[id] = 'running'
  }

  // Slots queued for regen but with no log event yet are marked running while
  // a run is in flight (so user gets immediate feedback after pressing Run).
  if (opts.runStatus === 'running') {
    for (const id of pendingRegen) {
      if (!state[id] || state[id] === 'idle') state[id] = 'running'
    }
  }

  return state
}

/**
 * Convert UI-facing slot IDs (numbers 1..8) into the `--skip-slots` argv
 * value the legacy runner expects (e.g. "slot2,slot4").
 *
 * Despite the flag's name, the runtime semantics are *regenerate-only-these*:
 * matching progress.json entries are cleared and the listed slots are forced
 * to re-run. Other completed slots are preserved by checkpointResult().
 */
export function regenSlotsToArg(slotIds) {
  const filtered = (slotIds || [])
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 8)
    .sort((a, b) => a - b)
  return filtered.map(n => `slot${n}`)
}
