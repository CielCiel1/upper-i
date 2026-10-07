export { auth as proxy } from "@/auth";

// Route guard chạy theo từng request. Đây là điểm thứ hai mà allowlist phải giữ:
// callback `signIn` quyết định có bao giờ tạo tài khoản hay không, còn file này
// quyết định một session còn giá trị hay không trên từng request.
//
// ============================================================================
// VỊ TRÍ FILE LÀ PHẦN QUAN TRỌNG NHẤT — ĐỪNG DI CHUYỂN NÓ.
// ============================================================================
// File này PHẢI nằm ở `src/proxy.ts`, ngang hàng với `app/`. Dự án dùng thư mục
// `src/`, và quy ước là "ở gốc project, HOẶC trong `src/` nếu có" — nên `src/`
// mới là tầng đúng.
//
// Đặt nhầm ra gốc repository thì file bị bỏ qua trong im lặng: `next build` vẫn
// thành công, không một cảnh báo nào được in ra, không test nào đỏ, và MỌI route
// được bảo vệ trở thành công khai. Nó HỎNG THEO KIỂU MỞ TOANG, và nó qua được
// mọi phép kiểm tra trừ đúng một phép.
//
// Phép kiểm tra đó là output của `next build`, nơi liệt kê dòng:
//
//     ƒ Proxy (Middleware)      ← có = đã mắc dây. Không có = đã tắt trong im lặng.
//
// Đó là BẰNG CHỨNG DUY NHẤT có được rằng guard này tồn tại. Plan 05 kiểm tra nó
// trên bản build đầy đủ.
//
// Dùng `proxy.ts`, KHÔNG dùng `middleware.ts`: quy ước `middleware` đã bị đánh
// dấu deprecated và đổi tên thành `proxy`. Bản cũ vẫn chạy, nên hai file không
// bao giờ được cùng tồn tại — phần lớn hướng dẫn trên mạng vẫn chỉ cách cũ.
//
// Guard này chạy trên Node runtime, nên Prisma và session database hoạt động
// trực tiếp tại đây, không cần tách edge-runtime như các bản Next.js cũ bắt buộc.
//
// GIỚI HẠN, ghi lại vì nó định hình Phase 2: guard này KHÔNG bảo vệ server
// action. Server action đi theo đường POST riêng và phải tự gọi lại `auth()`.
// Phase 1 chỉ có mỗi action đăng xuất nên gần như vô hại, nhưng khuôn mẫu được
// dựng từ bây giờ để các action chuyển tiền của Phase 2 thừa hưởng sẵn.
export const config = {
  // Mọi thứ KHÔNG khớp danh sách loại trừ đều đòi session. Viết dưới dạng loại
  // trừ chứ không phải liệt kê route cần bảo vệ, vì mặc định phải là ĐƯỢC BẢO VỆ:
  // một route mới thêm vào ở phase sau sẽ tự động được che, thay vì công khai cho
  // tới khi có người nhớ ra phải thêm nó vào danh sách.
  //
  // Từng mục loại trừ và lý do:
  //   api/auth              — chính đường OAuth callback; chặn nó thì không ai
  //                           đăng nhập xong được, guard sẽ tự khóa chính nó.
  //   dang-nhap             — người chưa đăng nhập bắt buộc phải tới được.
  //   chua-duoc-moi         — người bị từ chối không có session, mà vẫn phải đọc
  //                           được lời giải thích.
  //   manifest.webmanifest  — trình duyệt lấy trước khi có cookie khi cài PWA.
  //   icons                 — tài nguyên tĩnh của manifest.
  //   _next/static, _next/image, favicon.ico
  //                         — tài nguyên build; cho chúng qua guard chỉ tổ đốt
  //                           một vòng database cho mỗi file.
  matcher: [
    "/((?!api/auth|dang-nhap|chua-duoc-moi|manifest.webmanifest|icons|_next/static|_next/image|favicon.ico).*)",
  ],
};
