# Feature Spec — Phase 3: Model Provider Adapter

**Feature:** Pluggable image-generation provider adapter (FAL, OpenAI, Mock) with graceful degradation
**Branch target:** `phase-3-model-adapter` (cut from Phase 2 HEAD)
**Owner:** Boss (thondptit@gmail.com)
**Created:** 2026-05-15
**Status:** Planning complete — awaiting decisions Q1/Q2/Q3 + implementation approval

---

## 1. Problem & Why

Phase 2 produces fully-composed prompts in the renderer but cannot do anything with them yet. The composed prompt is operator-visible only — the legacy runtime is untouched (Phase 2.5 owns that wiring). There is no path inside SWTD-Studio to take a composed prompt and **actually generate an image**.

Phase 3 closes that gap with an **abstract provider interface** plus three concrete adapters:

- **FAL.ai** — `openai/gpt-image-2` (text-to-image) + `openai/gpt-image-2/edit` (image-edit with reference images). Matches the meta-ads-generator + static-ad-generator reference apps in `data/TAI NGUYEN AI/`.
- **OpenAI direct** — `gpt-image-2` via the OpenAI REST API. Matches the static-ad-variation-engine reference.
- **Mock** — passthrough to the existing Phase 1 `mock-pipeline.js` so the entire generation flow can be demoed with zero API credit.

**Why now:** Phase 2 shipped a composer with nowhere to send the output. Phase 1 shipped a mock pipeline that fakes events but no image bytes. Phase 3 unifies these: the operator can pick a provider, paste an API key, and a real image lands on the slot card. When no key is set, the system falls back to mock so the UI still works.

**Why renderer-side and not runtime-side:** Boss-locked constraint. Adding real-generation to the legacy `runtime/legacy/agents/master.js` is Phase 2.5's job and requires deeper changes. A renderer-side adapter is a **parallel path** — the operator can use it without touching the legacy pipeline, and Phase 2.5 can later route the legacy runner through the same adapter when it ships.

---

## 2. User Stories

### US1 (P1) — Configure a provider + API key

**As an** operator
**I want** to pick which provider SWTD uses (FAL, OpenAI, or Mock) and paste an API key
**So that** my next "Generate" click hits the right backend.

**Required:**

- A **Provider** selector in the renderer (location TBD by Q3) listing `Mock`, `FAL.ai`, `OpenAI` with the active one indicated.
- A **key field** per provider — `localStorage`-backed (Q1 decides hardening). Never sent to any remote; never logged.
- A small **"Test connection"** button that POSTs a minimal request to verify the key. Surfaces `valid`, `unauthorized (401)`, `rate-limited (429)`, or `network error` — no full HTTP code dump.
- An explicit warning under the key field: "API key stored locally in this browser/Electron only. Anyone with access to this machine can read it." Honest about the threat model.
- **No-key fallback rule:** picking FAL or OpenAI without a saved key automatically falls back to Mock at generation time, with a one-line banner explaining the substitution.

**Acceptance:**

- Operator can switch between providers without restarting the app.
- A saved key persists across SKU close/reopen + renderer reload.
- Clearing a key wipes it from `localStorage` immediately.
- A real-provider selection without a key never hits the network — only the mock fires.

### US2 (P2) — Generate a single slot via the active provider

**As an** operator with a template selected + a valid key
**I want** to click **Generate** on a slot card
**So that** the composed prompt flows to the active provider and the slot transitions through `queued → generating → success` (or `failed`) with a visible result.

**Required:**

- A **Generate** action on the per-slot action row (next to ✓ OK / ⚠ Regen / ⌖ Open / ▸ prompt).
- The action is **disabled** when the slot has no template selected (composed prompt would be empty) — tooltip explains.
- On click: build the provider request from `composedPrompts[slotId]` + the template's `aspect_ratio` + (optionally) reference images from the SKU's `product-images/` folder.
- The slot state machine drives the UI: `idle → queued → generating → success | failed`. Reuses Phase 1's canonical state machine + event router — no new state shapes.
- On success: the generated image is **displayed in the slot preview** via `URL.createObjectURL(blob)` (in-memory only, v1) OR saved to `<sku>/output/listing/slotN.png` (Q2 decides).
- On failure: the slot shows `failed` state with a concise error reason (mapped from provider's HTTP status, not raw stack).

**Acceptance:**

- A successful FAL generation against a real key produces an image visible on the slot card within ≤ 90 s (FAL's typical SLA).
- A successful OpenAI generation produces an image within ≤ 60 s.
- A failed generation (401, 429, 500) shows the slot in `failed` with a one-line cause; the operator can retry without page reload.
- Mock generation is indistinguishable from real (same state transitions, same timing shape) except that the preview shows a placeholder image instead of a real one.

### US3 (P3) — Cancel + timeout handling

**As an** operator
**I want** to cancel a running generation mid-flight
**So that** I don't pay for a generation I no longer want, and the slot reverts cleanly.

**Required:**

- Each provider's `generate()` accepts an `AbortSignal`; the wrapper exposes a `cancel()` that fires `controller.abort()`.
- Hard timeout per provider (FAL: 120 s; OpenAI: 90 s; Mock: handled internally). On timeout, the slot transitions to `failed` with reason `timeout`.
- A **Cancel** button on the slot card (visible only while `generating`) calls `cancel()`. The slot transitions to `idle` (the previous terminal state); no `failed` flash for a user-initiated cancel.
- Mid-batch behavior: if the operator clicks "Run all 8" (future), each slot's `generate()` is independently abortable; cancelling one does NOT affect the others.

**Acceptance:**

- A click on Cancel during generation aborts the in-flight `fetch()` within one event loop tick.
- A timed-out generation transitions to `failed` with `timeout` reason and does not leak the abort controller.
- Cancelling never produces an unhandled promise rejection in the renderer console.

---

## 3. Success Criteria (Measurable, Tech-Agnostic)

| # | Criterion | How verified |
|---|---|---|
| SC1 | Operator picks a provider + pastes a key in ≤ 3 clicks from the main screen | Manual walkthrough with stopwatch |
| SC2 | A valid-key "Generate" against FAL or OpenAI produces an image visible in the slot card | End-to-end test with real key (Boss-provided during impl) |
| SC3 | Selecting a real provider without a saved key never triggers a network request — only mock fires | Network panel capture during a "Generate" with empty key |
| SC4 | Cancel reliably aborts the in-flight request within one event-loop tick | DevTools Network panel: request shows `(canceled)` status |
| SC5 | Each provider's hard timeout fires within ±2 s of the documented value | Stub a slow endpoint; assert the timeout fires |
| SC6 | API key never appears in console, log, telemetry, or any persistent file outside `localStorage` | `grep` over renderer source + DevTools console capture |
| SC7 | Switching providers mid-session does not require renderer reload | Manual walkthrough |

---

## 4. Scope & Out-of-Scope

### In scope

- New `apps/desktop/src/lib/providers/` directory:
  - `types.js` — JSDoc typedef for the `ImageProvider` interface contract
  - `registry.js` — registers all providers + tracks active provider id
  - `mock-provider.js` — wraps `mock-pipeline.js`, no network
  - `fal-provider.js` — `fetch()` against FAL REST API (text-to-image + edit)
  - `openai-provider.js` — `fetch()` against OpenAI Images REST API
- New `apps/desktop/src/lib/key-store.js` — get/set/clear keys in `localStorage` under `swtd_provider_keys`
- New `apps/desktop/src/components/shell/ProviderPicker.jsx` — UI for US1
- Per-slot Generate action wired into `SlotCard.jsx`
- `Shell.jsx` extensions: active provider id state, key store integration, generation dispatcher
- i18n keys for all new strings
- Minimal `electron/main.cjs` addition ONLY IF Q2 chooses "save to disk" (a single `swtd:save-generated-image` IPC). If Q2 chooses "in-memory blob URL", no electron changes.

### Out of scope (explicit)

- **No `runtime/**` changes.** The legacy pipeline is untouched. This phase is a parallel path inside the renderer.
- **No multi-image generation in a single call** (FAL supports `num_images: 1..4`). Phase 3 ships single-image only; batching is a follow-up.
- **No file-storage upload to FAL CDN.** Reference-image grounding (the `/edit` endpoint with `image_urls`) requires uploading product images first via `fal-ai/file-storage/upload`. That's a Phase 3.5 enhancement; v1 ships text-to-image only.
- **No two-pass prompt composition.** The composed prompt from Phase 2 goes straight to the model. No LLM-in-the-loop prompt refinement (the meta-ads-generator's Gemini step).
- **No streaming output.** GPT Image 2 doesn't stream; the renderer waits for the final blob.
- **No proxy server.** Direct browser-origin fetch to FAL/OpenAI. CORS is provider-supported; Electron has no same-origin restriction on HTTPS.
- **No retry-with-backoff.** A 429 surfaces as `failed`; the operator clicks Generate again. Automatic retries are easy to abuse on a paid API.
- **No A+ module integration.** A+ has different aspect ratios + its own runtime path; A+ adapter integration is a later phase.
- **No new design tokens.** Reuses existing motion/color tokens.
- **No new npm dependencies.** `fetch()` + `AbortController` are native to renderer + Electron.

---

## 5. Assumptions

| # | Assumption | Risk if wrong |
|---|---|---|
| A1 | FAL `openai/gpt-image-2` REST endpoint accepts CORS requests from `app://` / `file://` origin | Medium — if FAL blocks, fall back to a tiny proxy in electron/main.cjs (one extra IPC) |
| A2 | OpenAI `images.generations` endpoint accepts CORS from same origins | Medium — same fallback as A1 |
| A3 | `localStorage` is acceptable key storage for v1 (renderer-only desktop tool, no untrusted JS context) | Low — explicit warning + Q1 decides hardening |
| A4 | "Generate" semantics map cleanly to the existing 6-state machine (queued → generating → success/failed) | Low — Phase 1 designed the state machine with this in mind |
| A5 | **(LOCKED)** Generated images persist to disk under `<sku>/output/tmp-generated/` with 7-day TTL + sidecar JSON metadata. Approved/export remains a separate manual step. | n/a — locked by Boss Q2 |
| A6 | Reference-image grounding (FAL `/edit`) ships in Phase 3.5, not v1 | Low — v1 text-to-image still produces useful images; reference-grounding is a quality upgrade |
| A7 | Single concurrent generation at a time per session is acceptable for v1 | Low — operators can `Run all 8` in a future phase; for now, manual per-slot click is the norm |

---

## 6. Dependencies

- **Phase 1** (state machine + mock pipeline + canonical slot states) must be merged or be the base.
- **Phase 2** (composed prompts) must be merged — Generate sends `composedPrompts[slotId].text`.
- **Phase 0 protocol** v1.1 still binding.
- **No new npm deps.** Native `fetch()`, `AbortController`, `URL.createObjectURL`, `localStorage`.
- **Operator-supplied API keys.** Boss or operator provides one or both keys at integration time; no SWTD-owned defaults.

---

## 7. Locked Decisions (Boss-approved 2026-05-15)

**Q1 — Key storage** → **localStorage under `swtd_provider_keys` with explicit warning chip (Option A).**
Trade-off accepted: any process with renderer access can read the keys. Matches the threat model of a single-operator desktop tool. Future hardening to OS keychain / `safeStorage` will land in a separate security pass.

**Q2 — Generated-image storage** → **Temp persisted with 7-day TTL.**
Generated images are written to `<sku>/output/tmp-generated/slotN-<timestamp>.png` with a sidecar `slotN-<timestamp>.json` containing `{ generatedAt, expiresAt, providerId, slotId, templateId, angleId }`. Two key rules:

1. **Auto-delete files older than 7 days** on:
   - app startup (Shell.jsx initial mount),
   - SKU open (after the brand-context load in `chooseSku`),
   - immediately before any new generation for that slot.
2. **Approved/export does NOT happen automatically.** The temp cache is operator-reviewable preview only. A future "Promote to final" action (deferred to a later phase) will copy approved tmp images into `<sku>/output/listing/`.

This requires: 3 new electron IPCs (`save-generated-image`, `list-tmp-generated`, `cleanup-tmp-generated`) + a one-regex extension to the existing `swtd-asset://` path guard so tmp-generated PNGs can be previewed.

**Q3 — Provider picker UI placement** → **Settings modal + compact TopBar chip.**
A new `SettingsModal.jsx` hosts the provider picker (provider select + per-provider key field + "Test connection"). A compact provider chip in `TopBar` (next to the existing MOCK badge slot) shows the active provider id and opens the modal on click.

These three decisions are now part of the binding spec.

---

## 8. Non-Goals & Anti-Patterns

- ❌ No automatic key rotation, no remote key fetching, no SSO.
- ❌ No "smart" provider selection — the operator picks, SWTD doesn't second-guess.
- ❌ No silent fallback when a real provider fails — surface the error clearly. Fallback to mock is a **deliberate config**, not a hidden behavior.
- ❌ No retry with exponential backoff. One click, one attempt.
- ❌ No reading the API key from environment variables. Keys come from the UI only (env reading is a possible follow-up but introduces uncertainty about "which key is active").
- ❌ No cost estimator / usage meter in this phase. Mention it in `_SCHEMA.md` as a follow-up.

---

## 9. Glossary

| Term | Definition |
|---|---|
| Provider | A concrete implementation of the `ImageProvider` interface — Mock, FAL, OpenAI |
| Adapter | Synonym for provider, used interchangeably |
| Active provider | The provider currently selected by the operator; one at a time |
| Generate | The action that takes a composed prompt + aspect ratio and returns image bytes (or fails) |
| Key store | The localStorage-backed mapping `{ providerId: apiKey }` |
| Graceful degradation | Picking a real provider without a key automatically routes through Mock — the UI explicitly shows the substitution |
| Composed prompt | The Phase 2 output: `{ text, aspectRatio, missingVars, … }` for a given slot |
| Aspect-ratio map | Provider-specific translation of `"1:1" / "4:5" / "9:16"` to width/height pixel sizes (FAL: 2048×2048 / 1664×2080 / 1440×2560; OpenAI: 1024×1024 / 1024×1536 / 1536×1024) |
