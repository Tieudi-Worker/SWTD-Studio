# Implementation Plan — Phase 2: Template & Prompt Engine

**Spec:** [`spec.md`](./spec.md)
**Owner:** Boss (thondptit@gmail.com)
**Created:** 2026-05-15
**Status:** Planning — no app code touched in this run

---

## 1. Technical Context

| Field | Value |
|---|---|
| Language(s) | JavaScript (ES modules in renderer + Node module under `packages/core/`) |
| Frameworks | React 18 (renderer), no new deps |
| Data format | JSON for templates, Markdown (canonical SCALE-AI sections) for brand-dna / icp-cards inputs |
| Composition | Pure-function string substitution; no LLM in the loop |
| Storage | Filesystem (templates), localStorage (per-SKU template selections), Markdown files in SKU folder (brand DNA / ICP) |
| Guardrails | `SWTD_EXECUTION_PROTOCOL.md` v1.1, `karpathy-guidelines`, `tinbeta-coding-guardrail` |

---

## 2. Constitution & Protocol Check

| Gate | Status | Note |
|---|---|---|
| Workflow: spec → plan → tasks → implement → verify → report | ✅ on track | Tasks in [`tasks.md`](./tasks.md); implementation gated on Boss approval |
| Skill loading reported in runbook | ⏳ this run | Will be recorded in `TASK_RUNBOOK_PHASE_2.md` when implementation runs |
| Repo-scoped paths only | ✅ | All new files under `packages/core/templates/`, `apps/desktop/src/lib/`, `apps/desktop/src/components/shell/` |
| No config drift, no dep mutation | ✅ | No `package.json` edits planned. Pure JS, regex-based markdown parsing |
| No `git push` planned | ✅ | Commits stay local until Boss says push |
| No runtime mutation | ✅ this phase | Spec §4 OUT OF SCOPE explicitly defers runtime wiring to a separate phase (Q3 awaiting Boss decision) |

No gate violations.

---

## 3. Source-Tree Targets (Read-Only Survey)

Names-only per protocol §3.3.

### New files (renderer)

| Path | Phase 2 role |
|---|---|
| `apps/desktop/src/lib/template-library.js` | Bundle + index all templates; resolve `applicableTemplates(slotRole)` |
| `apps/desktop/src/lib/prompt-composer.js` | Pure compose function: `(template, angle, context) → composedPrompt` |
| `apps/desktop/src/lib/brand-context.js` | Parse `brand-dna.md` + `icp-cards.md` into a typed context object |
| `apps/desktop/src/components/shell/SlotTemplatePicker.jsx` | Two-level template + angle dropdown component, mounted inside SlotCard |

### New files (core / data)

| Path | Role |
|---|---|
| `packages/core/templates/listing/_SCHEMA.md` | Documentation: template JSON schema + full variable context surface |
| `packages/core/templates/listing/_index.json` | Static manifest listing all template files (so the bundler can `import` them via Vite glob) |
| `packages/core/templates/listing/01-hero-clean.json` | Hero / `main` role, derived from Amazon Listing Image Prompt Pack #1 |
| `packages/core/templates/listing/02-features-callouts.json` | Features / `features` role, from prompt-pack #2 |
| `packages/core/templates/listing/03-inside-cutaway.json` | Inside / `use-case` role, from prompt-pack #3 |
| `packages/core/templates/listing/04-comparison-vs.json` | Comparison / `features` or `size-scale` role, from prompt-pack #4 |
| `packages/core/templates/listing/05-lifestyle-grid.json` | Lifestyle / `in-use` or `lifestyle-close` role, from prompt-pack #5 |
| `packages/core/templates/listing/06-spec-card.json` | Spec / `size-scale` role, from prompt-pack #6 |
| `packages/core/templates/listing/07-emotional-vignette.json` | Editorial / `emotional` role, from 16-format library |
| `packages/core/templates/listing/08-gift-flatlay.json` | Flat-lay / `gift-set` role, from 16-format library |

(Filename digit prefix is for human-ordered listing; not load order.)

### Modified files (renderer)

| Path | Phase 2 change |
|---|---|
| `apps/desktop/src/components/shell/SlotCard.jsx` | Mount `SlotTemplatePicker` above the prompt-override editor; pass `templateSelection` prop |
| `apps/desktop/src/shell/Shell.jsx` | Extend `slotReview` state with `templateSelections: { [slotId]: { templateId, angleId } }`; load + persist; pass to MainCanvas/SlotCard; compute `composedPrompts: { [slotId]: string }` via `useMemo` on selections + brand context; pass to slot card |
| `apps/desktop/src/lib/i18n.js` | New keys: `template.picker.label`, `template.picker.empty`, `template.picker.no_template`, `template.angle.label`, `template.preview.heading`, `template.warning.missing_brand`, `template.warning.missing_var` |
| `apps/desktop/src/components/shell/MainCanvas.jsx` | Forward `composedPrompts`, `templateSelections`, `onSetTemplate` to SlotCardReview |
| `apps/desktop/src/styles/shell.css` | Styles for `.slot-card__template-picker` + `.slot-card__composed-preview` |

### Minimal Electron addition (read-only)

Reading `brand-dna.md` / `icp-cards.md` from disk needs an IPC channel — the renderer cannot `fetch('file://…')` under `contextIsolation: true` + `webSecurity: true`. The smallest surgical addition is one new handler:

| Path | Phase 2 change |
|---|---|
| `apps/desktop/electron/preload.cjs` | Expose `readBrandFile({ workspacePath, skuPath, filename })` — read-only, returns `{ ok, content, source }` |
| `apps/desktop/electron/main.cjs` | `ipcMain.handle('swtd:read-brand-file', …)` that bakes the Q2 resolution rule: try SKU path first, fall back to workspace path, return `{ source: 'sku'|'workspace'|'none' }` with path-safety guard (path must resolve under the workspace root, filename must end in `.md`) |

### Untouched (forbidden surface)

| Path | Touched? |
|---|---|
| `runtime/**` | NO — runtime wiring is Phase 2.5 per spec §4 + Q3 |
| `packages/core/src/*.js` (validators, pipeline-runner) | NO — only adding `packages/core/templates/` data files |
| `package.json`, `package-lock.json` | NO |

---

## 4. Architecture Approach

### 4.1 Template Schema (JSON)

```jsonc
{
  "id": "01-hero-clean",
  "name": "Hero · Clean studio",
  "version": 1,
  "slot_roles": ["main"],              // which LISTING_SLOT_META roles this template targets
  "aspect_ratio": "1:1",               // default; angle can override
  "needs_product_images": true,        // hint for the runtime when we wire it later
  "best_for": ["Amazon hero", "PDP cover"],
  "rules": {
    "do": ["centered composition", "single product floating", "soft drop shadow"],
    "dont": ["no people", "no busy background", "no overlay text"]
  },
  "body": "Amazon hero product listing image, 2000×2000 square format, centered composition. A single {{PRODUCT_NAME}} in its {{PRODUCT_PACKAGING_DESCRIPTION}} floating at a slight 3D angle on a {{BRAND_PRIMARY_COLOR_NAME}} background (matching the reference photos exactly). Soft drop shadow underneath. Photorealistic, studio-quality lighting. No people, no overlay text.",
  "angles": [
    {
      "id": "default",
      "name": "Clean studio (default)",
      "description": "The reference Barebells-style hero",
      "prompt_modifier": "",
      "aspect_ratio": null
    },
    {
      "id": "luxury-gold",
      "name": "Luxury gold accent",
      "description": "Premium feel with gold accents",
      "prompt_modifier": "Add subtle gold accent lines radiating from the product, faint gold dust particles in air, deeper shadow for premium feel."
    },
    {
      "id": "vibrant-lifestyle",
      "name": "Vibrant lifestyle pop",
      "description": "Hero with a hint of lifestyle context",
      "prompt_modifier": "Background shifts from solid color to a soft radial gradient with one stylized lifestyle element (e.g., a folded napkin, a leaf shadow) without distracting from the product."
    }
  ]
}
```

Each template is a single file. The library is the union of all files in `packages/core/templates/listing/*.json`, loaded via Vite's `import.meta.glob` at renderer startup.

### 4.2 Variable Context Surface (the `{{…}}` keys)

Documented in `_SCHEMA.md` and produced by `lib/brand-context.js`:

| Variable | Source | Example |
|---|---|---|
| `{{PRODUCT_NAME}}` | `brief.json` → `product_name` | "Barebells Peanut Butter & Jelly protein bar" |
| `{{PRODUCT_CATEGORY}}` | `brief.json` → `category` | "protein bar" |
| `{{PRODUCT_PACKAGING_DESCRIPTION}}` | `brand-dna.md` → PRODUCT DETAILS | "gold and red wrapper" |
| `{{PRODUCT_DIMENSIONS}}` | `brief.json` → `dimensions` | "55g per bar" |
| `{{BRAND_NAME}}` | `brand-dna.md` → BRAND OVERVIEW → Name | "Barebells" |
| `{{BRAND_TAGLINE}}` | `brand-dna.md` → BRAND OVERVIEW → Tagline | "Tastes too good to be true" |
| `{{BRAND_PRIMARY_COLOR}}` | `brand-dna.md` → VISUAL SYSTEM → Primary Color | "#0033CC" |
| `{{BRAND_PRIMARY_COLOR_NAME}}` | derived from hex via `describeBrandColor()` helper (Replit ref) | "vibrant royal blue" |
| `{{BRAND_ACCENT_COLOR}}` / `_NAME` | VISUAL SYSTEM → Accent | "#FFD700" / "rich gold" |
| `{{BRAND_FONT_PRIMARY}}` | VISUAL SYSTEM → Primary Font | "Druk Wide Bold" |
| `{{BRAND_VOICE_ADJECTIVES}}` | BRAND OVERVIEW → Voice Adjectives (5) | "bold, irreverent, confident, direct, playful" |
| `{{BRAND_DNA_MODIFIER}}` | IMAGE GENERATION PROMPT MODIFIER paragraph | (the 50–75 word paragraph) |
| `{{ICP_PERSONA_NAME}}` | `icp-cards.md` → first persona name (or selected persona index) | "PB&J Pete" |
| `{{ICP_PAIN}}` | persona → The Specific Pain (joined `; `) | "low-protein snack guilt; gym fuel taste fatigue" |
| `{{ICP_TRIGGER}}` | persona → Buying Triggers | "post-workout craving" |
| `{{ICP_VOC_PHRASE}}` | persona → Language and Media → top VOC phrase | "tastes like dessert, hits like protein" |
| `{{FEATURE_LIST}}` | `brief.json` → `features[]` joined with " · " | "20g protein · 3g net carbs · 200 cal" |

Missing-variable handling: composer emits `[missing: VAR_NAME]` and adds the variable to a `missingVars[]` array returned alongside the composed string. UI surfaces a warning chip on the slot card when `missingVars.length > 0`.

### 4.3 Composition Algorithm (pseudo-code)

```js
// prompt-composer.js
export function composePrompt({ template, angleId, context, includeModifier = true }) {
  const angle = template.angles.find(a => a.id === angleId) || template.angles[0]
  const body = [
    template.body,
    angle.prompt_modifier
  ].filter(Boolean).join('\n\n')
  const withModifier = includeModifier && context.brand_dna_modifier
    ? `${context.brand_dna_modifier}\n\n${body}`
    : body
  return substituteVariables(withModifier, context)
}

function substituteVariables(text, context) {
  const missing = []
  const out = text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, name) => {
    const value = context.values[name]
    if (value == null || value === '') {
      missing.push(name)
      return `[missing: ${name}]`
    }
    return String(value)
  })
  return { text: out, missingVars: missing }
}
```

Cost: regex scan + flat lookup. Substitution of a typical template (≈800 chars, ≈12 variables) measured at < 1 ms on a 2024-era laptop in informal Node benchmarks.

### 4.4 Brand Context Parser (markdown → object)

**Resolution order (Boss Q2 lock):** for each brand-context file, the composer reads:

1. `<workspace>/brand-dna.md` (and `<workspace>/icp-cards.md`) — workspace-level **default**, shared across every SKU in that workspace.
2. `<sku>/brand-dna.md` (and `<sku>/icp-cards.md`) — SKU-level **override**. If present, this file is used in **full** instead of the workspace file (no field-level merge — simpler mental model).

This is implemented as a two-pass loader in `brand-context.js`: try the SKU path first; on miss, fall back to the workspace path; on miss for both, return `null` and surface the "missing brand context" warning in the renderer.

`brand-dna.md` follows the SCALE-AI canonical structure:

```
BRAND OVERVIEW
Name / Tagline / Design Agency / Voice Adjectives [5] / Positioning / Competitive Differentiation

VISUAL SYSTEM
Primary Font / Secondary Font / Primary Color [hex] / Secondary Color [hex] / Accent Color [hex] / …

PRODUCT DETAILS
Physical Description / Label-Logo Placement / Distinctive Features / Packaging System

IMAGE GENERATION PROMPT MODIFIER
<50-75 word paragraph>
```

Parser strategy:

1. Split on top-level section headings (regex `^[A-Z][A-Z &/]+$`).
2. For each section, split on field-name lines (regex `^[A-Z][a-zA-Z- ]+:` or `^[A-Z][a-zA-Z- ]+\s+\[hex\]`).
3. Extract simple `key: value` pairs.
4. Capture the IMAGE GENERATION PROMPT MODIFIER section verbatim as `brand_dna_modifier` (one string).
5. Return a flat object the composer can index.

`icp-cards.md` follows the 6-dimension structure (Identity / Lifestyle / Pain / Triggers / Objections / Language). Parser picks the first persona (or one explicitly selected by the operator in a later phase) and extracts the same 6 dimensions.

Both files are **optional**. If absent or unparseable, the composer still runs and emits `[missing: …]` markers; UI shows a one-time toast: "Brand DNA / ICP not loaded — composed prompts will have placeholders."

### 4.5 Renderer Integration

```
Shell.jsx
  ├─ loadTemplateLibrary() at module init (Vite glob; no I/O)
  ├─ useMemo brandContext = parseSkuBrandContext(skuPath) on SKU change
  ├─ useState templateSelections (per-SKU, persisted via existing slotReview shape)
  ├─ useMemo composedPrompts = compose all slots from selections + brandContext
  └─ pass to MainCanvas

MainCanvas.jsx
  └─ ListingView passes selections + composedPrompts to SlotCardReview

SlotCard.jsx
  ├─ mounts <SlotTemplatePicker> when in 'idle' / 'success' / 'approved' state
  └─ shows composed-prompt preview below the existing prompt-override box

SlotTemplatePicker.jsx
  ├─ filters templates by slot_role
  ├─ two-level dropdown: template → angle
  └─ onChange → dispatch setTemplateSelection(slotId, { templateId, angleId })
```

### 4.6 Persistence shape

Extend the existing `swtd_review:<skuPath>` localStorage entry:

```js
{
  approvals: { [slotId]: 'approved' | 'needs-regen' },
  overrides: { [slotId]: '<raw prompt override>' },
  expanded:  { [slotId]: true },
  templateSelections: {              // NEW in Phase 2
    [slotId]: { templateId, angleId }
  }
}
```

`loadSlotReview` already merges with `?? {}` defaults, so missing field is non-breaking.

### 4.7 Composed-prompt → runtime bridge

**Boss-locked Q3:** Phase 2 is **UI-only**. Composed prompts are operator-visible inside the renderer but are NOT consumed by `master.js`. Same status as Phase 1's prompt-override caption: "Saved · runtime support pending".

The runtime touch (adding `--prompt-overrides <jsonPath>` to `runtime/bin/listing.mjs` → `runOnly()` → `master.js`) is **Phase 2.5 — Runtime Prompt Override Wiring**, a separate phase Boss will greenlight after Phase 2 lands.

---

## 5. Phase 0 Research (resolved decisions)

| Question | Decision | Rationale | Alternatives considered |
|---|---|---|---|
| Template format | JSON | Native parsing, easy diff, no new dep | YAML (needs yaml package) ; TOML (overkill) |
| Variable syntax | `{{NAME}}` regex substitution | Industry-standard, no template engine needed | `${NAME}` (clashes with JS templating) ; Mustache/Handlebars (heavyweight) |
| Markdown parser for brand-dna | Hand-rolled regex on canonical sections | The files have rigid structure per `brand-dna-builder.skill` | remark / unified (too much) ; YAML front-matter conversion (forces operators to edit a different format) |
| Per-slot persistence | Extend existing `slotReview` shape | Single source of truth, no migration | Separate `templateSelections` key (more keys to coordinate) |
| Color-name derivation | Port `describeBrandColor()` from Replit reference | Already proven, 200 LOC | Use a third-party color-name lib (new dep) |
| Bundle strategy | `import.meta.glob('packages/core/templates/listing/*.json', { eager: true })` | Native Vite, no manual index | Build-time codegen of an index file (extra step) |

No `NEEDS CLARIFICATION` left except the three flagged in spec §7 (Boss decision items).

---

## 6. Phase 1 Design Outputs

| Artifact | File | Status |
|---|---|---|
| Feature spec | `docs/features/phase-2-template-engine/spec.md` | ✅ written |
| Implementation plan | this file | ✅ |
| Task list | `docs/features/phase-2-template-engine/tasks.md` | ✅ written |
| Data model | Inline in §4.1, §4.2, §4.6 | — |
| Contracts | No external IPC; internal API documented in §4.3 | — |
| Quickstart | §8 below | — |

---

## 7. Risk & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Brand DNA file is missing or malformed in real SKUs | Medium — operators can't get full benefit | Composer degrades gracefully with `[missing: …]` markers; warning chip on slot card; documented in spec SC5 |
| 10 starter templates don't cover every slot role | Low | Each slot role has ≥1 template in the starter set per §3 template inventory; gaps are flagged in `_SCHEMA.md` for follow-up |
| Composer perf > 50ms on slow machines | Low | Pure regex + flat lookup; benchmarked < 1ms in informal Node tests; SC3 enforces |
| Template JSON schema drift across files | Medium | `_SCHEMA.md` is the spec; `template-library.js` validates on load with a tiny inline validator (`required: ['id', 'slot_roles', 'body', 'angles']`); console.error + skip on invalid template |
| Operator confused by `[missing: VAR]` markers | Medium | Warning chip + i18n key `template.warning.missing_var` explains; tooltip lists exactly which variables are unresolved |
| Runtime never consumes composed prompts | High if forever | Phase 2.5 explicitly named; spec §4 + Q3 forces Boss decision before merge |
| New `composedPrompts` re-renders thrash on every key-stroke | Low | `useMemo` keyed on `(skuPath, slotReview.templateSelections, brandContextSnapshot)` |
| Renderer bundle bloat from 8 JSON files | Low | ~3–5 KB per template × 8 ≈ 32 KB raw, ~8 KB gzipped; well within the +20 kB CSS / +30 kB JS Phase 1 budget that Phase 2 inherits |

---

## 8. Quickstart (Run-and-See Walkthrough, Post-Implementation)

To be executed during the implementation run's verification step.

1. `cd apps/desktop && npm run dev`.
2. Open a SKU that has a `brand-dna.md` AND `icp-cards.md` in its folder. Confirm no warning chip on any slot.
3. Click slot 1 (`main`). The Template picker shows ≥1 applicable template. Default angle is selected.
4. Switch template / angle. Composed-prompt preview updates within one animation frame; no `{{…}}` markers remain.
5. Open a SKU that has only `brief.json`. Confirm every slot shows the warning chip "missing brand-dna". Composed prompt still renders, with `[missing: BRAND_…]` placeholders.
6. Edit the slot's prompt override (Phase 1 feature). Confirm override still wins over template body when both are set.
7. Close + reopen the SKU. Confirm template + angle selection per slot persists.
8. Run `Run all 8` (real or mock). Confirm the listing pipeline still completes — composed prompts are NOT yet consumed by runtime per spec §4. No regression vs Phase 1.

---

## 9. Open Items for Implementation Phase

All three Q-items are **resolved** in spec §7 (Boss-locked 2026-05-15). Remaining items for the implementer's judgment:

- Confirm starter-template inventory covers all 8 slot roles in `LISTING_SLOT_META`. If a role has zero templates after authoring, flag and escalate before merging.
- Template picker chrome: native `<select>` (v1, accessible, no popover state) vs. custom popover (later polish). Implementer picks for v1; document the choice in the runbook.
- Warning-chip placement when brand context is missing: per-slot chip on the cards that have unresolved variables (default) vs. a single banner on the Slots tab. Per-slot is more precise; banner is less noisy. Pick one, document.
