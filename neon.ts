import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Auth do Auth.js v5 + Google OAuth đảm nhiệm, bảng User/Account/Session nằm
  // trong schema Prisma của chính dự án. Bật Neon Auth sẽ dựng thêm một hệ
  // danh tính thứ hai — đúng kiểu hai-nguồn-sự-thật mà dự án này tồn tại để
  // tránh. Xem .planning/PROJECT.md.
  auth: false,

  branch: (branch) => {
    // production là default branch: giữ nguyên thiết lập project, không ghi đè.
    if (branch.isDefault) {
      return {};
    }
    // Branch mới (dev/preview) tự hết hạn sau 7 ngày. Neon free có hạn mức
    // storage, và branch quên xóa ăn dần vào đó. Hết hạn tự động rẻ hơn nhớ dọn.
    if (!branch.exists) {
      return { ttl: "7d" };
    }
    // Branch đang tồn tại: không đụng tới, tránh rút ngắn hạn của branch đang dùng.
    return {};
  },
});
