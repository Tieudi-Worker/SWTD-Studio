# Feature Spec — Phase 4: Provider Core Architecture

**Feature:** Built-in Provider Core for SWTD-Studio — provider registry, Electron-main IPC boundary, image_generate contract, web research → brief intelligence, media store with 7-day TTL, secure key handling, fallback router.
**Branch target:** `phase-4-provider-core` (cut from `phase-3-model-adapter` HEAD)
**Owner:** Boss (thondptit@gmail.com)
**Created:** 2026-05-15
**Status:** Planning — no source code touched in this run. Awaiting Boss approval before any extraction work begins.

> Companion docs: [`plan.md`](./plan.md) · [`tasks.md`](./tasks.md)
> Source-of-truth architecture brief: [`docs/architecture/PROVIDER_CORE_PLAN_v0.2.md`](../../architecture/PROVIDER_CORE_PLAN_v0.2.md)

---

## 1. Problem & Why

Phase 3 shipped a working renderer-side adapter for FAL + OpenAI + Mock with a Settings modal, a 7-day temp cache, and a per-slot Generate flow. That gets the operator generating real images today, but it is a **prototype-shaped architecture**, not the final one. Concretely:

1. **API keys live in `localStorage`** of the renderer. Any code or extension with renderer access can read plaintext keys. Fine for v1; not acceptable as the long-term shape.
2. **Provider HTTP calls fire from the renderer.** This couples the app to browser CORS behavior, makes proxying/retries hard, prevents request inspection/queue control, and ties us to one runtime (Electron) — we cannot reuse the same provider code on a future cloud backend.
3. **Only 3 providers are wired (Mock / FAL / OpenAI).** Boss explicitly needs **5** in production: OpenAI, Gemini, Kie.ai, Fal.ai, and a **Custom OpenAI-compatible Provider** (name + base URL + key) to support 9router-style proxies.
4. **Web research / insight mining does not exist yet.** Phase 3 sends the operator's hand-typed prompt straight to the model. There is no pipeline that fetches a product URL, extracts product facts + customer insight, and feeds that into the Creative Brief + Prompt Composer. Boss v0.2 correction is explicit: research output must drive prompt composition, not stand alone as a side note.
5. **There is no `image_generate`-style unified contract.** Each renderer-side adapter has its own shape. Adding Gemini / Kie / Custom under that pattern would multiply ad-hoc code rather than collapsing it into one contract that handles `generate` and `edit` symmetrically.
6. **Fallback behavior is invisible.** Phase 3 falls back to Mock silently when a key is missing. The operator never sees which provider actually served the request.

Phase 4 closes those gaps by **lifting the provider stack into a desktop-safe, future-cloud-safe core** and adding the missing research/brief layer:

- Extract `packages/provider-core/` — pure JS/TS, no Electron deps, no React deps.
- Move all real-provider HTTP calls behind an **Electron main process** boundary; renderer talks IPC only.
- Implement the **5 provider settings panels** (OpenAI / Gemini / Kie.ai / Fal.ai / Custom).
- Implement the **`image_generate` unified contract** with explicit `generate` vs `edit` semantics, defaulting to `gpt-image-2/edit` when a reference image exists and `gpt-image-2` otherwise.
- Implement the **Web Research → Insight Brief → Creative Brief → Prompt Composer pipeline**, so research output is consumed by prompt composition (not a standalone artifact).
- Implement a **fallback router** with transparent UI status (operator always sees which provider actually served the request, including any substitution).
- Implement **key handling v1** (renderer `localStorage` shim with one-shot migration into the main process) → **key handling v2** (Electron `safeStorage` / OS keychain), behind the same `KeyVault` interface so providers don't change when the backend swaps.
- Keep the existing **media store contract**: `tmp-generated/` + `approved/` with the 7-day TTL cleanup hook from Phase 3, owned by main process, called by renderer through IPC.

**Why not implement it all at once:** This is a foundational architecture phase. The plan deliberately separates **architecture lock** (this phase's spec/plan/tasks docs) from **extraction** (P4.1), **IPC wiring** (P4.2), **new providers** (P4.3), and **research/insight pipeline** (P4.4) so each sub-phase ships a working app and is reviewable in isolation. This document covers all four sub-phases at the architecture level; downstream Phase 4 implementation rolls them out incrementally.

**What this phase explicitly does not do:** ship working code. This spec/plan/tasks bundle is the lock that the implementation runs from. Per the runbook, no `runtime/**` or `apps/desktop/**` source code changes in this run — only the three docs in `docs/features/phase-4-provider-core/`.

---

## 2. User Stories

> Priorities follow SpecKit convention: P1 is the minimum viable slice; later stories layer on top. Each story is independently demoable.

### US1 (P1) — Provider Registry with 5 provider settings panels

**As an** operator
**I want** a Settings UI that lists 5 provider groups (OpenAI, Gemini, Kie.ai, Fal.ai, Custom) and lets me paste keys, pick default models, and test the connection
**So that** I can configure the providers I actually use in production without restarting the app or editing files.

**Required:**

- A `ProviderSettingsPanel` (replacing / superseding Phase 3's `ProviderPicker`) with 5 sub-panels, one per provider group:
  - **OpenAI:** API key, default image model (`gpt-image-2` / `gpt-image-2/edit` / `gpt-image-1.5` transparent variant), default quality (`low|medium|high|auto`), output format (`png|jpeg|webp`), Test connection.
  - **Gemini:** API key, default model (from the provider's supported list), Test connection.
  - **Kie.ai:** API key, default model group (`nano-banana-pro | seedream | kling`), Test connection.
  - **Fal.ai:** API key, default model (Flux or GPT-Image route via FAL), Test connection.
  - **Custom Provider:** **Provider Name** (display label), **Base URL** (endpoint, e.g. `https://9router.example.com`), **API Key**, optional model prefix / explicit model list, Test connection. *(Boss D1 lock — 3 fields are required; see §7.)*
- Each provider exposes the same `ImageProvider` contract: `id`, `label`, `authFields`, `capabilities`, `models`, `generate()`, `edit()`, `testConnection()`.
- A "Default route" indicator on the panel showing which provider currently owns the primary route (per fallback router config).
- Saving a key calls into main; the renderer never holds the plaintext key beyond the moment of save.

**Acceptance:**

- Operator opens Settings, sees all 5 provider tabs/sections in a stable visual layout.
- Each tab has its required auth fields per the list above. Test connection returns `valid` / `unauthorized` / `rate-limited` / `network` per the same normalized error vocabulary Phase 3 introduced.
- A saved key persists across app restart.
- Switching the active/default provider does not require an app restart.
- The Custom Provider tab refuses to save if Base URL is blank or not a valid URL; refuses to save if Provider Name is blank.

### US2 (P1) — Electron main IPC boundary; renderer never calls provider APIs directly

**As a** security-conscious operator and architect
**I want** all provider HTTP calls to happen in the Electron main process
**So that** API keys never reach the renderer after save, and the same provider code can later run on a cloud backend with zero changes.

**Required:**

- All provider HTTP traffic (`generate`, `edit`, `testConnection`, `web_search`, `web_fetch`) goes through Electron main; the renderer reaches them via a single IPC namespace `swtd:provider:*`.
- The renderer-side facade `window.swtdProvider.{listProviders, saveKey, clearKey, testProvider, generateImage, editImage, researchInsight, listTmpGenerated, cleanupTmpGenerated}` is the **only** way the renderer talks to providers. No `fetch()` to provider hosts from renderer code in the final architecture.
- Phase 3's renderer-side providers (`apps/desktop/src/lib/providers/`) are removed/replaced. A migration step ensures any existing `localStorage` keys are forwarded once to the new main-side vault, then cleared from `localStorage`.
- Each IPC handler does input validation, path-safety guarding (for media), error normalization, and never echoes secrets in responses or logs.

**Acceptance:**

- A grep over `apps/desktop/src/` finds zero `fetch(...)` calls to known provider hosts (`api.openai.com`, `fal.run`, `generativelanguage.googleapis.com`, `kieai.*`, custom base URLs).
- A grep over `apps/desktop/dist/` (renderer bundle) finds zero literal references to operator API keys.
- DevTools Network panel during a generation shows **no** outbound provider request from the renderer process (only IPC traffic). The request shows up in main-process logs.
- Migrating from Phase 3: a v1 `localStorage` blob is detected once on first launch of Phase 4 build, forwarded to main, and the renderer copy is cleared.

### US3 (P1) — Unified `image_generate` contract handling generate-vs-edit

**As an** operator who feeds reference product images
**I want** the system to automatically pick edit-mode when I provide a reference image and generate-mode when I don't
**So that** my product form is preserved in listing slots (edit-mode) and creative slots without a reference still work (generate-mode).

**Required:**

- One renderer-facing call: `swtdProvider.generateImage(input)`.
- `input` shape matches `ImageGenerateInput` documented in plan.md §4.3, including: `prompt`, `model?`, `provider?`, `images?[] | image?`, `aspectRatio?`, `quality?`, `outputFormat?`, `background?`, `count?`, `timeoutMs?`, `slotId?`, `skuPath?`.
- Behavior contract:
  - If `images` or `image` is present **and** the selected provider supports edit → route to **edit-mode**. Default model = `gpt-image-2/edit` when the OpenAI provider is active.
  - Else → route to **generate-mode**. Default model = `gpt-image-2`.
  - If the selected provider does not support edit and a reference image was provided, the fallback router picks the next configured provider that supports edit (e.g., OpenAI). The UI must surface that substitution.
- Output is normalized to the SWTD media store: PNG/JPEG/WebP bytes saved under `<sku>/output/tmp-generated/` with a sidecar JSON. The renderer receives a stable `swtd-asset://` URL plus structured metadata, never raw provider response.
- The 8 listing slots + 5 A+ Premium slots all use this same contract (no per-slot bespoke calls).

**Acceptance:**

- Calling `generateImage({ prompt, image: 'product-images/hero.jpg', slotId: 1 })` against the OpenAI provider produces an image via the edit route and the sidecar JSON records `mode: 'edit'`, `model: 'gpt-image-2/edit'`.
- Calling the same with no `image` produces an image via the generate route and the sidecar records `mode: 'generate'`, `model: 'gpt-image-2'`.
- Calling with reference images but with Gemini selected (no edit support assumed for v1) triggers the fallback router; the operator sees a UI line "Routed to OpenAI/gpt-image-2/edit because Gemini does not support image edit."
- Output bytes are persisted to `<sku>/output/tmp-generated/` with TTL metadata; renderer renders via the existing `swtd-asset://` protocol.

### US4 (P1) — Secure key handling v1 (localStorage shim w/ migration) → v2 (safeStorage / OS keychain)

**As an** operator and security reviewer
**I want** a clear migration path from "keys in localStorage" (Phase 3) to "keys protected by OS keychain" (Phase 4 final)
**So that** the v1 shim never silently lingers, and downstream cloud deployments inherit the same `KeyVault` abstraction.

**Required:**

- A single `KeyVault` interface in `packages/provider-core/src/key-vault.js` with `getKey(providerId)`, `setKey(providerId, value)`, `clearKey(providerId)`, `listProvidersWithKeys()`.
- **v1 backend (Electron, ship first):** `safeStorage`-backed (Electron's built-in OS-keychain wrapper). Falls back to an encrypted file under `app.getPath('userData')` if `safeStorage.isEncryptionAvailable()` returns false (rare; logs a warning).
- **v0 → v1 migration:** on first launch of Phase 4 build, detect the Phase 3 `localStorage[swtd_provider_keys]` blob → forward each key into the `KeyVault` via IPC → `localStorage.removeItem('swtd_provider_keys')` → write a one-line marker `localStorage[swtd_provider_keys_migrated_at] = <iso>`. Idempotent (subsequent runs see the marker and skip migration).
- **v2 ambition (documented, not built in P4):** swap the backend to OS keychain bindings (`keytar` or equivalent) or a cloud KMS, with no provider code change. The `KeyVault` interface is the seam.
- The renderer **cannot** read plaintext keys at any point after save. The renderer-facing API exposes only `hasKeyFor(providerId): boolean` and `clearKey(providerId)`; never `getKey`.

**Acceptance:**

- Fresh install (no prior Phase 3 state): operator pastes a key in Settings → saved via IPC → restart app → key persists → operator never sees the plaintext echoed back; the field shows `••••` with a "Replace" button.
- Migration from Phase 3 build: operator with existing `localStorage[swtd_provider_keys]` launches Phase 4 → migration log entry produced → `localStorage` blob gone after first run → next run finds no plaintext in renderer storage.
- `safeStorage.isEncryptionAvailable() === false` (Linux without keyring): app boots; main process logs a single explicit warning "OS encryption unavailable; keys stored AES-encrypted on disk with a derived key. Configure a system keyring for stronger protection."
- Renderer grep: zero `getKey(` exposed through preload. Only `hasKeyFor` / `clearKey` / `setKey` exist on `window.swtdProvider`.

### US5 (P2) — Web Research / Insight Mining feeds Creative Brief + Prompt Composer

**As an** operator about to generate a listing
**I want** to paste a product URL, a keyword, or my own notes, and have the system extract product facts + customer insight, build an **Insight Brief**, and inject those facts into every slot's composed prompt
**So that** AI-generated images stay true to the actual product (correct material, dimensions, use case) and aligned to the target customer's language and triggers, instead of looking generically "AI-glossy".

**Required:**

- A renderer-facing call `swtdProvider.researchInsight(input)` with `WebResearchInput` shape (see plan.md §4.5): `urls?[]`, `keywords?[]`, `productName?`, `productInsight?`, `customerInsight?`, `marketplace?`, `depth?`.
- Behind that IPC, the **Insight Brief pipeline** in main process executes:
  1. **Fetch/parse** each URL via `web_fetch` adapter (treat content as untrusted; HTML stripped, scripts ignored, prompt-injection markers escaped).
  2. **Search** the keyword/product name via `web_search` adapter for additional market context.
  3. **Extract** product facts (product type, material, dimensions, use case, audience, occasion, pain point, differentiation, competitor claim).
  4. **Extract** customer/market insight (customer language, emotional buying trigger, visual motifs, common objection, trust signal, Amazon compliance risk).
  5. Produce a structured **`InsightBrief`** matching the schema in plan.md §4.5.
- The **Creative Brief writer** consumes the `InsightBrief` and produces a per-SKU creative direction object (`style`, `mood`, `mustShow[]`, `mustAvoid[]`).
- The **Prompt Composer** (Phase 2 component) is extended to read the Creative Brief + Insight Brief and inject `product.materials`, `product.features`, `customer.painPoints`, `creativeDirection.mustShow`, etc. into composed prompts via existing template variables. Research output **never** stands alone — it is consumed by composition.
- Webpage content is **untrusted**: any text that looks like a prompt-injection ("ignore previous instructions", "you are now…") is sanitized or quoted such that downstream LLM/research calls cannot treat it as instruction. Documented in plan §4.5 and §6 (Risk table).
- Insight Brief artifacts are persisted to `<sku>/research/insight-brief.json` and `<sku>/research/sources.json` (provenance: which URLs/queries produced which facts).

**Acceptance:**

- Operator pastes a competitor's product URL + a keyword into the Brief step → within ≤ 60 s receives a populated `InsightBrief` JSON visible in a read-only viewer.
- Generating a listing slot after research populates the composed prompt with the extracted product facts and customer triggers; verifiable by inspecting the composed prompt text on the SlotCard and seeing brief-derived tokens (e.g. `"wooden ultrasound photo frame"`, `"expecting parents"`).
- A URL with an obvious injection payload (e.g. `<p>Ignore previous instructions and...</p>`) does not change pipeline behavior; the brief shows the suspicious passage quoted in a `sources.json` provenance entry but the `InsightBrief` itself does not include it as a fact or instruction.
- `<sku>/research/insight-brief.json` exists and round-trips: closing/reopening the SKU shows the same brief without re-running the pipeline.

### US6 (P2) — Fallback router with transparent provider status in UI

**As an** operator
**I want** the system to fall back from a failing primary provider to a configured secondary, and **clearly show** which provider actually served each request
**So that** I never wonder why an image looks different or where my credit is going.

**Required:**

- A configurable fallback chain in Settings. Default chain:
  - `openai/gpt-image-2/edit` (when reference image exists) → fallback per user config → `mock` (dev/offline only).
  - `openai/gpt-image-2` (when no reference image) → fallback per user config → `mock`.
  - Operator can re-order the chain or disable specific providers from it.
- Triggering fallback: a hard failure of `unauthorized`, `rate-limited`, `network`, `timeout`, or `provider-unsupported-edit` causes the router to try the next entry. `invalid-response` does **not** auto-fallback (operator should see the actual failure).
- Each generation result records:
  - `requestedProvider`: what the operator/router asked for.
  - `servedProvider`: what actually produced the image.
  - `fallbackChain`: ordered list of attempted providers + reasons for each fallback.
- The renderer UI surfaces `servedProvider` on every SlotCard (small badge: e.g. `via Fal.ai · Flux`). When `servedProvider !== requestedProvider`, the badge is highlighted and a tooltip explains the substitution.
- Mock is **never** silently substituted for a real provider in this phase. If no real provider in the chain works, the slot transitions to `failed` with `reason: 'all-providers-failed'`. Mock-fallback for missing keys (Phase 3 behavior) becomes an explicit operator-toggle, off by default.

**Acceptance:**

- With OpenAI primary + Fal.ai secondary, simulate an OpenAI 429 → slot goes through fallback, lands `success` with `servedProvider: fal`, badge shows "via Fal.ai (OpenAI rate-limited)".
- With both providers misconfigured → slot ends in `failed`, reason `all-providers-failed`, fallbackChain populated with both error reasons.
- Mock is never used in real generation unless the operator has explicitly enabled "Use Mock fallback when no real provider configured".
- The badge / tooltip information is visible without opening a debug panel.

---

## 3. Success Criteria (Measurable, Tech-Agnostic)

| # | Criterion | How verified |
|---|---|---|
| SC1 | Operator can configure all 5 provider groups (OpenAI, Gemini, Kie.ai, Fal.ai, Custom) with persistent keys in ≤ 2 minutes from a fresh install | Manual walkthrough with stopwatch |
| SC2 | API keys are never present in the renderer process after save (no plaintext in DevTools, in `localStorage`, in renderer bundle, or in any log file) | DevTools storage panel + grep over `apps/desktop/dist/` + main+renderer log capture |
| SC3 | Operator can generate one listing image with a reference (edit-mode) and one without (generate-mode); each is correctly labeled in the sidecar metadata | End-to-end run; inspect `<sku>/output/tmp-generated/*.json` |
| SC4 | All provider HTTP traffic originates from the Electron main process — zero outbound provider requests from the renderer | DevTools renderer Network panel during generation shows IPC only; main-process log shows the actual HTTP request |
| SC5 | A research pass (URL + keyword) produces an `InsightBrief` JSON and the next composed prompt contains brief-derived tokens | Inspect `<sku>/research/insight-brief.json` and the SlotCard's composed-prompt preview |
| SC6 | Web content containing prompt-injection text does not alter pipeline behavior or appear unsanitized in the InsightBrief | Run the pipeline with a curated injection payload URL; inspect output and pipeline logs |
| SC7 | A simulated primary-provider failure surfaces a visible substitution badge and the slot still succeeds via the fallback provider | Stub OpenAI to return 429; watch the slot land with `servedProvider: fal` badge |
| SC8 | The temp media store retains generated files for 7 days, then auto-cleans on app start / SKU open / before next generation | Time-jump test: backdate sidecar `expiresAt`; trigger cleanup; assert files removed |
| SC9 | Operator can swap the `KeyVault` backend from `safeStorage` to a hypothetical OS-keychain implementation without changing any provider code | Code review: providers import only the `KeyVault` interface, never a backend implementation |
| SC10 | No source code under `runtime/**` is modified during Phase 4 implementation | `git diff` against base branch shows zero lines changed under `runtime/**` |

---

## 4. Scope & Out-of-Scope

### In scope (Phase 4 as a whole)

- New package `packages/provider-core/` with:
  - `provider-registry.js`, `model-catalog.js`, `image-generate.js`, `image-edit.js`, `fallback-router.js`, `key-vault.js`, `media-store.js`, `web-research.js`, `insight-brief.js`, `types.js`.
  - Concrete providers under `providers/`: `openai.js`, `gemini.js`, `kie.js`, `fal.js`, `custom-openai-compatible.js`, `mock.js`.
- Electron main wiring:
  - `apps/desktop/electron/main.cjs` — register a single namespace of IPC handlers `swtd:provider:*` that delegate to `packages/provider-core`. Path-safety guards stay in main.
  - `apps/desktop/electron/preload.cjs` — expose `window.swtdProvider.{...}` as the renderer's only provider surface.
- Renderer:
  - Replace Phase 3's `apps/desktop/src/lib/providers/*` adapter set with thin renderer-side proxies that simply call `window.swtdProvider.*` (eventually removing the file set entirely once IPC is the only path).
  - Settings UI: extend the Phase 3 modal into a 5-tab provider section.
  - Slot UI: show `servedProvider` badge; show "fallback used" tooltip.
  - One-time Phase 3 → Phase 4 key migration step on first launch.
- Insight Brief pipeline (renderer trigger + main process pipeline), persisted under `<sku>/research/`.
- Creative Brief writer + Prompt Composer extension to consume brief fields.
- Updated SpecKit-tracked documentation:
  - `docs/architecture/PROVIDER_CORE_ARCHITECTURE.md` (companion to the existing v0.2 plan).
  - This phase's `spec.md` / `plan.md` / `tasks.md`.

### Out of scope (explicit, this phase)

- **No `runtime/**` changes.** Phase 4 is desktop-app architecture; legacy runtime is untouched.
- **No A+ Premium template authoring.** The pipeline carries A+ slots, but creating the 5 A+ Premium templates is a separate phase (P5 in the source-of-truth plan).
- **No upload of reference images to FAL CDN** (`fal-ai/file-storage/upload`). Edit-mode shipped first via OpenAI `gpt-image-2/edit`. FAL `/edit` lands in a follow-up.
- **No two-pass LLM prompt refinement.** The composed prompt feeds straight to the image model. A future "prompt refiner" sub-feature (e.g. Gemini-style rewriter) is deferred.
- **No streaming image output.** Same as Phase 3.
- **No retry-with-backoff.** Failed providers trigger fallback or stop; we do not silently retry the same provider.
- **No cost meter / usage dashboard.** Mentioned in plan §7 risks; not built.
- **No remote/cloud backend in this phase.** The architecture is designed to be cloud-portable (provider core is pure JS, key vault is interface-shaped), but actual cloud deployment is a separate phase.
- **No OS-keychain (`keytar`) integration.** v1 ships with Electron `safeStorage`. `keytar`/keychain swap is v2 — interface-ready but not built here.
- **No multi-image batch.** Single image per generate call. Batching is a follow-up.
- **No new design tokens.** Reuses Phase 2/3 motion + color.
- **No new npm dependencies** other than Electron-built-in `safeStorage` (already available) and a tiny HTML-strip utility if the implementer judges it needed (decision deferred to plan §5 research).

---

## 5. Assumptions

| # | Assumption | Risk if wrong |
|---|---|---|
| A1 | `safeStorage` is available on Boss's primary OS (Win10/11, macOS, Ubuntu w/ keyring) | Low — falls back to AES-on-disk with logged warning; functionally still works |
| A2 | OpenAI's `gpt-image-2/edit` endpoint accepts a reference image and produces a faithful-form output | Medium — verified in Phase 3 plans; confirm in implementation smoke tests before committing the default route |
| A3 | Gemini, Kie.ai, Fal.ai, and Custom providers expose HTTP-compatible auth (Bearer / API-Key header) over CORS from Electron main (Node fetch) | Low — Node-side fetch has no CORS concerns; this assumption is mostly a Phase 3 worry that disappears once we move to main |
| A4 | Boss's "5 providers" set (OpenAI / Gemini / Kie.ai / Fal.ai / Custom) is the closed list for v1 of the Provider Core | Low — adding a 6th is a `provider-registry.js` insertion + one folder under `providers/`; no contract changes |
| A5 | "Custom Provider" semantics = OpenAI-compatible (same auth header style, same `/v1/images/generations` route) at minimum | Medium — if a target proxy speaks a non-OpenAI dialect, the Custom adapter needs a small `modelPrefix` / route override; documented in plan §4.4 |
| A6 | `web_fetch` can extract usable text from typical Amazon listing / e-commerce competitor pages with reasonable reliability (>70%) | Medium — if a target site is heavily JS-rendered, depth=deep may fail; documented in plan §7 risks |
| A7 | The Insight Brief schema (plan §4.5) covers Amazon US + Etsy + Social Commerce use cases without per-marketplace forks | Low — schema is intentionally flat and extensible; marketplace-specific fields can be added under `market.*` |
| A8 | Renderer-side Phase 3 `localStorage[swtd_provider_keys]` is the only existing key-storage location to migrate from | Low — Phase 3 spec §7 (Q1) explicitly fixed this single location |
| A9 | The 7-day TTL temp cache contract from Phase 3 is unchanged; Phase 4 only changes **who owns the IPCs** (still main, but now part of `packages/provider-core/media-store.js`) | Low — same paths, same sidecar shape, same cleanup hooks |

---

## 6. Dependencies

- **Phase 3** (renderer-side adapter + 7-day temp cache IPCs) must be merged or be the base branch.
- **Phase 2** (template engine + Prompt Composer) must be available — Phase 4's research pipeline extends the composer with brief-derived variables.
- **Phase 1** (slot state machine, mock pipeline, event router) must be the base — Phase 4 reuses the canonical state machine for `idle → queued → generating → success | failed`.
- **`SWTD_EXECUTION_PROTOCOL.md` v1.1** still binding.
- **No new npm deps** (Electron's `safeStorage`, Node 18+ `fetch`, `AbortController` are all built-in). A tiny HTML-text-extract helper may be added if the implementer can't avoid it; flagged in plan §5.

---

## 7. Locked Decisions (Boss decisions referenced from `PROVIDER_CORE_PLAN_v0.2.md` §9)

**D1 — Custom Provider fields** → **3 fields: Provider Name + Base URL + API Key.** Optional fields: model prefix / model list. Boss-confirmed in v0.2.

**D2 — Provider Core scope** → **Architecture covers both image AND research from day one; implementation order = image-first, research-second.** Boss-confirmed in v0.2 §9 D2.

**D3 — Default route** → **`gpt-image-2/edit` when a reference image is present, `gpt-image-2` otherwise.** Fallback chain configurable per operator; Mock is **not** silently substituted for missing real-provider config (operator opt-in only).

**D4 — Key handling track** → **v1 ships Electron `safeStorage` in main process** (auto-fallback to AES-on-disk if encryption unavailable, logged). **v2 (later phase): OS keychain / cloud KMS.** Renderer cannot read plaintext after save.

**D5 — Architecture commitment** → **Renderer never calls provider APIs directly in the final architecture.** Phase 3's renderer-side `fetch` calls are removed during Phase 4 P4.2 (Electron IPC wiring).

**D6 — Research feeds composition** → **Web Research / Insight Mining output flows into Creative Brief + Prompt Composer.** It is not a standalone artifact for human-only reading; it is a structured input to prompt generation. Boss v0.2 correction §1.

**D7 — Media store** → **`tmp-generated/` + `approved/` + 7-day TTL cleanup hook from Phase 3 stays as-is.** Owner moves from `electron/main.cjs` to `packages/provider-core/src/media-store.js`, called by `main.cjs` through IPC. No behavior change.

**D8 — Untrusted webpage content** → **All `web_fetch` content is sanitized before being passed to any LLM or research extractor.** Provenance preserved in `sources.json`; injection attempts logged and quoted, never executed.

These eight decisions are now part of the binding spec for Phase 4 implementation.

---

## 8. Non-Goals & Anti-Patterns

- ❌ No silent fallback to Mock for real-provider work. Mock is dev/offline only by default.
- ❌ No "smart" provider selection beyond the operator-configured fallback chain. The router does not second-guess the operator.
- ❌ No automatic key rotation, no remote key fetching, no SSO. Keys are operator-pasted only.
- ❌ No retry-with-backoff. One attempt per provider per request; on failure, the router moves to the next.
- ❌ No reading API keys from environment variables. Keys come from Settings only. (Env-reading is a future hardening discussion; not part of v1.)
- ❌ No streaming image output. Same as Phase 3.
- ❌ No cost meter / usage dashboard in this phase.
- ❌ No mixing renderer-side and main-side provider code paths post-extraction. Once IPC ships, the renderer-side `fetch` paths are deleted, not left as dead code.
- ❌ No exposing `getKey` on the preload bridge. Renderer can only check `hasKeyFor` and call `clearKey`/`setKey`.
- ❌ No package-level "if-cloud-then-X" branches in `packages/provider-core`. The package is cloud-agnostic; cloud integration is a separate package or a swapped `KeyVault` backend.

---

## 9. Glossary

| Term | Definition |
|---|---|
| Provider | A concrete adapter satisfying the `ImageProvider` contract: OpenAI, Gemini, Kie.ai, Fal.ai, Custom (OpenAI-compatible), Mock |
| Provider Core | The `packages/provider-core/` package — Electron-main-safe, no React/Electron deps, future cloud-portable |
| Provider Registry | The lookup table mapping provider id → metadata + adapter instance |
| Custom Provider | An OpenAI-compatible HTTP endpoint registered with a 3-field user-facing config: Name, Base URL, Key |
| `image_generate` contract | The single tool-call shape that handles both text-to-image (generate) and image-edit (edit) routes, inspired by OpenClaw |
| Edit-mode | A generation that consumes one or more reference images; default model `gpt-image-2/edit` when OpenAI is active |
| Generate-mode | A generation with no reference image; default model `gpt-image-2` when OpenAI is active |
| Insight Brief | Structured product + customer + market + creative-direction JSON produced by the research pipeline |
| Creative Brief | Per-SKU narrative direction derived from the Insight Brief; consumed by the prompt composer |
| Prompt Composer | The Phase 2 component that turns a template + slot-vars into a composed prompt; Phase 4 extends it to consume brief fields |
| KeyVault | The `packages/provider-core/src/key-vault.js` interface for storing/retrieving provider keys. v1 backend = Electron `safeStorage`; v2 = OS keychain or cloud KMS |
| Fallback router | The component that, on primary failure, walks the operator-configured chain to find a serving provider |
| Served provider | The provider that actually produced the image, surfaced on every SlotCard |
| Media store | The `tmp-generated/` + `approved/` directory pair under each SKU, with 7-day TTL on temp |
| IPC namespace | `swtd:provider:*` — the only channel through which the renderer reaches Provider Core |
| `swtd-asset://` | The existing custom protocol used to render SKU-scoped images in the renderer without exposing raw filesystem paths |

---

**End of spec.md.** Implementation does not begin until Boss reviews this document, the companion [`plan.md`](./plan.md), and the executable [`tasks.md`](./tasks.md), and explicitly approves them in the runbook.
