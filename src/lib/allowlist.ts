export type AllowlistEntry = {
  email: string;
  label: string | null;
};

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
    // Hạ chữ vô điều kiện: phép tra cứu lúc đăng nhập cũng hạ chữ, nên một địa
    // chỉ lưu ở dạng hoa sẽ không bao giờ khớp.
    email: rawEmail.trim().toLowerCase(),
    label: label.length > 0 ? label : null,
  };
}
