# Seedance 2.0 UGC Video Doctrine cho Handmade Media Agent (HMA)

## 1. Nguyên Tắc Cốt Lõi (Core Principles)
1. **Reference Image là chân lý duy nhất:** Khi render video sản phẩm Handmade, LUÔN LUÔN sử dụng đúng 1 bức ảnh chụp (hoặc render) nét nhất của sản phẩm ở mục `Start Frame` hoặc `Image Reference`.
2. **Không nạp đè chi tiết lên Text Prompt:** Text prompt tuyệt đối KHÔNG mô tả lại hình dáng, text hay logo của sản phẩm (sẽ gây biến dạng/mất chữ). Toàn bộ sức mạnh của text prompt phải được dồn vào việc đạo diễn: **Camera Movement**, **Scene/Props**, **Lighting**, và **Audio**.
3. **Bảo Toàn Nguyên Trạng Sản Phẩm (Zero Hallucination):** Tuyệt đối KHÔNG được thay đổi cấu trúc sản phẩm gốc, KHÔNG được thêm hay bớt họa tiết, KHÔNG làm sai lệch chữ viết hoặc hình khối. Viết prompt phải tập trung vào bối cảnh và môi trường để giữ chính xác 100% hình thái sản phẩm ở mọi góc quay.
4. **Timeline-based Workflow:** Video quảng cáo mang lại tỷ lệ chuyển đổi tốt nhất (đặc biệt trên TikTok/Reel) là định dạng UGC (User Generated Content) dạng chuỗi liên tiếp (Multi-shot Sequence) dài khoảng 15 giây.

## 2. Cấu Trúc Tổng Thể (Master Prompt)
**Base Style (Phong cách gốc):**
> *Ultra-realistic iPhone-shot UGC ad, handheld front camera + rear camera mix, natural home environment, soft window daylight, slightly imperfect framing, real TikTok-style authenticity. CRITICAL NEGATIVE PROMPT: Do NOT alter the original product structure. Do NOT add, remove, or modify any patterns, text, or shapes. Maintain 100% exact conformity to the reference image.*

---

## 3. Kiến Trúc Kịch Bản 15 Giây (9 Phân Cảnh)

HMA hiện hỗ trợ 2 cấu trúc (Pipeline) chính cho việc thiết kế video. Tùy thuộc vào chiến lược (`video_style`), một kịch bản 9-shot chi tiết sẽ được tự động thiết kế để ép Seedance 2.0 / Kling render kết quả tốt nhất.

### 🎬 Option 1: Lifestyle Cinematic (`video_style: 'lifestyle'`)
Tập trung vào sự gần gũi, ấm áp, ánh sáng mặt trời tự nhiên, môi trường nhà cửa chân thực, và cảm xúc của người dùng. Tương thích nhất với thị trường quà tặng, UGC Tiktok.
- **Shot 1 (0.0s - 1.5s):** Establishing Reveal (Close-up, warm morning sunlight, natural shadow)
- **Shot 2 (1.5s - 3.5s):** Slow Push-In (Slow smooth camera towards the product)
- **Shot 3 (3.5s - 5.5s):** Action Anticipation (Hand reaches into the frame, shallow depth of field)
- **Shot 4 (5.5s - 7.0s):** Action Detail (Extreme close-up macro, dropping an element)
- **Shot 5 (7.0s - 8.5s):** Camera Arc (Slow pan catching sun flares)
- **Shot 6 (8.5s - 10.0s):** Rack Focus (Starting blur, elegantly coming into sharp macro focus)
- **Shot 7 (10.0s - 11.5s):** Wide Context (Medium wide shot, cozy inspiring atmosphere)
- **Shot 8 (11.5s - 13.0s):** Final Action (Fast dynamic pan, robust interaction)
- **Shot 9 (13.0s - 15.0s):** Hero Hold (Static, magical bokeh background)

### 📺 Option 2: Premium TVC Commercial (`video_style: 'tvc'`)
Tập trung vào tính chuyên nghiệp, bóng bẩy (glossy), ánh sáng studio đánh khối, và chuyển động máy quay cao cấp (robotic arms).
- **Shot 1 (0.0s - 2.0s):** The High-End Reveal (Fast snap-zoom out, studio lighting, crisp contrast)
- **Shot 2 (2.0s - 4.0s):** The Premium Material (Slow precision robotic track, rim lights reflecting off surface)
- **Shot 3 (4.0s - 5.5s):** The 'Wow' Action (High-speed slow-motion 120fps)
- **Shot 4 (5.5s - 7.5s):** The Dynamic Spin (180-degree orbital spin, modern premium desk)
- **Shot 5 (7.5s - 9.5s):** The User Interaction (Smooth slider push, clean hand, lens flare)
- **Shot 6 (9.5s - 11.0s):** The Impact (Macro low-angle, sweeping spotlight)
- **Shot 7 (11.0s - 13.0s):** The Lifestyle Integration (Crane pull-back, luxurious styled setting)
- **Shot 8 (13.0s - 15.0s):** The Ultimate Hero Hold (Static ultra-sharp, negative space for text)

---

## 4. Tích Hợp Kỹ Thuật (HMA Core Pipeline)
1. **Reference Image Mapping:** Đối với 2 style mới này, HMA sẽ **Bypass quá trình sinh AI Start Frame**. Thay vào đó, HMA lấy trực tiếp `inputImages[0]` (Ảnh Reference) để làm First Frame URL. Điều này bảo vệ 100% hình thái sản phẩm.
2. **Audio/Foley:** Âm thanh vật lý sẽ do AI sinh theo action trong prompt. Lồng tiếng (Voiceover) được add ở khâu hậu kỳ.
