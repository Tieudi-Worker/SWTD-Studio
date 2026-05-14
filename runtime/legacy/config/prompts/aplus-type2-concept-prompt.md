# A+ Content Concept Brainstorm — Type 2 Multi-ASIN Parent (Plan A Modular default)

Khi pipeline pause với reason `aplus-concept-brainstorm-pending` cho brief có `aplus_type: "multi_asin"`, đọc file này.

## Vai trò
Senior Creative Strategist cho **parent ASIN** chứa N child products. Bán VARIETY + RIGHT-FIT + BUNDLE thay vì single-product depth.

## Critical differences vs Type 1

| Aspect | Type 1 single | Type 2 multi-ASIN |
|---|---|---|
| Scope | 1 product deep-dive | N products family showcase |
| Module intent | Story + depth | Variety + comparison + decision |
| Refs | 1 SKU catalog | Hierarchical — N child catalogs |
| Fidelity enforcement | F1-F8 × 1 product | F1-F8 × N products (parallel) |
| Primary copy angle | "Why THIS?" | "Which one fits you?" + "Buy the set" |
| Visual cohesion challenge | Single thread motif | Multi-product visual rhythm across modules |

## Quy trình

### Bước 1: Đọc parent brief + child ASIN catalogs
Brief bắt buộc có:
- `parent_asin_id` — string identifier
- `child_asins[]` — array N children, mỗi child có `sku`, `role`, `display_name`, `ref_catalog`, `primary_use_case`, `target_age`
- `aplus_type: "multi_asin"`

Validate: N ≥ 2. Nếu N = 1 → fallback Type 1 template.

### Bước 2: Đọc `config/funnels/aplus-type2-multi-asin.json`
- Default = Plan A Modular (5 module comparison-focused)
- Module 1 Collection Hero, Module 3 Product Matrix, Module 4 Decision Guide = signature của Type 2
- Embed R1/R2/R3/R4 từ `aplus-shared-constraints.json`

### Bước 3: Cross-child Design Director synthesis
Không mỗi child có DD riêng — Vision DD phải sinh ra **parent-level art_direction** bao quát cả N children:
- Palette: màu đồng nhất cho umbrella (có thể lấy từ best-seller child), mỗi child có accent color riêng
- Typography: 2-font system R1 áp dụng parent-level, consistent mọi module
- Cohesion props: shared props xuyên N products (shared surface material, shared lighting)
- Unified mood descriptor: 1 câu mô tả umbrella feel

### Bước 4: Per-module concept synthesis

**Module 1 Collection Hero:**
- Pick hero composition: flat-lay all N products on shared warm surface, OR standing together
- Ensure MỖI product F1-F8 preserved (prompt liệt kê từng SKU + frozen elements)
- Scale R3: mỗi product đúng size thực tế, RELATIVE size giữa N products cũng chính xác (jar 6x8in > thẻ 3x5in)

**Module 2 Shared Pain / Unified Promise:**
- Pain statement áp dụng cả N products (umbrella pain, e.g. "raising confident kids")
- Right panel: pick 1-2 products đại diện (thường best-seller)

**Module 3 Product Matrix (CRITICAL):**
- Grid N cells, mỗi cell 1 product
- Mỗi cell prompt riêng biệt — spell out product-specific frozen elements
- Same photo angle + lighting across N cells để so sánh dễ (all `hero_faceon` refs)
- 3-line spec per cell: size / use-case / age

**Module 4 Decision Guide:**
- 3-4 persona scenarios matching to products
- Persona quote Calligraphy italic + arrow → Baloo product recommendation
- Thumbnails refs của products được recommend

**Module 5 Collection CTA:**
- Gift-ready flat lay with 2-3 products together (showing collection diversity)
- Dual CTA: "Shop The Collection →" + "Start With Best-Seller →"

### Bước 5: Write result

Output file: `data/{PARENT_ASIN}/research/_aplus_concepts.json`

```json
{
  "aplus_type": "multi_asin",
  "plan_style": "A",
  "parent_asin_id": "WOODEN_REWARD_COLLECTION",
  "child_asins": ["TNTD180326i750", "TNTD180326i751", "TNTD180326i752"],
  "parent_art_direction": {
    "palette": ["#1B3A6F", "#E9DCC5", "#F4735F"],
    "typography": { "display": "Baloo 2 Bold", "accent_script": "Kalam" },
    "shared_props": ["warm oak surface", "soft pastel backdrop"],
    "mood": "joyful, encouraging, family-scale handmade"
  },
  "modules": {
    "m1": {
      "scene": "...collection hero flat-lay all N products with F1-F8 per product spelled out...",
      "headline": "...parent brand headline...",
      "ref_picks_per_product": {
        "TNTD180326i750": ["hero_faceon"],
        "TNTD180326i751": ["hero_faceon"],
        "TNTD180326i752": ["hero_faceon"]
      }
    },
    "m3_product_matrix": {
      "grid_layout": "2x2",
      "cells": [
        {
          "cell_id": "01",
          "sku": "TNTD180326i750",
          "ref_picks": ["hero_faceon"],
          "label": "Magnetic Reward Jar",
          "specs": ["6×8 in", "daily behavior tracking", "age 4-7"]
        }
      ]
    }
  }
}
```

## Anti-patterns Type 2 (DO NOT)

- Đừng dùng 1 ref catalog chung cho N products — hierarchical per-child required
- Đừng để products lệch scale giữa panels M3 matrix — R3 phải relative-accurate
- Đừng viết module chỉ bán 1 child ASIN ưu tiên — brand parent-level
- Đừng quên Module 4 Decision Guide — đây là signature Type 2, không phải listing replication
- Đừng ép visual thread motif single-product style (M4 milestones ribbon có thể không fit)
- Đừng single Seduction Gate cho cả N — mỗi persona M4 có WHO/PAIN riêng
