import { describe, expect, it } from "vitest";
import { isAuthorizedRequest, PROTECTED_ROUTE_MATCHER } from "./route-guard";

/* HỒI QUY CHO CR-01 — route guard đã mắc dây nhưng không bao giờ TỪ CHỐI.
 *
 * Vì sao 27 test cũ xanh trong khi lỗ hổng vẫn mở: tất cả đều nhắm vào hai
 * module thuần (allowlist, connection-string). Không test nào hỏi câu hỏi mà
 * cả phase sinh ra để trả lời — "một request KHÔNG có session có bị chặn
 * không". Biên của vùng có test và biên của vùng hỏng là cùng một đường.
 *
 * Lý do nó không có test không phải vì ai đó lười, mà vì thứ cần kiểm tra bị
 * khóa sau một import nặng: src/proxy.ts kéo theo NextAuth → Prisma →
 * src/lib/db.ts, module throw lúc nạp. Sửa CR-01 kèm theo việc tách phần quyết
 * định và phần phạm vi ra src/lib/route-guard.ts, nên file này import BẢN THẬT
 * chứ không chép tay — không có bản sao nào để trôi lệch.
 *
 * Phép thử runtime đầy đủ (`next start` + curl không cookie) nằm ở gate của
 * phase; đây là bản chạy được trong CI mà không cần dựng server.
 */

describe("isAuthorizedRequest (CR-01)", () => {
  /* Khẳng định trung tâm. Đây chính xác là case đã trả 200 trước khi sửa. */
  it("TỪ CHỐI khi không có session", () => {
    expect(isAuthorizedRequest(null)).toBe(false);
  });

  it("TỪ CHỐI khi session là undefined", () => {
    expect(isAuthorizedRequest(undefined)).toBe(false);
  });

  it("TỪ CHỐI khi có session nhưng không có user", () => {
    expect(isAuthorizedRequest({})).toBe(false);
  });

  it("CHO QUA khi session có user", () => {
    expect(isAuthorizedRequest({ user: { id: "u1" } })).toBe(true);
  });

  /* Bắt đúng kiểu hỏng của CR-01: một predicate luôn-thật. `return true` trần
   * vẫn qua được test cho-qua ở trên, nên phải có ít nhất một case đòi `false`
   * và một case khẳng định hai đầu vào cho hai kết quả KHÁC nhau. */
  it("không phải hàm hằng — hai đầu vào cho hai kết quả khác nhau", () => {
    expect(isAuthorizedRequest(null)).not.toBe(
      isAuthorizedRequest({ user: { id: "u1" } }),
    );
  });
});

describe("PROTECTED_ROUTE_MATCHER (CR-01)", () => {
  /* Chống trôi lệch. Chuỗi matcher buộc phải tồn tại ở hai nơi: Turbopack chỉ
   * chấp nhận chuỗi tĩnh viết thẳng trong `config` của src/proxy.ts (import
   * hằng số vào đó làm `next build` đỏ với "Entry `matcher[0]` need to be
   * static strings"), còn test thì không nạp được src/proxy.ts vì nó kéo theo
   * NextAuth → Prisma → src/lib/db.ts. Test này đọc file nguồn và so từng ký
   * tự, nên sửa một bên mà quên bên kia sẽ đỏ ngay. */
  it("khớp từng ký tự với config.matcher trong src/proxy.ts", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../proxy.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain(`"${PROTECTED_ROUTE_MATCHER}"`);
  });

  /* Neo hai đầu. Next.js dịch matcher thành regex khớp TOÀN BỘ pathname; một
   * `new RegExp()` trần thì khớp ở bất kỳ vị trí nào và sẽ báo "/api/auth/..."
   * là được bảo vệ chỉ vì khúc "/auth/callback" ở giữa lọt qua lookahead.
   * Đã đối chiếu với hành vi thật: `next start` + curl cho /api/auth/providers
   * trả 200, đúng như bản neo này dự đoán. */
  const pattern = new RegExp(`^${PROTECTED_ROUTE_MATCHER}$`);

  /* MẶC ĐỊNH LÀ ĐƯỢC BẢO VỆ. src/proxy.ts tuyên bố route mới thêm ở phase sau
   * tự động được che — Phase 2 sẽ thêm route tiền trên đúng giả định này, nên
   * giả định đó phải có test chứ không chỉ là một dòng comment. */
  it.each([
    "/",
    "/chi-tieu",
    "/so-du",
    "/nhom/1/thanh-toan",
  ])("phủ route %s", (path) => {
    expect(pattern.test(path)).toBe(true);
  });

  /* Mặt còn lại: chặn nhầm những đường này thì guard tự khóa chính nó — không
   * ai đăng nhập xong được, và người bị từ chối không đọc được lời giải thích. */
  it.each([
    ["/api/auth/callback/google", "đường OAuth callback"],
    ["/dang-nhap", "màn đăng nhập"],
    ["/chua-duoc-moi", "trang từ chối"],
    ["/manifest.webmanifest", "manifest PWA"],
    ["/_next/static/chunk.js", "tài nguyên build"],
    ["/favicon.ico", "favicon"],
  ])("chừa %s (%s)", (path) => {
    expect(pattern.test(path)).toBe(false);
  });
});
