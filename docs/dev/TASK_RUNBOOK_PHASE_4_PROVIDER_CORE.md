# TASK RUNBOOK — Phase 4 Provider Core Architecture

Status: P4.1 implementation in progress
Started: 2026-05-15 09:40 UTC
Branch: phase-4-provider-core
Worktree: .claude/worktrees/phase-4-provider-core

---

## Phase 4.0 — Planning run (completed 2026-05-15)

### Objective
Create SpecKit artifacts for SWTD-Studio Provider Core based on `docs/architecture/PROVIDER_CORE_PLAN_v0.2.md`. Architecture/spec planning first; no source code touched in this run unless explicitly approved.

### Required protocol
Claude Code must follow:
1. Read relevant `.claude/skills/*/SKILL.md` files before planning.
2. Use SpecKit flow: specify → plan → tasks → verify.
3. Keep provider architecture desktop-safe and future cloud-safe.
4. No git push.
5. No destructive cleanup without approval.

### Required skill files (planning run)
- `.claude/skills/speckit-specify/SKILL.md`
- `.claude/skills/speckit-plan/SKILL.md`
- `.claude/skills/speckit-tasks/SKILL.md`
- `.claude/skills/tinbeta-coding-guardrail/SKILL.md`
- `.claude/skills/matt-git-guardrails-claude-code/SKILL.md`

### Inputs
- `docs/architecture/PROVIDER_CORE_PLAN_v0.2.md`
- `docs/features/phase-3-model-adapter/{spec.md,plan.md,tasks.md}`
- Existing provider code in `apps/desktop/src/lib/providers/`
- Existing Electron main/preload files

### Outputs (planning run)
- `docs/features/phase-4-provider-core/spec.md` ✅
- `docs/features/phase-4-provider-core/plan.md` ✅
- `docs/features/phase-4-provider-core/tasks.md` ✅

### Verification (planning run)
- Docs exist and are internally consistent ✅
- Plan covers: Provider Registry, OpenAI/Gemini/Kie.ai/Fal.ai/Custom Provider settings, Web Research / Insight Mining → Brief Intelligence, image_generate style contract, gpt-image-2/edit reference-image behavior, Electron main IPC boundary, secure key handling v1/v2, media store tmp/approved + 7-day TTL, fallback router, no renderer direct provider calls in final architecture ✅

---

## Phase 4.1 — Foundational extract (in progress 2026-05-15)

Boss approval received for D1–D8. Scope of this run: T001–T026 (Phase 4.0 setup tasks already complete from the planning run + T010–T033 from Phase 4.1).

### Skills read for the implementation run
- `.claude/skills/speckit-implement/SKILL.md` — load context, follow phase order, mark tasks complete with [X], surface skipped work
- `.claude/skills/tinbeta-coding-guardrail/SKILL.md` — 12-rule cautious template: simplicity, surgical changes, read-before-write, surface conflicts, match conventions, fail loud
- `.claude/skills/matt-git-guardrails-claude-code/SKILL.md` — block destructive git ops; no push; new commits, never amend

### Phase 4.0 setup task status (T001–T006)

| Task | Status | Evidence |
|---|---|---|
| T001 Branch cut + sha recorded | ✅ done (Phase 4.0 planning run) | branch `phase-4-provider-core` exists; base sha `588b859` (last commit of `phase-3-model-adapter` lineage prior to docs); current HEAD at start of implementation: `035b5fee761fc6c8c689e40b5e332f7fec922a03` |
| T002 Runbook updated with skills-read, checklist, cadence | ✅ done (this entry) | This file |
| T003 Renderer bundle size snapshot | ⏭ skipped — no `apps/desktop/dist/` exists yet on this worktree (no prior build). Regression check deferred to P4.5 T101 when a build will run | `ls apps/desktop/dist 2>/dev/null` → empty |
| T004 D1–D8 LOCKED in spec.md §7 | ✅ done (Boss approved this run) | `spec.md` §7 |
| T005 Electron supports safeStorage (≥ 15) | ✅ done | `apps/desktop/package.json` devDependencies pins `electron ^31.3.1` ≫ 15. `safeStorage` available everywhere |
| T006 Audit renderer call sites that import providers/key-store | ✅ done | `grep -rln -E "from ['\"](\.\.?/)+(lib/providers\|lib/key-store)" apps/desktop/src` → `apps/desktop/src/components/shell/ProviderPicker.jsx`, `apps/desktop/src/shell/Shell.jsx`. Both will be repointed in P4.2 |

### Phase 4.1 implementation log

#### Files created (T010–T031)

```
packages/provider-core/package.json
packages/provider-core/src/types.js
packages/provider-core/src/error.js
packages/provider-core/src/logger.js
packages/provider-core/src/model-catalog.js
packages/provider-core/src/provider-registry.js
packages/provider-core/src/key-vault.js
packages/provider-core/src/media-store.js
packages/provider-core/src/sanitize.js
packages/provider-core/src/fallback-router.js
packages/provider-core/src/image-generate.js
packages/provider-core/src/image-edit.js
packages/provider-core/src/web-research.js
packages/provider-core/src/insight-brief.js
packages/provider-core/src/creative-brief.js
packages/provider-core/src/index.js
packages/provider-core/src/providers/_fetch.js
packages/provider-core/src/providers/openai.js
packages/provider-core/src/providers/gemini.js
packages/provider-core/src/providers/kie.js
packages/provider-core/src/providers/fal.js
packages/provider-core/src/providers/custom-openai-compatible.js
packages/provider-core/src/providers/mock.js
```

23 files. Public surface re-exported from `packages/provider-core/src/index.js`:
`createProviderCore`, `createSafeStorageVault`, `createMediaStore`, `createLogger`,
`createCustomProvider`, `customProviderTemplate`, `PROVIDER_CORE_VERSION`,
`PROVIDER_CORE_TYPES_VERSION`.

#### T032 — Cloud-portability lint (SC9 evidence)

```
$ grep -rE "require\(['\"]electron['\"]\)|from ['\"]electron['\"]" packages/provider-core/
(zero hits — OK)

$ grep -rE "from ['\"]react['\"]|require\(['\"]react['\"]\)" packages/provider-core/
(zero hits — OK)
```

#### T033 — Node smoke verification

```
$ node --input-type=module -e "import('./packages/provider-core/src/index.js').then(m => console.log(Object.keys(m)))"
exports: PROVIDER_CORE_TYPES_VERSION, PROVIDER_CORE_VERSION, createCustomProvider,
         createLogger, createMediaStore, createProviderCore, createSafeStorageVault,
         customProviderTemplate

$ node --input-type=module -e "<createProviderCore + listProviders>"
providers: openai, gemini, kie, fal, custom, mock
route: {"primary":"openai","fallbackChain":[],"allowMockFallback":false}
vault info: {"encryptionAvailable":false,"backend":"aes-on-disk"}
```

All five Boss-locked provider ids plus mock register at boot. Default route
points at OpenAI, fallback chain empty (operator-configurable in P4.3),
`allowMockFallback` false (Mock is never auto-substituted; Boss D3 / US6).

#### Build verification posture (deferred to P4.2)

`apps/desktop/node_modules` is not installed on this worktree, so
`npm run build:renderer` is not runnable here. Phase 4.1 makes **zero edits
under `apps/desktop/`** (the package is registered but not yet wired through
Electron main), so behavior in the renderer is unchanged. The Node smoke-import
above confirms the package itself is loadable and the factory wires up. The
`build:renderer` regression check moves to P4.2 (the first sub-phase that
edits renderer code), per `tasks.md` T101 / runbook §Build verification.

Surfaced per `tinbeta-coding-guardrail` Rule 7 / Rule 12: no `npm install` was
run, no new dependencies were added, and the deferral is recorded here rather
than papered over.

#### Tasks marked complete (T010–T033)

All P4.1 tasks ticked in `docs/features/phase-4-provider-core/tasks.md`.

#### Hard-constraint check (P4.1 boundary)

- `git push` performed: NO
- `runtime/**` edits: NO (`git diff --stat HEAD -- runtime/` shows nothing)
- `apps/desktop/**` edits: NO (P4.1 is package-only by design)
- New npm dependencies: NO
- Destructive git ops: NO

---

## Phase 4.2 — IPC cutover + key vault wiring + Phase 3 migration

Started 2026-05-15. Boss approval received for D1–D8 + P4.1 commit (`da8ee3f`).

### Skills re-read at start of P4.2 run
- `.claude/skills/speckit-implement/SKILL.md`
- `.claude/skills/tinbeta-coding-guardrail/SKILL.md`
- `.claude/skills/matt-git-guardrails-claude-code/SKILL.md`
(Spec / plan / tasks already in context from P4.1; re-applied without re-read.)

### Files modified / deleted (T040–T053)

| Path | Change | Notes |
|---|---|---|
| `apps/desktop/electron/main.cjs` | modified | `+initializeProviderCore()` at boot; 15 `swtd:provider:*` IPC handlers; reference-image path → Buffer resolver; AbortController map for cancel-generation. Three legacy Phase-3 handlers removed |
| `apps/desktop/electron/preload.cjs` | modified | adds `window.swtdProvider.*` surface; no `getKey`; legacy `window.swtd.saveGeneratedImage` / `listTmpGenerated` / `cleanupTmpGenerated` removed |
| `apps/desktop/src/shell/Shell.jsx` | modified | `migratePhase3LocalStorageKeys()` on mount; `generateSlot` reroutes through `window.swtdProvider.generateImage`; `slotGenerationIds` ref replaces local AbortController map; TopBar `providerKeyMissing` now driven by `hasKeyFor` IPC state |
| `apps/desktop/src/components/shell/ProviderPicker.jsx` | rewrite | IPC-only; saved key shows `••••••••` with Replace button (no reveal); Test connection calls `testProvider`; warning copy switches between safeStorage / AES-on-disk based on `vault.encryptionAvailable` |
| `apps/desktop/src/lib/tmp-cache.js` | rewrite | repointed to `swtd:provider:list-tmp-images` / `cleanup-tmp`; `saveGeneratedImage` removed (Generate path now hands bytes to media-store inside main) |
| `apps/desktop/src/lib/providers/registry.js` | rewrite | thin proxy: `loadProviders()` (IPC) + `getActiveProviderId / setActiveProviderId` (picker preference) |
| `apps/desktop/src/lib/providers/{mock,fal,openai}-provider.js` | **deleted** | renderer no longer holds HTTP-call code |
| `apps/desktop/src/lib/providers/types.js` | **deleted** | moved to `packages/provider-core/src/types.js` |
| `apps/desktop/src/lib/key-store.js` | **deleted** | replaced by `window.swtdProvider.{hasKeyFor, saveKey, clearKey}` |

Diff stat: 11 files changed, +598 / −999 LOC (net −401).

### Verification evidence

```
$ grep -rE "fetch\\(['\"]https?://(api\\.openai\\.com|fal\\.run|generativelanguage\\.googleapis\\.com|kieai\\.)" apps/desktop/src/
(zero hits — SC4 / US2 audit OK)

$ grep -rE "from ['\"](\\.\\.?/)+lib/key-store" apps/desktop/src/
$ grep -rE "from ['\"](\\.\\.?/)+lib/providers/(mock|fal|openai)-provider" apps/desktop/src/
$ grep -rE "from ['\"](\\.\\.?/)+lib/providers/types" apps/desktop/src/
(all zero hits — Phase 3 adapter set fully retired)

$ ls apps/desktop/src/lib/providers/
registry.js
(only the thin renderer-side proxy remains)

$ node --check apps/desktop/electron/main.cjs    # OK
$ node --check apps/desktop/electron/preload.cjs # OK
$ node --check apps/desktop/src/lib/tmp-cache.js # OK
$ node --check apps/desktop/src/lib/providers/registry.js # OK
```

JSX-files (`Shell.jsx`, `ProviderPicker.jsx`) cannot be `node --check`'d
without a transform. Informal brace/paren balance is zero on both. Full
build:renderer verification deferred to P4.5 when a `dev:electron` boot is
runnable here.

### Provider-core smoke (re-run for P4.2)

```
$ node --input-type=module -e "<createProviderCore + key vault roundtrip>"
hasKey after save: true
hasKey after clear: false
providers: openai,gemini,kie,fal,custom,mock
route: {"primary":"openai","fallbackChain":[],"allowMockFallback":false}
```

The key vault accepts `setKey` / `hasKey` / `clearKey` through the same
interface that `main.cjs` now drives at boot. Provider list + route config
unchanged from P4.1.

### Bundle key audit (deferred)

`apps/desktop/dist/` does not exist on this worktree, so the
`grep -rE "sk-[A-Za-z0-9]{20,}" apps/desktop/dist/` audit (tasks.md T050)
is deferred to P4.5 T104 where it will run after a fresh `npm run
build:renderer`. The renderer **source** is already proven leak-free by the
T049 grep above.

### Blocker / surfaced limitation

`apps/desktop/node_modules` is missing on this worktree. No `npm install`
performed (Boss policy + no new deps approved). Consequences:

1. `npm run build:renderer` not runnable here — moved to P4.3 / P4.5.
2. End-to-end `dev:electron` smoke (T051 migration toast, T052 DevTools
   plaintext probe) cannot be performed in this run. Code-level smoke
   (vault roundtrip + grep audits) confirms the architecture is in place.

Surfaced per `tinbeta-coding-guardrail` Rule 7 / Rule 12.

### Hard-constraint check (P4.2 boundary)

- `git push` performed: NO
- `runtime/**` edits: NO (`git diff --stat HEAD -- runtime/` shows nothing)
- New npm dependencies: NO
- Destructive git ops: NO (file deletions executed via `git rm`)
- Renderer has zero direct provider `fetch()` calls — verified
- No `getKey`-shaped IPC exposed to renderer — verified by audit


---

## Hard constraints binding on every task

- No `git push` at any boundary unless Boss explicitly requests.
- No edits to `runtime/**`. SC10 enforced.
- No destructive git ops (`reset --hard`, `clean -f`, `branch -D`, `restore .`, `checkout .`) without Boss approval.
- No new npm dependencies without surfacing the conflict first (plan §5 Q7).
- Renderer never reads plaintext provider keys after save (SC2).

## Sub-phase commit cadence

P4.1 (extract package) → P4.2 (IPC cutover + migration) → P4.3 (5 providers + Settings + fallback UI) → P4.4 (research → brief → composer) → P4.5 (polish). One commit per sub-phase minimum; Boss reviews diff between sub-phases.
