# Concept Brainstorm Prompt

Khi pipeline pause với reason `concept-brainstorm-pending`, đọc file này.

## Vai trò
Senior Creative Strategist áp dụng doctrine HMA 3.0 Seduction Gate.

## Quy trình

### Bước 1: Đọc art_direction từ DD v2
Mỗi concept phải tôn trọng style_reference + lighting_recipe + color_grading.

### Bước 2: Đọc funnel để biết role mỗi slot
Concept phải phục vụ intent của slot trong funnel. Không "đẹp nhưng sai chức năng".

### Bước 3: Brainstorm 3 concept variants per slot
Mỗi concept gồm:
- `scene` — không gian + setup (≤3 câu)
- `style` — photography style cue
- `hook_element` — 1 chi tiết visual bắt mắt 0.8s đầu
- `props` — 2-4 props từ cohesion_anchors.props
- `seduction_scores` — chấm WHO/PAIN/HOOK/PROOF/FEEL từ 1-5

### Bước 4: Score Seduction Gate
WHO/PAIN/HOOK/PROOF/FEEL — mỗi câu phải ≥4/5. Concept yếu loại, brainstorm thay thế.

### Bước 5: Pick best
Total score cao nhất → picked. Ghi vào `picked_concept` để pipeline đọc.

### Bước 6: Write result

```json
{
  "slot_concepts": {
    "slot1": {
      "concepts": [
        {
          "scene": "Pure white seamless backdrop with floor reflection. Product 3/4 angle.",
          "style": "Studio, soft top-down key, gentle rim from camera-right",
          "hook_element": "Warm rim light catching engraving depth",
          "props": [],
          "seduction_scores": { "WHO": 5, "PAIN": 4, "HOOK": 5, "PROOF": 5, "FEEL": 5 },
          "total": 24
        }
      ],
      "picked": 1,
      "picked_concept": {
        "scene": "Pure white seamless backdrop with floor reflection.",
        "style": "Studio, soft top-down key",
        "hook_element": "Warm rim light catching engraving depth"
      }
    },
    "slot2": "...",
    "slot3-slot8": "..."
  }
}
```

## Anti-patterns
- Đừng vi phạm art_direction (nếu DD nói "Kinfolk warm", đừng "moody dark")
- Đừng pick concept vì "đẹp" — phải pass Seduction Gate
- Đừng đặt props ngoài cohesion_anchors.props
- Đừng để 2 slot có hook_element trùng
- Đừng score khoan dung
- Đừng nhắm vulnerable state (acute grief, panic, late-night impulse) — vi phạm doctrine 3.0 ethics

---

## Fixed structural slots — DO NOT redesign layout, only fill content per SKU

2 slot có structure cố định bằng RULE-016 và RULE-017. Khi brainstorm concept cho slot 3 và slot 5, **không được đổi layout** — chỉ fill content phù hợp SKU.

### Slot 3 — FEATURES_SIZE combined infographic (LOCKED)
**Layout cố định:**
- Top full-width header banner (accent color) với small product-category icon bên trái + uppercase title chữ trắng centered
- Bên trái dưới banner: product rendered LỚN với dimension arrows (horizontal width arrow + vertical height arrow + small circular thickness/depth callout bubble)
- Bên phải dưới banner: column 4 rounded-square white callout cards với accent-color numbered headers (01-04), mỗi card có macro crop + 2-line label

**Job của bạn (fill content per SKU):**
- Pick banner headline ≤60 ký tự, phản ánh category + occasion (ví dụ: "CLASS OF 2026 GRADUATION KEEPSAKE", "HAND-POURED SOY CANDLE", "HANDMADE CERAMIC MUG", "PREMIUM WOODEN COASTER SET")
- Pick 2 accent colors từ `art_direction.color_anchors` (một cho banner, một cho numbered headers — thường là anchor chính)
- Pick 4 features quan trọng nhất từ `brief.features` + `product_observations.frozen_elements` để làm callout cards (ví dụ: material quality, construction layers, unique detail, ready-to-use/gift packaging)
- Fill actual dimension values từ `brief.dimensions` vào arrows (width, height, thickness)

**Output format:** picked_concept.scene cho slot 3 mô tả đầy đủ banner text + accent colors + 4 callout specs — KHÔNG viết "use standard layout", phải spell out đủ content.

### Slot 5 — DISPLAY_LOCATIONS grid (LOCKED)
**Layout cố định:**
- Top header với uppercase title accent color + italic subtitle
- Body: 2×2 grid của N cells (default 4, adaptive 2-4 theo niche) — rounded-square cells, một product instance per cell, mỗi cell là một display/use scenario khác nhau
- Labels: small accent-color circular numbered labels (01, 02, ...) top-left mỗi cell + bold accent-color label bar bottom-left với tiny matching icon
- Safeguard tuyệt đối: KHÔNG fifth floating product, KHÔNG hero product ở center giữa cells, KHÔNG element overlap giữa cells

**Job của bạn (fill content per SKU):**
- Pick N (2-4) số cells — default 4 nếu niche có đủ scenario, giảm xuống 2-3 nếu không tự nhiên ép đủ
- Pick header title phù hợp niche: "DECORATE ANYWHERE" / "DISPLAY ANYWHERE" / "STYLE ANYWHERE" / "USE ANYWHERE" / "GIFT ANYWHERE"
- Pick N display/use scenarios phù hợp product niche:
  - Hanging ornament → Wall Hook / Shelf / Photo Frame / Dresser
  - Jar / candle / diffuser → Kitchen Counter / Bathroom / Bedside / Office Desk
  - Mug / tumbler → Office Desk / Kitchen Shelf / Coffee Bar / Gift Wrapped
  - Greeting / plant card → Envelope / Desk / Photo Frame / Pinboard
  - Wall art / frame → Living Room Wall / Gallery Wall / Over Fireplace / Office
  - Coaster / tray → Coffee Table / Dining / Kitchen Island / Side Table
- Pick accent color từ `art_direction.color_anchors`

**Output format:** picked_concept.scene cho slot 5 BẮT BUỘC chứa phrase "EXACTLY N cells, one product per cell, NO fifth floating product, labels unobstructed" — safeguard phrases sẽ cũng được auto-inject bởi prompt-guard, nhưng concept phải viết rõ từ đầu.
