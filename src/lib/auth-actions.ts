"use server";

import { auth, signIn, signOut } from "@/auth";

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
  // Kiểm tra lại `auth()` ngay trong action. Với riêng action này thì gần như
  // vô nghĩa — đăng xuất khi chưa đăng nhập vốn vô hại. Nó ở đây để dựng khuôn
  // mẫu: route guard trong src/proxy.ts KHÔNG bảo vệ server action, nên mỗi
  // action phải tự xác thực. Các action của Phase 2 sẽ động tới tiền, và lúc đó
  // khuôn mẫu này phải sẵn sàng chứ không phải mới đi phát hiện ra.
  await auth();

  // Không rẽ nhánh theo kết quả, và đó là chủ ý: người bị từ chối ở cổng
  // allowlist chưa từng có session nào được tạo, nên ở màn hình /chua-duoc-moi
  // `auth()` trả về null — nhưng đích đến vẫn y hệt. Đăng xuất khi chưa có
  // session là no-op phía server; tác dụng thật là xóa cookie phía trình duyệt
  // rồi đưa họ về chọn lại tài khoản, đúng việc họ muốn làm.
  await signOut({ redirectTo: "/dang-nhap" });
}
