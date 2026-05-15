# Provider Core — Architecture (Phase 4)

**Status:** Implementation reference (stable). Mirrors `docs/features/phase-4-provider-core/plan.md` §4. Originating brief: `docs/architecture/PROVIDER_CORE_PLAN_v0.2.md`. Implementation commits: `da8ee3f` (P4.1) · `97f4549` (P4.2) · `d37aa65` (P4.3) · `b94a399` (P4.4).

This document is the load-bearing architecture reference for everything under `packages/provider-core/`, `apps/desktop/electron/{main,preload}.cjs`, and the renderer wiring in `apps/desktop/src/`. It supersedes the planning copy in `plan.md` once Phase 4 ships; the plan stays as the historical decision log.

---

## 1. One-paragraph summary

Provider Core is a pure-JS, Electron-free package (`packages/provider-core/`) that owns: the provider registry, the unified `image_generate` contract (generate + edit), per-provider adapters (OpenAI, Gemini, Kie.ai, Fal.ai, Custom OpenAI-compatible, Mock), a `safeStorage`-backed `KeyVault` with AES-on-disk fallback, the SKU-scoped media store, the fallback router, the web-research → Insight Brief → Creative Brief pipeline, and shared error normalisation. The Electron main process composes those primitives at boot and exposes them to the renderer through a single IPC namespace `swtd:provider:*`. The renderer never makes a provider HTTP call. The package has zero `electron` and zero `react` imports — the same code can run on a future cloud backend with a swapped `KeyVault` backend.

---

## 2. Package layout

```
packages/provider-core/
  package.json                       # type:module, no deps, main: src/index.js
  src/
    index.js                         # createProviderCore({ keyVault, mediaStore, logger, searchBackend })
    types.js                         # JSDoc typedefs (single source of truth)
    error.js                         # ProviderError + statusToReason + isFallbackEligible + normalizeError
    logger.js                        # createLogger(base) — scrubs apiKey/key/token/bearer/authorization
    model-catalog.js                 # MODEL_CATALOG, PROVIDER_TIMEOUTS_MS, getDefaultModel, providerSupportsMode
    provider-registry.js             # createProviderRegistry({ defaultPrimary, defaultFallbackChain, allowMockFallback })
    image-generate.js                # imageGenerate(input, ctx) — unified contract
    image-edit.js                    # imageEdit(input, ctx) — sugar that requires images
    fallback-router.js               # route({ chain, getProvider, execute, skipped, logger })
    key-vault.js                     # createSafeStorageVault({ safeStorage, vaultFilePath, … })
    media-store.js                   # createMediaStore({ logger }); saveTmpImage / listTmpImages / cleanupExpired / promoteToApproved
    sanitize.js                      # sanitizeWebText, htmlToText, quoteInjectionLines, sentinel constants
    web-research.js                  # webFetch, webSearch + backend factories (mock / google CSE)
    insight-brief.js                 # buildInsightBrief, getInsightBrief
    creative-brief.js                # buildCreativeBrief, getCreativeBrief
    providers/
      _fetch.js                      # fetchWithTimeout + readResponseBytes
      openai.js                      # generate + edit (multipart) + testConnection
      gemini.js                      # generate-only in v1 (supportsEdit:false)
      kie.js                         # per-model dispatch; generate + edit when supported
      fal.js                         # text-to-image in v1
      custom-openai-compatible.js    # createCustomProvider({ id, providerName, baseUrl, modelPrefix? }) + customProviderTemplate
      mock.js                        # synthetic placeholder; never auto-substituted unless route allows
```

Hard rules:

1. Zero `electron` imports anywhere under `src/`. The caller injects `safeStorage` (or a polyfill) through `createSafeStorageVault`.
2. Zero `react` imports anywhere under `src/`. The package is invoked by the Electron main process, never by the renderer.
3. No new npm dependencies. Node 18+ `fetch`, `AbortController`, and the `node:crypto` / `node:fs` / `node:path` built-ins cover the entire surface.

---

## 3. IPC namespace (`swtd:provider:*`)

The renderer reaches Provider Core exclusively through this namespace, surfaced as `window.swtdProvider.*` by `apps/desktop/electron/preload.cjs`. No other channel grants provider access.

| Channel | Renderer call | Returns |
|---|---|---|
| `swtd:provider:list` | `swtdProvider.listProviders()` | `{ ok, providers:[{ id, label, authFields, capabilities, models, hasKey }], vault:{ encryptionAvailable, backend } }` |
| `swtd:provider:save-key` | `swtdProvider.saveKey(id, value)` | `{ ok }` — value consumed in main; never re-emitted |
| `swtd:provider:has-key` | `swtdProvider.hasKeyFor(id)` | `{ ok, has }` |
| `swtd:provider:clear-key` | `swtdProvider.clearKey(id)` | `{ ok }` |
| `swtd:provider:test` | `swtdProvider.testProvider(id)` | `{ ok, reason? }` |
| `swtd:provider:get-route-config` | `swtdProvider.getRouteConfig()` | `{ ok, route:{ primary, fallbackChain[], allowMockFallback } }` |
| `swtd:provider:set-route-config` | `swtdProvider.setRouteConfig(cfg)` | `{ ok, route }` |
| `swtd:provider:get-custom-config` | `swtdProvider.getCustomConfig()` | `{ ok, config:{ providerName, baseUrl, modelPrefix?, models? } \| null }` |
| `swtd:provider:save-custom-config` | `swtdProvider.saveCustomConfig(cfg)` | `{ ok, config }` — also calls `registerCustom` |
| `swtd:provider:clear-custom-config` | `swtdProvider.clearCustomConfig()` | `{ ok }` — calls `resetCustomToTemplate` |
| `swtd:provider:generate-image` | `swtdProvider.generateImage(input)` | `{ ok, genId, file, sidecarPath, servedProvider, fallbackChain[], mode, model, elapsedMs }` |
| `swtd:provider:edit-image` | `swtdProvider.editImage(input)` | same shape; explicit alias |
| `swtd:provider:cancel-generation` | `swtdProvider.cancelGeneration(genId)` | `{ ok }` |
| `swtd:provider:research-insight` | `swtdProvider.researchInsight(input)` | `{ ok, researchId, brief, briefPath, sourcesPath, creative? }` |
| `swtd:provider:cancel-research` | `swtdProvider.cancelResearch(researchId)` | `{ ok }` |
| `swtd:provider:get-insight-brief` | `swtdProvider.getInsightBrief(skuPath)` | `{ ok, brief, creative }` |
| `swtd:provider:list-tmp-images` | `swtdProvider.listTmpImages({ skuPath })` | `{ ok, entries[], corrupt[] }` |
| `swtd:provider:cleanup-tmp` | `swtdProvider.cleanupTmp({ skuPath })` | `{ ok, deleted, kept }` |
| `swtd:provider:promote-to-approved` | `swtdProvider.promoteToApproved({...})` | `{ ok, file }` |

Critical invariant: **`swtd:provider:get-key` does NOT exist.** There is no IPC channel that returns a plaintext key to the renderer. (SC2.)

---

## 4. `image_generate` unified contract

```ts
type ImageGenerateInput = {
  prompt: string
  model?: string
  provider?: string         // override registry primary
  images?: string[]         // file paths or swtd-asset:// URIs (main resolves to bytes)
  image?: string            // sugar for [images]
  size?: string
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'
  resolution?: '1K' | '2K' | '4K'
  quality?: 'low' | 'medium' | 'high' | 'auto'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  background?: 'transparent' | 'opaque' | 'auto'
  count?: number            // v1 ignored; always 1
  timeoutMs?: number
  slotId?: string | number
  skuPath?: string          // required for media-store write
  templateId?: string
  angleId?: string
}

type ImageGenerateResult = {
  file: string
  sidecarPath: string
  servedProvider: string
  fallbackChain: { providerId: string, reason: string, status?: number }[]
  mode: 'generate' | 'edit'
  model: string
  mime: string
  elapsedMs: number
  generatedAt: number
  expiresAt: number
}
```

Mode dispatch is purely structural: presence of `image` / `images` selects edit-mode. Default model per provider × mode comes from `MODEL_CATALOG`. Boss D3 lock: OpenAI `gpt-image-2/edit` is the default when a reference image is present; `gpt-image-2` otherwise.

Reference-image resolution lives entirely in `electron/main.cjs#resolveReferenceImage`:
- filesystem paths → `fs.readFile` Buffer
- `swtd-asset://abs/<encoded>` URIs → decoded to absolute path → Buffer
- anything else (http://, https://, data:) → rejected with `invalid-input`

The package itself never reads the filesystem for reference images; adapters receive Buffers only.

---

## 5. Provider Registry + Model Catalog

`createProviderRegistry({ defaultPrimary, defaultFallbackChain, allowMockFallback })` returns:

```
registerProvider(provider)       // overwrites by id — used by registerCustom + resetCustomToTemplate
getProvider(id)
listProviders({ withHasKey })    // optional sync callback; main passes the key-vault hasKey
getRouteConfig()                  // { primary, fallbackChain[], allowMockFallback }
setRouteConfig(cfg)
getDefaultRoute({ hasReferenceImage, providerOverride })
                                  // { mode, chain[], skipped: [{ providerId, reason: 'provider-unsupported-edit' }] }
```

`getDefaultRoute` filters providers that cannot serve the requested mode (e.g. Gemini for edit-mode in v1) and emits them as `skipped` entries the fallback router carries through into the chain log. The operator sees `provider-unsupported-edit` in the SlotCard tooltip rather than the call quietly failing.

`MODEL_CATALOG` encodes for each provider:
- `defaultGenerateModel` / `defaultEditModel` (per Boss D3 + plan §4.4 §4)
- `defaultTimeoutMs` (90s OpenAI / 120s FAL / 90s Gemini / 120s Kie / 90s Custom / 10s Mock)
- per-model `supportsGenerate / supportsEdit / supportedAspectRatios / supportedQualities / supportedOutputFormats`

Custom Provider is special: its `MODEL_CATALOG.custom.models` is intentionally empty (`{}`). Validation skips it; the adapter validates the configured base URL at call-time.

---

## 6. KeyVault — Electron `safeStorage` v1 + AES-on-disk fallback

Interface (frozen — Provider Core never imports a concrete backend; all adapters reach the vault via the factory's injected `keyVault` parameter):

```ts
interface KeyVault {
  getKey(providerId: string): Promise<string | null>   // only called inside main; NEVER exposed to renderer
  setKey(providerId: string, value: string): Promise<void>
  clearKey(providerId: string): Promise<void>
  hasKey(providerId: string): Promise<boolean>
  listProvidersWithKeys(): Promise<string[]>
  info(): { encryptionAvailable: boolean, backend: string }
}
```

v1 backend = `createSafeStorageVault({ safeStorage, vaultFilePath, machineSaltSeed?, logger? })`. On boot:

1. If `safeStorage.isEncryptionAvailable() === true` → encrypt with `safeStorage.encryptString` (OS keychain wrapper).
2. Else → AES-256-GCM with a per-install key derived via `scryptSync(seed, sha256('swtd-provider-core::'+seed), 32, { N: 16384, r: 8, p: 1 })`. Logs a single explicit warning at construction.

Vault file shape:

```json
{
  "version": 1,
  "entries": {
    "openai":   "<base64 of encrypted bytes>",
    "fal":      "<base64 …>",
    "custom":   "<base64 …>"
  }
}
```

`safeStorage` payloads are stored as base64 of `safeStorage.encryptString(plain).toString('base64')`. AES-on-disk payloads are JSON `{ v, alg, iv, ct, tag }` strings (so the file is uniformly key→string).

v2 path (deferred, plan §9): swap to `createKeychainVault` (e.g. `keytar`) or `createCloudKmsVault` behind the same interface. No provider code changes; `key-vault.js` is the seam.

The renderer side has no path to `getKey`. The preload bridge exposes `saveKey / hasKeyFor / clearKey / testProvider` only.

---

## 7. Media Store

`createMediaStore({ logger })` owns `<sku>/output/{tmp-generated,approved}/`. Boss D7 (unchanged from Phase 3): 7-day TTL on tmp, approved is permanent.

```
saveTmpImage({ skuPath, slotId, bytes, mime, providerId, model, mode, … })
  → <sku>/output/tmp-generated/slot<id>-<ts>.<ext> + sidecar JSON
  Sidecar fields: generatedAt, expiresAt (=+7 days), providerId, model, mode,
                  slotId, templateId, angleId, aspectRatio, promptHash, sourceImages,
                  mime, fallbackChain
listTmpImages({ skuPath })
  → { entries: [{ slotId, file, sidecarPath, generatedAt, expiresAt, providerId, model,
                  mode, templateId, angleId, aspectRatio, fallbackChain }],
      corrupt: [string] }
cleanupExpired({ skuPath })
  → { deleted, kept }   // sweeps expired sidecars + orphan images
promoteToApproved({ skuPath, slotId, sourceFile, destFile? })
  → { file }            // copies tmp file into approved/
```

Every path runs through a single `assertInsideSku(root, candidate)` guard that rejects NUL bytes and path-escape attempts. Mime → extension lookup is fixed (`png/jpg/webp` only).

Cleanup hooks identical to Phase 3:
1. App startup (Shell mount)
2. SKU open (`chooseSku` after brand-context load)
3. Before each new generate (`image-generate.js` calls `cleanupExpired` first)

`swtd-asset://` protocol unchanged — already covers `tmp-generated/` since Phase 3.

---

## 8. Fallback Router

```ts
async function route({ chain, getProvider, execute, skipped, logger }):
  Promise<{ servedProvider: string, fallbackChain: AttemptedEntry[], result: any }>
```

Walks `chain` in order. On each attempt:
- success → return `{ servedProvider: id, fallbackChain: [skipped + prior failures], result }`
- failure → normalize the error; record `{ providerId, reason, status }` in `attempted`; if the reason is *not* fallback-eligible (`invalid-response` or `aborted`), rethrow with the trail attached; otherwise continue.

`isFallbackEligible(reason)` returns `false` only for `invalid-response` and `aborted`. Boss D6: the operator must see real failures and explicit cancels; everything else is fair game for substitution.

If the chain is exhausted, the router throws `ProviderError{ reason: 'all-providers-failed', attempted }`.

UI surface (renderer):
- `SlotCard.jsx` reads `fallbackChain` from the sidecar via `listTmpImages` and renders the served-provider badge with a substitution treatment when `served !== chain[0].providerId`. Tooltip lists each attempt as `providerId: reason (status?)`.
- The chain is also embedded in the per-slot stdout `done` line (`served via X (Yms) (fallback: openai:rate-limited → fal:ok)`) so the existing Run Timeline shows the trail without a separate sub-event component (P4.5 deferral; see runbook).

---

## 9. Research → Insight Brief → Creative Brief → Prompt Composer

End-to-end flow (Boss D6 — research output feeds composition, never standalone):

```
Renderer BriefStep (MainCanvas/IntakeView)
  → swtdProvider.researchInsight(input)
    → main: activeResearchRuns.set(researchId, AbortController)
    → providerCore.researchInsight(input, { signal })
      = buildInsightBrief(input, { searchBackend, signal, logger, skuPath })
        1. webFetch each input.urls in parallel (Node fetch, no CORS)
        2. webSearch over input.keywords + productName (mock backend by default)
        3. sanitizeWebText every fetched body
           - strip <script>/<style>/<noscript>/<!-- -->
           - decode entities, collapse whitespace
           - quote known injection markers as `> [quoted-from-untrusted-source] …`
           - wrap entire body in <UNTRUSTED_WEB_CONTENT> sentinel
        4. heuristic extractors (no LLM in v1) build product/customer/market dicts
        5. derive creativeDirection (mustShow/mustAvoid)
        6. write <sku>/research/{insight-brief,sources}.json
    → providerCore.buildCreativeBrief(brief, skuPath)
      writes <sku>/research/creative-brief.json
    ← { ok, researchId, brief, briefPath, sourcesPath, creative }

Renderer Shell.jsx
  setInsightBrief / setCreativeBrief
  → composedPrompts memo runs
    → buildContext({ brand, icp, brief, insightBrief, creativeBrief })
      merges into the variable bag:
        PRODUCT_*           (materials, features, differentiators, useCase, name, category, dimensions)
        CUSTOMER_*          (audience, painPoints, desires, buyingTriggers, language)
        MARKET_*            (marketplace, competitors, visualPatterns, claims, risks)
        CREATIVE_*          (style, mood, mustShow, mustAvoid)
    → composePrompt(template, angleId, context)
      substitutes {{TOKEN}} placeholders in template body + angle modifier
```

Untrusted-content trust boundary (Boss D8 + plan §4.5):

- `sanitize.js` strips dangerous elements, quotes injection markers, and wraps every fetched body in `<UNTRUSTED_WEB_CONTENT>` sentinel.
- Any LLM-style extractor that consumes a sentinel-wrapped body must be coded (or prompted) to treat the contents as raw observation, never instruction.
- `sources.json` records the original URL, content type, sanitized flag, flagged-passage list, and a short excerpt. The `InsightBriefViewer` renders flagged passages as quoted `<code>` blocks for audit.

Cancellation: every `researchInsight` call returns a `researchId` mapped to an AbortController in `activeResearchRuns`. `swtd:provider:cancel-research` aborts the call; partial artifacts are not persisted because the writes happen at the end of `buildInsightBrief`.

---

## 10. Error normalisation

```ts
{
  name: 'ProviderError',
  providerId: 'openai' | 'gemini' | 'kie' | 'fal' | 'custom' | 'mock' | 'router' | 'web-research',
  status?: number,
  reason:
    | 'unauthorized' | 'rate-limited' | 'timeout' | 'network'
    | 'invalid-response' | 'invalid-input' | 'invalid-key' | 'aborted'
    | 'provider-unsupported-edit' | 'all-providers-failed' | 'unknown',
  hint?: string,
  attempted?: { providerId: string, reason: string, status?: number }[]
}
```

Per-provider HTTP status maps via `statusToReason`. The renderer maps `reason` to an i18n key (`provider.test.fail.<reason>` / `slot.gen.error.<reason>` / `provider.error.<reason>`). Raw HTML / stack traces never reach the UI; the secret-scrubbing logger strips `apiKey / key / token / bearer / authorization` (and any `Bearer …` value) before emitting.

---

## 11. Concurrency, timeouts, cancellation

- One in-flight generation per slot at the renderer level (`slotGenerationIds` ref).
- Cross-slot parallelism allowed.
- Per-provider timeouts from `MODEL_CATALOG.<id>.defaultTimeoutMs`; overridable per call via `input.timeoutMs`.
- AbortControllers tracked in `electron/main.cjs#activeProviderGenerations` and `activeResearchRuns`. Window-all-closed aborts both maps to drain pending work.
- Fallback router does NOT retry on the same provider; on `timeout` it moves to the next entry.

---

## 12. Cloud-portability seam

Provider Core is consumed by `electron/main.cjs` today, but the same package can run on a cloud backend with three swaps:

1. **`KeyVault`** — replace `createSafeStorageVault` with `createCloudKmsVault` (AWS KMS / GCP KMS / Vault). Same interface, no adapter changes.
2. **`MediaStore`** — replace the filesystem-backed `createMediaStore` with `createS3MediaStore` (or equivalent). Same `saveTmpImage / listTmpImages / cleanupExpired / promoteToApproved` shape.
3. **Reference-image resolution** — main-process logic that converts `swtd-asset://` and filesystem paths into Buffers lives outside the package today; a cloud backend would translate signed-URL references to bytes the same way.

The package itself stays untouched. Gate check (T032 / T102): `grep -rE "require\(['\"]electron['\"]\)|from ['\"]electron['\"]" packages/provider-core/` MUST return zero hits.

---

## 13. Operator surface (renderer)

| Area | Component | Notes |
|---|---|---|
| Settings modal | `SettingsModal.jsx` | 5-tab section (OpenAI · Gemini · Kie.ai · Fal.ai · Custom) + Default Route section |
| Per-provider tab | `ProviderSettingsTab.jsx` | Key save/replace (`••••••••` mask, no Reveal); Custom triple (name + baseUrl + modelPrefix); Test connection |
| Route picker | `ProviderPicker.jsx` | Primary radio + ordered fallback chain (Up/Down/Remove + Add) + `allowMockFallback` toggle |
| Per-slot generate | `SlotCard.jsx` | `servedProvider` badge with substitution treatment + chain tooltip |
| Intake / Brief Step | `MainCanvas.jsx > IntakeView > BriefStep` | URLs / keywords / product+customer insight / marketplace / depth + Build Brief / Cancel |
| Brief viewer | `InsightBriefViewer.jsx` | Product · Customer · Market · Creative direction · Sources (with flagged-passage audit) |

`Shell.jsx` owns the cross-cutting state: `slotTmpImages`, `slotGenErrors`, `insightBrief`, `creativeBrief`, `researchInFlight`, `activeProviderHasKey`, plus the Phase 3 → Phase 4 `migratePhase3LocalStorageKeys` one-time migration.

---

## 14. Out of scope

- `runtime/**` changes (Phase 4 is desktop-app architecture)
- A+ Premium template authoring
- FAL `/edit` route + reference-image upload
- Two-pass LLM prompt refinement
- Streaming image output
- Retry-with-backoff
- Cost meter / usage dashboard
- Cloud backend deployment (architecture is portable; deployment is a separate phase)
- OS-keychain (`keytar`) — v1 ships safeStorage; `keytar` is v2 behind the same interface
- Multi-image batch
- New npm dependencies
- LLM-driven Insight Brief extractors (v1 extractors are deterministic / keyword-based)

---

## 15. Verification matrix

| SC | Criterion | Evidence |
|---|---|---|
| SC1 | Operator configures all 5 providers in ≤ 2 min | 5-tab Settings UI; manual stopwatch deferred to dev:electron boot |
| SC2 | API keys never present in renderer after save | `grep -r "getKey" preload.cjs` returns zero exposed; UI shows `••••••••` with Replace only |
| SC3 | Edit vs generate sidecar fields correct | `image-generate.js` writes `mode` per reference-image presence; verified by smoke |
| SC4 | All provider HTTP from main; zero from renderer | `grep -rE "fetch\(['\"]https?://(api\.openai\.com\|fal\.run\|generativelanguage\.googleapis\.com\|kieai\.)" apps/desktop/src/` → zero |
| SC5 | InsightBrief drives composer | Node smoke: brief tokens resolve in composePrompt with zero missingVars |
| SC6 | Prompt-injection sanitised | `sanitize.js` smoke: script stripped, marker line quoted, sentinel wrapping |
| SC7 | Fallback substitution visible | SlotCard badge has `--fallback` class + tooltip when `served !== requested` |
| SC8 | TTL cleanup | Node smoke: backdated sidecar deleted (`{deleted:1, kept:1}`), fresh entry kept |
| SC9 | KeyVault backend swappable | Providers import only via injected `keyVault`; `safeStorage` referenced only inside `key-vault.js` |
| SC10 | `runtime/**` untouched | `git diff <P4-base>..HEAD -- runtime/` returns empty |

---

**End of architecture reference.** Updates to this document accompany any change to the package's public surface, the IPC namespace, or the trust boundaries called out in §6 and §9.
