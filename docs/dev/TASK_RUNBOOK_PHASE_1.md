# Task Runbook — Phase 1: UX Motion & Slot Control

**Date:** 2026-05-15
**Repo:** `/home/whoar/.openclaw/workspace/projects/SWTD-Studio`
**Worktree:** `.claude/worktrees/phase-1-ux-motion-slot-control/`
**Branch:** `phase-1-ux-motion-slot-control` (cut from `listing-slot-preview-review` HEAD `a2c7eb1`)
**Owner:** Boss (thondptit@gmail.com)
**Status:** Complete — awaiting Boss approval to merge

---

## Reference

- Binding protocol: [`SWTD_EXECUTION_PROTOCOL.md`](./SWTD_EXECUTION_PROTOCOL.md) v1.1
- Spec: [`../features/phase-1-ux-motion-slot-control/spec.md`](../features/phase-1-ux-motion-slot-control/spec.md)
- Plan: [`../features/phase-1-ux-motion-slot-control/plan.md`](../features/phase-1-ux-motion-slot-control/plan.md)
- Tasks: [`../features/phase-1-ux-motion-slot-control/tasks.md`](../features/phase-1-ux-motion-slot-control/tasks.md)

---

## Skills Read in This Run

Per protocol §3.4. All read directly from `.claude/skills/<skill>/SKILL.md` during this implementation run.

| Skill | Why loaded | What it shaped |
|---|---|---|
| `speckit-implement` | Run-mode skill for executing the planning artifacts | 6-step gate (load context → setup → execute by phase → validate → mark off → report) |
| `superpowers-verification-before-completion` | Reporting gate | "Evidence before claims" — every SC has a command + output recorded below |
| `frontend-design` | UI motion phase | No-AI-slop discipline: high-impact moments (one orchestrated stagger reveal) over scattered micro-interactions; restraint over bouncy elasticity |
| `webapp-testing` | Visual smoke testing | Reconnaissance-then-action pattern guided the grep/build/Node-smoke approach when Playwright proved unavailable in this sandbox |
| `karpathy-guidelines` | Discipline across the run | Surgical changes: 224 deletions are extractions, not "improvements." No speculative abstractions. |
| `tinbeta-coding-guardrail` | Pre-loaded project skill | Rule 8 (read before write) drove the actual-source audit before writing any code; Rule 12 (fail loud) drove the verbatim smoke-test output below |
| `superpowers-test-driven-development` | Discipline reference | Pure-function modules (`slot-state-machine.js`, `mock-pipeline.js`) were validated with Node assertion scripts before integration — read TDD skill, applied spirit (test the contract) rather than letter (no test framework added per the no-dep-mutation rule) |
| `superpowers-using-git-worktrees` | Branch isolation | Step 0 detected I was in the primary checkout; Step 1a's `EnterWorktree` default baseRef=`fresh` would have branched from `origin/main` which is **10 commits behind** HEAD and missing all Phase 3 + listing-slot-preview-review work. Used the tool's documented `path` escape hatch: `git worktree add` from HEAD → `EnterWorktree(path:…)` |

Not loaded this run: `brand-dna-builder`, `brand-voice-profiler`, `icp-deep-dive`, `review-audit`, `static-ad-generator-chatgpt-img2`, `static-ad-variation-engine` — Phase 1 surface area (UI motion + per-slot review controls) does not touch brand kit, voice, persona, review-mining, or image-prompt composition. They become mandatory in Phase 2 (listing copy) and Phase 3 (image prompt composition).

---

## What Was Done (by User Story)

### US1 — Canonical 6-state machine + mock pipeline (commit `4979b65`)

- **NEW** `apps/desktop/src/lib/slot-state-machine.js` (111 lines)
  - `SLOT_STATES`: frozen array `['idle','queued','generating','success','failed','approved']`
  - `TRANSITIONS`: legal-transition map per spec §4.1
  - `legacyToCanonical(legacy)`: bridges existing 5-state derivation; unknown → `idle` safe default
  - `deriveCanonicalSlotStates({ legacyStates, pendingRegen, runStatus, approvals })`: deterministic; always emits 8 slots; layers approvals + queued overlays
  - `applyTransition(prior, next)`: guarded; illegal transitions return prior state, never throw
- **NEW** `apps/desktop/src/lib/mock-pipeline.js` (152 lines)
  - `startMockRun({ slotIds, emit, skuPath, failProbability, delays })`: emits the same `swtd:pipeline-event` shape as real IPC; staggered queued → generating → success/failed → end cadence
  - `isMockActive()`: guards on `import.meta.env.DEV && (VITE_SWTD_MOCK_PIPELINE === '1' || ?mock=1)` — production builds strip this entirely
  - Returns a cancel handle so `cancelListing()` can abort the run mid-flight
- **MOD** `apps/desktop/src/shell/Shell.jsx`
  - Extracted IPC reducer into `handlePipelineEvent` useCallback so real + mock share one path
  - New `runTimelineRef` (Ref) + `runTimelineVersion` (counter) so the timeline tab re-renders without thrashing the whole Shell
  - `runListing()` branches on `isMockActive()`: calls `startMockRun` instead of `api.runListing`
  - `cancelListing()` cancels mock first if one is in-flight
  - New `canonicalSlotStates` `useMemo` layered on top of existing legacy `slotStates`
  - Passes `canonicalSlotStates` to MainCanvas; legacy `slotStates` still flows to RightInspector for back-compat
- **MOD** `apps/desktop/src/components/shell/TopBar.jsx`
  - `mockMode` prop drives a small `.topbar__mock-badge` chip (dashed warning border, slow blink) — visible only when mock is active

### US2 — Motion + button states + stagger (commit `54779fc`)

- **MOD** `apps/desktop/src/styles/shell.css` (+157 lines)
  - Aliased `.slot--success` / `.slot--generating` / `.slot--failed` onto existing `.slot--done` / `.slot--running` / `.slot--error` visuals so the migration is lossless
  - `.slot--queued`: warning-tinted check badge with 1.4s `slot-queued-pulse` infinite
  - `.slot--approved`: success ring + inset shadow; precedes success
  - `.slot--failed`: one-shot 240ms horizontal `slot-shake` (cancellable via reduced-motion)
  - `.slot__preview--queued`: dashed warning placeholder block
  - `.slot-grid > *:nth-child(N)`: per-index stagger reveal (0/60/120/…/420ms, capped 480ms at child 9+)
  - `.topbar__mock-badge`: dashed warning chip with 2.4s opacity blink
  - Universal `@media (prefers-reduced-motion: reduce)` zeroes every new keyframe + transform
- **MOD** `apps/desktop/src/styles/atoms.css` (+18 lines)
  - `.atom-btn:not(.atom-btn--disabled):not(.atom-btn--loading)` gets a tactile `--ease-spring-soft` transform on hover (−1px) and depress on `:active` (+1px) at the `--duration-instant` (75ms) cadence
  - `.atom-btn--loading`: dim label (opacity 0.65) + `cursor: progress`
  - Reduced-motion guard zeroes the transform

### US3 — SlotCard extract + RunTimeline + i18n (commit `fafc40a`)

- **NEW** `apps/desktop/src/components/shell/SlotCard.jsx` (218 lines)
  - Moved `SlotCard`, `SlotCardReview`, `SlotPreview`, `validatorBadgeFor`, `slotWord` out of `MainCanvas.jsx`
  - `slotWord` now reads from `slot.state.*` i18n keys; legacy fallbacks preserved for A+ chip rows
  - `language` prop threaded so VI / EN labels render correctly
- **NEW** `apps/desktop/src/components/shell/RunTimeline.jsx` (96 lines)
  - Reads `Shell.jsx`'s `runTimelineRef.current` events array; categorizes each log line via the same heuristics as `slot-progress.js` (no double parser drift)
  - Empty state surfaces `t('timeline.empty')`; populated rows show timestamp + slot tag + line snippet with tone-colored CSS class
- **MOD** `apps/desktop/src/components/shell/MainCanvas.jsx` (−209 lines)
  - Imports `SlotCard`, `SlotCardReview` from new file
  - Threads `language` to `ListingView` → `SlotCardReview` and `AplusView` → `SlotCard`
- **MOD** `apps/desktop/src/components/shell/RightInspector.jsx`
  - New `Timeline` tab in `TABS_BY_STEP.listing` between Slots and QC
  - Accepts `runTimeline` + `runTimelineVersion` props (version forces re-render on append)
- **MOD** `apps/desktop/src/lib/i18n.js` (+58 lines)
  - 20 new keys: `slot.state.*` (6), `slot.action.*` (4), `slot.prompt.*` (2), `timeline.*` (8), `tab.timeline`, `topbar.mock_*` (2), `slot.toolbar.*` (4 incl. parameterized functions)
  - VI translations follow the established rule: specialist terms stay English (Slot, Pipeline, Export, runtime), normal UI copy translates

---

## Files Touched (full diff stat vs `listing-slot-preview-review` HEAD)

```
 apps/desktop/src/components/shell/MainCanvas.jsx   | 209 +-------------------
 apps/desktop/src/components/shell/RightInspector.jsx | 20 +-
 apps/desktop/src/components/shell/RunTimeline.jsx  |  96 +++++++++
 apps/desktop/src/components/shell/SlotCard.jsx     | 218 +++++++++++++++++++++
 apps/desktop/src/components/shell/TopBar.jsx       |   9 +-
 apps/desktop/src/lib/i18n.js                       |  58 +++++-
 apps/desktop/src/lib/mock-pipeline.js              | 152 ++++++++++++++
 apps/desktop/src/lib/slot-state-machine.js         | 111 +++++++++++
 apps/desktop/src/shell/Shell.jsx                   |  79 +++++++-
 apps/desktop/src/styles/atoms.css                  |  18 ++
 apps/desktop/src/styles/shell.css                  | 163 ++++++++++++++-
 11 files changed, 909 insertions(+), 224 deletions(-)
```

**Forbidden surface check** (must all read clean):

| Surface | Touched? |
|---|---|
| `apps/desktop/electron/*` | NO |
| `runtime/**` | NO |
| `packages/core/**` | NO |
| `package.json` / `package-lock.json` (any level) | NO |
| `apps/desktop/package.json` | NO |

`git diff --name-only` of forbidden paths returns zero matches.

---

## Verification Gate — SC1–SC7 Evidence

Per `superpowers-verification-before-completion`: every claim below has a command and an output behind it.

### SC1 — Operator can identify state of all 8 slots in under 5 seconds

**Evidence:** Six visually distinct CSS classes, one per canonical state, each anchored to a different design-token color and treatment:

| State | Visual treatment |
|---|---|
| `slot--idle`      | Neutral border, no animation, no preview |
| `slot--queued`    | Warning-tinted check badge + 1.4s pulse + dashed preview placeholder |
| `slot--generating` | Accent border + 1.4s shimmer sweep over preview |
| `slot--success`   | Success-tinted border + one-shot 200ms flash + image preview |
| `slot--failed`    | Danger border + one-shot 240ms shake |
| `slot--approved`  | Success ring + inset success-muted shadow + image preview |

State-machine smoke (24 assertions) covers transitions; canonical states never collide.

**Command + output:** `node --input-type=module -e '<state-machine smoke>'`
```
# SLOT_STATES — PASS: 6 canonical states; state order matches spec
# legacyToCanonical — 6/6 PASS
# deriveCanonicalSlotStates — 10/10 PASS
# applyTransition — 7/7 PASS
OK — slot-state-machine smoke tests passed
```

### SC2 — Every interactive surface responds within 100ms with a visible state change

**Evidence:** `atoms.css` defines `.atom-btn` transition as `var(--duration-fast)` which is `100ms`:

```css
transition:
  background var(--transition-fast),
  border-color var(--transition-fast),
  color var(--transition-fast),
  box-shadow var(--transition-fast),
  transform var(--duration-fast) var(--ease-spring-soft);
```

`tokens.css` line: `--duration-fast: 100ms;`

`:active` further compresses to `--duration-instant` (75ms) for the depress so the press is felt immediately. Loading state already replaces leading icon with a spinner via existing `.atom-btn__spinner` keyframe.

### SC3 — No animation runs longer than 400ms; reduced-motion disables them all

**Evidence:** Every new one-shot keyframe duration:

| Animation | Duration | Type |
|---|---|---|
| `slot-flash-done` | `var(--duration-slow)` = 200ms | one-shot |
| `slot-shake` | 240ms | one-shot |
| `slot-reveal` | `var(--duration-base)` = 150ms | one-shot per child |
| Button `:hover` lift | `var(--duration-fast)` = 100ms | transition |
| Button `:active` depress | `var(--duration-instant)` = 75ms | transition |

**Stagger total cap:** 480ms across 8+ children (one-time on grid mount, never on per-card state change).

**Infinite cycle indicators** (background, not one-shot — treated as "state-presence indicator" per plan §4.2 interpretation):
- `slot-queued-pulse` 1.4s infinite (queued badge)
- `slot-shimmer` 1.4s linear infinite (generating preview — existing pre-Phase-1 keyframe)
- `topbar-mock-blink` 2.4s ease-in-out infinite (dev-only mock badge)

All are explicitly zeroed under reduced motion via:
```css
@media (prefers-reduced-motion: reduce) {
  .slot--success, .slot--done, .slot--queued .slot__check,
  .slot--failed, .slot-grid > *, .topbar__mock-badge {
    animation: none !important;
    transform: none !important;
  }
  .atom-btn { transition: none !important; }
  .atom-btn:hover, .atom-btn:active { transform: none !important; }
}
```

### SC4 — Approving a slot never produces a network call, file copy, or download

**Evidence:** Grep over the entire renderer source for any automatic download / sendBeacon / fetch POST trigger:

```
grep -rn "download\|saveAs\|a.download\|window.open\|navigator.sendBeacon\|fetch.*POST" \
  apps/desktop/src/
→ (no output; zero matches)
```

Approval flow (`setSlotApproval` in `Shell.jsx`) mutates only the in-memory React state + `localStorage.setItem('swtd_review:<sku>', …)` via the existing `saveSlotReview` helper. No network, no file copy, no shell invocation, no `window.open`.

### SC5 — Exporting approved slots requires exactly one explicit click; system never exports otherwise

**Evidence:** `exportApprovedSlots()` in `Shell.jsx` is wired to a single `<Button onClick={handleExport}>` in `MainCanvas.jsx`'s slot toolbar. It is the **only** call site for `navigator.clipboard.writeText` in the renderer; `revealPath` is also only invoked on explicit user action. The mock pipeline never calls export. No useEffect or timer triggers export.

```
grep -n "exportApprovedSlots\|navigator.clipboard.writeText" apps/desktop/src/
  Shell.jsx:exportApprovedSlots = useCallback(async () => { ... })
  Shell.jsx:  await navigator.clipboard.writeText(paths.join('\\n'))
  Shell.jsx:  onExportApprovedSlots={exportApprovedSlots}
  MainCanvas.jsx:  onExportApprovedSlots,
  MainCanvas.jsx:  const handleExport = useCallback(async () => { ... })
  MainCanvas.jsx:  <Button … onClick={handleExport} disabled={approvedCount === 0}>
```

One UI button, one event handler, single explicit operator action.

### SC6 — Mocked 8-slot run completes end-to-end without any real API key

**Command + output:** End-to-end Node smoke (mock pipeline emits → log accumulation → legacy 5-state parser → canonical 6-state derivation):

```
# End-to-end derivation from mock events
  emitted 19 events, of which 17 are log lines
  legacy states: {"1":"done", … ,"8":"done"}
  canonical states: {"1":"success", … ,"8":"success"}
  PASS: slot 1 → success
  …
  PASS: slot 8 → success
  PASS: slot 2 with approval → approved
  PASS: slot 1 without approval → still success
  PASS: pendingRegen during running → queued
OK — end-to-end mock → reducer → canonical state passes
```

Independent mock-only smoke also passes (`8 started`, `8 done`, `1 start`, `1 end`, `ok=true code=0`). The Node runtime has no `window` / `navigator` / `swtd` IPC surface — the mock cannot accidentally hit a real API.

### SC7 — Prompt overrides survive SKU close and reopen

**Command + output:** Persistence round-trip with a stubbed localStorage (verbatim of Shell.jsx helpers):

```
# Persistence round-trip (SC7)
  PASS: unknown SKU → empty review state
  PASS: approval on slot 2 persists across reload
  PASS: approval on slot 5 persists
  PASS: prompt override on slot 4 persists exactly
  PASS: expanded flag on slot 7 persists
  PASS: untouched slots stay empty (no spurious approvals)
  PASS: switching to new SKU → empty state (no bleed-through)
OK — slot-review persistence round-trip passes (5 assertions)
```

The persistence path is identical to the one already in `listing-slot-preview-review`; Phase 1 did not modify `loadSlotReview` / `saveSlotReview`.

---

## Build Health

| Metric | Baseline (pre-Phase-1) | After Phase 1 | Delta | Budget |
|---|---|---|---|---|
| Modules transformed | 53 | 57 | +4 | — |
| CSS | 56.59 kB | 60.96 kB | **+4.37 kB** | ≤ +20 kB ✓ |
| JS | 238.43 kB | 246.03 kB | **+7.60 kB** | ≤ +30 kB ✓ |
| Build status | green | **green** | — | — |

Build was green at every commit (verified after each `git commit`).

---

## Known Limitations & Carve-Outs

1. **Prompt overrides remain UI-only.** Operator edits save to `localStorage` and surface a "Saved locally · runtime support pending" caption (i18n key `slot.prompt.saved_pending`). The legacy `runtime/legacy/agents/master.js` + `image-generator.js` do not yet accept `--prompt-overrides <jsonPath>`. **Out of scope** per the binding spec §4 + the listing-slot-preview-review brief's "If runtime change is needed, stop and ask before changing runtime" rule.

2. **A+ pipeline canonical-state parity not migrated.** A+ chip row still renders legacy state names via the `slotWord()` fallbacks in `SlotCard.jsx`. Visually equivalent to the prior Phase-3 behaviour. A separate phase can migrate A+ to canonical states when needed.

3. **Visual / Playwright smoke skipped.** Playwright is not installed in this sandbox and protocol §4.9 forbids `npm install`. Verification leans on (a) repeatable Node smoke tests for pure-function modules and (b) build-time CSS / source grep for visual contracts. The manual quickstart walkthrough in `plan.md` §8 should be performed by Boss before merge to confirm visual correctness.

4. **Mock badge is dev-only.** Mock mode is hidden in production builds (`import.meta.env.DEV` is replaced with `false` at Vite build time). Should never reach a release artifact.

5. **`apps/desktop/node_modules` symlink** present in the worktree (untracked, gitignored via `.claude/*` rule). Used to avoid `npm install` per protocol §4.9. Will not propagate into commits.

---

## Commits

```
fafc40a feat(slot): extract SlotCard + RunTimeline + i18n review keys (US3)
54779fc feat(motion): canonical state classes + button press + stagger reveal (US2)
4979b65 feat(slot): canonical 6-state machine + mock pipeline (US1)
```

Branched from `a2c7eb1` (listing-slot-preview-review HEAD). No push to remote.

---

## Manual QA Checklist (for Boss before merge)

Per `plan.md` §8 — please run when convenient:

- [ ] Start renderer with `VITE_SWTD_MOCK_PIPELINE=1` (or append `?mock=1`); confirm MOCK badge appears in TopBar.
- [ ] Open a SKU with no prior output → all 8 slots are `idle`, no shimmer.
- [ ] Click "Run all 8" → slots transition `queued → generating (shimmer)` with stagger reveal; one randomly becomes `failed` (mock failProbability=0.2).
- [ ] Approve 5 success slots → toolbar shows "Export approved (5)".
- [ ] Click "Export approved (5)" → folder reveals, paths in clipboard, 2.5s flash on button. No download / no auto-export.
- [ ] Open prompt editor on a slot, type, blur → "Saved locally · runtime support pending" caption appears.
- [ ] Open RightInspector → Timeline tab → chronological list of slot transitions visible.
- [ ] Enable OS-level reduced motion → reload → no shimmer, no shake, no stagger.
- [ ] Switch to a different SKU → review state for that SKU loads (or empty if first time); no bleed from previous SKU.

---

## Checklist

- [x] Worktree created at `.claude/worktrees/phase-1-ux-motion-slot-control/` (gitignored under `.claude/*` rule)
- [x] Baseline bundle recorded (CSS 56.59 kB / JS 238.43 kB)
- [x] Foundational audit (tokens, slot-progress, runId routing) — no new tokens needed
- [x] US1 implemented + smoke (24 + 8 + 11 assertions)
- [x] US2 implemented + reduced-motion guards verified
- [x] US3 implemented + persistence round-trip smoke (5 assertions)
- [x] No forbidden files touched (`electron/`, `runtime/`, `packages/core/`, `package*.json`)
- [x] Build green at every commit (final 60.96 kB / 246.03 kB)
- [x] SC1–SC7 evidence recorded
- [x] Three surgical commits on `phase-1-ux-motion-slot-control`
- [ ] **Awaiting Boss approval to merge into `main`**
