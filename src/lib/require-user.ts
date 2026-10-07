import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Đòi một user đã đăng nhập, nếu không thì đá về màn đăng nhập.
 *
 * ĐÂY LÀ KHUÔN MẪU CHO MỌI SERVER ACTION CỦA PHASE 2.
 *
 * Vì sao cần: route guard trong src/proxy.ts KHÔNG phủ server action — chúng đi
 * theo đường POST riêng, không qua proxy. Mỗi action phải tự xác thực, và một
 * action động tới tiền mà quên bước này là một đường ghi công khai.
 *
 * Điểm mấu chốt là hàm này TRẢ VỀ user, nên chỗ gọi buộc phải dùng kết quả.
 * Không có cách nào gọi nó rồi vô tình bỏ qua phép kiểm tra — khác hẳn
 * `await auth();` trần (đúng thứ từng nằm trong signOutAction), vốn trông như
 * đang kiểm tra nhưng không chặn gì. Một auth() bị vứt đi dạy sai hiệu quả hơn
 * là không gọi gì cả.
 *
 * Dùng như sau trong một action của Phase 2:
 *
 *     export async function themChiTieu(form: FormData) {
 *       const user = await requireUser();
 *       // ... user.id là người ghi dòng sổ này
 *     }
 *
 * File này KHÔNG mang "use server": mọi export trong một module như vậy đều
 * thành endpoint gọi được từ client, mà hàm này trả về đối tượng user.
 */
export async function requireUser() {
  const session = await auth();

  // `redirect()` throw ở bên trong, nên không có đường nào chạy tiếp xuống dưới
  // khi chưa đăng nhập. Đó là lý do nó an toàn hơn việc trả về null và trông
  // cậy vào chỗ gọi nhớ kiểm tra.
  if (!session?.user) redirect("/dang-nhap");

  return session.user;
}
