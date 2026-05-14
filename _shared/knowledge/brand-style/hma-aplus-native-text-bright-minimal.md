---
title: HMA A+ Native Text Bright Minimal Lifestyle Style
date: 2026-05-04
sku: PARENT PREGNANCY
version: v06
status: approved
---

# HMA A+ Native Text Bright Minimal Lifestyle Style

## Overview
This style guideline documents the successful A+ content structure for the PARENT PREGNANCY SKU (multi-ASIN, Plan A) that uses:
- AI-generated native text directly in the image (no SVG overlay)
- Bright, airy, minimal lifestyle scenes
- A ivory/cream/light wood/burgundy color palette
- Emotional, joyful, and gift-ready tone
- Strict 2-font typography lock: BALOO 2 BOLD (rounded friendly sans-serif) for headlines/CTA, and KALAM/CAVEAT (handwritten calligraphy italic) for accent subheadlines.

## Key Decisions from QC and Iteration
1. **Native Text over Overlay**: After multiple iterations, we shifted from the legacy pipeline's "generate background + overlay text" to prompting the AI to render all marketing text natively inside the image. This avoids misalignment and ensures the text is part of the scene.
2. **Bright Minimal Lifestyle**: Scenes use abundant negative space, soft natural light, and minimal props (eucalyptus, linen, baby's breath, ultrasound cue) to keep focus on the product and the emotional message.
3. **Typography Lock**: To ensure consistency, we enforce two font families only across all 5 modules. This is enforced via the brief's `aplus_module_prompts` and the pipeline's `_cohesion` helper.
4. **Product Fidelity Guard**: All prompts include a strict product fidelity section that references the exact child SKU variants and forbids any changes to the product's shape, text, texture, or color.
5. **Avoid Design-Spec Leakage**: Prompts must not include raw font spec tokens (e.g., "BALOO 2 BOLD", "light warm grey") in the same clause as the text-to-render instruction, as these can leak into the final image as visible garbage text.

## Prompt Structure for Each Module
Each module's prompt in `brief.aplus_module_prompts` follows this pattern:
```
[Scene description: lighting, layout, props, lifestyle context]
[Composition: product arrangement, negative space zones for text]
NATIVE TEXT to render on the banner: [exact copy lines with formatting hints]
TYPOGRAPHY LOCK: [two-font rule]
PRODUCT FIDELITY: [variant-specific guardrails]
[Style ending: Photorealistic, 4K, etc.]
```

### Example (M1 Hero Banner):
```
Wide 21:9 A+ hero banner. STYLE: airy, bright, minimal lifestyle — clean ivory linen surface, warm morning window light, fresh green eucalyptus sprig, tiny folded ultrasound corner print, ivory muslin swaddle softly draped. COMPOSITION: three pregnancy announcement wooden keepsakes arranged in a gentle arc left-to-right on the linen — all fully visible, sharp, substantial. Generous negative space upper-left for a clean reading zone. NATIVE TEXT to render on the banner: top-left corner, large BALOO 2 BOLD white headline with soft drop shadow: "The First Hello, Made to Keep." below it in KALAM italic smaller script, cream-white: "Handmade wooden keepsakes for Daddy, Grandpa & baby reveal." Bottom edge of banner: thin translucent cream strip with BALOO 2 small caps burgundy: "FOR DADDY · FOR GRANDPA · UNIVERSAL BABY REVEAL". TYPOGRAPHY LOCK: 2 font families only — (1) BALOO 2 BOLD or similar rounded friendly bold sans-serif for all headlines, CTA text, stat labels; (2) KALAM or CAVEAT handwritten calligraphy italic for accent subheadlines and emotional flourishes. NO third font, NO Arial, NO serif classic. PRODUCT FIDELITY: Render all 3 wooden keepsakes EXACTLY as reference images — rigid flat rounded-square wooden panels, neutral warm light wood tone, NO bending, NO warping, NO paper texture, NO color cast. TNTD030426i772 shows: SOMEONE WANTS TO SAY HELLO · Hi DADDY I can't wait to meet you · red heart · ultrasound frame. TNTD030426i773 shows: We've been keeping a little secret · you're going to be a Grandpa · red heart · ultrasound frame. TNHG280725i536 shows: SOMEONE WANTS TO SAY hello · Precious Little One · COMING SOON · red heart · ultrasound frame. Do NOT add extra marketing words onto product faces. Photorealistic editorial photography, soft natural diffused light, shallow depth of field, warm whites, no harsh shadows, 4K.
```

## Known Pitfalls and Fixes
- **Font-note leakage**: Avoid sentences like "The text should be in BALOO 2 BOLD". Instead, weave the font intention into the style description (e.g., "large, friendly, bold headline").
- **Low-contrast text**: Ensure sufficient contrast between text and background (e.g., dark text on light ivory, or white text on deep burgundy).
- **Overly promotional copy**: Keep the tone emotional and benefit-driven, not hard-sell. Use phrases like "Made to Keep" and "A First Keepsake".
- **Empty zones causing ad-like feel**: In lifestyle split banners (like M2), ensure both sides have visual interest or product cues to avoid one side feeling like empty negative space.

## Validation Checklist (before marking a module complete)
1. Product is exactly as reference (no warping, no extra text, correct wood tone, red heart intact).
2. Text is readable, free of typos, and matches the brief copy.
3. No visible font-spec garbage (e.g., "BALOO", "BOLD", "light warm grey").
4. Scene is bright, minimal, and lifestyle-appropriate.
5. Composition uses negative space intentionally for text zones, but does not feel empty or wasted.
6. Overall emotion: warm, inviting, gift-ready, joyful.

## Version History
- v06 (2026-05-04): Bright minimal lifestyle, native text, two-font lock. Approved for PARENT PREGNANCY A+.
- v05: Reference-pattern based, still used overlay for some modules.
- v04: Early attempts with mixed overlay/native.

## Related Notes
- See `_shared/rules/prompt-anti-patterns.md` for RULE-XXX on native text leakage.
- See `_shared/doctrine/handmade-product-doctrine.md` for F1-F8 product fidelity.
- See `data/PARENT PREGNANCY/research/aplus_content_v01.md` for early copy explorations.
- See `data/PARENT PREGNANCY/output/aplus/versions/20260504_173239_pre_v06/` for the versioned outputs that led to this style.
