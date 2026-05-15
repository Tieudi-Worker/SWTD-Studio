# Listing Template Schema

Source-of-truth reference for every JSON template under `packages/core/templates/listing/`. Files that don't conform are silently dropped by `template-library.js` with a `console.error` so the operator console doesn't blank-screen on a malformed addition.

## File location & loading

- One JSON file per template, kebab-case name.
- The filename digit prefix (`01-…`, `02-…`) is for human ordering; not used by the loader.
- Loaded via Vite's `import.meta.glob('packages/core/templates/listing/*.json', { eager: true })` at renderer startup.

## Required top-level fields

```json
{
  "id":          "01-hero-clean",
  "name":        "Hero · Clean studio",
  "version":     1,
  "slot_roles":  ["main"],
  "body":        "<prompt body with {{VARS}}>",
  "angles":      [ /* at least 1 */ ]
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique. Stored verbatim in localStorage when an operator selects this template. |
| `name` | string | Human-readable label shown in the picker. |
| `version` | integer | Bumped when the body/angles change meaningfully. Used for migration in a future phase. |
| `slot_roles` | string[] | Which roles from `LISTING_SLOT_META` the template applies to. See list below. |
| `body` | string | The prompt skeleton with `{{…}}` placeholders. |
| `angles` | object[] | At least one angle. See angle schema. |

## Optional top-level fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `aspect_ratio` | `"1:1" \| "4:5" \| "9:16"` | `"1:1"` | Used by the future runtime bridge to map to FAL `image_size`. |
| `needs_product_images` | boolean | `true` | Hint for the future runtime: if true, the template assumes the model sees the real product (`/edit` endpoint with `image_urls`); if false, pure text-to-image. |
| `include_brand_modifier` | boolean | `true` | Set to `false` for templates that already embed brand-DNA-level direction inline. |
| `best_for` | string[] | `[]` | Optional descriptive tags shown in the picker. |
| `rules.do` | string[] | `[]` | Optional. Surfaced as a tooltip. |
| `rules.dont` | string[] | `[]` | Optional. Surfaced as a tooltip. |

## Angle schema

Each entry in `angles[]`:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique within the template. Stored verbatim in localStorage. |
| `name` | string | Human-readable label. |
| `description` | string | One-line tooltip. |
| `prompt_modifier` | string | Appended to the template body (separated by blank line). Empty string allowed. |
| `aspect_ratio` | string \| null | Overrides the template's default `aspect_ratio` when set. |

The first angle in the array is the default for new selections.

## Variable surface (the `{{…}}` keys)

Every `{{NAME}}` resolves to a value from the brand context produced by `lib/brand-context.js`. Unknown / unresolved variables are replaced with `[missing: VAR_NAME]` and reported in `missingVars[]` so the UI can surface a warning chip.

### Product-level (from `brief.json`)

| Variable | Source field |
|---|---|
| `{{PRODUCT_NAME}}` | `brief.product_name` |
| `{{PRODUCT_CATEGORY}}` | `brief.category` |
| `{{PRODUCT_DIMENSIONS}}` | `brief.dimensions` |
| `{{PRODUCT_OCCASION}}` | `brief.occasion` |
| `{{FEATURE_LIST}}` | `brief.features` joined with " · " |

### Brand-level (from `brand-dna.md` — SCALE-AI canonical sections)

| Variable | Source heading |
|---|---|
| `{{BRAND_NAME}}` | BRAND OVERVIEW → Name |
| `{{BRAND_TAGLINE}}` | BRAND OVERVIEW → Tagline |
| `{{BRAND_POSITIONING}}` | BRAND OVERVIEW → Positioning |
| `{{BRAND_VOICE_ADJECTIVES}}` | BRAND OVERVIEW → Voice Adjectives |
| `{{BRAND_PRIMARY_COLOR}}` | VISUAL SYSTEM → Primary Color |
| `{{BRAND_PRIMARY_COLOR_NAME}}` | derived from hex (e.g., "#0033CC" → "vibrant royal blue") |
| `{{BRAND_SECONDARY_COLOR}}` | VISUAL SYSTEM → Secondary Color |
| `{{BRAND_ACCENT_COLOR}}` | VISUAL SYSTEM → Accent Color |
| `{{BRAND_FONT_PRIMARY}}` | VISUAL SYSTEM → Primary Font |
| `{{BRAND_FONT_SECONDARY}}` | VISUAL SYSTEM → Secondary Font |
| `{{BRAND_DNA_MODIFIER}}` | the `IMAGE GENERATION PROMPT MODIFIER` paragraph verbatim |

The Brand DNA modifier is automatically prepended to the composed prompt unless `include_brand_modifier: false` is set on the template.

### ICP-level (from `icp-cards.md`)

| Variable | Source |
|---|---|
| `{{ICP_PERSONA_NAME}}` | First persona heading |
| `{{ICP_PAIN}}` | Persona → The Specific Pain (joined `; `) |
| `{{ICP_TRIGGER}}` | Persona → Buying Triggers (joined `; `) |
| `{{ICP_OBJECTION}}` | Persona → Objections and Hesitations (joined `; `) |
| `{{ICP_VOC_PHRASE}}` | Persona → Language and Media → top phrase |

## Resolution order (Boss Q2 — locked)

1. `<sku>/brand-dna.md` (and `<sku>/icp-cards.md`) — SKU-level override.
2. `<workspace>/brand-dna.md` (and `<workspace>/icp-cards.md`) — workspace-level default.
3. Neither present → variables that depend on brand context resolve to `[missing: …]`.

`brief.json` is read from the SKU directly (existing IPC), no fallback chain.

## Slot roles (from `LISTING_SLOT_META`)

```
1  main             — Hero · white background
2  in-use           — In-use lifestyle
3  features         — Features infographic
4  use-case         — Use case
5  size-scale       — Size · grid
6  gift-set         — Gift / flat-lay
7  emotional        — Emotional moment
8  lifestyle-close  — Lifestyle closeup
```

A template's `slot_roles[]` lists every role it applies to. A role can appear in many templates; an operator picks one per slot.

## Validation rules (enforced by `template-library.js`)

A template is dropped (with `console.error`) if any of these fail:

- `id`, `name`, `version`, `slot_roles`, `body`, `angles` present and non-empty.
- Every entry in `slot_roles[]` is one of the 8 canonical role names.
- `angles[]` has at least one entry with a non-empty `id` + `name`.
- No duplicate `id` across the library (deduplication: last-wins, console.warn).

## Authoring a new template

1. Copy any `0N-…json` as a starter.
2. Bump the digit prefix; pick a unique `id`.
3. Replace `body` and `angles[].prompt_modifier`.
4. Set `slot_roles` to the role(s) the template targets.
5. Verify on `data/TNTD030426i772` that variables resolve.

No code changes are required to add a template — the Vite glob picks it up automatically on next renderer reload.
