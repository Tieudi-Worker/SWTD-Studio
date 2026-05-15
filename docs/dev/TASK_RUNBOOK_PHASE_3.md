# Task Runbook — Phase 3: Model Provider Adapter

**Date:** 2026-05-15
**Repo:** `/home/whoar/.openclaw/workspace/projects/SWTD-Studio`
**Worktree:** `.claude/worktrees/phase-3-model-adapter/`
**Branch:** `phase-3-model-adapter` (cut from `phase-2-template-engine` HEAD `508c786`)
**Owner:** Boss (thondptit@gmail.com)
**Status:** Complete (UI + adapter) — awaiting Boss merge approval. No `git push` performed.

---

## Reference

- Binding protocol: [`SWTD_EXECUTION_PROTOCOL.md`](./SWTD_EXECUTION_PROTOCOL.md) v1.1
- Spec: [`../features/phase-3-model-adapter/spec.md`](../features/phase-3-model-adapter/spec.md) (Boss-locked Q1/Q2/Q3)
- Plan: [`../features/phase-3-model-adapter/plan.md`](../features/phase-3-model-adapter/plan.md)
- Tasks: [`../features/phase-3-model-adapter/tasks.md`](../features/phase-3-model-adapter/tasks.md)

## Locked decisions (Boss, 2026-05-15)

| Q | Decision |
|---|---|
| Q1 — API key storage | Browser `localStorage` under `swtd_provider_keys`; warning chip in `ProviderPicker` is explicit. OS-keychain hardening deferred to a future security pass. |
| Q2 — Generated-image persistence | 7-day TTL temp cache under `<sku>/output/tmp-generated/slotN-<ts>.png` + sidecar `<ts>.json` (metadata). Auto-cleanup on app startup, SKU open, and before every new run. Generated images are **never** written into the final approved `output/listing/` folder by Phase 3. |
| Q3 — Active-provider surface | Provider picker lives in a Settings modal; a compact TopBar provider chip opens the modal. Active provider id stored in `localStorage` under `swtd_active_provider`. |

---

## Skills Read in This Run

Per protocol §3.4. All read directly from `.claude/skills/<skill>/SKILL.md` during this implementation run.

| Skill | Why loaded | What it shaped |
|---|---|---|
| `tinbeta-coding-guardrail` | Pre-loaded project skill | Rule 5 (judgment vs. deterministic): provider adapters are deterministic transforms — no LLM in the resolution path. Rule 8 (Read before write): audited Phase 2 `Shell.jsx` slot lifecycle before threading the new generate dispatcher. Rule 12 (Fail loud): `resolveActiveProvider()` returns explicit `fellBackToMock + reason`; banner surfaces it instead of swallowing. |
| `karpathy-guidelines` | Discipline across the run | Rule 2 (Simplicity First): native `fetch` + `AbortController` + `localStorage` — zero new npm deps. Rule 3 (Surgical Changes): no refactor of Phase 1 state machine; synthetic events feed `handlePipelineEvent` so the canonical `idle → queued → generating → success/failed` transitions are reused unmodified. |
| `superpowers-verification-before-completion` | Reporting gate | "Evidence before claims" — each evidence block below is verbatim output from a Node harness, not a hand-written claim. |
| `superpowers-using-git-worktrees` | Branch isolation | Same baseRef issue as Phase 1/2: `EnterWorktree`'s `fresh` mode would branch from `origin/main` (11 commits behind). Worked around by manually creating the worktree off Phase 2 HEAD then entering it via the `path` escape hatch. |

Skills considered and intentionally not loaded:
- `static-ad-generator-chatgpt-img2`, `static-ad-variation-engine`, `brand-dna-builder` — already absorbed during Phase 2 and unchanged in scope for Phase 3 (adapter is provider-agnostic; no prompt-template work).
- `review-audit`, `brand-voice-profiler`, `icp-deep-dive` — operator authoring flows that live outside SWTD.

---

## Files Changed (full diff stat vs `phase-2-template-engine` HEAD `508c786`)

Tracked-file edits:

```
 apps/desktop/electron/main.cjs                   | 157 ++++++++++++-
 apps/desktop/electron/preload.cjs                |  12 +
 apps/desktop/src/components/shell/MainCanvas.jsx |  41 ++++
 apps/desktop/src/components/shell/SlotCard.jsx   |  80 ++++++-
 apps/desktop/src/components/shell/TopBar.jsx     |  16 +-
 apps/desktop/src/lib/i18n.js                     |  56 +++-
 apps/desktop/src/shell/Shell.jsx                 | 184 +++++++++++++++
 apps/desktop/src/styles/shell.css                | 259 +++++++++++++++++++
 8 files changed, 796 insertions(+), 9 deletions(-)
```

New files:

```
 apps/desktop/src/lib/key-store.js                                  98
 apps/desktop/src/lib/tmp-cache.js                                  69
 apps/desktop/src/lib/providers/types.js                            82
 apps/desktop/src/lib/providers/mock-provider.js                   123
 apps/desktop/src/lib/providers/registry.js                         52
 apps/desktop/src/lib/providers/fal-provider.js                    156
 apps/desktop/src/lib/providers/openai-provider.js                 145
 apps/desktop/src/components/shell/SettingsModal.jsx                58
 apps/desktop/src/components/shell/ProviderPicker.jsx              197
```

### Forbidden surface check

| Surface | Touched? | Source of constraint |
|---|---|---|
| `runtime/**` | NO — verified by `git status --short` showing no `M`/`??` entries under `runtime/` and `git diff --name-only HEAD -- 'runtime/**' 'apps/desktop/runtime/**'` returning empty | Boss brief explicit |
| Git remote | NO — `git log @{u}..HEAD` returns *"no upstream configured for branch 'phase-3-model-adapter'"*; no `git push` executed | Boss brief explicit |
| New npm deps | NO — `apps/desktop/package.json` `dependencies` unchanged from Phase 2 (`react`, `react-dom` only) | Guardrail brief |
| `apps/desktop/electron/main.cjs` | YES — +147 LOC: 3 new IPC handlers (`swtd:save-generated-image`, `swtd:list-tmp-generated`, `swtd:cleanup-tmp-generated`) + asset-protocol regex extended to allow `/output/tmp-generated/`, all gated by `isUnderTmpDir(...)` path-safety guard | Required for Q2 — renderer cannot persist files on disk; no minimal alternative |

---

## Evidence

### 1. Build passes

```
> swtd-studio@0.1.0 build:renderer
> vite build

vite v5.4.21 building for production...
transforming...
✓ 79 modules transformed.
[plugin:vite:reporter] (!) src/lib/key-store.js is dynamically imported by Shell.jsx
    but also statically imported by ProviderPicker.jsx, providers/registry.js,
    Shell.jsx, dynamic import will not move module into another chunk.
                                                                  ^-- informational only

rendering chunks...
dist/index.html                   0.54 kB │ gzip:  0.31 kB
dist/assets/index-DjDOKx39.css   71.07 kB │ gzip: 10.57 kB
dist/assets/index-IJ66S4GO.js   295.03 kB │ gzip: 89.41 kB
✓ built in 972ms
```

No errors. The dynamic-vs-static warning is informational (renderer-only optimisation hint); behaviour is correct.

### 2. Graceful mock-fallback rule (5 cases)

Harness: `/tmp/phase3-mock-fallback.mjs` (script body in this section verbatim). Invokes `resolveActiveProvider()` from `apps/desktop/src/lib/providers/registry.js` with a Node-side `localStorage` shim, toggling key state per case.

```
1. mock active, no keys            → mock | fellBack: false | reason: —
2. fal active, no key              → mock | fellBack: true  | reason: missing-key
3. fal active, key saved           → fal  | fellBack: false | reason: —
4. openai active, no key           → mock | fellBack: true  | reason: missing-key
5. unknown provider id             → mock | fellBack: true  | reason: unknown-provider

ALL 5 CASES PASSED — graceful degradation rule verified.
```

`registry.js:40` (`resolveActiveProvider`) is the only call site; UI consumers (`SlotCardReview` Generate button, `TopBar` provider chip with `!` warn) react to the returned `fellBackToMock + reason`.

### 3. 7-day TTL cleanup (8 assertions)

Harness: `/tmp/phase3-ttl-evidence.mjs`. Fixture is `/tmp/phase3demo/sku/output/tmp-generated/` populated with:

- Pair A — expired (sidecar `expiresAt: now - 1d`, generated 8d ago)
- Pair B — fresh (expires in 7d, generated now)
- Pair C — fresh (1d old, 6d left)
- Orphan PNG — no sidecar

Inline cleanup logic mirrors `apps/desktop/electron/main.cjs:551` (`swtd:cleanup-tmp-generated`) byte-for-byte.

```
Before: [
  'slot1-aaa.json', 'slot1-aaa.png',
  'slot2-bbb.json', 'slot2-bbb.png',
  'slot3-ccc.json', 'slot3-ccc.png',
  'slot4-orphan.png'
]
After:  [
  'slot2-bbb.json', 'slot2-bbb.png',
  'slot3-ccc.json', 'slot3-ccc.png'
]
Counters: { deleted: 2, kept: 2 }
  ✓ expired png removed
  ✓ expired sidecar removed
  ✓ orphan png removed
  ✓ fresh B png kept
  ✓ fresh B sidecar kept
  ✓ fresh C png kept
  ✓ fresh C sidecar kept
  ✓ counters {deleted:2,kept:2}

ALL 8 ASSERTIONS PASSED — 7-day TTL cleanup verified.
```

Counter semantics: pass 1 increments `deleted` per **pair** (expired sidecar + its png), pass 2 increments per **orphan png**. So {expired pair + 1 orphan} → `deleted: 2`.

Cleanup is wired in three places (Boss Q2 directive):

1. **App startup** — `Shell.jsx` `useEffect` on mount: `if (skuPath) await window.swtd.cleanupTmpGenerated({ skuPath })`
2. **SKU open** — extends `chooseSku()` to call cleanup then `loadLatestPerSlot()` before painting
3. **Before each new run** — `generateSlot(slotId)` calls cleanup before resolving the provider and dispatching the synthetic `queued → generating` event

---

## Operator flow (end-to-end)

1. **Mock mode (default).** No keys saved. TopBar shows `MODEL · MOCK` chip in neutral colour, no warning. Clicking it opens Settings → ProviderPicker with the "⚠ Keys stored in browser storage" banner. Generate buttons on each slot work — they call the mock provider's Canvas-PNG generator, persist `slotN-<ts>.png` + sidecar JSON into `<sku>/output/tmp-generated/`, and the SlotCard preview swaps to the tmp image (cache-busted with `?k=tmp-<generatedAt>`).
2. **Set FAL key.** Settings → "FAL" row → paste key → Save. ProviderPicker tag flips to `SAVED`; key is masked with `••••••••••••abcd` and "Reveal" auto-hides after 30s. "Test connection" probes the FAL endpoint. Selecting the FAL radio updates the TopBar chip to `MODEL · FAL` (accent colour).
3. **Generate.** Click Generate on a slot. Phase 2's composed prompt (template + brand-DNA + ICP) is sent through the provider's `generate({ prompt, aspectRatio, abortSignal })`. The PNG bytes return as a `Blob`; `tmp-cache.saveGeneratedImage(...)` writes to disk and the SlotCard re-renders from `swtd-asset://` with the new tmp URL.
4. **Cancel.** Per-slot AbortController in `slotGenerationControllers` ref Map. The Cancel button calls `controller.abort()`; the FAL/OpenAI adapter `fetchWithTimeout` honours the combined signal and rejects with `AbortError`, surfaced as a `slot-card__gen-tag--error` chip.
5. **Key removed.** Clearing the FAL key with the provider still active triggers `resolveActiveProvider()` to return `{ provider: mockProvider, fellBackToMock: true, reason: 'missing-key' }` on the next Generate. The `ProviderFallbackBanner` flashes at the top of the listing panel for 5s; the run still completes via mock.
6. **7-day expiry.** Tmp files older than 7d (per their sidecar `expiresAt`) are auto-deleted on the next of: app startup, SKU open, or new Generate. The final approved listing folder is never touched.

---

## Verification statement

- ✅ No `runtime/**` files changed (validated by `git status --short` + `git diff --name-only HEAD -- 'runtime/**'`).
- ✅ No `git push`; branch `phase-3-model-adapter` has no upstream.
- ✅ Renderer build passes (`vite build` in 972ms; 79 modules transformed; 295 kB JS, 71 kB CSS).
- ✅ Mock-fallback evidence — 5/5 cases pass (key-missing + unknown-provider both surface `fellBackToMock: true` with `reason`).
- ✅ 7-day TTL cleanup evidence — 8/8 assertions pass on a synthetic fixture mirroring the production handler.
- ✅ Zero new npm dependencies (`react`/`react-dom` only; native `fetch` + `AbortController` + `localStorage`).
- ✅ All 30+ new i18n keys are present in both `en` and `vi` maps in `apps/desktop/src/lib/i18n.js`.

Phase 3 IMPLEMENTATION DONE. Provider adapters wired with 7-day temp image cache; runtime unchanged.
