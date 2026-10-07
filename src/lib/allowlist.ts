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
 * Hình dạng tối thiểu của một địa chỉ email, dùng chung cho mọi nơi trong app.
 *
 * Cố tình KHÔNG phải RFC 5322: đây là allowlist do người vận hành tự gõ cho một
 * nhóm dưới 10 người, nên việc cần làm là bắt lỗi gõ nhầm, không phải chấp nhận
 * mọi địa chỉ hợp lệ về lý thuyết.
 *
 * Vì sao `,` và `;` bị cấm bên trong local-part lẫn domain, dù RFC cho phép
 * trong dạng quoted: `,` là dấu phân tách của chính biến ALLOWLIST_EMAILS, và
 * `;` là thứ người ta gõ nhầm thay cho nó. Cấm cả hai biến một lỗi phân tách
 * thành lỗi ẦM Ĩ, thay vì để cả danh sách sập thành một mục rác đi qua lọt
 * (xem CR-02 — đó chính là đường dẫn tới việc xóa sạch allowlist).
 */
const EMAIL_SHAPE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/**
 * Một chuỗi có mang hình dạng email tối thiểu hay không.
 *
 * Xuất ra ngoài để tầng UI dùng CHUNG một định nghĩa với allowlist. Trước đây
 * /chua-duoc-moi tự giữ một regex riêng, nên tồn tại những địa chỉ vừa được
 * allowlist chấp nhận vừa bị trang đó từ chối — đúng kiểu trôi lệch mà
 * normalizeEmail sinh ra để ngăn.
 */
export function isPlausibleEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value);
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
/**
 * Chọn ra id của những user KHÔNG còn trong allowlist — tức là những người phải
 * bị thu hồi session.
 *
 * Hàm thuần, tách khỏi prisma/seed.ts để kiểm chứng được mà không cần database
 * thật. Đây là phép nối hai chặng Allowlist → User → Session: Allowlist khóa
 * theo email, Session khóa theo userId, nên bắt buộc phải đi qua User.
 *
 * Phép so khớp đi qua ĐÚNG hàm normalizeEmail mà phía allowlist dùng. Trước đây
 * seed tự gọi `.toLowerCase()` — thiếu `.trim()` so với normalizeEmail — nên
 * một User.email mang khoảng trắng hai đầu (nó đến thẳng từ nhà cung cấp OAuth
 * và cố ý không được ta chuẩn hóa) không khớp chính dòng allowlist của mình, và
 * một thành viên hợp lệ bị xóa sạch session trong im lặng.
 */
export function selectRemovedUserIds(
  users: readonly { id: string; email: string | null }[],
  allowedEmails: readonly string[],
): string[] {
  const allowed = new Set(allowedEmails);
  return users
    .filter((user) => !allowed.has(normalizeEmail(user.email ?? "")))
    .map((user) => user.id);
}

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

  // Đi qua đúng hàm mà callback `signIn` dùng để tra cứu. Gọi chung một hàm
  // thay vì lặp lại `.trim().toLowerCase()` là điều khiến hai đầu không thể
  // trôi lệch nhau về sau.
  const email = normalizeEmail(rawEmail);

  // CR-02. Phép kiểm tra này phải nằm ở ĐÂY, trên từng mục, chứ không phải ở
  // chỗ đếm số mục bên trên — và lý do là một lỗi đã thực sự tồn tại:
  //
  // `parseAllowlist` chỉ throw khi phân tích ra KHÔNG mục nào. Nó chưa bao giờ
  // kiểm tra hình dạng của thứ nó trả về. Đầu vào ":x" cho ra [{email: ""}] —
  // ĐÚNG MỘT mục, nên phép đếm đi qua lọt. Seed sau đó chạy
  // `deleteMany({ where: { email: { notIn: [""] } } })`: mọi dòng allowlist
  // THẬT bị xóa, mọi session bị thu hồi, rồi script in báo cáo gọn gàng và
  // thoát 0. Không ai đăng nhập lại được, vì callback `signIn` tra một bảng
  // đã không còn họ.
  //
  // Dấu `;` hay dấu cách thay cho dấu phẩy gây đúng hậu quả đó: cả danh sách
  // sập thành MỘT mục rác, vẫn qua được phép đếm. Đây là lỗi gõ nhầm một lần
  // trong ô biến môi trường trên dashboard Vercel.
  //
  // Hàm này thuần và không chạm database, nhưng nó là thứ duy nhất đứng giữa
  // một lần gõ nhầm và một lệnh deleteMany xóa sạch. Việc sửa thuộc về khâu
  // kiểm tra đầu vào, không phải khâu xóa — seed vẫn PHẢI xóa thành viên đã bị
  // gỡ, nếu không biến môi trường và database sẽ trôi thành hai nguồn sự thật.
  if (!isPlausibleEmail(email)) {
    throw new Error(
      `ALLOWLIST_EMAILS chứa mục không phải địa chỉ email: ${JSON.stringify(segment)}. ` +
        "Định dạng: email[:nhãn], phân tách bằng DẤU PHẨY.",
    );
  }

  return {
    email,
    label: label.length > 0 ? label : null,
  };
}
