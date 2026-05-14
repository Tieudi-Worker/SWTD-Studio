# Text-Heavy Engraved Product Fidelity — Lessons from TNTD030426i772

**Case study:** `_shared/xp/case-studies/TNTD030426i772-pregnancy-announcement-wooden-keepsake.md`  
**Use for:** handmade wooden keepsakes, engraved pregnancy announcements, personalized text products, small message plaques/cards.

---

## Core Principle

For engraved/personalized products, **visual beauty does not equal pass**. The output only passes if the product identity remains exact enough for shoppers to recognize the real item.

Minimum fidelity gate:

- Key text remains readable and semantically correct.
- Product structure/mechanism is preserved.
- Product orientation is correct.
- No added/removed product text.
- No warping/bending if product is rigid.
- Product remains large enough to inspect.

---

## Prompt Strategy

Use the reference image to carry product identity. The prompt should mostly describe the scene.

Good short anchors:

- “Use the reference product exactly.”
- “Rigid flat two-piece wooden keepsake.”
- “No bending, warping, text changes, or redesign.”

Avoid long product anatomy prompts. Long descriptions make the model rebuild the product from text instead of copying the reference.

---

## Slot Guidance

### Lifestyle Slots

Small engraved products often fail when placed too far from camera. Keep product in foreground and sharp. Hands can support emotion but must not cover the message.

### Grid Slots

A 4-panel grid can look conversion-strong while failing product fidelity. Each cell must show the actual product mechanism, not a simplified generic card.

### Close-up Detail Slots

Close-up lifestyle/detail compositions are safer than full people scenes for preserving text and product structure.

---

## Backend Preference

Accepted hierarchy from Boss:

1. `openai/gpt-image-2` when quota exists.
2. KIE fallback only.
3. KIE `nano-banana-pro` is the stable fallback for fidelity.
4. KIE `gpt-image-2-image-to-image` only for explicit comparison/request.
5. No FAL/Flux for this workflow.

---

## Credit Discipline

Paid generation tasks must be submitted once, waited to completion, saved, and reported. Do not self-regenerate after self-QC without Boss approval.

---

## Versioning Discipline

After every successful paid generation, immediately preserve files into a versioned folder before starting another backend/run. Canonical output files may be overwritten by the runtime.
