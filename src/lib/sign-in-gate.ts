import { normalizeEmail } from "./allowlist";

/**
 * CỔNG ALLOWLIST, tách thành hàm thuần.
 *
 * Đây là lớp kiểm soát truy cập DUY NHẤT quyết định có bao giờ tạo tài khoản
 * hay không. Nó nằm ở đây, nhận phép tra cứu làm THAM SỐ, để kiểm chứng được
 * mà không cần database: callback `signIn` trong src/auth.ts chỉ còn việc đưa
 * `prisma.allowlist.findUnique` vào.
 *
 * Vì sao phải tách: trước đây toàn bộ logic này nằm trong thân callback, nên
 * muốn test nó thì phải nạp src/auth.ts → NextAuth → Prisma → src/lib/db.ts
 * (module throw lúc nạp). Hệ quả là hai nhánh từ chối quan trọng nhất của app
 * — email không có trong allowlist, và email chưa được Google xác minh —
 * không có lấy một test nào.
 */

/** Kết quả của cổng: cho qua, từ chối thẳng, hoặc chuyển tới trang giải thích. */
export type SignInDecision = true | false | string;

type SignInInput = {
  profile?: { email?: string | null; email_verified?: unknown } | null;
  account?: { provider?: string } | null;
};

/**
 * Quyết định một lần đăng nhập có được chấp nhận hay không.
 *
 * @param lookup trả về true nếu email ĐÃ CHUẨN HÓA có trong bảng Allowlist.
 *
 * Trả về chuỗi là hành vi có kiểu rõ ràng của callback `signIn`
 * (`Awaitable<boolean | string>`): Auth.js đổi nó thành redirect và trả ngay
 * cho caller, vẫn ở đúng điểm thoát như `return false` — tức là vẫn chưa ghi
 * dòng nào.
 */
export async function decideSignIn(
  { profile, account }: SignInInput,
  lookup: (email: string) => Promise<boolean>,
): Promise<SignInDecision> {
  if (account?.provider !== "google") return false;

  // Email CHƯA được Google xác minh thì không bao giờ đem so với allowlist:
  // một địa chỉ chưa xác minh có thể do kẻ tấn công tự khai, nên khớp nó với
  // một địa chỉ đã được mời chính là đường chiếm quyền thẳng vào nhóm. Thứ tự
  // ở đây là load-bearing — phép kiểm tra này phải chạy TRƯỚC lần tra allowlist.
  if (!profile?.email || !profile.email_verified) return false;

  const email = normalizeEmail(profile.email);
  if (await lookup(email)) return true;

  // Màn hình từ chối cần GỌI TÊN địa chỉ vừa dùng: nguyên nhân thực tế áp đảo
  // là chạm nhầm một trong nhiều tài khoản Google đang đăng nhập sẵn trên điện
  // thoại. Người bị từ chối không có session và không có dòng nào trong
  // database, nên trang không tra ngược được — truyền qua URL là cách duy nhất.
  return `/chua-duoc-moi?error=AccessDenied&email=${encodeURIComponent(email)}`;
}
