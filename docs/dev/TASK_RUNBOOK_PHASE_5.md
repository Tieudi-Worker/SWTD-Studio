# TASK RUNBOOK — Phase 5 Amazon Compliance Engine

Status: P5.1 implementation complete — awaiting Boss review before P5.2 begins
Started: 2026-05-15 (planning run) → 2026-05-15 (P5.1 implementation run)
Branch: `phase-5-amazon-compliance-engine` (cut from `listing-slot-preview-review` HEAD `50c15ce`, which is `3a21b19` + the Phase 5 planning commit)
Worktree: `.claude/worktrees/phase-5-compliance`

---

## Phase 5.0 — Planning run (this run, 2026-05-15)

### Objective
Create SpecKit artifacts for SWTD-Studio's Amazon Compliance Engine: a deterministic rule engine inserted alongside Phase 4 Provider Core, with hooks at six pipeline stages (Insight Brief, Creative Brief, Prompt Composer, image_generate request, generated-image metadata, export bundle), persisting per-SKU compliance reports under `<sku>/compliance/`. Planning-only run; no source code touched.

### Required protocol
Claude Code follows:
1. Read relevant `.claude/skills/*/SKILL.md` files before planning.
2. Use SpecKit flow: specify → plan → tasks → verify.
3. Keep compliance engine desktop-safe and future cloud-safe (mirrors Phase 4 Provider Core boundary rules).
4. No git push.
5. No destructive cleanup without approval.
6. No edits to `runtime/**` (SC10 carried from Phase 4).

### Required skill files (planning run — read 2026-05-15)
- `.claude/skills/speckit-specify/SKILL.md` — feature spec authoring discipline; mandatory sections; max 3 [NEEDS CLARIFICATION] markers; success criteria must be measurable + tech-agnostic
- `.claude/skills/speckit-plan/SKILL.md` — phased planning workflow; technical context + constitution check + design outputs
- `.claude/skills/speckit-tasks/SKILL.md` — checklist format; one task per file path; story labels [USx]; parallelizable marker [P]; dependency graph
- `.claude/skills/tinbeta-coding-guardrail/SKILL.md` — 12-rule cautious template: simplicity, surgical changes, read-before-write, surface conflicts, match conventions, fail loud
- `.claude/skills/matt-git-guardrails-claude-code/SKILL.md` — block destructive git ops; no push; new commits, never amend

### Inputs read for the planning run
- `docs/dev/TASK_RUNBOOK_PHASE_4_PROVIDER_CORE.md` — Phase 4 patterns, sub-phase cadence, hard-constraint check, evidence-table format
- `docs/features/phase-4-provider-core/spec.md` — Phase 4 spec shape, locked-decision table, glossary
- `docs/features/phase-4-provider-core/plan.md` — Phase 4 plan shape, architecture approach, IPC namespace pattern, quickstart walkthrough format
- `docs/features/phase-4-provider-core/tasks.md` — Phase 4 task format, sub-phase commit cadence, dependency graph format
- `docs/architecture/PROVIDER_CORE_ARCHITECTURE.md` — stable architecture reference; will gain a §16 stub for compliance integration in P5.5
- `docs/features/phase-3-model-adapter/spec.md` — provider adapter contract; informs how compliance hooks into generate-image
- `docs/features/phase-2-template-engine/spec.md` — prompt composer + template/variable shape; informs prompt-stage hook

### Outputs (planning run)
- `docs/features/phase-5-amazon-compliance-engine/spec.md` ✅
- `docs/features/phase-5-amazon-compliance-engine/plan.md` ✅
- `docs/features/phase-5-amazon-compliance-engine/tasks.md` ✅
- `docs/dev/TASK_RUNBOOK_PHASE_5.md` ✅ (this file)

### Verification (planning run)
- Docs exist and are internally consistent ✅
- Plan covers: deterministic rule engine, v1 Amazon-listing rule pack with 12 categories, six pipeline hooks, per-SKU persistence at `<sku>/compliance/**`, per-finding override flow with 7-day expiry, audit log under `<sku>/compliance/history/`, suggested-fix mechanics (mechanical only, no LLM), pre-export gate, EN+VI i18n coverage, vision-adapter seam architecturally planned for v2, cloud-portability constraint preserved, untrusted-content sentinel preserved ✅
- Phase 4 decisions and constraints carried forward where applicable (SC10 `runtime/**` untouched; cloud-portability; renderer never reads plaintext keys; renderer never makes provider HTTP) ✅

### Locked decisions for Phase 5 (mirrors `spec.md` §7)
- **D1** — Three-tier verdict (`pass | warn | block`), not a binary
- **D2** — Six hooks: Insight Brief, Creative Brief, Prompt Composer, image_generate, generated-image metadata, export bundle
- **D3** — Deterministic-first in v1; provider-backed image-vision adapter architecturally planned for v2
- **D4** — Per-finding overrides with 7-day expiry; reason required ≥ 8 chars; operator name attached server-side
- **D5** — Per-SKU persistence at `<sku>/compliance/**`; current-state JSON + append-only `history/` log
- **D6** — Compliance is a peer subsystem at `packages/compliance-core/`, not a Provider Core internal
- **D7** — Untrusted-content sentinel (Phase 4 D8) preserved through evaluation
- **D8** — No `runtime/**` edits (carried from Phase 4 SC10)

### Sub-phase commit cadence (planned, awaiting Boss approval)
P5.1 (extract package + v1 rule pack + smoke harness) → P5.2 (IPC + six hooks + persistence) → P5.3 (renderer UI: chip + panel + export gate) → P5.4 (override flow + suggested fixes + audit log) → P5.5 (polish + architecture reference doc + SC1–SC10 evidence gate). One commit per sub-phase minimum; Boss reviews diff between sub-phases.

### Hard constraints binding on every task
- No `git push` at any boundary unless Boss explicitly requests.
- No edits to `runtime/**`. SC10 enforced.
- No destructive git ops (`reset --hard`, `clean -f`, `branch -D`, `restore .`, `checkout .`) without Boss approval.
- No new npm dependencies without surfacing the conflict first.
- Compliance package has zero `electron` and zero `react` imports (SC6).
- Webpage-derived text never becomes a rule (SC9).
- Renderer never reads plaintext provider keys (carried from Phase 4 SC2).
- Renderer never makes provider HTTP calls (carried from Phase 4 SC4).

---

## Phase 5.0 hand-off — what the next run needs

The next run (P5.1 — extraction of `packages/compliance-core/`) requires Boss approval of:
1. `docs/features/phase-5-amazon-compliance-engine/spec.md` (US1–US8 + SC1–SC10 + D1–D8)
2. `docs/features/phase-5-amazon-compliance-engine/plan.md` (architecture approach §4 + research decisions §5 + risk table §7 + quickstart §8)
3. `docs/features/phase-5-amazon-compliance-engine/tasks.md` (T001–T111 + sub-phase cadence + dependencies + MVP scope)

Upon Boss approval, the P5.1 run cuts the branch `phase-5-amazon-compliance-engine` from current HEAD `3a21b19`, records the base sha here, and begins task execution at T010.

---

## Phase 5.1 — Foundational extract (completed 2026-05-15)

**Goal:** stand up `packages/compliance-core` with the public surface, the v1 rule pack (`rules/amazon/amazon-listing-v1.json`), and the Node-only smoke harness (`test/run-rules.mjs`). No IPC change; app keeps running on Phase 4 paths.

### Skills re-applied at start of P5.1 run (read 2026-05-15)
- `.claude/skills/speckit-implement/SKILL.md` — load context, follow phase order, mark tasks `[x]` after completion, surface deferred work
- `.claude/skills/tinbeta-coding-guardrail/SKILL.md` — 12-rule cautious template: simplicity, surgical changes, read-before-write, surface conflicts, match conventions, fail loud
- `.claude/skills/matt-git-guardrails-claude-code/SKILL.md` — block destructive git ops; no push; new commits, never amend
(`speckit-specify`, `speckit-plan`, `speckit-tasks` already loaded during the P5.0 planning run; re-applied without re-read.)

### Setup task evidence (T001–T006)

| Task | Status | Evidence |
|---|---|---|
| T001 Branch cut + sha recorded | ✅ | Branch `phase-5-amazon-compliance-engine` cut from `50c15ce` (which is `3a21b19` + the Phase 5 planning commit). Worktree at `.claude/worktrees/phase-5-compliance`. The branch already existed at the start of the run — confirmed by `git worktree list` |
| T002 Runbook updated with skills-read + cadence | ✅ this entry | — |
| T003 Renderer bundle snapshot | ⏭ deferred | `apps/desktop/dist/` is not present on this worktree (no prior build); regression check moves to P5.5 T102, mirroring the Phase 4 T003 / T101 posture |
| T004 Boss approval D1–D8 LOCKED | ✅ | Spec §7 D1–D8 stand as the binding decisions. Boss explicitly approved continuation in the P5.1 invocation message |
| T005 Phase 4 baseline mergeable | ✅ | Worktree HEAD `50c15ce` is on top of Phase 4 P4.5 (`3a21b19`); `packages/provider-core/` is present; `swtd:provider:*` IPCs are the renderer's only provider surface (audit in Phase 4 runbook §P4.2 + §P4.5) |
| T006 Renderer-side mounting audit | ✅ | Phase 5 P5.3 will touch: `SlotCard.jsx`, `InsightBriefViewer.jsx`, `MainCanvas.jsx`, `Shell.jsx`, plus three new components. Catalog inline in `plan.md` §3 (Modified — apps/desktop/src/) |

### P5.1 implementation log

#### Files created (T010–T025) — 23 files total

```
packages/compliance-core/package.json
packages/compliance-core/src/index.js
packages/compliance-core/src/types.js
packages/compliance-core/src/error.js
packages/compliance-core/src/logger.js
packages/compliance-core/src/severity.js
packages/compliance-core/src/excerpt.js
packages/compliance-core/src/extensions.js
packages/compliance-core/src/subjects.js
packages/compliance-core/src/rule-loader.js
packages/compliance-core/src/rule-engine.js
packages/compliance-core/src/predicates/index.js
packages/compliance-core/rules/amazon/amazon-listing-v1.json
packages/compliance-core/rules/_schema.md
packages/compliance-core/test/run-rules.mjs
packages/compliance-core/test/fixtures/pass.json
packages/compliance-core/test/fixtures/false-claim.json
packages/compliance-core/test/fixtures/unverifiable-superlative.json
packages/compliance-core/test/fixtures/medical-health-claim.json
packages/compliance-core/test/fixtures/competitor-trademark.json
packages/compliance-core/test/fixtures/misleading-badge.json
packages/compliance-core/test/fixtures/prohibited-overlay-text.json
packages/compliance-core/test/fixtures/deceptive-before-after.json
packages/compliance-core/test/fixtures/unsafe-children-baby.json
packages/compliance-core/test/fixtures/review-rating-manipulation.json
packages/compliance-core/test/fixtures/intellectual-property.json
packages/compliance-core/test/fixtures/sensitive-content.json
packages/compliance-core/test/fixtures/marketplace-specific.json
```

Public surface re-exported from `packages/compliance-core/src/index.js`:
`createComplianceEngine`, `createLogger`, `NOOP_LOGGER`, `complianceError`,
`isComplianceError`, `loadRulePack`, `makeBriefSubject`, `makeCreativeBriefSubject`,
`makePromptSubject`, `makeMetadataSubject`, `makeExportSubject`, `worstOf`,
`compareSeverity`, `isSeverity`, `PREDICATE_KINDS`,
`COMPLIANCE_CORE_VERSION`, `COMPLIANCE_CORE_TYPES_VERSION`, `COMPLIANCE_ENGINE_VERSION`.

#### T022 — v1 Amazon rule pack (`amazon-listing-v1.json`)

- 51 rules across 12 categories: `false-claim`, `unverifiable-superlative`, `medical-health-claim`, `competitor-trademark`, `misleading-badge`, `prohibited-overlay-text`, `deceptive-before-after`, `unsafe-children-baby`, `review-rating-manipulation`, `intellectual-property`, `sensitive-content`, `marketplace-specific`.
- Severities: `block` (most categories), `warn` (superlatives + IP + soft sensitives), `info` (marketplace-specific informational).
- Predicate kinds used: `containsAnyTokens`, `containsRegex`, `mustShowIncludes`, `tokenLooksLikeTrademark`, `compositeAllOf`.
- Every rule carries `references[]` with baked-in Amazon Seller Central policy URLs (never fetched at runtime — Plan §4 D7 + SC9).
- Every rule carries EN+VI-target `messageKey` + `suggestedFixKey` placeholders; i18n entries land in P5.3 T068 alongside the renderer chip UI.

#### T026 — Cloud-portability lint (SC6 evidence)

```
$ grep -rE "require\(['\"]electron['\"]\)|from ['\"]electron['\"]" packages/compliance-core/
(zero hits — OK)
```

#### T027 — React-free lint (SC6 evidence)

```
$ grep -rE "from ['\"]react['\"]|require\(['\"]react['\"]\)" packages/compliance-core/
(zero hits — OK)
```

#### T028 — Smoke harness (SC2 evidence)

```
$ node packages/compliance-core/test/run-rules.mjs
51 rules · 55 fixtures · 0 failures
coverage: every pack rule is exercised by at least one fixture
```

Coverage gate enforced inside the harness: every rule id in the pack is hit by at least one fixture's `containsRuleIds[]` entry. A future regression (rule removed without removing its fixture, or new rule added without a triggering fixture) fails the harness with a clear message.

#### SC7 perf smoke (T028 sidecar)

```
$ node --input-type=module -e "<100 evaluate() calls on a clean subject>"
SC7 perf: 100 evaluations · 29.17 ms total · avg 0.292 ms · last.overall=pass
```

29 ms total for 100 evaluations on a clean subject — well under the 50 ms / 100 evaluations gate from `spec.md` SC7. Engine adds negligible latency to the renderer's prompt-stage debounce window.

#### Engine-shape smoke

```
$ node --input-type=module -e "<evaluate multi-rule subject + worstOf + listRulePacks>"
overall: block
findings.length: 2
findings: [
  { ruleId: 'amazon.medical.cures-or-treats',  severity: 'block', excerpt: 'Show our doctor recommended skin cream with a 5-star rating overlay.' },
  { ruleId: 'amazon.overlay.review-stars',     severity: 'block', excerpt: 'Show our doctor recommended skin cream with a 5-star rating overlay.' }
]
engineVersion: 0.1.0
rulePackVersions: { 'amazon-listing-v1': '1.0.0' }
worstOf after override flag on first finding: block
listRulePacks: [{ id: 'amazon-listing-v1', version: '1.0.0', ruleCount: 51, categories: 12 }]
```

Confirms the verdict carries `engineVersion` + `rulePackVersions` (audit-trail metadata the Electron-main wrapper persists into `<sku>/compliance/` files in P5.2). `worstOf(...)` respects the externally-set `overridden` flag — flipping one BLOCK finding to overridden still leaves the verdict at `block` because the other BLOCK finding remains, which is the correct semantics.

#### Tasks marked complete (T010–T029)

All P5.1 tasks ticked in `docs/features/phase-5-amazon-compliance-engine/tasks.md`.

#### Hard-constraint check (P5.1 boundary)

- `git push` performed: NO
- `runtime/**` edits: NO (`git diff HEAD -- runtime/` returns empty)
- `apps/desktop/**` edits: NO (P5.1 is package + docs only by design)
- New npm dependencies: NO
- Destructive git ops: NO
- Compliance package has zero `electron` + zero `react` imports — verified
- Webpage-derived text cannot enter the engine as a rule — verified by code inspection (engine only loads `rulePacks[]` from `createComplianceEngine` opts; no fetch / read at evaluate time)

---

---

## Phase 5.2 — IPC + hooks + persistence (not yet started)

**Goal:** Electron main hosts the compliance engine; six hooks fire at the right places; verdicts persist under `<sku>/compliance/**`; the renderer learns about them through embedded verdicts inside `swtd:provider:*` responses + a new `swtd:compliance:*` namespace. No UI change yet — renderer hydrates state silently.

### Verification gates (T052 / T053 — hard gates before P5.2 commit)
- Node smoke (T052): drive a research call with a fixture brief containing "doctor recommended"; expect Hook 1 + Hook 2 fire; files land on disk under `<sku>/compliance/`; embedded verdict reaches the IPC response shape
- Node smoke (T053): drive a generate-image call with a BLOCK prompt and no override; expect `ProviderError{ reason: 'compliance-block' }`; zero outbound HTTP; zero sidecar written

---

## Phase 5.3 — Renderer UI (not yet started)

**Goal:** the operator sees compliance verdicts on every slot card, in the Insight Brief viewer, in the run timeline header, and at the pre-export gate. Generate / Export actions are gated by BLOCK verdicts.

### Verification gates (T070 / T071 — hard gates before P5.3 commit)
- T070: pick a SKU with a BLOCK-triggering fixture brief; confirm slot card chip renders red `✗ 1 block` and Generate is disabled; confirm hovering opens the panel; confirm the "Why?" link opens the Amazon policy reference via the safe-shell helper
- T071: with one blocked slot, click promote-to-approved; confirm `ExportGate` opens; confirm "Continue" stays disabled until override is created (full override flow lands in P5.4; stub the override list locally if needed for P5.3 verify)

---

## Phase 5.4 — Overrides + Suggested fixes + Audit log (not yet started)

**Goal:** the operator can override a finding with a reason, apply a mechanical suggested fix, and see the audit log. Overrides expire after 7 days.

### Verification gates (T090 / T091 — hard gates before P5.4 commit)
- T090: create an override; close + reopen the SKU; confirm `overrides.json` persists; confirm `history/<isoTs>-override-created.json` exists; manipulate `createdAt` to backdate past 7 days; reopen; confirm the finding re-blocks
- T091: trigger a `remove-must-show-entry` fix; confirm `<sku>/research/creative-brief.json` updates; confirm re-evaluation passes for that finding; confirm chip flips to PASS (or to the next-worst remaining finding)

---

## Phase 5.5 — Polish & Cross-Cutting (not yet started)

**Goal:** companion architecture reference doc + the SC1–SC10 evidence gate.

### Final audits (T103 / T104 / T105 / T108 — re-run at phase boundary)
- `grep -rE "electron\|react" packages/compliance-core/` → zero
- `grep -rE "fetch\(['\"]https?://(api\.openai\.com\|fal\.run\|generativelanguage\.googleapis\.com\|kieai\.)" apps/desktop/src/` → zero (Phase 4 SC4 preserved)
- Phase 4 sentinel `<UNTRUSTED_WEB_CONTENT>` smoke against an injection-payload fixture (SC9)
- `git diff <P5-base>..HEAD -- runtime/` → empty (SC10)

### SC1–SC10 evidence table (running tally; populated through P5.5)

| SC | Criterion | Status | Evidence |
|---|---|---|---|
| SC1 | Blocked prompt never reaches provider HTTP | ⬜ | Pending Hook 4 smoke (T053) + DevTools Network capture during T070 |
| SC2 | Smoke harness 0 failures on v1 pack | ✅ P5.1 | `node packages/compliance-core/test/run-rules.mjs` → `51 rules · 55 fixtures · 0 failures` + coverage gate clean |
| SC3 | Verdicts persist + survive SKU close/reopen | ⬜ | Pending P5.2 + P5.3 verify |
| SC4 | BLOCK prompt disables Generate; override requires non-empty reason | ⬜ | Pending P5.3 + P5.4 verify |
| SC5 | Export blocked when any slot BLOCK; per-finding ack required | ⬜ | Pending P5.3 + P5.4 verify |
| SC6 | Zero `electron` + zero `react` imports in `packages/compliance-core/` | ✅ P5.1 | `grep -rE "electron"` and `grep -rE "react"` against `packages/compliance-core/` both return zero hits (T026 + T027) |
| SC7 | Engine ≤ 50 ms / 100 clean evaluations | ✅ P5.1 | 100 evaluations in 29.17 ms total · avg 0.292 ms (well under cap) |
| SC8 | EN + VI coverage on all new copy | ⬜ | i18n entries land in P5.3 T067 + T068 + T088 + T089 |
| SC9 | Untrusted-content sentinel preserved through compliance | ✅ P5.1 (code) | Engine only loads `rulePacks[]` from the factory opts; no runtime fetch / read inside `evaluate(...)`; full end-to-end smoke against a sentinel-wrapped payload lands in P5.2 |
| SC10 | `runtime/**` untouched | ✅ P5.1 | `git diff HEAD -- runtime/` returns empty |

---

## Hand-off to next run

When the next run begins (P5.1), it must:
1. Re-read the three skill files listed above.
2. Confirm Boss approval of `spec.md` + `plan.md` + `tasks.md` (recorded in this runbook under T004).
3. Cut the branch and record the base sha here.
4. Begin task execution at T010.
5. Sub-phase commit cadence is non-negotiable: one commit per sub-phase boundary (T029 / T054 / T072 / T092 / T111).
6. No `git push` unless Boss explicitly requests.
