# Compliance Rule-Pack Schema (v1)

> **Status:** Operator-readable reference. Source-of-truth for the JSON shape consumed by `packages/compliance-core/src/rule-loader.js`. Not a code file — kept here so future rule authors can edit a pack without grepping the loader.

A rule pack is a versioned JSON document under `packages/compliance-core/rules/<marketplace>/<name>-v<N>.json`. The first shipped pack is `rules/amazon/amazon-listing-v1.json` (Phase 5 P5.1).

## Top-level shape

```jsonc
{
  "id":               "amazon-listing-v1",     // unique pack id; immutable once published
  "version":          "1.0.0",                 // semver — bump on ANY rule change
  "publishedAt":      "2026-05-15",            // ISO date; informational
  "marketplaces":     ["amazon-us"],           // marketplace ids this pack targets
  "engineMinVersion": "0.1.0",                 // minimum compatible engine semver
  "rules": [ <Rule>, ... ]
}
```

Every field is required. `loadRulePack(...)` rejects packs missing any of them with `ComplianceError{ reason: 'pack-invalid' }`. Packs are deep-frozen on load.

## Rule shape

```jsonc
{
  "id":               "amazon.medical.cures-or-treats",   // unique within the pack; dot-namespaced
  "category":         "medical-health-claim",             // free-form string; groups rules in the UI
  "severity":         "block",                            // 'info' | 'warn' | 'block'
  "appliesTo": [                                          // which subject stages this rule scans
    "insight-brief",
    "creative-brief",
    "prompt",
    "image-generate",
    "image-metadata",
    "export"
  ],
  "predicate":        <Predicate>,                        // see below
  "messageKey":       "compliance.rule.<rule-id>.message",
  "suggestedFixKey":  "compliance.rule.<rule-id>.suggested_fix",  // optional
  "references": [
    "https://sellercentral.amazon.com/help/hub/reference/G201842690"
  ]
}
```

### `severity`

- `info` — surfaced but does NOT gate anything. Used for marketplace-specific informational entries.
- `warn` — surfaced; the operator should review. Does NOT gate generate / export.
- `block` — gates generate (Hook 4) and export (Hook 6) until overridden or fixed.

### `appliesTo`

The engine filters rules by `subject.stage` before running their predicates. The six valid stage strings:

| Stage | Subject kinds that carry it |
|---|---|
| `insight-brief` | `makeBriefSubject` |
| `creative-brief` | `makeCreativeBriefSubject` |
| `prompt` | `makePromptSubject` (Hook 3, renderer-fired) |
| `image-generate` | `makePromptSubject` with `stage:'image-generate'` (Hook 4, pre-HTTP guard) |
| `image-metadata` | `makeMetadataSubject` (Hook 5, sidecar) |
| `export` | `makeExportSubject` (Hook 6, pre-promote) |

### `references`

Baked-in Amazon-policy URLs. NEVER fetched at runtime — the engine treats them as immutable citations. Bumping a URL requires bumping the pack version.

## Predicate shape

Predicates are a small fixed-set DSL. `rule-loader.js` validates the `kind` field and rejects unknown kinds. No free-form JS — the pack is data, not code.

### `containsAnyTokens`

```jsonc
{
  "kind": "containsAnyTokens",
  "tokens": ["cures", "FDA approved", "doctor recommended"],
  "tokenMode": "case-insensitive-word-boundary",   // default
  "regex": false                                    // optional; when true, tokens are regex sources
}
```

Walks every string passage in the subject. Returns on the first hit.

`tokenMode`:
- `case-insensitive-word-boundary` *(default)* — wraps each token in `\b` on whichever side starts/ends with a word character. Handles multi-word phrases. Non-word chars (`#`, `$`) at token edges skip the boundary on that side.
- `literal` — case-insensitive substring search, no boundary semantics.

### `containsRegex`

```jsonc
{
  "kind": "containsRegex",
  "pattern": "\\$\\d+(?:\\.\\d{2})?\\s+(?:stamp|graphic|overlay|tag|sticker)",
  "flags": "i"
}
```

Compiled at load time; invalid patterns fail `loadRulePack`. Used sparingly — prefer `containsAnyTokens` so non-engineers can edit a rule.

### `mustShowIncludes`

```jsonc
{
  "kind": "mustShowIncludes",
  "tokens": ["Disney", "Marvel", "Nike"],
  "tokenMode": "case-insensitive-word-boundary"
}
```

Scans `creativeBrief.mustShow[]` (or aggregated mustShow across slots in an export-bundle subject). Used for the "Creative Brief baked a competitor brand into the prompt seed" rule.

### `tokenLooksLikeTrademark`

```jsonc
{
  "kind": "tokenLooksLikeTrademark",
  "seedBrands": ["Disney", "Apple", "Nike"]
}
```

Walks every string passage. The brand list is `seedBrands ∪ subject.market.competitors[]`. Used to catch competitor-brand mentions sourced from research without surfacing as a separate hardcoded list per rule.

### `compositeAnyOf` / `compositeAllOf`

```jsonc
{
  "kind": "compositeAllOf",
  "predicates": [
    { "kind": "containsAnyTokens", "tokens": ["before and after"] },
    { "kind": "containsAnyTokens", "tokens": ["weight loss", "medical"] }
  ]
}
```

`anyOf` fires when any child predicate matches. `allOf` fires only when every child matches. Used for the "before/after only blocks when paired with a medical-claim context" rule. Nesting is capped at depth 4 by the loader.

## Adding a new rule

1. Pick the next available `id` under the appropriate category (dot-namespaced).
2. Choose `severity` carefully — `block` gates real operator work.
3. List the stages where the rule meaningfully applies (most text rules apply across `insight-brief`, `creative-brief`, `prompt`, `image-metadata`, `export`).
4. Write a predicate. Prefer `containsAnyTokens` over `containsRegex`.
5. Add a fixture under `packages/compliance-core/test/fixtures/` that triggers the new rule.
6. Add EN + VI i18n entries (`messageKey` + `suggestedFixKey`) in `apps/desktop/src/lib/i18n.js`.
7. Bump the pack's `version` field (semver — every rule change is a new version).
8. Re-run `node packages/compliance-core/test/run-rules.mjs` — 0 failures required.

## What NOT to put in a rule

- Free-form JS or ad-hoc validators — the DSL stays narrow on purpose.
- URLs fetched at runtime — `references[]` is bundled metadata, never live data.
- Operator-specific allow-lists or per-SKU configuration — those live in `<sku>/compliance/` (overrides) or in a future operator-editable allow-list.
- LLM-driven matchers — v1 is deterministic. The v2 vision adapter (US8) is wired via `registerExtension(...)`, not via rule packs.
