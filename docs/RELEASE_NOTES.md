# SWTD-Studio Release Notes

## 2026-05-14 — Operator Console UI Refactor v2

### Summary
Merged the spec-driven Operator Console UI refactor into `main`.

### Highlights
- Replaced monolithic UI with 3-column operator shell.
- Added design token system: `tokens.css`, `typography.css`.
- Added atom component library: Button, IconButton, StatusDot, StatusChip, Input, EmptyState.
- Added shell components: TopBar, LeftRail, Stepper, MainCanvas, RightInspector, StatusBar, ActivityDrawer, CommandPalette.
- Added keyboard shortcut hook and command palette.
- Added `MIGRATION.md` documenting changes and migration notes.
- Fixed Boss review violations:
  - Stepper horizontal overflow removed.
  - Native Electron File/Edit/View menu hidden.
  - LeftRail COLLECTIONS section added.
  - RightInspector restored BRIEF / VALIDATION / HISTORY tabs.

### Verification
- `npm run build:renderer` passed.
- `grep serif` in `apps/desktop/src`: 0.
- `grep font-style: italic`: 0.
- `grep dashed`: 0.

### Head Commit
`1571be9 fix(ui): address operator-console spec review violations`
