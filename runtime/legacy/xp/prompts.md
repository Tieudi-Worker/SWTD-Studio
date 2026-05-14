# XP: Prompts

## Metadata
- Total entries: 7
- Last updated: 2026-04-13
- Top rule: Prompt length is the #1 determinant of fidelity in direct-ref mode. Short prompt (≤80 words) + strong fidelity guard beats long prompt every time.

---

## Entry LOG

### XP-006 | 2026-04-13 | Score: 9/10 | SKU: TNHG231025i621
**Context:** slot8 seasonal theme enforcement
**What happened:** Graduation ornament defaulted to Christmas theme because ornament category = Christmas in AI training data
**Lesson:** For ornament products with non-Christmas occasions (graduation, memorial, birthday), MUST explicitly exclude Christmas elements in every lifestyle prompt: NO Christmas tree, NO pine, NO holly, NO holiday decorations

### XP-005 | 2026-04-11 | Score: 10/10 | SKU: TNTD250326i769(2)
**Context:** slot1 hero white background, after 5 iterations of prompt engineering
**What happened:** Final prompt shape that achieved pixel-perfect slot 1:
```
This exact product from the reference images on a pure seamless white studio background.
PRODUCT FIDELITY IS CRITICAL: reproduce the product EXACTLY as it appears in the reference images —
same proportions, same layout, same letter sizes and spacing, same text style, same basketball
position, same wood tone, same surface finish. Do NOT redesign, resize, recompose, or reinterpret
any element of the product itself. The reference images are the source of truth for the product.
Only the background, scene, and lighting are new.
Single hero shot, slightly angled 3/4 view to show depth.
Product centered, fills about 70% of the frame, soft natural contact shadow beneath.
Professional Amazon main product image, clean soft studio lighting, photorealistic 4K.
```
Total: ~120 words. Reference images: first 5-8 from `input_images`, canonical front view first.
**Lesson:** The fidelity guard block must be longer and more emphatic than any product description. "Reproduce the product EXACTLY... do NOT redesign" works. "Keep the product identical to the reference" (single sentence) does not. Reference image order affects output because KIE only passes first 5-8 refs.
**Rule:** Slot 1 (hero white) prompt template: no scene narrative, no structure description, no lighting harmony, no see-through rule. Just: bg + fidelity guard block + angle + lighting spec. Max 120 words.


### XP-004 | 2026-04-10 | Score: 0/10 | SKU: TNTD180326i745
### XP-004 | 2026-04-10 | Score: 0/10 | SKU: TNTD180326i745
**Context:** slot9 writing action + gift card insertion
**What happened:** Model rendered handwritten names 'Mrs. Smith' and 'Anna' correctly next to the engraved to/from labels on the first try
**Lesson:** Short, realistic names (2-5 chars, common English) render legibly in nano-banana-pro when placed near existing engraved labels as anchors. Avoid long or unusual phrases
**Rule:** For handwritten text in generated shots, use short common names only, placed adjacent to existing engraved labels


### XP-003 | 2026-04-10 | Score: 0/10 | SKU: TNTD180326i745
**Context:** slot4 use-case hand insertion
**What happened:** User action described as 'inserting card' was interpreted with wrong direction and wrong attachment point
**Lesson:** Describe insertion with absolute directional words: 'VERTICALLY DOWN, from ABOVE, into the TOP POCKET SEAM', and specify which half of the card remains visible
**Rule:** Directional prompts for insertion/usage must always include: direction vector, entry point, visible-vs-hidden proportions

### XP-002 | 2026-04-10 | Score: 0/10 | SKU: TNTD180326i745
**Context:** slot2_in-use classroom desk
**What happened:** Model rendered banner pencil-ends as fabric fringe/pom-poms instead of yellow pencil tips with pink erasers
**Lesson:** When describing a laser-cut pencil-banner, explicitly say 'SOLID yellow wooden pencil-tip with pink eraser accent — NOT fabric tassels, NOT cheerleader pom-poms, NOT fringe'. Negative prompt must include 'fabric fringe, tassels, pom-poms'
**Rule:** Always add explicit material descriptor (wood vs fabric) AND a targeted negative prompt for ambiguous decorative elements


### XP-001 | 2026-04-06 | Score: 7.95/10 | SKU: TNTD180326i750
**Context:** slot4 — TNTD180326i750_slot4_use-case.jpg
**What happened:** slot4 scored 7.95
**Lesson:** Chore List/Chart context trong prompt tạo storytelling mạnh cho conversion

---

## COMPILED RULES

(no compiled rules yet)
