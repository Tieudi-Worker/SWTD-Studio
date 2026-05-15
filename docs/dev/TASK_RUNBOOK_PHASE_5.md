# TASK RUNBOOK — Phase 5 Amazon Compliance Engine

Status: Planning complete (P5.0) — awaiting Boss approval before P5.1 begins
Started: 2026-05-15 (planning run)
Branch (planned): `phase-5-amazon-compliance-engine` (to be cut from `listing-slot-preview-review` HEAD `3a21b19` once Boss approves)
Worktree: TBD (this planning run touches docs only)

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

## Phase 5.1 — Foundational extract (not yet started)

**Goal:** stand up `packages/compliance-core` with the public surface, the v1 rule pack (`rules/amazon/amazon-listing-v1.json`), and the Node-only smoke harness (`test/run-rules.mjs`). No IPC change yet; app keeps running on Phase 4 paths.

### Skills to re-apply at start of P5.1 run
- `.claude/skills/speckit-implement/SKILL.md`
- `.claude/skills/tinbeta-coding-guardrail/SKILL.md`
- `.claude/skills/matt-git-guardrails-claude-code/SKILL.md`

### Pre-implementation checklist (run before T010 fires)
- [ ] Boss-approved spec.md + plan.md + tasks.md (T004 lock)
- [ ] Branch `phase-5-amazon-compliance-engine` cut from `3a21b19` (T001)
- [ ] Runbook updated with the actual cut sha and skills-read list for the P5.1 run (T002)
- [ ] Renderer bundle baseline snapshot (T003) — or documented deferral if `apps/desktop/dist/` is absent

### Verification gates (T026 / T027 / T028 — hard gates before P5.1 commit)
- `grep -rE "require\(['\"]electron['\"]\)\|from ['\"]electron['\"]" packages/compliance-core/` returns zero hits
- `grep -rE "from ['\"]react['\"]\|require\(['\"]react['\"]\)" packages/compliance-core/` returns zero hits
- `node packages/compliance-core/test/run-rules.mjs` exits 0; record output line `N rules · M fixtures · 0 failures`

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

### SC1–SC10 evidence table (populated during P5.5)

| SC | Criterion | Status | Evidence |
|---|---|---|---|
| SC1 | Blocked prompt never reaches provider HTTP | ⬜ | Pending Hook 4 smoke (T053) + DevTools Network capture during T070 |
| SC2 | Smoke harness 0 failures on v1 pack | ⬜ | Pending T028 |
| SC3 | Verdicts persist + survive SKU close/reopen | ⬜ | Pending P5.2 + P5.3 verify |
| SC4 | BLOCK prompt disables Generate; override requires non-empty reason | ⬜ | Pending P5.3 + P5.4 verify |
| SC5 | Export blocked when any slot BLOCK; per-finding ack required | ⬜ | Pending P5.3 + P5.4 verify |
| SC6 | Zero `electron` + zero `react` imports in `packages/compliance-core/` | ⬜ | Pending T026 + T027 + T103 |
| SC7 | Engine ≤ 50 ms / 100 clean evaluations | ⬜ | Pending T107 |
| SC8 | EN + VI coverage on all new copy | ⬜ | Pending i18n audit |
| SC9 | Untrusted-content sentinel preserved through compliance | ⬜ | Pending T105 |
| SC10 | `runtime/**` untouched | ⬜ | Pending T108 |

---

## Hand-off to next run

When the next run begins (P5.1), it must:
1. Re-read the three skill files listed above.
2. Confirm Boss approval of `spec.md` + `plan.md` + `tasks.md` (recorded in this runbook under T004).
3. Cut the branch and record the base sha here.
4. Begin task execution at T010.
5. Sub-phase commit cadence is non-negotiable: one commit per sub-phase boundary (T029 / T054 / T072 / T092 / T111).
6. No `git push` unless Boss explicitly requests.
