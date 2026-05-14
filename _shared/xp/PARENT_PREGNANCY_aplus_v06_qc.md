# XP QC — PARENT PREGNANCY A+ v06 native-text lifestyle bright minimal joyful

Date: 2026-05-04 UTC
SKU Scope: Parent A+ multi-ASIN (`PARENT PREGNANCY`)
Version Anchor: `data/PARENT PREGNANCY/output/aplus/versions/20260504_173239_pre_v06/` + current final outputs after M5 rerun
Decision: Adopt new structure with native AI-rendered text in-image, brighter/lifestyle/minimal direction

## Final QC Summary

### A+ Modules
- M1 — 8/10 — PASS
- M2 — 7/10 — PASS with condition
- M3 — 6/10 — FAIL in previous pass because font-note leakage was visible; under new direction must explicitly ban design-spec meta text in prompt
- M4 — 5/10 — FAIL in previous pass because font-note leakage / weak contrast; under new direction must explicitly ask for real consumer-facing copy only
- M5 — 8/10 — PASS after single-module rerun

### Listing (child SKU reference used for structure learnings)
Child audited: `TNTD030426i772`
- slot1_main — 9/10
- slot2_in-use — 5/10
- slot3_features — 9/10
- slot4_use-case — 8/10
- slot5_grid — 8/10
- slot6_gift-set — 8/10
- slot7_emotional — 9/10
- slot8_lifestyle-close — 8/10
Overall listing set: 8/10

## What worked
1. Native text in prompt can produce commercially usable A+ typography when copy zones are simple and high-contrast.
2. Bright ivory / cream / wood / burgundy palette reads premium, feminine, joyful, and appropriate for pregnancy keepsake gifting.
3. Lifestyle direction improved warmth and emotional value versus old comparison-heavy layouts.
4. Single-module rerun discipline worked: only M5 required extra paid generation.

## What failed
1. Prompt meta-language can leak into final image text.
   - Examples: `BALOO 2 BOLD`, `BALOO 2 light warm grey`
   - Root cause: prompts described the design spec too literally in the same sentence block as user-facing copy.
2. “Native text” does not mean fully reliable typography.
   - Small text and font-specific instructions may degrade into odd overlay-like rendering or unintended copy.
3. Split comparison scenes with large empty left zones feel too ad-like if product utility is not reinforced.
4. Listing slot 2 lifestyle can look pretty but underperform if product is not clearly visible.

## Rule candidates / structure decisions
### STRUCTURE DECISION — A+ native text mode
Adopt this for parent A+ when the emotional/lifestyle angle is stronger than strict infographic clarity:
- Put only consumer-facing copy lines in prompt.
- Keep font guidance abstracted as style, not explicit font family callouts in the same clause as rendered text.
- Use short copy blocks: 1 headline + 1 subline + 1 support strip max.
- Avoid embedding technical spec words such as `font`, `bold`, `caps`, `shadow`, `label block`, `warm grey` near the text-to-render instruction.

### RULE candidate 1
When prompting AI to render text natively in-image, NEVER include raw design-spec tokens that can become literal visible text (`BALOO 2`, `BOLD`, `light warm grey`, `caps`, `font 1`, `font 2`). Convert them into visual adjectives only.

### RULE candidate 2
For native-text A+ banners, each text zone should contain at most:
- 1 headline under 7 words
- 1 emotional support line under 12 words
- 1 footer strip under 6 words per chunk
Else AI typography reliability drops sharply.

### RULE candidate 3
For lifestyle split banners, if one side is concept/setup and not product, add at least one secondary product cue or prop bridge so the side does not feel empty or non-converting.

## Chốt cấu trúc mới
Approved direction to keep iterating from:
- A+ = bright, airy, minimal, tasteful, joyful lifestyle
- Native text generated inside image, not SVG overlay
- Product fidelity remains locked by reference guard
- Copy should feel emotionally premium, not heavily promotional
- Prefer warm ivory negative space, wood surface, soft linen, eucalyptus, ultrasound cue, baby booties, baby's breath

## Blockers / follow-up
1. Need one clean rerun cycle if M3/M4 current finals still leak design-spec text.
2. Need explicit parent-vs-child listing mapping before claiming “8 listing + 5 A+” for the parent SKU family as a whole.
