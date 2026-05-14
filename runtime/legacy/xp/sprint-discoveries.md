
## 2026-04-14 03:06 — discovery during Wave 2 smoke test (TNHG231025i622)

### seedream-4 not supported by KIE.ai
- Symptom: HTTP 422 "The model name you specified is not supported" on every seedream-4 call
- File: config/model-routing.json (slots 2, 6, 7, 8 mapped to seedream-4)
- Impact: all 4 cinematic slots fallback to nano-banana-pro. Pipeline lives (fallback chain works), but Wave 2.4 advantage unvalidated.
- Suggested fix: verify correct KIE.ai endpoint name (check https://kie.ai/dashboard), update config strings. Candidates: `seedream-v4`, `seedream`, `bytedance-seedream-4`, etc.
- Decision: DEFER fix — surface to user, let them check dashboard. NOT blocking: fallback chain ensures all slots ship.

### QC slot 1 flags on first Wave 2 regen
- Symptom: slot 1 hero flagged CLUTTER_HIGH 0.1665 (max 0.15) + MOBILE_CROP_RISK 0.667 (need ≥0.8)
- File: data/TNHG231025i622/output/listing/TNHG231025i622_slot1_main.jpg
- Cause (unverified): concept 1 picked "warm rim light + visible cash through slot" may have generated busy background or off-center product
- Decision: check image visually during Cohesion Validation step; if real problem → regen slot1 with tighter concept

### Wave 2.5 integration gap: ConceptDirector nested format vs slot builders flat format
- Symptom: Wave 2.5 writes brief.slot_concepts.slotN = {concepts, picked, picked_concept} but image-generator slot builders read concept.scene / concept.style directly → undefined → fallback to category default template. Slot 4 drifted to generic "hand holding outdoor" instead of picked "hand inserting bill into slot".
- File: agents/concept-director.js merge logic
- Fix applied: flatten picked_concept to top-level during merge. raw[k].picked_concept || raw[k] → flat[k]. Preserves _slot_concepts_v2.json for audit.
- Impact: slots now receive scene/style/hook_element fields that slot builders can read.
- Status: FIXED in-session as surgical 1-line change (no new commit — smoke test fix). Should be committed as a separate fix commit before Wave 2 merge.

### Wave 2.5 integration gap #2: slot 3 + 5 builders ignore concept.scene
- Symptom: slot 3 & 5 rendered Wave 1 default templates even with Wave 2.5 picked_concept provided. Slot 3 always gave "TOP hero + BOTTOM 3 circles", slot 5 always gave "dual-view with dimension arrows". Ignored free-form scene text.
- Root cause: slot 3 builder hard-codes TOP/BOTTOM template and only reads concept.bg + concept.bottom_layout. Slot 5 only activates rich path when concept.layout field exists — concept.scene alone falls to default.
- Files: agents/image-generator.js _buildDirectSlot3, _buildDirectSlot5
- Fix applied: both builders now prefer concept.scene if present, falling back to Wave 1 field-based templates otherwise. Same pattern as slot 4/6/7.
- Impact: Wave 2.5 Concept Brainstorm now wires fully into slot 3 + 5. Confirmed working — slot 3 rendered rich graduation infographic with headline/dimensions/callouts; slot 5 rendered 4-cell "display it anywhere" grid. Both exactly matched concept text.
- Status: FIXED in-session. Should combine with slot-builder concept flatten fix into a single "Wave 2.5 slot-builder scene integration" commit before merging.

### Brief dimension ambiguity
- Symptom: brief.json has "dimensions": "7.1x3.51 inches" but ornament is portrait (taller than wide). Slot 3 + 5 render dimensions with 7.1 as width which looks visually wrong.
- File: brief.json (data/TNHG231025i622/brief.json)
- Fix suggestion: document convention (WxH or HxW?) in brief-validator.js + enforce orientation consistent with portrait vs landscape products. Or parse "HxW" when H > W.
- Status: logged, not fixed — brief-data-level issue not code-level.
