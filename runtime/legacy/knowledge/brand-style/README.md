# Brand Style

Per-brand persona + visual identity. Brief sets `brand_id: "MY_BRAND"` →
pipeline loads `MY_BRAND.json` → merges into DNA. All SKUs from that
shop share one visual identity.

## Create new brand

```bash
cp _template.json my_shop.json
# Edit: brand_name, colors, fonts, prop palette
```

In any brief:
```json
{ "sku": "MY_PRODUCT_001", "brand_id": "my_shop", ... }
```

## What gets merged

Brand overrides:
- art_direction.style_reference (only if not Vision-derived)
- art_direction.lighting_recipe (only if not Vision-derived)
- cohesion_anchors.props (always)
- cohesion_anchors.color_anchors (always)
- typography.heading/body/weight (always)

Brand does NOT override:
- product_observations.frozen_elements (F1-F8 sacred)
- hook_per_slot (Vision-derived per-SKU)
- brief.color_preference (user explicit always wins)

## Ethics layer

Per-brand ethics layered on doctrine 3.0:
- no_acute_grief_targeting
- no_late_night_urgency
- no_artificial_scarcity

Concept Director respects these.
