# Feature Spec — Phase 5: Amazon Compliance Engine

**Feature:** Pre-generation, pre-export, and post-generation compliance checks for Amazon listing images and A+ content. Rule engine with deterministic rules in v1 and an optional LLM/image-review provider check in v2. Surfaces PASS / WARN / BLOCK verdicts on slot cards, run timelines, and the export gate. Persists per-SKU compliance reports under `<sku>/compliance/`.
**Branch target:** `phase-5-amazon-compliance-engine` (to be cut from Phase 4 HEAD `3a21b19` when Boss greenlights implementation).
**Owner:** Boss (thondptit@gmail.com)
**Created:** 2026-05-15
**Status:** Planning — no source code touched in this run. Awaiting Boss approval before any implementation work begins.

> Companion docs: [`plan.md`](./plan.md) · [`tasks.md`](./tasks.md)
> Upstream architecture references: [`../phase-4-provider-core/spec.md`](../phase-4-provider-core/spec.md) · [`../../architecture/PROVIDER_CORE_ARCHITECTURE.md`](../../architecture/PROVIDER_CORE_ARCHITECTURE.md)

---

## 1. Problem & Why

Phase 4 closed the provider gap: SWTD-Studio can now run real listing-image generations against five providers, with research-driven prompts feeding a unified `image_generate` contract. What it **cannot** do today is tell the operator whether the prompt — or the resulting image — is safe to publish on Amazon.

Amazon's listing image and A+ Content policies enforce a long list of prohibitions. Violations can produce silent ranking penalties, account-warning emails, listing suppression ("variant not yet ready"), full ASIN takedowns, or — at the limit — seller-account suspension. Today, SWTD-Studio is a one-way pipe: operator picks a template, the engine generates an image, the operator approves and exports. Every guard against a non-compliant artifact is **in the operator's head**, which means:

1. **Insight Briefs ingest competitor copy verbatim.** Phase 4's research pipeline pulls product facts and customer language from third-party pages. Those pages routinely contain non-compliant claims (medical claims, unverifiable "#1 bestseller", trademarked names). Without a filter, those claims drift into the Creative Brief, then into the composed prompt, then into the generated image.
2. **Creative Briefs encode `mustShow` instructions.** A `mustShow: ["doctor recommended"]` token derived from a competitor's page becomes a real instruction to the image model. The generated image will likely contain that text overlay. Amazon will likely suppress the listing.
3. **Composed prompts can carry banned phrases.** Even a hand-edited prompt override (Phase 1 surface) can request "review badges", "Amazon's Choice mock-up", "before/after weight loss", "child unsupervised with product", or "compares to <CompetitorTM>" — none of which are catchable by today's pipeline.
4. **`image_generate` requests are dispatched without inspection.** Today the operator and the model are the only check. There is no rule engine between the composed prompt and the provider call.
5. **Generated images carry no compliance metadata.** Sidecar JSON records `mode / model / providerId / fallbackChain` but says nothing about whether the image passes a pre-export gate.
6. **Approval and export are free-of-checks.** The operator can promote a non-compliant `tmp-generated` image into `approved/` and a downstream export step (future) will treat it as final. There is no "compliance must pass to export" gate.

Phase 5 closes those six gaps with one architecture move: **insert a Compliance Engine alongside the Provider Core**, with hooks at every stage where listing content is created or read. The engine is a deterministic rule pipeline in v1 (no LLM in the loop), with reason codes, severities, suggested fixes, and PASS / WARN / BLOCK verdicts. The Provider Core treats compliance as a peer subsystem — same package shape (`packages/compliance-core/`), same Electron-main-injection pattern, same cloud-portability constraint (zero `electron` / `react` imports).

**What this phase does NOT do:** it does not implement an image-vision compliance check (e.g. read the generated PNG and detect a trademark logo). The architecture documents that hook as a v2 provider-backed extension (the LLM/image-review provider would plug in through Provider Core's existing adapter interface), but v1 ships text-only deterministic checks. The architecture commitment is that v2 swaps an adapter, not the engine.

**What this phase explicitly does not change:** it does not modify `runtime/**` (SC10 carried from Phase 4); it does not weaken Phase 4's untrusted-content sentinel; it does not introduce a new LLM dependency in v1; and it does not auto-rewrite prompts. The Compliance Engine **reports**; the operator (and the suggested-fix UI) **decides**.

---

## 2. User Stories

> Priorities follow SpecKit convention: P1 is the minimum viable slice; later stories layer on top. Each story is independently demoable.

### US1 (P1) — Deterministic rule engine with PASS / WARN / BLOCK verdicts

**As an** operator who needs to ship Amazon-compliant listings
**I want** a deterministic rule engine that scans listing content (briefs, prompts, image metadata) and returns a structured verdict per rule
**So that** I have a machine-readable answer to "is this safe to publish?" instead of relying on memory and tribal knowledge.

**Required:**

- A new package `packages/compliance-core/` with the same boundary rules as Provider Core (zero `electron` / `react` imports; injected dependencies for any side-effect; cloud-portable).
- A `RuleEngine` factory `createComplianceEngine({ rulePacks, logger })` that loads one or more rule packs at boot and exposes a single entry point `evaluate(subject, ctx)`.
- A **rule pack** is a versioned, operator-readable JSON file under `packages/compliance-core/rules/amazon/` (one starter pack: `amazon-listing-v1.json`). Each rule declares: `id`, `category`, `severity` (`info | warn | block`), `appliesTo[]` (which stage(s) — see US3), `patterns[]` or `predicate`, `messageKey`, `suggestedFixKey`, `references[]` (links to Amazon policy sources for audit trail).
- A **subject** is a typed wrapper around the content being checked: `{ kind: 'text' | 'brief' | 'prompt' | 'image-metadata' | 'export-bundle', payload, source }`. Subjects carry enough context (slot id, SKU path, stage) for the engine to attribute findings.
- The verdict shape is fixed and used everywhere downstream:

  ```ts
  type ComplianceVerdict = {
    overall: 'pass' | 'warn' | 'block'   // worst severity across findings
    findings: Array<{
      ruleId: string
      category: string
      severity: 'info' | 'warn' | 'block'
      stage: 'insight-brief' | 'creative-brief' | 'prompt' | 'image-generate' | 'image-metadata' | 'export'
      slotId?: string | number
      module?: string                    // A+ module id when applicable
      excerpt?: string                   // the offending text passage, ≤ 200 chars
      messageKey: string                 // i18n key
      suggestedFixKey?: string           // i18n key for the suggested-fix copy
      references: string[]               // Amazon policy URLs for audit
    }>
    evaluatedAt: number
    engineVersion: string
    rulePackVersions: Record<string, string>
  }
  ```

- The engine is **pure**: no filesystem or network side effects from `evaluate(...)` itself. Persistence happens in the Electron main wrapper (US4).

**Acceptance:**

- Loading `amazon-listing-v1.json` at boot exposes the rule set via `listRules()` and the rule count matches the JSON entry count.
- `evaluate(subject)` on a clean payload returns `{ overall: 'pass', findings: [] }`.
- `evaluate(subject)` on a payload containing one BLOCK trigger plus one WARN trigger returns `overall: 'block'`, two findings, with severities preserved.
- The engine has zero Electron imports (`grep -rE "electron" packages/compliance-core/` returns zero hits).
- Adding a new rule to the JSON pack (no code change) extends coverage on the next app boot.

### US2 (P1) — Amazon-listing rule pack v1 (the rules themselves)

**As an** operator preparing Amazon US listings
**I want** the first rule pack to cover the prohibitions Amazon enforces most aggressively
**So that** v1 catches the violations that actually cause listing suppression today.

**Required (categories + example rules — full pack lives in `rules/amazon/amazon-listing-v1.json`):**

| Category | Severity | Example rule triggers (case-insensitive) |
|---|---|---|
| `false-claim` | `block` | "guaranteed", "100% effective", "permanent results", "eliminates [condition]" |
| `unverifiable-superlative` | `warn` | "#1 [product]", "best in the world", "world's leading", "highest rated" (without context) |
| `medical-health-claim` | `block` | "cures", "treats", "prevents [disease]", "FDA approved" (when not on an actual FDA-cleared device), "doctor recommended" without supporting metadata |
| `competitor-trademark` | `block` | Detects competitor-brand tokens injected from the Insight Brief's `market.competitors[]`; flags when any brand string appears verbatim inside the prompt or `mustShow` |
| `misleading-badge` | `block` | "Amazon's Choice", "Best Seller", "Editor's Pick", "Prime" (badge mock-ups overlayed on the image), "Amazon.com" wordmarks |
| `prohibited-overlay-text` | `block` | Image prompts that explicitly request "review stars", "5-star rating overlay", price stamps with "$" + numbers, "as seen on TV", "ASIN" tokens, QR-code stickers |
| `deceptive-before-after` | `warn`→`block` | "before / after weight loss", "before / after wrinkle removal" combined with `mustShow: ["transformation"]`; `block` when paired with health-claim category in the same finding |
| `unsafe-children-baby` | `block` | "baby unsupervised", "infant in product without parent present", choking-hazard-suggestive imagery prompts; "for newborn" + a small-part product without compliance metadata |
| `review-rating-manipulation` | `block` | "ask for 5 stars", "review incentive", "leave a positive review", "[brand] highest rated" without independent source |
| `intellectual-property` | `warn` | Disney / Marvel / sports-league names / movie titles surfacing from research and unflagged |
| `sensitive-content` | `warn`→`block` | Adult themes appearing in children's-category listings; weapons in non-allowed categories |
| `marketplace-specific` | `info` | Marketplace-conditional rules (Amazon US vs Etsy vs Social) — informational in v1, escalation deferred |

- Every rule entry carries an Amazon-policy `references[]` URL list (sourced from the public seller-central policy pages). Operators can click through from the UI to see why a rule exists.
- Every rule entry carries an EN + VI `messageKey` and `suggestedFixKey` in `apps/desktop/src/lib/i18n.js`.
- The rule pack is **versioned** (`pack.version = '1.0.0'`, `pack.publishedAt`). Bumping the pack version is the only way to change a rule, so audit trails stay reproducible.

**Acceptance:**

- Each of the 12 categories has at least one rule with a triggering test fixture under `packages/compliance-core/test/fixtures/` (US7).
- Running `evaluate(...)` on every fixture produces the expected `overall` verdict and ruleId match.
- A rule's `references[]` list never includes an unsanitized URL fetched from the web; all references are baked-in policy citations.
- An obsolete rule can be removed only by publishing a new pack version (the engine keeps a frozen copy of every version it has ever loaded under `<userData>/compliance/packs/`).

### US3 (P1) — Compliance hooks at six stages of the Provider Core pipeline

**As an** operator who wants to catch issues as early as possible (and as a last line of defense at export)
**I want** the engine to evaluate content at six discrete stages — Insight Brief, Creative Brief, Prompt Composer, image_generate request, generated-image metadata, and approved/export bundle
**So that** a violation surfaces at the earliest point it can be caught, and is impossible to bypass at export.

**Required:**

- **Hook 1 — Insight Brief.** After `buildInsightBrief(...)` writes `<sku>/research/insight-brief.json`, the main process synchronously calls `complianceEngine.evaluate({ kind: 'brief', payload: insightBrief, ... })`. The verdict is persisted at `<sku>/compliance/insight-brief.json` and bundled into the `swtd:provider:research-insight` IPC response so the renderer can render warnings inline in the `InsightBriefViewer`.
- **Hook 2 — Creative Brief.** Same pattern after `buildCreativeBrief(...)`. The Creative Brief's `mustShow` / `mustAvoid` lists are scanned. Verdict persists at `<sku>/compliance/creative-brief.json`. The viewer in `Shell.jsx` paints `mustShow` items red when they trigger a BLOCK and surfaces the suggested fix as an inline chip.
- **Hook 3 — Prompt Composer.** After `composePrompt(template, angleId, context)` produces the final prompt string, the renderer fires `swtd:compliance:check-prompt` with `{ slotId, prompt, templateId, angleId }`. Verdict is rendered inline on the `SlotCard` as a chip (`✓ compliant` / `⚠ warnings` / `✗ blocked`). A BLOCK disables the Generate action by default unless the operator clicks "override + acknowledge" (US6).
- **Hook 4 — `image_generate` request.** Inside `electron/main.cjs`'s `swtd:provider:generate-image` handler, **before** the call leaves the process, the engine re-evaluates the resolved prompt + the resolved Creative Brief `mustShow`. If verdict is BLOCK and no operator override token is attached to the request, the handler rejects with `ProviderError{ reason: 'compliance-block', findings }` and never spends a credit.
- **Hook 5 — Generated-image metadata.** After `media-store.saveTmpImage(...)` returns, the sidecar JSON is augmented with the prompt-time compliance verdict and a `metadataVerdict` computed against the sidecar fields themselves (`mode`, `model`, `providerId`, `mustShow`, `templateId`, `angleId`). Both verdicts are written into the sidecar under a new `compliance: { promptVerdict, metadataVerdict }` block. `listTmpImages(...)` surfaces both to the renderer.
- **Hook 6 — Approve & Export gate.** When the operator promotes a tmp image to `approved/` via `promoteToApproved(...)`, the main process re-runs the engine over the full export-bundle shape (slot images + their sidecar verdicts + chosen template metadata + per-SKU brand context). A bundle verdict is persisted at `<sku>/compliance/export-bundle.json`. The Export action is disabled when the bundle verdict is BLOCK; the operator must either fix the offending slots or invoke the explicit override (US6).

**Acceptance:**

- A research run that ingests a fixture URL containing "doctor recommended" produces an `insight-brief.json` whose compliance counterpart records one `medical-health-claim` BLOCK finding.
- A Creative Brief derived from that Insight Brief contains a `mustShow` flagging the same finding before any prompt is composed.
- A composed prompt that drops "doctor recommended" but retains "world's leading" still produces a WARN at the prompt stage.
- A `generate-image` IPC call with a BLOCK-stage prompt is rejected without any provider HTTP call (`grep` on the main-process log shows no outbound `api.openai.com` request; cost is zero).
- A promote-to-approved call when any slot has a BLOCK verdict surfaces a single "Export blocked: N slots have compliance violations" error in the UI; the slot list with severities is visible.

### US4 (P1) — Per-SKU compliance report JSON storage

**As an** operator and auditor
**I want** every compliance verdict for a SKU saved on disk in a stable JSON format
**So that** I can re-open a SKU days later and see exactly what passed, warned, or blocked — and which Amazon policy was cited.

**Required:**

- New directory layout (Electron main owns writes):

  ```
  <sku>/compliance/
    insight-brief.json      // Hook 1 verdict
    creative-brief.json     // Hook 2 verdict
    prompts/slot-<N>.json   // Hook 3 verdict per slot (one file per slot)
    metadata/slot-<N>.json  // Hook 5 verdict per slot (mirrors sidecar compliance block)
    export-bundle.json      // Hook 6 verdict (full bundle)
    overrides.json          // operator override log (US6)
    history/                // append-only log of every verdict produced (keyed by isoTs)
  ```

- All compliance writes go through a single path guard (`assertInsideSku`) mirroring `media-store.js`'s pattern. Path traversal attempts are rejected.
- Each JSON file is the `ComplianceVerdict` shape from US1, plus a `subject` summary (which kind, what slotId/module, an excerpt of the input) for traceability.
- Reports are **idempotent and overwritable** for the current state plus **append-only** to `history/` (one snapshot per evaluation, named `<isoTs>-<subjectKind>.json`).
- The renderer reads through IPC (`swtd:compliance:get-report(skuPath)`) which returns a bundled snapshot for the current state across all hooks.
- On SKU close/reopen the renderer's compliance state is hydrated from disk before any hooks re-run, so the operator sees the last-known verdict immediately.

**Acceptance:**

- After a full pipeline run (research → brief → prompt → generate → promote), the SKU contains `<sku>/compliance/insight-brief.json`, `creative-brief.json`, one `prompts/slot-<N>.json` per attempted slot, one `metadata/slot-<N>.json` per generated slot, and `export-bundle.json`.
- Closing and reopening the SKU re-loads the verdicts without triggering a new evaluation cycle.
- A second pass over the same content (re-research, re-generate) updates the current-state files and appends a fresh snapshot to `history/`.
- A path-traversal injected into `slotId` (e.g. `../../etc/passwd`) is rejected; the file is never written.

### US5 (P1) — Compliance panel UI on slot cards, run timeline, and pre-export gate

**As an** operator
**I want** to see the compliance verdict for every slot directly on the slot card, see the same verdicts grouped in the run timeline, and be blocked at the export step when any slot is non-compliant
**So that** I never wonder where a warning came from, and I can't accidentally export a violating slot.

**Required:**

- **Slot card.** `SlotCard.jsx` gains a compliance chip beside the existing `servedProvider` badge: `✓ compliant`, `⚠ N warnings`, or `✗ N blocks`. Hovering opens a small panel listing each finding's `messageKey` + `suggestedFixKey`, with a "Why?" link that opens the Amazon policy `references[0]` in the system browser.
- **Compliance panel (per-slot drawer).** Clicking the chip slides open a dedicated panel inside the existing slot drawer (or a sibling panel — final shape decided in implementation): shows full finding list, the offending excerpt, the suggested fix, and an "Apply suggested fix" button (US6) for fixes the engine can auto-stage.
- **Run timeline.** The existing per-slot stdout `done` line (Phase 4 P4.5) gets a compliance suffix: `done … (compliance: pass)` / `done … (compliance: warn — 2 findings)` / `done … (compliance: BLOCK — 1 finding: medical-health-claim)`. The aggregate timeline pane shows a single-line compliance summary at the top of the run.
- **Pre-export gate.** The Export action (whenever it lands; today the Approve action plays its role) is gated by the export-bundle verdict. A modal lists every blocked slot, with a "Fix or override" choice per row. The operator cannot bypass with a single click — each block requires a deliberate per-finding acknowledgement (US6).
- All copy is localised (EN + VI) via `lib/i18n.js`. Severity colors reuse the Phase 2 chip palette (no new tokens).

**Acceptance:**

- A slot whose composed prompt contains "doctor recommended" shows a red `✗ 1 block` chip on its card; the drawer lists the rule, the excerpt, and the suggested fix; the Generate action is disabled with a tooltip.
- The run timeline header shows `Compliance: 1 block · 0 warnings` when one slot is blocked.
- Clicking Export with at least one blocked slot opens the pre-export modal; clicking "Cancel" closes it; clicking "Continue" requires per-finding acknowledgement before becoming clickable.
- Hovering the chip shows the EN copy with the user-system locale; VI copy renders when the renderer locale is set to `vi`.
- The `references[0]` "Why?" link opens externally via the existing safe-shell helper; no untrusted URL is ever shell-opened (the references are baked-in policy URLs from the rule pack).

### US6 (P2) — Operator override flow with audit log

**As an** operator who occasionally has legitimate reasons to override a compliance finding
**I want** a deliberate, audited override flow per finding
**So that** I can ship a known-edge-case slot without losing the audit trail (e.g. a regulated medical device with valid FDA registration documents).

**Required:**

- Override is **per-finding, never per-rule wholesale**. The operator cannot disable a rule for the SKU; they can only acknowledge that a specific finding for a specific subject is intentional.
- The override UI is a small modal: shows the finding, requires a short freeform reason (≥ 8 chars, ≤ 280 chars), requires confirming the operator name (pre-filled from app config), and produces an override token `{ findingId, ruleId, subjectKey, reason, operator, createdAt, expiresAt }`.
- Overrides are persisted to `<sku>/compliance/overrides.json` (current state) and appended to `<sku>/compliance/history/` so a later auditor can reconstruct the decision.
- An override has a default `expiresAt = createdAt + 7 days` so an old override does not silently re-enable a violation forever. After expiry the engine treats the finding as un-overridden until the operator re-acks.
- The Generate / Export gate checks the active overrides set; only findings with a matching unexpired override are allowed to pass.
- "Apply suggested fix" buttons (US5) are a separate flow: they don't create an override; they update the source content (e.g. remove a `mustShow` entry) and re-run the relevant hook. If the fix resolves the finding, no override is needed.

**Acceptance:**

- A blocked slot can be unblocked by creating a per-finding override with a reason; the override appears in `overrides.json`; the slot's compliance chip changes to `⚠ overridden` (yellow/amber, not green) and the Generate button is enabled.
- An override with empty reason or reason < 8 chars is rejected client-side and server-side.
- An override older than 7 days no longer suppresses its finding (verified by manipulating the `createdAt` field on disk and reopening the SKU).
- The history log contains one entry per override creation and re-evaluation event.

### US7 (P2) — Test fixtures + offline rule-pack smoke

**As an** engineer maintaining the rule pack
**I want** a fixture-based test surface that proves every rule fires exactly when it should
**So that** future edits to the rule pack don't silently regress coverage.

**Required:**

- New directory `packages/compliance-core/test/fixtures/` with one fixture per rule category (and ideally one per rule). Each fixture is a JSON file: `{ subject: ComplianceSubject, expected: { overall, ruleIds: string[] } }`.
- A Node-runnable smoke harness `packages/compliance-core/test/run-rules.mjs` that loads the rule pack, runs every fixture, and exits non-zero if any expected ruleId fails to fire (or unexpected ruleId fires).
- The smoke runs without `apps/desktop/node_modules` (pure Node 18+, no Electron, no React, no test framework).
- The smoke is wired into the Phase 5 verification gate (SC pre-impl criterion); it is **not** wired into the renderer or the production app — purely a maintainer tool.

**Acceptance:**

- `node packages/compliance-core/test/run-rules.mjs` exits 0 on the v1 pack and prints a one-line summary `N rules · M fixtures · 0 failures`.
- Removing a rule from the pack causes its fixture to fail with a clear "expected ruleId X but it did not fire" message.
- Adding a fixture for a hypothetical "Etsy `handmade` claim" rule fails immediately if the rule is not yet authored, then passes once the rule lands.

### US8 (P3) — Provider-backed image-vision review (v2, architecturally planned)

**As an** operator who wants the generated image (not just the prompt) checked
**I want** an optional provider-backed vision check that reads the generated PNG and flags overlays / logos / unsafe imagery the deterministic rules cannot see
**So that** v2 catches the violations the prompt-stage rules miss (e.g. a model that generated an "Amazon's Choice" badge despite the prompt not asking for one).

**Required (v1 work: architecture only — implementation deferred to v2):**

- The architecture commits to: the vision check is a **Provider Core adapter**, not a Compliance Engine internal. It reuses `ProviderRegistry` and ships as `packages/provider-core/src/providers/vision-compliance.js` (or similar). It implements an `evaluateImage(buffer, ctx) → ComplianceVerdict` method that returns the same verdict shape as US1.
- The Compliance Engine exposes a `registerExtension(extension)` seam so the renderer can opt into the vision check per SKU or globally. v1 ships with no extensions registered.
- v2 may use OpenAI's vision-capable models, a dedicated content-moderation API, or a self-hosted classifier — the choice is deferred. v1 only locks the seam shape.

**Acceptance (v1 architecture only):**

- `packages/compliance-core/src/index.js` exposes `registerExtension(extension)` and `evaluate(...)` calls registered extensions when `ctx.includeVision === true`.
- v1 ships with zero extensions; calls always return text-stage findings only.
- The `PROVIDER_CORE_ARCHITECTURE.md` reference doc gains a §16 stub describing the future adapter.

---

## 3. Success Criteria (Measurable, Tech-Agnostic)

| # | Criterion | How verified |
|---|---|---|
| SC1 | A pipeline that ingests a fixture containing a medical claim never reaches the provider's `generate-image` HTTP endpoint (zero credit spent) | Stub the provider; assert main-process log has no outbound HTTP entry for that run |
| SC2 | Every rule in the v1 pack has a corresponding fixture that triggers it; the smoke harness passes | `node packages/compliance-core/test/run-rules.mjs` exits 0; coverage report attached in runbook |
| SC3 | Compliance verdicts persist on disk and survive SKU close/reopen | Round-trip walk: run pipeline → close SKU → reopen SKU → assert the slot chips render the same severities without re-running the engine |
| SC4 | A composed prompt with one BLOCK trigger disables Generate by default; the operator can only override per-finding with a non-empty reason | Manual walkthrough + DevTools confirms the button is `disabled`; override flow rejects empty reasons client- and server-side |
| SC5 | The Export action is blocked when any slot's prompt or metadata verdict is BLOCK; bypass requires per-finding acknowledgement | Manual walkthrough; modal renders one row per blocked slot; bypass button starts disabled |
| SC6 | The compliance package has zero Electron and zero React imports; the engine remains cloud-portable | `grep -rE "electron\|react" packages/compliance-core/` returns zero hits |
| SC7 | A compliance check on an empty/clean subject returns `{ overall: 'pass', findings: [] }` in under 50 ms on a typical operator machine | Renderer timing log over 100 clean evaluations |
| SC8 | All operator-facing copy is localised (EN + VI) | Inspect `apps/desktop/src/lib/i18n.js`; no string starts with `[compliance]` placeholder fallback in either locale |
| SC9 | External marketplace pages cannot inject rules or bypass the engine — webpage-derived text is always treated as a subject, never as code, never as a rule | Verify `<UNTRUSTED_WEB_CONTENT>` sentinel from Phase 4 is preserved through compliance evaluation; no rule loader path reads from the web at runtime |
| SC10 | No source code under `runtime/**` is modified during Phase 5 implementation | `git diff base..HEAD -- runtime/` returns zero lines |

---

## 4. Scope & Out-of-Scope

### In scope (Phase 5 as a whole)

- New package `packages/compliance-core/` with:
  - `src/types.js`, `src/error.js`, `src/logger.js` (mirrors Provider Core's `logger.js` secret-scrubbing pattern, scrubbing nothing extra in v1 but reserved for adapter logs)
  - `src/rule-engine.js` — pure evaluation core (`evaluate(subject, ctx)`)
  - `src/rule-loader.js` — loads + validates + freezes rule packs at boot
  - `src/subjects.js` — typed subject constructors (`makeBriefSubject`, `makePromptSubject`, `makeMetadataSubject`, `makeExportSubject`)
  - `src/predicates/` — small library of predicate primitives the rules compose: `containsAny`, `containsRegex`, `whenCategoryMatches`, `whenTokenLooksLikeTrademark`, `whenMustShowIncludes`, etc.
  - `src/index.js` — `createComplianceEngine(...)` factory + public surface
  - `rules/amazon/amazon-listing-v1.json` — v1 rule pack
  - `test/fixtures/` + `test/run-rules.mjs`
- Electron main wiring:
  - `apps/desktop/electron/main.cjs` — instantiate `createComplianceEngine({...})` at boot, register IPC handlers under `swtd:compliance:*`, weave hooks into the existing `swtd:provider:*` handlers (research-insight, generate-image, promote-to-approved)
  - `apps/desktop/electron/preload.cjs` — expose `window.swtdCompliance.{...}` surface
- Renderer:
  - `apps/desktop/src/components/shell/ComplianceChip.jsx` (new) — the small chip used in SlotCard + InsightBriefViewer
  - `apps/desktop/src/components/shell/CompliancePanel.jsx` (new) — the drawer/panel for full finding list + suggested fixes + override entry
  - `apps/desktop/src/components/shell/ExportGate.jsx` (new) — the pre-export modal (used wherever the export action lives once it ships; today wired to promote-to-approved)
  - Touch points in `SlotCard.jsx`, `InsightBriefViewer.jsx`, `MainCanvas.jsx` (timeline summary), `Shell.jsx` (state hydration)
- Renderer state:
  - `Shell.jsx` owns the `complianceReports` map, hydrated on SKU open via `swtd:compliance:get-report`, refreshed on each hook firing
- i18n + styles:
  - `apps/desktop/src/lib/i18n.js` — all new copy (EN + VI)
  - `apps/desktop/src/styles/shell.css` — chip + panel + export-gate styling (reuses Phase 2 chip palette)
- Updated SpecKit-tracked documentation:
  - This spec, `plan.md`, `tasks.md`, `docs/dev/TASK_RUNBOOK_PHASE_5.md`
  - Companion architecture reference: a §16 stub appended to `docs/architecture/PROVIDER_CORE_ARCHITECTURE.md` describing the vision-adapter seam (US8). A standalone `docs/architecture/COMPLIANCE_CORE_ARCHITECTURE.md` is created during the implementation polish phase.

### Out of scope (explicit, this phase)

- **No `runtime/**` changes.** Phase 5 is desktop-app architecture; legacy runtime is untouched. SC10 enforced.
- **No provider-backed image-vision check in v1.** Architecturally planned (US8); implementation deferred. v1 ships text-only deterministic checks.
- **No automatic prompt rewriting.** The engine reports; the operator (or the "Apply suggested fix" affordance for narrow, mechanical fixes) decides. No silent re-writes.
- **No new LLM/network dependencies in v1.** The engine is deterministic. Phase 4's research backend stays the only place that fetches the web; compliance reads the persisted artifacts only.
- **No rule-pack updates over the network.** v1 ships frozen-on-disk packs; remote rule-pack publishing is a separate Phase.
- **No marketplace beyond Amazon in v1.** Etsy, Walmart, and Social rules surface only as `marketplace-specific` informational entries; their dedicated packs land in a follow-up phase.
- **No per-user permission model.** Override creation is single-operator-trusted in v1 (any operator on the machine can create overrides). Multi-user audit is a future Phase.
- **No new design tokens.** Reuse Phase 2 motion + color tokens.
- **No new npm dependencies.** Pure Node `node:fs`/`node:path` + V8 regex + the bundled JSON rule pack. If a maintainer judges that a small regex helper would simplify the predicates, they must surface that conflict before adding the dep (`tinbeta-coding-guardrail` Rule 7).
- **No A+ Premium template authoring** (that is its own separate phase per the source-of-truth plan). Phase 5 covers compliance for whatever A+ content exists; it does not author new A+ templates.
- **No competitor-trademark allow-list management UI in v1.** The trademark detection uses the Insight Brief's `market.competitors[]` plus a hardcoded list of major Amazon-policy-restricted brands. An operator-editable allow-list is deferred to a follow-up.

---

## 5. Assumptions

| # | Assumption | Risk if wrong |
|---|---|---|
| A1 | Phase 4's Provider Core surface (`swtd:provider:*`, `<sku>/research/`, `<sku>/output/tmp-generated/`) is the merged baseline that Phase 5 builds on | Low — Phase 4 has shipped through P4.5 on `listing-slot-preview-review`; Phase 5 cuts from that HEAD |
| A2 | Amazon's listing-image policy URLs are stable enough to bake into the rule pack's `references[]` list for v1 | Medium — Amazon does rotate URLs; the rule-pack version bump is the existing mitigation; v2 may add a redirect-checker |
| A3 | Deterministic text matching catches the majority of catchable violations at the prompt stage; an image-vision pass is genuinely complementary, not redundant | Medium — verified by `audits/RESOURCE_AUDIT_TAI_NGUYEN_AI.md` + spot-check; v2 vision adapter is the safety net |
| A4 | Operators want PASS / WARN / BLOCK granularity, not a single binary verdict | Low — Boss explicitly asked for 3-tier severity in the task brief |
| A5 | Suggested fixes for narrow categories (e.g. removing a `mustShow` token) can be applied mechanically without LLM judgement | Low — restricted to mechanical fixes (token removal, phrase deletion); anything ambiguous is operator-decided |
| A6 | The same engine shape works for Amazon listing images AND A+ content; the only delta is which `subject.module` is being evaluated | Low — A+ modules are still images + text overlays; same predicate library applies |
| A7 | 7-day override expiry is the right default | Low — operator-configurable in a future polish phase if Boss requests it; v1 is fixed-default |
| A8 | The rule-pack JSON shape can absorb new categories (e.g. Etsy `handmade` claims) without a schema migration | Low — the shape is intentionally flat; categories are strings; new categories require zero schema change |
| A9 | Compliance reports under `<sku>/compliance/` do not exceed disk-size sanity (each file < 100 KB typical, < 1 MB max) | Low — verdict size scales with the finding count, not the artifact size; capped by the operator's pack size |

---

## 6. Dependencies

- **Phase 4 Provider Core** (`packages/provider-core/`, `swtd:provider:*` IPC namespace, `<sku>/research/`, `<sku>/output/tmp-generated/` sidecar shape) must be the base branch. Phase 5 hooks integrate into Phase 4's handler set; without it, the architecture has nowhere to plug in.
- **Phase 2 Prompt Composer** (`packages/core/templates/listing/`, the variable-injection system, `mustShow` / `mustAvoid` tokens) must be in place so the prompt-stage hook has a structured subject to evaluate.
- **Phase 1 slot state machine** must continue to drive UI state; the compliance chip is a peer to the existing state badges, not a replacement.
- **`SWTD_EXECUTION_PROTOCOL.md` v1.1** still binding (workflow + skills-read + sub-phase commit cadence).
- **No new npm deps** in v1.

---

## 7. Locked Decisions

The following decisions are locked for Phase 5. Boss approval is required before implementation work begins; once approved, these are referenced from `plan.md` and `tasks.md` as binding.

**D1 — Three-tier verdict.** `pass | warn | block` (not a binary). Operator wants the granularity to ship WARN-but-not-BLOCK content with eyes open. (US1.)

**D2 — Six hooks.** Insight Brief, Creative Brief, Prompt Composer, image_generate, generated-image metadata, export bundle. The architecture must support all six in v1; the engine itself is stage-agnostic, but the IPC wiring binds each stage explicitly. (US3.)

**D3 — Deterministic-first; vision-second.** v1 ships text-only deterministic rules. v2 architecturally commits to a Provider Core adapter for image-vision review (US8). The engine exposes `registerExtension(...)` in v1 so v2 is a wiring change, not an engine rewrite.

**D4 — Per-finding override with 7-day expiry.** No rule-level disable. Override carries operator name, reason (≥ 8 chars), and an explicit `expiresAt`. Auditable. (US6.)

**D5 — Per-SKU persistence at `<sku>/compliance/**`.** All verdicts, overrides, and history snapshots live next to the SKU they describe. App-global compliance cache is **not** maintained. (US4.)

**D6 — Compliance is a peer subsystem, not a Provider Core internal.** The package lives at `packages/compliance-core/` (sibling to `packages/provider-core/`) with the same boundary rules (zero `electron` / `react` imports). This keeps the engine cloud-portable and independent of provider concerns. (SC6.)

**D7 — Untrusted-content sentinel preserved.** Webpage-derived text always reaches the engine through Phase 4's `<UNTRUSTED_WEB_CONTENT>` sentinel-wrapped Insight Brief artifacts. The compliance package itself never makes a `webFetch` call. Webpage instructions cannot become rules or commands. (SC9.)

**D8 — No `runtime/**` edits.** Carried from Phase 4 (SC10). Phase 5 is desktop-app architecture; the legacy runtime is untouched.

These decisions are now part of the binding spec for Phase 5 implementation.

---

## 8. Non-Goals & Anti-Patterns

- ❌ No silent prompt rewriting. The engine reports; the operator (or a narrow, mechanical "Apply suggested fix" affordance) decides.
- ❌ No "trust the model" assumption — the prompt-stage check is mandatory even when the model claims it filtered content itself.
- ❌ No rule-pack updates from the network in v1. Packs ship on disk and are version-locked.
- ❌ No global rule-disable affordance. Operators can override findings, never rules.
- ❌ No bypass without per-finding acknowledgement. The export gate's "Continue" button stays disabled until every blocked finding has an override or a fix.
- ❌ No webpage-content-as-instruction. Rules live in the bundled pack JSON; nothing fetched at runtime can become a rule.
- ❌ No new design tokens or chip palette. Reuse Phase 2 motion + color.
- ❌ No exposing engine internals through preload. Renderer reaches the engine only through the IPC surface.
- ❌ No mixing renderer-side and main-side rule evaluation. The renderer renders verdicts; main evaluates. The package itself runs in main; the renderer never imports `packages/compliance-core/` directly.
- ❌ No "approved means compliant" assumption. Approval is operator intent; compliance is the engine's answer. Both must pass for export.
- ❌ No package-level "if-cloud-then-X" branches in `packages/compliance-core/`. The package is cloud-agnostic.

---

## 9. Glossary

| Term | Definition |
|---|---|
| Compliance Engine | The package at `packages/compliance-core/` that loads rule packs and produces verdicts |
| Rule Pack | A versioned JSON file under `packages/compliance-core/rules/amazon/` describing a coherent set of rules (categories, severities, predicates, references, message keys) |
| Rule | An entry inside a Rule Pack; has `id`, `category`, `severity`, `appliesTo[]`, `patterns[]` or `predicate`, `messageKey`, `suggestedFixKey`, `references[]` |
| Subject | The typed input to the engine: `{ kind, payload, source }`. Kinds: `brief`, `prompt`, `image-metadata`, `export-bundle` |
| Verdict | The engine's structured answer: `{ overall: 'pass'\|'warn'\|'block', findings[], evaluatedAt, engineVersion, rulePackVersions }` |
| Finding | A single rule firing on a subject: `{ ruleId, category, severity, stage, slotId?, module?, excerpt?, messageKey, suggestedFixKey?, references[] }` |
| Hook | A predefined integration point on the pipeline (Hook 1 → Hook 6 from US3) where the engine is invoked |
| Override | A per-finding, operator-approved acknowledgement carrying reason + expiry; suppresses the finding for the SKU until expiry |
| Stage | Which part of the pipeline the subject came from: `insight-brief`, `creative-brief`, `prompt`, `image-generate`, `image-metadata`, `export` |
| Suggested fix | The mechanical change the engine recommends (e.g. remove a token from `mustShow`); applies cleanly when the operator clicks "Apply suggested fix" |
| Export Gate | The pre-export modal that blocks promotion to approved or to a downstream export step when any slot's verdict is BLOCK |
| Provenance | Phase 4's `<sku>/research/sources.json` flagged-passage list; preserved by the engine when surfacing findings traceable to a research source |
| Vision Adapter | The deferred Provider Core adapter (US8) that reads generated PNG bytes and produces a `ComplianceVerdict` of the same shape |

---

**End of spec.md.** Implementation does not begin until Boss reviews this document, the companion [`plan.md`](./plan.md), and the executable [`tasks.md`](./tasks.md), and explicitly approves them in the [`TASK_RUNBOOK_PHASE_5.md`](../../dev/TASK_RUNBOOK_PHASE_5.md).
