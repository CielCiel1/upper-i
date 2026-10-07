<!-- GSD:project-start source:PROJECT.md -->

## Project

**Upper-I — Chia tiền nhóm**

Web app chia tiền và theo dõi nợ cho một nhóm cố định dưới 10 người sống/ăn chung lâu dài.
Thay thế một Google Apps Script + Spreadsheet đang dùng, vốn bị sai số liệu do có hai nguồn
sự thật song song (bảng tính dẫn xuất và sổ IOU có trạng thái) và không reset khi chốt kỳ.
Người dùng nhập chi tiêu trên điện thoại ngay tại quán, app tự tính ai nợ ai, rút gọn số lần
chuyển tiền, và hiện QR ngân hàng điền sẵn số tiền để trả trong vài giây.

**Core Value:** Số dư luôn đúng và luôn tái lập được từ sổ giao dịch — không bao giờ drift.

### Constraints

- **Tech stack**: Next.js (App Router) + Postgres — đã chốt
- **Hosting**: Vercel Hobby + Neon Postgres, tầng miễn phí; deploy bằng `git push`
- **Auth**: Google OAuth
- **Budget**: 0đ/tháng; mọi dịch vụ phải có tầng free đủ dùng cho < 10 user
- **Neon free tier**: 1 GB storage/project, compute tự suspend khi nhàn rỗi (resume vài trăm ms — không cần kiến trúc né tránh); 100 CU-hours/tháng
- **Vercel Hobby**: chỉ dùng phi thương mại; function timeout 300s; server action body cap 4.5 MB → phải nén ảnh phía client
- **Cron**: Vercel Hobby chỉ cho 1 lần/ngày — không dùng được keep-alive, và cũng không nên
- **Device**: dùng chính trên điện thoại, mạng 4G chập chờn ở quán ăn
- **Money**: tiền là số nguyên đồng VND; phần dư chia hết phải được phân bổ tất định
- **Concurrency**: nhiều người ghi cùng lúc là chuyện bình thường, không phải ngoại lệ

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
