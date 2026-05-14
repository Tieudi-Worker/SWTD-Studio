# Case Study: TNTD250326i769(1) — Reverse-Stencil Cutout Failure

## Summary
First-run pipeline for a reverse-stencil wooden card holder misread the product structure. Generated lifestyle scene rendered the COACH letters as solid engraved wood and showed the gift card entering from the top edge, destroying the USP (see-through cutout window where the inserted card's color fills the letter shapes).

## Assets In This Folder
Place the following reference assets here for future comparison:

- `ref-01_original-lifestyle.jpg` — User-provided context shot of two wooden "Thank You COACH" plaques on a kitchen table. Rendered by the first pipeline run. Shows the bug: COACH letters are solid wood, no see-through effect. Used as the "before" state in this case study.
- `ref-02_structure-annotated.jpg` — User-provided annotated crop of the same image with red circles highlighting the two plaques where the reverse-stencil effect should be visible but is not.
- `ref-03_hand-held-actual.jpg` — User-provided hand-held photo of the REAL physical product from a phone camera. Shows the actual mechanical structure: hollow COACH cutout letters on the front panel, horizontal side-loading slot, card sliding in from the side edge.

> These are the canonical reference images for the reverse-stencil failure mode. When reviewing any SKU with through-cut text over an inserted card, compare against these three assets to check whether the generated image correctly renders the see-through window effect.

## Structural Vocabulary Used
See [knowledge/photography/product-structure-analysis.md](../../../knowledge/photography/product-structure-analysis.md) for the full vocabulary. Key terms for this case:

- **Through-cut / stencil cutout** — COACH letters are holes all the way through the front panel.
- **Reverse-stencil / window cutout** — The cutout reveals whatever is behind it; the insert becomes the visual fill of the letter shapes.
- **Side-loading slot** — Horizontal opening on the left or right edge.
- **Window-visible insert** — The gift card is visible through the cutout, not hidden.

## Failure Mode
| What AI generated | What reference actually shows |
|---|---|
| COACH letters rendered as solid wood engraving | COACH letters are through-cut holes |
| Card slot on top edge (top-loading) | Card slot on side edge (side-loading, horizontal) |
| Card inserts vertically downward | Card slides in horizontally from the side |
| No see-through effect — USP invisible | Card color fills the COACH letter shapes through the cutouts |

## Root Cause
The brief said "letters are cut through so the gift card is visible through them" and "slot is HORIZONTAL" but these facts lived only in the brief-level `product_structure` field. The per-slot prompt templates did not carry the see-through relationship into the actual generation prompt, so the model defaulted to the statistical average for "wooden coach card holder" — engraved lettering and top-loading.

## Fix Applied
1. Added `see_through_cutout_rule` field at the brief root with explicit reverse-stencil language.
2. Rewrote `product_structure` using the standardized layer-stack vocabulary (base layer, cavity layer, front panel, decorative layer).
3. Added `critical_structure` field to `slot_concepts.slot3`, `slot4`, `slot8` carrying the structural reminder into every prompt that shows the product with an insert.
4. Created [knowledge/photography/product-structure-analysis.md](../../../knowledge/photography/product-structure-analysis.md) with full vocabulary, checklist, and failure patterns for future SKUs.
5. Added XP errors.md entry XP-003 + compiled rule RULE-014 (reverse-stencil / through-cut products).
6. Added mandatory structural analysis step to CLAUDE.md.

## Lesson for Future SKUs
Any product where the insert is visible through the front panel is a **reverse-stencil product** and must be analyzed using the vocabulary in the knowledge file before any prompt is written. The see-through relationship MUST appear in every slot prompt that shows the product with an insert, not just the brief root.
