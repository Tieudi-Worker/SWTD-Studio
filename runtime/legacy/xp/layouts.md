# XP: Layouts

## Metadata
- Total entries: 12
- Last updated: 2026-04-10
- Top rule: Khi AI gen text trong ảnh, callout-graphics SVG ov

---

## Entry LOG
### XP-012 | 2026-04-10 | Score: 0/10 | SKU: TNTD180326i745
**Context:** slot5 size-scale dual-view
**What happened:** Dual-view layout (dimensioned flat on left + in-hand on right) generated cleanly in a single nano-banana-pro call
**Lesson:** Dual-view size-scale ('flat-with-dimensions + in-hand') is a single-shot winner for nano-banana-pro — no need to generate two images and composite them
**Rule:** slot5 → prompt a single image containing both the dimensioned flat view AND the in-hand view, with a bold PRODUCT SIZE header


### XP-011 | 2026-04-10 | Score: 0/10 | SKU: TNTD180326i745
**Context:** slot3 infographic with feature callouts
**What happened:** Single-generation infographic with product hero + 3 circular callouts came out clean and on-brand on nano-banana-pro
**Lesson:** For slot3 feature infographic, prompting 'product center-top, 3 circular detail shots arranged in arc below' reliably produces an Amazon-ready feature visual without needing post-composition
**Rule:** slot3 → always specify: product center-top + N circular callouts in arc + subtle themed watermark background

### XP-010 | 2026-04-06 | Score: 8.3/10 | SKU: TNTD180326i750
**Context:** slot8 — TNTD180326i750_slot8_lifestyle-close.jpg
**What happened:** slot8 scored 8.3
**Lesson:** Slot 8 grid concept from competitor analysis = direct insight application thành công


### XP-009 | 2026-04-06 | Score: 8.3/10 | SKU: TNTD180326i750
**Context:** slot8 — TNTD180326i750_slot8_lifestyle-close.jpg
**What happened:** slot8 scored 8.3
**Lesson:** Multi-scenario grid layout (2x3) là killer format cho multi-use products — show versatility instantly

### XP-008 | 2026-04-06 | Score: 8.3/10 | SKU: TNTD180326i750
**Context:** slot6 — TNTD180326i750_slot6_gift-set.jpg
**What happened:** slot6 scored 8.3
**Lesson:** Concept check 'if (concept)' thay vì 'if (concept?.layout)' fix Slot 6 fallback issue


### XP-007 | 2026-04-06 | Score: 8.9/10 | SKU: TNTD180326i750
**Context:** slot5 — TNTD180326i750_slot5_size-scale.jpg
**What happened:** slot5 scored 8.9
**Lesson:** Giữ Sharp.js composite làm fallback khi không có slot_concepts — vẫn cần cho products đơn giản

### XP-006 | 2026-04-06 | Score: 8.9/10 | SKU: TNTD180326i750
**Context:** slot5 — TNTD180326i750_slot5_size-scale.jpg
**What happened:** slot5 scored 8.9
**Lesson:** Component breakdown grid với quantity badges là must-have cho multi-piece products


### XP-005 | 2026-04-06 | Score: 8.9/10 | SKU: TNTD180326i750
**Context:** slot5 — TNTD180326i750_slot5_size-scale.jpg
**What happened:** slot5 scored 8.9
**Lesson:** AI gen cho Slot 5 khi có slot_concepts tạo infographic graphic đẹp hơn Sharp.js composite nhiều lần

### XP-004 | 2026-04-06 | Score: 8.15/10 | SKU: TNTD180326i750
**Context:** slot3 — TNTD180326i750_slot3_features.jpg
**What happened:** slot3 scored 8.15
**Lesson:** Khi AI gen text trong ảnh, callout-graphics SVG overlay bị conflict — cần logic skip overlay khi concept đã có text


### XP-003 | 2026-04-06 | Score: 8.15/10 | SKU: TNTD180326i750
**Context:** slot3 — TNTD180326i750_slot3_features.jpg
**What happened:** slot3 scored 8.15
**Lesson:** Slot 3 pastel bg + numbered cards + icons = layout modern hơn green circles truyền thống

### XP-002 | 2026-04-06 | Score: 8.15/10 | SKU: TNTD180326i750
**Context:** slot3 — TNTD180326i750_slot3_features.jpg
**What happened:** slot3 scored 8.15
**Lesson:** concept check phải dùng 'if (concept)' thay vì 'if (concept?.layout)' — tránh miss fields có tên khác


### XP-001 | 2026-04-06 | Score: 8.6/10 | SKU: TNTD180326i750
**Context:** slot2 — TNTD180326i750_slot2_in-use.jpg
**What happened:** slot2 scored 8.6
**Lesson:** slot_concepts.scene cụ thể (pastel walls, bookshelf, stuffed animals) tạo ra scene đúng target audience hơn generic 'cozy home'

---

## COMPILED RULES

### RULE-002: Khi AI gen text trong ảnh, callout-graphics SVG overlay bị c
- **Rule:** Khi AI gen text trong ảnh, callout-graphics SVG overlay bị conflict — cần logic skip overlay khi concept đã có text
- **Verified:** 5 times
- **Source entries:** XP-004, XP-187, XP-162, XP-151, XP-133

### RULE-001: Khi AI gen text trong ảnh, callout-graphics SVG overlay bị c
- **Rule:** Khi AI gen text trong ảnh, callout-graphics SVG overlay bị conflict — cần logic skip overlay khi concept đã có text
- **Verified:** 5 times
- **Source entries:** XP-004, XP-187, XP-162, XP-151, XP-133

