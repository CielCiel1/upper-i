import { describe, expect, it } from "vitest";
import { isPooledConnectionString, poolingProblem } from "./connection-string";

// Neon dựng chuỗi thật dài nên test ghép scheme ra hằng số cho dễ đọc.
const PG = "postgresql://";
const pooled = `${PG}user:pw@ep-cool-art-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`;
const direct = `${PG}user:pw@ep-cool-art-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`;

describe("isPooledConnectionString", () => {
  it("chấp nhận host pooled của Neon", () => {
    expect(isPooledConnectionString(pooled)).toBe(true);
  });

  // Chiều ngược lại mới là chiều quan trọng: cắm nhầm chuỗi direct vào app vẫn
  // compile, typecheck, lint và chạy đúng với 10 user — rồi hỏng dưới tải thật.
  it("từ chối host direct (không pooler)", () => {
    expect(isPooledConnectionString(direct)).toBe(false);
  });

  // Đây là lý do predicate phải phân tích hostname chứ không tìm chuỗi con:
  // mật khẩu chứa "-pooler" sẽ khiến một phép includes() cho qua chuỗi direct.
  it("không bị đánh lừa bởi '-pooler' nằm trong mật khẩu", () => {
    const trap = `${PG}user:my-pooler-password@ep-cool-art-123456.aws.neon.tech/neondb`;
    expect(isPooledConnectionString(trap)).toBe(false);
  });

  it("không bị đánh lừa bởi '-pooler' nằm trong query string", () => {
    const trap = `${PG}user:pw@ep-cool-art-123456.aws.neon.tech/neondb?options=-pooler`;
    expect(isPooledConnectionString(trap)).toBe(false);
  });

  it("không bị đánh lừa bởi '-pooler' nằm trong tên database", () => {
    const trap = `${PG}user:pw@ep-cool-art-123456.aws.neon.tech/db-pooler`;
    expect(isPooledConnectionString(trap)).toBe(false);
  });

  // Chỉ nhãn ĐẦU TIÊN của hostname mang hậu tố -pooler. Một nhãn khác trùng tên
  // không biến endpoint thành pooled.
  it("chỉ xét nhãn đầu tiên của hostname", () => {
    const trap = `${PG}user:pw@ep-cool-art-123456.-pooler.aws.neon.tech/neondb`;
    expect(isPooledConnectionString(trap)).toBe(false);
  });

  it("so khớp không phân biệt hoa thường", () => {
    const upper = `${PG}user:pw@EP-COOL-ART-123456-POOLER.AWS.NEON.TECH/neondb`;
    expect(isPooledConnectionString(upper)).toBe(true);
  });

  it("chấp nhận scheme postgres:// bên cạnh postgresql://", () => {
    const alt = `postgres://user:pw@ep-cool-art-123456-pooler.aws.neon.tech/neondb`;
    expect(isPooledConnectionString(alt)).toBe(true);
  });

  // Chuỗi hỏng phải bị từ chối, không được mặc nhiên coi là hợp lệ.
  it.each([
    ["chuỗi không phải URL", "not-a-connection-string"],
    ["chuỗi rỗng", ""],
    ["thiếu host", `${PG}user:pw@/neondb`],
  ])("từ chối %s", (_label, raw) => {
    expect(isPooledConnectionString(raw)).toBe(false);
  });
});

/* HI-03. `isPooledConnectionString` trả `false` cho BA nguyên nhân khác hẳn
 * nhau, còn thông báo lỗi ở src/lib/db.ts chỉ khẳng định được một ("không
 * pooled"). Hậu quả không phải lý thuyết: một giá trị còn nguyên dấu nháy —
 * chuỗi THẬT SỰ chứa '-pooler' — bị báo là không pooled, nên người đọc đi tìm
 * sai chỗ. Ở checkpoint 01-06, người vận hành vừa dán một chuỗi Neon thật vào
 * dashboard Vercel và sẽ đọc thông báo đó như một lỗi của phép kiểm tra. */
describe("poolingProblem (HI-03)", () => {
  it("trả null cho chuỗi pooled hợp lệ", () => {
    expect(poolingProblem(pooled)).toBeNull();
  });

  /* Trường hợp đã thực sự xảy ra khi chạy gate build. Thông báo PHẢI nhắc tới
   * dấu nháy, vì đó là thứ cần sửa — không phải hậu tố -pooler. */
  it("nêu đúng nguyên nhân dấu nháy, không đổ cho '-pooler'", () => {
    const quoted = `"${pooled}"`;
    const problem = poolingProblem(quoted) ?? "";
    expect(problem).toMatch(/dấu nháy/);
    expect(problem).not.toMatch(/DIRECT/);
  });

  /* Echo lại đoạn đầu giá trị là thứ khiến trường hợp dấu nháy tự chẩn đoán
   * được: người vận hành NHÌN THẤY ký tự `"` nằm ở đầu. */
  it("echo lại đoạn đầu của giá trị sai", () => {
    expect(poolingProblem(`"${pooled}"`) ?? "").toContain('\\"');
  });

  /* Không rò mật khẩu: chỉ 24 ký tự đầu, dừng trước phần sau `://user:`. */
  it("không echo quá 24 ký tự đầu nên không lộ mật khẩu", () => {
    const secret = "sieu-bi-mat-khong-duoc-lo";
    const problem = poolingProblem(`"${PG}user:${secret}@h-pooler.x/db"`) ?? "";
    expect(problem).not.toContain(secret);
  });

  it("gọi tên host và nhãn đầu khi đúng là endpoint direct", () => {
    const problem = poolingProblem(direct) ?? "";
    expect(problem).toMatch(/DIRECT/);
    expect(problem).toContain("ep-cool-art-123456");
  });

  /* Ba nguyên nhân phải cho ba thông báo KHÁC nhau — đó là toàn bộ nội dung
   * của HI-03. Gộp chúng lại là tái tạo đúng lỗi vừa sửa. */
  it("ba nguyên nhân cho ba thông báo khác nhau", () => {
    const messages = [
      poolingProblem(direct),
      poolingProblem(`"${pooled}"`),
      poolingProblem("garbage"),
    ];
    expect(messages.every((m) => m !== null)).toBe(true);
    expect(new Set(messages).size).toBeGreaterThan(1);
  });

  /* isPooledConnectionString phải vẫn là đúng predicate đó, chỉ diễn đạt lại
   * qua poolingProblem — không được trôi thành hai luật khác nhau. */
  it.each([
    pooled,
    direct,
    "garbage",
    "",
  ])("đồng nhất với isPooledConnectionString cho %s", (raw) => {
    expect(poolingProblem(raw) === null).toBe(isPooledConnectionString(raw));
  });
});
