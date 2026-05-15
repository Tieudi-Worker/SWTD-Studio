# Feature Spec — Phase 2: Template & Prompt Engine

**Feature:** Template-driven prompt engine for the 8-slot listing pipeline
**Branch target:** `phase-2-template-engine` (to be cut from Phase 1 HEAD once merged, or from `listing-slot-preview-review` if Phase 1 lands separately)
**Owner:** Boss (thondptit@gmail.com)
**Created:** 2026-05-15
**Status:** Planning complete — awaiting implementation approval

---

## 1. Problem & Why

Today SWTD-Studio's prompts are **hardcoded inside `runtime/legacy/agents/*`**. Every SKU runs through the same prompt skeleton. The operator can edit a per-slot prompt override (Phase 1, UI-only) but it is not consumed by the runtime, and there is no library of high-converting prompt formulas to pick from.

The TAI NGUYEN AI reference pack already contains battle-tested prompt assets:

- **6 Amazon Listing Image Prompts** (Hero / Features / Inside / Comparison / Lifestyle / Spec) — `docs/audits/RESOURCE_AUDIT_TAI_NGUYEN_AI.md` §3.2.
- **40 static-ad templates** with bracketed placeholders + aspect ratios — same audit §3.x.
- **16-format library** with `visual_structure`, `copy_structure`, `prompt_guidance`, `best_for`, `compatible_angles`, `rules.do/dont` — `docs/audits/REPLIT_REFERENCE_DEEP_DIVE.md` §2.x.
- **Brand DNA prompt-modifier** pattern: a 50–75 word paragraph prepended to every prompt to lock visual identity across a set.

Phase 2 turns these into a **structured, template-driven engine** that lets the operator pick a "Listing Template" per slot, auto-injects Brand DNA + ICP + Product context, and emits a fully composed prompt ready for the runtime (or the existing `swtd-asset://` preview path, if runtime wiring stays deferred).

**Why now:** Phase 1 shipped the per-slot review surface (approve / regen / prompt override / export). The next blocker on operator throughput is the prompt itself — operators currently rely on memory or copy-paste from external docs. A first-class template library closes that loop.

---

## 2. User Stories

### US1 (P1) — Pick a high-converting template per slot

**As an** operator preparing a listing
**I want** to choose a "Listing Template" from a curated library for each slot
**So that** I get a proven prompt formula tailored to the slot's role (Hero, Features, Comparison…) without writing one from scratch.

**Required:**
- A library of **6–10 starter templates** drawn from the Amazon Listing Image Prompt Pack, mapped to the 8 canonical slot roles (`main`, `in-use`, `features`, `use-case`, `size-scale`, `gift-set`, `emotional`, `lifestyle-close` — see `apps/desktop/src/lib/slot-progress.js` LISTING_SLOT_META).
- Each template declares which slot roles it supports (a template can target multiple roles, e.g. "Lifestyle vignette" supports both `in-use` and `lifestyle-close`).
- The library is **operator-readable** (JSON or YAML, not buried in code) so future templates can be added by editing a file rather than the bundle.
- The SlotCard (Phase 1) gains a compact **template picker** affordance — `Template: <name> ▾`.

**Acceptance:**
- Each of the 8 slots has at least one applicable template available.
- Selecting a template updates the slot's composed-prompt preview within 100 ms.
- A slot with no template selected falls back to the existing runtime default (no regression vs Phase 1).

### US2 (P2) — Inject Brand DNA, ICP, and Product context automatically

**As an** operator with a Brand DNA file + ICP cards + Brief
**I want** the template engine to fill in `{{BRAND_VOICE}}`, `{{ICP_PAIN}}`, `{{PRODUCT_NAME}}`, `{{BRAND_PRIMARY_COLOR}}`, etc.
**So that** I never copy-paste brand details into prompts manually.

**Required:**
- A **variable injection** system using `{{VARIABLE_NAME}}` placeholders.
- A documented context surface — every supported variable name, where it sources from, and what happens when it's missing (graceful degradation, not crash).
- The 50–75 word **Brand DNA prompt modifier** is automatically prepended to every composed prompt, unless the template explicitly opts out.
- A side-by-side preview: **template body** (with placeholders) vs **composed prompt** (with values substituted), so the operator sees exactly what the runtime will receive.

**Acceptance:**
- Operator opens a SKU with `brand-dna.md` + `icp-cards.md` present; every variable in the chosen template resolves; composed prompt has zero `{{…}}` markers left.
- Operator opens a SKU with only `brief.json` (no brand-dna); composed prompt still produces, with `[brand DNA not provided]` placeholders inline and a visible warning chip on the slot.
- The Brand DNA modifier paragraph appears as a single leading paragraph in the composed prompt.

### US3 (P3) — Choose a Creative Angle within a template

**As an** operator deciding between aesthetic directions
**I want** each template to expose **multiple Creative Angles** (e.g., "Clean white", "Luxury gold", "Vibrant lifestyle")
**So that** I can test angle variants without forking the whole template.

**Required:**
- A template's schema includes an `angles[]` array — each angle has `id`, `name`, `description`, `prompt_modifier`, and optional `aspect_ratio` override.
- The SlotCard picker is **two-level**: pick template → pick angle.
- Composition merges template body + chosen angle's modifier + Brand DNA modifier + variable substitution.
- Default angle is the first one in the array if the operator hasn't picked.

**Acceptance:**
- A template with 3 angles offers all 3 in the picker.
- Switching angle re-composes the prompt preview within 100 ms.
- The chosen `templateId + angleId` persists per-SKU per-slot in localStorage (same pattern as Phase 1 `slotReview`).

---

## 3. Success Criteria (Measurable, Tech-Agnostic)

| # | Criterion | How verified |
|---|---|---|
| SC1 | Operator can browse all templates that apply to a given slot in under 5 seconds | Stopwatch with 2 unfamiliar testers + the SlotCard picker |
| SC2 | A composed prompt produced from a complete brand + ICP + brief context has zero unresolved `{{…}}` placeholders | Composer unit smoke + spot-check on real SKU `data/TNTD030426i772` |
| SC3 | Composing a prompt completes in under 50 ms on a typical operator machine (no API call required) | Renderer timing log over 100 random template + angle pairs |
| SC4 | Switching template or angle never blocks the UI for more than one animation frame (~16 ms) | DevTools performance trace |
| SC5 | A SKU with no `brand-dna.md` still produces a composed prompt, with `[missing]` markers and a visible warning chip | Manual walkthrough |
| SC6 | Per-slot `templateId + angleId` survive SKU close / reopen | Persistence round-trip smoke (same shape as Phase 1 SC7) |
| SC7 | The runtime continues to produce output for slots where no template is selected (no regression) | Real run on `data/TNTD030426i772` with all slots untouched produces 8 slot files identical to pre-Phase-2 output |

---

## 4. Scope & Out-of-Scope

### In scope

- New folder `packages/core/templates/listing/` with versioned JSON templates (6–10 starters).
- New module `apps/desktop/src/lib/template-library.js` — load + validate + index by slot role.
- New module `apps/desktop/src/lib/prompt-composer.js` — variable substitution + Brand DNA prepend + angle merge.
- New module `apps/desktop/src/lib/brand-context.js` — read `brand-dna.md` (markdown) + `icp-cards.md` (markdown) from the SKU folder, parse into a stable JS object the composer consumes.
- Per-slot picker UI inside the existing Phase 1 `SlotCard.jsx`.
- Variable & context schema documented in `packages/core/templates/listing/_SCHEMA.md` (a sibling reference, not a code file).
- Persistence: per-SKU `templateSelections: { [slotId]: { templateId, angleId } }` added to the existing `slotReview` localStorage shape.

### Out of scope (explicit)

- **Runtime consumption** of composed prompts. The legacy `runtime/legacy/agents/master.js` + `image-generator.js` do not yet accept `--prompt-overrides <jsonPath>` (Phase 1 known limitation). Phase 2 **composes** the prompts and exposes them to the operator, but does NOT wire them into the actual image-generation call. The plan §6 proposes a runtime-touching follow-up phase — Boss must explicitly approve before that work begins.
- A+ pipeline templates. The 5 A+ modules (1464×600 banner imagery) have a different structure and would benefit from a dedicated template phase later.
- Network calls to LLMs for two-pass prompt composition (the meta-ads-generator's `composeNanoBananaPromptWithGemini` pattern). Phase 2 is deterministic, no LLM in the loop.
- Brand DNA / ICP / Voice authoring inside SWTD. Operators write `brand-dna.md` / `icp-cards.md` outside SWTD (or run the SCALE-AI skills from `data/TAI NGUYEN AI/`). SWTD only consumes those files.
- New design tokens. Reuse existing motion + color tokens. The picker UI is a styled `<select>` or `<button>`-driven popover — no new chrome.

---

## 5. Assumptions

| # | Assumption | Risk if wrong |
|---|---|---|
| A1 | Templates as plain JSON in `packages/core/templates/listing/` is acceptable (tracked in git) | Low — they ARE code-like and need versioning |
| A2 | **(LOCKED)** Brand DNA + ICP source files: `<workspace>/brand-dna.md` is the default for all SKUs; `<sku>/brand-dna.md` overrides if present. Same rule for `icp-cards.md`. | n/a — locked by Boss Q2 |
| A3 | A markdown-section parser (matching the SCALE-AI canonical structure: `BRAND OVERVIEW`, `VISUAL SYSTEM`, etc.) is enough; no full markdown AST library | Low — these files have rigid headings per `brand-dna-builder.skill` |
| A4 | Phase 1's `slotReview` localStorage shape can be extended with a `templateSelections` field without migration | Low — `loadSlotReview` already accepts missing fields with `?? {}` |
| A5 | The 6 prompts in the "Amazon Listing Image Prompt Pack" + 2 extra from the 16-format library cover all 8 slot roles | Medium — flagged for verification in plan §6 |
| A6 | The variable substitution syntax `{{NAME}}` is sufficient — no nested expressions, no conditionals | Low — keep it simple per Karpathy Rule 2 |

---

## 6. Dependencies

- **Phase 1** (`phase-1-ux-motion-slot-control`) must be merged or be the base — Phase 2 extends Phase 1's SlotCard with a template picker.
- **Phase 0 protocol** v1.1 (Skill Loading Rule) still binding.
- **Existing infrastructure**: `slotReview` state in `Shell.jsx`, `LISTING_SLOT_META` in `slot-progress.js`, slot role names.
- **TAI NGUYEN AI reference pack** at `data/TAI NGUYEN AI/` (already present in the repo — read-only data).
- **No new npm dependencies** — JSON parsing is native; markdown section parsing is simple regex on canonical headings.

---

## 7. Locked Decisions (Boss-approved 2026-05-15)

The three open questions were resolved by Boss before implementation began. Recorded here verbatim so future readers see the final shape, not the open-question phrasing.

**Q1 — Template storage location** → **`packages/core/templates/listing/*.json`** (the recommended option).
Rationale: tracked in git, versioned alongside the rest of the codebase, available to both renderer (via Vite glob import) and the future Phase 2.5 runtime bridge. Operator-edit ergonomics (editing without a rebuild) is explicitly deferred.

**Q2 — Brand DNA file location** → **Both: workspace-level default, SKU-level override.**
The composer reads `<workspace>/brand-dna.md` (and `<workspace>/icp-cards.md`) as the default brand context for every SKU in the workspace. If `<sku>/brand-dna.md` exists for a specific SKU, it **overrides** the workspace file entirely (no field-level merge — simpler mental model, fewer surprises). Same rule for `icp-cards.md`.

**Q3 — Runtime wiring** → **UI-only this phase. Runtime wiring deferred to Phase 2.5.**
Phase 2 composes prompts and surfaces them to the operator inside the renderer. The legacy `runtime/legacy/agents/master.js` + `image-generator.js` are **not touched**. A separate phase ("Phase 2.5 — Runtime Prompt Override Wiring") will add `--prompt-overrides <jsonPath>` to `runtime/bin/listing.mjs` and consumer logic to `master.js`; that phase will be Boss-approved separately. The operator-facing benefit of Phase 2 is the **library + composition workflow** — runtime consumption ships next.

These three decisions are now part of the binding spec. Subsequent edits to the same questions require a new explicit Boss brief.

---

## 8. Non-Goals & Anti-Patterns

- ❌ No template inheritance or recursive includes. Templates are flat. If two templates share a prelude, duplicate it.
- ❌ No live preview rendering of the image itself (that requires the runtime). Phase 2 only previews the composed *text*.
- ❌ No conditional logic inside templates (`{{#if BRAND_HAS_FOUNDER}}...{{/if}}`). Operator picks the right template instead.
- ❌ No multi-tenancy / per-user template libraries. SWTD is single-operator.
- ❌ No LLM-based prompt enhancement step. Composition is deterministic.
- ❌ No silent fallback when a variable is missing — surface a `[missing: VARIABLE_NAME]` marker in the composed text AND a warning chip on the slot so the operator knows.

---

## 9. Glossary

| Term | Definition |
|---|---|
| Template | A reusable prompt skeleton with `{{…}}` placeholders, declared in JSON, mapped to one or more slot roles |
| Angle | A creative direction within a template (e.g., "Clean white" vs "Luxury gold"); modifies the template body |
| Brand DNA Modifier | The 50–75 word paragraph from `brand-dna.md` that locks visual identity across an 8-slot set |
| Variable | A `{{NAME}}` placeholder resolved from brand + ICP + brief context |
| Composer | The pure function that takes (template, angle, context) → final prompt string |
| Context surface | The fixed set of `{{VARIABLE_NAME}}` keys the composer recognizes, documented in `_SCHEMA.md` |
| Slot role | One of `main / in-use / features / use-case / size-scale / gift-set / emotional / lifestyle-close` (from `LISTING_SLOT_META`) |
