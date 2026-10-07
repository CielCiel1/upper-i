# Upper-I

Chia tiền và theo dõi nợ cho một nhóm cố định dưới 10 người sống/ăn chung lâu dài.

Số dư luôn tái lập được từ sổ giao dịch — không bao giờ drift.

**Stack:** Next.js 16 (App Router) · Postgres trên Neon · Prisma 7 · Auth.js v5 (Google OAuth, database session) · Tailwind v4 · Vitest · Biome · deploy trên Vercel.

---

## Yêu cầu

| | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | **≥ 22.12** | ép bởi `engines` trong `package.json` |
| pnpm | **12.9.1** | ghim bởi `packageManager` |

### Cài pnpm

Cách chuẩn là `corepack enable`. **Trên Debian/Ubuntu, cách đó hỏng nếu không có quyền root:** corepack tạo symlink vào `/usr/bin`. Ngoài ra, bản corepack đóng gói trong repo Debian tìm `pnpm.cjs`, trong khi pnpm 12 phát hành `pnpm.mjs` — nên kể cả chạy bằng `sudo` cũng vẫn hỏng.

Cách đi vòng, không cần root:

```bash
npm i -g --prefix ~/.local pnpm
export PATH="$HOME/.local/bin:$PATH"   # thêm vào ~/.bashrc hoặc ~/.zshrc
pnpm -v                                 # phải in 12.9.1
```

---

## Chạy ở máy

```bash
cp .env.example .env.local
# điền .env.local — xem bảng "Biến môi trường" bên dưới
pnpm install
pnpm seed      # đổ ALLOWLIST_EMAILS vào bảng Allowlist
pnpm dev       # http://localhost:3000
```

**Cần một database Neon thật trước khi `pnpm seed` hay `pnpm dev` chạy được.** Không có chế độ offline: `src/lib/db.ts` throw ngay lúc nạp module nếu thiếu `DATABASE_URL`, và `prisma.config.ts` throw nếu thiếu `DATABASE_URL_UNPOOLED`. Nếu dự án chưa được thiết lập lần nào, làm theo `.planning/phases/UPI-01-n-n-t-ng-s-ng/01-SETUP-CHECKLIST.md` trước.

Đăng nhập ở `localhost` cần `http://localhost:3000/api/auth/callback/google` nằm trong Authorized redirect URIs của OAuth client, và tài khoản Google của bạn nằm trong test users — xem checklist.

---

## Biến môi trường

Chép từ `.env.example`. **Không bọc giá trị trong dấu nháy** khi dán lên dashboard Vercel: ô nhập ở đó không bóc nháy như `dotenv`, nên nháy lọt thẳng vào giá trị.

| Biến | Nguồn | Lúc build | Lúc chạy |
|---|---|---|---|
| `DATABASE_URL` | Neon → Connect, pooling **BẬT** | nên có | bắt buộc |
| `DATABASE_URL_UNPOOLED` | Neon → Connect, pooling **TẮT** | **bắt buộc** | — |
| `AUTH_SECRET` | `npx auth secret` | — | bắt buộc |
| `AUTH_GOOGLE_ID` | Google Cloud → Credentials | — | bắt buộc |
| `AUTH_GOOGLE_SECRET` | Google Cloud → Credentials | — | bắt buộc |
| `AUTH_TRUST_HOST` | gõ tay `true` | — | bắt buộc trên Vercel |
| `ALLOWLIST_EMAILS` | bạn tự gõ | — | chỉ local, cho `pnpm seed` |

**Hai chuỗi kết nối, và cắm ngược là lỗi im lặng.** Cùng một database, khác hostname: bản **pooled** có hậu tố `-pooler` ở nhãn đầu tiên của hostname, bản **direct** thì không.

- `DATABASE_URL` phải là **pooled** — app chạy trên serverless function, nhiều instance song song sẽ làm cạn connection limit nếu không qua pooler.
- `DATABASE_URL_UNPOOLED` phải là **direct** — DDL không chạy xuyên qua pooler.

`src/lib/db.ts` phân tích hostname và **throw ngay lúc nạp module** nếu `DATABASE_URL` không pooled. Lỗi đó là cố ý: không có nó, chuỗi direct chạy ngon suốt quá trình phát triển rồi chỉ lộ ra trên production dưới tải.

**`DATABASE_URL_UNPOOLED` cần ở thời điểm build**, không chỉ lúc chạy — `prisma.config.ts` gọi `env()`, mà hàm đó throw thay vì trả `undefined`, nên **mọi** lệnh prisma CLI đều cần nó, kể cả `prisma generate`. Thiếu biến này thì build hỏng với thông báo không nhắc gì tới Vercel lẫn migration.

---

## Scripts

| Lệnh | Làm gì |
|---|---|
| `pnpm dev` | dev server trên <http://localhost:3000> |
| `pnpm build` | `prisma generate && prisma migrate deploy && next build` — chính là build command Vercel chạy |
| `pnpm start` | chạy bản build production tại chỗ |
| `pnpm lint` | Biome check (thay cả ESLint lẫn Prettier) |
| `pnpm format` | Biome format, ghi đè file |
| `pnpm typecheck` | `next typegen && tsc --noEmit` |
| `pnpm test` | Vitest, chạy một lượt |
| `pnpm guard:probe` | thử **runtime** route guard — cần `pnpm build` trước |
| `pnpm seed` | đổ `ALLOWLIST_EMAILS` vào bảng `Allowlist` (có thẩm quyền — xem dưới) |

**Vì sao có `guard:probe` riêng:** `pnpm build` in dòng `ƒ Proxy (Middleware)`, và dòng đó chứng minh file proxy **đã mắc dây** — không chứng minh nó **từ chối**. Khoảng cách giữa hai điều đó từng là một lỗ hổng thật: mọi gate tĩnh xanh trong khi mọi route được bảo vệ mở toang. Chỉ một request thật không mang cookie phân biệt được hai trạng thái đó.

---

## Quản lý thành viên

Thêm hoặc gỡ một người là **hai thao tác**, luôn luôn:

1. Sửa `ALLOWLIST_EMAILS` trong `.env.local` rồi chạy `pnpm seed`
2. Sửa danh sách **test users** trên Google OAuth consent screen cho khớp

Lệch nhau thì triệu chứng cho biết danh sách nào thiếu:

| Tình huống | Người đó thấy gì |
|---|---|
| Có trong allowlist, thiếu ở test users Google | Google chặn trước, **không bao giờ chạm tới app** |
| Có ở test users Google, thiếu trong allowlist | Vào tới app rồi dừng ở màn "Email này chưa được mời" |

### `pnpm seed` là nguồn sự thật duy nhất

Nó không chỉ thêm. Nó **xoá** dòng `Allowlist` không còn trong biến môi trường, và **xoá luôn `Session`** của người bị gỡ — đó là lý do việc gỡ quyền có hiệu lực ngay thay vì đợi phiên hết hạn.

Dòng `User` của họ **được giữ lại**. Đó là đích khoá ngoại vĩnh viễn cho mọi dòng sổ cái mà Phase 2 ghi; xoá nó sẽ làm mồ côi các khoản chi trong quá khứ.

**Định dạng `ALLOWLIST_EMAILS`: `email[:nhãn]`, phân tách bằng DẤU PHẨY.**

```
ALLOWLIST_EMAILS=an@gmail.com:An,binh@gmail.com:Bình,chi@gmail.com
```

Vì seed có xoá, một lỗi phân tách từng có thể xoá sạch allowlist. Giờ **mỗi mục được kiểm tra hình dạng email riêng lẻ**, và một mục sai làm cả lệnh dừng **trước khi ghi bất cứ thứ gì**:

```
Error: ALLOWLIST_EMAILS chứa mục không phải địa chỉ email: "an@gmail.com;binh@gmail.com".
Định dạng: email[:nhãn], phân tách bằng DẤU PHẨY.
```

Gặp thông báo này thì không có gì bị xoá cả — sửa dấu phân tách rồi chạy lại.

---

## Quy ước

### Không bao giờ chạy `prisma db push` lên database production

Dùng `prisma migrate dev` ở máy, nó sinh ra file migration được commit vào repo.

`db push` tạo bảng mà **không ghi lịch sử migration**. Sau đó mọi lần deploy đều chạy `prisma migrate deploy`, lệnh này thấy bảng đã tồn tại nhưng `_prisma_migrations` trống, và hỏng với `P3005`. Gỡ ra phải `prisma migrate resolve --applied` bằng tay.

### `migrate deploy` nằm trong build command là cố ý

Migration hỏng thì build hỏng, và bản cũ vẫn tiếp tục phục vụ. Đó là hành vi mong muốn: thà không deploy còn hơn deploy một bản code không khớp schema.

### Mọi truy cập database đi qua `src/lib/db.ts`

Không module nào khác được tự dựng `PrismaClient`.

---

## Thiết lập lần đầu

Tạo Neon + Vercel + Google OAuth là thao tác tay, làm một lần, khoảng 36 phút:

**`.planning/phases/UPI-01-n-n-t-ng-s-ng/01-SETUP-CHECKLIST.md`**

Thứ tự các bước trong đó **không được đảo** — có một vòng phụ thuộc giữa tên miền Vercel và redirect URI của Google, và checklist đã gỡ sẵn.
