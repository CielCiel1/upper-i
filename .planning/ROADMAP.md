# Roadmap — Upper-I

**Core Value:** Số dư luôn đúng và luôn tái lập được từ sổ giao dịch — không bao giờ drift.

**Mode:** `mvp` — mọi phase là một lát cắt dọc, chạy được và demo được đầu-cuối, không phải một tầng kỹ thuật.
**Granularity:** standard · **Parallelization:** on · **Phases:** 9 (7 × v1, 2 × v2)

---

## Sequencing rationale

Thứ tự này bị ép bởi đúng hai lực: **deploy phải đi trước mọi thứ**, và **ledger phải đi trước mọi UI chạm vào tiền**.

Deploy là Phase 1, không phải phase cuối, vì nó là thứ rẻ nhất để làm sai và đắt nhất để sửa muộn. Research `stack-deploy.md` chỉ ra ba cái bẫy setup — `prisma` resolve sang v8-rc, NextAuth v5 còn beta, Next.js 16 đổi `middleware.ts` → `proxy.ts` — tất cả đều là lỗi *build time*. Gặp chúng ở Phase 1 với một trang trống thì mất 20 phút; gặp chúng ở Phase 7 với 60 requirement đã code thì không còn phân biệt được lỗi stack với lỗi nghiệp vụ. Đặt deploy ở cuối cũng có nghĩa mọi phase ở giữa chỉ "xong trên máy tôi" — mà app này chỉ có giá trị khi mở được từ điện thoại ở quán ăn. Sau Phase 1, mỗi phase tự ship liên tục bằng `git push`.

Ledger là Phase 2 vì nó là lý do viết lại. Bản Apps Script không chết vì thiếu tính năng, nó chết vì có hai nguồn sự thật cho câu hỏi "ai nợ ai". Nếu xây UI nhập chi tiêu trước rồi nhét ledger vào sau, phép chia sẽ bị copy-paste vào form, vào màn số dư, vào gợi ý thanh toán — và lỗi số 6 của bản cũ ("công thức số dư copy-paste ở hai nơi") tái sinh nguyên vẹn. `splitByWeights` phải tồn tại và phải là hàm duy nhất *trước khi* có người gọi nó lần thứ hai. Property test LEDG-06/07 và MONEY-06 là **deliverable của Phase 2, không phải polish về sau** — chúng chính là bằng chứng Core Value, và chúng chỉ viết được một lần khi schema còn sạch.

**Sẽ gãy gì nếu đảo thứ tự:**

| Đảo | Hậu quả |
|---|---|
| UI chi tiêu (P3) trước ledger (P2) | Phép chia bị nhân bản vào component; property test viết sau sẽ phải refactor cả UI để pass → thường bị bỏ qua |
| Thanh toán (P5-6) trước số dư (P4) | Không có cách nào xác minh "thanh toán chờ KHÔNG đổi số dư" (PAY-06) vì chưa có số dư để nhìn |
| Chốt kỳ (P7) trước ledger bất biến (P2) | Chính xác là lỗi `actionStartNewPeriod` của bản cũ — close biến thành thao tác lên dữ liệu thay vì một dòng mốc |
| Chia theo món (P8) trước `splitByWeights` ổn định | Phân bổ ship/VAT là phép chia *lồng*; xây trên một hàm chia chưa chốt sẽ phải làm lại toàn bộ |
| OCR (P9) ở bất kỳ đâu sớm hơn | OCR chỉ điền vào line-item; không có P8 thì không có chỗ đổ dữ liệu ra |

---

## Phases

- [ ] **Phase 1: Nền tảng sống** - App có URL production thật, đăng nhập Google theo allowlist, deploy bằng `git push`
- [ ] **Phase 2: Lõi sổ cái & toán tiền** - Ghi một khoản chi và đọc số dư dẫn xuất từ ledger bất biến, có property test chứng minh không drift
- [ ] **Phase 3: Ghi chi tiêu trong 15 giây** - Nhập một khoản chi chia đều trên điện thoại dưới 15 giây, app cài được lên màn hình chính
- [ ] **Phase 4: Số dư nói bằng câu & sửa sai** - Thấy ngay "Bạn đang nợ 150.000 ₫", truy ra khoản nào tạo nợ, sửa/xoá bằng bút toán đảo
- [ ] **Phase 5: Nhóm & QR thanh toán** - Lưu thông tin ngân hàng và hiện QR VietQR điền sẵn số tiền, quét trả trong vài giây
- [ ] **Phase 6: Xác nhận hai chiều & rút gọn nợ** - Báo đã chuyển / xác nhận đã nhận, và gợi ý tập chuyển tiền tối thiểu
- [ ] **Phase 7: Lịch sử & chốt kỳ** - Xem dòng thời gian, tổng kết tháng, chốt kỳ không mất dữ liệu và không cộng dồn
- [ ] **Phase 8: Chia theo từng món** *(v2)* - Nhập hoá đơn nhiều dòng, gán người ăn từng món, phân bổ ship/VAT theo tỷ lệ
- [ ] **Phase 9: Chụp bill OCR** *(v2)* - Chụp hoá đơn và nhận danh sách món đã điền sẵn, sửa được trước khi lưu

---

## Phase Details

### Phase 1: Nền tảng sống

**Goal:** Người dùng mở được một URL production thật trên điện thoại, đăng nhập bằng Google, và chỉ email trong allowlist vào được.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, AUTH-01, AUTH-02, AUTH-03, AUTH-06

**Plans:** 3/6 plans executed

Plans:

- [x] 01-01-PLAN.md — Scaffold + pin versions + cấu hình deploy (INFRA-01, INFRA-03, INFRA-04, INFRA-05)
- [x] 01-02-PLAN.md — Schema, Prisma/Neon adapter, seed allowlist có thẩm quyền (INFRA-02, INFRA-06, AUTH-02)
- [x] 01-03-PLAN.md — Design token + app shell tĩnh (INFRA-07)
- [ ] 01-04-PLAN.md — Google OAuth, allowlist gate, route guard `src/proxy.ts` (AUTH-01, AUTH-02, AUTH-03, AUTH-06)
- [ ] 01-05-PLAN.md — Ba màn hình + gate build chứng minh PPR và proxy (INFRA-07, AUTH-01, AUTH-06)
- [ ] 01-06-PLAN.md — Checklist thao tác tay tiếng Việt + kiểm chứng live (INFRA-02..05, AUTH-01..06)

**Parallel:** Plan 02 và Plan 03 chạy song song sau Plan 01 (DB và UI không đụng file nhau). Plan 04 cần cả hai. Plan 05 sau Plan 04. Plan 06 là checkpoint cuối.

> **Lệch so với bản phác 5 plan ban đầu — có chủ đích.** Research (đã dựng thử và build thật) cho thấy hai giả định gốc không còn đúng: việc tạo project Vercel/Neon là thao tác tay của người dùng chứ không phải việc agent làm được, nên không thể là "plan" song song; và phần cấu hình deploy thuần code (`vercel.json`, build command) thực chất thuộc về plan scaffold. Vì vậy Plan 3 cũ được tách: phần code gộp vào Plan 01, phần thao tác tay dồn vào Plan 06 cùng mọi bước tay khác — đúng yêu cầu CONTEXT.md là gom tất cả vào **một** checklist liền mạch. Plan 03 mới tách riêng token/shell khỏi các trang vì token system là deliverable dùng cho cả 9 phase.

**Success criteria:**

1. Mở URL `*.vercel.app` trên điện thoại, bấm "Đăng nhập với Google" một chạm, vào được trang hiện tên mình.
2. Một email ngoài allowlist bấm đăng nhập thì bị từ chối, không tạo tài khoản.
3. Thêm một thành viên mới = một dòng INSERT vào DB, người đó đăng nhập được ngay mà không cần deploy lại.
4. `git push` lên nhánh chính → sau vài phút production URL chạy code mới, migration đã áp, không thao tác tay nào.
5. Đóng app, hôm sau mở lại vẫn còn phiên đăng nhập; bấm đăng xuất ở bất kỳ màn nào đều thoát được.
6. Hoá đơn tháng của Vercel + Neon + Google = 0đ.

**Plan files:** `01-01-PLAN.md` … `01-06-PLAN.md` (+ `01-SETUP-CHECKLIST.md` sinh bởi Plan 06)

---

### Phase 2: Lõi sổ cái & toán tiền

**Goal:** Người dùng ghi được một khoản chi và thấy số dư của cả nhóm, với bảo chứng toán học rằng con số đó tái lập được từ ledger và không bao giờ drift.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** LEDG-01, LEDG-02, LEDG-03, LEDG-04, LEDG-05, LEDG-06, LEDG-07, MONEY-01, MONEY-02, MONEY-03, MONEY-04, MONEY-05, MONEY-06

> **Đây là phase biện minh cho cả cuộc viết lại.** Bản cũ chết vì hai nguồn sự thật. Mọi thứ ở đây tồn tại để làm cho lỗi đó *không biểu diễn được*.

**Plans:**

1. **Schema ledger append-only** — bảng entry với cột `BIGINT`, cộng **trigger Postgres chặn UPDATE/DELETE** (bất biến ép ở DB, không ở quy ước — quy ước chính là thứ đã thất bại ở bản Apps Script); unique index trên idempotency key. (LEDG-01, LEDG-05, MONEY-01)
2. **`splitByWeights` + property tests** — một hàm duy nhất phục vụ chia đều / theo phần / theo phần trăm, dùng largest-remainder; tie-break tất định không phụ thuộc thứ tự truy vấn; guard tràn trên tích trung gian `total * weight`; test fast-check cho cả ba kiểu chia. (MONEY-02, MONEY-03, MONEY-04, MONEY-06)
3. **Bút toán đảo** — reversal **phủ định đúng các dòng entry đã lưu, KHÔNG tính lại phép chia**; dòng gốc giữ nguyên để truy vết. (LEDG-03, LEDG-04)
4. **Balance aggregate on-read + ranh giới BigInt** — một truy vấn `GROUP BY` duy nhất, không có bảng số dư vật chất hoá; chuyển `BigInt` → `number` tại tầng repository nên không lỗi serialize nào rò qua ranh giới RSC / server action. (LEDG-02, MONEY-05)
5. **Property tests bất biến ledger** — tổng mọi số dư luôn bằng 0 trên dữ liệu sinh ngẫu nhiên; expense + reversal của nó đưa mọi số dư về đúng trạng thái trước đó. (LEDG-06, LEDG-07)

**Parallel:** Plan 1 trước. Sau đó Plan 2 (thuần hàm, không chạm DB) song song với Plan 3+4. Plan 5 cuối, cần cả 3+4.

> ⚠️ **Phát hiện nghiên cứu quyết định (money-ledger.md §3):** `split(−t, w)` **không** bằng phủ định từng phần tử của `split(t, w)` — lệch ở 9.216/50.000 trường hợp (~18%). Cả hai đều tổng bằng 0, nên **mọi kiểm tra số dư đều không thấy lỗi này**. Nếu reversal tính lại phép chia thay vì phủ định dòng đã lưu, drift của bản cũ tái sinh ở dạng vô hình. Đây cũng là lý do phải lưu từng leg tường minh.

**Success criteria:**

1. Ghi một khoản chi 100.000 ₫ chia đều cho 3 người → các phần là 33.334 / 33.333 / 33.333, tổng đúng 100.000, không mất đồng nào.
2. Số dư của mọi người cộng lại luôn bằng 0, kiểm chứng trên hàng nghìn kịch bản sinh ngẫu nhiên.
3. Đảo một khoản chi đưa số dư mọi người về đúng y như trước khi ghi, không lệch một đồng.
4. Không có đường code nào UPDATE hay DELETE được một dòng ledger — thử trực tiếp bằng SQL cũng bị DB từ chối.
5. Submit lại cùng một form hai lần (mạng 4G chập chờn, bấm hai lần) chỉ tạo một bản ghi.
6. Không có lỗi "Do not know how to serialize a BigInt" ở bất kỳ server action hay client component nào.

**Plan files:** TBD (sinh bởi `/gsd-plan-phase`)

---

### Phase 3: Ghi chi tiêu trong 15 giây

**Goal:** Người dùng đứng ở quán ghi xong một khoản chi chia đều cho cả nhóm trong dưới 15 giây, trên app đã cài sẵn ở màn hình chính điện thoại.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-09, EXP-10, UX-01, UX-02, UX-03, UX-04, UX-05, UX-06

**Plans:**

1. **PWA shell + tab bar** — manifest + icon + tên riêng để cài lên màn hình chính; thanh tab dưới: Số dư / Lịch sử / Nhóm; safe area cho máy tai thỏ; vùng chạm ≥ 44×44px. (UX-01, UX-02, UX-04, UX-05)
2. **FAB + bottom sheet** — nút thêm chi tiêu hiện trên mọi tab, mở dạng bottom sheet không chuyển trang. (EXP-10)
3. **Ô nhập tiền** — `type="text"` + `inputMode="numeric"` (**không** `type="number"`), font ≥ 16px để iOS không tự phóng, autofocus, chèn dấu phân cách hàng nghìn mà không nhảy con trỏ. (EXP-02, UX-03)
4. **Điều khiển dạng câu + chip gợi ý** — "Trả bởi [bạn], chia đều cho [cả nhóm]" với mỗi ngoặc là một chạm; mặc định payer = người đăng nhập, beneficiary = tất cả; chip nội dung xếp theo tần suất. (EXP-01, EXP-03, EXP-04, EXP-05)
5. **Optimistic update + i18n vi** — `useOptimistic` cập nhật ngay khi bấm lưu, tự khôi phục nếu server lỗi; toàn bộ nhãn tiếng Việt. (EXP-09, UX-06)

**Parallel:** Plan 1 trước. Plan 2, 3, 4 chạy song song sau đó. Plan 5 cuối.

**Success criteria:**

1. Người dùng cài app lên màn hình chính điện thoại, mở ra thấy icon và tên riêng, không thấy thanh địa chỉ trình duyệt.
2. Bấm nút thêm từ bất kỳ tab nào → bottom sheet mở, bàn phím số đã bật, con trỏ đã nằm trong ô tiền, không mất một chạm nào để tới đó.
3. Ghi xong một khoản chi chia đều cho cả nhóm trong dưới 15 giây, đo bằng đồng hồ trên điện thoại thật.
4. Focus vào ô nhập trên iPhone không làm màn hình tự phóng to và nhảy layout.
5. Khoản chi hiện ngay trên danh sách khi bấm lưu; nếu mạng rớt thì nó tự biến mất và báo lỗi, không để lại dòng ma.
6. Mọi nhãn, nút, thông báo đều bằng tiếng Việt.

**UI hint:** yes
**Plan files:** TBD (sinh bởi `/gsd-plan-phase`)

---

### Phase 4: Số dư nói bằng câu & sửa sai

**Goal:** Người dùng mở app là hiểu ngay mình nợ ai bao nhiêu bằng một câu tiếng Việt, truy được khoản chi nào tạo ra nợ đó, và sửa sai mà không phá sổ.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** BAL-01, BAL-02, BAL-03, BAL-04, EXP-06, EXP-07, EXP-08

**Plans:**

1. **Màn Số dư dạng câu** — "Bạn đang nợ 150.000 ₫" / "Bạn được nhận 80.000 ₫", đỏ = nợ, xanh = được nợ, nhất quán; tránh hẳn từ "số dư ròng". (BAL-01)
2. **Chi tiết theo người + truy vết** — nhóm theo chiều nợ/được nợ; mở một khoản nợ ra xem đúng những chi tiêu nào cấu thành nó. (BAL-02, BAL-03)
3. **Chia theo phần không bằng nhau** — UI chọn số phần (A 2 phần, B 1 phần), gọi thẳng `splitByWeights` của Phase 2, không công thức mới. (EXP-06)
4. **Nạp quỹ** — ghi một khoản nạp quỹ như một loại entry trên cùng ledger. (EXP-07)
5. **Sửa / xoá khoản chi của mình** — tạo bút toán đảo qua cơ chế Phase 2; màn hình phản ánh ngay. (EXP-08)

**Parallel:** Plan 1 → Plan 2. Plan 3, 4, 5 chạy song song với nhau và với Plan 2.

**Success criteria:**

1. Mở app, câu đầu tiên nhìn thấy nói rõ mình đang nợ hay được nhận bao nhiêu — không phải một con số có dấu âm/dương để tự suy.
2. Chạm vào tên một người thấy đúng danh sách chi tiêu cấu thành khoản nợ với người đó.
3. Chia một khoản 100.000 ₫ theo tỷ lệ 2:1 cho hai người ra 66.667 / 33.333, tổng đúng 100.000.
4. Sửa một khoản chi ghi nhầm → số dư cập nhật đúng, và dòng gốc vẫn còn trong sổ để truy vết.
5. Con số trên màn hình luôn khớp với truy vấn tổng hợp chạy trực tiếp trên ledger, tại mọi thời điểm.

**UI hint:** yes
**Plan files:** TBD (sinh bởi `/gsd-plan-phase`)

---

### Phase 5: Nhóm & QR thanh toán

**Goal:** Người nợ mở app, thấy mã QR đã điền sẵn đúng số tiền và nội dung chuyển khoản, quét bằng app ngân hàng và trả xong trong vài giây.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** AUTH-04, AUTH-05, PAY-01, PAY-02, PAY-03, PAY-04

**Plans:**

1. **Tab Nhóm + hồ sơ cá nhân** — danh sách thành viên; tự sửa tên hiển thị và ảnh đại diện; chứng minh `User.id` mới là danh tính, đổi tên không chạm dòng ledger lịch sử nào. (AUTH-04, AUTH-05)
2. **Thông tin ngân hàng** — chọn ngân hàng từ danh sách BIN Việt Nam có sẵn + nhập số tài khoản. ⚠️ Validation **không** được giả định `^9704\d{2}$`: CAKE là `546034`, Timo là `963388`. (PAY-01)
3. **Payload VietQR EMVCo** — dựng TLV tự thân + CRC16-CCITT (FALSE); tag `01` = `12` khi có số tiền, `11` khi không; **không** lưu `accountName` vào payload (xác minh: nó không nằm trong chuẩn, ngân hàng tự hiện tên chủ tài khoản). (PAY-02)
4. **Render QR phía client** — dùng `qrcode` ngay trên máy; số tài khoản thành viên không bao giờ rời hạ tầng của mình, không gọi `img.vietqr.io`. (PAY-03)
5. **Token nội dung chuyển khoản** — định dạng `UI <KỲ> <NGƯỜI TRẢ> <TOKEN>`, chỉ `A–Z 0–9` và dấu cách, giữ dưới ~25 ký tự, đọc được khi phải gõ tay. (PAY-04)

**Parallel:** Plan 1 và Plan 2 song song. Plan 3 → Plan 4. Plan 5 song song với Plan 3.

**Success criteria:**

1. Người dùng lưu được ngân hàng + số tài khoản của mình bằng cách chọn từ danh sách, không phải gõ mã BIN.
2. Quét mã QR trong app bằng app ngân hàng thật → màn hình chuyển tiền mở ra với đúng người nhận, đúng số tiền, đúng nội dung, không phải gõ gì thêm.
3. Người dùng đổi tên hiển thị của mình, mọi khoản chi lịch sử vẫn gắn đúng người và số dư không đổi một đồng.
4. Mở DevTools Network khi hiện QR: không có request nào ra ngoài mang theo số tài khoản.
5. Nội dung chuyển khoản hiện trong app ngân hàng không bị cắt cụt và vẫn phân biệt được lần thanh toán nào.

**UI hint:** yes
**Plan files:** TBD (sinh bởi `/gsd-plan-phase`)

---

### Phase 6: Xác nhận hai chiều & rút gọn nợ

**Goal:** Người trả báo "đã chuyển", người nhận xác nhận "đã nhận", và chỉ khi đó sổ mới ghi — cộng gợi ý tập chuyển tiền tối thiểu để cả nhóm trả ít lần hơn.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** PAY-05, PAY-06, PAY-07, PAY-08, PAY-09, PAY-10, PAY-11, PAY-12

**Plans:**

1. **Thanh toán trạng thái chờ** — bấm "đã chuyển" tạo một payment `pending` ở bảng riêng; **pending tuyệt đối không ghi ledger, không đổi số dư của ai**. (PAY-05, PAY-06)
2. **Người nhận xác nhận** — danh sách chờ xác nhận; bấm "đã nhận" là thời điểm **duy nhất** ledger được ghi, qua idempotency key của Phase 2. (PAY-07)
3. **Từ chối & huỷ** — người nhận từ chối kèm lý do; người trả tự huỷ được khi chưa ai xác nhận. (PAY-08, PAY-09)
4. **Badge đang chờ** — hiện cạnh số dư để người trả hiểu vì sao vẫn còn nợ dù đã chuyển tiền. (PAY-10)
5. **Rút gọn nợ, mặc định tắt** — toggle bật/tắt; khi bật, gợi ý tập chuyển tối thiểu (≤ n−1 lần) và giải thích được vì sao lại trả cho người đó. (PAY-11, PAY-12)

**Parallel:** Plan 1 → Plan 2 → Plan 3. Plan 4 song song với Plan 3. Plan 5 độc lập hoàn toàn, chạy song song từ đầu phase.

**Success criteria:**

1. Người trả bấm "đã chuyển" → số dư của cả hai bên **không đổi**, chỉ xuất hiện badge "đang chờ xác nhận".
2. Người nhận bấm "đã nhận" → ngay lúc đó số dư hai bên mới thay đổi và tổng mọi số dư vẫn bằng 0.
3. Người nhận từ chối kèm lý do → người trả thấy lý do và số dư không hề bị động đến.
4. Bật rút gọn nợ, số lần chuyển tiền của cả nhóm giảm, và chạm vào một gợi ý thì đọc được giải thích vì sao trả cho người đó.
5. Tắt rút gọn (mặc định) thì vẫn thấy nợ gốc từng cặp người — không bị ép dùng chế độ rút gọn.

**UI hint:** yes
**Plan files:** TBD (sinh bởi `/gsd-plan-phase`)

---

### Phase 7: Lịch sử & chốt kỳ

**Goal:** Người dùng xem lại mọi giao dịch, tổng kết chi tiêu theo tháng, và chốt kỳ mà không mất dữ liệu cũng không cộng dồn sai như bản Sheets.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements:** HIST-01, HIST-02, HIST-03, HIST-04, HIST-05, HIST-06

**Plans:**

1. **Dòng thời gian** — tab Lịch sử, mới nhất trước, cuộn vô hạn. (HIST-01)
2. **Bộ lọc** — theo người và theo khoảng thời gian. (HIST-02)
3. **Tổng kết tháng** — tổng chi, chi theo người, chi theo nội dung. (HIST-03)
4. **Chốt kỳ = một dòng mốc** — close chỉ ghi **một marker row và không xoá gì**; kỳ suy ra bằng khoảng nửa mở `[from, to)` giữa hai mốc liên tiếp, nên mỗi entry rơi vào đúng một kỳ kể cả ở timestamp biên. (HIST-04, HIST-05)
5. **Xem lại kỳ đã chốt** — chọn một kỳ cũ và đọc lại số dư của kỳ đó. (HIST-06)

**Parallel:** Plan 1 → Plan 2. Plan 3 song song với Plan 2. Plan 4 → Plan 5.

> ⚠️ Đây chính là chỗ bản cũ chết (`actionStartNewPeriod` archive nhưng không reset → kỳ mới cộng dồn kỳ cũ). Nguyên nhân gốc là **coi chốt kỳ là một thao tác lên dữ liệu**. Ở đây close là một timestamp, nên double-count không phải lỗi phải tránh — nó không biểu diễn được.

**Success criteria:**

1. Cuộn lịch sử thấy mọi giao dịch mới nhất trước, cuộn tiếp tự tải thêm, không mất dòng nào.
2. Lọc theo một người trong một tháng → chỉ hiện đúng giao dịch của người đó trong tháng đó.
3. Chốt kỳ xong: không một giao dịch nào biến mất khỏi lịch sử.
4. Sau khi chốt kỳ, số dư kỳ mới bắt đầu từ mốc đó và **không** cộng dồn kỳ trước — kiểm chứng bằng đúng kịch bản đã làm hỏng bản Sheets.
5. Mở lại một kỳ đã chốt từ nhiều tháng trước và đọc được số dư đúng của kỳ đó.

**UI hint:** yes
**Plan files:** TBD (sinh bởi `/gsd-plan-phase`)

---

### Phase 8: Chia theo từng món *(v2)*

**Goal:** Người dùng nhập một hoá đơn nhiều dòng món, gán ai ăn món nào, và app phân bổ ship/VAT theo tỷ lệ sao cho tổng các phần đúng bằng tổng hoá đơn.
**Mode:** mvp
**Depends on:** Phase 4 (cần `splitByWeights` và màn số dư đã ổn định; độc lập với Phase 5–7)
**Requirements:** ITEM-01, ITEM-02, ITEM-03, ITEM-04

**Plans:**

1. **Nhập hoá đơn nhiều dòng** — mỗi dòng có tên món, số lượng, đơn giá; thêm/xoá dòng nhanh trên điện thoại. (ITEM-01)
2. **Gán người ăn từng dòng** — mỗi dòng gán độc lập, mặc định cả nhóm, bỏ người bằng một chạm. (ITEM-02)
3. **Phân bổ ship + VAT** — gộp thành **một lần phân bổ duy nhất** theo tỷ lệ tiền món của từng người (phân bổ hai lần liên tiếp làm dồn lệch). (ITEM-03)
4. **Test bất biến tổng hoá đơn** — property test: tổng các phần luôn đúng bằng tổng hoá đơn, qua cả `splitByWeights` lồng nhau. (ITEM-04)

**Parallel:** Plan 1 → Plan 2. Plan 3 song song với Plan 2. Plan 4 cuối.

**Success criteria:**

1. Nhập một hoá đơn 5 món với ship và VAT, gán người ăn khác nhau cho từng món, và lưu được thành một khoản chi.
2. Cộng phần của tất cả mọi người lại đúng bằng tổng hoá đơn in trên giấy — không thừa không thiếu một đồng.
3. Người không ăn món nào chỉ phải trả 0 ₫, không bị chia ship.
4. Khoản chi chia theo món hiện trong lịch sử và truy ra được từng món ai ăn.

**UI hint:** yes
**Plan files:** TBD (sinh bởi `/gsd-plan-phase`)

---

### Phase 9: Chụp bill OCR *(v2)*

**Goal:** Người dùng chụp ảnh hoá đơn và nhận lại danh sách món đã điền sẵn, sửa nhanh chỗ sai rồi lưu, thay vì gõ tay từng dòng.
**Mode:** mvp
**Depends on:** Phase 8 (OCR đổ dữ liệu vào đúng form line-item của Phase 8)
**Requirements:** OCR-01, OCR-02, OCR-03, OCR-04, OCR-05, OCR-06, OCR-07

> 🤖 **Phase AI — bắt buộc chạy `/gsd-ai-integration-phase` để sinh `AI-SPEC.md` TRƯỚC khi `/gsd-plan-phase`.** Đây là phase duy nhất có thành phần phi tất định; prompt, model, ngưỡng tin cậy, chiến lược fallback và bộ eval phải được chốt thành hợp đồng thiết kế trước khi lập kế hoạch.
>
> Lưu ý cần quyết trong AI-SPEC: free-tier Gemini **dùng input để train model của Google** — ảnh hoá đơn là dữ liệu thật của nhóm, phải công bố rõ hoặc chấp nhận có ý thức.

**Plans:**

1. **Chụp & nén phía client** — mở camera từ app; nén ảnh trên máy trước khi gửi để **không vượt giới hạn body 4.5 MB của server action**. (OCR-01, OCR-02)
2. **Lưu trữ Vercel Blob** — upload và xem lại ảnh từ giao dịch; adapter hoá để đổi nhà cung cấp sau chỉ là đổi một lớp. (OCR-03)
3. **Trích xuất có cấu trúc** — gọi model sinh danh sách món / số lượng / đơn giá / tổng tiền theo schema cố định. (OCR-04)
4. **Giao diện sửa lỗi** — mỗi món là một dòng sửa được, tự focus ô có độ tin cậy thấp nhất; **thiết kế cho việc sửa, không cho độ chính xác** (giả định 70–85% đúng, sửa phải là thao tác 2 chạm). (OCR-05)
5. **Xử lý nền + bộ eval** — ảnh xử lý nền và báo kết quả, không chặn giao diện; bộ hoá đơn mẫu + thang đo chất lượng trích xuất. (OCR-06, OCR-07)

**Parallel:** Plan 1 → Plan 2. Plan 3 song song với Plan 2. Plan 4 cần Plan 3. Plan 5 cuối.

**Success criteria:**

1. Người dùng chụp một hoá đơn thật ở quán và thấy danh sách món đã điền sẵn, không phải gõ dòng nào từ đầu.
2. Ảnh 12 MP từ điện thoại gửi lên thành công, không lỗi "body too large".
3. Trong lúc ảnh đang xử lý, app vẫn dùng được bình thường; xong thì báo.
4. Món bị đọc sai sửa được trong 2 chạm, và con trỏ đã nằm sẵn ở ô đáng ngờ nhất.
5. Mở lại giao dịch cũ vẫn xem được ảnh hoá đơn gốc.
6. Chạy bộ hoá đơn mẫu cho ra một con số chất lượng trích xuất có thể so sánh giữa các lần đổi prompt/model.

**UI hint:** yes
**Plan files:** TBD (sinh bởi `/gsd-plan-phase`)

---

## Requirements coverage

**v1: 64/64 requirement đã map. Không có requirement mồ côi.**

| REQ-ID | Phase | REQ-ID | Phase |
|---|---|---|---|
| INFRA-01 | 1 | PAY-01 | 5 |
| INFRA-02 | 1 | PAY-02 | 5 |
| INFRA-03 | 1 | PAY-03 | 5 |
| INFRA-04 | 1 | PAY-04 | 5 |
| INFRA-05 | 1 | PAY-05 | 6 |
| INFRA-06 | 1 | PAY-06 | 6 |
| INFRA-07 | 1 | PAY-07 | 6 |
| AUTH-01 | 1 | PAY-08 | 6 |
| AUTH-02 | 1 | PAY-09 | 6 |
| AUTH-03 | 1 | PAY-10 | 6 |
| AUTH-04 | 5 | PAY-11 | 6 |
| AUTH-05 | 5 | PAY-12 | 6 |
| AUTH-06 | 1 | BAL-01 | 4 |
| LEDG-01 | 2 | BAL-02 | 4 |
| LEDG-02 | 2 | BAL-03 | 4 |
| LEDG-03 | 2 | BAL-04 | 4 |
| LEDG-04 | 2 | HIST-01 | 7 |
| LEDG-05 | 2 | HIST-02 | 7 |
| LEDG-06 | 2 | HIST-03 | 7 |
| LEDG-07 | 2 | HIST-04 | 7 |
| MONEY-01 | 2 | HIST-05 | 7 |
| MONEY-02 | 2 | HIST-06 | 7 |
| MONEY-03 | 2 | UX-01 | 3 |
| MONEY-04 | 2 | UX-02 | 3 |
| MONEY-05 | 2 | UX-03 | 3 |
| MONEY-06 | 2 | UX-04 | 3 |
| EXP-01 | 3 | UX-05 | 3 |
| EXP-02 | 3 | UX-06 | 3 |
| EXP-03 | 3 | ITEM-01 | 8 *(v2)* |
| EXP-04 | 3 | ITEM-02 | 8 *(v2)* |
| EXP-05 | 3 | ITEM-03 | 8 *(v2)* |
| EXP-06 | 4 | ITEM-04 | 8 *(v2)* |
| EXP-07 | 4 | OCR-01 | 9 *(v2)* |
| EXP-08 | 4 | OCR-02 | 9 *(v2)* |
| EXP-09 | 3 | OCR-03 | 9 *(v2)* |
| EXP-10 | 3 | OCR-04 | 9 *(v2)* |
| | | OCR-05 | 9 *(v2)* |
| | | OCR-06 | 9 *(v2)* |
| | | OCR-07 | 9 *(v2)* |

**Phân bổ theo phase:**

| Phase | Số requirement | Nhóm |
|---|---|---|
| 1 | 11 | INFRA ×7, AUTH ×4 |
| 2 | 13 | LEDG ×7, MONEY ×6 |
| 3 | 13 | UX ×6, EXP ×7 |
| 4 | 7 | BAL ×4, EXP ×3 |
| 5 | 6 | AUTH ×2, PAY ×4 |
| 6 | 8 | PAY ×8 |
| 7 | 6 | HIST ×6 |
| **v1 total** | **64** | ✅ đủ, không trùng, không mồ côi |
| 8 *(v2)* | 4 | ITEM ×4 |
| 9 *(v2)* | 7 | OCR ×7 |

**Không đưa vào roadmap (backlog, đúng như REQUIREMENTS.md đã xếp vào "Khác"):**
`NOTI-01` (thông báo đẩy), `EXPORT-01` (xuất CSV), `RECUR-01` (chi tiêu định kỳ), `BUDGET-01` (hạn mức tháng). Đây là v2-Khác, chưa được yêu cầu xếp phase; chúng ở lại backlog cho tới khi có milestone sau.

---

## Risks

### 1. `npm i prisma` kéo về v8.0.0-rc — build gãy ngay Phase 1 🔴

`prisma` trên npm hiện resolve sang **8.0.0-rc.20** trong khi `@prisma/client` latest là **7.10.0**. Hai gói lệch major thì build chết, và thông báo lỗi không nói gì về version. Research gọi đây là **lỗi setup khả dĩ nhất**.
**Giảm thiểu:** Phase 1 / Plan 1 pin **exact version** (không caret) cho cả `prisma` và `@prisma/client`; commit lockfile; dựng được production build trước khi viết dòng nghiệp vụ nào.

### 2. Reversal tính lại phép chia → drift vô hình 🔴

`split(−t, w) ≠ −split(t, w)` ở ~18% trường hợp (9.216/50.000). Cả hai cách **đều tổng bằng 0**, nên LEDG-06 (tổng số dư = 0) **vẫn pass** trong khi số tiền từng người đã sai. Đây đúng là loại lỗi đã giết bản Apps Script, chỉ ở dạng khó thấy hơn.
**Giảm thiểu:** Phase 2 / Plan 3 phủ định **dòng entry đã lưu**, không bao giờ gọi lại hàm chia. LEDG-07 (expense + reversal → trạng thái trước đó) là test duy nhất bắt được lỗi này — nó không thể bị bỏ qua hay hoãn.

### 3. `BigInt` vỡ ở ranh giới RSC / server action 🟠

Prisma `BigInt` làm `JSON.stringify` ném `Do not know how to serialize a BigInt`. Next.js serialize **tự động** ở ranh giới server→client, nên lỗi này nổ rải rác ở từng route nếu vá theo từng chỗ.
**Giảm thiểu:** Phase 2 / Plan 4 chuyển đổi tại **tầng repository**, một chỗ duy nhất. Thêm một smoke test gọi qua server action thật ngay trong Phase 2, không đợi tới khi có UI.

### 4. NextAuth v5 còn beta + Next.js 16 đổi `middleware.ts` → `proxy.ts` 🟠

`next-auth@5.0.0-beta.32` đã từng ship breaking change giữa các bản beta. Song song, Next.js 16 đổi tên `middleware.ts` thành `proxy.ts` — **gần như mọi tutorial tìm được đều sai chỗ này**, và triệu chứng là route guard im lặng không chạy (ai cũng vào được, không báo lỗi).
**Giảm thiểu:** pin exact beta version; Phase 1 / Plan 4 viết guard trong `proxy.ts` và **test bằng một email ngoài allowlist** để chứng minh guard thật sự chặn. Mặt lợi: `proxy.ts` chạy Node runtime nên Prisma dùng được trực tiếp.

### 5. Giới hạn độ dài nội dung chuyển khoản không có tài liệu công khai 🟡

Không ngân hàng nào công bố cap chính xác cho memo; khoảng 50–160 là phỏng đoán. Memo bị cắt cụt thì token đối soát mất, người nhận không biết tiền của ai.
**Giảm thiểu:** Phase 5 / Plan 5 giữ ngân sách **~25 ký tự** (bảo thủ có chủ đích), chỉ `A–Z 0–9` + dấu cách, không dấu tiếng Việt. **Test thật với 2–3 ngân hàng khác nhau ngay trong Phase 5**, không hoãn. Luồng xác nhận hai chiều của Phase 6 là lưới an toàn: memo hỏng vẫn còn người xác nhận bằng tay.

### 6. Region lệch: Vercel mặc định `iad1`, Neon ở Singapore 🟡

Để mặc định thì mỗi truy vấn đi vòng Washington DC ↔ Singapore, cộng ~250ms **mỗi query** cho người dùng Việt Nam — đủ phá vỡ mục tiêu 15 giây của Phase 3, và biểu hiện ra như "app chậm" chứ không như một lỗi cấu hình.
**Giảm thiểu:** Phase 1 đặt Neon `ap-southeast-1` **và** Vercel function region `sin1`; ghi lại thành decision để lần tạo project sau không quên.
