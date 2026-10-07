# Checklist thiết lập Phase 1 — làm một lần, liền mạch

**Tổng thời gian:** ~36 phút cho phần thiết lập (bước 1–12), cộng ~15 phút cho phần kiểm chứng ở cuối. Để dành một tiếng cho chắc.

**Chuẩn bị trước khi bắt đầu, để không phải dừng giữa chừng:**

- Một tài khoản GitHub đã có quyền trên `CielCiel1/upper-i`
- Một tài khoản Google để tạo project trên Google Cloud
- Danh sách địa chỉ Gmail của tất cả thành viên nhóm (cần ở bước 6 **và** bước 11)
- Một điện thoại có mạng 4G — phần kiểm chứng ở cuối bắt buộc làm trên điện thoại, không làm trên trình duyệt máy tính được
- Terminal mở sẵn ở thư mục dự án

---

## Vì sao thứ tự này, và vì sao không được đảo

Có một vòng lặp phụ thuộc thật nằm giữa Google và Vercel:

> Google cần biết URL production để đăng ký redirect URI. App cần credentials của Google mới chạy được. Mỗi bên đợi bên kia.

**Cách gỡ:** Vercel cấp tên miền production ngay lúc *import* project — trước khi có bất kỳ bản build nào thành công. Nghĩa là bạn đọc được tên miền ở bước 3, dùng nó để cấu hình Google ở bước 7, rồi mới dán biến môi trường và deploy thật ở bước 9–10.

**Hệ quả trực tiếp, đọc kỹ dòng này:** lần deploy đầu tiên ở bước 3 **chắc chắn sẽ đỏ**. Lúc đó chưa có biến môi trường nào, nên build không thể qua được. **Đó là dự kiến, không phải bạn làm hỏng gì.** Bạn chỉ cần tên miền mà lần deploy đó sinh ra. Bản build thật nằm ở bước 10.

Các ràng buộc thứ tự không được đảo:

| Ràng buộc | Vì sao |
|---|---|
| 3 → 7 | Cần tên miền Vercel mới đăng ký được redirect URI |
| 7 → 9 | Cần client ID/secret của Google mới dán được biến môi trường |
| 9 → 10 | Thiếu `DATABASE_URL_UNPOOLED` thì build đỏ |
| 10 → 11 | Seed cần bảng, mà bảng chỉ tồn tại sau khi migration chạy ở bước 10 |
| 6 ↔ 11 | Hai danh sách phải khớp nhau — xem cảnh báo ở bước 6 |

---

## Bảy biến môi trường và nguồn của từng biến

Để tiện tra ngược khi có gì sai. Sáu biến đầu dán lên Vercel; biến cuối chỉ dùng ở máy bạn.

| Biến | Lấy ở đâu | Bước | Lên Vercel? |
|---|---|---|---|
| `DATABASE_URL` | Neon → Connect, **BẬT** connection pooling | 2 | có |
| `DATABASE_URL_UNPOOLED` | Neon → Connect, **TẮT** connection pooling | 2 | có |
| `AUTH_SECRET` | chạy `npx auth secret` ở máy bạn | 8 | có |
| `AUTH_GOOGLE_ID` | Google Cloud Console → Credentials → OAuth client | 7 | có |
| `AUTH_GOOGLE_SECRET` | Google Cloud Console → Credentials → OAuth client | 7 | có |
| `AUTH_TRUST_HOST` | không lấy ở đâu cả — gõ tay giá trị `true` | 9 | có |
| `ALLOWLIST_EMAILS` | bạn tự gõ danh sách thành viên | 11 | **không** — chỉ `.env.local` |

---

## Các bước

### 1. Tạo project Neon — ~3 phút

1. Mở <https://console.neon.tech>, đăng nhập (dùng nút **Continue with GitHub** cho nhanh).
2. Bấm **New Project**.
3. Điền:
   - **Project name:** `upper-i`
   - **Postgres version:** `17`
   - **Cloud service provider:** `AWS`
   - **Region:** chọn trong dropdown dòng ghi **Singapore (`ap-southeast-1`)**
4. Bấm **Create project**.

> **Region phải đúng là `ap-southeast-1`.** File `vercel.json` của dự án đã chốt cứng vùng chạy function là `sin1`, mà `sin1` chính là `ap-southeast-1`. Chọn lệch vùng thì mỗi truy vấn phải đi vòng qua hai region — app vẫn chạy, chỉ là chậm hơn hẳn mà không có lỗi nào để lần ra.

### 2. Lấy **hai** chuỗi kết nối — ~2 phút

Ở trang project vừa tạo, bấm nút **Connect** (góc trên bên phải).

1. Trong panel hiện ra, đảm bảo ô **Connection pooling** đang **BẬT**. Bấm biểu tượng copy.
   → Đây là `DATABASE_URL`.
2. **TẮT** ô **Connection pooling**. Chuỗi hiển thị đổi. Bấm copy lần nữa.
   → Đây là `DATABASE_URL_UNPOOLED`.
3. Ở máy: `cp .env.example .env.local`, mở `.env.local`, dán hai giá trị vào đúng hai dòng tương ứng.

**Dán KHÔNG kèm dấu nháy.** Không có `"` ở đầu và cuối giá trị.

> **Vì sao hai chuỗi, và chuyện gì xảy ra khi cắm nhầm chỗ**
>
> Cùng một database, khác host. Chuỗi **pooled** dành cho app lúc chạy: trên Vercel có nhiều instance function chạy song song, không có pooler thì chúng làm cạn giới hạn connection của Neon. Chuỗi **direct** dành cho các lệnh đổi schema, vì DDL không chạy xuyên qua pooler được.
>
> **Cách phân biệt bằng mắt — đây là dấu hiệu duy nhất:** nhìn **nhãn đầu tiên của hostname**.
>
> ```
> pooled : postgresql://…@ep-example-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
>                            └──────── có hậu tố -pooler ────┘
> direct : postgresql://…@ep-example-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
>                            └──── không có ────┘
> ```
>
> Hai giá trị này **không được giống nhau**. Nếu bạn dán cùng một chuỗi vào cả hai dòng thì việc cắm nhầm sẽ không còn phát hiện được nữa.

> **Cắm ngược là lỗi im lặng — nên dự án đã làm cho nó kêu to.**
>
> File `src/lib/db.ts` kiểm tra `DATABASE_URL` ngay lúc nạp module và **throw** nếu nhãn đầu của hostname không kết thúc bằng `-pooler`. Build sẽ đỏ với thông báo kiểu:
>
> ```
> Error: DATABASE_URL không dùng được làm endpoint POOLED của Neon:
> host 'ep-example-123456.ap-southeast-1.aws.neon.tech' là endpoint DIRECT
> (nhãn đầu 'ep-example-123456' thiếu hậu tố '-pooler').
> Chuỗi direct sẽ làm cạn connection limit khi serverless function scale ngang.
> Chuỗi direct chỉ dùng cho DATABASE_URL_UNPOOLED, phục vụ lệnh CLI của Prisma.
> ```
>
> **Lỗi này là cố ý.** Nếu không có nó, chuỗi direct vẫn chạy ngon lành suốt quá trình phát triển và chỉ lộ ra trên production dưới tải, dưới dạng lỗi kết nối chập chờn. Gặp thông báo này nghĩa là phép kiểm tra đang làm đúng việc — đổi `DATABASE_URL` thành chuỗi có `-pooler` rồi chạy lại.
>
> Thông báo còn phân biệt được một nguyên nhân khác hẳn: nếu nó nói *"không phân tích được thành URL … Kiểm tra dấu nháy thừa quanh giá trị"* thì chuỗi của bạn pooled đúng rồi, vấn đề chỉ là dấu `"` lọt vào giá trị.

### 3. Import repo lên Vercel và **ghi lại tên miền** — ~4 phút

1. Mở <https://vercel.com/new>, đăng nhập bằng GitHub.
2. Tìm repo `CielCiel1/upper-i`, bấm **Import**.
3. Vercel tự nhận diện framework là **Next.js** — không sửa gì ở Build/Output settings. Build command đã nằm trong `package.json`, vùng chạy đã nằm trong `vercel.json`.
4. **Chưa thêm biến môi trường nào.** Bấm thẳng **Deploy**.
5. **Bản build này sẽ ĐỎ. Đúng như dự kiến.** Không có biến môi trường thì `prisma generate` không chạy được. Bạn không làm hỏng gì cả — mục đích của bước này chỉ là để Vercel cấp tên miền.
6. Vào **Project → Settings → Domains** (hoặc nhìn ngay trên trang Overview). **Chép lại tên miền production và ghi ra giấy / dán vào note.**

> Thường sẽ là `https://upper-i.vercel.app`. **Nhưng đừng đoán** — nếu tên `upper-i` đã có người lấy trên toàn cầu, Vercel tự thêm hậu tố và bạn sẽ nhận được một tên khác. Bước 7 cần **đúng** tên miền thật mà dashboard đang hiện, chép sai một ký tự là đăng nhập hỏng.

### 4. Tạo project Google Cloud — ~2 phút

1. Mở <https://console.cloud.google.com>.
2. Bấm dropdown chọn project ở thanh trên cùng → **New Project**.
3. **Project name:** `upper-i`. Bấm **Create**.
4. Đợi thông báo tạo xong rồi **chọn project đó** ở dropdown — các bước sau phải nằm trong đúng project này.

### 5. Cấu hình OAuth consent screen — ~6 phút

**APIs & Services → OAuth consent screen**

1. **User type:** chọn **External**. Bấm **Create**.
2. App information:
   - **App name:** `Upper-I`
   - **User support email:** email của bạn
   - **Developer contact information:** email của bạn
3. **Scopes:** bấm **Add or remove scopes**, tick **đúng ba** mục này và không thêm gì khác:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
4. **Publishing status: để nguyên `Testing`.** Không bấm **Publish app**.

> **Đánh đổi đang chấp nhận, nói rõ để sau này không thấy khó hiểu:** ở chế độ Testing, chỉ tài khoản nằm trong danh sách test users mới đăng nhập được. Cái giá là bạn phải tự giữ hai danh sách khớp nhau (xem bước 6). Đổi lại, bạn được thêm một lớp chặn thứ hai, độc lập hoàn toàn với allowlist của app, miễn phí. Với nhóm dưới 10 người thì đây là lựa chọn đúng.

### 6. Thêm test users — ~2 phút

Vẫn ở màn OAuth consent screen, phần **Test users** → **Add users**. Thêm địa chỉ Gmail của **tất cả** thành viên.

> ### ⚠️ Hai danh sách phải khớp nhau chính xác
>
> Có **hai** danh sách kiểm soát việc ai vào được app, và chúng **không** tự đồng bộ:
>
> 1. **Test users của Google** — danh sách bạn đang gõ ở bước này
> 2. **`ALLOWLIST_EMAILS`** — biến môi trường bạn sẽ gõ ở bước 11, nguồn sự thật cho bảng `Allowlist` trong database
>
> Lệch nhau thì triệu chứng khác nhau, và chính triệu chứng cho biết danh sách nào thiếu:
>
> | Tình huống | Người đó thấy gì |
> |---|---|
> | Có trong `ALLOWLIST_EMAILS`, **thiếu** ở test users Google | Google chặn ngay trên màn hình chọn tài khoản, bằng thông báo của Google. **Không bao giờ chạm tới app.** Cổng kiểm tra của app không hề chạy. |
> | Có ở test users Google, **thiếu** trong `ALLOWLIST_EMAILS` | Qua được Google, vào tới app, rồi dừng ở màn **"Email này chưa được mời"** |
>
> Trường hợp đầu là trường hợp gây rối nhất: bạn đã thêm người ta vào allowlist, seed chạy sạch sẽ, mà họ vẫn không vào được — vì chỗ chặn nằm ở phía Google, trước app. **Thêm một người là hai thao tác, luôn luôn.**

### 7. Tạo OAuth client ID — ~4 phút

**APIs & Services → Credentials → Create Credentials → OAuth client ID**

1. **Application type:** `Web application`
2. **Name:** `upper-i web`
3. **Authorized JavaScript origins** — bấm **Add URI** hai lần:
   ```
   http://localhost:3000
   https://<tên-miền-từ-bước-3>
   ```
4. **Authorized redirect URIs** — bấm **Add URI** hai lần, là đúng hai origin trên nối thêm đường dẫn callback:
   ```
   http://localhost:3000/api/auth/callback/google
   https://<tên-miền-từ-bước-3>/api/auth/callback/google
   ```
5. Bấm **Create**. Hộp thoại hiện **Client ID** và **Client secret** — chép cả hai vào `.env.local`, lần lượt là `AUTH_GOOGLE_ID` và `AUTH_GOOGLE_SECRET`.

> **Redirect URI khớp theo từng ký tự.** `http` và `https` khác nhau, dấu `/` cuối khác nhau, thiếu một đoạn trong `/api/auth/callback/google` cũng khác nhau. Sai một chỗ thì Google trả về `redirect_uri_mismatch` — may là thông báo này nêu đúng URI mà nó nhận được, nên cứ so nguyên văn với danh sách ở đây.
>
> **Preview deployment sẽ không đăng nhập được, và đó là chủ ý.** URL của mỗi bản preview do Vercel sinh ngẫu nhiên, không thể đăng ký trước. Chỉ `localhost` và tên miền production là đăng nhập được.

### 8. Sinh `AUTH_SECRET` — ~1 phút

Ở terminal trong thư mục dự án:

```bash
npx auth secret
```

Lệnh in ra một chuỗi ngẫu nhiên (và có thể tự ghi vào `.env.local`). Kiểm tra `.env.local` đã có dòng `AUTH_SECRET=` với giá trị thật; nếu chưa thì dán tay vào.

### 9. Dán sáu biến môi trường lên Vercel — ~4 phút

**Vercel → project `upper-i` → Settings → Environment Variables**

Thêm từng biến một. Với **mỗi** biến, tick cả **ba** ô **Production**, **Preview**, **Development**:

| Key | Value |
|---|---|
| `DATABASE_URL` | chuỗi **pooled** từ bước 2 |
| `DATABASE_URL_UNPOOLED` | chuỗi **direct** từ bước 2 |
| `AUTH_SECRET` | giá trị từ bước 8 |
| `AUTH_GOOGLE_ID` | từ bước 7 |
| `AUTH_GOOGLE_SECRET` | từ bước 7 |
| `AUTH_TRUST_HOST` | `true` |

**Không gõ dấu nháy quanh bất kỳ giá trị nào.** Ô nhập của dashboard không bóc dấu nháy như `dotenv` làm, nên `"` sẽ lọt thẳng vào giá trị. Với `DATABASE_URL` thì hậu quả là build đỏ kèm thông báo *"không phân tích được thành URL"* đã nói ở bước 2.

> **`DATABASE_URL_UNPOOLED` cần ở thời điểm BUILD, không chỉ lúc chạy.** File `prisma.config.ts` gọi `env("DATABASE_URL_UNPOOLED")`, mà hàm đó **throw** khi biến vắng mặt chứ không trả về `undefined`. Nghĩa là **mọi** lệnh prisma đều cần nó — kể cả `prisma generate`, lệnh không hề đụng tới database. Thiếu biến này thì build hỏng với một thông báo của Prisma **không nhắc gì tới Vercel, deploy hay migration**, rất dễ đi tìm sai chỗ.
>
> `ALLOWLIST_EMAILS` **không** nằm trong bảng trên. Nó chỉ là đầu vào của `pnpm seed` chạy ở máy bạn. Dán lên Vercel cũng không sai, chỉ là thừa.

### 10. Deploy thật — ~3 phút

1. **Vercel → Deployments**, bấm dấu `…` ở bản deploy mới nhất → **Redeploy**.
2. **Bỏ tick ô "Use existing Build Cache".** Bản build trước đỏ, cache của nó không dùng lại được.
3. Bấm **Redeploy** và xem log. Thứ tự chạy là `prisma generate` → `prisma migrate deploy` → `next build`.
4. **Bản build này phải XANH.** Nếu đỏ, đọc dòng lỗi đầu tiên và đối chiếu bảng dưới:

| Thông báo chứa | Nguyên nhân | Sửa ở |
|---|---|---|
| `DATABASE_URL không dùng được làm endpoint POOLED` | cắm ngược hai chuỗi, hoặc dính dấu nháy | bước 2 / bước 9 |
| Prisma config error, không nhắc Vercel | thiếu `DATABASE_URL_UNPOOLED` | bước 9 |
| `Can't resolve '@/generated/prisma/client'` | `prisma generate` không chạy — build command bị sửa | `package.json` |
| `P3005` database đã có bảng | ai đó chạy `prisma db push` lên database này rồi | xem README, mục quy ước |

### 11. Seed allowlist — ~3 phút

Bảng vừa được tạo ở bước 10, giờ mới đổ dữ liệu được.

1. Mở `.env.local`, điền `ALLOWLIST_EMAILS` theo đúng định dạng `email[:nhãn]`, phân tách bằng **dấu phẩy**:
   ```
   ALLOWLIST_EMAILS=an@gmail.com:An,binh@gmail.com:Bình,chi@gmail.com
   ```
   Nhãn là tùy chọn (`chi@gmail.com` ở trên không có nhãn). Dùng **đúng** danh sách email đã thêm ở bước 6.
2. Đảm bảo `DATABASE_URL_UNPOOLED` trong `.env.local` đang trỏ về database production.
3. Chạy:
   ```bash
   pnpm seed
   ```
4. Script in ra ba con số: số dòng allowlist đã upsert, số dòng đã xóa, số session đã thu hồi. Lần đầu thì số thứ hai và thứ ba phải là `0`.

> ### ⚠️ Định dạng `ALLOWLIST_EMAILS` — gõ sai một lần là hỏng cả danh sách
>
> **Phân tách bằng dấu phẩy `,`. Không phải dấu chấm phẩy, không phải dấu cách, không phải xuống dòng.**
>
> Đây từng là một lỗ hổng thật và đã được bịt: trước đây, gõ `;` thay cho `,` khiến **cả danh sách sập thành một mục rác duy nhất**, mà seed chỉ kiểm tra "có ít nhất một mục" nên vẫn cho qua — rồi xóa sạch mọi dòng allowlist thật và thu hồi mọi session, in báo cáo gọn gàng và thoát thành công. Không ai đăng nhập lại được.
>
> **Giờ thì mỗi mục được kiểm tra hình dạng email riêng lẻ, và một mục sai làm cả lệnh dừng lại — không ghi gì vào database.** Thông báo nêu đúng mục có vấn đề:
>
> ```
> Error: ALLOWLIST_EMAILS chứa mục không phải địa chỉ email: "an@gmail.com;binh@gmail.com".
> Định dạng: email[:nhãn], phân tách bằng DẤU PHẨY.
> ```
>
> Gặp thông báo này thì **không có gì bị xóa cả** — sửa dấu phân tách rồi chạy lại.
>
> Lưu ý thêm: `,` và `;` bị cấm **bên trong** cả phần tên lẫn phần domain của email, chính vì lý do trên.

### 12. Xác nhận gói miễn phí **trước khi** có lưu lượng — ~2 phút

Đây là lần đọc thứ nhất trong hai lần. Lần này trả lời câu hỏi *"tôi đã đăng ký đúng gói chưa"*.

1. **Vercel → Settings → Billing** — gói phải là **Hobby**.
2. **Neon → Billing** — gói phải là **Free**.
3. **Quan trọng nhất: không có thẻ thanh toán nào gắn vào cả hai tài khoản.** Kiểm tra mục payment method của từng bên, phải trống.
4. Google OAuth ở chế độ Testing không phát sinh phí, không cần kiểm tra gì thêm.

> **Vì sao việc không gắn thẻ mới là điều đáng kiểm tra, chứ không phải tên gói.** Một tài khoản free *có gắn thẻ* vẫn có thể âm thầm bắt đầu tính tiền khi vượt hạn mức. Không gắn thẻ thì trường hợp xấu nhất là dịch vụ bị tạm ngưng — đúng kiểu hỏng mà dự án này muốn, vì nó nhìn thấy được ngay.

### 13. Chuyển sang phần kiểm chứng — ~15 phút

Phần thiết lập đã xong. Từ đây trở đi là **quan sát**, không còn cấu hình gì nữa.

**Làm trên điện thoại, dùng 4G, không dùng trình duyệt máy tính.** Vài phép kiểm tra — vùng an toàn quanh tai thỏ, kích thước vùng chạm, thời điểm vẽ khung lần đầu khi hàm còn nguội — không quan sát được bằng cách nào khác.

Mở phần **"Kiểm chứng"** ngay dưới đây và làm lần lượt chín phép kiểm tra.

> **Về lần đọc hoá đơn thứ hai.** Bước 12 xác nhận gói *trước khi* có bất kỳ lưu lượng nào — nó chứng minh bạn đăng ký đúng, nhưng không chứng minh gì về chi phí khi app thật sự chạy. Phép kiểm tra **số 9** ở phần dưới là lần đọc thứ hai, sau khi đã có đăng nhập thật. Hai lần đọc trả lời hai câu hỏi khác nhau và cần cả hai. Không phải quay ngược lại bước 12.

---

# Kiểm chứng — chín phép kiểm tra

Làm sau khi xong bước 12. Ghi lại kết quả từng phép rồi báo lại.

**Đối chiếu với sáu tiêu chí thành công của Phase 1:**

| Tiêu chí ROADMAP | Phép kiểm tra |
|---|---|
| 1. Mở URL trên điện thoại, đăng nhập Google, vào trang hiện tên mình | 1, 2 |
| 2. Email ngoài allowlist bị từ chối, không tạo tài khoản | 3 |
| 3. Thêm thành viên mới đăng nhập được ngay, không deploy lại | 4, 5 |
| 4. `git push` → production chạy code mới, migration đã áp, không thao tác tay | 6 |
| 5. Hôm sau mở lại vẫn còn phiên; đăng xuất ở bất kỳ màn nào đều thoát được | 7, 8 |
| 6. Hoá đơn Vercel + Neon + Google = 0đ | 9 |

### Kiểm tra 1 — Đăng nhập chạy được (AUTH-01)

Mở tên miền production trên điện thoại, qua mạng 4G. Bấm **Đăng nhập với Google**, chọn một tài khoản nằm trong allowlist.

**Kết quả mong đợi:** màn hình chính hiện `Chào {tên bạn}`, bên dưới là email của bạn.

### Kiểm tra 2 — Giao diện hiển thị đúng (INFRA-07)

Vẫn trên màn hình đó:

- Header và nền hiện ra **trước** dòng chào — đây là PPR đang hoạt động
- Dấu thanh tiếng Việt (`Chào`, `Mạnh`, `Hồng`) không bị cắt ngọn
- Nội dung không bị tai thỏ che, và không bị thanh home indicator đè
- Chuyển điện thoại sang dark mode → toàn màn đổi theme và vẫn đọc được

### Kiểm tra 3 — Người ngoài bị từ chối **và không tạo ra dòng nào** (AUTH-02)

**Đây là phép kiểm tra quan trọng nhất của cả phase.** Nó cần so sánh trước–sau; chỉ đọc một lần sau khi thử thì không chứng minh được gì, vì không có mốc nào để đối chiếu.

**3a — Ghi mốc TRƯỚC, trước khi thử bất cứ điều gì.** Mở Neon → **SQL Editor**:

```sql
SELECT (SELECT count(*) FROM "User")    AS users,
       (SELECT count(*) FROM "Account") AS accounts,
       (SELECT count(*) FROM "Session") AS sessions;
```

**Chép ba con số ra giấy.** Đừng bỏ qua bước này rồi nhớ lại sau.

**3b — Thử đăng nhập bằng tài khoản ngoài allowlist.** Đăng xuất, rồi đăng nhập bằng một tài khoản Google **không** có trong `ALLOWLIST_EMAILS` nhưng **có** trong danh sách test users của Google.

> Bắt buộc phải là test user. Nếu không, Google chặn ở phía nó và cổng kiểm tra của app **không hề chạy** — phép kiểm tra sẽ "đạt" vì một lý do hoàn toàn khác.

**Kết quả mong đợi:** màn hình **"Email này chưa được mời"**, hiện đúng email vừa dùng.

**3c — Chạy lại y hệt câu truy vấn trên và so sánh.** Cả ba con số phải **giống hệt** mốc ở 3a.

- `users` và `accounts` không đổi → không tài khoản nào được tạo
- `sessions` không đổi → không phiên nào được cấp

**Nếu bất kỳ số nào tăng, AUTH-02 trượt và phase không chốt được.** Báo lại cặp số trước/sau thay vì duyệt.

> Vì sao kiểm tra bằng đếm dòng chứ không bằng đọc code: bảo đảm "từ chối thì không ghi gì" đến từ thứ tự xử lý bên trong thư viện auth, không phải từ code của dự án. Một lần nâng phiên bản thư viện có thể đảo thứ tự đó trong im lặng.

### Kiểm tra 4 — Thêm thành viên không cần deploy lại

1. Thêm một email vào `ALLOWLIST_EMAILS` trong `.env.local`
2. Thêm **đúng** email đó vào test users của Google (bước 6)
3. Chạy `pnpm seed`

**Kết quả mong đợi:** người đó đăng nhập được ngay. **Không** deploy, **không** push, **không** restart.

### Kiểm tra 5 — Gỡ thành viên có hiệu lực tức thì, mà không xoá lịch sử

Xoá email vừa thêm khỏi `ALLOWLIST_EMAILS`, chạy lại `pnpm seed`. Trên máy người đó, tải lại app.

**Kết quả mong đợi:** họ bị đăng xuất.

Rồi xác nhận **cả ba** kết quả trong SQL Editor — kết quả thứ ba là cái dễ bị bỏ qua nhất, và là cái bảo vệ Phase 2:

```sql
SELECT (SELECT count(*) FROM "Allowlist" WHERE email = 'removed@example.com') AS allowlist_rows,
       (SELECT count(*) FROM "Session" s JOIN "User" u ON u.id = s."userId"
          WHERE lower(u.email) = 'removed@example.com')                       AS live_sessions,
       (SELECT count(*) FROM "User" WHERE lower(email) = 'removed@example.com') AS user_rows;
```

**Mong đợi:** `allowlist_rows` = 0, `live_sessions` = 0, và **`user_rows` vẫn = 1**.

> Dòng `User` **phải còn**. Nó là đích khoá ngoại vĩnh viễn cho mọi dòng sổ cái mà Phase 2 sẽ ghi — gỡ quyền truy cập của một người không bao giờ được xoá chính con người mà các khoản chi trong quá khứ đang trỏ tới. Nếu `user_rows` trả về 0 thì seed đang xoá user và phải sửa trước khi bắt đầu Phase 2.

### Kiểm tra 6 — `git push` tự deploy (INFRA-03, INFRA-04)

Tạo một commit nhỏ trên nhánh chính và push.

**Kết quả mong đợi:** một deployment tự khởi động, log build cho thấy bước migration chạy, và site production phục vụ bản build mới — không thao tác tay nào.

### Kiểm tra 7 — Phiên đăng nhập bền (AUTH-03)

Chờ một ngày rồi mở lại không phải là chiến lược kiểm chứng. Làm thế này:

**Ngay lập tức:** đóng hẳn app (không phải để chạy nền) rồi mở lại.
**Mong đợi:** vẫn đang đăng nhập, không hỏi lại. Điều này chứng minh cookie là loại bền chứ không phải loại chết theo tiến trình trình duyệt — đó mới là kiểu hỏng đáng bắt.

Rồi kiểm tra thời hạn đã lưu, thay vì ngồi đợi nó:

```sql
SELECT expires, expires > now() + interval '29 days' AS has_full_window FROM "Session";
```

`has_full_window` phải là `true`, chứng minh thời hạn 30 ngày thật sự được áp chứ không phải một mặc định ngắn hơn của thư viện.

Hôm sau mở lại vẫn nên làm, nhưng chỉ còn là kiểm tra bổ sung.

### Kiểm tra 8 — Đăng xuất chạy được từ **mọi** màn (AUTH-06)

Có hai màn mang nút đăng xuất, và yêu cầu là "từ bất kỳ màn nào" — thử một màn chỉ chứng minh được một nửa.

**Màn chính:** bấm **Đăng xuất**.
**Mong đợi:** quay về màn đăng nhập, và mở lại app không khôi phục phiên. Xác nhận dòng đã bị xoá chứ không chỉ cookie — `SELECT count(*) FROM "Session";` phải **giảm đi một**.

**Màn từ chối:** bấm **Dùng tài khoản khác**.
**Mong đợi:** quay về màn đăng nhập, không lỗi. (Phía server đây là thao tác rỗng, vì người bị từ chối chưa từng có phiên — thứ đang kiểm là nó không lỗi và điều hướng đúng.)

### Kiểm tra 9 — Hoá đơn bằng 0đ (INFRA-05)

Lần đọc thứ hai, sau khi đã có đăng nhập thật. Xem đúng ba chỗ:

| Dịch vụ | Xem ở đâu | Phải thấy |
|---|---|---|
| Vercel | Settings → Billing | gói **Hobby**, số tiền `$0.00`, không có payment method |
| Neon | Billing | gói **Free**, `$0.00`, không có payment method, dung lượng dưới 1 GB |
| Google Cloud | Billing | **không có billing account nào gắn với project `upper-i`** — OAuth ở chế độ Testing không cần, và không gắn là đúng |

---

# Quản lý thành viên — việc sẽ làm lặp lại

Thêm hoặc gỡ một người là **hai thao tác**, luôn luôn:

1. Sửa `ALLOWLIST_EMAILS` trong `.env.local`, chạy `pnpm seed`
2. Sửa danh sách **test users** trên Google consent screen cho khớp

**`pnpm seed` là nguồn sự thật duy nhất.** Nó không chỉ thêm — nó còn **xoá** những dòng allowlist không còn trong biến môi trường, và **xoá luôn session** của người bị gỡ. Chính điều đó khiến việc gỡ quyền có hiệu lực ngay lập tức, thay vì phải đợi phiên của họ hết hạn. Dòng `User` của họ vẫn được giữ nguyên.

Vì seed có xoá, **định dạng của biến môi trường là thứ phải gõ đúng** — xem cảnh báo ở bước 11.
