import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { normalizeEmail } from "@/lib/allowlist";
import { prisma } from "@/lib/db";
import { isAuthorizedRequest } from "@/lib/route-guard";

// Cấu hình xác thực DUY NHẤT của dự án. Mọi phase sau lấy user hiện tại bằng
// cách gọi `auth()` từ đây; không nơi nào khác được tự dựng NextAuth().

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 ngày — AUTH-03: mở lại app hôm sau vẫn còn phiên.
    updateAge: 24 * 60 * 60, // Chạm lại dòng Session nhiều nhất 1 lần/ngày.

    // ĐÍNH CHÍNH một câu nói hơi quá trong CONTEXT.md, để người đọc sau không
    // trông cậy vào một lớp bảo vệ không tồn tại: session database khiến việc
    // thu hồi KHẢ THI VÀ TỨC THÌ, chứ không TỰ ĐỘNG. Callback `signIn` bên dưới
    // chỉ chạy trên đường OAuth callback, KHÔNG chạy mỗi lần đọc session — nên
    // bảng Allowlist không hề được tra cứu lại theo từng request. Một thành viên
    // bị gỡ khỏi allowlist mất quyền vì prisma/seed.ts XÓA dòng Session của họ,
    // không phải vì session tự kiểm tra lại allowlist. Gỡ đoạn xóa đó trong seed
    // là đủ để thành viên bị gỡ giữ quyền truy cập tới tận 30 ngày.
  },
  pages: {
    signIn: "/dang-nhap",
    // Lỗi OAuth thật (mạng rớt, user bấm hủy ở màn hình Google, cấu hình sai)
    // quay về chính màn đăng nhập, nơi UI-SPEC đặt câu báo lỗi.
    //
    // CỐ Ý không trỏ về trang từ chối: việc bị từ chối do allowlist được xử lý
    // bằng redirect riêng trong callback `signIn` bên dưới. Gộp hai thứ làm một
    // sẽ hiện "chưa được mời" cho một người đã được mời chỉ vì 4G chập chờn.
    error: "/dang-nhap",
  },
  callbacks: {
    // PHẦN QUYẾT ĐỊNH CỦA ROUTE GUARD. src/proxy.ts chỉ MẮC DÂY guard; callback
    // này là thứ duy nhất khiến guard TỪ CHỐI được.
    //
    // Không có nó, next-auth đặt `let authorized = true` rồi không bao giờ gán
    // lại (node_modules/next-auth/lib/index.js:146), nên handleAuth luôn rơi
    // xuống `NextResponse.next()`: proxy vẫn chạy, vẫn đặt cookie csrf, và vẫn
    // cho MỌI request đi qua. Dòng `ƒ Proxy (Middleware)` trong output build
    // chứng minh file đã mắc dây, KHÔNG chứng minh nó chặn — đó là hai việc
    // khác nhau, và chỉ phép thử runtime phân biệt được.
    //
    // Trả về `false` để Auth.js tự redirect về `pages.signIn` (/dang-nhap).
    // Không tự dựng NextResponse.redirect ở đây: Auth.js đã gắn sẵn callbackUrl
    // để sau khi đăng nhập xong người dùng quay lại đúng trang vừa bị chặn.
    //
    // Thân hàm nằm ở src/lib/route-guard.ts — module thuần, test nạp được mà
    // không kéo theo Prisma. Quyết định của guard phải có test, và trước CR-01
    // nó không có test nào vì bị khóa sau import này.
    authorized({ auth: session }) {
      return isAuthorizedRequest(session);
    },

    // CỔNG ALLOWLIST. Đây là lớp kiểm soát truy cập DUY NHẤT của app.
    //
    // AUTH-02 — vì sao từ chối ở đây là KHÔNG ghi một dòng nào:
    // Auth.js chạy callback này bên trong bước authorize (`handleAuthorized`),
    // và bước đó nằm TRƯỚC bước tạo user / nối account / phát session
    // (`handleLoginOrRegister`) — hai lời gọi liền nhau trong
    // @auth/core/lib/actions/callback/index.js (dòng 63 và 70). Đã đọc source
    // của đúng bản đang cài (@auth/core 0.41.3), không suy từ tài liệu.
    //
    // Hệ quả: cả `return false` lẫn `return "<đường dẫn>"` đều thoát ở dòng 69,
    // phía TRÊN dòng 70. Không User, không Account, không Session. Không cần
    // bất kỳ workaround nào, và thêm workaround vào đây là sai.
    async signIn({ profile, account }) {
      if (account?.provider !== "google") return false;

      // Email CHƯA được Google xác minh thì không bao giờ đem so với allowlist:
      // một địa chỉ chưa xác minh có thể do kẻ tấn công tự khai, nên khớp nó
      // với một địa chỉ đã được mời chính là đường chiếm quyền thẳng vào nhóm.
      if (!profile?.email || !profile.email_verified) return false;

      const email = normalizeEmail(profile.email);
      const invited = await prisma.allowlist.findUnique({ where: { email } });
      if (invited) return true;

      // Trả về CHUỖI là hành vi có kiểu rõ ràng của callback này
      // (`Awaitable<boolean | string>`): Auth.js đổi nó thành một redirect và
      // trả ngay cho caller — vẫn ở đúng điểm thoát như `return false`, tức là
      // vẫn chưa ghi gì cả.
      //
      // Vì sao phải mang email theo: màn hình từ chối cần GỌI TÊN địa chỉ vừa
      // dùng, bởi nguyên nhân thực tế áp đảo là chạm nhầm một trong nhiều tài
      // khoản Google đang đăng nhập sẵn trên điện thoại. Người bị từ chối không
      // có session và không có dòng nào trong database, nên trang không thể tra
      // ngược được — truyền qua URL là cách duy nhất còn lại.
      //
      // ĐÁNH ĐỔI ĐÃ CHẤP NHẬN CÓ CÂN NHẮC: cách này đặt một địa chỉ email vào
      // URL, nên nó sẽ nằm trong lịch sử trình duyệt của một máy có thể dùng
      // chung, trong log truy cập của hosting, và trong header `Referer` của mọi
      // request đi ra từ trang đó. Chấp nhận vì giá trị lộ ra là địa chỉ mà
      // chính người đó vừa tự chọn, được trả lại cho chính họ: không phải bí
      // mật, không phải thông tin xác thực, không mở được gì. Hai biện pháp
      // giảm thiểu là BẮT BUỘC chứ không tùy chọn, plan 05 thực thi: trang từ
      // chối đặt referrer policy `no-referrer`, và trang không nạp bất kỳ tài
      // nguyên bên thứ ba nào.
      //
      // `error=AccessDenied` là tham số đánh dấu: cặp (marker, email) chính là
      // hợp đồng vào trang của /chua-duoc-moi. Plan 05 dùng marker để chặn người
      // gõ thẳng URL. Nó KHÔNG phải ranh giới bảo mật — ai cũng giả được — việc
      // của nó chỉ là chặn truy cập tình cờ vào một trang gây hiểu nhầm.
      return `/chua-duoc-moi?error=AccessDenied&email=${encodeURIComponent(email)}`;
    },

    // Gắn `User.id` lên session để các phase sau có định danh nội bộ ổn định —
    // đây là đích khóa ngoại của mọi dòng sổ cái mà Phase 2 sẽ tạo.
    //
    // Về cái `if`: ĐÃ KIỂM CHỨNG BẰNG CÁCH CHẠY THỬ, và kết quả khác với điều
    // plan dự đoán. Plan nói `session.user.id = user.id` trần sẽ không qua nổi
    // strict mode vì `user` và `id` đều optional. Thực tế `tsc --noEmit` xanh cả
    // khi bỏ `if` đi. Lý do: tham số của callback này là một kiểu giao, và ở
    // nhánh `strategy: "database"` thì `session.user` là `AdapterUser` — nơi
    // `id: string` BẮT BUỘC. Chỗ `user?: User` optional nằm ở `DefaultSession`,
    // không phải ở kiểu mà callback thực sự nhận.
    //
    // Vẫn giữ `if` dù trình biên dịch không đòi, vì nó bảo vệ một thứ khác:
    // kiểu ở đây mô tả hợp đồng của adapter chứ không phải một bảo đảm lúc chạy.
    // Giữ `if` đổi một trường hợp "không bao giờ xảy ra" từ TypeError lúc chạy
    // thành một session thiếu `id`. Đáng chú ý là lựa chọn này ngược hướng với
    // src/lib/db.ts, nơi chủ đích throw thật to — khác nhau vì ở đó sai cấu hình
    // phải chặn deploy, còn ở đây crash phiên đăng nhập của một thành viên hợp lệ
    // không sửa được gì. Tuyệt đối không thay bằng `as`/`!`: ép kiểu sẽ giấu đi
    // đúng cái khả năng vắng mặt này thay vì xử lý nó.
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
