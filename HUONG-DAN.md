# Hướng dẫn cài đặt và sử dụng openclaw-hma

> **Đọc file này đầu tiên khi bạn vừa giải nén zip.**
> Phiên bản: v0.1.1 (2026-05-03)

---

## 1. Đây là gì?

**openclaw-hma** là một bộ skill cho [Openclaw](https://openclaw.ai) — biến Openclaw agent thành một trợ lý chuyên gen toàn bộ media cho 1 SKU handmade Amazon US:

- 8 ảnh listing (2000×2000 JPG)
- 5 module A+ Premium (1464×600 JPG)
- 1 video sản phẩm 20-25 giây (1920×1080 MP4)

Bạn chỉ cần đưa: ảnh sản phẩm, brief (SKU + tên + category + features...). Pipeline tự gen toàn bộ.

---

## 2. Yêu cầu trước khi cài

| Cần có | Ghi chú |
|--------|---------|
| Windows 10/11 | (Mac/Linux cần điều chỉnh path — chưa test) |
| Node.js >= 18 | Tải tại https://nodejs.org/ |
| Openclaw đã cài | https://openclaw.ai/ — bao gồm CLI |
| KIE.ai API key | Tạo tại https://kie.ai/api-key — pay-as-you-go |
| Visual C++ 2015-2022 Redistributable | (Chỉ Windows) Cần cho `sharp` build native module |
| ~50 MB ổ cứng trống | Cho `node_modules/` sau khi cài |

---

## 3. Cài đặt (4 bước)

### Bước 1 — Giải nén

Giải nén `openclaw-hma-v0.1.1-<timestamp>.zip` vào đâu cũng được. Ví dụ:

- `C:\openclaw-hma\`
- `D:\AI PROJECT\openclaw-hma\`
- `%USERPROFILE%\Documents\openclaw-hma\`

> **Quan trọng:** đường dẫn KHÔNG chứa kí tự đặc biệt nguy hiểm (vd `&`, `$`). Có khoảng trắng (như `D:\AI PROJECT\`) thì OK — đã test.

### Bước 2 — Chạy `setup.ps1`

Mở **PowerShell** (không cần admin), `cd` vào folder vừa giải nén:

```powershell
cd "D:\AI PROJECT\openclaw-hma"
.\setup.ps1
```

Script này sẽ tự động:
1. Kiểm tra Node.js >= 18
2. `npm install` trong `runtime\legacy\` (cài `sharp`, `pino`, `dotenv`)
3. `npm install` trong `runtime\` (cài `dotenv`)
4. Tạo `runtime\.env` từ template
5. Lint syntax mọi file `.mjs`

**Thời gian:** 2-5 phút (tùy tốc độ mạng + sharp build).

> **Nếu gặp "execution policy"** chặn:
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\setup.ps1
> ```

### Bước 3 — Điền `KIE_KEY`

Mở file `runtime\.env` bằng Notepad hoặc bất kỳ editor nào:

```bash
notepad runtime\.env
```

Thay dòng:
```
KIE_KEY=sk-replace-me
```
thành key thật của bạn từ https://kie.ai/api-key:
```
KIE_KEY=sk-abcdef1234567890...
```

Lưu lại. **Không commit/share file `.env` này** — nó đã `.gitignore` sẵn và `pack.ps1` sẽ block nếu phát hiện key thật trong khi đóng gói.

### Bước 4 — Mount vào Openclaw

Mở **Command Prompt với quyền Administrator**:

```cmd
mklink /D "%USERPROFILE%\.openclaw\workspace\openclaw-hma" "D:\AI PROJECT\openclaw-hma"
```

Thay `D:\AI PROJECT\openclaw-hma` bằng đường dẫn thật của bạn.

> **Không có quyền admin?** Dùng copy thay symlink (sẽ phải copy lại sau mỗi lần edit):
> ```cmd
> xcopy /E /I /Y "D:\AI PROJECT\openclaw-hma" "%USERPROFILE%\.openclaw\workspace\openclaw-hma"
> ```

**Verify:** mở Openclaw, gõ:
```
/new
/skills list
```

Bạn sẽ thấy 13 skill `hma-*`. 5 trong đó là user-invocable: `hma-master`, `hma-listing`, `hma-aplus`, `hma-video`, `hma-knowledge`.

✅ **Cài đặt xong.**

---

## 4. Sử dụng

### 4.1. Chuẩn bị folder cho 1 SKU mới

Trong `data/`, tạo folder theo mã SKU:

```
data/
└── TNTD050526i801/
    ├── brief.json                  ← bạn tạo
    └── input/
        ├── product/                ← BẮT BUỘC, ảnh sản phẩm thật
        │   ├── front.jpg
        │   └── angle.jpg
        ├── listing-ref/            ← TÙY CHỌN, template đối thủ (không gửi API)
        ├── aplus-ref/              ← TÙY CHỌN
        └── video-ref/              ← TÙY CHỌN
```

### 4.2. `brief.json` mẫu tối thiểu

```json
{
  "sku": "TNTD050526i801",
  "product_name": "Personalized Mom Birthday Wood Frame",
  "category": "wood_ornament",
  "materials": ["birch plywood", "acrylic insert"],
  "features": [
    "laser-cut custom name",
    "magnetic acrylic card",
    "8x10 standing frame"
  ],
  "occasion": "mother_day",
  "input_images": ["input/product/front.jpg", "input/product/angle.jpg"],
  "dimensions": "8x10 inches",
  "usp": "Custom name + photo display",
  "color_preference": "warm wood tones",
  "copy_style": "emotional"
}
```

Schema đầy đủ: [`_shared/schema/brief.schema.json`](D:\AI PROJECT\openclaw-hma\_shared\schema\brief.schema.json).

> **Mẹo:** Có thể dùng skill `hma-research --enrich` để Vision phân tích ảnh sản phẩm và auto-điền các trường còn thiếu.

### 4.3. Lệnh thường dùng (gõ trong Openclaw session)

| Mục đích | Lệnh |
|----------|------|
| Pipeline đầy đủ (8 listing + 5 A+ + video) | `/hma-master ../data/TNTD050526i801` |
| Chỉ listing 8 slot | `/hma-listing ../data/TNTD050526i801` |
| Chỉ A+ 5 module | `/hma-aplus ../data/TNTD050526i801` |
| Chỉ video | `/hma-video ../data/TNTD050526i801` |
| Dry-run (không tốn credit) | `/hma-master ../data/TNTD050526i801 --dry-run` |
| Bỏ web research (nhanh hơn) | `/hma-master ../data/TNTD050526i801 --no-web-research` |
| QC sau pipeline | `/hma-master ../data/TNTD050526i801 --qc` |
| Quản lý knowledge base | `/hma-knowledge list` |

### 4.4. Iteration — regen 1 slot mà không tốn credit cho cả 8

Đây là kỹ thuật **bắt buộc** để tiết kiệm chi phí. Mỗi slot = 1 KIE call ≈ $0.05-0.10.

```
/hma-listing ../data/TNTD050526i801 --skip-slots slot2,slot4
```

→ Pipeline tự xóa `slot2` + `slot4` khỏi `_progress.json`, xóa file JPG cũ, regen ĐÚNG 2 slot đó. 6 slot còn lại không bị động vào.

Cũng áp dụng cho A+ module: `--skip-slots aplus_m3` regen module 3.

**Quy trình iteration chuẩn khi fix QC fail:**

1. Pipeline xong → review output → xác định slot nào fail
2. Edit prompt/constraints/anti-patterns trong `_shared/rules/`
3. `--skip-slots <slot-fail>` regen
4. QC lại

### 4.5. Output

Sau khi pipeline xong, kết quả ở:

```
data/TNTD050526i801/output/
├── listing/
│   ├── TNTD050526i801_slot1_main.jpg        ← 2000×2000
│   ├── ... (8 slot tổng cộng)
│   ├── _progress.json                        ← state cho iteration
│   └── cohesion_report.json                  ← QC scores 4 chiều
├── aplus/
│   ├── TNTD050526i801_m1_*.jpg              ← 1464×600
│   ├── ... (5 module)
│   └── _progress.json
└── video/
    ├── TNTD050526i801.mp4                   ← 1920×1080, 20-25s
    ├── storyboard.json
    └── _progress.json
```

---

## 5. Troubleshooting

### Lỗi `npm install` fail trên `sharp`

**Nguyên nhân:** thiếu Visual C++ Redistributable.

**Fix:** Tải https://aka.ms/vs/17/release/vc_redist.x64.exe → cài → restart PowerShell → `setup.ps1` lại.

### Lỗi `Cannot find module 'sharp'` khi chạy precheck

`npm install` trong `runtime\legacy\` chưa chạy thành công. Chạy lại:
```powershell
cd runtime\legacy
npm install
cd ..\..
```

### `KIE_KEY missing`

Mở `runtime\.env`, đảm bảo có dòng `KIE_KEY=sk-...` (không phải `sk-replace-me`).

### Openclaw không thấy 13 skills

Check symlink:
```cmd
dir "%USERPROFILE%\.openclaw\workspace\openclaw-hma\skills"
```
Phải thấy 13 thư mục `hma-*`. Nếu không có, mklink chưa thành công → chạy lại Bước 4.

Trong Openclaw, gõ `/new` để reload.

### Pipeline timeout 30 phút

KIE.ai bị chậm hoặc job stuck. Check status tại https://kie.ai/. Pipeline tự retry 6 lần với jitter trước khi bỏ cuộc. Nếu vẫn fail, dùng `--skip-slots <stuck-slot>` để regen riêng slot đó sau.

### Antivirus block sharp ghi file

Lỗi `EBUSY` khi sharp ghi JPG. Exclude folder `data/` khỏi real-time scan.

### `pack.ps1` báo "ABORT: contains real KIE_KEY"

Bạn đang pack mà `runtime\.env` có key thật. Cách fix:
```powershell
Copy-Item runtime\.env runtime\.env.backup
Copy-Item runtime\.env.example runtime\.env -Force
.\pack.ps1
Copy-Item runtime\.env.backup runtime\.env -Force
Remove-Item runtime\.env.backup
```

---

## 6. Doctrine — quy tắc nội dung

Pipeline enforce một số quy tắc bất di bất dịch (gọi là Doctrine). Các quy tắc nóng nhất:

- **F1-F8**: product fidelity rules — output phải khớp ảnh ref về cấu trúc, vật liệu, tỉ lệ
- **RULE-016 (slot 3)**: locked combined infographic — features + size cùng frame
- **RULE-017 (slot 5)**: 2×2 DECORATE ANYWHERE grid, đúng 4 ô, không có hero floating
- **RULE-019 (slot 7)**: emotional gift moment — chỉ tay/torso, **KHÔNG hiện mặt người**
- **RULE-015**: prompt > 180 từ → AI tự "reimagine" sản phẩm thay vì copy ref. Giữ prompt ngắn gọn.
- **No variant-label leak**: tên category (HEART FLOWER, MOM, ...) chỉ ở banner pills, không in lên mặt sản phẩm

Đọc đầy đủ: [`_shared/doctrine/handmade-product-doctrine.md`](D:\AI PROJECT\openclaw-hma\_shared\doctrine\handmade-product-doctrine.md).

---

## 7. Cấu trúc folder tổng quan

```
openclaw-hma/
├── HUONG-DAN.md         ← file này
├── README.md            ← quickstart tiếng Anh
├── AGENTS.md            ← cho Openclaw agent đọc
├── SOUL.md              ← personality
├── TOOLS.md             ← config local (env, paths)
├── VERIFICATION.md      ← chi tiết 8 bước verify
├── BOOTSTRAP.md         ← (legacy, để tham khảo)
├── setup.ps1            ← cài đặt 1 lệnh
├── pack.ps1             ← đóng gói zip
│
├── skills/              ← 13 SKILL.md (Openclaw đọc folder này)
│   ├── hma-master/
│   ├── hma-listing/
│   └── ... (11 skill khác)
│
├── _shared/             ← doctrine, rules, prompts, knowledge, config
│   ├── doctrine/
│   ├── rules/
│   └── ...
│
├── runtime/             ← code thực thi
│   ├── package.json
│   ├── .env             ← bạn điền KIE_KEY ở đây
│   ├── bin/             ← entry scripts (.mjs)
│   ├── lib/             ← bridge tới legacy
│   └── legacy/          ← code production embedded (CommonJS)
│
└── data/                ← per-SKU data (bạn tự tạo)
    └── <SKU>/
```

---

## 8. Pack lại để gửi máy khác

```powershell
cd "D:\AI PROJECT\openclaw-hma"
.\pack.ps1
```

Tạo `D:\AI PROJECT\openclaw-hma-v0.1.1-<timestamp>.zip`. Script tự scan KIE_KEY trước khi đóng gói — không lo leak key.

---

## 9. Đọc thêm khi cần sâu hơn

| Chủ đề | File |
|--------|------|
| Architecture chi tiết | [`README.md`](D:\AI PROJECT\openclaw-hma\README.md) |
| Cho Openclaw agent đọc khi work | [`AGENTS.md`](D:\AI PROJECT\openclaw-hma\AGENTS.md) |
| Personality của HMA | [`SOUL.md`](D:\AI PROJECT\openclaw-hma\SOUL.md) |
| 8 bước verify đầy đủ | [`VERIFICATION.md`](D:\AI PROJECT\openclaw-hma\VERIFICATION.md) |
| Runtime architecture | [`runtime/README.md`](D:\AI PROJECT\openclaw-hma\runtime\README.md) |
| Doctrine handmade product | [`_shared/doctrine/handmade-product-doctrine.md`](D:\AI PROJECT\openclaw-hma\_shared\doctrine\handmade-product-doctrine.md) |
| Anti-patterns + RULE catalog | [`_shared/rules/prompt-anti-patterns.md`](D:\AI PROJECT\openclaw-hma\_shared\rules\prompt-anti-patterns.md) |
| Slot constraints (machine-readable) | [`_shared/rules/slot-constraints.json`](D:\AI PROJECT\openclaw-hma\_shared\rules\slot-constraints.json) |
| Brief schema | [`_shared/schema/brief.schema.json`](D:\AI PROJECT\openclaw-hma\_shared\schema\brief.schema.json) |

---

## 10. Hỗ trợ

- Bug runtime → check `runtime/lib/legacy-bridge.mjs` + log subprocess
- Doctrine question → đọc `_shared/doctrine/handmade-product-doctrine.md`
- Skill không hoạt động đúng → check `skills/<skill-name>/SKILL.md` + `runtime/bin/<entry>.mjs`
- Openclaw issue (channel, agent setup) → docs.openclaw.ai

Khi báo cáo lỗi, gửi kèm:
- Lệnh đã chạy
- Error message đầy đủ
- Output `runtime\.env` đã masked KIE_KEY
- Output của `node bin\precheck.mjs <SKU>` nếu liên quan listing
