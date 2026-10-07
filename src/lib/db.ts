import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import { isPooledConnectionString } from "./connection-string";

// Điểm vào database DUY NHẤT của dự án. Mọi phase sau import `prisma` từ đây;
// không module nào khác được tự dựng PrismaClient.

const connectionString = process.env.DATABASE_URL;
// Guard thật, không dùng non-null assertion: `!` vừa vi phạm luật
// noNonNullAssertion của Biome, vừa biến một biến môi trường thiếu thành lỗi
// khó hiểu ở tầng driver thay vì một lỗi khởi động rõ ràng.
if (!connectionString) {
  throw new Error(
    "DATABASE_URL chưa được đặt. App cần chuỗi kết nối POOLED của Neon lúc chạy.",
  );
}

// INFRA-06. Dựng adapter trên chuỗi direct vẫn compile, typecheck, lint sạch và
// chạy hoàn hảo trong mọi test mà dự án này có thể chạy — dưới 10 user thì không
// bao giờ đủ concurrency để cạn connection limit. Nó chỉ lộ ra trên production,
// dưới tải, dưới dạng lỗi kết nối chập chờn. Đó đúng là hình thái fail-open của
// một route guard đặt sai chỗ, nên xử lý y hệt: làm cho nó phát hiện được bằng máy.
//
// Throw ngay lúc nạp module là cố ý, và cái giá đã được tính:
//   - Mọi bản build import module này đều cần DATABASE_URL có host trông giống
//     pooled, kể cả khi không có database nào chạm tới được. Placeholder dạng
//     pooled trong gate build của plan 05 tồn tại chính vì lý do này; đổi một
//     trong hai giá trị mà không đổi giá trị kia sẽ làm hỏng phase.
//   - Đổi lại, một deployment cấu hình sai sẽ đỏ ngay lúc BUILD thay vì xanh rồi
//     hỏng ở request đầu tiên. Vercel expose DATABASE_URL lúc build nên giá trị
//     thật được kiểm tra ở đó. Thu hẹp check này về runtime sẽ giữ gate local
//     xanh nhưng để một chuỗi cắm nhầm deploy trót lọt — đúng kiểu hỏng âm thầm
//     mà phép kiểm tra này sinh ra để chặn.
if (!isPooledConnectionString(connectionString)) {
  throw new Error(
    "DATABASE_URL không trỏ tới endpoint POOLED của Neon (hostname phải có hậu tố '-pooler' ở nhãn đầu). " +
      "Chuỗi direct sẽ làm cạn connection limit khi serverless function scale ngang. " +
      "Chuỗi direct chỉ dùng cho DATABASE_URL_UNPOOLED, phục vụ lệnh CLI của Prisma.",
  );
}

const makeClient = () =>
  new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

// Singleton cho dev: thiếu guard này, `next dev` rò một Neon client mỗi lần
// hot reload cho tới khi dev server hết connection.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makeClient>;
};

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
