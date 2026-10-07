---
gsd_state_version: '1.0'
status: planning
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 44
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-06)

**Core value:** Số dư luôn đúng và luôn tái lập được từ sổ giao dịch — không bao giờ drift.
**Current focus:** Phase 1 — Nền tảng sống

## Current Position

Phase: 1 of 9 (Nền tảng sống)
Plan: 0 of 5 in current phase
Status: Ready to plan
Last activity: 2026-10-06 — Project initialized: PROJECT.md, REQUIREMENTS.md (64 v1 REQ-IDs), ROADMAP.md (9 phases), 4 research docs

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Append-only ledger; số dư tính on-read, không bao giờ vật chất hoá — lỗi chí mạng của bản Apps Script cũ là hai nguồn sự thật
- [Init]: Đảo bút toán phủ định dòng entry đã lưu, KHÔNG tính lại split — research chứng minh `split(−t,w) ≠ −split(t,w)` ở 18% trường hợp mà tổng vẫn bằng 0, nên drift vô hình
- [Init]: Tiền là số nguyên đồng VND ở cột BIGINT; INTEGER chặn ở 2.1 tỷ
- [Init]: Vercel Hobby + Neon + Vercel Blob; 0đ/tháng, deploy bằng `git push`
- [Init]: Idempotency key sinh lúc MỞ form, không phải lúc submit
- [Init]: Thanh toán pending không đổi số dư; rút gọn nợ mặc định TẮT

### Pending Todos

None yet.

### Blockers/Concerns

Từ research, cần để mắt khi tới phase liên quan:

- `npm i prisma` hiện kéo về `8.0.0-rc` trong khi `@prisma/client` là 7.10.0 → phải pin exact, nếu không build đầu tiên gãy (Phase 1)
- Next.js 16 đổi tên `middleware.ts` → `proxy.ts`; hầu hết tutorial còn sai (Phase 1)
- NextAuth v5 vẫn là beta (`5.0.0-beta.32`), npm `latest` trỏ v4 → pin đúng beta (Phase 1)
- Giới hạn độ dài nội dung chuyển khoản của từng ngân hàng không được công bố; research dùng mức thận trọng 25 ký tự → cần test thật 5 phút với ngân hàng thật (Phase 5)
- Prisma BigInt không `JSON.stringify` được, và ranh giới RSC/server action serialize ngầm → phải chuyển đổi ở tầng repository (Phase 2)

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 backlog | NOTI-01 (thông báo đẩy) | Chưa gán phase | 2026-10-06 |
| v2 backlog | EXPORT-01 (xuất CSV) | Chưa gán phase | 2026-10-06 |
| v2 backlog | RECUR-01 (chi tiêu định kỳ) | Chưa gán phase | 2026-10-06 |
| v2 backlog | BUDGET-01 (hạn mức tháng) | Chưa gán phase | 2026-10-06 |

## Session Continuity

Last session: 2026-10-06 23:59
Stopped at: Roadmap created and verified — all 64 v1 REQ-IDs mapped to phases, zero orphans
Resume file: None
