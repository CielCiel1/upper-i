# Upper-I — Chia tiền nhóm

## What This Is

Web app chia tiền và theo dõi nợ cho một nhóm cố định dưới 10 người sống/ăn chung lâu dài.
Thay thế một Google Apps Script + Spreadsheet đang dùng, vốn bị sai số liệu do có hai nguồn
sự thật song song (bảng tính dẫn xuất và sổ IOU có trạng thái) và không reset khi chốt kỳ.
Người dùng nhập chi tiêu trên điện thoại ngay tại quán, app tự tính ai nợ ai, rút gọn số lần
chuyển tiền, và hiện QR ngân hàng điền sẵn số tiền để trả trong vài giây.

## Core Value

Số dư luôn đúng và luôn tái lập được từ sổ giao dịch — không bao giờ drift.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Ledger chỉ-ghi-thêm (append-only) là nguồn sự thật duy nhất; mọi số dư là hàm thuần của ledger
- [ ] Toàn bộ tiền lưu bằng số nguyên (đồng VND); không dùng float ở bất kỳ đâu
- [ ] Chia đều cho người được chọn
- [ ] Chia theo tỷ lệ / số phần (A 2 phần, B 1 phần)
- [ ] Chia theo từng món trong bill, có phân bổ ship/VAT theo tỷ lệ
- [ ] Rút gọn nợ (debt simplification) để giảm số lần chuyển tiền
- [ ] Đăng nhập Google OAuth; user ID nội bộ là khoá chính, đổi tên hiển thị không ảnh hưởng lịch sử
- [ ] Mobile-first UX: nhập một khoản chi dưới 15 giây trên điện thoại
- [ ] QR thanh toán VietQR điền sẵn số tiền và nội dung chuyển khoản
- [ ] Xác nhận thanh toán hai chiều (người trả báo, người nhận xác nhận)
- [ ] Lịch sử và báo cáo theo tháng; chốt kỳ không mất dữ liệu và không cộng dồn sai
- [ ] Chụp bill → OCR tự điền line items (phase cuối, sau khi core ổn định)
- [ ] Deploy miễn phí, một lệnh `git push`

### Out of Scope

- Multi-tenant / nhiều nhóm tự đăng ký — chỉ một nhóm cố định; thêm sau nếu thật sự cần
- Migrate dữ liệu Sheets cũ — user chọn bắt đầu lại từ 0
- Tích hợp ngân hàng thật (webhook biến động số dư) — không có API công khai cho cá nhân
- Đa tiền tệ — nhóm chỉ dùng VND
- Native mobile app — PWA đủ dùng
- Sửa/xoá giao dịch tại chỗ — dùng bút toán đảo (reversing entry) để giữ ledger bất biến

## Context

**Hệ thống cũ (Apps Script) và lý do thay:**

Bản cũ có hai nguồn sự thật cho cùng một câu hỏi "ai nợ ai":
`readAllSnapshots_` tính dẫn xuất từ sheet giao dịch (luôn đúng), còn sheet `IOU` là
append-only cộng mutate FIFO (trôi dần). `getSuggestionsFor` đọc IOU trong khi
`getPeopleAndBalances` đọc snapshot → hai con số lệch nhau.

Các lỗi đã xác định, bản mới phải không tái phạm:

1. `actionStartNewPeriod` archive nhưng không xoá rows → kỳ mới cộng dồn kỳ cũ
2. Không có khoá ghi → nhiều người commit cùng lúc gây mất ghi (lost update)
3. Dedup theo `payer|payee|amount` chặn nhầm thanh toán hợp lệ lặp lại, và nuốt im lặng
4. Getter có tác dụng phụ: `getSuggestionsFor` gọi `actionSyncIOU()` ghi sheet
5. QR tải lại base64 từ Drive mỗi lần mở popup, không cache
6. Công thức số dư copy-paste ở hai nơi, dễ sửa lệch
7. Tên người làm khoá chính; `norm_` không bỏ dấu, không lowercase → "quinn" ≠ "Quinn"
8. Chia tiền lẻ bằng float: 100000/3 → tổng 99999.99, mất đồng

**Bài học kiến trúc:** đúng một nguồn sự thật. Số dư là hàm dẫn xuất, không bao giờ
là trạng thái lưu trữ có thể mutate. Nếu cần tốc độ, dùng cache có thể vứt và dựng lại.

## Constraints

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

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Append-only ledger, số dư dẫn xuất | Lỗi chí mạng của bản cũ là hai nguồn sự thật; dẫn xuất thì không thể drift | — Pending |
| Số nguyên đồng VND, không float | Chia 3 bằng float làm mất đồng và tổng không khớp | — Pending |
| Vercel + Neon | Free thật, deploy bằng git push, Postgres chuẩn để Prisma chạy thoải mái | — Pending |
| Google OAuth, user ID là khoá chính | Ai cũng có Gmail; tách tên hiển thị khỏi danh tính để đổi tên không gãy lịch sử | — Pending |
| OCR để phase cuối | AI integration đắt và cần eval riêng; đừng để nó làm đục core money math | — Pending |
| Không migrate Sheets cũ | Chốt kỳ cũ rồi bắt đầu sạch — tiết kiệm nguyên một phase | — Pending |
| Sửa bằng bút toán đảo | Giữ ledger bất biến, có audit trail, tránh race khi sửa tại chỗ | — Pending |
| **Đảo bút toán = phủ định dòng đã lưu, KHÔNG tính lại split** | Research chứng minh `split(−t,w) ≠ −split(t,w)` ở 18% trường hợp, mà tổng vẫn bằng 0 → mọi kiểm tra số dư đều pass, drift vô hình. Đúng loại lỗi đã giết bản cũ | — Pending |
| **Số dư tính on-read, không cache** | Một bảng số dư vật chất hoá chính là sheet `IOU` đổi tên | — Pending |
| **Cột tiền BIGINT, không INTEGER** | INTEGER chặn ở 2,147,483,647 ≈ 2.1 tỷ VND — tổng cả năm của nhóm vượt được | — Pending |
| **Tự build payload VietQR, render QR client-side** | Lý do chính không phải chi phí mà là `img.vietqr.io` đẩy số tài khoản của từng người lên bên thứ ba | — Pending |
| **Thanh toán pending KHÔNG đổi số dư** | Nếu đổi là dựng lại đúng cái dual-source-of-truth đã giết bản cũ. "Trả rồi sao vẫn nợ" là vấn đề hiển thị — giải bằng badge | — Pending |
| **Rút gọn nợ: toggle, mặc định TẮT** | Tiết kiệm 2-4 lần chuyển (vốn đã miễn phí qua NAPAS) nhưng đánh đổi bằng "sao tôi lại nợ người chưa từng ăn chung" | — Pending |
| **Idempotency key sinh lúc MỞ form, không phải lúc submit** | Sinh lúc submit thì mỗi lần bấm là một key mới → vô hiệu hoá hoàn toàn cơ chế chống double-submit | — Pending |
| **Không làm offline queue IndexedDB** | Là nguồn sự thật thứ hai — đúng loại lỗi đã giết bản cũ; iOS Safari cũng không hỗ trợ Background Sync | — Pending |
| Vercel Blob cho ảnh bill | 1 GB ≈ 2000 ảnh đã nén, không cần khai thẻ; đổi sang R2 sau chỉ là đổi adapter | — Pending |
| Line-item split tách thành phase riêng | Chia đều + tỷ lệ phủ ~90% lần dùng; line-item là UI đắt nhất và là thứ OCR feed vào | — Pending |

---
*Last updated: 2026-10-06 after initial questioning*
