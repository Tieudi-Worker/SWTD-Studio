# XP: Errors

## Metadata
- Total entries: 8
- Last updated: 2026-04-13
- Top rule: For use-case shots with hand + insertion action, t

---

## Entry LOG

### XP-007 | 2026-04-13 | Score: 9/10 | SKU: TNHG231025i621
**Context:** slot8 product mutation + wrong seasonal theme
**What happened:** AI added invented base/stand (product has none) AND used Christmas tree/pine/holly for a graduation product (May-June seasonal). Three Doctrine Tier 1 violations.
**Lesson:** Ornament lifestyle slots: (1) NO base/stand invention — hanging only, (2) match seasonal theme to product occasion NOT ornament category default, (3) ensure wood bead visible as product element

### XP-006 | 2026-04-13 | Score: 9/10 | SKU: TNHG231025i621
**Context:** slot4 scale drift on small ornament
**What happened:** AI enlarged ornament frame 130-140% when hand-held — failed Doctrine verification #4 Scale Correctness twice before fix
**Lesson:** Small ornament products (3-5 inches) suffer scale drift when hand-held. Must state exact dimensions AND 'fits in one palm between thumb and fingers' in prompt.


### XP-005 | 2026-04-13 | Score: 9/10 | SKU: TNHG231025i621
**Context:** slot2 ornament display mode
**What happened:** Default slot2 prompt 'inserted in a potted plant' generated frame cắm chậu cây — completely wrong for ornament products that hang by twine
**Lesson:** Ornament products MUST override slot2 scene in brief with hanging display (twine on shelf/wall). Default prompt assumes plant-pick products.

### XP-004 | 2026-04-11 | Score: 6/10 → 9.3/10 recovered | SKU: TNTD250326i769(2)
**Context:** Basketball coach card holder reverse-stencil, 5-iteration session fixing slot 1, 2, 6, 7 regressions
**What happened:** First run produced slot 1 with COACH letters 65% of plaque (should be ~50%), basketball position wrong, wood texture drifted rustic instead of smooth birch. Slot 2 had a mini "Thank you COACH" text overlay artifact in the upper-left corner. Slot 6 had product rotated 90° (portrait) instead of landscape. Root cause: each time I tried to "fix" with MORE descriptive text (`critical_structure`, `see_through_cutout_rule`, `lighting_harmony_rule`), the total prompt text grew to ~2000+ words. Model (nano-banana-pro / Gemini-based) weighted text > reference image → product reimagined from text description instead of copied from reference.
**Lesson:** Adding more text to fix fidelity is exactly backwards. The right fix is REMOVING text, strengthening the fidelity guard, and reordering reference images so the canonical front view comes first. Measurable result: prompt ~2000 words → ~60 words + 80-word fidelity guard = slot 1 went from 9.5/10 to 10/10 pixel-perfect.
**Rule:** See [prompt-anti-patterns.md](prompt-anti-patterns.md) for the full per-slot inject/forbid rules. Key takeaway: in direct-ref mode, reference images carry product identity; text describes scene only. Per-slot inject flags (`inject_see_through_rule`, `inject_lighting_harmony_rule`, `inject_product_structure`, `inject_critical_structure`) now enforced by `utils/prompt-guard.js` at runtime.
**Infrastructure added:** `xp/prompt-anti-patterns.md`, `config/prompts/slot-constraints.json`, `utils/prompt-guard.js`, `_fidelityGuard()` block version, `_structureRules()` gated by slot.
**Final score:** 8/8 PASS, average 9.3/10, champions slot 1 and slot 4 both 10/10.


### XP-003 | 2026-04-10 | Score: 2/10 | SKU: TNTD250326i769(1)
### XP-003 | 2026-04-10 | Score: 2/10 | SKU: TNTD250326i769(1)
**Context:** slot4 use-case + slot8 lifestyle — wooden "Thank You COACH" card holder with reverse-stencil cutout letters and horizontal side-loading gift card slot
**What happened:** Generated image rendered the COACH letters as solid engraved wood (lost the through-cut stencil effect) and showed the gift card entering from the top edge (wrong slot axis). The USP — a see-through window where the inserted card's color fills the COACH letter shapes — was completely missing. Reference image of the real product clearly shows hollow cutout letters and a side slot, but this information lived only in the brief-level `product_structure` field and did not propagate to the slot-level prompts, so the model defaulted to the statistical average for "wooden coach card holder": engraved text + top slot.
**Lesson:** For any product where an insert is **visible through** a cutout in the front panel (reverse-stencil / window cutout products), the see-through relationship MUST be stated explicitly in every slot prompt that shows the product with an insert — not just in the brief root. Use standardized vocabulary from `knowledge/photography/product-structure-analysis.md`: "through-cut stencil letters," "hollow cutout," "side-loading slot," "the inserted card sits in the cavity behind the front panel and its color is visible through the cutout letter shapes." Reference images must be analyzed BEFORE writing prompts using the structural analysis checklist.
**Rule:** Reverse-stencil / through-cut products require (a) a `see_through_cutout_rule` field at brief root, (b) a `critical_structure` field on every slot that shows the product with an insert, (c) explicit "hollow cutout / through-cut" vocabulary in prompts, (d) slot orientation stated as "side-loading" or "top-loading" with direction of card travel.
**Case study:** [xp/case-studies/TNTD250326i769-reverse-stencil/README.md](case-studies/TNTD250326i769-reverse-stencil/README.md)


### XP-002 | 2026-04-10 | Score: 0/10 | SKU: TNTD180326i745
**Context:** slot7 emotional human scene
**What happened:** When attention goes to the human subjects, the banner material drifted from natural light birch wood to dark charcoal
**Lesson:** In scenes with prominent human subjects, explicitly re-state product color lock in the prompt ('banner MUST remain natural pale birch wood, NEVER dark/black/charcoal') otherwise model reallocates contrast budget to skin tones
**Rule:** Human-scene slots must re-assert key product colors with absolute terms near the end of the prompt


### XP-001 | 2026-04-10 | Score: 0/10 | SKU: TNTD180326i745
**Context:** slot4 use-case smartphone-style insertion shot
**What happened:** nano-banana-pro reimagined the two-layer pocket structure and glued the banner to the gift card. Also hallucinated garbled handwritten text on a visible note.
**Lesson:** For use-case shots with hand + insertion action, the model is MUCH more likely to reimagine product geometry. Must lock geometry explicitly: 'the gift card slides DOWN into the top seam between two wood layers; the Best Teacher Ever banner is glued to the upper BACK panel, NEVER to the card itself'. Also: always add 'no visible handwritten text, no legible writing' to negative prompt to avoid text hallucination.
**Rule:** Use-case slots must include explicit geometric constraints + 'no legible secondary text' negative to prevent hallucinated notes/signs

---

## COMPILED RULES

### RULE-016: For use-case shots with hand + insertion action, the model i
- **Rule:** For use-case shots with hand + insertion action, the model is MUCH more likely to reimagine product geometry. Must lock geometry explicitly: 'the gift card slides DOWN into the top seam between two wood layers; the Best Teacher Ever banner is glued to the upper BACK panel, NEVER to the card itself'. Also: always add 'no visible handwritten text, no legible writing' to negative prompt to avoid text hallucination.
- **Verified:** 3 times
- **Source entries:** XP-001, XP-178, XP-142

### RULE-015: For any product where an insert is **visible through** a cut
- **Rule:** For any product where an insert is **visible through** a cutout in the front panel (reverse-stencil / window cutout products), the see-through relationship MUST be stated explicitly in every slot prompt that shows the product with an insert — not just in the brief root. Use standardized vocabulary from `knowledge/photography/product-structure-analysis.md`: "through-cut stencil letters," "hollow cutout," "side-loading slot," "the inserted card sits in the cavity behind the front panel and its color is visible through the cutout letter shapes." Reference images must be analyzed BEFORE writing prompts using the structural analysis checklist.
- **Verified:** 3 times
- **Source entries:** XP-003, XP-184, XP-141

### RULE-014: Reverse-stencil / through-cut products must propagate see-through relationship into every slot prompt
- **Rule:** Any product where an insert is visible through a cutout in the front panel is a reverse-stencil product. The see-through relationship (insert color fills cutout shape instead of front panel color) MUST be stated explicitly in every slot prompt that shows the product with an insert — not only in the brief root. Required brief fields: `see_through_cutout_rule` at root + `critical_structure` on each affected slot. Required prompt vocabulary: "through-cut stencil letters / hollow cutout," "side-loading or top-loading slot," "inserted card sits in the cavity behind the front panel and its color is visible THROUGH the cutout shapes." Mandatory pre-generation step: reference image analysis using the checklist in `knowledge/photography/product-structure-analysis.md`.
- **Verified:** 1 time
- **Source entries:** XP-003
- **Categories:** errors, structure, prompts

### RULE-001: For use-case shots with hand + insertion action, the model i
- **Rule:** For use-case shots with hand + insertion action, the model is MUCH more likely to reimagine product geometry. Must lock geometry explicitly: 'the gift card slides DOWN into the top seam between two wood layers; the Best Teacher Ever banner is glued to the upper BACK panel, NEVER to the card itself'. Also: always add 'no visible handwritten text, no legible writing' to negative prompt to avoid text hallucination.
- **Verified:** 6 times
- **Source entries:** XP-001, XP-184, XP-178, XP-160, XP-142, XP-141

