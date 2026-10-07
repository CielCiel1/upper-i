import { describe, expect, it } from "vitest";
import { isPlausibleEmail, normalizeEmail, parseAllowlist } from "./allowlist";

describe("parseAllowlist", () => {
  it("tách danh sách phân cách bằng dấu phẩy thành từng mục", () => {
    expect(parseAllowlist("an@example.com,binh@example.com")).toEqual([
      { email: "an@example.com", label: null },
      { email: "binh@example.com", label: null },
    ]);
  });

  // Khẳng định giá trị cao nhất trong file này. Một địa chỉ seed vào database ở
  // dạng hoa sẽ không bao giờ khớp phép tra cứu đã hạ chữ lúc đăng nhập, khóa
  // một thành viên thật ra ngoài trong im lặng.
  it("hạ chữ thường mọi email", () => {
    expect(parseAllowlist("An.Nguyen@Example.COM")).toEqual([
      { email: "an.nguyen@example.com", label: null },
    ]);
  });

  it("tách hậu tố ':nhãn' thành label", () => {
    expect(parseAllowlist("an@example.com:An")).toEqual([
      { email: "an@example.com", label: "An" },
    ]);
  });

  it("trả label null khi không có hậu tố", () => {
    expect(parseAllowlist("an@example.com")[0]?.label).toBeNull();
  });

  it("giữ nguyên hoa thường của label", () => {
    expect(parseAllowlist("an@example.com:Bình Minh")).toEqual([
      { email: "an@example.com", label: "Bình Minh" },
    ]);
  });

  it("cắt khoảng trắng quanh cả mục lẫn nhãn", () => {
    expect(
      parseAllowlist("  an@example.com  :  An  ,  binh@example.com "),
    ).toEqual([
      { email: "an@example.com", label: "An" },
      { email: "binh@example.com", label: null },
    ]);
  });

  it("bỏ qua mục rỗng do dấu phẩy thừa hoặc lặp", () => {
    expect(parseAllowlist("an@example.com,,binh@example.com,")).toEqual([
      { email: "an@example.com", label: null },
      { email: "binh@example.com", label: null },
    ]);
  });

  it("coi nhãn rỗng như không có nhãn", () => {
    expect(parseAllowlist("an@example.com:")[0]?.label).toBeNull();
  });

  // Seed một allowlist rỗng sẽ khóa toàn bộ thành viên ra khỏi app, nên phải
  // hỏng ầm ĩ chứ không ghi vào im lặng.
  it("throw khi giá trị thô là undefined", () => {
    expect(() => parseAllowlist(undefined)).toThrow(/ALLOWLIST_EMAILS/);
  });

  it.each([
    ["chuỗi rỗng", ""],
    ["toàn khoảng trắng", "   "],
    ["chỉ có dấu phẩy", ",,,"],
  ])("throw khi %s phân tích ra không mục nào", (_label, raw) => {
    expect(() => parseAllowlist(raw)).toThrow(/ALLOWLIST_EMAILS/);
  });

  /* HỒI QUY CHO CR-02 — xóa sạch allowlist từ một lần gõ nhầm.
   *
   * Phép bảo vệ cũ chỉ đếm số mục: throw khi phân tích ra KHÔNG mục nào, không
   * bao giờ xét hình dạng của thứ trả về. Mọi đầu vào dưới đây cho ra ĐÚNG MỘT
   * mục nên đi qua lọt phép đếm, rồi seed chạy
   * `deleteMany({ where: { email: { notIn: [<mục rác>] } } })` — xóa mọi dòng
   * allowlist thật, thu hồi mọi session, in báo cáo gọn gàng và thoát 0.
   *
   * Vì sao 27 test cũ xanh: chúng chỉ đưa vào đầu vào ĐÚNG ĐỊNH DẠNG. Không
   * test nào hỏi "chuyện gì xảy ra với đầu vào sai" — mà đó mới là trạng thái
   * thật của một ô biến môi trường gõ tay trên dashboard.
   *
   * Case ":x" là sắc nhất: nó cho email rỗng, và notIn [""] khớp mọi dòng. */
  it.each([
    [':x" — nhãn không kèm email, cho email rỗng', ":x"],
    ["chỉ có nhãn", ":label-only"],
    ["phân tách bằng dấu chấm phẩy", "an@example.com;binh@example.com"],
    ["phân tách bằng dấu cách", "an@example.com binh@example.com"],
    ["không phải email", "garbage"],
    ["thiếu local-part", "@example.com"],
    ["thiếu domain", "an@"],
    ["domain không có dấu chấm", "an@example"],
  ])("throw khi %s", (_label, raw) => {
    expect(() => parseAllowlist(raw)).toThrow(/không phải địa chỉ email/);
  });

  /* Khẳng định nói thẳng ra hậu quả, chứ không chỉ nói "throw". Một mục email
   * rỗng lọt qua là điều kiện đủ để xóa sạch bảng — nên bất biến cần khóa là
   * KHÔNG BAO GIỜ có email rỗng trong kết quả, bất kể đầu vào. */
  it("không bao giờ trả về mục có email rỗng", () => {
    for (const raw of [":x", ":label-only", "a@b.co,:x", ":x,a@b.co"]) {
      let entries: ReturnType<typeof parseAllowlist> = [];
      try {
        entries = parseAllowlist(raw);
      } catch {
        continue; // Từ chối ầm ĩ là kết quả mong muốn.
      }
      expect(entries.every((entry) => entry.email.length > 0)).toBe(true);
    }
  });

  /* Một mục hỏng phải làm hỏng CẢ LẦN CHẠY, không bị bỏ qua trong im lặng.
   * Lọc bỏ mục hỏng còn tệ hơn: danh sách vẫn ngắn đi một người, và seed vẫn
   * xóa đúng người đó cùng session của họ — vẫn im lặng, chỉ nhỏ hơn. */
  it("từ chối cả danh sách khi chỉ một mục hỏng", () => {
    expect(() =>
      parseAllowlist("an@example.com,garbage,binh@example.com"),
    ).toThrow(/không phải địa chỉ email/);
  });

  /* Thông báo lỗi phải gọi tên ĐÚNG mục gây lỗi. Người vận hành đang nhìn một
   * ô biến môi trường một dòng; "có gì đó sai" không đủ để sửa. */
  it("nêu đích danh mục gây lỗi trong thông báo", () => {
    expect(() => parseAllowlist("an@example.com,garbage")).toThrow(/garbage/);
  });
});

describe("normalizeEmail", () => {
  it("hạ chữ thường", () => {
    expect(normalizeEmail("An.Nguyen@Example.COM")).toBe(
      "an.nguyen@example.com",
    );
  });

  it("cắt khoảng trắng hai đầu", () => {
    expect(normalizeEmail("  an@example.com  ")).toBe("an@example.com");
  });

  it("đã chuẩn rồi thì giữ nguyên", () => {
    expect(normalizeEmail("an@example.com")).toBe("an@example.com");
  });

  // Khẳng định quan trọng nhất của cả file: đây đúng là bất biến mà allowlist
  // dựa vào. Email seed vào database và email người dùng gõ ở màn hình Google
  // phải quy về cùng một chuỗi, nếu không phép tra cứu theo khóa chính trượt.
  it("quy một địa chỉ hoa-thường lẫn lộn về đúng giá trị mà seed lưu", () => {
    const seeded = parseAllowlist("An.Nguyen@Example.COM")[0]?.email;
    expect(normalizeEmail("  AN.NGUYEN@example.com ")).toBe(seeded);
  });
});

describe("isPlausibleEmail", () => {
  it.each([
    "an@example.com",
    "an.nguyen+tag@mail.example.co.uk",
  ])("chấp nhận %s", (value) => {
    expect(isPlausibleEmail(value)).toBe(true);
  });

  it.each([
    "garbage",
    "",
    "@example.com",
    "an@",
    "an@example",
    "a b@c.co",
  ])("từ chối %s", (value) => {
    expect(isPlausibleEmail(value)).toBe(false);
  });

  /* Hai dấu này bị cấm vì chúng là dấu phân tách của ALLOWLIST_EMAILS (và là
   * thứ người ta gõ nhầm thay cho nó). Cho chúng lọt là tái tạo lại CR-02. */
  it.each([
    ["dấu phẩy", "a,b@c.co"],
    ["dấu chấm phẩy", "a;b@c.co"],
  ])("từ chối %s bên trong địa chỉ", (_label, value) => {
    expect(isPlausibleEmail(value)).toBe(false);
  });

  /* Bất biến nối hai đầu: thứ gì parseAllowlist chấp nhận thì trang
   * /chua-duoc-moi cũng phải nhận ra là email, và ngược lại. Trước đây trang đó
   * giữ regex riêng nên hai đầu bất đồng — cùng kiểu trôi lệch mà
   * normalizeEmail sinh ra để ngăn. */
  it("đồng ý với parseAllowlist về cái gì là email", () => {
    const parsed = parseAllowlist("an@example.com:An")[0]?.email ?? "";
    expect(isPlausibleEmail(parsed)).toBe(true);
  });
});
