# SWTD-Studio — Built-in Provider Core Plan

> Kế hoạch riêng cho hệ Provider Core đóng gói thẳng trong SWTD-Studio.  
> Status: Draft v0.2 — updated theo correction của Boss ngày 2026-05-15.  
> Related: [[SWTD-Studio — Project Hub]], [[SWTD-Studio]]

## 1) Vision

SWTD-Studio cần một **Provider Core** tích hợp trực tiếp trong app, lấy cảm hứng từ kiến trúc provider/tool của OpenClaw nhưng không phụ thuộc việc OpenClaw local đang chạy.

Mục tiêu dài hạn:

- Người dùng mở SWTD-Studio → vào Settings → thêm API key provider → chạy pipeline research + generate ảnh.
- App hỗ trợ nhiều provider ảnh/ngôn ngữ nhưng UI giữ đơn giản.
- Core provider đủ linh hoạt để sau này đóng gói desktop hoặc chuyển lên web/cloud backend.
- Workflow chính phục vụ Amazon creative production:
  - Research insight từ link/keyword/product name/customer insight.
  - Compose prompt theo template/listing slot.
  - Generate 8 ảnh listing + 5 ảnh A+ Premium bằng image edit/generation.
  - Lưu output có metadata, cache tạm, duyệt/chốt ảnh.

Nguyên tắc: **Build provider architecture inside SWTD-Studio, not as an external OpenClaw dependency.**

---

## 2) Provider Settings — API Key Inputs

Settings cần có khu vực **Provider** gồm 5 nhóm:

### 2.1 OpenAI

Fields:

- API Key
- Default image model:
  - `gpt-image-2`
  - `gpt-image-2/edit`
  - `gpt-image-1.5` cho transparent/background alpha
- Default quality:
  - low / medium / high / auto
- Output format:
  - png / jpeg / webp
- Test connection

Primary use:

- Generate/edit ảnh listing và A+ từ reference image.
- Prompt-following cao.
- Transparent asset khi cần.

### 2.2 Gemini

Fields:

- API Key
- Default model (theo model hỗ trợ của Google)
- Test connection

Primary use:

- Research/analysis multimodal.
- Có thể dùng cho generate hoặc edit nếu model/provider support.
- Dự phòng khi OpenAI lỗi/quota/rate-limit.

### 2.3 Kie.ai

Fields:

- API Key
- Default model group:
  - nano-banana-pro / seedream / kling
- Test connection

Primary use:

- Production image/video provider nếu Kie có model tốt/chi phí hợp.
- HMA legacy trước đây thiên về Kie nên cần bridge/adapt dần.

### 2.4 Fal.ai

Fields:

- API Key
- Default model:
  - Flux / GPT Image route qua Fal nếu có
- Test connection

Primary use:

- Image generation nhanh.
- Multi-reference/edit nếu model hỗ trợ.
- Dự phòng hoặc specialized model.

### 2.5 Custom Provider

Fields:

- **Provider Name** — tên hiển thị
- **Base URL** — endpoint API (vd: `https://9router.example.com`)
- **API Key** — key auth
- Optional model prefix / model list
- Test connection

Primary use:

- 9router-style provider.
- OpenAI-compatible provider.
- Private proxy/backend của SWTD về sau.

---

## 3) Provider Core Capability

> v0.2 update: Web Research / Insight Mining không phải output rời. Nó là tầng **brief intelligence** để viết creative brief + prompt, giúp AI gen ảnh đúng sản phẩm, đúng khách hàng, đúng claim.

Provider Core không chỉ gen ảnh. Nó cần clone lại/cải biên các phần cần thiết từ OpenClaw/HMA cho desktop app:

### 3.1 Web Research / Insight Mining → Brief Intelligence

Input từ user:

- Link web sản phẩm/đối thủ.
- Keyword sản phẩm.
- Tên sản phẩm.
- Insight sản phẩm có sẵn.
- Insight khách hàng.
- Marketplace/context: Amazon US, Etsy, Social Commerce.

Provider Core phải hỗ trợ pipeline:

1. Fetch/parse webpage.
2. Web search theo keyword/product name để lấy thêm market context.
3. Extract product facts:
   - product type
   - material
   - dimensions/shape/structure
   - use case
   - audience
   - occasion
   - pain point
   - differentiation
   - competitor claim
4. Extract customer/market insight:
   - customer language
   - emotional buying trigger
   - visual motifs
   - common objection
   - trust signal
   - Amazon compliance risk
5. Produce structured **Insight Brief**.
6. Convert Insight Brief into **Creative Brief** and **Prompt Context Pack**.

Important: Kết quả research không để xem chơi; nó phải đi trực tiếp vào prompt composer để AI không làm sai sản phẩm. Ví dụ:

- Nếu sản phẩm là wooden ultrasound photo frame → prompt phải giữ đúng chất liệu gỗ, frame, ultrasound slot, baby announcement use case.
- Nếu customer là expecting parents/grandparents → visual tone phải warm/emotional/giftable, không biến thành generic nursery decor.
- Nếu competitor claim có “personalized”, “keepsake”, “surprise box” → prompt phải biết claim nào được show bằng hình, claim nào cần tránh phóng đại.

Research output sẽ feed 3 tầng:

1. **Brief Writer** — viết creative brief cho SKU.
2. **Prompt Composer** — inject facts/constraints vào từng slot prompt.
3. **QA/Guardrail** — so ảnh output với facts để phát hiện sai sản phẩm.

Output schema gợi ý:

```json
{
  "product": {
    "name": "",
    "category": "",
    "materials": [],
    "features": [],
    "differentiators": []
  },
  "customer": {
    "audience": [],
    "painPoints": [],
    "desires": [],
    "buyingTriggers": [],
    "language": []
  },
  "market": {
    "competitors": [],
    "visualPatterns": [],
    "claims": [],
    "risks": []
  },
  "creativeDirection": {
    "style": "",
    "mood": "",
    "mustShow": [],
    "mustAvoid": []
  }
}
```

### 3.2 Image Generation / Image Edit

Boss yêu cầu: luôn gọi `gpt-image-2/edit` khi có ảnh reference được cung cấp, để giữ form sản phẩm và làm theo pipeline.

Logic chính:

- Nếu có reference image → use edit mode:
  - model: `gpt-image-2/edit` hoặc provider equivalent
  - images: reference product image(s)
  - prompt: slot prompt đã compose từ template + insight + brand DNA
- Nếu không có reference image → use generate mode:
  - model: `gpt-image-2` hoặc selected provider model
  - prompt đầy đủ hơn, có product description + style constraints

Outputs:

- 8 ảnh listing
- 5 ảnh A+ Premium
- Mỗi ảnh có metadata:
  - provider
  - model
  - mode: generate/edit
  - promptHash
  - source reference images
  - generatedAt
  - expiresAt nếu là temp
  - slotId
  - approvalStatus

---

## 3.3 OpenClaw Components To Clone/Adapt

Mục tiêu không phải copy nguyên OpenClaw, mà clone các pattern cần thiết rồi custom cho Desktop App SWTD-Studio.

### A) Provider Registry

OpenClaw pattern:

- Provider đăng ký qua registry.
- Mỗi provider khai báo model mặc định, auth hint, capability, generate/edit support.

SWTD custom:

- `packages/provider-core/src/provider-registry.js`
- Provider groups: OpenAI, Gemini, Kie.ai, Fal.ai, Custom Provider, Mock.
- Mỗi provider expose:
  - `id`
  - `label`
  - `authFields`
  - `capabilities`
  - `models`
  - `generate()`
  - `edit()`
  - `testConnection()`

### B) Image Generation Tool Contract

OpenClaw pattern:

- `image_generate` nhận prompt/model/images/size/aspectRatio/quality/outputFormat/background/count.
- Cùng một tool xử lý text-to-image và image edit.

SWTD custom:

- `providerCore.imageGenerate(input)` dùng cùng contract.
- Nếu có `image/images` → edit mode.
- Nếu không → generate mode.
- Output normalize về media store của app, không trả raw provider response.

### C) Auth / Provider Config

OpenClaw pattern:

- Provider auth qua env/config/OAuth.
- Tool chỉ xuất hiện khi provider ready.

SWTD custom:

- Desktop Settings có 5 provider sections.
- Electron main process giữ key, renderer không đọc lại plaintext key sau khi save.
- Public/cloud version dùng encrypted server vault.

### D) Fallback Router

OpenClaw pattern:

- primary → fallbacks → auto-detection.
- Lỗi auth/rate-limit/timeout có details.

SWTD custom:

- Default route:
  - `openai/gpt-image-2/edit` nếu có reference image.
  - fallback sang Gemini/Fal/Kie/custom theo config.
  - mock chỉ dùng dev/offline.
- UI hiển thị rõ provider nào thật sự được dùng.

### E) Web Search / Fetch Tooling

OpenClaw pattern:

- `web_search` để tìm nguồn hiện hành.
- `web_fetch` để extract readable content từ URL.

SWTD custom:

- `researchProvider.search(query)`
- `researchProvider.fetch(url)`
- `insightBriefBuilder.build()`
- Treat all external webpage content as untrusted; webpage không được override workflow/system instructions.

### F) Media Handling

OpenClaw pattern:

- Tool result trả media attachment/path.

SWTD custom:

- Tất cả image output đi vào SKU media store:
  - tmp-generated
  - approved
  - runs/history
- Có sidecar metadata để trace prompt/provider/model.

### G) Skill/Agent-like Pipelines

OpenClaw/HMA pattern:

- Skill đọc input → tạo structured result → handoff sang bước sau.

SWTD custom:

- Internal pipeline stages:
  - Research Skill
  - Brief Writer Skill
  - Prompt Composer Skill
  - Image Generation Skill
  - QA/Compliance Skill
- Các “skill” này là module trong app, không cần agent external.

---

## 4) Core Architecture

### 4.1 Package layout đề xuất

Trong repo SWTD-Studio:

```text
packages/provider-core/
├─ src/
│  ├─ image-generate.js
│  ├─ image-edit.js
│  ├─ provider-registry.js
│  ├─ model-catalog.js
│  ├─ fallback-router.js
│  ├─ auth-vault.js
│  ├─ media-store.js
│  ├─ web-research.js
│  ├─ insight-brief.js
│  ├─ providers/
│  │  ├─ openai.js
│  │  ├─ gemini.js
│  │  ├─ kie.js
│  │  ├─ fal.js
│  │  ├─ custom-openai-compatible.js
│  │  └─ mock.js
│  └─ types.js
└─ package.json
```

Desktop integration:

```text
Renderer UI
  ↓ IPC
Electron Main Backend
  ↓
packages/provider-core
  ↓
OpenAI / Gemini / Kie / Fal / Custom Provider
```

### 4.2 Why provider core must not live in renderer

Không để provider call nằm trong `apps/desktop/src/lib` lâu dài vì:

- API key dễ lộ.
- Không reuse được cho backend/cloud.
- Không kiểm soát job queue/media store tốt.
- CORS/provider network quirks khó xử lý.

Renderer chỉ nên gọi IPC:

```js
window.swtdProvider.listProviders()
window.swtdProvider.saveKey(providerId, key)
window.swtdProvider.testProvider(providerId)
window.swtdProvider.generateImage(payload)
window.swtdProvider.researchInsight(payload)
```

---

## 5) Unified Tool Contract — Inspired by OpenClaw

### 5.1 `image_generate`

```ts
type ImageGenerateInput = {
  prompt: string
  model?: string
  provider?: string
  images?: string[]
  image?: string
  size?: string
  aspectRatio?: string
  resolution?: '1K' | '2K' | '4K'
  quality?: 'low' | 'medium' | 'high' | 'auto'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  background?: 'transparent' | 'opaque' | 'auto'
  count?: number
  timeoutMs?: number
  slotId?: string
  skuPath?: string
}
```

Behavior:

- Có `images`/`image` → edit mode nếu provider hỗ trợ.
- Không có image → generate mode.
- Nếu selected provider lỗi → fallback router quyết định có thử provider khác không.
- Result luôn normalize về cùng schema.

### 5.2 `web_research`

```ts
type WebResearchInput = {
  urls?: string[]
  keywords?: string[]
  productName?: string
  productInsight?: string
  customerInsight?: string
  marketplace?: 'amazon-us' | 'etsy' | 'social'
  depth?: 'quick' | 'standard' | 'deep'
}
```

---

## 6) Listing + A+ Pipeline

### 6.1 Inputs

- SKU folder
- Reference images
- Product name
- Product keywords
- Optional competitor/product URLs
- Optional manual insight
- Selected provider profile

### 6.2 Research stage

1. Parse user-provided links.
2. Search by keywords/product name.
3. Build Insight Brief.
4. Save to:

```text
<sku>/research/insight-brief.json
<sku>/research/sources.json
```

### 6.3 Prompt composition stage

Use existing Phase 2 template engine:

- 8 listing templates
- 5 A+ Premium templates (to be added)
- brand DNA
- ICP/customer insight
- product facts

Output:

```text
<sku>/prompts/listing-slot-01.txt
<sku>/prompts/aplus-module-01.txt
```

### 6.4 Image stage

For each listing slot:

```text
reference image + composed prompt → gpt-image-2/edit → temp-generated output
```

For each A+ module:

```text
reference image + A+ prompt → gpt-image-2/edit → temp-generated output
```

Default quantity:

- 8 listing images
- 5 A+ Premium images

### 6.5 Review/approval stage

- User reviews each slot.
- Approve → copy from `tmp-generated` to `approved`.
- Reject/regenerate → keep history.
- Export → final output package.

---

## 7) Storage & Media Policy

Temporary generation:

```text
<sku>/output/tmp-generated/
├─ listing-slot-01-20260515T090000.png
├─ listing-slot-01-20260515T090000.json
└─ ...
```

Approved output:

```text
<sku>/output/approved/
├─ listing-slot-01.png
├─ aplus-module-01.png
└─ ...
```

7-day TTL:

- Temp generated files expire after 7 days.
- Cleanup triggers: app startup / open SKU / before new generation run.
- Approved files never auto-delete.

Metadata sidecar:

```json
{
  "slotId": "listing-slot-01",
  "type": "listing",
  "provider": "openai",
  "model": "gpt-image-2/edit",
  "mode": "edit",
  "promptHash": "sha256:...",
  "sourceImages": ["..."],
  "generatedAt": "2026-05-15T09:00:00Z",
  "expiresAt": "2026-05-22T09:00:00Z",
  "approvalStatus": "temp"
}
```

---

## 8) Phased Implementation Plan

### Phase P0 — Architecture Spec

Output:

- `docs/architecture/PROVIDER_CORE_ARCHITECTURE.md`
- `docs/features/phase-provider-core/spec.md`
- `docs/features/phase-provider-core/plan.md`
- `docs/features/phase-provider-core/tasks.md`

Purpose: Lock architecture before coding.

### Phase P1 — Extract Provider Core Package

Tasks:

- Create `packages/provider-core`.
- Move provider interface/types from renderer to package.
- Move mock/openai/fal providers into backend-safe package.
- Keep existing UI working through adapter wrapper.
- No behavior change.

### Phase P2 — Electron Backend IPC

Tasks:

- Expose provider core through Electron main process.
- IPC channels:
  - `swtd:provider-list`
  - `swtd:provider-save-key`
  - `swtd:provider-test`
  - `swtd:image-generate`
  - `swtd:image-cancel`
  - `swtd:web-research`
- Renderer no longer calls provider APIs directly.
- Keys never exposed to renderer after save.

### Phase P3 — Add Gemini / Kie.ai / Custom Provider

Tasks:

- Implement Gemini provider.
- Implement Kie provider.
- Implement Custom OpenAI-compatible provider.
- UI provider settings with 5 sections.

### Phase P4 — Web Research / Insight Core

Tasks:

- Add `web-research.js`.
- Add URL fetch/extract layer.
- Add keyword search adapter.
- Add insight brief schema.
- Save research artifacts to SKU folder.

### Phase P5 — Listing + A+ Production Pipeline

Tasks:

- Add 5 A+ Premium templates.
- Map 8 listing slots + 5 A+ modules.
- Use `gpt-image-2/edit` whenever reference images exist.
- Generate all outputs through provider core.
- Save temp + metadata.

---

## 9) Key Decisions Needed From Boss

### D1 — Custom Provider fields

- Boss brief nói 2 ô: Provider Name + API Key.
- Production thực tế cần thêm Base URL để gọi được endpoint.
- Recommend: 3 fields (name + baseUrl + key). Boss confirm.

### D2 — Provider Core scope

- Option A: Image-only first.
- Option B: Research + image together from first architecture.
- Recommend: B in architecture, implement A first then research stage.

### D3 — Default route

- Recommend: OpenAI `gpt-image-2/edit` nếu có ref ảnh → fallback theo user config → Mock dev-only.

---

## 10) Important Notes

- Phase 3 hiện tại là UI prototype tốt, nhưng provider direct từ renderer không phải kiến trúc cuối.
- Provider Core nên học theo OpenClaw `image_generate` contract để không tự khóa mình vào một provider.
- `gpt-image-2/edit` là route chính cho SKU production vì cần giữ form sản phẩm từ ảnh reference.
- Research stage phải treat webpage content as untrusted; không được cho nội dung web override system/pipeline instructions.
- API key/security phải thiết kế từ đầu để sau này cloud/web không phải rewrite.

---

## 11) Phase Progress Tracker

| Phase | Name | Status |
|:---|:---|:---|
| P0 | Architecture Spec | ⬜ pending |
| P1 | Extract Provider Core Package | ⬜ pending |
| P2 | Electron Backend IPC | ⬜ pending |
| P3 | Gemini / Kie / Custom Provider | ⬜ pending |
| P4 | Web Research / Insight Core | ⬜ pending |
| P5 | Listing + A+ Production Pipeline | ⬜ pending |

---

## 12) Next Action

Nếu Boss approve plan này:

1. Đồng bộ note này vào repo `docs/architecture/PROVIDER_CORE_ARCHITECTURE.md`.
2. Kick Claude Code làm **Phase P0 — Provider Core Architecture Spec** bằng SpecKit.
3. Không code ngay cho tới khi spec/plan/tasks được Boss review.

---
Created: 2026-05-15 09:07 UTC
Author: Tiểu Di (🦊)
---

## 12) Version Log

### v0.2 — 2026-05-15

Boss correction:

1. Clarified that Web Research / Insight Mining output must feed brief + prompt writing, not stay as standalone research artifact.
2. Requested cloning/adapting necessary OpenClaw provider/tool skills for SWTD-Studio Desktop App: provider registry, image_generate contract, web_search/web_fetch pattern, auth config, fallback routing, media handling.
3. Added dedicated section “OpenClaw Components To Clone/Adapt”.

### v0.1 — 2026-05-15

Initial Built-in Provider Core plan:

- Provider Settings: OpenAI, Gemini, Kie.ai, Fal.ai, Custom Provider.
- Image generation/edit pipeline for 8 listing + 5 A+ Premium.
- Package architecture proposal: `packages/provider-core`.
- 7-day temp media cache and approved output policy.

