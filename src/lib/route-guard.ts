/**
 * Phạm vi của route guard, tách thành module THUẦN.
 *
 * Chuỗi này sống ở đây chứ không nằm thẳng trong src/proxy.ts vì một lý do rất
 * cụ thể: `src/proxy.ts` re-export `auth` từ src/auth.ts, kéo theo NextAuth,
 * PrismaAdapter và src/lib/db.ts — module throw ngay lúc nạp khi DATABASE_URL
 * không phải chuỗi pooled. Nghĩa là test KHÔNG nạp được src/proxy.ts mà không
 * dựng cả một môi trường giả.
 *
 * Đó chính là lý do phần quan trọng nhất của phase này không có test nào
 * (CR-01): thứ cần kiểm tra bị khóa sau một import nặng. Tách ra đây thì phạm
 * vi guard kiểm tra được bằng một import thật, không cần bản sao chép tay.
 */

/**
 * Mọi đường KHÔNG khớp danh sách loại trừ đều đòi session.
 *
 * ĐÂY LÀ BẢN ĐỐI CHIẾU, không phải nguồn mà Next.js đọc. Turbopack phân tích
 * `config.matcher` trong src/proxy.ts lúc biên dịch và chỉ chấp nhận chuỗi
 * tĩnh viết thẳng tại chỗ — import hằng số vào đó làm `next build` đỏ. Nên
 * chuỗi tồn tại ở hai nơi, và test trong route-guard.test.ts đọc src/proxy.ts
 * rồi so từng ký tự để hai bản không trôi lệch trong im lặng.
 *
 * Viết dưới dạng loại trừ chứ không liệt kê route cần bảo vệ, vì mặc định phải
 * là ĐƯỢC BẢO VỆ: route mới thêm ở phase sau tự động được che, thay vì công
 * khai cho tới khi có người nhớ ra phải thêm nó vào danh sách.
 *
 * Từng mục loại trừ và lý do:
 *   api/auth              — chính đường OAuth callback; chặn nó thì không ai
 *                           đăng nhập xong được, guard sẽ tự khóa chính nó.
 *   dang-nhap             — người chưa đăng nhập bắt buộc phải tới được.
 *   chua-duoc-moi         — người bị từ chối không có session, mà vẫn phải đọc
 *                           được lời giải thích.
 *   manifest.webmanifest  — trình duyệt lấy trước khi có cookie khi cài PWA.
 *   icons                 — tài nguyên tĩnh của manifest.
 *   _next/static, _next/image, favicon.ico
 *                         — tài nguyên build; cho chúng qua guard chỉ tổ đốt
 *                           một vòng database cho mỗi file.
 */
export const PROTECTED_ROUTE_MATCHER =
  "/((?!api/auth|dang-nhap|chua-duoc-moi|manifest.webmanifest|icons|_next/static|_next/image|favicon.ico).*)";

/**
 * Quyết định của route guard: một request có được đi tiếp hay không.
 *
 * Đây là bản logic DUY NHẤT; callback `authorized` trong src/auth.ts gọi thẳng
 * hàm này. Tách ra để test được cái quyết định mà không phải nạp NextAuth.
 *
 * Không có nó, next-auth đặt `let authorized = true` rồi không bao giờ gán lại
 * (next-auth/lib/index.js:146), nên handleAuth luôn rơi xuống
 * `NextResponse.next()`: proxy vẫn chạy, vẫn đặt cookie csrf, và vẫn cho MỌI
 * request đi qua. Dòng `ƒ Proxy (Middleware)` trong output build chứng minh
 * file đã mắc dây, KHÔNG chứng minh nó chặn.
 */
export function isAuthorizedRequest(
  session: { user?: unknown } | null | undefined,
): boolean {
  return !!session?.user;
}
