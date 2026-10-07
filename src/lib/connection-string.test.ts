import { describe, expect, it } from "vitest";
import { isPooledConnectionString } from "./connection-string";

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
