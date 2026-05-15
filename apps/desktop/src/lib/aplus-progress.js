/**
 * A+ module progress parser.
 *
 * Mirrors apps/desktop/src/lib/slot-progress.js but for A+ Premium's
 * 5-module run path. Derives per-module state from the log stream
 * emitted by runtime/bin/aplus.mjs (which calls master.js with
 * --only aplus via the same legacy bridge listing uses).
 *
 * Tolerant to both pino-pretty and JSON-per-line, and to wording
 * variations ("Module 3", "module-3", "m3", "aplus_m3").
 *
 * State values:
 *   idle      — no signal yet
 *   running   — module has started
 *   done      — module finished successfully
 *   error     — module failed
 *   skipped   — module explicitly skipped via --skip-slots
 */

export const APLUS_MODULE_COUNT = 5

export const APLUS_MODULE_META = [
  { id: 1, role: 'hero',      label: 'M1 · Hero banner' },
  { id: 2, role: 'feature-1', label: 'M2 · Feature deck I' },
  { id: 3, role: 'feature-2', label: 'M3 · Feature deck II' },
  { id: 4, role: 'feature-3', label: 'M4 · Feature deck III' },
  { id: 5, role: 'cta',       label: 'M5 · Comparison / CTA' }
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

function moduleIdFromMessage(msg) {
  // Accept "Module 3", "[Module 3]", "module-3", "module_3", "m3", "aplus_m3"
  const m = msg.match(/(?:aplus[_-])?(?:\[\s*)?(?:module[\s_-]*|m)([1-5])\b/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return n >= 1 && n <= 5 ? n : null
}

/**
 * Compute per-module state from a buffer of log lines.
 *
 * @param {Array<{stream:string, line:string}>} lines
 * @param {{ pendingRegen?: number[], runStatus?: string }} [opts]
 * @returns {Record<number, 'idle'|'running'|'done'|'error'|'skipped'>}
 */
export function deriveAplusStates(lines, opts = {}) {
  /** @type {Record<number, string>} */
  const state = {}
  const pendingRegen = new Set(opts.pendingRegen || [])

  for (const entry of lines || []) {
    const msg = extractMessage(entry.line)
    if (!msg) continue

    if (/\[Checkpoint\].*cleared/i.test(msg)) {
      const ids = [...msg.matchAll(/(?:aplus[_-])?(?:module[\s_-]*|m)([1-5])/gi)].map(x => parseInt(x[1], 10))
      for (const id of ids) state[id] = 'idle'
      continue
    }

    const id = moduleIdFromMessage(msg)
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
    if (!state[id]) state[id] = 'running'
  }

  if (opts.runStatus === 'running') {
    for (const id of pendingRegen) {
      if (!state[id] || state[id] === 'idle') state[id] = 'running'
    }
  }

  return state
}

/**
 * Convert UI module IDs (1..5) into the `--skip-slots` argv value the legacy
 * runner expects — e.g. ["aplus_m2", "aplus_m4"].
 *
 * Despite the flag name, the runtime semantics are *regenerate-only-these*:
 * matching checkpoint entries are cleared and the listed modules are forced
 * to re-run. Completed modules outside the list stay in place.
 */
export function regenModulesToArg(moduleIds) {
  const filtered = (moduleIds || [])
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 5)
    .sort((a, b) => a - b)
  return filtered.map(n => `aplus_m${n}`)
}
