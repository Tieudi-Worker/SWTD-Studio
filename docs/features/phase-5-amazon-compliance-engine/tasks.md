# Tasks — Phase 5: Amazon Compliance Engine

**Spec:** [`spec.md`](./spec.md)
**Plan:** [`plan.md`](./plan.md)
**Runbook:** [`../../dev/TASK_RUNBOOK_PHASE_5.md`](../../dev/TASK_RUNBOOK_PHASE_5.md)
**Created:** 2026-05-15
**Status:** Generated — implementation gated on Boss approval of `spec.md` §7 (D1–D8) + this `tasks.md`.

## Format Legend

- `[P]` — parallelizable: different files, no in-flight deps on incomplete tasks
- `[US1] / [US2] / [US3] / [US4] / [US5] / [US6] / [US7] / [US8]` — maps to user stories in `spec.md`
- Tasks WITHOUT a story label belong to Setup, Foundational, or Polish phases
- Every task names an exact file path

> **Hard constraints (re-stated, binding on every task below):**
> - No `git push` at any task boundary unless Boss explicitly requests it.
> - No edits to `runtime/**` at any point. SC10 is enforced.
> - No destructive git ops (`reset --hard`, `clean -f`, `branch -D`, `restore .`, `checkout .`) without explicit Boss approval.
> - No new npm dependencies without surfacing the conflict to Boss first.
> - The compliance package never imports `electron` or `react` (SC6).
> - Webpage-derived text never becomes a rule (SC9).
> - Phase 5 covers five implementation sub-phases (P5.1 extract + pack + smoke, P5.2 IPC + hooks + persistence, P5.3 renderer UI, P5.4 overrides + suggested fixes, P5.5 polish + verification). Sub-phase boundaries are commit-and-pause points; Boss reviews between.

---

## Phase 5.0 — Setup

- [x] T001 Cut new branch `phase-5-amazon-compliance-engine` from Phase 4 HEAD — branch was already cut from `50c15ce` (`3a21b19` + Phase 5 planning commit); worktree at `.claude/worktrees/phase-5-compliance` (runbook §P5.1)
- [x] T002 [P] Update implementation runbook with skills-read list + branch sha + sub-phase cadence — runbook §P5.1
- [x] T003 [P] Snapshot current renderer bundle sizes — **deferred**: `apps/desktop/dist/` absent on this worktree; moves to P5.5 T102 (mirrors Phase 4 T003 / T101 posture)
- [x] T004 Boss decisions D1–D8 LOCKED — Boss approved continuation in the P5.1 invocation
- [x] T005 Phase 4 baseline mergeable — confirmed; `packages/provider-core/` + `swtd:provider:*` IPC surface intact (runbook §P5.1 setup table)
- [x] T006 Renderer-side mounting audit — catalogued in `plan.md` §3 Modified files

## Phase 5.1 — Foundational: Extract Compliance Core Package + v1 Rule Pack + Smoke Harness

**Goal:** stand up `packages/compliance-core` with the public surface, the v1 rule pack, and a Node-only smoke harness. No IPC yet. App keeps running on Phase 4 paths.

- [x] T010 Create `packages/compliance-core/package.json` — `type: "module"`, no deps, entry `src/index.js`
- [x] T011 [P] `packages/compliance-core/src/types.js` — JSDoc typedefs (plan §4.3 / §4.5 / §4.7 / §4.10)
- [x] T012 [P] `packages/compliance-core/src/error.js` — `complianceError(...)` + `isComplianceError(...)`; reason vocabulary as planned
- [x] T013 [P] `packages/compliance-core/src/logger.js` — scrubs `apiKey`/`key`/`token`/`bearer`/`authorization`; mirrors `provider-core/src/logger.js`
- [x] T014 [P] `packages/compliance-core/src/severity.js` — `compareSeverity` + `worstOf(findings)`; respects `overridden:true` from the Electron main wrapper
- [x] T015 [P] `packages/compliance-core/src/excerpt.js` — ≤ 200-char excerpt extractor with word-boundary snapping
- [x] T016 `packages/compliance-core/src/predicates/index.js` — six predicate kinds (`containsAnyTokens`, `containsRegex`, `mustShowIncludes`, `tokenLooksLikeTrademark`, `compositeAnyOf`, `compositeAllOf`)
- [x] T017 `packages/compliance-core/src/subjects.js` — five subject constructors + `normalizeSubject(...)` (text-passage walker + mustShow/competitors extraction)
- [x] T018 `packages/compliance-core/src/rule-loader.js` — pack + rule validation; deep-freezes the result; rejects on shape failure
- [x] T019 `packages/compliance-core/src/rule-engine.js` — pure `evaluate(subject, ctx)`; runs predicates, builds findings, computes `overall` via `worstOf(...)`; returns the verdict shape with `engineVersion` + `rulePackVersions`
- [x] T020 `packages/compliance-core/src/extensions.js` — `createExtensionRegistry()` seam for US8 (empty in v1)
- [x] T021 `packages/compliance-core/src/index.js` — `createComplianceEngine({ rulePacks, logger, messageKeyCheck })` factory; re-exports the public surface
- [x] T022 [US2] `packages/compliance-core/rules/amazon/amazon-listing-v1.json` — **51 rules across 12 categories** (slightly above the spec target of 40–60)
- [x] T023 [P] `packages/compliance-core/rules/_schema.md` — operator-readable schema reference
- [x] T024 [US7] [P] `packages/compliance-core/test/fixtures/*.json` — 13 files (12 category-trigger files + 1 clean-pass file); 55 cases total covering every rule
- [x] T025 [US7] `packages/compliance-core/test/run-rules.mjs` — Node-only smoke harness with coverage gate; runs without `apps/desktop/node_modules`
- [x] T026 Cloud-portability lint — `grep -rE "require\(['\"]electron['\"]\)\|from ['\"]electron['\"]" packages/compliance-core/` returns **zero hits**
- [x] T027 React-free lint — `grep -rE "from ['\"]react['\"]\|require\(['\"]react['\"]\)" packages/compliance-core/` returns **zero hits**
- [x] T028 Smoke harness — `51 rules · 55 fixtures · 0 failures` + coverage gate clean; sidecar perf smoke: 100 evaluations in 29.17 ms total (avg 0.292 ms · SC7 ✅)
- [ ] T029 Sub-phase commit P5.1 — pending the final `git add` + commit at the end of this run. **No `git push`.**

## Phase 5.2 — IPC + hooks + persistence

**Goal:** Electron main hosts the engine and weaves the six hooks into the existing `swtd:provider:*` handlers; verdicts persist under `<sku>/compliance/**`; the renderer learns about them through embedded verdicts + a new `swtd:compliance:*` namespace.

- [ ] T040 [US3] Modify `apps/desktop/electron/main.cjs` — at boot: construct `createComplianceEngine({ rulePacks: [amazonListingV1], logger })`; stash alongside the Provider Core instance
- [ ] T041 [US4] Modify `apps/desktop/electron/main.cjs` — add a small internal `persistVerdict(skuPath, kind, verdict)` writer + `loadVerdict(skuPath, kind)` reader + `appendHistory(skuPath, evt)` writer; reuse the `assertInsideSku` path-safety guard pattern from `media-store.js`
- [ ] T042 [US3] Modify `apps/desktop/electron/main.cjs#swtd:provider:research-insight` — after the providerCore call, run Hook 1 (`makeBriefSubject` → `evaluate`) and Hook 2 (`makeCreativeBriefSubject` → `evaluate`); persist both at `<sku>/compliance/insight-brief.json` + `<sku>/compliance/creative-brief.json`; embed `compliance: { brief, creative }` in the response
- [ ] T043 [US3] Modify `apps/desktop/electron/main.cjs#swtd:provider:generate-image` — before HTTP dispatch, run Hook 4 (`makePromptSubject` → `evaluate`); consult overrides via `loadOverrides(skuPath)`; if BLOCK with no matching override, throw `ProviderError{ reason: 'compliance-block', findings }` and never call the provider. After media-store write, run Hook 5 (`makeMetadataSubject` → `evaluate`); augment the sidecar with `compliance: { promptVerdict, metadataVerdict }`; embed the same block in the response
- [ ] T044 [US3] Modify `apps/desktop/electron/main.cjs#swtd:provider:promote-to-approved` — before promote, run Hook 6 (`makeExportSubject` → `evaluate`); if BLOCK with no matching override, throw `ProviderError{ reason: 'compliance-block-export', findings }`; otherwise promote + persist `<sku>/compliance/export-bundle.json`
- [ ] T045 [US3] Modify `apps/desktop/electron/main.cjs` — register `swtd:compliance:check-prompt` handler that runs Hook 3 (`makePromptSubject` → `evaluate`) and persists at `<sku>/compliance/prompts/slot-<N>.json`
- [ ] T046 [US4] Modify `apps/desktop/electron/main.cjs` — register `swtd:compliance:get-report` handler that reads all current-state compliance files for the SKU and returns a bundled snapshot
- [ ] T047 [US2] Modify `apps/desktop/electron/main.cjs` — register `swtd:compliance:list-rule-packs` handler that returns `{ id, version, publishedAt, ruleCount, categories }` for each loaded pack
- [ ] T048 [US3] Modify `apps/desktop/electron/preload.cjs` — expose `window.swtdCompliance.{ getReport, checkPrompt, listRulePacks }` as the renderer's compliance surface (override + suggested-fix calls land in P5.4)
- [ ] T049 [US3] Modify `apps/desktop/src/shell/Shell.jsx` — on SKU open, call `swtdCompliance.getReport({ skuPath })` and hydrate the new `complianceReports` map; refresh after each compliance-bearing IPC response embeds a fresh verdict
- [ ] T050 [US3] Modify `apps/desktop/src/shell/Shell.jsx#composedPrompts` memo — on a prompt change for a slot, fire `swtdCompliance.checkPrompt(...)` debounced (one trailing call per ~150 ms) and stash the result in `complianceReports.prompts.set(slotId, verdict)`
- [ ] T051 [US3] Embedded-verdict plumbing in `Shell.jsx` — on `swtd:provider:research-insight` success: store `compliance.brief` + `compliance.creative` ; on `swtd:provider:generate-image` success: store `compliance.promptVerdict` + `compliance.metadataVerdict` ; on `swtd:provider:list-tmp-images`: read each entry's `compliance` block and store
- [ ] T052 [US3] Sub-phase smoke — Node smoke against a SKU fixture: drive a research call that ingests a fixture brief containing "doctor recommended"; expect Hook 1 + Hook 2 fire, files land on disk under `<sku>/compliance/`, and the embedded verdict reaches the IPC response shape
- [ ] T053 [US3] Sub-phase smoke — drive a generate-image call with a BLOCK prompt and no override; expect `ProviderError{ reason: 'compliance-block' }`, zero outbound HTTP, zero sidecar written
- [ ] T054 Sub-phase commit P5.2: IPC + hooks + persistence wired; renderer hydrates from disk; no UI change yet. Commit message references plan §4.1 + §4.2 + §4.4 + §4.7. **No `git push`.**

## Phase 5.3 — Renderer UI: chip + panel + export gate

**Goal:** the operator sees compliance verdicts on every slot card, in the Insight Brief viewer, in the run timeline header, and at the pre-export gate.

- [ ] T060 [US5] Create `apps/desktop/src/components/shell/ComplianceChip.jsx` — props `{ verdict, onOpenPanel }`; renders `✓ compliant` (green) / `⚠ N warnings` (amber) / `✗ N blocks` (red) / `⚠ overridden` (slate). Reuses Phase 2 chip palette; uses i18n keys for labels
- [ ] T061 [US5] Create `apps/desktop/src/components/shell/CompliancePanel.jsx` — props `{ verdict, overrides, onApplyFix, onCreateOverride }`; renders full finding list with excerpt, suggested-fix button (when applicable), override-entry button, and "Why?" deep link that opens `references[0]` via the existing safe-shell helper
- [ ] T062 [US5] Create `apps/desktop/src/components/shell/ExportGate.jsx` — props `{ exportVerdict, perSlotVerdicts, onConfirm, onCancel, onCreateOverride }`; renders the pre-export modal with one row per blocked slot; "Continue" stays disabled until every blocked finding has an unexpired override or has been fixed
- [ ] T063 [US5] Modify `apps/desktop/src/components/shell/SlotCard.jsx` — mount `ComplianceChip` next to the existing `servedProvider` badge; Generate action becomes `disabled` when `promptVerdict.overall === 'block'` and no matching override exists; hovering the chip mounts `CompliancePanel`
- [ ] T064 [US5] Modify `apps/desktop/src/components/shell/InsightBriefViewer.jsx` — mount `ComplianceChip` per section (Product / Customer / Market / Creative direction); finding's offending excerpt gets a small severity badge inline
- [ ] T065 [US5] Modify `apps/desktop/src/components/shell/MainCanvas.jsx` — run timeline header gains a one-line compliance summary computed from `complianceReports` (`Compliance: X blocks · Y warnings · Z pass`); per-slot timeline rows pick up the `(compliance: pass/warn/BLOCK)` suffix from the per-slot `done` line emitted by main
- [ ] T066 [US5] Modify `apps/desktop/src/shell/Shell.jsx` — replace the existing promote/export action with a gated version: if any slot's prompt or metadata verdict is BLOCK and no override, open `ExportGate`; else dispatch `swtd:provider:promote-to-approved` directly
- [ ] T067 [US5] [P] Modify `apps/desktop/src/lib/i18n.js` — add `compliance.severity.{pass,warn,block,overridden}`, `compliance.chip.{n_warnings,n_blocks,n_overridden}`, `compliance.panel.{heading,why_link,suggested_fix,no_findings}`, `compliance.export_gate.{heading,N_slots_blocked,continue,cancel,acknowledge_per_finding}`, `compliance.timeline.summary` (EN + VI)
- [ ] T068 [US2] [P] Modify `apps/desktop/src/lib/i18n.js` — add one EN + VI entry per rule in the v1 pack: `compliance.rule.<ruleId>.message` + `compliance.rule.<ruleId>.suggested_fix`. Verify against the load-time check in `rule-loader.js` (each rule's `messageKey` must resolve)
- [ ] T069 [US5] [P] Modify `apps/desktop/src/styles/shell.css` — compliance chip + panel + export-gate styling; reuses Phase 2 chip palette (green/amber/red) + a new slate variant for overridden; no new design tokens
- [ ] T070 [US5] Smoke test (renderer): pick a SKU with a BLOCK-triggering fixture brief; confirm slot card chip renders red `✗ 1 block` and Generate is disabled; confirm hovering opens the panel; confirm the "Why?" link opens the Amazon policy reference
- [ ] T071 [US5] Smoke test (export gate): with one blocked slot, click promote-to-approved; confirm `ExportGate` opens; confirm "Continue" stays disabled until override is created (P5.4 wires this; for P5.3 verify by stubbing the override list locally if needed)
- [ ] T072 Sub-phase commit P5.3: renderer UI complete; chip + panel + timeline summary + export gate render. Commit message references plan §3 Modified files + §4.8. **No `git push`.**

## Phase 5.4 — Override flow + Suggested fixes + Audit log

**Goal:** the operator can override a finding with a reason, apply a mechanical suggested fix, and see the audit log. Overrides expire after 7 days.

- [ ] T080 [US6] Modify `apps/desktop/electron/main.cjs` — register `swtd:compliance:create-override` handler: validate reason length (≥ 8, ≤ 280) server-side; attach operator name from app config (do NOT trust client-supplied substitution); generate `id` + `createdAt` + `expiresAt = createdAt + 7 days`; write to `<sku>/compliance/overrides.json` + append `<sku>/compliance/history/<isoTs>-override-created.json`
- [ ] T081 [US6] Modify `apps/desktop/electron/main.cjs` — register `swtd:compliance:list-overrides` handler that reads `<sku>/compliance/overrides.json`, drops entries past `expiresAt`, and returns the active set
- [ ] T082 [US6] Modify `apps/desktop/electron/main.cjs` — re-evaluation pipeline: when computing verdict `overall`, mark each finding `overridden: true` when an unexpired matching override exists; recompute `overall` using only non-overridden findings. Same logic at Hook 4 + Hook 6 gates
- [ ] T083 [US6] Modify `apps/desktop/electron/preload.cjs` — expose `window.swtdCompliance.createOverride` + `listOverrides` + `applySuggestedFix`
- [ ] T084 [US6] Create override modal inside `apps/desktop/src/components/shell/CompliancePanel.jsx` — surfaces the finding, requires reason (≥ 8 chars; client-side validation mirrors server-side), confirms operator name, dispatches `swtdCompliance.createOverride`; on success refresh the report via `getReport`
- [ ] T085 [US6] Modify `apps/desktop/src/components/shell/ExportGate.jsx` — wire per-row "Override" button to the same modal; gate "Continue" until every blocked finding has an unexpired override or is fixed
- [ ] T086 [US5] Modify `apps/desktop/electron/main.cjs` — register `swtd:compliance:apply-suggested-fix` handler with the v1 fix kinds: `remove-must-show-entry` (writes to `<sku>/research/creative-brief.json`), `remove-prompt-token` (returns the updated prompt to the renderer; renderer persists), `add-to-must-avoid` (writes to `<sku>/research/creative-brief.json`), `dismiss-info` (writes to a special `infoDismissed[]` block inside `overrides.json`)
- [ ] T087 [US5] Wire "Apply suggested fix" buttons inside `CompliancePanel.jsx` — fix handlers dispatch `swtdCompliance.applySuggestedFix(...)`, then re-run the relevant hook (`checkPrompt` for prompt-stage; refresh `getReport` for brief-stage)
- [ ] T088 [US6] [P] Modify `apps/desktop/src/lib/i18n.js` — add `compliance.override.{modal_heading,reason_label,reason_placeholder,operator_label,confirm_button,cancel_button,reason_too_short,reason_too_long,expires_in_days}` (EN + VI)
- [ ] T089 [US5] [P] Modify `apps/desktop/src/lib/i18n.js` — add `compliance.fix.{remove_must_show,remove_prompt_token,add_to_must_avoid,dismiss_info,applied_ok,not_applicable}` (EN + VI)
- [ ] T090 [US6] Audit-log smoke: create an override; close + reopen the SKU; confirm `overrides.json` carries the override; confirm `history/<isoTs>-override-created.json` exists; manipulate `createdAt` on disk to backdate past 7 days; reopen; confirm the finding re-blocks
- [ ] T091 [US5] Suggested-fix smoke: trigger a `remove-must-show-entry` fix; confirm `<sku>/research/creative-brief.json` is updated; confirm re-evaluation now passes for that finding; confirm chip flips to PASS (or to the next-worst finding if other rules still fire)
- [ ] T092 Sub-phase commit P5.4: override + suggested-fix flows complete; audit log in place. Commit message references plan §4.5 + §4.6. **No `git push`.**

## Phase 5.5 — Polish & Cross-Cutting

- [ ] T100 Companion architecture doc: write `docs/architecture/COMPLIANCE_CORE_ARCHITECTURE.md` mirroring plan §4 (package layout, IPC namespace, six hooks, verdict shape, override semantics, persistence layout, cloud-portability seam). This is the stable reference doc; `plan.md` stays as the historical planning doc
- [ ] T101 Append §16 stub to `docs/architecture/PROVIDER_CORE_ARCHITECTURE.md` — "Compliance Engine integration (Phase 5)" pointing to the new compliance reference doc + describing the vision-adapter seam (US8)
- [ ] T102 [P] Renderer bundle regression check — if `apps/desktop/dist/` is present on the worktree, run `npm run build:renderer` and compare bundle sizes against P5.0 baseline; record delta in runbook. Otherwise document the deferral (same posture as Phase 4 T101)
- [ ] T103 [P] Cloud-portability re-check — confirm `grep -rE "require\(['\"]electron['\"]\)\|from ['\"]electron['\"]" packages/compliance-core/` returns **zero hits**; `react` grep also zero
- [ ] T104 [P] Renderer leak re-check — confirm Phase 4 SC4 still passes after Phase 5 changes: `grep -rE "fetch\(['\"]https?://(api\.openai\.com\|fal\.run\|generativelanguage\.googleapis\.com\|kieai\.)" apps/desktop/src/` returns **zero hits**. Phase 5 must not have introduced any renderer-side HTTP for compliance
- [ ] T105 [P] Untrusted-content sentinel re-check — confirm Phase 4's `<UNTRUSTED_WEB_CONTENT>` sanitization is still applied to webpage-derived text before any compliance evaluation; verify by smoke against a fixture URL with an injection payload
- [ ] T106 [P] Verify Phases 1 / 2 / 3 / 4 unaffected — code inspection: Phase 1 state machine still drives slot UI; Phase 2 composer still produces the prompts; Phase 3/4 provider surface still routes through `swtd:provider:*`; the only change is the new compliance-chip mount + the gated generate/export actions
- [ ] T107 SC7 perf check — measure `complianceEngine.evaluate(...)` over 100 clean subjects; confirm total time ≤ 50 ms (well under spec; baseline expectation is < 10 ms total). Record in runbook
- [ ] T108 `runtime/**` untouched check — confirm `git diff <P5-base>..HEAD -- runtime/` returns empty (SC10)
- [ ] T109 Walk through `plan.md` §8 quickstart (14 steps); record evidence in runbook
- [ ] T110 SC1–SC10 evidence gate — populate a verification matrix in the runbook with one row per SC (see Phase 4 P4.5 evidence table for the format)
- [ ] T111 Final commit hygiene + Phase 5 completion summary — record in runbook (sub-phase commit shas, cumulative files touched, known limitations, hard-constraint check)

---

## Dependencies (Story + Sub-phase order)

```
Setup (T001–T006)
    ↓
P5.1 Foundational extract + v1 pack + smoke (T010–T029)             ← US1, US2, US7
    ↓
P5.2 IPC + hooks + persistence (T040–T054)                          ← US3, US4
    ↓
P5.3 Renderer UI: chip + panel + export gate (T060–T072)            ← US5
    ↓
P5.4 Override flow + suggested fixes + audit log (T080–T092)        ← US6, US5 (mechanical fixes)
    ↓
P5.5 Polish (T100–T111)
```

US8 (image-vision adapter) is architecturally documented in P5.1 (`extensions.js` seam) but no implementation work — the v2 implementation is a separate Phase.

## Parallel Execution Examples

**Within P5.1 (T010–T029):**
- T011, T012, T013, T014, T015 all touch independent files → fully parallel.
- T016 (predicates) depends on T011 (types). T017 (subjects) depends on T011. T018 (rule-loader) depends on T011 + T012.
- T019 (rule-engine) depends on T016 + T017 + T018.
- T021 (index) depends on T019 + T020. T022 (rule pack JSON) is independent of code authoring; can be drafted in parallel.
- T023, T024 (schema doc + fixtures) parallel with code.
- T025 (smoke harness) depends on T021 + T022 + T024.

**Within P5.2 (T040–T054):**
- T040 + T041 + T042 + T043 + T044 are sequential within `main.cjs` (same file).
- T045–T047 are still in `main.cjs` (sequential), but the renderer-side T049–T051 can start in parallel once T048 (preload) lands.
- T052 + T053 (smoke) parallel once T040–T048 complete.

**Within P5.3 (T060–T072):**
- T060 + T061 + T062 are new files → parallel.
- T063 (SlotCard) + T064 (InsightBriefViewer) + T065 (MainCanvas) + T066 (Shell.jsx) touch different files → parallel after T060–T062 land.
- T067 + T068 + T069 (i18n + styles) parallel with everything.

**Within P5.4 (T080–T092):**
- T080 + T081 + T082 sequential in `main.cjs`.
- T083 (preload) parallel with T084 (CompliancePanel modal) once T080 lands.
- T086 (apply-suggested-fix handler) parallel with T084/T085.
- T088 + T089 (i18n) parallel with everything.

**Within P5.5 (T100–T111):**
- T100 + T101 + T102 + T103 + T104 + T105 + T106 all parallel (independent docs/greps/inspections).
- T107 (perf), T108 (`runtime/**` check) parallel.
- T109 (quickstart) and T110 (SC gate) parallel.
- T111 last (it summarizes everything).

## Independent Test Criteria

| Story | "Done" means… |
|---|---|
| US1 | `evaluate(subject)` returns the typed verdict shape; engine has zero Electron/React imports; new rules can be added by editing JSON only |
| US2 | All 12 categories present in `amazon-listing-v1.json`; every rule has a corresponding fixture; smoke harness passes 0 failures |
| US3 | All six hooks fire at the right place; BLOCK at Hook 4 prevents the provider HTTP call; BLOCK at Hook 6 prevents promote-to-approved |
| US4 | Verdicts persist on disk under `<sku>/compliance/`; SKU close/reopen re-hydrates without re-running the engine; history log is append-only |
| US5 | SlotCard, InsightBriefViewer, run timeline, and ExportGate all surface verdicts with localised copy; Generate / Export disabled when blocked |
| US6 | Override creation requires reason ≥ 8 chars + operator name; overrides expire after 7 days; audit log captures creation + expiry events |
| US7 | Smoke harness runs without `apps/desktop/node_modules`; every v1 rule has a fixture that triggers it |
| US8 | `registerExtension(...)` seam exists in `extensions.js`; v1 ships with zero extensions; vision adapter is documented in the architecture reference |

## Suggested Sub-phase MVP Scope

If time-boxed and Boss wants an early demo:

- **MVP-A:** P5.1 only. Engine + v1 pack + smoke. Demoes the rule shape and proves the package works without touching the app.
- **MVP-B:** P5.1 + P5.2. Hooks wired; verdicts persist; the app refuses to generate or promote a BLOCK without showing any UI. Demoes the security backstop.
- **MVP-C:** P5.1 + P5.2 + P5.3. Operator sees the chips and the export gate; can read the findings but cannot override yet. Demoes the operator surface.
- **Full Phase 5:** P5.1 → P5.4 (+ P5.5 polish). Override + suggested-fix flows are wired; audit log is in place.

## Implementation Strategy

1. **Boss approval first.** `spec.md` §7 decisions D1–D8 are locked, but `tasks.md` itself needs explicit Boss approval before any task fires. T004 records the lock; no code starts until T004 is signed off.
2. **Sub-phase commits.** Each `Sub-phase commit` task (T029, T054, T072, T092) is a pause-and-review point. Boss reviews diff and runbook entries between sub-phases.
3. **No `git push`.** Confirmed at every sub-phase boundary. Pushes happen only at Boss's explicit request after Phase 5 is complete or at a Boss-chosen earlier checkpoint.
4. **Cloud-portability gate.** T026 + T027 (also re-run as T103) are hard gates. If `packages/compliance-core` ever imports anything Electron-specific or React-specific, fix before continuing.
5. **No silent supply-chain compromise.** Rules ship on disk only. T105 verifies the Phase 4 sentinel is preserved end-to-end after Phase 5 changes (SC9).
6. **No zero-cost blocks turn into paid generates.** T053 verifies Hook 4 rejects before HTTP. SC1 evidence.
7. **Override audit trail is append-only.** T090 verifies history snapshots accumulate.
8. **All operator copy localised.** EN + VI for every new key — verified during T067 / T068 / T088 / T089 and re-checked at SC8 in the runbook.

## Out of Scope (Re-Stated)

- `runtime/**` changes (Phase 5 is desktop-app architecture).
- Provider-backed image-vision review (v2; architecturally planned only — US8).
- Automatic prompt rewriting beyond the narrow `applySuggestedFix` mechanical operations.
- Network-fetched rule packs (rules ship on disk; pack version is the audit trail).
- Marketplaces beyond Amazon US in v1 (Etsy / Walmart / Social are deferred).
- Per-user permission model for overrides (single-operator-trusted in v1).
- New design tokens / chip palette (Phase 2 palette reused).
- New npm dependencies (pure Node + V8 regex + bundled JSON only).
- A+ Premium template authoring (separate Phase per source-of-truth plan).
- 5-tab Settings "Rule packs" tab (no Settings UI for compliance in v1).
- Operator-editable trademark allow-list (bundled list only in v1).

---

**End of tasks.md.** Implementation begins only after Boss approves `spec.md`, `plan.md`, and this `tasks.md` and signs off on the five-sub-phase cadence (P5.1 → P5.2 → P5.3 → P5.4 + P5.5 polish).
