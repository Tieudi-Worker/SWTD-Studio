# Product Structure Analysis — Reference Image Deep Reading

> Mandatory pre-generation step: read every reference image with the vocabulary below and produce a structural breakdown BEFORE writing any prompt. Most product-fidelity failures come from writing a prompt against an assumed structure instead of the actual one.

## Why This Matters

AI image models do not infer mechanical structure from a single hero reference. If the brief says "card holder with COACH text" the model will default to the statistical average — engraved wood, top-loading, solid letters. If the actual product uses a **reverse-stencil cutout with a horizontal side slot**, every lifestyle slot will silently render the wrong structure and destroy the USP.

The fix is not "better prompts." The fix is a **structural analysis pass** where we translate the reference photo into a precise mechanical description using standardized vocabulary, and that description is what the prompt enforces.

## Standardized Structural Vocabulary

Use these exact terms in briefs and prompts. They map to things AI models can actually render.

### Layer Construction

| Term | Meaning |
|------|---------|
| **Layer stack** | Ordered front-to-back list of physical sheets that make up the product. |
| **Base layer** | Rearmost solid sheet. Usually structural, no cutouts. |
| **Cavity layer** | Middle sheet(s) with material removed to create a hollow space for an insert (card, paper, photo). |
| **Front panel** | Frontmost opaque layer that the viewer sees first. |
| **Decorative layer** | Optional topmost sheet (acrylic, metal, thin ply) carrying branding text or ornaments, glued on top of the front panel. |

### Cutouts and Openings

| Term | Meaning | How AI should render |
|------|---------|----------------------|
| **Through-cut / stencil cutout** | Shape cut **all the way through** a layer, leaving a hole. You can see whatever is behind it. | Render as empty negative space showing the layer behind. NEVER paint or engrave. |
| **Engraving** | Shallow burn or carve that removes a thin surface layer. The shape stays solid wood. | Render as a darker-toned recess in the wood grain. |
| **Relief cut** | Partial-depth cut that creates a raised or recessed shape but does NOT go through. | Render as 3D depth variation, material continuous. |
| **Inlay** | A shape cut out of one material and filled with a different material (e.g. acrylic inset into wood). | Render as two distinct materials flush at the surface. |
| **Reverse-stencil / window cutout** | Through-cut letters or shapes in the front panel that reveal whatever is inserted in the cavity behind. The **insert becomes the visual fill** of the cutout shape. | Render the cutout as a window; the color/texture inside the letter shapes must match the inserted object, NOT the front panel material. |

### Slot Orientation

| Term | Meaning |
|------|---------|
| **Top-loading slot** | Opening on the top edge. Card slides in vertically downward. |
| **Side-loading slot** | Opening on the left or right edge. Card slides in horizontally. |
| **Back-loading slot** | Opening on the rear. Card is hidden entirely, not visible from the front. |
| **Envelope fold** | Slot formed by a folded flap rather than a cut opening. |

**Rule:** slot orientation determines the hand gesture in every use-case shot. Getting this wrong makes the lifestyle scene unusable because the hand angle and card direction contradict the product.

### Insert Visibility Modes

| Mode | Meaning |
|------|---------|
| **Fully hidden** | Insert is invisible once placed. No visual feedback. |
| **Partially protruding** | A fraction (typically 20–30%) of the insert sticks out as a visual cue. |
| **Window-visible** | Insert is visible **through** a cutout in the front panel. This is the case for reverse-stencil products. |
| **Face-forward display** | Insert is clipped onto the front with nothing covering it. |

## Reference Image Reading Checklist

For every new SKU, before writing any prompt, walk through this checklist on the reference photos. Produce a short structural note in the brief under `product_structure`.

### 1. Layer Identification
- How many layers does the product have, front to back?
- Which layer carries the branding text?
- Which layer has the cavity or slot?
- What material is each layer?

### 2. Cutout Classification
For each visible shape or text element, classify it as one of:
through-cut, engraving, relief cut, inlay, or printed.

Ask explicitly: **"Is this a hole or a solid surface?"** The answer changes the prompt entirely.

### 3. Slot Orientation and Insert Path
- Where is the opening located? Top, side, back, or envelope fold?
- Which direction does the insert travel to enter the slot?
- Once inserted, where does the insert sit — fully hidden, partially out, or visible through a window?
- If window-visible: which layer is the window cut through, and which layer does the insert sit behind?

### 4. Visual Feedback Loop
- How does a viewer know a card is inserted? Protruding edge? Color through cutout? No visible feedback at all?
- If there is a see-through window effect, this is usually the USP and must be shown in slot 1, 3, 4, 7, and 8.

### 5. Scale and Hand Relationship
- What real-world object is the product roughly the size of? (credit card, palm, postcard, paperback.)
- Can it be held in one hand?
- In a use-case shot, where do the fingers grip relative to the slot and the text?

## Failure Patterns to Watch For

These are the patterns that cause silent structural failures in generated images. Check for them during QC.

### Pattern A: Solid-Letter Substitution
**Symptom:** Reference has through-cut stencil text. Generated image renders the text as engraved or painted on solid wood.
**Root cause:** Prompt said "COACH text" without specifying "hollow cutout stencil — empty holes through the wood."
**Fix:** Always use the vocabulary terms above. Say "through-cut stencil letters" or "hollow cutout letters" explicitly.

### Pattern B: Wrong Slot Axis
**Symptom:** Reference has side-loading slot. Generated image shows card entering from the top.
**Root cause:** Brief said "card inserts into the holder" without specifying axis.
**Fix:** Always state slot orientation (top-loading, side-loading, back-loading) AND direction of card travel ("horizontally from the left edge").

### Pattern C: Lost Window Effect
**Symptom:** Reference has a reverse-stencil window where the insert's color fills the letter shapes. Generated image renders the cutout as empty or as solid material.
**Root cause:** Prompt did not explain the see-through relationship between the cutout layer and the insert behind it.
**Fix:** Use this phrasing: "the [letter/shape] is a through-cut window in the front panel; the inserted [card/photo] sits in the cavity behind and its color/texture is visible through the cutout, so you see the [letter/shape] filled with the [card/photo] color instead of wood."

### Pattern D: Decorative Layer Detachment
**Symptom:** Reference has decorative acrylic glued on top of the front panel. Generated image detaches the decoration and places it on the insert instead (e.g. "Thank You" banner glued to the gift card).
**Root cause:** Use-case shots with hands and insertion triggers the model to reimagine which part the branding belongs to.
**Fix:** Lock attachment explicitly: "the [decoration] is permanently glued to the front panel, NEVER to the inserted card."

### Pattern E: Scale Drift
**Symptom:** Generated image renders the product at the wrong size relative to human hands.
**Root cause:** Prompt omitted real dimensions or used vague words like "small."
**Fix:** Always include concrete dimensions and a size analogy ("4x3 inches, credit-card sized, held between thumb and forefinger").

## Brief Fields Required by This Skill

When a SKU has any of through-cuts, inserts, or multi-layer construction, the brief MUST include these fields:

- `product_structure` — full layer stack description using the vocabulary above
- `see_through_cutout_rule` — one sentence locking the window effect (if applicable)
- `slot_concepts.slotN.critical_structure` — per-slot structural reminder for slots showing the product with an insert

Slots that MUST show the insert-in-place state for reverse-stencil products:
slot 1 (hero, with card visible through cutout), slot 3 (feature callouts including the cutout detail), slot 4 (use-case insertion), slot 7 (emotional gifting moment), slot 8 (lifestyle close-up).

## Case Study: TNTD250326i769(1) — Baseball Coach Card Holder

**Structure (corrected after XP):**
- Layer 1 (base): 3mm plywood, solid.
- Layer 2 (cavity): 2mm plywood with horizontal internal cavity sized for a credit-card gift card. Opening on the SIDE edge.
- Layer 3 (front panel): plywood with "COACH" cut as hollow through-cut stencil letters.
- Layer 4 (decorative): white acrylic cursive "Thank You" glued to the front panel, with a red-stitched baseball element.

**Reverse-stencil effect:**
Gift card slides in horizontally from the side edge, sits in the Layer 2 cavity behind the COACH cutouts. Card color becomes visible through the cutout letters. Reader sees "COACH" in the gift card's blue-and-white, not wood color.

**First-run failure:**
Generated slot 4 rendered:
- Card entering from the top (wrong axis)
- COACH as solid wood text (lost stencil cutout)
- No see-through window effect (lost USP entirely)

**Root cause:**
Brief said "gift card slot is HORIZONTAL" and mentioned "letters are cut through" but did not force the see-through relationship in the slot-level prompts. The model defaulted to the statistical average (engraved wood + top slot).

**Fix applied:**
Added `see_through_cutout_rule` at brief level, added `critical_structure` to slots 3, 4, 8 with explicit stencil vocabulary, and added reverse-stencil terminology to this knowledge file so future SKUs with similar construction get analyzed upfront.
