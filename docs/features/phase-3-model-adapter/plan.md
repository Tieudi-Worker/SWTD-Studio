# Implementation Plan — Phase 3: Model Provider Adapter

**Spec:** [`spec.md`](./spec.md)
**Owner:** Boss (thondptit@gmail.com)
**Created:** 2026-05-15
**Status:** Planning — no app code touched in this run

---

## 1. Technical Context

| Field | Value |
|---|---|
| Language(s) | JavaScript (ES modules in renderer; CommonJS in electron main if IPC chosen) |
| Frameworks | React 18 (renderer), no new deps |
| HTTP client | Native `fetch()` (browser + Electron renderer both have it) |
| Concurrency | Native `Promise` + `AbortController`; one in-flight generation at a time per slot |
| Storage | `localStorage` for keys (Q1 may upgrade to keychain) ; either in-memory `URL.createObjectURL` or on-disk via IPC (Q2 decides) |
| Guardrails | `SWTD_EXECUTION_PROTOCOL.md` v1.1, `karpathy-guidelines`, `tinbeta-coding-guardrail` |
| External APIs | FAL.ai REST (`https://fal.run/openai/gpt-image-2[/edit]`), OpenAI REST (`https://api.openai.com/v1/images/generations`) |

---

## 2. Constitution & Protocol Check

| Gate | Status | Note |
|---|---|---|
| Workflow: spec → plan → tasks → implement → verify → report | ✅ on track | Tasks in [`tasks.md`](./tasks.md); implementation gated on Boss approval (incl. Q1/Q2/Q3) |
| Skill loading reported in runbook | ⏳ this run | Will record in `TASK_RUNBOOK_PHASE_3.md` when implementation runs |
| Repo-scoped paths only | ✅ | All new files under `apps/desktop/src/lib/providers/`, `apps/desktop/src/components/shell/` |
| No config drift, no dep mutation | ✅ | Native APIs only; no `package.json` edits |
| No `runtime/**` touches | ✅ | Explicit spec §4 constraint; adapter is renderer-side parallel path |
| No `git push` planned | ✅ | Commits stay local until Boss says push |

No gate violations.

---

## 3. Source-Tree Targets (Read-Only Survey)

Names-only per protocol §3.3.

### New files (renderer)

| Path | Phase 3 role |
|---|---|
| `apps/desktop/src/lib/providers/types.js` | JSDoc `ImageProvider` interface contract |
| `apps/desktop/src/lib/providers/registry.js` | `PROVIDERS` array, `getActiveProvider()`, `setActiveProvider(id)` (persisted in `localStorage`) |
| `apps/desktop/src/lib/providers/mock-provider.js` | Wraps `mock-pipeline.js`; respects `AbortSignal`; returns synthetic placeholder image |
| `apps/desktop/src/lib/providers/fal-provider.js` | `fetch()` against `https://fal.run/openai/gpt-image-2`; aspect-ratio → `image_size` map; returns image bytes |
| `apps/desktop/src/lib/providers/openai-provider.js` | `fetch()` against `https://api.openai.com/v1/images/generations`; returns base64 → blob |
| `apps/desktop/src/lib/key-store.js` | `getKey(providerId) / setKey(providerId, value) / clearKey(providerId)` over `localStorage[swtd_provider_keys]` |
| `apps/desktop/src/components/shell/ProviderPicker.jsx` | Settings-modal-mounted UI: select + key input + test connection (Q3 may move to TopBar) |
| `apps/desktop/src/components/shell/SettingsModal.jsx` | Modal shell that hosts the ProviderPicker (only if Q3 = modal) |

### Modified files (renderer)

| Path | Phase 3 change |
|---|---|
| `apps/desktop/src/components/shell/TopBar.jsx` | Add a compact provider chip next to the MOCK badge that opens the Settings modal (or whatever Q3 chooses) |
| `apps/desktop/src/components/shell/SlotCard.jsx` | New `Generate` action button on the action row; disabled when `composedPrompt` is null; shows Cancel button while `state === 'generating'` |
| `apps/desktop/src/shell/Shell.jsx` | Active-provider state; `generateSlot(slotId)` dispatcher; `cancelSlotGeneration(slotId)`; map slot ID → in-flight AbortController; pipe provider events through the existing `handlePipelineEvent` router so the state machine + run timeline stay consistent |
| `apps/desktop/src/lib/i18n.js` | New keys: `provider.picker.*`, `provider.test.*`, `provider.warning.*`, `slot.action.generate`, `slot.action.cancel`, `provider.fallback.mock_used` |
| `apps/desktop/src/styles/shell.css` | Styles for `ProviderPicker`, `SettingsModal` (if used), Generate/Cancel button states |

### Electron additions (Boss Q2 lock — temp cache with TTL)

| Path | Phase 3 change |
|---|---|
| `apps/desktop/electron/main.cjs` | 3 new IPC handlers (`swtd:save-generated-image`, `swtd:list-tmp-generated`, `swtd:cleanup-tmp-generated`) under `<sku>/output/tmp-generated/`, all path-safety-guarded. One-regex extension to the `swtd-asset://` protocol's path guard so tmp-generated PNGs can be previewed. |
| `apps/desktop/electron/preload.cjs` | Expose `saveGeneratedImage(args)`, `listTmpGenerated(args)`, `cleanupTmpGenerated(args)` to the renderer |

### Untouched (forbidden surface)

| Path | Touched? |
|---|---|
| `runtime/**` | NO — explicit spec §4 |
| `packages/core/src/*.js` | NO |
| `package.json` / `package-lock.json` | NO |
| `electron/main.cjs` / `preload.cjs` | NO **if Q2 = in-memory blob**, otherwise minimal single-handler addition |

---

## 4. Architecture Approach

### 4.1 Provider Interface Contract

Documented as JSDoc typedef in `types.js`. Every provider implements exactly this shape — no extra public methods, no provider-specific knobs leaking into the registry.

```js
/**
 * @typedef {Object} GenerateRequest
 * @property {string} prompt           - composed prompt text (Phase 2 output)
 * @property {'1:1'|'4:5'|'9:16'} aspectRatio
 * @property {Blob[]} [referenceImages] - optional, for /edit endpoints. v1 may pass [].
 * @property {string} [quality]         - 'low'|'medium'|'high'; provider maps internally
 * @property {AbortSignal} signal       - cancellation signal
 *
 * @typedef {Object} GenerateResult
 * @property {Blob} imageBlob           - generated image bytes (PNG)
 * @property {string} mime              - 'image/png'
 * @property {number} elapsedMs
 * @property {Object} [providerMeta]    - provider-specific debugging info (NOT API key)
 *
 * @typedef {Object} ImageProvider
 * @property {string} id                - 'mock' | 'fal' | 'openai'
 * @property {string} label             - human-readable name
 * @property {boolean} requiresApiKey
 * @property {(req: GenerateRequest) => Promise<GenerateResult>} generate
 * @property {(apiKey: string) => Promise<{ ok: boolean, reason?: string }>} testConnection
 */
```

Contract rules:

1. `generate()` MUST honor `signal.aborted` — calling `controller.abort()` mid-flight aborts the underlying `fetch()` and rejects the promise with `{ name: 'AbortError' }`.
2. `generate()` MUST throw a structured error on non-2xx HTTP responses: `{ name: 'ProviderError', status: 401, reason: 'unauthorized' }`. No raw HTML or stack traces.
3. `testConnection()` MUST NOT produce a billable generation. For FAL/OpenAI, use a HEAD/`/v1/models` style probe or a 1×1 px size that bills minimally.
4. Providers MUST NOT read `localStorage` or any global state directly. The active key is passed by the dispatcher as part of the request.

### 4.2 Adapter file structure

```
apps/desktop/src/lib/providers/
├── types.js               (~40 lines — pure JSDoc typedefs, no runtime code)
├── registry.js            (~80 lines — provider list, active-id persistence, lookup helpers)
├── mock-provider.js       (~70 lines — wraps mock-pipeline, returns placeholder PNG)
├── fal-provider.js        (~150 lines — fetch, aspect-ratio map, error normalization)
└── openai-provider.js     (~130 lines — fetch, base64→Blob decode, error normalization)
```

Each file is independent — no cross-provider imports. The registry is the only place that knows about all three.

### 4.3 Key storage strategy (Q1-dependent)

**Recommended default (Option A, plain `localStorage`):**

```js
// key-store.js
const KEY = 'swtd_provider_keys'

export function getKey(providerId) {
  if (typeof localStorage === 'undefined') return ''
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    return parsed?.[providerId] || ''
  } catch { return '' }
}

export function setKey(providerId, value) { /* JSON merge, write back */ }
export function clearKey(providerId)      { /* JSON delete, write back */ }
```

**Hardening path if Q1 = Option B/C:**

- Option B: IPC pair `swtd:keystore-get / -set / -clear` reading a JSON in `app.getPath('userData')`.
- Option C: `electron-safestorage` wrappers (`encryptString` / `decryptString`) keyed by OS keychain.

Both alternatives keep the renderer-side `key-store.js` API identical; only the storage backend changes. Locking the API surface now lets us swap later without touching providers.

### 4.4 FAL adapter (REST)

```
POST https://fal.run/openai/gpt-image-2
Authorization: Key {apiKey}
Content-Type: application/json
Body: {
  prompt,
  image_size: aspectRatioToImageSize(ratio),  // { width, height } multiples of 16
  quality: 'high',
  num_images: 1,
  output_format: 'png'
}
```

Aspect-ratio map (multiples of 16, max 3840 edge, total pixels 655K–8.3M):

| Ratio | Width × Height |
|---|---|
| `1:1` | 2048 × 2048 |
| `4:5` | 1664 × 2080 |
| `9:16` | 1440 × 2560 |
| `16:9` | 2560 × 1440 |

Response shape (verified against FAL docs + meta-ads-generator-template reference):

```json
{
  "images": [{ "url": "https://...", "width": 2048, "height": 2048, "content_type": "image/png" }],
  "timings": { "inference": 18.5 }
}
```

Adapter fetches the image URL with a second `fetch()` to obtain bytes, then returns a Blob. Both fetches share the same `AbortController`.

### 4.5 OpenAI adapter (REST)

```
POST https://api.openai.com/v1/images/generations
Authorization: Bearer {apiKey}
Content-Type: application/json
Body: {
  model: 'gpt-image-2',
  prompt,
  n: 1,
  size: aspectRatioToOpenAiSize(ratio),  // '1024x1024' | '1024x1536' | '1536x1024'
  quality: 'high',
  response_format: 'b64_json'
}
```

Aspect-ratio map (per OpenAI's supported set; subset of FAL's):

| Ratio | OpenAI `size` |
|---|---|
| `1:1` | `'1024x1024'` |
| `4:5` | `'1024x1536'` |
| `9:16` | `'1024x1536'` (closest supported; document the substitution in UI) |
| `16:9` | `'1536x1024'` |

Response shape:

```json
{ "data": [{ "b64_json": "iVBORw0KGgo..." }] }
```

Adapter decodes the base64 → Uint8Array → Blob (`new Blob([bytes], { type: 'image/png' })`).

### 4.6 Mock adapter

Wraps `mock-pipeline.js` to satisfy the same interface. On `generate()`:

1. Returns a Promise that resolves after ~2 s with a placeholder PNG (a small in-memory generated SVG converted to PNG via canvas, or a static 200×200 transparent PNG).
2. Honors `signal.aborted` immediately.
3. Returns the same shape as real providers — caller code cannot tell mock from real except by image content.

The placeholder PNG can also embed text like `MOCK • slot N • {{aspect}}` for visual debuggability.

### 4.7 Renderer integration

```
Shell.jsx
  ├── activeProviderId state (default 'mock')
  ├── apiKeys state derived from localStorage
  ├── slotGenerationControllers: Map<slotId, AbortController>
  ├── generateSlot(slotId) callback:
  │     1. composed = composedPrompts[slotId]
  │     2. provider = getProvider(activeProviderId)
  │     3. if (provider.requiresApiKey && !apiKeys[providerId]) → fall back to mock + show banner
  │     4. dispatch synthetic 'queued' + 'generating' events through handlePipelineEvent
  │     5. await provider.generate({ prompt: composed.text, aspectRatio: composed.aspectRatio, signal })
  │     6. on success: store blob URL in slotGeneratedImages[slotId]; dispatch 'success' event
  │     7. on failure: dispatch 'failed' event with normalized reason
  └── cancelSlotGeneration(slotId) → controller.abort()

SlotCard.jsx
  ├── new Generate button (action row)
  ├── new Cancel button (visible only when state === 'generating')
  └── prefer slotGeneratedImages[slotId] over validator preview (so newly-generated images show)

ProviderPicker.jsx
  ├── select: Mock / FAL / OpenAI
  ├── per-provider key input + test button
  ├── warning chip
  └── on save: setActiveProvider(id) + setKey(providerId, value)
```

Synthetic event dispatch through `handlePipelineEvent` reuses the Phase 1 state machine + run timeline — no new state shapes. The mock adapter's events already match this shape; FAL/OpenAI adapters emit synthetic events from the dispatcher (Shell.jsx) at the start/end of `provider.generate()`.

### 4.8 Generated-image storage — Temp cache with 7-day TTL (Boss Q2 lock)

**Path:** `<sku>/output/tmp-generated/`

**Filename pattern:** `slot${slotId}-${timestamp}.png` + sidecar `slot${slotId}-${timestamp}.json`

**Sidecar metadata:**
```json
{
  "generatedAt": 1715769600000,
  "expiresAt":   1716374400000,
  "providerId":  "fal",
  "slotId":      1,
  "templateId":  "01-hero-clean",
  "angleId":     "default",
  "aspectRatio": "1:1"
}
```

**Three electron IPCs** (read+write, all path-safety guarded so the renderer cannot escape `<sku>/output/tmp-generated/`):

| IPC | Purpose |
|---|---|
| `swtd:save-generated-image` | `{ skuPath, slotId, providerId, templateId, angleId, aspectRatio, mime, bytes }` — write PNG + sidecar JSON; compute `generatedAt = Date.now()`, `expiresAt = generatedAt + 7d` |
| `swtd:list-tmp-generated` | `{ skuPath }` → `[{ slotId, file, generatedAt, expiresAt, providerId, ... }, ...]` — returns ONLY entries with `expiresAt > Date.now()` (expired ones get skipped, then deleted by the cleanup pass) |
| `swtd:cleanup-tmp-generated` | `{ skuPath }` — scan dir; delete every PNG+JSON pair where `expiresAt < Date.now()` OR sidecar is missing/malformed. Returns `{ ok: true, deleted: N }` |

**`swtd-asset://` path guard extension** (one-regex change in `main.cjs`):
```js
// before: /\/output\/(listing|aplus)\//i
// after:  /\/output\/(listing|aplus|tmp-generated)\//i
```

**Cleanup cadence:**

1. **App startup** — `useEffect` in `Shell.jsx` that runs once on mount; iterates known SKUs (if a workspace is already loaded) and calls cleanup for each.
2. **SKU open** — added to `chooseSku` after `loadBrandContext`; cleans the current SKU's tmp cache.
3. **Before a new generation** — `generateSlot` calls cleanup for the active SKU before dispatching the provider request, so a slot that's been generated 8 days ago gets its old PNG removed before a new one lands.

**Renderer-side state:** `slotTmpImages: { [slotId]: { url, generatedAt, providerId, ... } }` built from `swtd:list-tmp-generated` after every SKU open + every successful generation. `SlotCard.jsx` prefers `slotTmpImages[slotId].url` over the validator preview when both exist.

**Promote-to-final is out of scope** for Phase 3. A separate phase (or a manual operator copy) will move approved tmp images into `<sku>/output/listing/slotN.png` for the export flow.

### 4.9 Error normalization

Every provider returns a structured error:

```js
{
  name: 'ProviderError',
  providerId: 'fal' | 'openai' | 'mock',
  status?: number,                          // HTTP status if applicable
  reason: 'unauthorized' | 'rate-limited' | 'timeout' | 'network' | 'invalid-response' | 'aborted' | string,
  hint?: string                             // operator-facing one-liner
}
```

The renderer maps `reason → i18n key`. No raw HTML or stack traces ever surface in the UI.

---

## 5. Phase 0 Research (resolved decisions)

| Question | Decision | Rationale | Alternatives considered |
|---|---|---|---|
| HTTP client | Native `fetch()` + `AbortController` | Zero new deps, works in Electron renderer, supports streaming + abort | `axios` (bundle bloat) ; `@fal-ai/client` (extra dep, also fine but unnecessary for v1) |
| Provider interface shape | One sync method (`generate`) returning a Promise<Blob> | Matches existing async patterns; no callback hell | Stream/Observable (over-engineered for non-streaming responses) |
| Key storage | `localStorage` default; Q1 may upgrade | Renderer-side desktop tool, single-operator threat model | Keychain (overkill for v1; ship hardening as a follow-up) |
| Aspect-ratio handling | Provider-internal mapping | Each provider's pixel sizes differ; encapsulate in the adapter | Centralized map (couples provider concerns) |
| Image bytes transport | `Blob` everywhere | Native, works with `URL.createObjectURL` and `FormData` | `Uint8Array` (caller needs to wrap anyway) |
| Generated-image preview | `URL.createObjectURL(blob)` until persisted | Lightweight, no IPC needed for first-render | base64 (huge memory, slow render) |
| Error normalization | Structured `ProviderError` object | i18n + UI-friendly | Throwing strings (lossy) ; never throwing (hides failures) |

No `NEEDS CLARIFICATION` left except the three flagged in spec §7.

---

## 6. Phase 1 Design Outputs

| Artifact | File | Status |
|---|---|---|
| Feature spec | `docs/features/phase-3-model-adapter/spec.md` | ✅ written |
| Implementation plan | this file | ✅ |
| Task list | `docs/features/phase-3-model-adapter/tasks.md` | ✅ written |
| Data model | Inline in §4.1, §4.9 | — |
| Contracts | `ImageProvider` JSDoc in §4.1 | — |
| Quickstart | §8 below | — |

---

## 7. Risk & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| CORS blocks FAL/OpenAI from renderer origin | High — feature dead on arrival | Both providers have permissive CORS in production. If one blocks: add `swtd:provider-fetch` IPC that proxies the request through main.cjs (well-scoped, 30 LOC). Spec §A1/A2 calls this out. |
| API key leak via console.log | High — compromises operator's billing | Lint rule: grep over `apps/desktop/src/lib/providers/` for `console.log`/`console.error` of `apiKey`/`key`/`token` before merge. SC6 enforces. |
| Aborted request still consumes provider credit | Medium — wasted budget | FAL + OpenAI both bill on completion. Aborting mid-flight stops billing for FAL but OpenAI may have already charged. Document in UI tooltip: "Cancel after generation starts does not refund." |
| Mock placeholder image looks "real" and confuses operator | Low — visual diff | Embed text overlay `MOCK · slot N` on the placeholder; tint pink so it never reads as a real product image |
| Two concurrent generations from rapid clicks | Low | Slot state machine forbids `generating → generating`; the dispatcher disables the Generate button while a generation is in flight |
| OpenAI doesn't support 9:16 | Low — quality regression | Map to the closest supported `1024x1536` and show a "approximated to portrait" hint in the UI |
| Plain `localStorage` key gets pasted into screenshots | Medium | Mask the key field by default (show `••••`), reveal only on operator click + auto-hide after 30 s |
| Timeout fires before model completes | Low — failed false-positive | Set generous defaults: FAL 120 s, OpenAI 90 s. Most generations finish in 30–60 s. |
| Renderer bundle bloat from 3 providers | Low | All three providers combined: ~400 LOC + base64 utilities. Estimated +5–8 KB minified |

---

## 8. Quickstart (Run-and-See Walkthrough, Post-Implementation)

To be executed during the implementation run's verification step.

1. `cd apps/desktop && npm run dev`.
2. Open Settings (gear icon) → Provider section. Default = Mock. Confirm MOCK chip in TopBar.
3. Switch to FAL. Confirm warning: "API key required for real generation. Falls back to Mock until a key is saved."
4. Click "Test connection" with empty key → expect `unauthorized` error.
5. Paste a real FAL key. Click "Test connection" → expect `valid`.
6. Open a SKU with a template selected on slot 1. Click Generate on the slot.
7. Confirm slot transitions `idle → queued → generating` within one frame; preview shows shimmer (Phase 1 reuse).
8. Within ≤ 90 s, slot transitions to `success` with the generated image in the preview.
9. While another slot is generating, click Cancel → slot returns to `idle`; DevTools Network tab shows the in-flight request as `(canceled)`.
10. Switch provider to OpenAI; repeat steps 5–8 against an OpenAI key (size `1024x1024`).
11. Clear all keys; click Generate against FAL → mock placeholder image lands within ~2 s; UI shows banner "FAL not configured — used Mock instead."
12. Reload renderer; confirm active provider + key persist via `localStorage`.

All 12 checks pass → Phase 3 Done.

---

## 9. Open Items for Implementation Phase

All three Q-items are **resolved** in spec §7 (Boss-locked 2026-05-15). Remaining items for the implementer's judgment:

- Confirm CORS works for both providers from the Electron renderer origin before relying on direct `fetch()`; if blocked, swap to a `swtd:provider-fetch` IPC proxy (out-of-band, ~30 LOC).
- FAL `/edit` endpoint (reference-image upload) is **out of scope** for v1; text-to-image only. Phase 3.5 can add it.
- Settings modal does not include a cost meter in v1 — defer to a later cost-meter sub-feature.
- Placeholder PNG style for the mock adapter: a 1024×1024 canvas with brand-accent fill + overlay text `MOCK · slot N · {{aspect}}`. Final palette is implementer's choice; document in runbook.
