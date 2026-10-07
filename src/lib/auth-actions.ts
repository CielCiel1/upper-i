"use server";

import { signIn, signOut } from "@/auth";

// Hai server action là lối vào xác thực DUY NHẤT của tầng UI. Không component
// nào được import `signIn`/`signOut` trực tiếp: gom lại một chỗ thì đích
// redirect nằm đúng một bản, và sau này đổi luồng đăng nhập chỉ phải sửa ở đây.
//
// Cả hai cố ý là server action gọi từ một <form> thuần, chứ không phải onClick
// trên client component. Lý do nằm ở môi trường dùng thật: form POST tới server
// action chạy được TRƯỚC khi JavaScript hydrate xong, mà app này được dùng chủ
// yếu trên điện thoại với 4G chập chờn ở quán ăn — nút đăng nhập bấm được ngay
// khi HTML về tới, không phải đợi bundle tải xong. Nó cũng giữ cho các trang
// không phải mang state session phía client, nhờ đó app shell vẫn prerender tĩnh.

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutAction() {
  // CỐ TÌNH KHÔNG gọi `auth()` ở đây.
  //
  // Bản trước có `await auth();` rồi vứt kết quả đi, với lý do "dựng khuôn mẫu"
  // cho các action tiền của Phase 2. Nhưng khuôn mẫu nó dựng lại là khuôn SAI:
  // một lời gọi auth() không rẽ nhánh KHÔNG xác thực gì cả, trong khi trông
  // hệt như có. Copy hình dạng đó sang một action chuyển tiền sẽ cho ra một
  // đường ghi không cần đăng nhập mà vẫn đọc như đã được bảo vệ. Một auth() bị
  // vứt đi dạy sai hiệu quả hơn là không gọi gì.
  //
  // Với riêng action này thì không cần thật: đăng xuất khi chưa đăng nhập vốn
  // vô hại, và người bị từ chối ở cổng allowlist chưa từng có session nào —
  // ở màn /chua-duoc-moi `auth()` trả null nhưng đích đến vẫn y hệt. Tác dụng
  // thật là xóa cookie phía trình duyệt rồi đưa họ về chọn lại tài khoản.
  //
  // Khuôn mẫu cho Phase 2 là `requireUser()` trong src/lib/require-user.ts —
  // nơi nó có tác dụng thật sự. Nó KHÔNG đặt trong file này vì file này mang
  // "use server": mọi export ở đây đều thành một endpoint gọi được từ client,
  // mà requireUser trả về đối tượng user — không nên phơi ra như vậy.
  //
  // Với `strategy: "database"`, signOut() xóa luôn dòng Session qua adapter
  // (deleteSession), khóa theo session token đọc từ cookie của request — nên
  // đăng xuất vô hiệu hóa ở cả phía server, không chỉ xóa cookie.
  await signOut({ redirectTo: "/dang-nhap" });
}
