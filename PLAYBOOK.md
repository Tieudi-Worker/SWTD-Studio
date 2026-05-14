# SWTD-Studio — Agent Playbook

> Claude Code tự động đọc file này khi mở project.  
> Mục đích: route đúng skill flow cho từng loại task, không guess.

---

## 1. Phân loại task & route tương ứng

### TASK NHỎ (< 30 phút)
Hotfix, tweak UI, sửa lỗi đơn giản, đổi text/icon, clean up nhẹ.

| Bước | Skill | Ghi chú |
|---|---|---|
| 1 | `/matt-grill-me` | Chốt nhanh mong muốn |
| 2 | Code + test | Dùng `/matt-tdd` nếu cần test |
| 3 | Self-review | Tự review diff, đảm bảo surgical |
| 4 | Commit | Commit ngắn gọn, message rõ ràng |

### TASK VỪA (30 phút – 2 giờ)
Refactor cục bộ, thêm component shell mới, tối ưu IPC/runner, validator module.

| Bước | Skill | Ghi chú |
|---|---|---|
| 1 | `/matt-grill-with-docs` | Có lưu vào CONTEXT.md / ADR nếu cần |
| 2 | `/matt-zoom-out` | Định vị module trong hệ thống trước khi sửa |
| 3 | Phác plan ngắn | Plan trong chat (không cần Spec Kit full) |
| 4 | Implement | Dùng `/matt-tdd` nếu thêm logic mới |
| 5 | `/matt-diagnose` | Nếu có bug trong quá trình |
| 6 | Self-review | Kiểm tra diff + `npm run build:renderer` |
| 7 | Commit | Commit message có scope rõ |

### FEATURE LỚN / PHASE MỚI (> 2 giờ)
Milestone (A+ Pipeline, Video, QC, refactor kiến trúc lớn).

| Bước | Skill | Ghi chú |
|---|---|---|
| 1 | `/speckit-specify` | Viết spec tổng thể |
| 2 | `/matt-grill-with-docs` | Challenge spec trước khi plan |
| 3 | `/speckit-plan` | Tạo implementation plan |
| 4 | `/speckit-tasks` | Break down thành task list |
| 5 | `/speckit-analyze` (optional) | Check consistency trước implement |
| 6 | `/speckit-checklist` (optional) | Tạo QC checklist |
| 7 | Implement theo từng task | Dùng `/matt-tdd` + `/matt-diagnose` + `/matt-zoom-out` |
| 8 | `/matt-to-issues` (optional) | Convert task thành GitHub issues nếu cần track |
| 9 | `/speckit-implement` hoặc implement tuần tự | Theo plan đã duyệt |
| 10 | Post-implement review | `/matt-diagnose` nếu có lỗi, `/matt-zoom-out` nếu cần refactor |

### DEBUG / BUG SÂU

| Bước | Skill | Ghi chú |
|---|---|---|
| 1 | `/matt-diagnose` | Reproduce → isolate → hypothesise → fix → regression test |
| 2 | Nếu cần rollback/safe git | Dùng `/matt-git-guardrails-claude-code` |
| 3 | Commit fix | Message mô tả root cause |

### REFACTOR KIẾN TRÚC / CODEBASE HEALTH

| Bước | Skill | Ghi chú |
|---|---|---|
| 1 | `/matt-zoom-out` | Định vị trước khi refactor |
| 2 | `/matt-improve-codebase-architecture` | Tìm điểm rối và module sâu |
| 3 | Plan + triển khai | Theo flow task vừa hoặc lớn tùy mức |

---

## 2. Nguyên tắc bắt buộc (mọi task)

| Rule | Source |
|---|---|
| Surgical changes, không đụng code không liên quan | `karpathy-guidelines` + `tinbeta-coding-guardrail` |
| Think before coding, đặt assumption rõ ràng | `karpathy-guidelines` |
| Match convention codebase hiện tại | `karpathy-guidelines` + `tinbeta-coding-guardrail` |
| Verify build + test trước khi claim done | `karpathy-guidelines` |
| Fail loud — không im lặng skip | `tinbeta-coding-guardrail` |
| UI chất lượng cao, tránh AI slop | `frontend-design` + `brand-guidelines` + `theme-factory` |
| TDD cho logic mới | `matt-tdd` + `superpowers-test-driven-development` |
| Sub-agent cho task song song | `superpowers-subagent-driven-development` |
| Checkpoint sau mỗi bước lớn | `karpathy-guidelines` + `tinbeta-coding-guardrail` |
| Không push — chỉ OpenClaw review rồi push | Quy tắc chủ dự án (Boss) |

---

## 3. Cấu hình project

| Key | Value |
|---|---|
| Stack | Electron + React JSX + Vite, plain CSS (no Tailwind) |
| Tokens | `apps/desktop/src/styles/tokens.css` |
| Runner | `packages/core/src/pipeline-runner.js` |
| IPC | `apps/desktop/electron/main.cjs` → `preload.cjs` → `window.swtd` |
| Build verify | `cd apps/desktop && npm run build:renderer` |
| Dev run | `cd apps/desktop && DISPLAY=:0 npm run dev` |
| Git convention | `type(scope): description` |

---

## 4. Ghi chú hệ thống

- Repo này là private, chỉ Boss + OpenClaw (Tiểu Di) dùng.
- OpenClaw (không phải Claude Code) quyết định commit/push/merge vào main.
- Claude Code đọc file này + skill trong `.claude/skills/` mỗi phiên.
- Khi không rõ route task nào → mặc định chọn **TASK VỪA**.
