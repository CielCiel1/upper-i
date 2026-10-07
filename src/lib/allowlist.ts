export type AllowlistEntry = {
  email: string;
  label: string | null;
};

/**
 * Chuẩn hóa một email về dạng dùng để so khớp: cắt khoảng trắng, hạ chữ thường.
 *
 * Đây là một bản logic DUY NHẤT dùng chung cho cả hai đầu của allowlist: seed
 * ghi vào `Allowlist.email` qua parseAllowlist(), và callback `signIn` tra cứu
 * qua hàm này. Hai đầu mà chuẩn hóa lệch nhau thì một thành viên thật đăng nhập
 * bằng `An.Nguyen@Example.COM` sẽ không khớp dòng đã seed `an.nguyen@example.com`
 * — bị khóa ra ngoài trong im lặng, không có lỗi nào để lần theo.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Phân tích biến môi trường ALLOWLIST_EMAILS thành các mục đã chuẩn hóa.
 *
 * Định dạng: `email[:nhãn]`, phân tách bằng dấu phẩy.
 * Ví dụ: `an@example.com:An,binh@example.com`
 *
 * Hàm thuần, nằm trong src/lib/ chứ không nằm trong prisma/seed.ts, để vừa test
 * trực tiếp được vừa cho seed import lại đúng một bản logic.
 *
 * @throws khi giá trị thô vắng mặt hoặc phân tích ra không mục nào — seed một
 * allowlist rỗng sẽ khóa mọi thành viên ra khỏi app, nên nó phải hỏng ầm ĩ.
 */
export function parseAllowlist(raw: string | undefined): AllowlistEntry[] {
  if (raw === undefined) {
    throw new Error(
      "ALLOWLIST_EMAILS chưa được đặt. Seed cần danh sách email dạng email[:nhãn], phân tách bằng dấu phẩy.",
    );
  }

  const entries = raw
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map(parseEntry);

  if (entries.length === 0) {
    throw new Error(
      "ALLOWLIST_EMAILS phân tích ra không mục nào. Seed một allowlist rỗng sẽ khóa mọi thành viên ra khỏi app.",
    );
  }

  return entries;
}

function parseEntry(segment: string): AllowlistEntry {
  const separator = segment.indexOf(":");
  const rawEmail = separator === -1 ? segment : segment.slice(0, separator);
  const rawLabel = separator === -1 ? "" : segment.slice(separator + 1);

  const label = rawLabel.trim();

  return {
    // Đi qua đúng hàm mà callback `signIn` dùng để tra cứu. Gọi chung một hàm
    // thay vì lặp lại `.trim().toLowerCase()` là điều khiến hai đầu không thể
    // trôi lệch nhau về sau.
    email: normalizeEmail(rawEmail),
    label: label.length > 0 ? label : null,
  };
}
