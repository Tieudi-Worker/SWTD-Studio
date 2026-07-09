<div align="center">

<img src="brand/logo.png" width="120" alt="SWTD Studio" />

# SWTD Studio

**App Windows tạo bộ ảnh bán hàng Amazon bằng AI — từ vài tấm ảnh chụp thật của sản phẩm.**

![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011%20(64--bit)-2563eb)
![License](https://img.shields.io/badge/license-Proprietary-3fb950)

[Cài đặt](#-cài-đặt) · [Cấu hình key](#-cấu-hình-api-key) · [Cách dùng](#-cách-dùng) · [Cập nhật](#%EF%B8%8F-cập-nhật) · [Gỡ lỗi](#-gỡ-lỗi-thường-gặp)

</div>

---

## App này làm gì?

Bạn đưa vào **3–8 tấm ảnh chụp thật** của sản phẩm + điền vài thông tin (tên, chất liệu, kích thước, dịp tặng). App tự nghiên cứu, lên ý tưởng, rồi gọi AI vẽ ra:

- **8 ảnh listing** (2000×2000) — ảnh chính nền trắng, ảnh đang dùng, infographic tính năng, kích thước, bộ quà, lifestyle…
- **5 banner A+ Content** — kể chuyện sản phẩm liền mạch để tăng chuyển đổi.

Ảnh được vẽ trên máy chủ của nhà cung cấp AI (KIE.ai) — **máy bạn không cần cấu hình mạnh**, app chỉ điều phối và ghép ảnh.

**Về chi phí:** bạn dùng **API key KIE.ai của chính bạn** và trả phí theo số ảnh tạo. App miễn phí, không thu phí gì thêm, và **không gửi key của bạn đi đâu** — key được mã hoá trong kho bảo mật của Windows, nằm nguyên trên máy bạn.

---

## 💻 Cần gì để dùng

| | |
|---|---|
| Máy | Windows 10/11 (64-bit), ~300 MB trống |
| Mạng | Có internet (để gọi AI tạo ảnh) |
| **Bắt buộc** | 1 API key **[KIE.ai](https://kie.ai)** (nạp credit → tạo key) |
| Nên có | 1 key "Bộ não AI" (**OpenRouter** hoặc app **9router** trên máy) — giúp AI nghiên cứu sản phẩm trước khi vẽ, ảnh bám sản phẩm hơn hẳn. Thiếu vẫn chạy được |

---

## 📥 Cài đặt

### Cách 1 — Tải bản cài sẵn (khuyến nghị)

1. Vào trang **[Releases](https://github.com/Tieudi-Worker/SWTD-Studio/releases)**.
2. Tải file **`SWTD-Studio-Setup-x.y.z.exe`** ở bản mới nhất.
3. Chạy file. Windows có thể hiện cảnh báo SmartScreen (app chưa mua chứng chỉ ký số, không phải virus):
   > **Windows protected your PC** → bấm **More info** → **Run anyway**.
4. Chọn thư mục cài (để mặc định cũng được) → **Install** → mở app.

> Cài **theo người dùng**, không cần quyền admin. Gỡ app: *Settings → Apps → SWTD Studio → Uninstall* (dữ liệu SKU của bạn không bị xoá).
>
> Trình duyệt/mạng công ty chặn tải `.exe`? Tải bản **`.zip`** ở Releases — giải nén ra được trình cài + hướng dẫn.

### Cách 2 — Cài bằng 1 dòng lệnh

Mở **PowerShell**, dán:

```powershell
irm https://raw.githubusercontent.com/Tieudi-Worker/SWTD-Studio/main/install.ps1 | iex
```

Script tự tải bản mới nhất từ Releases rồi chạy trình cài. Chạy lại đúng dòng này bất cứ lúc nào để **cập nhật**.

---

## 🔑 Cấu hình API key

Làm **1 lần** sau khi cài (app cũng có wizard hướng dẫn ngay lần mở đầu):

1. Mở app → **Cài đặt**.
2. Dán **KIE.ai API key** → **Lưu**. *(bắt buộc — đây là key trả phí vẽ ảnh)*
3. *(Nên làm)* Mục **Bộ não AI (Text-LLM)**: chọn **OpenRouter** (chỉ cần đăng ký lấy key, không cài gì) hoặc **9router** (nếu bạn đã cài app 9router trên máy) → dán key → **Lưu & kiểm tra**.

Góc trái dưới của app hiển thị **credit KIE còn lại** theo thời gian thực.

---

## 🚀 Cách dùng

Luồng chính đi theo menu trái: **Sản phẩm → Tạo ảnh → Ảnh đã tạo → Xuất bản**.

1. **Chuẩn bị ảnh chụp thật** — rõ nét, nhiều góc (chính diện, 3/4, cận chi tiết). Ảnh càng rõ, AI vẽ càng đúng phom. *Chỉ nhận JPG/PNG/WEBP — ảnh iPhone HEIC cần chuyển sang JPG trước.*
2. **Tạo SKU** — vào *Sản phẩm* → *Tạo SKU*: đặt mã, kéo ảnh vào, điền brief (điền càng đủ, ảnh ra càng đúng ý).
3. **Tạo ảnh** — vào *Tạo ảnh*, bấm chạy **Listing** hoặc **A+** (hoặc cả hai). Mất vài phút; theo dõi tiến độ ở *Ảnh đã tạo* và *Tiến trình*.
4. **Sửa ảnh chưa ưng** — mở ảnh → **Tạo lại có chỉ dẫn**: chỉ làm lại đúng ảnh đó (không tốn lại tiền các ảnh đã đạt). Mỗi ảnh cũng có nút **tải về máy** riêng.
5. **Xuất bản** — gom toàn bộ ảnh hoàn chỉnh ra một thư mục sạch để tải lên Amazon.

Vài thứ tiện tay:

- **Chạy 2 sản phẩm cùng lúc**, hoặc chọn nhiều SKU ở màn *Sản phẩm* → **Chạy hàng loạt** qua đêm (app tự chạy lần lượt, xong báo).
- **Thư viện**: lưu màu thương hiệu + template bố cục để các SKU sau ra ảnh đồng bộ phong cách.
- Mọi lượt chạy đều ghi **nhật ký ra file** (*Cài đặt → Mở thư mục log*) — gặp lỗi chỉ cần gửi file log là đủ để hỗ trợ.

---

## ⬆️ Cập nhật

- **Tự động:** có bản mới là app tự tải nền rồi hiện nút **"Cập nhật ngay"** ngay cạnh số phiên bản — bấm là xong. Muốn kiểm tra ngay: *Cài đặt → Kiểm tra bản mới*.
- **Bằng lệnh:** chạy lại dòng PowerShell ở [Cách 2](#cách-2--cài-bằng-1-dòng-lệnh).
- **Thủ công:** tải `SWTD-Studio-Setup-x.y.z.exe` mới nhất từ Releases, chạy đè lên bản cũ. Dữ liệu SKU giữ nguyên.

---

## 🛠 Gỡ lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| SmartScreen chặn khi cài | **More info → Run anyway** (app chưa ký số, không phải virus). |
| Tạo ảnh báo lỗi / không ra ảnh | Kiểm tra **KIE.ai key** ở *Cài đặt* và tài khoản KIE **còn credit**. |
| Báo *"Bộ não AI không phản hồi"* | App chủ động dừng để không tốn credit vẽ ảnh kém. Kiểm tra: 9router đang chạy / key OpenRouter còn hạn mức / tên model đúng — rồi chạy lại. |
| Toast *"Xong nhưng THIẾU ảnh"* | Một vài ảnh lỗi (thường do dịch vụ AI quá tải). Bấm **Tạo ảnh** lại — app chỉ chạy phần thiếu, không tính tiền lại phần đã xong. |
| Ảnh "chung chung", kém bám sản phẩm | Cấu hình **Bộ não AI** ở *Cài đặt* (OpenRouter/9router). |
| Báo đường dẫn quá dài | Chuyển thư mục sản phẩm ra chỗ ngắn hơn (vd `D:\SWTD\ten-ngan`) rồi mở lại. |
| Brief liệt kê ảnh nhưng "0 ảnh" | Ảnh gốc bị đổi tên/di chuyển — thêm lại ảnh vào SKU rồi chạy lại. |

---

## 📄 Giấy phép

Phần mềm sở hữu độc quyền, **giữ toàn bộ bản quyền**. Bạn được **tải, cài và dùng** app miễn phí (cá nhân hoặc nội bộ doanh nghiệp) — nhưng **không được** tái phân phối, bán lại, hay cung cấp dưới dạng dịch vụ. Chi tiết: [LICENSE](LICENSE).
