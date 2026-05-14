# DESIGN.md — SWTD Studio Operator Console

This file defines the canonical UI style for SWTD Studio so coding agents can generate consistent interfaces.

## Purpose
SWTD Studio is a production operator tool for Amazon media workflows (Listing 8 slots, A+ 5 modules, Video 12–15s). It must optimize speed, clarity, and operational control for long work sessions.

## Design Intent
- Operator-first, not marketing-first.
- Dense, information-rich, low-noise UI.
- Fast visual parsing: current SKU, current phase, blockers, next action.
- Strong dark theme with restrained accent usage.

## Layout Grammar
- 3-column shell:
  - Left rail: SKU navigation + collections + quick filters.
  - Main canvas: step content, slot grid, logs, validation status.
  - Right inspector: contextual details, actions, brief health, run state.
- Top bar fixed (status, search, workspace).
- Bottom status line for command hints and run summary.
- Optional activity drawer for detailed logs.

## Visual Language
- Tone: serious engineering console.
- Radius: small (4–8px), avoid soft rounded consumer feel.
- Spacing: tight but readable (high density).
- Borders: subtle separators; avoid decorative framing.
- Typography:
  - UI: Inter (400/500/600)
  - Mono: JetBrains Mono for IDs/logs/run metadata
  - No serif display typography.

## Color Discipline
- Primary surfaces from token system in `src/styles/tokens.css`.
- Accent color reserved for current active action/state.
- Semantic colors only for state clarity:
  - Success: done/ready
  - Warning: running/attention
  - Danger: error/blocking
  - Info: neutral process notices
- Avoid gradient-heavy marketing aesthetics for core app screens.

## Interaction Rules
- Every disabled action must explain why (tooltip/reason text).
- Locked phases must state unlock condition.
- Keyboard-first operation is preferred:
  - Cmd/Ctrl+K, Cmd/Ctrl+R, Cmd/Ctrl+., Cmd/Ctrl+B, Cmd/Ctrl+\, Cmd/Ctrl+J, etc.
- Keep transitions snappy (<250ms), no flashy motion.

## Content Priority
On first glance (<3s), user must understand:
1. Which SKU is active
2. Which phase is active
3. Whether generation is running/paused/blocked
4. What next action is required

## Current Reference Aesthetics
Blend of:
- Linear-like density and hierarchy
- Vercel-like dark precision
- Raycast-like quick navigation ergonomics
- VoltAgent-like operator dashboard tonality

## Anti-patterns (forbidden)
- Marketing hero composition inside core app views
- Large empty whitespace with low information density
- Decorative gradients as primary content background
- Ambiguous status labels without actionable meaning
- Silent failure states

## Implementation Notes
- Follow `PLAYBOOK.md` routing for coding tasks.
- Use existing atom/shell components first; extend surgically.
- Keep business logic in IPC/core layers unchanged unless explicitly required.
