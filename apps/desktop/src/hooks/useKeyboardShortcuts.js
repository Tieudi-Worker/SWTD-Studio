import { useEffect, useRef } from 'react'

/**
 * useKeyboardShortcuts
 *
 * Bind keyboard shortcuts to handlers. Keys are normalized strings:
 *
 *   - "mod+k"     → Cmd+K on macOS, Ctrl+K elsewhere
 *   - "mod+\\"    → Cmd+\ / Ctrl+\
 *   - "shift+?"   → Shift+? (no modifier required)
 *   - "escape"    → Escape
 *
 * Multi-key chords are not supported. Handlers receive the original event;
 * the hook calls `preventDefault()` for any matched binding to keep browser
 * defaults out of the way.
 *
 * Shortcuts are skipped when focus is inside an editable element (input,
 * textarea, contenteditable) — except for "mod+k" and "escape", which always
 * dispatch so the palette can be opened/closed even while typing.
 *
 * @param {Record<string, (e: KeyboardEvent) => void>} bindings
 * @param {{ enabled?: boolean }} [options]
 */
export default function useKeyboardShortcuts(bindings, options = {}) {
  const { enabled = true } = options
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings

  useEffect(() => {
    if (!enabled) return

    function onKey(e) {
      const combo = normalizeEvent(e)
      if (!combo) return
      const handler = bindingsRef.current[combo]
      if (!handler) return
      if (isEditable(e.target) && !ALWAYS_FIRES.has(combo)) return
      e.preventDefault()
      handler(e)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

const ALWAYS_FIRES = new Set(['mod+k', 'escape'])

function normalizeEvent(e) {
  const parts = []
  const mod = e.metaKey || e.ctrlKey
  if (mod) parts.push('mod')
  if (e.shiftKey) parts.push('shift')
  if (e.altKey)   parts.push('alt')

  const key = (e.key || '').toLowerCase()
  // Map by Unicode key, not e.code, so Cmd+. / Cmd+? work on any layout.
  if (key === 'escape') return 'escape'
  if (key === ' ')      return parts.concat('space').join('+')
  if (key === '/')      return parts.concat('/').join('+')
  if (key === '?')      return parts.concat('?').join('+')
  if (key === '.')      return parts.concat('.').join('+')
  if (key === '\\')     return parts.concat('\\').join('+')

  if (parts.length === 0) return null

  if (key.length === 1) return parts.concat(key).join('+')
  return null
}

function isEditable(el) {
  if (!el) return false
  const tag = (el.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}
