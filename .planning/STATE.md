---
gsd_state_version: 1.0
milestone: v8.0.0
milestone_name: milestone
current_phase: 1
current_phase_name: Nền tảng sống
status: executing
stopped_at: Completed 01-04 — auth, allowlist gate and route guard; next is 01-05 (screens)
last_updated: "2026-10-07T08:42:50.620Z"
last_activity: 2026-10-07
last_activity_desc: "Completed 01-04: Google sign-in, allowlist gate, route guard"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 6
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-06)

**Core value:** Số dư luôn đúng và luôn tái lập được từ sổ giao dịch — không bao giờ drift.
**Current focus:** Phase 1 — Nền tảng sống

## Current Position

Phase: 1 of 9 (Nền tảng sống)
Plan: 6 of 6 in current phase
Status: **Blocked on human checkpoint** — 01-06 Task 1 (docs) done, Task 2 needs Neon/Vercel/Google accounts
Last activity: 2026-10-07 — 01-06 docs: setup checklist + README written; awaiting the human setup sitting

Progress: [█████████░] 92%

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
| Phase UPI-01-n-n-t-ng-s-ng P01 | 35m | 3 tasks | 14 files |
| Phase UPI-01 P03 | 35m | 3 tasks | 6 files |
| Phase UPI-01 P02 | 25m | 3 tasks | 9 files |
| Phase 1 P04 | 25m | 3 tasks | 6 files |
| Phase UPI-01-n-n-t-ng-s-ng P05 | 35m | 3 tasks | 6 files |

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
- [Phase ?]: 01-03: kept !important in reduced-motion with scoped biome-ignore — @layer base loses the cascade without it (WCAG 2.3.3)
- [Phase ?]: Allowlist has no schema relation to User; session revocation is explicit, protecting Phase 2 ledger FK targets
- [Phase ?]: INFRA-06 pooled-connection assertion throws at module load so a swapped string fails at build, not under production load
- [Phase ?]: Verbatim Vietnamese UI copy is written as JSX string expressions, not bare text — the formatter rewraps bare text and silently breaks exact-match contract greps
- [Phase ?]: The /chua-duoc-moi direct-access guard requires ?error=AccessDenied; it is a usability gate, explicitly not an authentication boundary

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

Last session: 2026-10-07T17:40:00.000Z
Stopped at: 01-06 Task 1 complete (01-SETUP-CHECKLIST.md + README.md). Task 2 is a blocking human checkpoint — no live infrastructure exists yet.
Resume file: .planning/phases/UPI-01-n-n-t-ng-s-ng/01-SETUP-CHECKLIST.md
