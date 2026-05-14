# A+ Content Concept Brainstorm — Type 1 Single ASIN (Plan B Storyboard default)

Khi pipeline pause với reason `aplus-concept-brainstorm-pending` cho brief có `aplus_type: "single"`, đọc file này.

## Vai trò
Senior Creative Strategist — extend Listing Concept Brainstormer sang A+ content. Apply doctrine HMA 3.0 Seduction Gate per module + shared constraints R1/R2/R3/R4.

## Quy trình

### Bước 1: Đọc brief + DD v2 art_direction
Reuse palette, typography anchors, cohesion_anchors từ Design Director v2 đã có cho listing. A+ PHẢI tone-consistent với listing (brand thread).

### Bước 2: Đọc `config/funnels/aplus-type1-single.json`
- Default = Plan B Storyboard (5 module)
- Mỗi module có `layout`, `visual_thread_bridge`, `ref_recipe`, `seduction_gate`, `typography_priority`
- Read `aplus-shared-constraints.json` để embed R1/R2/R3/R4 vào mọi prompt

### Bước 3: Read 8 FINAL listing images của SKU (nếu có)
**CRITICAL — A+ phải complement listing KHÔNG duplicate:**
- Listing slot 3 đã có FEATURES_SIZE → A+ M3 (Handcrafted Proof) tập trung CRAFTSMANSHIP macro, KHÔNG lặp lại callout list
- Listing slot 5 đã có DISPLAY_LOCATIONS grid → A+ M4 (Milestones) tập trung EMOTIONAL MOMENTS, KHÔNG lặp lại location rooms
- Reuse 1-2 headlines verbatim từ FINAL listing cho brand voice consistency

### Bước 4: Per-module concept synthesis
Cho mỗi module 1-5, fill content dựa trên:
- `layout` từ funnel JSON
- `seduction_gate` câu hỏi WHO/PAIN/HOOK/PROOF/FEEL ≥4/5 mỗi
- Brief content (product_name, features, dimensions, target_audience, etc.)
- Visual thread motif continuous xuyên 5 module (token trail, coral lines, rainbow arcs — chọn 1 motif system + lặp)

### Bước 5: Write result

Output file: `data/{SKU}/research/_aplus_concepts.json`

```json
{
  "aplus_type": "single",
  "plan_style": "B",
  "visual_thread_motif": "rainbow token dot trail + soft coral curve lines + star confetti",
  "typography_system": {
    "display": "Baloo 2 Bold",
    "accent_script": "Kalam"
  },
  "modules": {
    "m1": {
      "scene": "...full scene description spelling out layout...",
      "headline": "Reuse 'turns good behavior into a daily habit.' from FINAL listing slot 7",
      "subheadline_script": "a handmade reward jar — crafted in Vietnam, loved at home",
      "visual_thread_in": "rainbow arc top + confetti right",
      "visual_thread_out": "token dot trail diagonally down to M2",
      "ref_picks": ["hero_faceon", "tokens_topview"]
    },
    "m2": { "...": "..." },
    "m3": { "...": "..." },
    "m4": { "...": "..." },
    "m5": { "...": "..." }
  }
}
```

## Anti-patterns (DO NOT)
- Đừng viết M3 thành duplicate listing slot 5 "what's in the box"
- Đừng viết M4 thành duplicate listing slot 8 "display locations"
- Đừng bỏ visual thread motif — brand moat dựa vào nó
- Đừng chọn refs blanket cho mọi module — per-module R4
- Đừng dùng font thứ 3 — R1 lock 2 fonts
- Đừng để scale lệch R3 — product size anchor realistic
- Đừng reimagine product F1-F8 — R2 fidelity
- Đừng pain-then-relief negative imagery nếu FINAL listing 100% positive tone (brand clash)
- Đừng face visible nếu persona target hands-focused (check FINAL listing face policy)
