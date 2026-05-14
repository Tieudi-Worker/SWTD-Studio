# Prompt Anti-Patterns — What NOT to Inject Into Direct-Ref Prompts

> **Purpose:** Direct-ref mode relies on reference images to carry product identity. When prompt text over-describes the product, the model (nano-banana-pro / Gemini-based) starts **reimagining** the product from text instead of copying from reference. Result: product drift, lost details, wrong proportions.
>
> **Core principle:** Reference image = product identity. Prompt text = scene only.
>
> **Read this file BEFORE drafting any direct-ref prompt.**

---

## Universal Anti-Patterns (apply to ALL slots)

### ❌ A1. Multi-paragraph product structure description
**Anti-pattern:** Including `product_structure` (200+ words) + `see_through_cutout_rule` (500+ words) + `critical_structure` (300+ words per slot) in a single prompt.

**Why it fails:**
- Total text description of product > 1000 words creates text dominance.
- Model weights text > image when text is more specific.
- Product gets "reconstructed" according to text, not copied from ref.

**Do instead:** Max **1-2 sentences** of product-specific guidance per slot, and ONLY if the reference image cannot communicate it (e.g., functional mechanism like card insertion direction).

**Case study:** TNTD250326i769(2) — slot 1 initial run: prompt ~2000 words → COACH letters rendered 65% of plaque (should be ~50%), proportions wrong. After rewrite to ~60 words → fidelity near-perfect.

---

### ❌ A2. Repeating the same rule across multiple fields
**Anti-pattern:** Writing the same "hollow COACH cutouts with wood grain floor" in `product_structure` + `see_through_cutout_rule` + `slot.critical_structure` + `slot.scene` + `slot.layout`.

**Why it fails:** Redundant rules multiply in the final concatenated prompt → model receives the same instruction 3-5 times → over-weights it → product becomes a caricature of that one feature.

**Do instead:** State each rule ONCE, in the highest-priority field. If it's a structural fact, put it in `product_structure` root. If it's a scene-specific instruction, put it in `slot.scene` only.

---

### ❌ A3. Teaching the AI how to build the product
**Anti-pattern:** "Layer 1 is base plywood with wood grain. Layer 2 is a 2mm cavity. Layer 3 has COACH cut-through. Layer 4 has acrylic decorations..."

**Why it fails:** You're giving the model a CAD spec. It will try to render each layer distinctly, often fabricating gaps, seams, and shadows that don't exist in the reference.

**Do instead:** Let the reference image show the construction. Only mention layers if the slot is explicitly an edge-detail / infographic shot (slot 3).

---

### ❌ A4. Lighting harmony rule in hero / studio slots
**Anti-pattern:** Adding "match scene lighting direction, contact shadow matching environment, ambient color bounce" to slot 1 (white studio) or slot 5 (size infographic).

**Why it fails:** These slots have NO scene — they're pure white. Adding "match scene" rules confuses the model; it invents props or gradients to "have a scene to match".

**Do instead:** `lighting_harmony_rule` only applies to slots 2, 4, 7, 8 (lifestyle scenes).

---

### ❌ A5. Negative "NEVER / DO NOT" lists that mention the forbidden element
**Anti-pattern:** "NEVER render COACH as painted letters. NEVER make it a solid text. NEVER show black voids."

**Why it fails:** Diffusion models have weak negation handling. Mentioning "painted letters" at all increases the probability they appear.

**Do instead:** Use the `negative_prompt` API field (if supported), or describe the POSITIVE version once: "COACH as hollow stencil revealing wood grain".

---

### ❌ A6. Grid-slot center floating hero product

**Anti-pattern:** For slot 5 (DISPLAY_LOCATIONS 2×2 grid) or any N-cell grid layout, the model defaults to adding an extra "hero" product floating in the center of the grid (between cells), overlapping cell labels and breaking the grid metaphor.

**Why it fails:** Training data for "4-cell grid" often includes center product medallions from marketplace thumbnails. The model interpolates "grid + product = grid-with-hero" unless explicitly told otherwise. Additional root cause: without an explicit "exactly N cells, one product per cell" instruction, the model treats cell count as a soft hint.

**Do instead:** Grid slot prompts MUST include the safeguard phrases stored in `config/prompts/slot-constraints.json → slot5.safeguard_phrases`. `utils/prompt-guard.js` auto-injects them before `sanitize()`:
- "EXACTLY N equal rounded-square cells, one product instance per cell"
- "NO extra product anywhere outside the cells, absolutely NO floating hero product in the center of the grid or between cells"
- "NO elements overlapping between cells — each cell self-contained"
- "every numbered cell label fully readable, no product obstructing any label"

Also added to `forbidden_phrases_extra`: "fifth ornament", "fifth product", "center hero", "floating in middle", "between the cells", "center medallion", "hero product in center".

**Case study:** TNHG231025i621 first attempt at slot 5 — 5th ornament appeared in center overlapping the "Shelf" label in the 2×2 DECORATE ANYWHERE grid. Regen with explicit safeguard phrases → clean 4-cell grid, zero bleed-through.

---

### ❌ A7. One-size-fits-all reference set across all slots / A+ modules

**Anti-pattern:** Using the same 3-5 product reference images for EVERY slot (listing) or module (A+), regardless of what that shot actually needs.

**Why it fails:**
- Refs irrelevant to a shot dilute AI attention.
- Blurry / off-axis refs (e.g. 3/4-angle partial-product shots) cause AI to "average" silhouettes — a flat mason-jar can render as a rainbow disc.
- Process shots (laser cutter machines, gift-box flat-lays) often need 0-1 product refs; adding full catalog confuses context.
- Token-macro shots need close-up token refs, not full-jar refs.

**Do instead:** Define named ref catalog per-SKU with role labels, each slot/module picks a subset (1-3 refs) matching visual intent.

```json
"ref_catalog": {
  "hero_faceon":    "input/product/.../face_on.jpg",
  "hero_lifestyle": "input/product/.../lifestyle_with_loose_components.jpg",
  "tokens_topview": "input/product/.../top_down.jpg",
  "edge_thickness": "input/product/.../3quarter_angle.jpg"
}
```

Per-module selection examples:
- Hero white (slot 1) → `hero_faceon` + `tokens_topview`
- Infographic callouts (slot 3) → `hero_lifestyle` + `edge_thickness` + `hero_faceon`
- Gift-box flat-lay (slot 6 / A+ M5) → `hero_lifestyle` (1 ref enough — contains product + loose components)
- Process shots (A+ M3 laser cutter) → 1 ref or 0 refs (machine-only panels)
- Grid multi-product (Type 2 A+ M3 matrix) → `hero_faceon` of EACH child ASIN

**Quality gate:** Blurry / off-axis refs excluded from default pool. Only include when shot specifically needs edge-thickness or 3D angle detail.

**Case study:** TNTD180326i750 A+ test v2→v3.
- v2 used 3 refs blanket for all 10 banners.
- v3 switched to per-banner refs.
- Plan B M3 Handcrafted Proof: 3 refs (v2) → 1 ref `hero_lifestyle` (v3). Laser cutter fidelity improved, token magnifier got more detail, jar magnet panel preserved rainbow band.
- Plan A M3 v3 with 3 refs including `edge_thickness` (blurry) REGRESSED — jar rendered as rainbow disc instead of mason-jar. Lesson: even per-module refs must filter low-quality inputs.

Codified in `config/funnels/aplus-shared-constraints.json → rules.R4_per_banner_ref_selection`.

---

### ❌ A8. Multi-ASIN parent A+ rendering only 1 product or blending N products

**Anti-pattern:** For Type 2 (parent ASIN with N child products), model either shows only 1 product across 5 modules, or blends N product silhouettes into 1 hybrid frame.

**Why it fails:**
- Without explicit per-child F1-F8 enforcement, model treats N refs as "variations of one thing" and averages them.
- Scale relationships lost — a 6-inch jar and a 3-inch card render same size.
- M3 Product Matrix grid cells end up with same product in each cell.

**Do instead:** In every Type 2 prompt, explicitly:
1. List each child ASIN by name with F1-F8 signature
2. Specify relative size ratios (jar 2× card width)
3. Position assignments (M1 hero: "jar center, card left, frame right")
4. M3 Matrix: each cell prompt section specifies WHICH child + its refs

Example prompt scaffold for Type 2 M3 Matrix:
```
2×2 grid of 4 cells...
CELL 01 (top-left): {child_1.display_name} — {F1-F8 child 1}, size {dim_1}
CELL 02 (top-right): {child_2.display_name} — {F1-F8 child 2}, size {dim_2}
CELL 03 (bottom-left): {child_3.display_name} — {F1-F8 child 3}, size {dim_3}
CELL 04 (bottom-right): {child_4.display_name} — {F1-F8 child 4}, size {dim_4}
Each cell uses ITS OWN reference. Do NOT blend products. Do NOT repeat one product across cells.
```

Ref strategy: pass 1 ref per child (hero_faceon), max 5 total per KIE call. If N > 5, split M3 Matrix into 2 passes + composite post-production.

**Case study:** N/A — schema form defined, awaiting parent ASIN for real-world verification.

Codified in `config/funnels/aplus-type2-multi-asin.json → plan_A_modular.modules[2]` (M3 Product Matrix).

---

## Per-Slot Anti-Patterns

### Slot 1 — Hero white background

❌ **DO NOT** include any scene/lighting/environment description beyond "pure white studio".
❌ **DO NOT** inject `see_through_cutout_rule` (product hero = pure reference fidelity, let the ref image show the cutouts).
❌ **DO NOT** inject `lighting_harmony_rule` (no scene to harmonize with).
❌ **DO NOT** mention "multi-layer construction" (that's slot 3's job).
❌ **DO NOT** describe basketball/acrylic/text positions — they're in the ref.

✅ **DO:** Short prompt (~50-80 words). Strong fidelity guard. Pure white bg. Single angle direction. Contact shadow.

**Reference length:** ~60 words max including fidelity guard.

---

### Slot 2 — Lifestyle in-use (wide shot)

❌ **DO NOT** describe product structure at all. Product is ~5-15% of frame; AI will downsize-then-reimagine.
❌ **DO NOT** inject `see_through_cutout_rule` — at this frame size, the cutouts aren't resolvable.
❌ **DO NOT** list props with precise spatial relationships ("basketball on left, gift card on right, whistle center") — the scene narrative will dominate.
❌ **DO NOT** add "no text overlay, no logo" in the scene field — this sometimes triggers overlay hallucination. Put in negative_prompt instead.

✅ **DO:** Scene narrative (who, where, lighting). Scale hint ("small credit-card sized"). Fidelity guard. ~80-120 words max.
✅ **PREFER:** Use **Flux Kontext Pro** for this slot — it's img-to-img and preserves product pixels.

**Reference length:** ~100 words max.

---

### Slot 3 — Features + Size combined infographic (LOCKED STRUCTURE, RULE-016)

**Structure (fixed for all SKUs):** Header banner with product-category icon + uppercase title in accent color. Product rendered large on the left below banner with horizontal width arrow + vertical height arrow + small circular thickness/depth callout bubble. Right column of 4 rounded-square white callout cards with numbered headers (01-04), each card macro crop + 2-line label. Per-SKU content (banner headline, 4 features, dimension values) filled by Vision Concept Brainstorm phase.

✅ `product_structure` DETAILS ARE ALLOWED (this is the infographic slot).
✅ Dimension arrows + thickness bubble ARE REQUIRED (size moved here from legacy slot 5).
✅ `concept.scene` must spell out banner headline, accent color choice, and the 4 callout specs.
❌ **DO NOT** inject `see_through_cutout_rule` root (redundant with callout content).
❌ **DO NOT** add lifestyle/scene narrative.
❌ **DO NOT** revert to the legacy "smiling person holding product + 3 circles" layout.

**Reference length:** ~150-180 words (wider than legacy 120 because features + size combined).

---

### Slot 4 — Use-case demo (functional)

✅ `see_through_cutout_rule` (1-sentence version) IS ALLOWED — this slot shows the card insertion mechanism.
✅ Hand + card insertion action MUST be in `scene`.
❌ **DO NOT** describe the full 4-layer structure — just the insertion direction and the see-through effect.
❌ **DO NOT** mention specific card colors or brands.

✅ **DO:** Scene narrative (who, where). Hand action description. 1-sentence reverse-stencil note. Fidelity guard.

**Reference length:** ~120 words max.

---

### Slot 5 — N-cell display-locations grid (LOCKED STRUCTURE, RULE-017)

**Structure (fixed for all SKUs):** Top header with uppercase grid title ("DISPLAY ANYWHERE" / "STYLE ANYWHERE" / niche-synonym) + italic subtitle. 2×2 grid of N equal rounded-square cells (default 4, adaptive 2-4 by niche), one product per cell, each cell a different real-use display/use scenario appropriate to the niche. Small accent-color circular numbered label top-left of each cell + bold label bar bottom-left with tiny matching icon. Per-SKU content (title text, N value, N scenario names) filled by Vision Concept Brainstorm phase.

✅ Safeguard phrases auto-injected by `prompt-guard.js` from `slot-constraints.json → slot5.safeguard_phrases`:
  - "EXACTLY N cells, one product per cell"
  - "NO fifth floating product, NO center hero between cells"
  - "NO elements overlapping between cells"
  - "every numbered label fully readable"
✅ Dimensions no longer belong here (moved to slot 3 per RULE-016).
❌ **DO NOT** inject `see_through_cutout_rule`.
❌ **DO NOT** inject `lighting_harmony_rule`.
❌ **DO NOT** write "dual view with dimension annotations" — that's legacy behavior before RULE-017.
❌ **DO NOT** allow the phrase "fifth ornament", "center hero", "floating in middle", "between the cells", "center medallion", "hero product in center" — all stripped by `forbidden_phrases_extra`.

**Reference length:** ~100-120 words (wider than legacy 60 because grid + N labels + safeguard need space).

---

### Slot 6 — Flat lay / gift set

✅ `see_through_cutout_rule` (1-sentence version) IS ALLOWED — top-down angle can show cavity depth.
✅ `lighting_harmony_rule` (warm from above) IS ALLOWED.
❌ **DO NOT** describe the product hand-held — this is top-down.
❌ **DO NOT** mention product scale in hand — no hand in this slot.

✅ **DO:** Surface. Props list (generic, unbranded). Horizontal landscape enforcement. ~120 words max.

---

### Slot 7 — Emotional lifestyle (group scene)

Same as slot 2 rules. Wide shot = product small in frame = don't over-describe structure.

✅ **PREFER:** Use **Flux Kontext Pro**.

**Reference length:** ~100 words max.

---

### Slot 8 — Close-up lifestyle keepsake

✅ `lighting_harmony_rule` (1-sentence version) IS ALLOWED — this is THE benchmark slot for lighting integration.
✅ `see_through_cutout_rule` (1-sentence version) IS ALLOWED — close-up reveals cavity.
❌ **DO NOT** describe full 4-layer structure.

✅ **DO:** Scene narrative. Lighting hint. 1-sentence structure note. Shallow DOF. ~120 words max.

---

## Conversation-Learned Lessons (append as new lessons come in)

### Lesson 2026-04-11 — TNTD250326i769(2) reverse-stencil product (5-iteration session)

**Context:** Basketball coach card holder, reverse-stencil COACH cutouts, horizontal landscape. User ran pipeline 5 times, each time fixing different regression. Final result: 8/8 PASS, avg 9.3/10, slots 1 & 4 = 10/10.

#### Technical lessons

1. **Text dominance confirmed (MOST IMPORTANT):** Prompt ~2000 words → product reimagined; prompt ~60 words + strong fidelity guard → near pixel-perfect. The *ratio* of product-description text vs reference image weight matters more than the content accuracy of that text. Even "correct" descriptions hurt fidelity if they're long.

2. **`_fidelityGuard()` must be a BLOCK, not a single sentence.** Single line "keep identical to reference" is drowned by any structure description. Strong 80-word block with "reproduce EXACTLY, do NOT redesign, resize, recompose, or reinterpret" holds up.

3. **Reference image ORDER matters measurably.** KIE passes first 5-8 refs only. Reordering `input_images` to put front straight-on view first (20260406_142423.jpg) produced visibly better fidelity on nano-banana-pro — even without any other changes.

4. **`critical_structure` field was silently ignored by direct-ref code** until we wired `_structureRules()` in. Pre-fix: changes had zero effect. Post-fix: it works — but now must be gated per slot to avoid text dominance.

5. **Per-slot inject flags solve the tension** between "need structure detail for functional slots" and "need minimal text for hero/lifestyle slots":
   - Slot 1 (hero white): inject nothing (ref carries all)
   - Slot 3 (infographic): inject product_structure (this IS the structure slot)
   - Slot 4 (use-case): inject see_through_rule (mechanism is the value)
   - Slot 6 (flat-lay): inject see_through_rule + lighting_harmony (top-down reveals cavity, scene has lighting)
   - Slot 8 (close-up lifestyle): inject see_through_rule + lighting_harmony (BENCHMARK slot)
   - Slot 2/5/7: inject only critical_structure, max 1 sentence

6. **Wide-shot slots (2, 7) have a fidelity ceiling at ~8.5-9/10.** Product is <15% of frame; nano-banana cannot resolve fine detail and starts reconstructing from memory. Accept this limit, or use Flux Kontext Pro as fallback (`fallback_flux_kontext: true`).

7. **Flux Kontext Pro is img-to-img and preserves product pixels.** Great for retry when nano-banana fidelity fails, but nano-banana is the default (user preference). Flux = option 2.

8. **Checkpoint system (per-slot progress) is critical for fast iteration.** Delete 1-2 bad JPG files + remove entries from `_progress.json` → rerun pipeline → only failed slots regen. Saved many API calls and minutes during this session.

#### Behavioral lessons (for Claude agent working on HMA)

9. **NEVER add more text when fidelity drifts.** Claude's instinct is to add more descriptive instructions. In direct-ref mode this makes it WORSE. The correct instinct: remove text, tighten fidelity guard, reorder refs.

10. **NEVER "fix" a problem without understanding the root cause.** Early iterations added more `critical_structure` detail thinking that would help. It made the model reimagine more. Root cause analysis (text dominance) was the only fix.

11. **NEVER offer A/B/C/D menus when user wants a decision.** User explicit feedback: "dừng có tất cả đều phải là tôi, tôi chỉ muốn nhận kết quả cuối với đúng ý tôi". Analyze → propose → self-critique → decide → execute.

12. **User credit is precious.** Every rerun costs KIE API credits. Before rerunning, run sanity checks, unit tests, JSON validation, and verify the fix makes sense from first principles.

13. **Learning must be persisted cross-session.** XP rules in `xp/*.md`, anti-patterns here, memory files in `~/.claude/projects/.../memory/`, and CLAUDE.md XP RULES block must ALL be updated when a regression is discovered. Otherwise next session repeats the same mistakes.

#### Architectural lessons

14. **Prompt Guard System is the right abstraction.** Moving the "what to inject / what to strip" logic out of brief content and into `config/prompts/slot-constraints.json` + `utils/prompt-guard.js` makes the system self-improving. Brief content becomes pure declarative data; guard enforces rules.

15. **Fallback model strategy (nano-banana primary + Flux Kontext option 2) is the right balance.** Don't replace working model. Add fallback path for edge cases. `fallback_flux_kontext` flag per slot.

---

## Maintenance

When Claude (this agent) causes a regression or the user points out a recurring mistake:

1. Add a new bullet under **Conversation-Learned Lessons** with date + SKU + symptom + fix.
2. If the lesson generalizes beyond one SKU, promote it to the per-slot or universal anti-patterns section.
3. Update `config/prompts/slot-constraints.json` if the lesson translates to a new forbidden phrase or keyword.
4. Read this file at the START of every new HMA prompt-engineering session.
