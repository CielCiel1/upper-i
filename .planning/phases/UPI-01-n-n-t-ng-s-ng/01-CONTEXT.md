# Phase 1: Nền tảng sống - Context

**Gathered:** 2026-10-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Phase này dựng toàn bộ nền hạ tầng sống của dự án và kết thúc bằng một URL production
thật mà người dùng mở được trên điện thoại, đăng nhập bằng Google, và chỉ email nằm
trong allowlist mới vào được.

**Trong phạm vi:** scaffold Next.js, kết nối Neon, pipeline deploy Vercel, Google OAuth
có allowlist, một trang authenticated tối giản hiện tên người đăng nhập.

**Ngoài phạm vi:** mọi thứ liên quan tới tiền, ledger, chia tiền, QR, giao diện nhập
chi tiêu. Phase này không được tạo bất kỳ bảng nào liên quan tới giao dịch — schema
ledger thuộc Phase 2 và phải được thiết kế trọn vẹn ở đó, không chắp vá dần.

</domain>

<decisions>
## Implementation Decisions

### Stack & tooling

- **Package manager: pnpm.** Nhanh, tiết kiệm dung lượng đĩa, Vercel nhận diện sẵn qua lockfile.
- **Styling: Tailwind CSS v4.** Dự án là mobile-first và phần lớn là layout + spacing — đúng thứ Tailwind làm tốt. Không cần đặt tên class cho một app 10 người dùng.
- **Test runner: Vitest.** Phase 2 cần property-based test với fast-check chạy hàng chục nghìn case; Vitest là runner nhanh nhất trong các lựa chọn và tích hợp thẳng với TS.
- **Lint/format: Biome.** Một công cụ thay cả ESLint lẫn Prettier, cấu hình ngắn, chạy nhanh. Giảm số file config phải nuôi.

### Auth & allowlist

- **Session strategy: database session, không dùng JWT.** Allowlist là cơ chế bảo vệ duy nhất của app. Với JWT, gỡ một người khỏi allowlist không đuổi họ ra được cho tới khi token hết hạn. Database session kiểm tra mỗi request nên thu hồi quyền có hiệu lực tức thì. Prisma adapter đã tạo sẵn bảng `Session` nên không phát sinh việc.
- **Seed allowlist bằng script `pnpm seed` đọc từ biến môi trường.** Danh sách email nằm trong `.env`, chạy một lệnh là xong. Hardcode trong migration thì mỗi lần sửa danh sách phải viết migration mới; gõ SQL tay thì không lặp lại được khi dựng lại DB.
- **Seed script là nguồn sự thật, không chỉ upsert.** Script phải xoá những dòng allowlist không còn trong biến môi trường, và cascade xoá luôn `Session` của người bị gỡ. Lý do: database session chỉ chạy `signIn` lúc đăng nhập, nên gỡ khỏi allowlist mà không xoá session thì người đó vẫn vào được. Nếu chỉ upsert thì `.env` và DB thành hai nguồn sự thật lệch nhau — đúng loại lỗi đã giết bản cũ. Gỡ người = xoá email khỏi `.env` + chạy `pnpm seed`.
- **Người ngoài allowlist thấy một trang từ chối có giải thích** — "Email này chưa được mời" kèm nút đăng xuất. Redirect im lặng về trang login tạo vòng lặp khiến người dùng tưởng app hỏng.
- **Chưa làm trang quản lý allowlist trong app.** REQ AUTH-02 chỉ yêu cầu thêm thành viên không cần deploy lại — seed script đã thoả. Trang admin là tiện lợi, không phải yêu cầu, và nhóm cố định thì thêm người vài lần một năm. Thêm sau rất rẻ vì schema đã có sẵn.
- **Google OAuth consent screen để ở chế độ Testing.** Chấp nhận phải đồng bộ tay hai danh sách (test user ở Google Console và bảng allowlist ở DB) để đổi lấy một cổng chặn thứ hai miễn phí.

### Deploy & môi trường

- **Migration chạy trong build command:** `prisma generate && prisma migrate deploy && next build`. Đơn giản nhất, không cần dựng CI riêng. Chấp nhận rủi ro đã biết: nếu migration hỏng thì build hỏng — với một dự án một người thì đó là hành vi mong muốn, không phải nhược điểm.
- **Preview deployment dùng chung database production.** Nhóm 10 người, preview deployment hiếm khi dùng tới. Neon branching là thứ phức tạp không tương xứng với lợi ích ở quy mô này.
- **Biến môi trường: commit `.env.example`, gitignore `.env.local`.** Giá trị thật dán tay vào Vercel dashboard. Không dùng `vercel env pull` để tránh phụ thuộc thêm một CLI.
- **Agent viết trọn code và cấu hình trước, gom mọi bước cần thao tác tay vào một checklist duy nhất ở cuối phase.** Người dùng làm liền mạch khoảng 20 phút thay vì bị ngắt quãng nhiều lần.

### Ràng buộc phiên bản (từ research, bắt buộc tuân thủ)

- **Pin `prisma` và `@prisma/client` cùng ở v7, exact version.** `npm i prisma` hiện kéo về `8.0.0-rc` trong khi `@prisma/client` là 7.10.0 — đây là thứ dễ làm gãy build đầu tiên nhất.
- **Pin `next-auth@5.0.0-beta.32` exact.** npm tag `latest` trỏ v4, cài nhầm là sai toàn bộ API.
- **Dùng `proxy.ts`, KHÔNG dùng `middleware.ts`.** Next.js 16 đã đổi tên; hầu hết tutorial còn sai. Điểm lợi: `proxy.ts` chạy trên Node runtime nên Prisma dùng được, không còn vướng giới hạn edge runtime.
- **Kết nối Neon qua pooled connection string + `@prisma/adapter-neon`;** `DIRECT_URL` chỉ dùng cho `migrate`. Thiếu pooling là cạn connection khi nhiều serverless function chạy song song.
- **Region: Neon `ap-southeast-1`, Vercel function `sin1`.** Cùng Singapore để giảm độ trễ cho người dùng ở Việt Nam.

- **Bật `noUncheckedIndexedAccess` trong tsconfig ngay từ Phase 1.** Phase 2 đầy phép truy cập mảng theo chỉ số trong thuật toán chia tiền; bật sau nghĩa là phải sửa một đống vi phạm đã tích luỹ.

### Agent's Discretion

- Cấu trúc thư mục cụ thể trong `app/` và `lib/`
- Cách tổ chức file cấu hình Biome, Vitest, Tailwind
- Nội dung và bố cục chính xác của trang từ chối và trang authenticated
- Cách viết seed script (TypeScript qua `tsx`, hay SQL thuần)

</decisions>

<code_context>
## Existing Code Insights

Repo mới hoàn toàn — chỉ có `.planning/`, `AGENTS.md`, `.gitignore`. Không có mã nguồn
nào để tái sử dụng hay pattern nào để tuân theo.

### Integration Points

Phase này tạo ra mọi điểm tích hợp mà các phase sau sẽ cắm vào:

- `lib/db.ts` — Prisma client singleton, điểm vào duy nhất cho mọi truy cập DB ở các phase sau
- `auth.ts` — cấu hình Auth.js; các phase sau lấy user hiện tại qua đây
- `proxy.ts` — route guard; các route mới cần bảo vệ sẽ khai báo ở đây
- `prisma/schema.prisma` — Phase 2 sẽ thêm bảng ledger vào file này
- `app/layout.tsx` — app shell tĩnh; Phase 3 sẽ thêm thanh tab dưới vào đây

### Established Patterns

Chưa có. Phase này thiết lập chúng — mọi lựa chọn ở đây trở thành khuôn mẫu cho 8 phase còn lại.

</code_context>

<specifics>
## Specific Ideas

- Người dùng đã tạo sẵn repo GitHub `CielCiel1/upper-i`, remote dùng SSH, nhánh `main`
- Người dùng tự tạo tài khoản Neon/Vercel/Google Cloud và tự dán key — agent không tự đăng ký thay được
- Checklist thao tác tay phải viết bằng tiếng Việt, đánh số, nêu rõ bấm gì ở đâu, và ước lượng thời gian từng bước
- Tiêu chí thành công số 6 là hoá đơn 0đ — checklist phải có bước xác nhận không có dịch vụ nào rơi vào tier trả phí

</specifics>

<deferred>
## Deferred Ideas

- **Trang quản lý allowlist trong app** — thêm sau khi seed script trở nên phiền; schema đã sẵn sàng
- **Neon branching cho preview deployment** — nếu sau này có người thứ hai cùng code
- **Publish OAuth consent screen ra Production** — nếu việc đồng bộ hai danh sách trở nên phiền phức

</deferred>
