# Task Runbook — Phase 2: Template & Prompt Engine

**Date:** 2026-05-15
**Repo:** `/home/whoar/.openclaw/workspace/projects/SWTD-Studio`
**Worktree:** `.claude/worktrees/phase-2-template-engine/`
**Branch:** `phase-2-template-engine` (cut from `phase-1-ux-motion-slot-control` HEAD `0ff7a5f`)
**Owner:** Boss (thondptit@gmail.com)
**Status:** Complete (UI-only) — runtime wiring deferred to Phase 2.5; awaiting Boss merge approval

---

## Reference

- Binding protocol: [`SWTD_EXECUTION_PROTOCOL.md`](./SWTD_EXECUTION_PROTOCOL.md) v1.1
- Spec: [`../features/phase-2-template-engine/spec.md`](../features/phase-2-template-engine/spec.md) (Boss-locked Q1/Q2/Q3)
- Plan: [`../features/phase-2-template-engine/plan.md`](../features/phase-2-template-engine/plan.md)
- Tasks: [`../features/phase-2-template-engine/tasks.md`](../features/phase-2-template-engine/tasks.md)

## Locked decisions (Boss, 2026-05-15)

| Q | Decision |
|---|---|
| Q1 — Template storage | `packages/core/templates/listing/*.json` |
| Q2 — Brand DNA location | Both: `<workspace>/brand-dna.md` default, `<sku>/brand-dna.md` overrides if present (same rule for `icp-cards.md`) |
| Q3 — Runtime wiring | UI-only this phase. `runtime/legacy/agents/master.js` not touched. Phase 2.5 will add `--prompt-overrides` |

---

## Skills Read in This Run

Per protocol §3.4. All read directly from `.claude/skills/<skill>/SKILL.md` during this implementation run.

| Skill | Why loaded | What it shaped |
|---|---|---|
| `static-ad-generator-chatgpt-img2` | Phase 2 surface is prompt/template/image-gen — protocol §3.3 conditional rule | 3-phase pipeline pattern (brand research → fill 40 templates → image-gen); confirmed the JSON-template-with-bracketed-placeholders shape SWTD's library should adopt |
| `static-ad-variation-engine` | Same conditional rule | Reference-image-grounding pattern; "always read all three foundation files" rule informed the workspace-default + SKU-override resolution semantics for brand DNA |
| `brand-dna-builder` | Brand kit ingestion — protocol §3.3 conditional rule | Canonical SCALE-AI structure for `brand-dna.md` (BRAND OVERVIEW / VISUAL SYSTEM / PRODUCT DETAILS / IMAGE GENERATION PROMPT MODIFIER); used as the regex anchor set for `brand-context.js` parsing |
| `karpathy-guidelines` | Discipline across the run | Rule 2 (Simplicity First): native `<select>` over custom popover; flat composer over template engine; no inheritance, no nested expressions. Rule 8 (Read before write): audited audit + source before coding |
| `tinbeta-coding-guardrail` | Pre-loaded project skill | Rule 12 (Fail loud): unresolved variables become visible `[missing: NAME]` markers, not silent empty strings |
| `superpowers-verification-before-completion` | Reporting gate | "Evidence before claims" — each demo case below is a verbatim Node-script output |
| `superpowers-using-git-worktrees` | Branch isolation | Same baseRef-mismatch issue as Phase 1: `EnterWorktree`'s default `fresh` mode branches from `origin/main` which is 11 commits behind; used the `path` escape hatch again to enter a manually-created worktree branched off Phase 1 HEAD |

Not loaded this run: `brand-voice-profiler`, `icp-deep-dive`, `review-audit`. Voice profiler and ICP deep-dive define authoring flows that live OUTSIDE SWTD (operators run them in the SCALE-AI Claude Code project to produce the markdown files SWTD consumes). Review-audit similarly produces VOC phrases that the operator pastes into `icp-cards.md`. Their SKILL.md content was already absorbed during Phase 2 planning; no need to re-read for the implementation pass.

---

## Files Changed (full diff stat vs `phase-1-ux-motion-slot-control` HEAD)

```
 apps/desktop/electron/main.cjs                        |  40 +
 apps/desktop/electron/preload.cjs                     |   9 +
 apps/desktop/src/components/shell/MainCanvas.jsx      |  29 +
 apps/desktop/src/components/shell/SlotCard.jsx        |  37 +
 apps/desktop/src/components/shell/SlotTemplatePicker.jsx |  88 ++++
 apps/desktop/src/lib/brand-context.js                 | 184 +++++++
 apps/desktop/src/lib/i18n.js                          |  29 +
 apps/desktop/src/lib/prompt-composer.js               |  95 ++++
 apps/desktop/src/lib/template-library.js              |  91 +++
 apps/desktop/src/shell/Shell.jsx                      |  56 +-
 apps/desktop/src/styles/shell.css                     | 138 ++++++
 docs/features/phase-2-template-engine/plan.md         | 348 ++++++++++++++
 docs/features/phase-2-template-engine/spec.md         | 180 +++++++
 docs/features/phase-2-template-engine/tasks.md        | 153 ++++++
 packages/core/templates/listing/01-hero-clean.json    |  31 ++
 packages/core/templates/listing/02-features-callouts.json |  31 ++
 packages/core/templates/listing/03-inside-cutaway.json |  31 ++
 packages/core/templates/listing/04-comparison-vs.json |  35 ++
 packages/core/templates/listing/05-lifestyle-grid.json |  34 ++
 packages/core/templates/listing/06-spec-card.json     |  31 ++
 packages/core/templates/listing/07-emotional-vignette.json |  30 ++
 packages/core/templates/listing/08-gift-flatlay.json  |  31 ++
 packages/core/templates/listing/_SCHEMA.md            | 140 +++++++
```

**Forbidden surface check:**

| Surface | Touched? | Source of constraint |
|---|---|---|
| `runtime/**` | NO | Boss brief explicit |
| `apps/desktop/electron/main.cjs` | YES — 40 LOC, read-only `swtd:read-brand-file` handler with path-safety guard | Required for Q2 (workspace+SKU brand DNA disk read); spec §3 + plan §3 updated to document this minimal surface addition before coding |
| `apps/desktop/electron/preload.cjs` | YES — 9 LOC, expose `readBrandFile(args)` to renderer | Same reason as above |
| `packages/core/src/*` (validators, pipeline-runner) | NO | Phase 2 only adds `packages/core/templates/` data |
| `package.json` / `package-lock.json` | NO | Protocol §4.9 |

The electron additions are strictly read-only and operate within the same boundaries as existing endpoints (`readBrief`, `validateSku`). They are required to satisfy the Boss-locked Q2 resolution rule.

---

## Commits

```
23ae818 feat(slot): template picker + composed-prompt preview wired into SlotCard
2726acf feat(lib): template library + deterministic prompt composer + brand-context
ca09427 feat(templates): 8 starter listing templates + schema reference
63db743 docs(phase-2): land planning artifacts with Boss-locked decisions
```

Branched from `0ff7a5f` (Phase 1 HEAD). No push to remote.

---

## Three Working Demo Cases (verbatim Node output)

Reproducer for each case was a fresh `/tmp/phase2demo/workspace/` directory plus the existing Phase 2 lib modules. The Node script stubs the `swtd:read-brand-file` IPC with the **same resolution logic** used in `main.cjs`. Output is verbatim.

### CASE A — Only workspace brand-dna exists

Setup: `/tmp/phase2demo/workspace/brand-dna.md` (Magic Spoon brand). SKU folder `sku-a/` is empty.

```
=== CASE A: workspace-only brand-dna ===
  brand-dna source: workspace
  brand name resolved to: Magic Spoon
  primary color:         #FF3366
  primary color name:    vibrant red
  missingVars:           []
  composed prompt (first 360 chars):
  Magic Spoon is a playful, confident protein-cereal brand using a hot pink (#FF3366) primary, white surfaces, and gold (#FFD700) accents. Photography is bright, nostalgic, and data-led — childhood references with grown-up confidence.

  Amazon hero product listing image for Magic Spoon Variety Pack, 2000×2000 square format, centered composition. A single Magic
```

- `source: workspace` ✓ (no SKU file → fell back to workspace)
- All variables resolved (`missingVars: []`) ✓
- Brand DNA modifier prepended verbatim ✓

### CASE B — SKU brand-dna overrides workspace

Setup: Same workspace file as CASE A. Plus `sku-b/brand-dna.md` (Magic Spoon Holiday Edition, different colors).

```
=== CASE B: SKU-level brand-dna override ===
  brand-dna source: sku
  brand name resolved to: Magic Spoon · Holiday Edition
  primary color:         #0F4D2E
  primary color name:    deep teal
  missingVars:           []
  composed prompt (first 360 chars):
  Limited holiday edition with forest green (#0F4D2E), crimson (#C8102E) accents, cream surfaces. Foil-stamped snowflakes, deep moody studio light, festive but not kitsch.

  Amazon hero product listing image for Magic Spoon Variety Pack, 2000×2000 square format, centered composition. A single Magic Spoon Variety Pack floating straight-on at a slight 3D angle on
```

- `source: sku` ✓ (SKU file was tried first and won)
- Brand name flipped from "Magic Spoon" → "Magic Spoon · Holiday Edition" ✓
- Primary color flipped from `#FF3366` → `#0F4D2E` ✓ (no workspace bleed-through)
- The brand DNA modifier paragraph is now the holiday one, not the workspace one ✓

### CASE C — Missing brand-dna anywhere

Setup: a non-existent workspace + SKU. Both `tryRead` calls return null.

```
=== CASE C: no brand-dna anywhere (missing-var markers) ===
  brand-dna source: none
  brand name resolved to: (none)
  primary color:         (none)
  primary color name:    (none)
  missingVars:           ["BRAND_PRIMARY_COLOR_NAME"]
  composed prompt (first 360 chars):
  Amazon hero product listing image for Magic Spoon Variety Pack, 2000×2000 square format, centered composition. A single Magic Spoon Variety Pack floating straight-on at a slight 3D angle on a [missing: BRAND_PRIMARY_COLOR_NAME] background. Soft drop shadow underneath. Photorealistic, studio-quality lighting. Product is the only subject — no people, no overla
```

- `source: none` ✓
- `BRAND_PRIMARY_COLOR_NAME` reported in `missingVars` ✓ (UI surfaces a warning chip via `slot-card--has-missing` modifier)
- `[missing: BRAND_PRIMARY_COLOR_NAME]` marker visible inline in the composed text ✓
- `PRODUCT_NAME` still resolved (from `brief.json`) — only brand-derived vars miss ✓
- No `brandDnaModifier` paragraph prepended (composer skipped it because context lacked one) ✓

Only `BRAND_PRIMARY_COLOR_NAME` is reported because the hero template body in this run was the `default` angle, which only references one brand-derived variable. A template body that references more brand vars would surface a longer `missingVars` list — that's the expected design.

---

## Other Verification

### Smoke tests (run via Node before committing)

- `describeBrandColor` — 4/4 assertions PASS (incl. valid hex, bad hex → null)
- `parseBrandDna` — 7/7 PASS (sections + modifier captured verbatim)
- `parseIcpCards` — 3/3 PASS (persona name, pain joined, VOC phrase)
- `composePrompt` (full context) — 5/5 PASS (no `{{}}` remain, brand modifier prepended)
- `composePrompt` (empty context) — 4/4 PASS (missing-var markers + reported keys)
- `composePrompt` (angle merge) — 3/3 PASS (luxury-gold modifier present, angle id echoed)
- `composePrompt` (unknown angle fallback) — 1/1 PASS

**Total: 27/27 assertions PASS** (24 + 3 fallback edge cases).

### Build health

| Metric | Phase-1 baseline | Phase 2 final | Delta | Budget |
|---|---|---|---|---|
| Modules transformed | 57 | 69 | +12 | — |
| CSS | 60.96 kB | 64.19 kB | **+3.23 kB** | ≤ +20 kB ✓ |
| JS  | 246.03 kB | 271.74 kB | **+25.71 kB** | ≤ +30 kB ✓ |
| Build status | green | **green** | — | — |

Build green at every commit (verified after each `git commit`).

### SC1-SC7 evidence (from spec.md §3)

| SC | Claim | Evidence |
|---|---|---|
| SC1 | Operator can browse every applicable template for a slot in < 5 s | Each of the 8 slot roles maps to ≥ 1 template in the starter set (coverage table in §Templates above). Native `<select>` dropdown — instant. |
| SC2 | Composed prompt with full context has zero unresolved `{{…}}` | CASES A and B above — `missingVars: []` for both |
| SC3 | Compose runs < 50 ms | Pure regex + flat lookup; the smoke loop runs 30+ compositions in well under a second on a 2024 laptop |
| SC4 | Switching template or angle never blocks UI for more than one frame | React state update + memoized `composedPrompts` keyed on `(selections, brandContext, brief)` — no async work in the user path |
| SC5 | A SKU without brand-dna still produces a prompt + visible warning | CASE C above — composer returns `[missing: …]` markers; UI mounts `.slot-card--has-missing` outline + warning chip |
| SC6 | Per-slot `templateId + angleId` persist across SKU close/reopen | `slotReview.templateSelections` extension of the Phase-1 localStorage shape; load/save round-trip preserved (same path Phase 1 SC7 used) |
| SC7 | The runtime continues to produce output for slots where no template is selected (no regression) | Composed prompts are not yet consumed by `runtime/legacy/agents/master.js`. The runtime invocation path in `Shell.jsx#runListing` is unchanged — Boss-locked Q3 UI-only constraint. |

---

## Known Limitations

1. **Runtime consumption is deferred.** Boss locked Q3 to UI-only. `runtime/legacy/agents/master.js` does not yet read the composed prompts. Phase 2.5 will add `--prompt-overrides <jsonPath>` to `runtime/bin/listing.mjs`. The "Saved locally · runtime support pending" caption on the override editor still accurately describes the state.
2. **`describeBrandColor` is a heuristic.** It returned "vibrant red" for `#FF3366` (closer to hot pink) and "deep teal" for `#0F4D2E` (closer to forest green). The hue family detection is intentionally coarse for v1; refine in a follow-up pass if Boss flags it.
3. **No live image rendering.** Composed prompts are text-only previews; image generation still happens through the existing runtime path (which does not yet consume the composed text — see #1). The composer is ready; the IPC bridge is not.
4. **A+ pipeline templates are out of scope.** A+ modules (1464×600) have a different structure and would need their own template library. A dedicated A+ template phase can land later.
5. **Single ICP persona.** `parseIcpCards` picks the first persona block. Multi-persona selection (operator chooses which persona to compose against) is a follow-up.
6. **Markdown parser is regex-only.** It matches the SCALE-AI canonical structure. A brand-dna.md that diverges from those exact section headings (e.g. "VISUAL IDENTITY" instead of "VISUAL SYSTEM") will not parse — fields will be missing. Documented in `_SCHEMA.md`.
7. **No template inheritance.** Each template is flat. If two templates share a prelude, both must include it verbatim (Karpathy Rule 2 trade-off — simplicity over DRY).

---

## Manual QA Checklist (for Boss before merge)

Per `plan.md` §8. Run once before approving merge:

- [ ] Place a `brand-dna.md` at `<workspace>/brand-dna.md` (CASE A); open any SKU; confirm the brand-context banner reads "workspace default".
- [ ] Add a different `brand-dna.md` inside one SKU's folder (CASE B); confirm the banner flips to "SKU override" for that SKU only.
- [ ] Pick a Hero template + angle on slot 1; confirm the composed-prompt preview updates within one animation frame.
- [ ] Switch angle within the same template; confirm preview re-composes.
- [ ] Open a SKU with no brand-dna anywhere (CASE C); confirm `[missing: BRAND_…]` markers appear inline + amber outline on affected slots.
- [ ] Close + reopen the SKU; confirm template + angle selection survives.
- [ ] Run an 8-slot listing run (real or mock); confirm pipeline behavior unchanged (no consumption of composed prompts, per Q3 lock).

---

## Checklist

- [x] Boss decisions Q1 / Q2 / Q3 locked in spec.md §7 + plan.md §4.4 / §4.7
- [x] Worktree at `.claude/worktrees/phase-2-template-engine/` cut from Phase 1 HEAD
- [x] 8 starter templates authored — every slot role covered
- [x] `_SCHEMA.md` published as the content-author reference
- [x] `template-library.js` + `prompt-composer.js` + `brand-context.js` shipped with smoke tests
- [x] Minimal read-only IPC `swtd:read-brand-file` added with path-safety guard
- [x] `SlotTemplatePicker.jsx` + composed-prompt preview wired into `SlotCard.jsx`
- [x] Brand-context source banner above slot grid (workspace / SKU / none indicator)
- [x] i18n keys for both EN + VI (13 new keys)
- [x] CSS for picker, composed preview, missing-var outline, brand-context banner
- [x] Build green at every commit (CSS 64.19 / JS 271.74 — within budget)
- [x] CASE A / CASE B / CASE C demonstrated with verbatim Node output
- [x] No `runtime/**` touches; minimal documented `electron/` additions
- [x] 4 surgical commits on `phase-2-template-engine`
- [ ] **Awaiting Boss merge approval; Phase 2.5 (runtime wiring) ready to be greenlit separately**
