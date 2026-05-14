# CLAUDE.md

File này cung cấp hướng dẫn cho Claude Code (claude.ai/code) khi làm việc với code trong repository này.

**Luôn trả lời bằng tiếng Việt Nam. Các từ ngữ tiếng Anh chuyên ngành (tên file, tên biến, tên lệnh, thuật ngữ kỹ thuật) giữ nguyên. Chỉ trả lời bằng tiếng Anh khi người dùng yêu cầu rõ ràng.**

# HANDMADE MEDIA AGENT v2.3.0

## Tổng quan
Stateless agent tự động tạo media cho Amazon US listing. Nhận path SKU folder → xử lý → output → rời đi. Mọi data SKU nằm ngoài agent.

## Output mỗi SKU
- 8 ảnh listing (2000x2000px JPG)
- 5 module A+ Premium (1464x600px JPG)
- Video storyboard + Kling prompts (20–25 giây)

## Kiến trúc — Agent vs Data tách biệt

```
d:\AI PROJECT\handmade-media-agent-v0\
├── handmade-media-agent/                ← AGENT (code only, stateless)
│   ├── agents/                          — Pipeline agents (master, directref, aplus, video, research, xp...)
│   ├── utils/                           — Helpers (paths.js, kie-client, image-utils, prompt-guard...)
│   ├── config/                          — Global config (image-specs, prompts, research-config)
│   ├── knowledge/                       — Global knowledge base (cross-SKU learning)
│   ├── xp/                              — XP learning logs (cross-SKU)
│   ├── references/theme-packs/          — Seasonal themes (graduation, christmas...)
│   ├── scripts/                         — Migration, precheck, utilities
│   └── tests/                           — Unit tests
│
└── data/                                ← DATA (external, per-SKU)
    └── {SKU}/
        ├── input/
        │   ├── product/                 ← ảnh sản phẩm (BẮT BUỘC) → gửi API làm reference
        │   ├── listing-ref/             ← template listing đối thủ (TÙY CHỌN) → design inspiration
        │   ├── aplus-ref/               ← template A+ đối thủ (TÙY CHỌN) → A+ inspiration
        │   └── video-ref/               ← template video đối thủ (TÙY CHỌN) → video inspiration
        ├── brief.json                   ← HMA auto-generate hoặc user edit
        ├── output/
        │   ├── listing/                 — 8 slot JPG (2000x2000)
        │   ├── aplus/                   — 5 module JPG (1464x600)
        │   └── video/                   — Storyboard + video
        └── research/
            ├── _analysis.json           — Vision analysis
            ├── _design-dna.json         — Design DNA cho SKU này
            ├── _web_research.json       — Web research results
            └── .kie-upload-cache.json   — Upload cache
```

### Data routing quan trọng
| Folder | Gửi API? | Dùng cho |
|--------|----------|----------|
| `input/product/` | **YES** — `image_input` | Reference images cho nano-banana-pro (chỉ product shots sạch) |
| `input/listing-ref/` | **NO** | Design Director phân tích → ảnh hưởng prompt concepts |
| `input/aplus-ref/` | **NO** | A+ pipeline → layout/style inspiration |
| `input/video-ref/` | **NO** | Video producer → storyboard style |

### Agent modules
```
utils/paths.js               — Centralized path resolver (agentRoot, createSkuContext, configDir...)
agents/master.js             — Điều phối pipeline chính (orchestrator + CLI, hỗ trợ folder mode)
agents/directref-pipeline.js — 8 slot listing (AI generate → ensureSize)
agents/aplus-pipeline.js     — 5 module A+ Premium (prompt + text builders)
agents/research-agent.js     — Hỗ trợ làm giàu brief (Claude Code Vision workflow)
agents/auto-research.js      — Phân tích từ khóa + tự động phân loại (không cần API)
agents/knowledge-agent.js    — Quản lý cơ sở tri thức (Claude Code research workflow)
agents/xp-agent.js           — Chấm điểm QC, ghi log XP, tổng hợp quy tắc (tự học)
agents/design-director.js    — Design DNA + negative_prompt_extra support
agents/image-generator.js    — Tạo prompt AI + gọi KIE.ai (Prompt Guard enforced)
agents/product-renderer.js   — Ảnh thật → AI render → bộ 6 góc render
agents/video-producer.js     — Storyboard + Kling video
utils/pipeline-helpers.js    — scanInputFolder (auto-detect layout), generateBriefFromFolder
```

## Quy tắc quan trọng
- **BẮT BUỘC ĐỌC DOCTRINE TRƯỚC TIÊN:** Trước khi thực hiện bất kỳ công việc nào liên quan đến draft prompt, sửa logic, hay lên concept, BẠN PHẢI ĐỌC file `knowledge/doctrine/handmade-product-doctrine.md`. File này là Hiến pháp định hướng tư duy của toàn bộ hệ thống.
- Mọi slot: AI generate ảnh hoàn chỉnh (có product) → ensureSize → done
- Slot 4: use case theo danh mục + chống thương hiệu (không logo/nhãn hiệu)
- Tất cả output PHẢI đúng kích thước specs (2000x2000 listing, 1464x600 A+)
- Prompt PHẢI nhắc kích thước thật sản phẩm để AI render đúng tỉ lệ
- Tránh từ nhạy cảm trong prompt (student/child + teacher/adult → bị Google filter)
- **BẮT BUỘC — Phân tích kết cấu reference image trước khi gen:** Với mọi SKU có multi-layer, through-cut, cavity, insert, hoặc decorative layer, PHẢI đọc reference image theo checklist trong `knowledge/photography/product-structure-analysis.md` và điền `product_structure` + `see_through_cutout_rule` (nếu áp dụng) + `critical_structure` cho từng slot liên quan TRƯỚC khi pipeline chạy. Bỏ qua bước này → AI sẽ default về statistical average và phá vỡ USP (xem case study XP-003).

## Quy tắc từ XP (Tự học — compiled từ 6 SKU, 207 entries)
- Prompt PHẢI nhắc kích thước thật (VD: "4x3 inches, credit-card sized") để AI render đúng tỉ lệ
- Slot 5: Nên có 2 góc nhìn (front + 3/4 angle) cho size infographic
- Slot 6 flat lay: product phải chiếm >=30% diện tích trung tâm ảnh
- Slot 8 lifestyle: ưu tiên cảnh tay cầm product trên bàn (hero shot) — avg 9.0/10
- Slot 1: nền trắng sạch luôn đạt điểm cao (avg 9.1/10)
- Sản phẩm "teacher gift": tránh prompt có "student/child giving teacher" → dùng "person/colleague" thay thế

## Các Slot Listing
| Slot | Vai trò | Phương pháp |
|------|---------|-------------|
| 1 Ảnh chính | DỪNG LẠI | AI generate product trên nền trắng → ensureSize |
| 2 Đang sử dụng | THÔNG TIN | AI generate scene + product → ensureSize |
| 3 Tính năng | KHAO KHÁT | AI generate infographic layout → ensureSize |
| 4 Trường hợp sử dụng | THÔNG TIN | AI generate use case + chống thương hiệu → ensureSize |
| 5 Kích thước | TIN CẬY | AI generate size reference + dimensions → ensureSize |
| 6 Bộ quà tặng | KHAO KHÁT | AI generate flat lay → ensureSize |
| 7 Cảm xúc | GIÁ TRỊ | AI generate cảnh tặng quà → ensureSize |
| 8 Phong cách sống | CHỐT | AI generate lifestyle scene → ensureSize |

## Cách chạy
```bash
# ═══ NEW MODE (khuyến khích) — truyền folder SKU ═══
# Precheck trước pipeline
node scripts/precheck-prompts.js ../data/[SKU]           # Offline validate 8 slot prompts
node scripts/precheck-prompts.js ../data/[SKU] -v        # Verbose

# Pipeline
node agents/master.js ../data/[SKU]                      # Pipeline đầy đủ
node agents/master.js ../data/[SKU] --only listing       # Chỉ listing
node agents/master.js ../data/[SKU] --only aplus         # Chỉ A+
node agents/master.js ../data/[SKU] --only video         # Chỉ video
node agents/master.js ../data/[SKU] --dry-run            # Chạy thử cấu hình
node agents/master.js ../data/[SKU] --no-web-research    # Skip web research
node agents/master.js ../data/[SKU] --qc                 # Pipeline + quét QC

# Batch — chạy tất cả SKU trong data/
node run-batch.js ../data/                               # Batch tất cả SKU
node run-batch.js ../data/ --only listing                # Batch chỉ listing

# ═══ LEGACY MODE (backward compat) — truyền brief .json ═══
node agents/master.js briefs/[sku].json                  # Pipeline đầy đủ
node agents/master.js briefs/[sku].json --only listing   # Chỉ listing

# Iteration thông minh — chỉ regen slot/module cần fix, giữ nguyên các cái khác
node agents/master.js ../data/[SKU] --skip-slots slot2,slot4         # Xoá slot2+slot4 khỏi checkpoint + regen
node agents/master.js ../data/[SKU] --skip-slots aplus_m1            # Chỉ regen A+ module 1
node agents/master.js ../data/[SKU] --skip-slots slot1,slot4,aplus_m5  # Mix listing + A+

# Research Agent chạy độc lập
node agents/research-agent.js briefs/[sku].json --scan       # Liệt kê file tham chiếu
node agents/research-agent.js briefs/[sku].json --enrich     # Tự động điền brief từ _analysis.json
node agents/research-agent.js briefs/[sku].json --validate   # Kiểm tra brief đầy đủ
node agents/research-agent.js briefs/[sku].json --full       # Scan + enrich
node agents/research-agent.js --organize <folder> --analysis <path>  # Sắp xếp ảnh

# XP Agent (tự học)
node agents/xp-agent.js scan --sku [SKU]                 # Liệt kê file output để QC
node agents/xp-agent.js qc --sku [SKU]                   # QC đầy đủ (scan + hướng dẫn review)
node agents/xp-agent.js log --sku [SKU] --scores <path>  # Ghi XP từ scorecard
node agents/xp-agent.js compile                           # Tìm mẫu lặp → đề xuất quy tắc
node agents/xp-agent.js apply-rules                       # Áp dụng quy tắc đã tổng hợp vào CLAUDE.md
node agents/xp-agent.js report --sku [SKU]                # Tạo báo cáo QC
node agents/xp-agent.js stats                             # Tổng quan hệ thống XP
```

## Iteration Discipline (QUAN TRỌNG — tiết kiệm credits)

Mỗi lần iterate trên 1 SKU, **KHÔNG rerun cả 8 slot**. Pipeline lưu `_progress.json` → lần chạy sau tự skip slot đã hoàn thành. Để regen slot cụ thể:

1. **Cách mới (khuyến khích):** Dùng `--skip-slots`:
   ```bash
   node agents/master.js briefs/[sku].json --skip-slots slot2,slot4
   ```
   → Tự xoá entry trong `_progress.json` + xoá file output cũ + regen chỉ 2 slot đó.

2. **Cách cũ (manual):** Xoá file JPG + edit `_progress.json` tay. KHÔNG khuyến khích — dễ sai, không ai nhớ syntax.

3. **Workflow điển hình khi fix regression:**
   - QC review bằng `xp-agent.js qc` → xác định slot fail
   - Update prompt/constraints/anti-patterns nếu cần
   - `--skip-slots <failed-slots>` → regen chỉ slot fail
   - QC lại → log XP

**Lý do:** Mỗi slot = 1 lần gọi KIE API. 8 slot × N iterations × M SKU = credits burn rất nhanh. Single-slot regen giảm ~60-80% credits chu kỳ iteration.

## Độ tin cậy & Quan sát (v2.1)
- **Checkpoint/Tiếp tục**: Pipeline lưu `_progress.json` mỗi thư mục output. Lỗi → khởi động lại → tự động bỏ qua slot/module đã hoàn thành. Dùng `--skip-slots` để force regen cụ thể.
- **Retry thông minh (v2.2.1 — doubled)**: KIE client phân loại lỗi — tạm thời (timeout, 5xx, 429, mạng) thử lại với jitter; vĩnh viễn (400, 401, không hợp lệ) dừng ngay. `retryMax = 6` (tăng từ 3), delays `[4s,8s,12s,16s,20s,24s]`. Poll timeout: image 10 phút, video 20 phút, fast 6 phút (tất cả doubled từ v2.1).
- **Timeout fetch (v2.2.1 — doubled)**: Mỗi API call có timeout 60 giây (upload 120 giây) qua AbortController. Không còn treo vô hạn.
- **Timeout pipeline**: Giới hạn toàn cục 30 phút (cấu hình qua `options.timeoutMs`). Tự động dọn dẹp khi hết thời gian.
- **Log có cấu trúc**: `LOG_LEVEL=info|debug|warn|error`, `LOG_FILE=path` cho output JSON. SKU correlation ID trên mỗi dòng log.
- **sharp.cache(false)**: Ngăn lỗi khóa file EBUSY/EPERM trên Windows.
- **Kiểm tra khởi động**: Thiếu KIE_KEY → thoát ngay với lỗi rõ ràng (không lỗi thầm lặng).
- **Cảnh báo theme**: Thiếu theme pack → cảnh báo rõ ràng với gợi ý tạo file.
- **Kiểm tra ref**: 0 ảnh listing ref cho A+/Video → cảnh báo với danh sách slot lỗi.

## Tính năng Production (v2.1.0)
- **Kiểm tra brief**: Kiểm tra schema trước khi pipeline chạy — trường bắt buộc/khuyến nghị, kiểm tra kiểu, thông báo lỗi cụ thể.
- **Mẫu prompt**: `config/prompts/slot-prompts.json` — chỉnh sửa cảnh cảm xúc, tiêu đề, trường hợp sử dụng, môi trường mà không cần sửa code.
- **Tắt máy an toàn**: SIGINT/SIGTERM → dọn dẹp file tạm, thoát với mã đúng (130/143).
- **Chạy hàng loạt**: `node run-batch.js briefs/*.json` — tuần tự nhiều SKU, tiến trình con cách ly, timeout mỗi SKU (40 phút), báo cáo tổng hợp.

## Test & CI
```bash
npm test          # Unit tests (node:test)
npm run lint      # Kiểm tra cú pháp tất cả file source
npm run batch     # Chạy hàng loạt nhiều SKU
```
- GitHub Actions: chạy trên Node 18/20/22 + kiểm tra Docker build trên nhánh main.
- Docker: `docker build -t handmade-media-agent .` → triển khai di động với Sharp/libvips đã cấu hình.

## API: KIE.ai
- Tạo ảnh: nano-banana-2 (tham chiếu sản phẩm qua image_input)
- Video: kling-3.0/video (theo hàng đợi)
- Xác thực: KIE_KEY trong config/api-keys.env

## Brief JSON
Bắt buộc: `sku`, `product_name`, `category`, `materials`, `features`, `occasion`, `input_images`, `dimensions`
Tùy chọn: `slot8_text`, `slot8_type`, `quantity`, `use_case_description`, `force_text_overlay`, `color_preference`, `copy_style`
Tự động làm giàu được: `features`, `usp`, `target_audience`, `feature_details`, `headline_text`, `subheadline_text`, `color_preference`, `copy_style`
Danh mục: `mixed` | `wood_ornament` | `acrylic_ornament` | `paper_card` | `jar` | `frame`

## Quy trình Research Agent
1. Thêm `reference_folder` vào brief JSON trỏ đến thư mục dữ liệu đối thủ
2. `--scan` liệt kê file, tạo `_analysis_template.json`
3. Claude Code xem từng ảnh đối thủ (Vision), điền vào `_analysis.json`
4. `--enrich` đọc analysis + mặc định danh mục → tự động điền các trường trống của brief
5. `--organize` sắp xếp ảnh đối thủ vào các thư mục con theo loại
6. Brief được đánh dấu `enriched: true` → pipeline chạy bình thường

## Web Research (v2.2.3 — MCP-powered)
Tìm kiếm web tự động qua Claude Code MCP tools (firecrawl/exa) — $0 chi phí thêm.

### Quy trình `--web-research`
```
Lần 1: node agents/master.js briefs/[sku].json --web-research
  → Tạo _web_research_queries.json (4-5 search queries từ brief)
  → PAUSE — in hướng dẫn cho Claude Code

Claude Code thực hiện:
  1. Đọc _web_research_queries.json
  2. Chạy từng query bằng firecrawl_search hoặc web_search_exa
  3. Scrape top results bằng firecrawl_scrape hoặc crawling_exa
  4. Lưu kết quả vào _web_research.json

Lần 2: node agents/master.js briefs/[sku].json --web-research
  → Detect _web_research.json → auto-merge vào brief
  → Pipeline tiếp tục gen ảnh bình thường
```

### Dữ liệu web research thêm vào brief
| Trường | Nguồn | Mô tả |
|--------|-------|-------|
| `market_context` | competitor_listings | Giá đối thủ, rating, features phổ biến |
| `seo_keywords` | trending_keywords | Keywords trending + related terms |
| `photography_hints` | photography_trends | Photo styles, layout trends cho design |
| `buyer_insights` | buyer_context | Động lực mua, kỳ vọng giá, sở thích |
| `niche_insights` | niche_insights | Market size hint, xu hướng, mùa peak |

### Kết hợp với --research
```bash
# Chỉ web research
node agents/master.js briefs/[sku].json --web-research

# Web research + competitor analysis (đầy đủ nhất)
node agents/master.js briefs/[sku].json --web-research --research

# Chỉ competitor analysis (không cần web)
node agents/master.js briefs/[sku].json --research
```

### Format _web_research.json (Claude Code tạo)
```json
{
  "results": {
    "competitor_listings": {
      "source_urls": ["https://..."],
      "findings": { "prices": ["$12.99", "$15.99"], "avg_rating": 4.5, "common_features": [...] }
    },
    "trending_keywords": {
      "source_urls": ["https://..."],
      "findings": { "keywords": [...], "related_terms": [...] }
    }
  }
}
```

## XP Agent (Tự học)
Quy trình QC sau mỗi lần chạy pipeline — Claude Code Vision review output, chấm điểm, ghi bài học.
1. `scan` hoặc `qc` liệt kê file output để Claude Code review
2. Claude Code xem từng ảnh (Vision), chấm điểm theo `xp/_scoring-rubric.md`
3. Claude Code tạo scorecard.json với điểm + bài học mỗi ảnh
4. `log` ghi thêm XP vào file chủ đề (prompts/materials/lifestyle/v.v.)
5. Sau 5+ SKU: `compile` tìm bài học lặp lại (3+) → đề xuất quy tắc
6. `apply-rules` thêm quy tắc đã tổng hợp vào CLAUDE.md (cần xác nhận người dùng)
- File XP: `xp/*.md` — 10 chủ đề + _index.md + _scoring-rubric.md
- Scorecard: `output/[SKU]/scorecard.json`
- Ngưỡng: >=7.0 ĐẠT, <7.0 CẦN CẢI THIỆN, <5.0 LÀM LẠI

## Hệ thống Tri thức (v2.2.2 — auto-activated)
Cơ sở tri thức bên ngoài do Claude Code nghiên cứu — không cần API thêm. **Từ v2.2.2: pipeline TỰ ĐỘNG đọc knowledge base trên mỗi lần chạy, không cần flag nào cả.**
```
knowledge/
├── _index.json              — Index tự động tạo của tất cả mục
├── _summary.json            — Tóm tắt cho pipeline (AUTO-GEN trên startup bởi knowledge-loader.js)
├── amazon-listing/          — Quy tắc ảnh Amazon, chiến thuật chuyển đổi
├── photography/             — Kỹ thuật chụp ảnh sản phẩm
├── competitors/             — Tóm tắt phân tích đối thủ
└── niches/                  — Thông tin chi tiết theo danh mục (ornament, jar, v.v.)
```

### Quy trình (Claude Code thực hiện nghiên cứu)
```bash
# 1. Thêm chủ đề
node agents/knowledge-agent.js --add niches "teacher gifts"

# 2. Yêu cầu Claude Code nghiên cứu (không cần API — dùng WebSearch/WebFetch)
#    "Nghiên cứu teacher gifts trên Amazon và cập nhật knowledge/niches/teacher-gifts.md"

# 3. Tạo tóm tắt cho pipeline
node agents/knowledge-agent.js --summary

# 4. Xuất quy tắc sang research-config.json
node agents/knowledge-agent.js --export

# 5. Pipeline tự động đọc tri thức khi làm giàu brief
node agents/research-agent.js briefs/[sku].json --enrich
```

### Các lệnh
```bash
node agents/knowledge-agent.js --list              # Liệt kê tất cả mục tri thức
node agents/knowledge-agent.js --add <cat> <topic>  # Tạo file chủ đề mới
node agents/knowledge-agent.js --search <keyword>   # Tìm kiếm cơ sở tri thức
node agents/knowledge-agent.js --summary            # Tạo _summary.json
node agents/knowledge-agent.js --export             # Xuất sang research-config.json
node agents/knowledge-agent.js --stats              # Tổng quan thống kê
node agents/knowledge-agent.js --validate           # Kiểm tra file cũ/trống
```

### Cách tri thức chảy vào pipeline (v2.2.2 flow)
1. Claude Code nghiên cứu → điền vào `knowledge/<category>/<topic>.md`
2. **Mỗi lần** `master.js` chạy, `utils/knowledge-loader.js` tự:
   - Check `_summary.json` missing hoặc stale (< newest .md mtime) → auto-regen bằng `knowledge-agent.generateSummary()`
   - Đọc summary + attach vào brief (non-destructive, không ghi đè user override):
     - `knowledge_insights` — niche-specific từ `category_insights[category]`
     - `knowledge_photography_tips` — từ category `photography/`
     - `knowledge_conversion_tactics` — từ category `amazon-listing/`
     - `knowledge_rules` — rules hành động chung từ mọi file
   - Warn nếu knowledge base < 30% filled (nhắc fill thêm)
3. `design-director.js` đọc brief.knowledge_* → gắn vào `dna.knowledgeHints` (soft influence data)
4. `image-generator.js._finalizePrompt()` gọi `_knowledgeTipFor(slotNumber)`:
   - Pick ≤1 tip ngắn (≤12 từ) liên quan slot
   - Append vào prompt TRƯỚC khi `promptGuard.sanitize()`
   - Prompt Guard enforce max_words → nếu tip làm vượt limit sẽ log violation
   - **An toàn với RULE-015** (text dominance): upper bound cứng qua slot-constraints.json

**Không cần flag `--research`** để knowledge flow. Research Agent chỉ cần khi muốn enrich brief từ competitor analysis, còn knowledge base tự đọc độc lập.

## ECC Enhancements (Everything Claude Code)

### Slash Commands
| Lệnh | Mô tả |
|------|-------|
| `/plan` | Lập kế hoạch trước khi code — phân tích yêu cầu, đánh giá rủi ro, đợi xác nhận |
| `/verify` | Kiểm tra toàn diện: lint + test + console.log + secrets + validator |
| `/save-session` | Lưu trạng thái phiên làm việc để tiếp tục sau |
| `/resume-session` | Tải phiên trước và tiếp tục từ chỗ đang dở |
| `/qc <SKU>` | Chạy XP Agent QC scan cho output của 1 SKU |
| `/run-sku <SKU>` | Chạy pipeline đầy đủ với QC tự động |
| `/enrich <SKU>` | Làm giàu brief từ analysis + knowledge base |

### Hooks tự động
- **Syntax check** (PostToolUse): Sau mỗi lần sửa file `.js`, tự động chạy `node -c` để bắt lỗi cú pháp
- **Console.log warning** (PostToolUse): Cảnh báo nếu thêm `console.log` — dùng `utils/logger.js` (Pino) thay thế
- **File size guard** (PreToolUse): Chặn tạo file quá 800 dòng — tách thành module nhỏ hơn

### Skills
- **verification-loop**: Quy trình kiểm tra Node.js — build/lint/test/security

### Quy trình khuyến nghị
1. Trước khi code lớn: `/plan`
2. Sau khi code xong: `/verify`
3. Trước khi kết thúc phiên dài: `/save-session`
4. Bắt đầu phiên mới: `/resume-session`

## Prompt Guard System (v2.2.0 — bổ sung 2026-04-11)

Hệ thống ngăn Claude lặp lại lỗi inject quá nhiều text description vào direct-ref prompt — nguyên nhân chính của fidelity drift. **BẮT BUỘC ĐỌC** trước khi làm bất kỳ công việc prompt-engineering nào trên HMA.

### Bối cảnh: tại sao cần Prompt Guard?

Direct-ref mode của KIE.ai nano-banana-pro hoạt động theo nguyên lý: reference images carry product identity, prompt text describes scene only. Khi prompt text vượt quá một ngưỡng (~500 từ mô tả product), **text dominance** kích hoạt — model ưu tiên text > reference image → product bị reimagine thay vì copy. Kết quả: sai proportions, sai layout, sai letter sizes, sai vị trí các element. Verified bằng SKU TNTD250326i769(2): prompt ~2000 từ → product reimagined; prompt ~60 từ + strong fidelity guard → pixel-perfect.

### Kiến trúc 4 lớp

1. **`xp/prompt-anti-patterns.md`** — knowledge file người đọc được. Liệt kê universal anti-patterns + per-slot anti-patterns + conversation-learned lessons. ĐỌC TRƯỚC khi draft prompt mới.

2. **`config/prompts/slot-constraints.json`** — machine-readable config. Mỗi slot có max_words, inject flags (`inject_see_through_rule`, `inject_lighting_harmony_rule`, `inject_product_structure`, `inject_critical_structure`), forbidden_phrases_extra, fallback_flux_kontext, reasoning.

3. **`utils/prompt-guard.js`** — runtime sanitizer:
   - `shouldInject(field, slotNumber)` — gate các text block
   - `sanitize(prompt, slotNumber)` — scrub forbidden phrases, log violations
   - `fallbackFluxKontext(slotNumber)` — check slot có dùng Flux Kontext Pro fallback

4. **`agents/image-generator.js`** — integrate:
   - `_structureRules(brief, concept, slotNumber)` dùng `shouldInject()` để gate rules
   - `_finalizePrompt(prompt, slotNumber)` chạy `promptGuard.sanitize()` trước khi return
   - `_fidelityGuard()` là block ~80 từ nhấn mạnh "reproduce EXACTLY, do NOT redesign"

### Model priority
- **Primary:** nano-banana-pro (Google) cho mọi slot
- **Fallback (option 2):** Flux Kontext Pro — img-to-img editing, dùng khi nano-banana output fail QC. Không replace, chỉ fallback.

### Per-slot inject strategy
| Slot | Role | see_through | lighting_harmony | product_structure | Max words |
|------|------|-------------|------------------|-------------------|-----------|
| 1 | Hero white | ❌ | ❌ | ❌ | 80 |
| 2 | Lifestyle wide | ❌ | ❌ | ❌ | 120 |
| 3 | Infographic features | ❌ | ❌ | ✅ | 150 |
| 4 | Use-case demo | ✅ | ❌ | ❌ | 130 |
| 5 | Size infographic | ❌ | ❌ | ❌ | 70 |
| 6 | Flat-lay gift set | ✅ | ✅ | ❌ | 140 |
| 7 | Emotional group | ❌ | ❌ | ❌ | 130 |
| 8 | Lifestyle closeup | ✅ | ✅ | ❌ | 140 |

### Quy trình BẮT BUỘC khi phát hiện regression mới
1. Append lesson vào `xp/prompt-anti-patterns.md` section "Conversation-Learned Lessons" với date + SKU + symptom + fix.
2. Nếu generalize được → promote lên per-slot hoặc universal anti-patterns section.
3. Update `config/prompts/slot-constraints.json` nếu cần thêm forbidden phrase hoặc đổi inject flag.
4. Append XP entry vào `xp/errors.md` / `xp/slots.md` / `xp/prompts.md`.
5. Update memory files ở `~/.claude/projects/d--AI-PROJECT-handmade-media-agent-v0/memory/` nếu là cross-session knowledge.
6. Update CLAUDE.md RULE section nếu là rule mới quan trọng.

## XP RULES (Auto-compiled)

### RULE-015: Prompt text dominance — direct-ref fidelity drift
- **Rule:** Trong direct-ref mode (nano-banana-pro + reference images), TUYỆT ĐỐI không inject nhiều text mô tả product vào prompt. Chỉ text mô tả SCENE. Product identity phải đến từ reference image, không phải text. Khi gặp fidelity drift, KHÔNG thêm text để "fix" — chỉ LÀM GỌN text, tăng fidelity guard, reorder ref images. Prompt length là determinant số 1 của fidelity. Per-slot inject flags ở `config/prompts/slot-constraints.json` enforce điều này tự động qua `utils/prompt-guard.js`.
- **Verified:** 5 iterations (SKU TNTD250326i769(2) — average score recovered từ ~6/10 → 9.3/10, slot 1 và 4 đạt 10/10)
- **Source:** XP-004 (errors.md), XP-005 (prompts.md), XP-197 đến XP-200 (slots.md)
- **Categories:** errors, prompts, slots, architecture
- **Infrastructure:** `xp/prompt-anti-patterns.md`, `utils/prompt-guard.js`, `config/prompts/slot-constraints.json`

### RULE-014: Reverse-stencil / through-cut products — see-through window effect
- **Rule:** Sản phẩm có insert hiện ra QUA cutout của front panel (reverse-stencil) PHẢI mô tả rõ quan hệ see-through trong TỪNG slot prompt có chứa insert — không chỉ ở `product_structure` root. Vocabulary bắt buộc: "through-cut stencil letters / hollow cutout", "side-loading / top-loading slot", "inserted [card] sits in the cavity BEHIND the front panel, color visible THROUGH the cutout shapes". Brief PHẢI có `see_through_cutout_rule` ở root + `critical_structure` ở các slot liên quan.
- **Verified:** 1 time (avg score: 2.0 — bug rõ ràng, chưa có case thành công để benchmark)
- **Source:** XP-003, case study TNTD250326i769-reverse-stencil
- **Categories:** errors, structure, prompts
- **Vocabulary + checklist đầy đủ:** `knowledge/photography/product-structure-analysis.md`

### RULE-001: Lighting harmony instruction giúp product blend tự nhiên hơn
- **Rule:** Lighting harmony instruction giúp product blend tự nhiên hơn vào environment
- **Verified:** 3 times (avg score: 8.3)
- **Source:** XP-001, XP-180, XP-156
- **Categories:** materials, slots

### RULE-002: Khi AI gen text trong ảnh, callout-graphics SVG overlay bị c
- **Rule:** Khi AI gen text trong ảnh, callout-graphics SVG overlay bị conflict — cần logic skip overlay khi concept đã có text
- **Verified:** 5 times (avg score: 8.6)
- **Source:** XP-004, XP-187, XP-162, XP-151, XP-133
- **Categories:** layouts, slots

### RULE-003: For use-case shots with hand + insertion action, the model i
- **Rule:** For use-case shots with hand + insertion action, the model is MUCH more likely to reimagine product geometry. Must lock geometry explicitly: 'the gift card slides DOWN into the top seam between two wood layers; the Best Teacher Ever banner is glued to the upper BACK panel, NEVER to the card itself'. Also: always add 'no visible handwritten text, no legible writing' to negative prompt to avoid text hallucination.
- **Verified:** 6 times (avg score: 7.3)
- **Source:** XP-001, XP-184, XP-178, XP-160, XP-142, XP-141
- **Categories:** errors, slots

### RULE-004: For slot1 hero, using a pure-white studio prompt with explic
- **Rule:** For slot1 hero, using a pure-white studio prompt with explicit 3/4 angle and 'soft top-down lighting with subtle natural shadow' gives nano-banana-pro high product fidelity when combined with real phone reference photos
- **Verified:** 3 times (avg score: 5.6)
- **Source:** XP-192, XP-176, XP-167
- **Categories:** slots

### RULE-005: Hand holding product on desk — hero shot
- **Rule:** Hand holding product on desk — hero shot
- **Verified:** 4 times (avg score: 9)
- **Source:** XP-189, XP-119, XP-091, XP-054
- **Categories:** slots

### RULE-006: Product scale correct
- **Rule:** Product scale correct
- **Verified:** 3 times (avg score: 8.7)
- **Source:** XP-188, XP-150, XP-121
- **Categories:** slots

### RULE-007: Natural shadows, no composite artifacts
- **Rule:** Natural shadows, no composite artifacts
- **Verified:** 3 times (avg score: 9.3)
- **Source:** XP-185, XP-148, XP-138
- **Categories:** slots

### RULE-008: Desk scene good overall
- **Rule:** Desk scene good overall
- **Verified:** 6 times (avg score: 8.3)
- **Source:** XP-170, XP-152, XP-134, XP-131, XP-058, XP-049
- **Categories:** slots

### RULE-009: Dual view effective
- **Rule:** Dual view effective
- **Verified:** 4 times (avg score: 8.7)
- **Source:** XP-163, XP-127, XP-103, XP-064
- **Categories:** slots

### RULE-010: Clean white background
- **Rule:** Clean white background
- **Verified:** 3 times (avg score: 9.1)
- **Source:** XP-155, XP-118, XP-045
- **Categories:** slots

### RULE-011: No misleading PCS badge
- **Rule:** No misleading PCS badge
- **Verified:** 3 times (avg score: 8.6)
- **Source:** XP-145, XP-104, XP-065
- **Categories:** slots

### RULE-012: Product text 'Thank You FOR HELPING ME GROW' readable on bot
- **Rule:** Product text 'Thank You FOR HELPING ME GROW' readable on both stakes
- **Verified:** 4 times (avg score: 9)
- **Source:** XP-116, XP-111, XP-088, XP-075
- **Categories:** slots

### RULE-013: Product well centered, UV-printed floral design crisp and ac
- **Rule:** Product well centered, UV-printed floral design crisp and accurate
- **Verified:** 3 times (avg score: 9.2)
- **Source:** XP-086, XP-050, XP-046
- **Categories:** slots

### RULE-016: Slot 3 = Features + Size combined infographic — LOCKED STRUCTURE (all funnels)
- **Status:** LOCKED. Structure fixed trong `config/funnels/*.json` + `config/prompts/slot-constraints.json` (slot3) + `config/prompts/slot-prompts.json` (slot3_fallback). Vision pause (concept-brainstorm) fill content per SKU, KHÔNG được redesign layout.
- **Rule:** Mọi funnel, slot 3 luôn là infographic gộp Features + Size: top full-width header banner (accent color) với product-category icon + uppercase title + bên trái product lớn với horizontal width arrow + vertical height arrow + circular thickness/depth callout bubble + bên phải column 4 rounded-square numbered callout cards (01-04) mỗi card macro crop + 2-line label. Slot 5 giải phóng cho display-locations grid (RULE-017). Content (banner headline, accent color, 4 callout specs, dimension values) fill per SKU qua Vision Concept Brainstorm.
- **Max words:** 180 soft / 260 hard (nới từ 150/220 legacy vì gộp 2 slot).
- **Verified:** 2 times (avg score: 9.68 — TNHG231025i621 9.35/10, TNHG231025i622 10/10)
- **Source:** XP-209, XP-217
- **Categories:** slots, layouts, configs

### RULE-017: Slot 5 = N-cell DISPLAY_LOCATIONS grid — LOCKED STRUCTURE (all funnels)
- **Status:** LOCKED. Structure fixed trong `config/funnels/*.json` + `config/prompts/slot-constraints.json` (slot5 + safeguard_phrases) + `config/prompts/slot-prompts.json` (slot5_fallback). Safeguard phrases auto-inject qua `utils/prompt-guard.js → injectSafeguardPhrases()` gọi trong `image-generator.js _finalizePrompt()`.
- **Rule:** Mọi funnel, slot 5 luôn là display-locations grid: top header với uppercase title (accent color) + italic subtitle; 2×2 grid của N cells (default 4, **adaptive 2-4 cells** theo niche — Option A); mỗi cell show product trong 1 display/use scenario khác nhau phù hợp product niche; numbered circular labels top-left + bold label bar bottom-left với tiny icon. Content (grid title, N value, N scenario names) fill per SKU qua Vision Concept Brainstorm. Prompt guard auto-inject 4 safeguard phrases chống bug center-floating-hero.
- **Max words:** 120 soft / 180 hard (nới từ 70/110 legacy vì grid + labels + safeguards cần chỗ).
- **Safeguard phrases (auto-injected):**
  1. "EXACTLY N equal rounded-square cells arranged in a clean grid (default 2×2, adaptive 2-4 cells based on product niche), one product instance per cell"
  2. "NO extra product anywhere outside the cells — absolutely NO floating hero product in the center of the grid or between cells"
  3. "NO elements overlapping between cells — each cell self-contained"
  4. "every numbered cell label and caption fully readable, no product obstructing any label"
- **Niche scenario examples (Vision adapts):** Ornament → Wall Hook/Shelf/Photo Frame/Dresser • Jar/candle → Kitchen/Bathroom/Bedside/Office • Mug → Office Desk/Kitchen Shelf/Coffee Bar/Gift Wrapped • Card → Envelope/Desk/Frame/Pinboard • Wall art → Living Room/Gallery/Over Fireplace/Office • Coaster → Coffee Table/Dining/Kitchen/Side Table.
- **Verified:** 2 times (TNHG231025i621 9.35/10 sau 1 regen fix bug center-floating, TNHG231025i622 9.7/10)
- **Source:** XP-211, XP-219, anti-pattern A6 trong `xp/prompt-anti-patterns.md`
- **Categories:** slots, layouts, prompts, errors

### RULE-018: Slot 2 graduation party backdrop formula
- **Rule:** Slot 2 lifestyle-wide cho graduation ornament = ornament hanging foreground centered + background party scene (navy-and-gold 'GRAD' bunting banner trải ngang top + cluster navy + metallic gold balloons bên trái + warm mantel/fireplace với golden fairy-light bokeh bên phải + cream wall behind). Warm fairy-light bokeh KHÔNG exclusive cho Christmas — paired với graduation props (balloons navy/gold, GRAD bunting) reads đúng mood graduation party. Lens 50mm f/2.8 shallow DoF.
- **Verified:** 2 times (avg score: 9.3 — 9.15/10 và 9.45/10)
- **Source:** XP-208, XP-216
- **Categories:** slots, lifestyle, themes

### RULE-019: Slot 7 = hands-only gift moment (no face reveal)
- **Rule:** Slot 7 emotional gift moment ưu tiên hands-only close-up (không face) hơn mother-daughter face reveal. Hands adult cầm ornament foreground + background party scene (navy+gold balloon cluster + gold streamers + blurred grad cap với red/gold tassel + gold confetti). Broader demographic appeal — mọi buyer demographic thấy mình trong scene, không lock vào gender/age cụ thể của người nhận. 85mm f/2.0 warm party light.
- **Verified:** 2 times (avg score: 9.15 — 9.0/10 và 9.3/10)
- **Source:** XP-213, XP-221
- **Categories:** slots, lifestyle

### RULE-020: A+ Content — 2 Types + Default Plans (NEW 2026-04-14)
- **Status:** FORM DEFINED, awaiting aplus-pipeline.js refactor để fully automate. Schema in place cho cả 2 type.
- **Rule:** A+ Content HMA có 2 loại cần brief declare rõ:
  1. **Type 1 — Single ASIN:** 1 product deep-dive. Default Plan B (Storyboard Seamless) — 5 module narrative với visual motif thread (token trail / coral lines / rainbow arcs) nối liền 5 banner. Story-driven, bán meaning/identity/memory per doctrine.
  2. **Type 2 — Multi-ASIN Parent:** N child products dưới 1 parent ASIN. Default Plan A (Modular) — 5 module comparison-focused (Collection Hero → Shared Pain → Product Matrix → Decision Guide → Collection CTA). Bán variety + right-fit + bundle.
- **Brief schema mở rộng:**
  - `aplus_type: "single" | "multi_asin"` (required)
  - `aplus_plan_style: "A" | "B"` (default = "B" nếu single, "A" nếu multi)
  - `parent_asin_id: string` (required nếu multi)
  - `child_asins: [{ sku, role, display_name, ref_catalog, primary_use_case, target_age }]` (required nếu multi, N≥2)
- **Config files:**
  - `config/funnels/aplus-shared-constraints.json` — R1 typography / R2 fidelity / R3 scale / R4 per-banner refs (áp dụng cả 2 type)
  - `config/funnels/aplus-type1-single.json` — Plan B Storyboard default + Plan A Modular backup, 5 module với layout + seduction_gate + ref_recipe
  - `config/funnels/aplus-type2-multi-asin.json` — Plan A Modular default + Plan B Storyboard backup, 5 module comparison-focused
  - `config/prompts/aplus-type1-concept-prompt.md` — Vision brief Type 1
  - `config/prompts/aplus-type2-concept-prompt.md` — Vision brief Type 2
- **Verified:** Type 1 verified qua SKU TNTD180326i750 (10 banner test v3, Plan B thắng 5/5 tiêu chí). Type 2 awaiting parent ASIN real-world test.
- **Source:** Conversation 2026-04-14, test-aplus-compare.js v3 artifacts
- **Categories:** aplus, workflow, configs, types

### RULE-021: Per-banner / per-slot / per-module ref selection — fidelity over quantity
- **Status:** LOCKED. Apply cho listing + A+ pipeline.
- **Rule:** Mỗi slot listing + mỗi module A+ CHỌN subset refs phù hợp visual intent của shot, KHÔNG dùng blanket ref set chung. Ref catalog có named roles (`hero_faceon`, `hero_lifestyle`, `tokens_topview`, `edge_thickness`, v.v.). Process shots (laser cutter, workshop) có thể dùng 0-1 ref. Grid multi-product cần ref riêng mỗi variant (Type 2).
- **Quality gate:** Blurry / off-axis refs loại khỏi default pool, chỉ include khi shot cần cụ thể edge-thickness hoặc 3D angle.
- **Verified:** TNTD180326i750 A+ test v2→v3. Plan B M3 Handcrafted Proof với 1-ref (`hero_lifestyle`) > 3-refs blanket (v2). Plan A M3 v3 với `edge_thickness` blur REGRESSED → jar rendered as disc. Rule: per-banner refs PHẢI filter low-quality inputs.
- **Infrastructure:** `config/funnels/aplus-shared-constraints.json → rules.R4_per_banner_ref_selection`. Brief mở rộng `ref_catalog` với named roles per-SKU.
- **Source:** Anti-pattern A7 trong `xp/prompt-anti-patterns.md`, case study TNTD180326i750
- **Categories:** refs, fidelity, listing, aplus

## A+ Content Workflow (v2.5.0 — NEW 2026-04-14)

### 2 Types cần phân biệt

```
Type 1 — Single ASIN A+
  1 SKU = 1 A+ content  Default = Plan B Storyboard (seamless narrative)
  Config: config/funnels/aplus-type1-single.json

Type 2 — Multi-ASIN Parent A+
  1 parent ASIN với N child SKUs = 1 A+ content chung
  Default = Plan A Modular (comparison + decision)
  Config: config/funnels/aplus-type2-multi-asin.json
  Status: schema form defined, awaiting real parent ASIN test
```

### Brief fields bắt buộc cho A+

```json
{
  "sku": "...",
  "aplus_type": "single",          // or "multi_asin"
  "aplus_plan_style": "B",         // or "A" — override default nếu cần
  "ref_catalog": {                 // R4 named role refs per-SKU (required)
    "hero_faceon": "input/product/.../face.jpg",
    "hero_lifestyle": "input/product/.../lifestyle.jpg",
    "tokens_topview": "input/product/.../top.jpg",
    "edge_thickness": "input/product/.../3quarter.jpg"
  },
  "parent_asin_id": null,          // required if type=multi_asin
  "child_asins": []                // required if type=multi_asin
}
```

### 3 Rules bắt buộc áp dụng mọi A+ banner (từ aplus-shared-constraints.json)

| Rule | Nội dung |
|---|---|
| **R1 Typography lock** | Strictly 2 fonts throughout: Baloo 2 Bold (display) + Calligraphy italic (Kalam/Caveat, accent). No third font |
| **R2 Product fidelity** | Doctrine F1-F8 per product. Process shots accurate (laser cutter = CNC machine, not pyrography) |
| **R3 Scale anchor** | Realistic proportions relative to human body + standard reference objects |
| **R4 Per-banner ref selection** | Each module picks refs matching shot intent (xem RULE-021) |

### Workflow

1. User prep brief với `aplus_type`, `ref_catalog`, `aplus_plan_style` (optional override)
2. Pipeline đọc `config/funnels/aplus-type{1,2}-*.json` theo `aplus_type`
3. Phase 3 (A+ Sequence Architect) pause với Concept Brainstorm cho A+ — Claude Vision đọc `config/prompts/aplus-type{1,2}-concept-prompt.md` + tạo `_aplus_concepts.json`
4. Gen 5 module parallel, mỗi module pick refs theo `ref_recipe` trong funnel config
5. Post-production: crop/extend sang 1464×600 final spec (AI gen 16:9, mapping 2.44:1 qua Photoshop/Figma)

### Integration status (2026-04-14)

- ✅ Config form hoàn chỉnh cả Type 1 + Type 2
- ✅ Doctrine update chapter 5 A+ Authority (pending file edit)
- ✅ Anti-patterns A7 + A8 added
- ⏳ `aplus-pipeline.js` refactor để đọc new configs + route by type — TODO
- ⏳ Type 2 end-to-end test — pending real parent ASIN

### v2.6.0 — Proven A+ Flow shipped 2026-04-18

**Reusable flow** integrated vào HMA qua `utils/aplus-flow.js` + `scripts/aplus.js` CLI.

Pattern đã battle-tested trên 3 SKU (TNTD250326i769 COACH × 3, TNTD180326 Teacher × 3, TNTD090425i392 Best Dad) với 30+ banners produced. Các learnings critical:

**Key discoveries:**
1. **Real product photos MUST be primary ref**, never listing renders (which may have hallucinated). Listing refs gây compound hallucination.
2. **Upload resolution critical**: real product refs phải upload ở maxSize 2048 / quality 95 (không phải default 768 / 85). Default compress xuống 73KB → model mất detail → hallucinate.
3. **COPY-MODE GUARDS**: treat real photo as pixel-level template. Explicit "do NOT stylize, reinterpret, simplify".
4. **Per-SKU fidelity anchors** (brief.aplus_product_guards): SKU-specific R2 text covering pennant shape, handprint layout, engraved text etc.
5. **M1 precheck gate**: 1 credit to verify fidelity before committing 4×5 more.
6. **Multi-ratio from same prompt**: 16:9 + 21:9 native gen parallel.
7. **Anti-leak guard**: "Do NOT render layout instructions as visible text" (catches "LEFT 50%" / "RIGHT 50%" labels being rendered as design text).

**CLI usage:**
```bash
node scripts/aplus.js --sku="<SKU>"                      # M1 precheck 16:9
node scripts/aplus.js --sku="<SKU>" --full               # all 5 modules 16:9
node scripts/aplus.js --sku="<SKU>" --full --ratio=all   # 16:9 + 21:9 (10 banners)
node scripts/aplus.js --sku="<SKU>" --only=M2,M3         # specific modules
```

**Extra brief fields (optional but recommended):**
```json
{
  "aplus_product_guards": "CRITICAL FIDELITY: <per-SKU anchor text...>",
  "aplus_font_family": "Fredoka Bold",
  "aplus_modules": {
    "M1_open-scene": { "prompt": "<override prompt>", "refs": ["real_hero", "..."] }
  }
}
```

**Files:**
- `utils/aplus-flow.js` — `buildGuards`, `uploadRefsAtProperResolution`, `runFullFlow`
- `scripts/aplus.js` — CLI wrapper
- `scripts/test-aplus-t1-bestdad.js` — reference impl (Father's Day SKU)
- `scripts/test-aplus-t2-coach.js` / `test-aplus-t2-teacher.js` — Type 2 reference impls

## Wave 2 — Vision-Aware Architecture (v2.4.0+)

Pipeline includes 4 pause/resume Vision phases.

### Pipeline phases

```
brief + reference images + brand_style.json
   →
[Phase 1] Vision Design Director (PAUSE/RESUME)
   → DNA v2 (art_direction + hook_per_slot + cohesion_anchors)
[Brand Taste merge]
   →
[Phase 1.5] Concept Brainstorm Agent (PAUSE/RESUME)
   → slot_concepts v2
[Phase 2] Listing Pipeline + Multi-Model Routing
   → 8 slots (slot 2/6/7/8 → seedream-4)
   → + per-slot QC Metrics (Sharp deterministic)
[Phase 2.5] Cohesion Validator (PAUSE/RESUME)
   → scores 4 dimensions, identifies drift
[Phase 3] A+ Sequence Architect (5 modules narrative arc)
[Phase 4] Video Producer
   →
DONE
```

### CLI flags Wave 2

```bash
--no-vision-director       # skip Phase 1 vision pause
--no-concept-brainstorm    # skip Phase 1.5 concept pause
--no-cohesion-validator    # skip Phase 2.5 cohesion pause
```

### Pause/resume pattern

3 Vision phases pause pipeline. Each:
1. Pipeline reaches phase, writes request file
2. Pipeline exits with paused: true
3. Claude Code reads request, performs Vision, writes result file
4. User re-runs same master.js command
5. Pipeline detects result, processes, continues

### Brand style

Define 1 lần per shop trong `knowledge/brand-style/{brand_id}.json`,
set `brand_id: "..."` trong brief, mọi SKU thuộc shop tự dùng style.

### Multi-model routing

Per-slot config trong `config/model-routing.json`. Default:
- Slot 1, 3, 4, 5 → nano-banana-pro (fidelity)
- Slot 2, 6, 7, 8 → seedream-4 (cinematic)

Override per-SKU: `brief.slot_model_override = { 1: "imagen-4" }`.
