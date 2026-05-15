# Tasks — Phase 2: Template & Prompt Engine

**Spec:** [`spec.md`](./spec.md)
**Plan:** [`plan.md`](./plan.md)
**Created:** 2026-05-15
**Status:** Generated — awaiting Boss approval (incl. spec §7 Q1/Q2/Q3) to begin execution

## Format Legend

- `[P]` — parallelizable: different files, no in-flight deps on incomplete tasks
- `[US1] / [US2] / [US3]` — maps to user stories in `spec.md`
- Tasks WITHOUT a story label belong to Setup, Foundational, or Polish phases
- Every task names an exact file path

---

## Phase 2.0 — Setup

- [ ] T001 Cut new branch `phase-2-template-engine` from the Phase-1 merge point (recommended) or from `listing-slot-preview-review` HEAD if Phase 1 is still in review; record HEAD sha in `docs/dev/TASK_RUNBOOK_PHASE_2.md`
- [ ] T002 [P] Create implementation runbook scaffold at `docs/dev/TASK_RUNBOOK_PHASE_2.md` with: branch sha, skills-read list (per protocol §3.4), checklist mirroring `tasks.md`
- [ ] T003 [P] Snapshot current renderer bundle sizes (`apps/desktop/dist/assets/`) before any changes; record in implementation runbook for regression comparison (budget: ≤ +20 KB CSS, ≤ +30 KB JS on top of Phase 1)
- [x] T004 Boss decisions Q1 / Q2 / Q3 resolved (see spec.md §7 — LOCKED): Q1=packages/core/templates/listing/*.json, Q2=workspace default + SKU override, Q3=UI-only (Phase 2.5 = runtime wiring)

## Phase 2.1 — Foundational (blocks all user stories)

- [ ] T010 Confirm the `brand-dna.md` / `icp-cards.md` canonical structure by reading the SCALE-AI skill references at `.claude/skills/brand-dna-builder/SKILL.md` + `.claude/skills/icp-deep-dive/SKILL.md`; record the regex anchors (section headings) used by the parser in implementation runbook
- [ ] T011 [P] Document the full variable context surface in `packages/core/templates/listing/_SCHEMA.md` per `plan.md` §4.2; this is the spec for `brand-context.js`
- [ ] T012 [P] Verify the 8 LISTING_SLOT_META roles in `apps/desktop/src/lib/slot-progress.js` against the starter template inventory; flag any role with 0 templates and escalate before T020
- [ ] T013 Snapshot the existing slot-reviewed flow on real SKU `data/TNTD030426i772`: take screenshots of Phase 1 SlotCards in each canonical state for regression comparison after Phase 2 lands

## Phase 2.2 — User Story 1 (P1): Template Library + Picker

**Independent test:** Opening any SKU and clicking a slot exposes a template picker; the picker lists ≥ 1 applicable template per slot role; selecting one updates the slot's metadata without changing the runtime call.

- [ ] T020 [US1] Author `packages/core/templates/listing/_SCHEMA.md` documenting the JSON template format from `plan.md` §4.1 (this is the spec for content authors)
- [ ] T021 [US1] Author `packages/core/templates/listing/01-hero-clean.json` derived from Amazon Listing Image Prompt Pack #1 ("Hero Shot")
- [ ] T022 [P] [US1] Author `packages/core/templates/listing/02-features-callouts.json` derived from prompt-pack #2 ("Features & Benefits Callouts")
- [ ] T023 [P] [US1] Author `packages/core/templates/listing/03-inside-cutaway.json` derived from prompt-pack #3 ("Inside the Product")
- [ ] T024 [P] [US1] Author `packages/core/templates/listing/04-comparison-vs.json` derived from prompt-pack #4 ("How It Compares")
- [ ] T025 [P] [US1] Author `packages/core/templates/listing/05-lifestyle-grid.json` derived from prompt-pack #5 ("Lifestyle / Use Cases")
- [ ] T026 [P] [US1] Author `packages/core/templates/listing/06-spec-card.json` derived from prompt-pack #6 ("Nutrition / Spec Confidence")
- [ ] T027 [P] [US1] Author `packages/core/templates/listing/07-emotional-vignette.json` from the 16-format library "Editorial Vignette" entry
- [ ] T028 [P] [US1] Author `packages/core/templates/listing/08-gift-flatlay.json` from the 16-format library "Flat-Lay" entry
- [ ] T029 [US1] Create `apps/desktop/src/lib/template-library.js` exporting `ALL_TEMPLATES` (loaded via `import.meta.glob('packages/core/templates/listing/*.json', { eager: true })`), `applicableTemplates(slotRole)`, and `findTemplate(id)`; include a minimal validator (`required: ['id','slot_roles','body','angles']`) that `console.error`s + skips invalid files
- [ ] T030 [US1] Create `apps/desktop/src/components/shell/SlotTemplatePicker.jsx` — two-level native `<select>` (template → angle), filters templates by slot role, raises `onChange({ templateId, angleId })`
- [ ] T031 [US1] Mount `SlotTemplatePicker` inside `apps/desktop/src/components/shell/SlotCard.jsx` (between the state badge row and the prompt-override editor); thread the picker's value from `templateSelection` prop
- [ ] T032 [US1] Add i18n keys to `apps/desktop/src/lib/i18n.js`: `template.picker.label`, `template.picker.empty`, `template.picker.no_template`, `template.angle.label`
- [ ] T033 [US1] Smoke test: open SKU on `data/TNTD030426i772`, assert all 8 slot roles have ≥1 applicable template (no empty picker); record assertion output in implementation runbook

## Phase 2.3 — User Story 2 (P2): Variable Injection + Brand DNA Modifier

**Independent test:** A SKU with `brand-dna.md` + `icp-cards.md` populated produces a composed prompt with zero `{{…}}` markers; a SKU without those files produces a composed prompt with `[missing: …]` markers + warning chip.

- [ ] T040 [US2] Add minimal read-only IPC `swtd:read-brand-file` in `apps/desktop/electron/main.cjs` + `apps/desktop/electron/preload.cjs`. Handler accepts `{ workspacePath, skuPath, filename }`, bakes Q2 resolution (SKU first → workspace fallback), enforces path safety (resolved file must sit under either the workspace root or the SKU root, AND filename must end in `.md`). Returns `{ ok: true, content, source: 'sku'|'workspace'|'none' }`.
- [ ] T040a [US2] Create `apps/desktop/src/lib/brand-context.js` exporting `parseBrandContext({ workspacePath, skuPath })` — async, calls `window.swtd.readBrandFile` for both `brand-dna.md` and `icp-cards.md`, parses the SCALE-AI canonical sections, returns the flat context object the composer expects (plus `source` flags so the UI can show "using workspace default" vs "using SKU override")
- [ ] T041 [US2] Implement section-splitter regex per `plan.md` §4.4; map each canonical section to the variable names from §4.2
- [ ] T042 [US2] Port `describeBrandColor(hex)` from `data/TAI NGUYEN AI/meta-ads-generator-template/server.js` into `brand-context.js` so `{{BRAND_PRIMARY_COLOR_NAME}}` resolves to a human-readable color name
- [ ] T043 [P] [US2] Create `apps/desktop/src/lib/prompt-composer.js` exporting `composePrompt({ template, angleId, context, includeModifier })` per `plan.md` §4.3; return `{ text, missingVars: string[] }`
- [ ] T044 [US2] Add Brand DNA modifier prepend logic in the composer; default `includeModifier: true`; allow per-template opt-out via `"include_brand_modifier": false` field (default true)
- [ ] T045 [US2] Wire brand context fetch into `apps/desktop/src/shell/Shell.jsx`: `useMemo brandContext = parseBrandContext(skuPath)` (with loading state); pass to `MainCanvas` → `SlotCardReview` → `SlotCard`
- [ ] T046 [US2] Compute `composedPrompts` `useMemo` in Shell.jsx keyed on `(skuPath, slotReview.templateSelections, brandContext)`; pass to `SlotCard` as a prop
- [ ] T047 [US2] Surface composed prompt preview inside `SlotCard.jsx` — under the template picker, above the prompt-override editor; show the missing-var warning chip when `composedPrompts[slotId].missingVars.length > 0`
- [ ] T048 [US2] Add i18n keys: `template.preview.heading`, `template.warning.missing_brand`, `template.warning.missing_var`, `template.modifier.included`, `template.modifier.skipped`
- [ ] T049 [US2] Smoke test: SKU with full brand context → assert `missingVars.length === 0` for every slot; SKU with only `brief.json` → assert `missingVars` lists the expected keys (BRAND_PRIMARY_COLOR, BRAND_VOICE_ADJECTIVES, etc.); record outputs in implementation runbook

## Phase 2.4 — User Story 3 (P3): Multi-Angle Selection + Persistence

**Independent test:** Operator switches angle within a template; composed prompt re-composes within one animation frame; selection persists across SKU close/reopen.

- [ ] T050 [US3] Extend the `SlotTemplatePicker.jsx` to render the second `<select>` for angles, filtered to the chosen template's `angles[]`
- [ ] T051 [US3] Default angle = `angles[0]` when no selection exists; surface this default explicitly (e.g., faded "(default)" label) so operators know they can pick
- [ ] T052 [US3] Extend `slotReview` state shape in `Shell.jsx` with `templateSelections: { [slotId]: { templateId, angleId } }`; update `loadSlotReview` / `saveSlotReview` with the additional field (safe-merge: `?? {}` defaults still work for old data)
- [ ] T053 [P] [US3] Add `setTemplateSelection(slotId, { templateId, angleId })` dispatch on `Shell.jsx`; pass through MainCanvas / SlotCardReview / SlotCard to the picker
- [ ] T054 [US3] Wire the angle's `prompt_modifier` into the composer; merge order is `[brand_modifier?, template.body, angle.prompt_modifier]` joined with blank lines
- [ ] T055 [US3] If an angle defines `aspect_ratio`, override the template's default; expose this to the composer return value so a future runtime bridge can pick it up
- [ ] T056 [US3] Persistence smoke test: select template + angle on 3 slots, close SKU, reopen, assert selections restored; record steps + result in implementation runbook

## Phase 2.5 — Polish & Cross-Cutting

- [ ] T060 Renderer build size regression check: run `npm run build:renderer`; assert delta vs Phase-1-final baseline ≤ +20 KB CSS, ≤ +30 KB JS (templates JSON should compress small); record in implementation runbook
- [ ] T061 [P] Verify Phase 1 behaviour unaffected: open a SKU, run Phase 1 quickstart steps 1–11 from `docs/features/phase-1-ux-motion-slot-control/plan.md`; assert no regression
- [ ] T062 [P] Verify A+ panel still routes events correctly (Phase 3 runBinByIdRef preserved); run an A+ mock if available, assert no cross-contamination with the listing template state
- [ ] T063 Walk through `plan.md` §8 quickstart manually (all 8 steps); record pass/fail per step in implementation runbook
- [ ] T064 Run `superpowers-verification-before-completion` gate: list each SC1–SC7 from `spec.md` §3 with the command + output that proves it; do NOT claim "Done" until every SC has evidence
- [ ] T065 Final commit hygiene: confirm no `git push`; confirm no edits under `apps/desktop/electron/`, `runtime/**`, `packages/core/src/*.js` (only `packages/core/templates/` is new), or `package*.json`; record `git diff --name-only` output in implementation runbook
- [ ] T066 Author Phase 2 completion summary in `docs/dev/TASK_RUNBOOK_PHASE_2.md`: branch, commits, files changed, verification evidence per SC, skills-read list, known limitations (runtime wiring still deferred per Q3 → propose Phase 2.5)

---

## Dependencies (Story Order)

```
Setup (T001-T004)              ← T004 is a hard gate (Boss Q1/Q2/Q3)
    ↓
Foundational (T010-T013)
    ↓
US1 (T020-T033)                ← Template library + picker
    ↓
US2 (T040-T049) ──┐
                   ├─→ Polish (T060-T066)
US3 (T050-T056) ──┘
```

- US2 and US3 can run in parallel once US1's template library + picker land.
- Most template-authoring tasks (T021–T028) are pure JSON and `[P]` — author them in parallel with each other.

## Parallel Execution Examples

**Within US1:**
- T021 through T028 all author independent JSON files → fully parallel.
- T029 (library loader) blocks on the 8 template files existing.
- T030 (picker component) blocks on T029.

**Within US2:**
- T040 (brand-context parser) and T043 (composer) touch different files → parallel.
- T044 / T045 / T046 / T047 sequentially compose into Shell.jsx and SlotCard.jsx → NOT parallel.

**Within US3:**
- T050 / T051 / T054 / T055 sequentially edit `SlotTemplatePicker` + composer → NOT parallel.
- T052 / T053 touch Shell.jsx + a new dispatcher → mostly sequential but the dispatcher is greenfield.

## Independent Test Criteria

| Story | "Done" means… |
|---|---|
| US1 | Every slot role exposes ≥1 applicable template; picker selects without error; selection persists in memory for the session |
| US2 | Composed prompt has zero `{{…}}` markers when brand+ICP present; has `[missing: …]` when absent; warning chip visible on slot in the missing case |
| US3 | Multi-angle selection works in the picker; angle's `prompt_modifier` merges into composed prompt; full persistence across SKU close/reopen (smoke test passes) |

## Suggested MVP Scope

If time-boxed: ship US1 + US2 first as a single PR (templates + composition). US3 (multi-angle persistence) lands as a follow-up PR. Each PR independently shippable; operator gets value from US1+US2 even without angle switching.

## Implementation Strategy

1. **Get Boss approval on Q1/Q2/Q3 (T004) before writing code.** These choices affect file paths and the runtime-bridge decision.
2. **Author templates first, code second.** Templates are content; the code that loads them is mechanical once content shape is locked.
3. **Wire the composer in isolation (Node smoke test).** Prove substitution + missing-var handling with a Node script before touching the renderer.
4. **Layer the picker on Phase 1's existing SlotCard.** Surgical change; do not refactor SlotCard structure.
5. **Persistence last.** Selections work in-memory before they need to persist; localStorage extension is trivial once the shape is stable.
6. **Verify with real SKU + missing-brand SKU.** Both paths need walking before claiming Done.

## Out of Scope (Re-Stated)

- Runtime consumption (`master.js` `--prompt-overrides`) — explicitly Phase 2.5 if Boss approves Q3 Path B.
- A+ module templates.
- LLM-based two-pass composition.
- New npm dependencies.
- Brand DNA / ICP authoring tools inside SWTD.

---

**End of tasks.md.** Implementation begins only after Boss approval of spec §7 Q1/Q2/Q3.
