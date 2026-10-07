# Requirements — Upper-I

Derived from PROJECT.md and the four research documents in `.planning/research/`.

**Core Value check:** Số dư luôn đúng và luôn tái lập được từ ledger.
Requirements LEDG-01..07 and MONEY-01..06 exist specifically to make this impossible to violate.

---

## v1 Requirements

### Nền tảng & Triển khai (INFRA)

- [ ] **INFRA-01**: App chạy trên Next.js App Router với TypeScript strict mode, Prisma pinned ở v7 (không để npm kéo v8-rc)
- [ ] **INFRA-02**: Dev chạy được local với Neon connection string, không cần Docker
- [ ] **INFRA-03**: Mỗi lần `git push` lên nhánh chính tự deploy ra production URL trên Vercel, không thao tác tay
- [ ] **INFRA-04**: Prisma migration chạy tự động khi deploy; schema production luôn khớp code
- [ ] **INFRA-05**: Toàn bộ dịch vụ nằm trong tầng miễn phí; chi phí thực tế 0đ/tháng
- [ ] **INFRA-06**: Kết nối DB dùng pooled connection string + Neon adapter, không cạn connection khi nhiều function chạy song song
- [ ] **INFRA-07**: App shell render tĩnh nên người dùng thấy giao diện ngay cả khi Neon compute đang resume

### Xác thực & Thành viên (AUTH)

- [ ] **AUTH-01**: Người dùng đăng nhập bằng tài khoản Google, một chạm
- [ ] **AUTH-02**: Chỉ email nằm trong allowlist lưu ở DB mới đăng nhập được; thêm thành viên mới là một dòng INSERT, không cần deploy lại
- [ ] **AUTH-03**: Người dùng giữ nguyên phiên đăng nhập qua nhiều lần mở app, không phải login lại mỗi ngày
- [ ] **AUTH-04**: Danh tính nội bộ là `User.id`; đổi tên hiển thị không ảnh hưởng bất kỳ dòng ledger lịch sử nào
- [ ] **AUTH-05**: Người dùng tự sửa tên hiển thị và ảnh đại diện của mình
- [ ] **AUTH-06**: Người dùng đăng xuất được từ mọi màn hình

### Ledger & Tính đúng (LEDG)

- [ ] **LEDG-01**: Mọi giao dịch ghi vào một ledger chỉ-ghi-thêm; không có đường code nào UPDATE hay DELETE một dòng ledger
- [ ] **LEDG-02**: Số dư của mọi người được tính on-read bằng một truy vấn tổng hợp trên ledger; không tồn tại bảng số dư vật chất hoá
- [ ] **LEDG-03**: Sửa một khoản chi đã ghi tạo ra một bút toán đảo phủ định đúng các dòng entry đã lưu, không tính lại phép chia
- [ ] **LEDG-04**: Xoá một khoản chi tạo bút toán đảo; dòng gốc vẫn còn để truy vết
- [ ] **LEDG-05**: Mọi lệnh ghi mang idempotency key sinh lúc mở form, có unique index ở DB; submit lại cùng form không tạo bản ghi thứ hai
- [ ] **LEDG-06**: Có test property-based khẳng định tổng mọi số dư luôn bằng 0, trên dữ liệu sinh ngẫu nhiên
- [ ] **LEDG-07**: Có test khẳng định expense + reversal của nó làm mọi số dư trở về đúng trạng thái trước đó

### Toán tiền (MONEY)

- [ ] **MONEY-01**: Mọi số tiền lưu dưới dạng số nguyên đồng VND ở cột BIGINT; không có kiểu dấu phẩy động nào trong đường đi của tiền
- [ ] **MONEY-02**: Một hàm chia duy nhất `splitByWeights` phục vụ cả chia đều, chia theo phần, và chia theo phần trăm — không có công thức nào bị lặp lại ở nơi thứ hai
- [ ] **MONEY-03**: Phép chia dùng phương pháp số dư lớn nhất, đảm bảo tổng các phần luôn đúng bằng tổng gốc, không mất đồng nào
- [ ] **MONEY-04**: Cùng một input luôn cho ra cùng một cách phân bổ phần dư, không phụ thuộc thứ tự truy vấn
- [ ] **MONEY-05**: Giá trị BigInt được chuyển đổi tại ranh giới repository nên không có lỗi serialize nào rò ra server action hay client component
- [ ] **MONEY-06**: Có test property-based khẳng định bất biến tổng cho cả ba kiểu chia

### Ghi chi tiêu (EXP)

- [ ] **EXP-01**: Người dùng ghi một khoản chi chia đều cho cả nhóm trong dưới 15 giây trên điện thoại
- [ ] **EXP-02**: Ô nhập số tiền được focus sẵn khi mở form, hiện bàn phím số, tự chèn dấu phân cách hàng nghìn mà không nhảy con trỏ
- [ ] **EXP-03**: Người trả mặc định là người đang đăng nhập, đổi được bằng một chạm
- [ ] **EXP-04**: Người hưởng mặc định là tất cả thành viên, đổi được bằng một chạm
- [ ] **EXP-05**: Người dùng chọn nội dung từ các chip gợi ý xếp theo tần suất dùng, thay vì gõ tay
- [ ] **EXP-06**: Người dùng chia theo số phần không bằng nhau (A 2 phần, B 1 phần)
- [ ] **EXP-07**: Người dùng ghi một khoản nạp quỹ
- [ ] **EXP-08**: Người dùng sửa hoặc xoá khoản chi của chính mình, tạo bút toán đảo
- [ ] **EXP-09**: Giao diện cập nhật lạc quan ngay khi bấm lưu, tự khôi phục nếu server trả lỗi
- [ ] **EXP-10**: Nút thêm chi tiêu hiện trên mọi tab chính; form mở dạng bottom sheet, không chuyển trang

### Thanh toán & QR (PAY)

- [ ] **PAY-01**: Người dùng lưu thông tin ngân hàng của mình (mã BIN + số tài khoản) chọn từ danh sách ngân hàng Việt Nam có sẵn
- [ ] **PAY-02**: App dựng payload VietQR đúng chuẩn EMVCo kèm CRC16, điền sẵn số tiền và nội dung chuyển khoản
- [ ] **PAY-03**: Mã QR render phía client; số tài khoản thành viên không bao giờ gửi tới bên thứ ba
- [ ] **PAY-04**: Nội dung chuyển khoản chứa token định danh riêng cho từng lần thanh toán, chỉ dùng ký tự ngân hàng chấp nhận
- [ ] **PAY-05**: Người trả bấm "đã chuyển" tạo một thanh toán ở trạng thái chờ
- [ ] **PAY-06**: Thanh toán đang chờ KHÔNG làm thay đổi số dư của bất kỳ ai
- [ ] **PAY-07**: Người nhận thấy danh sách thanh toán chờ xác nhận và bấm "đã nhận"; chỉ khi đó ledger mới được ghi
- [ ] **PAY-08**: Người nhận từ chối được một thanh toán chờ, kèm lý do
- [ ] **PAY-09**: Người trả huỷ được thanh toán chờ của mình khi chưa ai xác nhận
- [ ] **PAY-10**: Người trả thấy badge "đang chờ xác nhận" bên cạnh số dư nên hiểu vì sao vẫn còn nợ
- [ ] **PAY-11**: Người dùng bật/tắt rút gọn nợ; mặc định tắt
- [ ] **PAY-12**: Khi bật rút gọn, app gợi ý tập chuyển tiền tối thiểu và giải thích được vì sao lại trả cho người đó

### Hiển thị số dư (BAL)

- [ ] **BAL-01**: Màn hình chính nói rõ bằng câu, không phải số có dấu — ví dụ "Bạn đang nợ 150.000 ₫"
- [ ] **BAL-02**: Người dùng thấy chi tiết nợ từng người, nhóm theo chiều nợ/được nợ
- [ ] **BAL-03**: Người dùng mở được một khoản nợ để xem đúng những chi tiêu nào tạo ra nó
- [ ] **BAL-04**: Số dư hiển thị đúng khớp với truy vấn tổng hợp trên ledger tại mọi thời điểm

### Lịch sử & Kỳ (HIST)

- [ ] **HIST-01**: Người dùng xem dòng thời gian mọi giao dịch, mới nhất trước, cuộn vô hạn
- [ ] **HIST-02**: Người dùng lọc lịch sử theo người và theo khoảng thời gian
- [ ] **HIST-03**: Người dùng xem tổng kết theo tháng: tổng chi, chi theo người, chi theo nội dung
- [ ] **HIST-04**: Chốt kỳ chỉ ghi một dòng đánh dấu mốc; không có dữ liệu nào bị xoá hay archive đi nơi khác
- [ ] **HIST-05**: Sau khi chốt kỳ, số dư kỳ mới bắt đầu từ mốc đó và không cộng dồn kỳ trước
- [ ] **HIST-06**: Người dùng xem lại được số dư của bất kỳ kỳ đã chốt nào

### Giao diện & Thiết bị (UX)

- [ ] **UX-01**: App cài được lên màn hình chính điện thoại như một ứng dụng, có icon và tên riêng
- [ ] **UX-02**: Điều hướng bằng thanh tab dưới cùng: Số dư, Lịch sử, Nhóm
- [ ] **UX-03**: Mọi ô nhập liệu có cỡ chữ tối thiểu 16px nên iOS không tự phóng to khi focus
- [ ] **UX-04**: Giao diện tôn trọng safe area của máy có tai thỏ; không có nội dung nào bị che
- [ ] **UX-05**: Mọi vùng chạm đạt tối thiểu 44×44px
- [ ] **UX-06**: Toàn bộ nhãn và thông báo bằng tiếng Việt

---

## v2 Requirements (Deferred)

### Chia theo từng món (ITEM) — phase riêng sau khi core ổn

- [ ] **ITEM-01**: Người dùng nhập một hoá đơn gồm nhiều dòng món, mỗi dòng có tên, số lượng, đơn giá
- [ ] **ITEM-02**: Người dùng gán người ăn cho từng dòng món độc lập
- [ ] **ITEM-03**: Phí ship và VAT được phân bổ theo tỷ lệ tiền món của từng người, gộp thành một lần phân bổ duy nhất để tránh dồn lệch
- [ ] **ITEM-04**: Tổng các phần của hoá đơn theo món luôn đúng bằng tổng hoá đơn

### Chụp bill OCR (OCR) — phase cuối

- [ ] **OCR-01**: Người dùng chụp ảnh hoá đơn từ app
- [ ] **OCR-02**: Ảnh được nén phía client trước khi gửi nên không vượt giới hạn 4.5 MB của server action
- [ ] **OCR-03**: Ảnh lưu trên Vercel Blob và xem lại được từ giao dịch
- [ ] **OCR-04**: Hệ thống trích xuất danh sách món, số lượng, đơn giá, tổng tiền từ ảnh
- [ ] **OCR-05**: Kết quả trích xuất hiện ở dạng sửa được; người dùng sửa sai trước khi lưu
- [ ] **OCR-06**: Xử lý ảnh chạy nền và báo kết quả, không chặn giao diện
- [ ] **OCR-07**: Có bộ hoá đơn mẫu và thang đo để đánh giá chất lượng trích xuất

### Khác

- [ ] **NOTI-01**: Thông báo đẩy khi có người ghi chi tiêu hoặc gửi thanh toán chờ xác nhận
- [ ] **EXPORT-01**: Xuất lịch sử ra CSV
- [ ] **RECUR-01**: Chi tiêu định kỳ tự lặp (tiền nhà, internet)
- [ ] **BUDGET-01**: Đặt hạn mức chi theo tháng và cảnh báo khi gần chạm

---

## Out of Scope

- **Multi-tenant / nhiều nhóm tự đăng ký** — chỉ phục vụ một nhóm cố định; thêm sau nếu thật sự cần, và nó kéo theo cả model quyền
- **Migrate dữ liệu Sheets cũ** — user chọn bắt đầu lại từ 0; tiết kiệm nguyên một phase
- **Tự động phát hiện chuyển khoản ngân hàng** — nghiên cứu xác nhận không có tầng miễn phí nào dùng được (SePay tối thiểu 120k/tháng, Casso chỉ cho dùng thử 14 ngày); xác nhận thủ công không phải đường tắt mà là lựa chọn duy nhất
- **Hàng đợi offline bằng IndexedDB** — là nguồn sự thật thứ hai, đúng loại lỗi đã giết bản cũ; iOS Safari cũng không hỗ trợ Background Sync
- **Đa tiền tệ** — nhóm chỉ dùng VND
- **Ứng dụng native** — PWA đủ dùng cho nhóm 10 người
- **Sửa/xoá trực tiếp dòng ledger** — bất biến là cơ chế bảo vệ chính, không phải chi tiết triển khai
- **Cloudflare R2 cho ảnh** — đòi khai thẻ tín dụng; Vercel Blob 1 GB đủ cho ~2000 ảnh đã nén, đổi sau chỉ là đổi adapter
- **Cron giữ Neon luôn thức** — Vercel Hobby chỉ cho 1 lần/ngày nên không khả thi, và compute always-on sẽ ngốn 182 trong 100 CU-hours miễn phí

---

## Traceability

Mapped by `ROADMAP.md` — 64/64 v1 requirements covered, no orphans, no duplicates.

| REQ-ID | Phase | Status |
|--------|-------|--------|
| INFRA-01 | Phase 1 — Nền tảng sống | Pending |
| INFRA-02 | Phase 1 — Nền tảng sống | Pending |
| INFRA-03 | Phase 1 — Nền tảng sống | Pending |
| INFRA-04 | Phase 1 — Nền tảng sống | Pending |
| INFRA-05 | Phase 1 — Nền tảng sống | Pending |
| INFRA-06 | Phase 1 — Nền tảng sống | Pending |
| INFRA-07 | Phase 1 — Nền tảng sống | Pending |
| AUTH-01 | Phase 1 — Nền tảng sống | Pending |
| AUTH-02 | Phase 1 — Nền tảng sống | Pending |
| AUTH-03 | Phase 1 — Nền tảng sống | Pending |
| AUTH-06 | Phase 1 — Nền tảng sống | Pending |
| LEDG-01 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| LEDG-02 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| LEDG-03 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| LEDG-04 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| LEDG-05 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| LEDG-06 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| LEDG-07 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| MONEY-01 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| MONEY-02 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| MONEY-03 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| MONEY-04 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| MONEY-05 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| MONEY-06 | Phase 2 — Lõi sổ cái & toán tiền | Pending |
| EXP-01 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| EXP-02 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| EXP-03 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| EXP-04 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| EXP-05 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| EXP-09 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| EXP-10 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| UX-01 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| UX-02 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| UX-03 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| UX-04 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| UX-05 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| UX-06 | Phase 3 — Ghi chi tiêu trong 15 giây | Pending |
| BAL-01 | Phase 4 — Số dư nói bằng câu & sửa sai | Pending |
| BAL-02 | Phase 4 — Số dư nói bằng câu & sửa sai | Pending |
| BAL-03 | Phase 4 — Số dư nói bằng câu & sửa sai | Pending |
| BAL-04 | Phase 4 — Số dư nói bằng câu & sửa sai | Pending |
| EXP-06 | Phase 4 — Số dư nói bằng câu & sửa sai | Pending |
| EXP-07 | Phase 4 — Số dư nói bằng câu & sửa sai | Pending |
| EXP-08 | Phase 4 — Số dư nói bằng câu & sửa sai | Pending |
| AUTH-04 | Phase 5 — Nhóm & QR thanh toán | Pending |
| AUTH-05 | Phase 5 — Nhóm & QR thanh toán | Pending |
| PAY-01 | Phase 5 — Nhóm & QR thanh toán | Pending |
| PAY-02 | Phase 5 — Nhóm & QR thanh toán | Pending |
| PAY-03 | Phase 5 — Nhóm & QR thanh toán | Pending |
| PAY-04 | Phase 5 — Nhóm & QR thanh toán | Pending |
| PAY-05 | Phase 6 — Xác nhận hai chiều & rút gọn nợ | Pending |
| PAY-06 | Phase 6 — Xác nhận hai chiều & rút gọn nợ | Pending |
| PAY-07 | Phase 6 — Xác nhận hai chiều & rút gọn nợ | Pending |
| PAY-08 | Phase 6 — Xác nhận hai chiều & rút gọn nợ | Pending |
| PAY-09 | Phase 6 — Xác nhận hai chiều & rút gọn nợ | Pending |
| PAY-10 | Phase 6 — Xác nhận hai chiều & rút gọn nợ | Pending |
| PAY-11 | Phase 6 — Xác nhận hai chiều & rút gọn nợ | Pending |
| PAY-12 | Phase 6 — Xác nhận hai chiều & rút gọn nợ | Pending |
| HIST-01 | Phase 7 — Lịch sử & chốt kỳ | Pending |
| HIST-02 | Phase 7 — Lịch sử & chốt kỳ | Pending |
| HIST-03 | Phase 7 — Lịch sử & chốt kỳ | Pending |
| HIST-04 | Phase 7 — Lịch sử & chốt kỳ | Pending |
| HIST-05 | Phase 7 — Lịch sử & chốt kỳ | Pending |
| HIST-06 | Phase 7 — Lịch sử & chốt kỳ | Pending |
| ITEM-01 | Phase 8 — Chia theo từng món *(v2)* | Pending |
| ITEM-02 | Phase 8 — Chia theo từng món *(v2)* | Pending |
| ITEM-03 | Phase 8 — Chia theo từng món *(v2)* | Pending |
| ITEM-04 | Phase 8 — Chia theo từng món *(v2)* | Pending |
| OCR-01 | Phase 9 — Chụp bill OCR *(v2)* | Pending |
| OCR-02 | Phase 9 — Chụp bill OCR *(v2)* | Pending |
| OCR-03 | Phase 9 — Chụp bill OCR *(v2)* | Pending |
| OCR-04 | Phase 9 — Chụp bill OCR *(v2)* | Pending |
| OCR-05 | Phase 9 — Chụp bill OCR *(v2)* | Pending |
| OCR-06 | Phase 9 — Chụp bill OCR *(v2)* | Pending |
| OCR-07 | Phase 9 — Chụp bill OCR *(v2)* | Pending |
| NOTI-01 | — backlog | Deferred |
| EXPORT-01 | — backlog | Deferred |
| RECUR-01 | — backlog | Deferred |
| BUDGET-01 | — backlog | Deferred |
