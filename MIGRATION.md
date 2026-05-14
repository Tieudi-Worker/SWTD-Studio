# UI Refactor v2 — Operator Console

**Date:** 2026-05-14
**Branch:** `ui-refactor-v2-operator-console`
**Scope:** `apps/desktop/` renderer only — IPC, runtime, and packages untouched.

The desktop renderer is rebuilt from a single 800-line `App.jsx` into a
token-driven, component-based shell. The old card-row dashboard is replaced
by a seven-region operator console: TopBar / LeftRail / Stepper / MainCanvas
/ RightInspector / StatusBar / ActivityDrawer. All colors and spacing flow
from `styles/tokens.css`. Phase-1 IPC behavior (workspace pick, brief
validation, listing runs, live pipeline streaming) is preserved verbatim.

## What changed

- **Layout** — Full-viewport CSS Grid with collapsible left rail, hideable
  right inspector, expandable bottom drawer. Geometry is driven by tokens
  (`--leftrail-width`, `--inspector-width`, `--drawer-min-height`,
  `--drawer-max-height`). Layout choices persist to `localStorage` under
  `swtd_ui_layout`.
- **Design tokens** — `styles/tokens.css` is the single source of truth for
  colors, spacing, radii, shadows, and transitions. Step 7 grep verified
  no hex literals appear outside this file (one exception in
  `electron/main.cjs` — see *Open questions* below).
- **Typography** — Inter (UI) + JetBrains Mono (mono) only. The legacy
  Fraunces + Geist font import was removed from `index.html`.
- **Atom library** — `components/atoms/`: `Button`, `IconButton`, `Input`,
  `StatusDot`, `StatusChip`, `EmptyState`. Each accepts a `disabledReason`
  prop that doubles as the tooltip when the element is disabled.
- **Shell components** — `components/shell/`: `TopBar`, `LeftRail`,
  `Stepper`, `MainCanvas`, `RightInspector`, `StatusBar`, `ActivityDrawer`.
- **Stepper** — 5 steps (Intake / Listing / A+ / Video / QC) with
  `done|active|locked|error|running|idle` states, connecting lines that
  light up when the prior step is done, and tooltips on locked/error
  reasons.
- **CommandPalette** — `Cmd/Ctrl+K` opens a 600px modal with four groups
  (Navigation / Actions / SKUs / Settings). Arrow keys + Enter + Esc.
  Disabled commands show their `disabledReason` on hover.
- **Keyboard shortcuts** — `hooks/useKeyboardShortcuts.js` binds:
  - `⌘K` palette · `⌘R` run · `⌘.` cancel
  - `⌘B` sidebar · `⌘\` inspector · `⌘J` activity drawer
  - `⌘O` workspace · `⌘I` revalidate · `⌘/` `Shift+?` palette · `Esc` close
- **Skeletons** — `.skeleton` styles drive the brief-loading placeholder in
  the canvas; `prefers-reduced-motion: reduce` disables animation.
- **Transitions** — All transitions under 250ms (tokens cap at 200ms).

## What was deleted

- `apps/desktop/src/App.jsx` — superseded by `shell/Shell.jsx`.
- `apps/desktop/src/styles.css` — the legacy global stylesheet (5-card row,
  decorative gradients, fraunces serif titles). All replacement styling now
  lives in `styles/{tokens,typography,atoms,shell}.css`.
- Fraunces + Geist font links from `apps/desktop/index.html`.
- Dashed borders on the locked StatusDot, locked StatusChip, and EmptyState
  (now solid + opacity).
- Step-3 placeholder slots in `shell/Shell.jsx` (replaced by real
  components).

## Breaking changes

None. The Electron preload contract (`window.swtd.*`) and runtime IPC
handlers are untouched. State shape (`workspace / skuPath / validation /
listingState`) is unchanged. Layout state in `localStorage` is forward
compatible — old keys are merged through `DEFAULT_LAYOUT`.

## Files touched (this PR, steps 5–7)

```
apps/desktop/electron/main.cjs                         (M) — backgroundColor → token-matched #0A0A0B
apps/desktop/index.html                                (M) — drop Fraunces/Geist font imports
apps/desktop/src/App.jsx                               (D) — delete legacy phase-1 entry
apps/desktop/src/styles.css                            (D) — delete legacy global stylesheet
apps/desktop/src/components/shell/ActivityDrawer.jsx   (A)
apps/desktop/src/components/shell/CommandPalette.jsx   (A)
apps/desktop/src/components/shell/LeftRail.jsx         (A)
apps/desktop/src/components/shell/MainCanvas.jsx       (A)
apps/desktop/src/components/shell/RightInspector.jsx   (A)
apps/desktop/src/components/shell/StatusBar.jsx        (A)
apps/desktop/src/components/shell/Stepper.jsx          (A)
apps/desktop/src/components/shell/TopBar.jsx           (A)
apps/desktop/src/hooks/useKeyboardShortcuts.js         (A)
apps/desktop/src/shell/Shell.jsx                       (M) — wire components, hook, palette
apps/desktop/src/styles/atoms.css                      (M) — solid borders on locked + empty states
apps/desktop/src/styles/shell.css                      (M) — full component styles + palette + reduced-motion
apps/desktop/src/styles/typography.css                 (M) — drop sans-serif/ui-sans-serif from fallback chain
```

Earlier in this branch (steps 1–4): tokens, typography, shell grid scaffold,
and atom library were committed.

## Visual changes

- Background palette darkened to true near-black `#0A0A0B` (was `#0b0d10`),
  matching the operator-dashboard tone established in step 2.
- Active step indicator: 2px gold underline on the current stepper button +
  elevated background; locked steps render at 0.6 opacity.
- Workspace picker moved from full-width pill into the TopBar as a compact
  trigger, leaving room for the global search input (`⌘K`).
- Activity drawer collapses to a 32px header bar with a pulsing dot during
  active runs; expands to 280px with auto-scrolling stream log.
- All locked controls expose a hover tooltip explaining why they are
  disabled (e.g. *"Select a SKU first"*, *"A run is already in progress"*,
  *"A+ ships in a later phase"*).

## Verification

Run from `apps/desktop/`:

```
npm run build:renderer   # vite build — passes (49 modules)
grep -rn serif src/      # → 0 matches
grep -rn italic src/     # → 0 matches
grep -rn dashed src/     # → 0 matches
grep -rn '#' src/        # → only inside styles/tokens.css
```

`npm run lint` is declared but `eslint` is not installed locally — no lint
config exists in this branch yet, so the check is skipped.

## Screenshot

Could not capture in this environment (no headed browser / Playwright
available to the agent during this run). Placeholder path:
`docs/ui-refactor-after.png` — to be added by an operator running the
desktop app locally with `npm run dev` from `apps/desktop/`.

## Open questions

- `electron/main.cjs` still hardcodes `backgroundColor: '#0A0A0B'`. CSS
  variables can't be referenced from the main process, so the value is
  mirrored manually. If the token shifts, this needs a manual sync — flag
  for review whether to extract a JSON token file consumable by both sides.
- `npm run lint` script is declared but ESLint isn't a dev dependency.
  Decide whether to add it (with shared config) or remove the script.
- The CommandPalette currently issues *all* SKUs as flat items. Once the
  workspace grows past ~50 SKUs we should add collection filtering / fuzzy
  ranking; the current substring filter is sufficient for phase 1.
- The Stepper exposes `aplus`, `video`, and `qc` as permanently locked.
  When phase 2 lands, the `stepEntries` derivation in `shell/Shell.jsx`
  needs to consult real per-step state instead of the literal `'locked'`.
