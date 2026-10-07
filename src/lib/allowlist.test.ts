import { describe, expect, it } from "vitest";
import { parseAllowlist } from "./allowlist";

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
    expect(parseAllowlist("  an@example.com  :  An  ,  binh@example.com ")).toEqual([
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
});
