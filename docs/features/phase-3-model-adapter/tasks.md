# Tasks — Phase 3: Model Provider Adapter

**Spec:** [`spec.md`](./spec.md)
**Plan:** [`plan.md`](./plan.md)
**Created:** 2026-05-15
**Status:** Generated — awaiting Boss approval of Q1/Q2/Q3 (spec §7) before implementation begins

## Format Legend

- `[P]` — parallelizable: different files, no in-flight deps on incomplete tasks
- `[US1] / [US2] / [US3]` — maps to user stories in `spec.md`
- Tasks WITHOUT a story label belong to Setup, Foundational, or Polish phases
- Every task names an exact file path

---

## Phase 3.0 — Setup

- [ ] T001 Cut new branch `phase-3-model-adapter` from Phase 2 HEAD (recommended) or from `phase-2-template-engine` if it is still in review; record HEAD sha in `docs/dev/TASK_RUNBOOK_PHASE_3.md`
- [ ] T002 [P] Create implementation runbook scaffold at `docs/dev/TASK_RUNBOOK_PHASE_3.md` with: branch sha, skills-read list (per protocol §3.4), checklist mirroring `tasks.md`
- [ ] T003 [P] Snapshot current renderer bundle sizes (`apps/desktop/dist/assets/`) before any changes; record in implementation runbook for regression comparison (budget: ≤ +20 KB CSS, ≤ +30 KB JS on top of Phase 2)
- [x] T004 Boss decisions LOCKED in spec.md §7: Q1 = localStorage `swtd_provider_keys` + warning; Q2 = temp cache `<sku>/output/tmp-generated/` with 7-day TTL + cleanup hooks; Q3 = Settings modal + compact TopBar chip
- [ ] T005 CORS sanity check (no code commit): from a scratch HTML page or DevTools console inside the renderer, attempt a minimal `fetch()` to `https://fal.run/openai/gpt-image-2` (HEAD or `OPTIONS`) and `https://api.openai.com/v1/images/generations`; record whether the preflight succeeds. If either blocks, the implementation switches to the `swtd:provider-fetch` IPC fallback documented in plan §7

## Phase 3.1 — Foundational (blocks all user stories)

- [ ] T010 Author `apps/desktop/src/lib/providers/types.js` — pure JSDoc typedefs for `GenerateRequest`, `GenerateResult`, `ProviderError`, `ImageProvider`. No runtime exports beyond the typedefs (zero runtime cost)
- [ ] T011 [P] Author `apps/desktop/src/lib/key-store.js` — `getKey / setKey / clearKey` keyed by provider id. Implementation depends on Q1 lock — plan §4.3 has both code shapes
- [ ] T012 [P] Author `apps/desktop/src/lib/providers/registry.js` — `PROVIDERS` array, `getProvider(id)`, `getActiveProvider()`, `setActiveProvider(id)` (persisted via key-store-style helper or its own localStorage key)
- [ ] T013 Verify against Phase 1 `slot-state-machine.js`: every transition the dispatcher will fire (`idle → queued`, `queued → generating`, `generating → success | failed`) is legal. Document any new transition in runbook

## Phase 3.2 — User Story 1 (P1): Provider configuration

**Independent test:** Operator picks a provider + saves a key; "Test connection" reports valid/invalid; selection persists across renderer reload.

- [ ] T020 [US1] Create `apps/desktop/src/components/shell/ProviderPicker.jsx` — select + per-provider key input + "Test connection" button + warning chip
- [ ] T021 [US1] Mount `ProviderPicker` per Q3's locked decision: Settings modal (recommended) or TopBar chip or RightInspector Run tab. If modal, add `SettingsModal.jsx` shell with the gear-icon trigger
- [ ] T022 [US1] Wire `setActiveProvider(id)` / `setKey(id, value)` / `clearKey(id)` from the picker to the registry + key-store; persist active provider id in `localStorage` (`swtd_active_provider`)
- [ ] T023 [US1] Implement `testConnection(apiKey)` on FAL provider (minimal HEAD or `/health` endpoint; do NOT trigger a billable generation)
- [ ] T024 [US1] Implement `testConnection(apiKey)` on OpenAI provider (`GET /v1/models` is cheap and Bearer-auth-validated)
- [ ] T025 [P] [US1] Implement `testConnection()` on Mock provider — always returns `{ ok: true }`
- [ ] T026 [US1] Add i18n keys for the picker UI: `provider.picker.label`, `provider.picker.option.mock`, `provider.picker.option.fal`, `provider.picker.option.openai`, `provider.key.label`, `provider.key.placeholder`, `provider.key.warning`, `provider.test.button`, `provider.test.ok`, `provider.test.failed` (EN + VI)
- [ ] T027 [US1] Smoke test: open Settings, switch to FAL with empty key, click Test → expect `failed`; paste a dummy key, click Test → expect `failed` (401 from FAL); record outputs in runbook

## Phase 3.3 — User Story 2 (P2): Generate via active provider

**Independent test:** Operator clicks Generate on a slot with a template selected; slot transitions through queued → generating → success with a visible image (or failed with a one-line error).

- [ ] T030 [US2] Implement `mock-provider.js#generate(req)` — respects `signal`; ~2 s setTimeout; returns a synthetic PNG (canvas-generated placeholder with overlay text `MOCK · slot N · {{aspect}}`)
- [ ] T031 [US2] Implement `fal-provider.js#generate(req)` — POST to `https://fal.run/openai/gpt-image-2` with aspect-ratio map from plan §4.4; on success, fetch the returned URL to get bytes; normalize errors per plan §4.9
- [ ] T032 [P] [US2] Implement `openai-provider.js#generate(req)` — POST to `https://api.openai.com/v1/images/generations` with size map from plan §4.5; decode `b64_json` → Blob; normalize errors
- [ ] T033 [US2] Add Generate button to `SlotCard.jsx` action row. Disabled when `composedPrompt` is null OR slot is `generating`; tooltip explains
- [ ] T034 [US2] Wire `generateSlot(slotId)` dispatcher in `Shell.jsx`: read composed prompt; pick active provider; if `requiresApiKey && !key` → fall back to mock + emit fallback banner event; dispatch synthetic `queued` + `generating` events through `handlePipelineEvent`; await `provider.generate(...)`; dispatch `success` or `failed` with normalized reason
- [ ] T035 [US2] Implement generated-image storage per Q2 lock (temp cache + 7-day TTL):
  - main.cjs: add 3 IPC handlers — `swtd:save-generated-image`, `swtd:list-tmp-generated`, `swtd:cleanup-tmp-generated` — all path-safety-guarded to `<sku>/output/tmp-generated/` ; extend `swtd-asset://` path guard regex to allow `tmp-generated/` previews
  - preload.cjs: expose `saveGeneratedImage`, `listTmpGenerated`, `cleanupTmpGenerated`
  - lib/tmp-cache.js: renderer-side helpers around the 3 IPCs; constant `TTL_MS = 7 * 24 * 60 * 60 * 1000`
  - Shell.jsx: `slotTmpImages` state populated by `listTmpGenerated` on SKU open + after each successful generation; cleanup called on app startup, SKU open, and before each new generate
  - SlotCard.jsx: prefer `slotTmpImages[slotId].url` over validator preview when present
- [ ] T036 [US2] Add the "fallback to mock" banner in MainCanvas or TopBar — visible when active provider is real but key is missing; clears after 5s
- [ ] T037 [US2] Add i18n keys: `slot.action.generate`, `slot.action.generate_disabled_no_template`, `slot.action.generate_disabled_running`, `provider.fallback.mock_used`, `provider.error.unauthorized`, `provider.error.rate_limited`, `provider.error.timeout`, `provider.error.network`, `provider.error.invalid_response`
- [ ] T038 [US2] Smoke test with mock: pick a template, click Generate, assert slot transitions queued → generating → success with the placeholder image visible. Record screenshots in runbook
- [ ] T039 [US2] Smoke test with FAL (real key supplied by Boss): generate a Hero on `data/TNTD030426i772` slot 1; assert image lands, slot is `success`, validator promotes; record elapsed time + cost estimate in runbook
- [ ] T040 [US2] Smoke test with OpenAI: same flow with OpenAI key; document any aspect-ratio approximations (9:16 → 1024×1536)

## Phase 3.4 — User Story 3 (P3): Cancel + timeout

**Independent test:** Cancel mid-generation aborts the fetch within one event-loop tick; timeout produces a clean `failed` state.

- [ ] T050 [US3] Add Cancel button to `SlotCard.jsx`; visible only when `state === 'generating'` for that slot
- [ ] T051 [US3] Wire `cancelSlotGeneration(slotId)` in `Shell.jsx`: lookup the slot's AbortController from `slotGenerationControllers` Map; call `controller.abort()`; clear the entry; dispatch a synthetic `failed` event with `reason: 'aborted'` (or `idle` revert per Q-discussion)
- [ ] T052 [US3] Add per-provider hard timeout: FAL 120 s, OpenAI 90 s, Mock 10 s. Implement via `setTimeout(controller.abort, ms)` paired with each request. Clean up on success
- [ ] T053 [US3] Slot state cleanup on abort: transition `generating → idle` (or back to prior state if it was `approved`/`success`). Document in runbook
- [ ] T054 [US3] Smoke test: start a generation; immediately click Cancel; assert DevTools Network shows `(canceled)`; assert no unhandled promise rejection in console
- [ ] T055 [US3] Smoke test: stub a slow endpoint (or use a long-running generation); confirm hard timeout fires; assert slot shows `failed` with reason `timeout`

## Phase 3.5 — Polish & Cross-Cutting

- [ ] T060 Renderer build size regression check: run `npm run build:renderer`; assert delta vs Phase 2 baseline ≤ +20 KB CSS, ≤ +30 KB JS; record in runbook
- [ ] T061 [P] Verify Phase 1 / Phase 2 unaffected: walk through Phase 1 quickstart steps 1–11 + Phase 2 demo cases A/B/C; assert no regression
- [ ] T062 [P] Security audit: grep over `apps/desktop/src/lib/providers/` + `Shell.jsx` for `console.log/error/warn` involving variables named `key`, `apiKey`, `token`, `secret`, `bearer`; assert zero hits. Also `grep -ri 'fal_key\|openai_key' apps/desktop/dist/` to confirm bundled JS does not embed any operator key
- [ ] T063 Walk through `plan.md` §8 quickstart (12 steps); record pass/fail per step in implementation runbook
- [ ] T064 Run `superpowers-verification-before-completion` gate: list each SC1–SC7 from `spec.md` §3 with the command + output that proves it; do NOT claim Done until every SC has evidence
- [ ] T065 Final commit hygiene: confirm no `git push`; confirm no edits under `runtime/**`, `packages/core/src/*.js`, or `package*.json`; confirm electron edits limited to (a) zero changes if Q2 = in-memory, OR (b) one `swtd:save-generated-image` handler + preload exposure if Q2 = save-to-disk
- [ ] T066 Author Phase 3 completion summary in `docs/dev/TASK_RUNBOOK_PHASE_3.md`: branch, commits, files changed, SC1-SC7 evidence, skills-read list, known limitations (no `/edit` endpoint, no multi-image batch, no cost meter)

---

## Dependencies (Story Order)

```
Setup (T001-T005)              ← T004 is a hard gate (Boss Q1/Q2/Q3); T005 CORS sanity check before T031/T032
    ↓
Foundational (T010-T013)
    ↓
US1 (T020-T027)                ← Provider picker + key store + test connections
    ↓
US2 (T030-T040) ──┐
                   ├─→ Polish (T060-T066)
US3 (T050-T055) ──┘
```

- US2 and US3 can run in parallel once US1's provider registry + key store land.
- The 3 adapter `generate()` implementations (T030/T031/T032) are independent and `[P]`.

## Parallel Execution Examples

**Within Setup:**
- T002 (runbook scaffold) and T003 (baseline bundle) touch different files — parallel.
- T005 (CORS sanity check) is read-only — parallel with all others.

**Within Foundational:**
- T010 (types.js), T011 (key-store), T012 (registry) all touch independent files — fully parallel.
- T013 (state-machine verification) is a doc task — parallel.

**Within US1:**
- T023, T024, T025 (per-provider testConnection) — parallel.
- T020 (picker UI), T026 (i18n) — parallel with the provider work.

**Within US2:**
- T030, T031, T032 (three adapter `generate()` impls) — fully parallel.
- T033 (Generate button) blocks on T012 (registry exists).
- T034 (dispatcher) blocks on T012 + at least one generate() being callable.
- T037 (i18n) — parallel with everything.

**Within US3:**
- T050 (Cancel button) and T052 (per-provider timeouts) — parallel.
- T051 (dispatcher cancel) blocks on T034 (dispatcher exists).

## Independent Test Criteria

| Story | "Done" means… |
|---|---|
| US1 | Operator can pick + save a key; Test Connection reports valid/invalid per real provider response; selection persists |
| US2 | Generate with mock produces placeholder PNG; Generate with FAL or OpenAI produces a real image; failures show one-line errors |
| US3 | Cancel aborts the network request within one event loop tick; timeout fires within ±2 s of documented value |

## Suggested MVP Scope

If time-boxed: ship US1 + Mock-only US2 (T030 only) first. That delivers the picker UI + the end-to-end Generate flow against mock, without exposing a network surface yet. FAL + OpenAI adapters (T031 / T032) can land in a follow-up PR after CORS is confirmed.

## Implementation Strategy

1. **Get Boss approval on Q1/Q2/Q3 (T004) before writing code.** Locks the storage + UI shape.
2. **Run the CORS sanity check (T005) FIRST.** If either provider blocks, the architecture needs an IPC proxy — better to discover before implementing.
3. **Foundational (types + registry + key-store) is bottom-up; adapters layer on top.**
4. **Adapters first, dispatcher second.** Each adapter is independently testable via Node (with `fetch` polyfill or `undici`). Land them with smoke tests before the renderer integration.
5. **Mock adapter is the safety net.** Build it first so the Generate flow works end-to-end without a key on day one.
6. **Real-provider smoke tests need Boss-provided keys.** Coordinate before T039/T040; alternative is to defer real-provider verification to a follow-up.

## Out of Scope (Re-Stated)

- `runtime/**` changes (this is renderer-side parallel path).
- Multi-image batch (FAL `num_images > 1`).
- FAL `/edit` endpoint with reference-image upload — Phase 3.5.
- Retry-with-backoff.
- Cost meter / usage dashboard.
- New design tokens.
- New npm dependencies.

---

**End of tasks.md.** Implementation begins only after Boss approval of spec §7 Q1/Q2/Q3 + the T005 CORS sanity check.
