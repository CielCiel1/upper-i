import { describe, expect, it, vi } from "vitest";
import { decideSignIn } from "./sign-in-gate";

/* ME-05. Cổng allowlist là lớp kiểm soát truy cập DUY NHẤT của app, và trước
 * đây nó không có lấy một test nào — không phải vì nó đơn giản, mà vì chạm tới
 * nó đòi nạp src/auth.ts → NextAuth → Prisma → src/lib/db.ts (module throw lúc
 * nạp). Biên của vùng có test và biên của vùng hỏng là cùng một đường, và cả
 * hai lỗi CRITICAL đều rơi đúng vào phía không có test.
 *
 * Giờ phép tra cứu là THAM SỐ, nên mọi nhánh từ chối kiểm chứng được bằng một
 * stub, không cần database.
 */

const invited = (allowed: string[]) =>
  vi.fn(async (email: string) => allowed.includes(email));

const google = { provider: "google" };
const verified = { email: "an@example.com", email_verified: true };

describe("decideSignIn — cho qua", () => {
  it("chấp nhận email đã xác minh có trong allowlist", async () => {
    const lookup = invited(["an@example.com"]);
    expect(
      await decideSignIn({ profile: verified, account: google }, lookup),
    ).toBe(true);
  });

  /* Tra cứu phải đi qua normalizeEmail, nếu không một địa chỉ viết hoa sẽ
   * trượt chính dòng allowlist của mình và thành viên thật bị khóa ra ngoài. */
  it("chuẩn hóa email trước khi tra cứu", async () => {
    const lookup = invited(["an@example.com"]);
    const decision = await decideSignIn(
      {
        profile: { email: "  An@Example.COM  ", email_verified: true },
        account: google,
      },
      lookup,
    );
    expect(decision).toBe(true);
    expect(lookup).toHaveBeenCalledWith("an@example.com");
  });
});

describe("decideSignIn — từ chối", () => {
  /* Nhánh từ chối trung tâm: không có trong allowlist thì KHÔNG được trả true. */
  it("không trả true cho email ngoài allowlist", async () => {
    const decision = await decideSignIn(
      { profile: verified, account: google },
      invited([]),
    );
    expect(decision).not.toBe(true);
  });

  it("chuyển người ngoài allowlist tới trang giải thích", async () => {
    const decision = await decideSignIn(
      { profile: verified, account: google },
      invited([]),
    );
    expect(decision).toBe(
      "/chua-duoc-moi?error=AccessDenied&email=an%40example.com",
    );
  });

  /* AN TOÀN LOẠI MỘT. Một địa chỉ chưa được Google xác minh có thể do kẻ tấn
   * công tự khai; khớp nó với một địa chỉ đã được mời chính là đường chiếm
   * quyền thẳng vào nhóm. Phải từ chối NGAY CẢ KHI địa chỉ đó có trong
   * allowlist — đó là toàn bộ ý nghĩa của phép kiểm tra. */
  it.each([
    ["email_verified là false", false],
    ["email_verified là undefined", undefined],
    ["email_verified là chuỗi rỗng", ""],
    ["email_verified là 0", 0],
  ])("từ chối khi %s, dù email CÓ trong allowlist", async (_label, flag) => {
    const decision = await decideSignIn(
      {
        profile: { email: "an@example.com", email_verified: flag },
        account: google,
      },
      invited(["an@example.com"]),
    );
    expect(decision).toBe(false);
  });

  /* Thứ tự là load-bearing: phép kiểm tra xác minh phải chạy TRƯỚC lần tra
   * allowlist. Nếu đảo lại, một địa chỉ tự khai vẫn chạm được vào bảng. */
  it("không tra allowlist khi email chưa được xác minh", async () => {
    const lookup = invited(["an@example.com"]);
    await decideSignIn(
      {
        profile: { email: "an@example.com", email_verified: false },
        account: google,
      },
      lookup,
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it.each([
    ["không có email", { email_verified: true }],
    ["email là null", { email: null, email_verified: true }],
    ["profile là null", null],
  ])("từ chối khi %s", async (_label, profile) => {
    expect(
      await decideSignIn({ profile, account: google }, invited(["a@b.co"])),
    ).toBe(false);
  });

  /* Chỉ Google. Một provider khác được gắn vào ở phase sau không được mặc
   * nhiên thừa hưởng quyền đi qua cổng này. */
  it.each([
    ["provider khác", { provider: "github" }],
    ["không có account", null],
  ])("từ chối %s", async (_label, account) => {
    expect(
      await decideSignIn(
        { profile: verified, account },
        invited(["an@example.com"]),
      ),
    ).toBe(false);
  });
});

describe("decideSignIn — mã hóa URL", () => {
  /* Email đi vào query string nên phải được encode: một dấu `&` hay `#` chưa
   * encode sẽ cắt cụt tham số và trang từ chối hiện sai địa chỉ. */
  it("encode ký tự đặc biệt trong email", async () => {
    const decision = await decideSignIn(
      {
        profile: { email: "a+b@example.com", email_verified: true },
        account: google,
      },
      invited([]),
    );
    expect(decision).toBe(
      "/chua-duoc-moi?error=AccessDenied&email=a%2Bb%40example.com",
    );
  });
});
