import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Datasource ở đây CỐ TÌNH là chuỗi kết nối KHÔNG qua pooler: thay đổi schema
// (DDL) không thể chạy xuyên qua một connection pooler. Chuỗi pooled chỉ dành
// cho app lúc chạy và được nối trong src/lib/db.ts.
//
// Lưu ý dễ chẩn đoán sai: `env()` THROW khi biến vắng mặt, không trả về
// undefined. Nghĩa là MỌI lệnh prisma CLI đều cần DATABASE_URL_UNPOOLED, kể cả
// `prisma generate` và `prisma migrate diff` — những lệnh không hề đụng tới
// database.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 đặt cấu hình seed ở đây. Khối `prisma.seed` trong package.json là
    // cơ chế của Prisma 6 và nay bị bỏ qua trong im lặng.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
