# Implementation Plan — Phase 4: Provider Core Architecture

**Spec:** [`spec.md`](./spec.md)
**Source-of-truth brief:** [`docs/architecture/PROVIDER_CORE_PLAN_v0.2.md`](../../architecture/PROVIDER_CORE_PLAN_v0.2.md)
**Owner:** Boss (thondptit@gmail.com)
**Created:** 2026-05-15
**Status:** Planning — no source code touched in this run. Implementation is gated on Boss sign-off of this plan + `tasks.md`.

---

## 1. Technical Context

| Field | Value |
|---|---|
| Language(s) | JavaScript (ES modules in `packages/provider-core` and renderer; CommonJS in Electron main/preload as today) |
| Frameworks | React 18 (renderer, unchanged); Electron 28 (main + preload, unchanged) |
| HTTP client | Native `fetch()` + `AbortController` in main process (Node 18+) |
| Concurrency | Native `Promise` + `AbortController`. One in-flight generation per slot. A small main-process queue may serialize per-provider requests if a provider rate-limits aggressively (deferred to implementation judgment) |
| Storage | **Keys:** Electron `safeStorage` (in main) backed by OS keychain when available; AES-on-disk fallback under `app.getPath('userData')/keys.vault` otherwise. **Media:** filesystem at `<sku>/output/{tmp-generated,approved}/` |
| Guardrails | `SWTD_EXECUTION_PROTOCOL.md` v1.1; `karpathy-guidelines`; `tinbeta-coding-guardrail`; `matt-git-guardrails-claude-code` |
| External APIs | OpenAI Images (`https://api.openai.com/v1/images/generations`, `/v1/images/edits`); Fal.ai (`https://fal.run/...`); Gemini (`https://generativelanguage.googleapis.com/v1beta/models/...`); Kie.ai (per provider docs); Custom OpenAI-compatible base URL set by operator |
| Project layout | New monorepo-style package `packages/provider-core` consumed by `apps/desktop` via relative path (no workspace tooling required; Electron main loads it directly) |

NEEDS CLARIFICATION: None remaining. Boss decisions D1–D8 in `spec.md` §7 resolve all open questions.

---

## 2. Constitution & Protocol Check

| Gate | Status | Note |
|---|---|---|
| Workflow: spec → plan → tasks → implement → verify → report | ✅ on track | This run produces the spec/plan/tasks bundle; implementation gated on Boss approval |
| Skill loading reported in runbook | ✅ this run | The runbook at `docs/dev/TASK_RUNBOOK_PHASE_4_PROVIDER_CORE.md` lists the five skills read (speckit-specify, speckit-plan, speckit-tasks, tinbeta-coding-guardrail, matt-git-guardrails-claude-code) |
| Repo-scoped paths only | ✅ | All new files live under `packages/provider-core/`, `apps/desktop/electron/`, `apps/desktop/src/` |
| No config drift, no dep mutation | ✅ | Native Node/Electron APIs only. Implementation may surface a tiny HTML-text extract dep need; if so, the implementer must surface that conflict before adding (per Phase 4 protocol) |
| No `runtime/**` touches | ✅ | Forbidden — see `spec.md` §4 and SC10 |
| No `git push` planned | ✅ | All commits stay local; tasks.md explicitly forbids `git push` and destructive ops |
| Provider-secret hygiene | ✅ | SC2 + SC4 cover renderer leakage; SC9 covers backend swap-ability of `KeyVault` |

No gate violations.

---

## 3. Source-Tree Targets (Read-Only Survey)

Names-only per protocol §3.3.

### New package — `packages/provider-core/`

| Path | Role |
|---|---|
| `packages/provider-core/package.json` | Package manifest. Entry point `src/index.js`. No dependencies; declared `type: "module"` |
| `packages/provider-core/src/index.js` | Re-exports the public surface: `createProviderCore({ keyVault, mediaStore, logger })` factory, the `ImageProvider` type, the `image_generate` and `web_research` entry points |
| `packages/provider-core/src/types.js` | JSDoc typedefs for `ImageGenerateInput`, `ImageGenerateResult`, `ImageProvider`, `ProviderError`, `WebResearchInput`, `InsightBrief`, `CreativeBrief`, `KeyVault`, `MediaStore` |
| `packages/provider-core/src/provider-registry.js` | `registerProvider`, `getProvider(id)`, `listProviders()`, `getDefaultRoute({ hasReferenceImage })`, `setRouteConfig(routeConfig)` |
| `packages/provider-core/src/model-catalog.js` | Per-provider model lists + capability flags (`{ supportsGenerate, supportsEdit, defaultGenerateModel, defaultEditModel, supportedAspectRatios, supportedQualities, supportedOutputFormats }`) |
| `packages/provider-core/src/image-generate.js` | The unified `image_generate(input)` entry point. Decides edit-vs-generate by presence of `images`/`image`. Honors fallback router. Writes through `media-store.js`. Returns normalized result |
| `packages/provider-core/src/image-edit.js` | Internal helper for edit-mode dispatch (separate file purely for readability; share-call-path with `image-generate.js`) |
| `packages/provider-core/src/fallback-router.js` | `route(input, providers, routeConfig)`: tries primary → next → next; returns `{ servedProvider, fallbackChain[], result | error }`. Hard-failure reasons that do NOT trigger fallback: `invalid-response`, `aborted` |
| `packages/provider-core/src/key-vault.js` | `KeyVault` interface + v1 implementation `createSafeStorageVault({ safeStorage, vaultFilePath, logger })`. AES-on-disk fallback path if `safeStorage.isEncryptionAvailable()` returns false. Public API: `getKey`, `setKey`, `clearKey`, `hasKey`, `listProvidersWithKeys` |
| `packages/provider-core/src/media-store.js` | Owner of `<sku>/output/{tmp-generated,approved}/`. Methods: `saveTmpImage`, `listTmpImages`, `cleanupExpired`, `promoteToApproved`. All path-safety guards live here |
| `packages/provider-core/src/web-research.js` | `web_search(query, opts)` + `web_fetch(url, opts)` adapters. v1 uses one search backend (operator-pickable: Google Programmable Search, Bing, or Custom via Custom Provider's base URL). HTML→text extraction. Returns raw evidence chunks |
| `packages/provider-core/src/insight-brief.js` | `buildInsightBrief({ urls, keywords, productName, productInsight, customerInsight, marketplace, depth })` — orchestrates `web-research`, runs extractors, sanitizes content, returns the structured `InsightBrief` JSON per spec §2 US5 schema |
| `packages/provider-core/src/creative-brief.js` | `buildCreativeBrief(insightBrief, sku)` — derives `style`, `mood`, `mustShow[]`, `mustAvoid[]` per SKU |
| `packages/provider-core/src/sanitize.js` | HTML-text extraction + prompt-injection neutralization (strip scripts, quote known injection markers, never let webpage text become an instruction passed to any model) |
| `packages/provider-core/src/error.js` | `ProviderError` factory; structured error normalization per `spec.md` glossary |
| `packages/provider-core/src/logger.js` | Tiny wrapper that omits any field named `apiKey`/`key`/`token`/`bearer` from log lines |
| `packages/provider-core/src/providers/openai.js` | OpenAI adapter: `generate` → `/v1/images/generations`; `edit` → `/v1/images/edits` (multipart). `testConnection` → cheap `/v1/models` HEAD-style probe |
| `packages/provider-core/src/providers/gemini.js` | Gemini adapter: multimodal generate/research entry points. `edit` capability flag = false in v1 (documented in `model-catalog.js`) |
| `packages/provider-core/src/providers/kie.js` | Kie.ai adapter: per-model dispatch (`nano-banana-pro` / `seedream` / `kling`). Both generate + edit if model supports it |
| `packages/provider-core/src/providers/fal.js` | Fal.ai adapter: per-model dispatch (`flux-*`, `openai/gpt-image-2`, optionally `openai/gpt-image-2/edit` once file-storage upload lands in a later phase). v1 = text-to-image only |
| `packages/provider-core/src/providers/custom-openai-compatible.js` | OpenAI-shape adapter parameterized by `{ name, baseUrl, apiKey, modelPrefix? }`. Routes `generate` to `${baseUrl}/v1/images/generations` (or `${baseUrl}/${modelPrefix}/images/generations` if `modelPrefix` set). Same auth header style as OpenAI |
| `packages/provider-core/src/providers/mock.js` | Synthetic placeholder generator; respects `signal`; never auto-substituted unless operator opt-in |
| `packages/provider-core/test/` | Unit tests scaffolded but optional in v1 (per protocol — tests are encouraged but not gating). Decision deferred to implementer |

### Modified — `apps/desktop/electron/`

| Path | Change |
|---|---|
| `apps/desktop/electron/main.cjs` | Replace Phase 3's `swtd:save-generated-image` / `swtd:list-tmp-generated` / `swtd:cleanup-tmp-generated` handlers with the unified `swtd:provider:*` namespace (see §4.6). Compose `KeyVault`, `MediaStore`, and `createProviderCore()` once at app boot. Register IPC handlers that delegate. Keep `swtd-asset://` protocol untouched (already covers `tmp-generated/`) |
| `apps/desktop/electron/preload.cjs` | Replace per-IPC `ipcRenderer.invoke('swtd:save-generated-image', …)` exposures with the single `window.swtdProvider.{listProviders, saveKey, hasKeyFor, clearKey, testProvider, generateImage, editImage, researchInsight, getInsightBrief, listTmpImages, cleanupTmp, promoteToApproved, getRouteConfig, setRouteConfig}` surface. **No** `getKey` exposed |

### Modified — `apps/desktop/src/`

| Path | Change |
|---|---|
| `apps/desktop/src/lib/providers/registry.js` | Replace renderer-side provider list with a thin proxy that calls `window.swtdProvider.listProviders()`. Eventually the file is deleted; in P4.2 it becomes a 20-line shim |
| `apps/desktop/src/lib/providers/{mock,fal,openai}-provider.js` | DELETE after P4.2 cutover. The renderer no longer holds adapter code |
| `apps/desktop/src/lib/providers/types.js` | DELETE or move to `packages/provider-core/src/types.js` (single source of truth) |
| `apps/desktop/src/lib/key-store.js` | DELETE after P4.2 migration; replaced by `window.swtdProvider.{hasKeyFor,clearKey,setKey}` |
| `apps/desktop/src/lib/tmp-cache.js` | Repoint to the new IPC names under `swtd:provider:*`. File can remain as a renderer-side convenience wrapper |
| `apps/desktop/src/components/shell/SettingsModal.jsx` | Extend to host 5 provider tabs (one per group). Each tab uses the same `ProviderSettingsTab.jsx` component, parameterized by provider id + `authFields` schema |
| `apps/desktop/src/components/shell/ProviderSettingsTab.jsx` (new) | Generic single-provider settings panel. Reads `authFields` from `listProviders()`; renders fields; saves via `saveKey`; runs `testProvider` |
| `apps/desktop/src/components/shell/ProviderPicker.jsx` | Slim to a "default provider" selector + route-config UI; key fields move to the per-tab `ProviderSettingsTab.jsx` |
| `apps/desktop/src/components/shell/SlotCard.jsx` | Add `servedProvider` badge with tooltip showing `fallbackChain`; on fallback, badge styling indicates substitution |
| `apps/desktop/src/components/shell/MainCanvas.jsx` | Add a Brief Step (research input form) that triggers `swtdProvider.researchInsight(...)` and renders the resulting brief inline (read-only) |
| `apps/desktop/src/shell/Shell.jsx` | (a) one-time migration step `migratePhase3LocalStorageKeys()` on first launch; (b) replace `generateSlot` to call `swtdProvider.generateImage(...)` and consume `servedProvider` in event mapping; (c) add `researchInsight` state + dispatcher; (d) extend Prompt Composer hook to read the SKU's `insight-brief.json` and merge brief-derived variables before composition |
| `apps/desktop/src/lib/i18n.js` | New keys: `provider.settings.tab.{openai,gemini,kie,fal,custom}`, `provider.served_via`, `provider.fallback_used`, `provider.route.config.*`, `research.input.*`, `research.brief.*`, `provider.error.all_providers_failed`, `provider.error.provider_unsupported_edit` (EN + VI) |
| `apps/desktop/src/styles/shell.css` | Styles for the 5-tab Settings layout, `servedProvider` badge, research input form, brief preview block |

### Modified — `docs/architecture/`

| Path | Change |
|---|---|
| `docs/architecture/PROVIDER_CORE_ARCHITECTURE.md` (new) | Companion to the v0.2 brief: locks the package layout, IPC namespace, contracts, and migration plan. Mirrors §4 of this plan but as a stable architecture reference rather than a planning doc |

### Untouched (forbidden surface)

| Path | Touched? |
|---|---|
| `runtime/**` | NO — explicit `spec.md` §4 + SC10 |
| `package.json` / `package-lock.json` at repo root | NO (the new `packages/provider-core/package.json` is internal-only; no root-level dep changes) |
| `data/**` (SKU directories) | NO (writes only into `<sku>/output/{tmp-generated,approved}/` and `<sku>/research/`, both already in scope per Phase 3) |
| Phase 1 `mock-pipeline.js` | NO (used unchanged by the new mock provider) |

---

## 4. Architecture Approach

This section is the load-bearing one. Every architecture requirement from the runbook is addressed here, and every cross-reference back to `spec.md` US1–US6 is explicit.

### 4.1 Package layout & IPC boundary (covers US2, SC4, D5)

```
Renderer (apps/desktop/src/**)
   │  IPC (swtd:provider:*)
   ▼
Electron main (apps/desktop/electron/main.cjs)
   │  function calls
   ▼
packages/provider-core/src/index.js  ← createProviderCore({ keyVault, mediaStore, logger })
   │
   ├─ provider-registry.js
   ├─ image-generate.js  → fallback-router.js → providers/{openai,gemini,kie,fal,custom,mock}.js
   ├─ web-research.js    → providers/* (search adapters) + sanitize.js
   ├─ insight-brief.js   → creative-brief.js
   ├─ key-vault.js       (safeStorage backend; AES-on-disk fallback)
   └─ media-store.js     (<sku>/output/{tmp-generated,approved}/, 7-day TTL)
```

Key boundary rules:

1. The renderer never imports anything from `packages/provider-core` directly. It only calls `window.swtdProvider.*`, which is the preload-exposed IPC bridge.
2. `packages/provider-core` has **zero** Electron-specific imports. It accepts `safeStorage` (or a polyfill) as an injected dependency through `createProviderCore({ keyVault })`. This makes the package cloud-portable in the future (a cloud backend can pass a `KeyVault` backed by a cloud secret store).
3. `apps/desktop/electron/main.cjs` is the single place that:
   - constructs the `KeyVault` (via Electron `safeStorage`),
   - constructs the `MediaStore` (filesystem),
   - constructs the `ProviderCore` instance and stashes it on a module-scope variable,
   - registers each IPC handler under `swtd:provider:*` and delegates to the instance.
4. Renderer `apps/desktop/src/lib/providers/*` (Phase 3's `fal-provider.js` / `openai-provider.js` / `mock-provider.js`) is deleted after the IPC bridge is wired and the migration completes. We do not leave dual code paths.

### 4.2 IPC namespace (`swtd:provider:*`)

All renderer↔main provider traffic flows through one namespace. Each handler validates input shape, sanitizes paths, never echoes secrets in responses.

| IPC channel | Renderer call | Returns |
|---|---|---|
| `swtd:provider:list` | `swtdProvider.listProviders()` | `[{ id, label, authFields, capabilities, models, hasKey }]` — never includes plaintext keys |
| `swtd:provider:save-key` | `swtdProvider.saveKey(id, value)` | `{ ok: true }` — value is consumed inside main, never re-emitted |
| `swtd:provider:has-key` | `swtdProvider.hasKeyFor(id)` | `{ has: boolean }` |
| `swtd:provider:clear-key` | `swtdProvider.clearKey(id)` | `{ ok: true }` |
| `swtd:provider:test` | `swtdProvider.testProvider(id)` | `{ ok: boolean, reason?: 'unauthorized' \| 'rate-limited' \| 'network' \| 'invalid-response' }` |
| `swtd:provider:get-route-config` | `swtdProvider.getRouteConfig()` | `{ primary: string, fallbackChain: string[], allowMockFallback: boolean }` |
| `swtd:provider:set-route-config` | `swtdProvider.setRouteConfig(cfg)` | `{ ok: true }` |
| `swtd:provider:generate-image` | `swtdProvider.generateImage(input)` | `{ ok, slotId, file, sidecarPath, servedProvider, fallbackChain[], elapsedMs }` |
| `swtd:provider:edit-image` | `swtdProvider.editImage(input)` | (same shape as above; explicit alias for callers that know they're doing edit-mode) |
| `swtd:provider:research-insight` | `swtdProvider.researchInsight(input)` | `{ ok, briefPath, sourcesPath, brief }` |
| `swtd:provider:get-insight-brief` | `swtdProvider.getInsightBrief(skuPath)` | `{ brief: InsightBrief \| null }` (reads the persisted file; null if not yet built) |
| `swtd:provider:list-tmp-images` | `swtdProvider.listTmpImages(skuPath)` | `[{ slotId, file, generatedAt, expiresAt, servedProvider, mode, model }]` |
| `swtd:provider:cleanup-tmp` | `swtdProvider.cleanupTmp(skuPath)` | `{ ok, deleted: N }` |
| `swtd:provider:promote-to-approved` | `swtdProvider.promoteToApproved(args)` | `{ ok, file }` |

Critical: **`swtd:provider:get-key` does NOT exist.** There is no IPC for reading plaintext keys back to the renderer.

### 4.3 `image_generate` unified contract (covers US3, D3)

```ts
type ImageGenerateInput = {
  prompt: string
  model?: string                 // override per-provider default
  provider?: string              // override the registry default route
  images?: string[]              // array of reference images (paths or swtd-asset:// URIs); routes to edit-mode
  image?: string                 // single reference image; routes to edit-mode (sugar over images:[…])
  size?: string                  // e.g. '2048x2048'
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'
  resolution?: '1K' | '2K' | '4K'
  quality?: 'low' | 'medium' | 'high' | 'auto'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  background?: 'transparent' | 'opaque' | 'auto'
  count?: number                 // v1 ignored; always 1 produced
  timeoutMs?: number
  slotId?: string | number       // for media-store filename + metadata
  skuPath?: string               // required for media-store write
}
```

Decision tree inside `image-generate.js`:

```
input.image || input.images?.length > 0
   ? mode = 'edit'
       → default model: provider.capabilities.defaultEditModel
           e.g. OpenAI = 'gpt-image-2/edit', Kie nano-banana-pro = its edit variant
       → if provider does not support edit, fallback-router picks next provider that does
   : mode = 'generate'
       → default model: provider.capabilities.defaultGenerateModel
           e.g. OpenAI = 'gpt-image-2'
```

Default route (D3): **OpenAI `gpt-image-2/edit` if `images`/`image` present, else OpenAI `gpt-image-2`**. Operator can change the primary via `setRouteConfig`.

Output normalization: every result resolves to `{ file, sidecarPath, servedProvider, fallbackChain[], mode, model, mime, elapsedMs }`. Bytes are persisted to `<sku>/output/tmp-generated/slot{N}-{ts}.png` by `media-store.js`; renderer gets a `swtd-asset://` URL to render.

### 4.4 Provider Registry, model catalog, and the 5 providers (covers US1, D1, D2)

`provider-registry.js` is a small in-memory table populated at boot:

```js
register({
  id: 'openai',
  label: 'OpenAI',
  authFields: [
    { id: 'apiKey', type: 'secret', label: 'API Key', required: true },
    { id: 'defaultImageModel', type: 'select', options: ['gpt-image-2', 'gpt-image-2/edit', 'gpt-image-1.5'], default: 'gpt-image-2' },
    { id: 'defaultQuality', type: 'select', options: ['low', 'medium', 'high', 'auto'], default: 'high' },
    { id: 'outputFormat', type: 'select', options: ['png', 'jpeg', 'webp'], default: 'png' },
  ],
  capabilities: { supportsGenerate: true, supportsEdit: true, defaultGenerateModel: 'gpt-image-2', defaultEditModel: 'gpt-image-2/edit' },
  generate: openai.generate,
  edit: openai.edit,
  testConnection: openai.testConnection,
})
```

The five providers and their v1 capabilities/fields:

| id | Label | authFields (UI surface) | supportsGenerate | supportsEdit (v1) | defaultGenerateModel | defaultEditModel |
|---|---|---|---|---|---|---|
| `openai` | OpenAI | apiKey, defaultImageModel, defaultQuality, outputFormat | ✅ | ✅ | `gpt-image-2` | `gpt-image-2/edit` |
| `gemini` | Gemini | apiKey, defaultModel | ✅ | ❌ (deferred) | provider default | n/a |
| `kie` | Kie.ai | apiKey, defaultModelGroup ∈ {`nano-banana-pro`, `seedream`, `kling`} | ✅ | ✅ (model-dependent; flag set by `model-catalog.js`) | varies | varies |
| `fal` | Fal.ai | apiKey, defaultModel | ✅ | ❌ in v1 (FAL `/edit` needs file-upload step deferred to a follow-up) | `openai/gpt-image-2` via Fal | n/a |
| `custom` | Custom (OpenAI-compatible) | **providerName** (display), **baseUrl**, **apiKey**, optional `modelPrefix`, optional `models[]` | ✅ | ✅ if `baseUrl` is OpenAI-shape and operator confirms | operator-set | operator-set |
| `mock` | Mock | (none) | ✅ | ✅ | placeholder | placeholder |

`model-catalog.js` encodes per-model `{ supportedAspectRatios[], supportedQualities[], supportedOutputFormats[], maxPixels }` so the dispatcher can validate input before sending a call. Unsupported combinations are rejected with `ProviderError{ reason: 'invalid-input', hint: 'aspect ratio 9:16 not supported by gemini/imagen-3' }` rather than burning a request.

### 4.5 Web Research → Insight Brief → Creative Brief → Prompt Composer (covers US5, D6, D8)

`packages/provider-core/src/web-research.js`:

```js
// public surface
export async function webSearch(query, opts)  // returns [{ title, url, snippet, source }]
export async function webFetch(url, opts)     // returns { url, fetchedAt, contentType, textBody, rawBytesLength, sanitized: true|false }
```

`webFetch`:

1. Performs a Node `fetch` from main process (no CORS).
2. Reads `Content-Type`; only `text/html`, `text/plain`, and a few common documents are accepted.
3. Strips `<script>`, `<style>`, `<noscript>`. Preserves `<meta>` for title/description.
4. Extracts visible text via a small DOM-text walker (implementer may choose a tiny dep here only if absolutely necessary; otherwise hand-roll, see plan §5 Decision-7).
5. Runs `sanitize.js`:
   - Quotes (does not delete) any line matching known prompt-injection markers (e.g. case-insensitive `ignore previous instructions`, `you are now`, `system:`, `assistant:`, `### instruction`, base64 walls > 2 KB).
   - Wraps the entire extracted body in `<UNTRUSTED_WEB_CONTENT>` … `</UNTRUSTED_WEB_CONTENT>` sentinel before any downstream LLM call sees it.
6. Returns `{ ..., textBody: sanitizedString, sanitized: true }`.

`insight-brief.js`:

```js
export async function buildInsightBrief({ urls, keywords, productName, productInsight, customerInsight, marketplace, depth }, { providerCore, sku, logger }) {
  // 1. fetch all urls in parallel; produce evidence[]
  // 2. for each keyword + productName, run webSearch; merge into evidence[]
  // 3. run extractors:
  //     - extractProductFacts(evidence) → { name, category, materials, features, differentiators }
  //     - extractCustomerInsight(evidence, userProvidedCustomerInsight) → { audience, painPoints, desires, buyingTriggers, language }
  //     - extractMarketContext(evidence, marketplace) → { competitors, visualPatterns, claims, risks }
  // 4. write <sku>/research/sources.json and <sku>/research/insight-brief.json
  // 5. return { brief, sources, briefPath, sourcesPath }
}
```

`creative-brief.js`:

```js
export function buildCreativeBrief(insightBrief, sku) {
  // derives { style, mood, mustShow[], mustAvoid[] } from product.differentiators, customer.buyingTriggers,
  // market.visualPatterns, and market.claims/risks. Writes <sku>/research/creative-brief.json
}
```

Prompt Composer extension (renderer-side change in `Shell.jsx`):

- On every prompt composition, if `<sku>/research/insight-brief.json` exists, merge into the variable bag:
  - `{{product.materials}}`, `{{product.features}}`, `{{customer.painPoints}}`, `{{customer.language}}`, `{{creative.mustShow}}`, `{{creative.mustAvoid}}`, etc.
- These tokens become available to all Phase 2 templates without requiring template-author changes; existing templates that reference them gain content, others stay unchanged.

**Trust boundary (D8):** webpage content is wrapped in the `<UNTRUSTED_WEB_CONTENT>` sentinel before reaching any LLM-style extractor. Extractors are explicitly prompted (or coded) to treat anything inside that sentinel as raw observation, not instruction. The injection-line quoting in `sanitize.js` is the defense-in-depth layer.

### 4.6 Media store (covers D7, US3 acceptance, SC8)

`packages/provider-core/src/media-store.js` owns:

- `saveTmpImage({ skuPath, slotId, bytes, mime, providerId, model, mode, promptHash, sourceImages[], aspectRatio })` → writes `<sku>/output/tmp-generated/slot{N}-{ts}.{ext}` + sidecar JSON, computes `generatedAt = Date.now()`, `expiresAt = generatedAt + 7 * 24 * 60 * 60 * 1000`. All paths run through a single `assertInsideSku(skuPath, candidate)` guard.
- `listTmpImages({ skuPath })` → reads the dir; returns only entries with `expiresAt > Date.now()`; entries with missing/malformed sidecars are listed in a separate `corrupt[]` array for debugging but never returned as live.
- `cleanupExpired({ skuPath })` → deletes every PNG/JSON pair with `expiresAt < Date.now()` OR missing/malformed sidecar. Returns `{ ok, deleted }`.
- `promoteToApproved({ skuPath, slotId, sourceFile, destFile })` → copies a tmp file to `<sku>/output/approved/`. Approved files have **no TTL** and are not auto-deleted. (UI for promotion is out of scope for v1; the IPC is implemented for forward compatibility.)

Cleanup hooks remain identical to Phase 3:

1. App startup (`Shell.jsx` initial mount runs cleanup for any open SKU).
2. SKU open (`chooseSku` runs cleanup after brand-context load).
3. Before each new generate (`image-generate.js` calls `cleanupExpired` for the SKU before dispatching).

`swtd-asset://` protocol does not change; it already covers `tmp-generated/` per Phase 3 (verified).

### 4.7 Key handling v1 (covers US4, D4)

Interface (`key-vault.js`):

```js
/**
 * @typedef {Object} KeyVault
 * @property {(providerId: string) => Promise<string|null>} getKey      // only called inside main; never exposed to renderer
 * @property {(providerId: string, value: string) => Promise<void>} setKey
 * @property {(providerId: string) => Promise<void>} clearKey
 * @property {(providerId: string) => Promise<boolean>} hasKey
 * @property {() => Promise<string[]>} listProvidersWithKeys
 */
```

v1 backend (`createSafeStorageVault`):

1. Vault file: `app.getPath('userData')/keys.vault` (JSON, but the value of each key is `safeStorage.encryptString(plaintext).toString('base64')`).
2. On boot: if `safeStorage.isEncryptionAvailable() === true`, use it. Else log a single explicit warning and fall back to AES-256-GCM with a key derived via `scrypt` from a machine-specific salt stored next to the vault. (This is weaker than the OS keychain but better than plaintext; ship it with the warning surfaced in Settings.)
3. `getKey(id)` decrypts on read; `setKey` encrypts on write; `clearKey` removes the entry; `listProvidersWithKeys` returns ids only.
4. The renderer never sees `getKey`. The preload bridge exposes only `hasKeyFor` / `setKey` / `clearKey`. (Note: `setKey` is one-way — the renderer sends a plaintext value into main, where it's immediately encrypted; the value is then unreachable from the renderer.)

Migration from Phase 3:

```
on first Phase 4 launch:
  if localStorage[swtd_provider_keys] exists AND localStorage[swtd_provider_keys_migrated_at] missing:
     parse the JSON blob
     for each providerId in blob:
        ipcRenderer.invoke('swtd:provider:save-key', providerId, blob[providerId])
     localStorage.setItem('swtd_provider_keys_migrated_at', new Date().toISOString())
     localStorage.removeItem('swtd_provider_keys')
     show a one-time toast: "Provider keys migrated to secure local storage"
```

v2 path (documented, not built in P4):

- Swap `createSafeStorageVault` with `createKeychainVault` (e.g., `keytar` or a custom NAPI binding) or `createCloudKmsVault` (for a future cloud deployment).
- No provider code changes; `key-vault.js` is the seam.

### 4.8 Fallback router with transparent UI (covers US6)

`fallback-router.js`:

```js
async function route(input, providers, routeConfig, { logger, abortSignal }) {
  const chain = computeChain(input, routeConfig)
  // chain example for edit-mode with input.images present:
  //   ['openai', 'kie', 'custom']   (skips gemini/fal in v1 because supportsEdit=false)
  //   plus 'mock' only if routeConfig.allowMockFallback === true

  const attempted = []
  for (const providerId of chain) {
    const provider = providers.get(providerId)
    try {
      const result = await provider.execute(input, abortSignal)   // generate or edit
      return { servedProvider: providerId, fallbackChain: attempted, result }
    } catch (err) {
      attempted.push({ providerId, reason: err.reason ?? 'network', status: err.status })
      if (err.reason === 'invalid-response' || err.name === 'AbortError') {
        throw err   // do not auto-fallback on these
      }
      continue
    }
  }
  throw new ProviderError({ reason: 'all-providers-failed', attempted })
}
```

UI surface:

- Every `SlotCard` reads `servedProvider` from the slot's last-generation metadata and renders a small badge ("via Fal.ai · Flux"). When `servedProvider !== fallbackChain[0]`, the badge has a "fallback" visual treatment + tooltip listing the chain.
- The Run Timeline pane (Phase 2 reuse) shows the chain entries as sub-events under the slot's row, so the operator can see the failure sequence inline.

### 4.9 Error normalization

Same shape as Phase 3, extended:

```js
{
  name: 'ProviderError',
  providerId: 'openai' | 'gemini' | 'kie' | 'fal' | 'custom' | 'mock',
  status?: number,
  reason: 'unauthorized' | 'rate-limited' | 'timeout' | 'network' | 'invalid-response' | 'invalid-input'
        | 'aborted' | 'provider-unsupported-edit' | 'all-providers-failed' | string,
  hint?: string,
  attempted?: Array<{ providerId, reason, status }>   // only on 'all-providers-failed'
}
```

The renderer maps `reason → i18n key`. Raw HTML/stack traces never reach UI. Logs scrub `apiKey`, `token`, `bearer`, `Authorization` headers before emit.

### 4.10 Concurrency, timeouts, cancellation

- Each `generateImage` call creates an `AbortController` in main process. The IPC handler returns its controller id to the renderer; the renderer's Cancel button calls `swtd:provider:cancel-generation` with that id. (Or, simpler: keep cancellation in main as a Map keyed by `{skuPath, slotId}`; renderer just sends a cancel IPC.)
- Per-provider timeouts move to `model-catalog.js`: FAL 120 s, OpenAI 90 s, Gemini 90 s, Kie 120 s, Custom 90 s (default; can be overridden via `timeoutMs` per call).
- Fallback router does not retry after a `timeout` on the same provider — it moves to the next.

---

## 5. Phase 0 Research (resolved decisions)

| # | Question | Decision | Rationale | Alternatives considered |
|---|---|---|---|---|
| 1 | Where do provider HTTP calls live? | Electron main, via `packages/provider-core` | Renderer leakage of keys is the dominant risk; main is cloud-portable | Renderer-only (Phase 3, rejected for v2) ; renderer-with-proxy IPC (half-measure, still leaks at boot) |
| 2 | Package layout vs single file | Dedicated `packages/provider-core` package | Cleanly separates concerns; package boundary forbids React/Electron imports leaking in | Inline under `apps/desktop/src/lib/provider-core/` (rejected: pulls Electron into renderer eventually) |
| 3 | Key vault backend | Electron `safeStorage` with AES-on-disk fallback | Ships today on all 3 OSes Boss uses; `keytar` is a v2 upgrade behind the same interface | Plaintext localStorage (Phase 3 only) ; `keytar` (extra native dep, deferred) |
| 4 | Image_generate contract shape | OpenClaw-inspired single tool; edit/generate dispatched by presence of `image(s)` | Matches Boss's brief and the source-of-truth plan v0.2; collapses 5 providers into one API | Separate `image-generate` and `image-edit` IPCs (rejected: doubles the surface) |
| 5 | Reference-image semantics | At least one of `image` / `images[]` → edit-mode | Mirrors OpenClaw `image_generate` tool semantics | Explicit `mode: 'edit'\|'generate'` field (rejected: redundant; surface is already implied by presence of image) |
| 6 | Custom Provider auth shape | OpenAI-compatible (Bearer header, `/v1/images/generations` route) by default; `modelPrefix` allows route rewrite | Covers 9router and similar proxies (Boss's stated use case) | Free-form per-request templates (rejected: too much surface) |
| 7 | HTML-text extraction | Hand-rolled minimal DOM-walker in `sanitize.js`; add `linkedom` or `node-html-parser` only if hand-roll proves brittle in smoke tests | Avoids a new npm dep until needed | `cheerio` (heavy) ; `jsdom` (much heavier) ; `linkedom` (light, deferred decision) |
| 8 | Search backend | Operator-pickable via Custom Provider's base URL; v1 ships with one default (Google Programmable Search or Bing API key in Settings); Mock backend always available for offline dev | Avoids hard-coding a specific search provider | Hard-code one (rejected: lock-in) |
| 9 | Prompt-injection defense | Sentinel-wrap + line-quoting of known markers in `sanitize.js`; sentinel respected by downstream extractors | Defense in depth; cheap; explainable to Boss | LLM-based "is this an injection?" check (rejected: expensive + uncertain) |
| 10 | Renderer-side adapter remnants | DELETE Phase 3 adapter files post-cutover; no dual paths | Avoids "looks orthogonal" drift per tinbeta-coding-guardrail Rule 8 | Keep both (rejected: drift risk) |
| 11 | Concurrency | Per-slot serialization in main (one in-flight generate per slot); cross-slot parallelism allowed | Matches Phase 3 contract; predictable for the operator | Global queue (rejected: throttles batch workflows) ; unbounded (rejected: easy to DOS provider) |
| 12 | Insight Brief storage location | `<sku>/research/insight-brief.json` + `<sku>/research/sources.json` | Brief is SKU-scoped; lives next to the SKU it describes; survives app restart | App-global cache (rejected: ties briefs to a workspace instead of the SKU) |

All `NEEDS CLARIFICATION` are resolved.

---

## 6. Phase 1 Design Outputs

| Artifact | Path | Status |
|---|---|---|
| Feature spec | `docs/features/phase-4-provider-core/spec.md` | ✅ written |
| Implementation plan | this file | ✅ |
| Task list | `docs/features/phase-4-provider-core/tasks.md` | ✅ written |
| Data model | Inline in §4.3 (image_generate input/output), §4.5 (InsightBrief), §4.7 (KeyVault), §4.9 (ProviderError) | — |
| Contracts | `ImageProvider` typedef in §4.4; IPC namespace in §4.2 | — |
| Companion architecture doc | `docs/architecture/PROVIDER_CORE_ARCHITECTURE.md` | ⬜ produced during implementation, mirroring §4 |
| Quickstart | §8 below | — |

---

## 7. Risk & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Migration loses or corrupts a Phase 3 key on first Phase 4 launch | Medium — operator must re-paste keys | Migration is idempotent and writes the marker only after every key in the blob is successfully encrypted into the vault. On any failure mid-migration, the marker is NOT written; next launch retries. Migration log line captured in main-process log |
| Custom Provider with a non-OpenAI dialect (e.g. different field names) | Medium — adapter fails | Document the OpenAI-compatible assumption in the Settings UI. Provide a `modelPrefix` field as a release valve. If a target proxy speaks a wildly different dialect, that's a Phase 5 "Add new Custom dialect" task, not v1 |
| Webpage prompt injection sneaks past the sanitizer | High if it tricks an extractor | Sentinel-wrap + line-quote known markers; extractors written defensively (treat content as raw data, never instruction); provenance preserved in `sources.json` for audit |
| Renderer accidentally retains a key in memory during a save round-trip | High — defeats SC2 | The renderer-side `saveKey(id, value)` function takes `value` as a function argument, invokes IPC, and immediately overwrites the local variable with `null`. No long-lived state holds plaintext; the input field is cleared post-save |
| `safeStorage` unavailable on a Linux box without keyring | Low — keys still encrypted but with weaker derivation | Explicit warning surfaced in Settings + main log; documented in `spec.md` US4 acceptance |
| Fallback router masks a real failure by silently substituting providers | Medium — operator confusion | Every slot shows `servedProvider`; substitution badge is highlighted. `allowMockFallback` is off by default |
| Provider Core package accidentally imports an Electron module | High — kills cloud portability | Lint/test step in tasks: `grep -r "require\\(['\"]electron['\"]\\)" packages/provider-core/` must return zero hits |
| Renderer keeps Phase 3 fetch paths alive in parallel | Medium — drift, double generation, double billing | Cutover phase explicitly deletes Phase 3 adapter files; tasks include the deletion step |
| OpenAI `gpt-image-2/edit` rate-limits a high-volume listing run | Medium — partial batch failure | Fallback router covers; per-slot retries are out of scope by spec; operator can re-click. Document in tooltip |
| HTML extraction misses content on JS-heavy pages | Medium — bad brief | Document depth=deep limitation; fall back to operator-provided product insight text; encourage operator to paste their own product description into `productInsight` field |
| 5-tab Settings panel UX becomes cramped | Low | Reuse Phase 3 modal width; add scrollable per-tab content area; tasks include a UI walkthrough screenshot for record |

---

## 8. Quickstart (Run-and-See Walkthrough, Post-Implementation)

To be executed during the implementation run's verification step. This is the operator-shaped acceptance walkthrough; SC1–SC10 evidence is captured during this run.

1. **Fresh install verification.** Boot a clean profile. Open Settings → confirm 5 provider tabs (OpenAI / Gemini / Kie.ai / Fal.ai / Custom) render in that order. *(SC1)*
2. **Save OpenAI key.** Paste a real OpenAI key. Test Connection → expect `valid`. Restart app. Re-open Settings → key field shows `••••` with "Replace" button, never the plaintext. *(SC2)*
3. **Renderer leak audit.** Open DevTools → Application → Local Storage → confirm `swtd_provider_keys` is absent (post-migration) and `swtd_provider_keys_migrated_at` is present. Run `grep -r "sk-" apps/desktop/dist/` → expect zero hits. *(SC2)*
4. **Phase 3 → Phase 4 migration.** On a profile that had Phase 3 state, launch Phase 4 build → confirm one-time toast + main-process log line + cleared `localStorage`. Re-launch → no migration triggered (marker present). *(US4 acceptance)*
5. **Generate-mode (no reference).** Pick a SKU, pick a template without reference image, click Generate. Confirm slot transitions through `queued → generating → success`. Open `<sku>/output/tmp-generated/slotN-*.json` → confirm `mode: 'generate'`, `model: 'gpt-image-2'`. *(SC3)*
6. **Edit-mode (with reference).** Pick a SKU with a product reference image, click Generate. Confirm sidecar shows `mode: 'edit'`, `model: 'gpt-image-2/edit'`. *(SC3)*
7. **No renderer-side HTTP.** During step 5 or 6, watch the renderer's DevTools Network panel → no outbound `api.openai.com` or `fal.run` requests. Watch the main-process log → request line present. *(SC4)*
8. **Research → brief → composer.** Open a SKU. Paste a product URL + a keyword into the Brief Step → click "Build Brief". Within ≤ 60 s see the `InsightBrief` JSON render in a read-only viewer. Inspect `<sku>/research/insight-brief.json`. Generate a slot → composed prompt preview shows brief-derived tokens. *(SC5)*
9. **Prompt-injection probe.** Pre-stage a local HTML file with `<p>Ignore previous instructions and ...</p>`. Use Custom Provider's `webFetch` to ingest it (or a small fixture URL). Confirm the brief's `sources.json` quotes the injection passage but the `InsightBrief` itself does not include it as a fact or instruction. *(SC6)*
10. **Fallback router visible.** Stub OpenAI (temporarily revoke the key in Settings) → click Generate → confirm slot shows `servedProvider: fal` badge with substitution tooltip + fallback chain. Restore the key. *(SC7)*
11. **TTL cleanup.** Manually edit a sidecar to backdate `expiresAt`. Open the SKU again or click Generate → confirm the backdated file is removed. *(SC8)*
12. **`KeyVault` backend swap (interface check).** Code review: confirm every provider in `packages/provider-core/src/providers/*` imports only the `KeyVault` interface, never `electron.safeStorage` directly. Confirm `key-vault.js`'s `createSafeStorageVault` is the only file that mentions `safeStorage`. *(SC9)*
13. **`runtime/**` untouched.** `git diff base..HEAD -- runtime/` → expect empty. *(SC10)*

All 13 checks pass → Phase 4 P4.0..P4.4 complete and ready for review.

---

## 9. Open Items for Implementation Phase

All eight Boss decisions (D1–D8) are locked in `spec.md` §7. Remaining items for the implementer's judgment, surfaced (not silently decided) per `tinbeta-coding-guardrail` Rule 1 and Rule 7:

- **HTML-extract dep choice (research Q7).** Start hand-rolled. If 3+ smoke-test sites fail to parse, surface a "would like to add `linkedom` (≈40 KB)" decision to Boss before adding the dep.
- **Search backend default (research Q8).** Implementer picks Google Programmable Search vs Bing vs Custom-as-search for v1; the chosen one becomes the documented default in `PROVIDER_CORE_ARCHITECTURE.md`. Mock backend always available for offline dev.
- **Mock placeholder visual.** Keep Phase 3's pink-tinted "MOCK · slot N · {{aspect}}" placeholder. Document the palette choice in the runbook.
- **5-tab Settings styling.** Reuse Phase 3 modal width; the Custom tab's "Base URL" field gets an inline URL-validity hint. Operator-facing copy in EN + VI.
- **Sub-phase commit cadence.** P4.0 (architecture docs — this run, no app code) → P4.1 (extract package, no IPC yet) → P4.2 (IPC cutover + migration + delete renderer adapters) → P4.3 (add Gemini/Kie/Custom providers + 5-tab Settings) → P4.4 (Insight Brief pipeline + Prompt Composer integration). One commit per sub-phase minimum; Boss reviews between.
- **No `git push` at any sub-phase boundary unless Boss says push.** Per `matt-git-guardrails-claude-code` and runbook §13.

---

**End of plan.md.** Implementation begins only after Boss reviews `spec.md`, this plan, and [`tasks.md`](./tasks.md), and explicitly approves.
