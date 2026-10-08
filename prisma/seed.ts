/**
 * Đồng bộ allowlist — CÓ THẨM QUYỀN, không phải chỉ thêm.
 *
 * Script này làm cho biến môi trường ALLOWLIST_EMAILS trở thành nguồn sự thật
 * DUY NHẤT về việc ai là thành viên: email có trong biến thì được upsert, email
 * vắng mặt thì bị xóa và session của người đó bị thu hồi.
 *
 * Lý do đáng giữ lại: nếu seed chỉ biết thêm, thì biến môi trường và bảng
 * database sẽ trôi dần thành hai câu trả lời khác nhau cho câu hỏi "ai là thành
 * viên" — đúng kiểu hỏng đã giết chết hệ thống tiền nhiệm của dự án này. Gỡ một
 * thành viên phải là một lần sửa file cộng một lần chạy lệnh.
 *
 * Chạy bằng: pnpm seed
 */
// Xem ghi chú trong prisma.config.ts: giá trị thật ở .env.local, .env là dự
// phòng. dotenv không ghi đè biến đã có nên thứ tự này cho .env.local thắng
// .env, và biến thật từ môi trường thắng cả hai.
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseAllowlist, selectRemovedUserIds } from "../src/lib/allowlist";

// Seed chạy DDL-adjacent và là tiến trình tsx độc lập ngoài runtime của Next,
// nên nó tự dựng client thay vì dùng singleton của app. Ưu tiên chuỗi direct:
// nó không bị giới hạn bởi pooler.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Cần DATABASE_URL_UNPOOLED (hoặc DATABASE_URL) để chạy seed.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
  const entries = parseAllowlist(process.env.ALLOWLIST_EMAILS);
  const emails = entries.map((entry) => entry.email);

  // 1. Upsert mọi mục đang có trong biến môi trường.
  //    `invitedAt` cố tình vắng mặt ở nhánh update để giữ nguyên mốc thời gian
  //    mời ban đầu qua mỗi lần chạy lại.
  for (const entry of entries) {
    await prisma.allowlist.upsert({
      where: { email: entry.email },
      update: { label: entry.label },
      create: { email: entry.email, label: entry.label },
    });
  }

  // 2 + 3 chạy trong CÙNG một transaction: không được tồn tại khoảnh khắc nào mà
  // dòng allowlist đã mất nhưng session vẫn còn sống.
  const { removedAllowlistRows, revokedSessions } = await prisma.$transaction(
    async (tx) => {
      // Thu hồi quyền của người vừa bị gỡ, bằng một phép JOIN TƯỜNG MINH hai
      // chặng, không phải bằng cascade.
      //
      // Cascade không làm được việc này: đường duy nhất đi từ Allowlist tới
      // Session phải xóa dòng User trên đường đi, mà User.id là đích khóa ngoại
      // vĩnh viễn của mọi dòng sổ cái Phase 2. Thu hồi quyền truy cập không bao
      // giờ được chạm vào lịch sử tài chính. Xóa session, giữ lại user.
      //
      // Bước này bắt buộc và không hiển nhiên: callback đăng nhập chỉ chạy lúc
      // login, không chạy ở các request sau, nên một thành viên bị gỡ vẫn giữ
      // session hợp lệ tới hết đời session. Xóa dòng allowlist KHÔNG đuổi ai cả.
      //
      // So sánh email không phân biệt hoa thường: User.email đến từ nhà cung cấp
      // OAuth và không được ta chuẩn hóa. Allowlist khóa theo email, Session khóa
      // theo userId — nên phải qua User để nối hai bảng.
      //
      // Phép so sánh hạ chữ làm ở tầng ứng dụng chứ không dùng `mode:
      // "insensitive"` của Prisma. Nhóm dưới 10 người nên tải hết user về là
      // không đáng kể, đổi lại ngữ nghĩa so khớp là tất định và kiểm chứng được
      // mà không cần database thật. Nếu `mode` lặng lẽ không áp dụng cho `notIn`,
      // thành viên bị gỡ có email lệch hoa thường sẽ giữ nguyên session — đúng
      // kiểu hỏng âm thầm mà bước này sinh ra để chặn.
      const users = await tx.user.findMany({
        where: { email: { not: null } },
        select: { id: true, email: true },
      });
      // Phép chọn nằm ở src/lib/allowlist.ts: hàm thuần, kiểm chứng được mà
      // không cần database thật — và nó là phép tính quyết định ai bị xóa
      // session, nên nó phải có test.
      //
      // Nó dùng CHUNG normalizeEmail với phía allowlist thay vì tự gọi
      // `.toLowerCase()`. Hai bên từng lệch nhau đúng một thao tác: allowlist
      // chuẩn hóa bằng `.trim().toLowerCase()`, còn chỗ này chỉ hạ chữ.
      // User.email đến thẳng từ nhà cung cấp OAuth và cố ý KHÔNG được ta chuẩn
      // hóa (xem ghi chú ngay trên), nên một địa chỉ mang khoảng trắng hai đầu
      // không khớp chính dòng allowlist của nó — thành viên hợp lệ bị xếp vào
      // nhóm "đã gỡ" và bị xóa sạch session. Họ đăng nhập lại được vì dòng
      // Allowlist vẫn còn, nhưng bị đăng xuất trong im lặng và con số
      // revokedSessions in ra trông vẫn hợp lý.
      const removedUserIds = selectRemovedUserIds(users, emails);

      const revoked = await tx.session.deleteMany({
        where: { userId: { in: removedUserIds } },
      });

      // Xóa mọi dòng Allowlist có email KHÔNG nằm trong biến môi trường.
      const removed = await tx.allowlist.deleteMany({
        where: { email: { notIn: emails } },
      });

      return {
        removedAllowlistRows: removed.count,
        revokedSessions: revoked.count,
      };
    },
  );

  // Báo cáo đủ ba con số để người chạy thấy đúng thứ đã đổi thay vì phải đoán.
  // Số session thu hồi tách riêng khỏi số dòng allowlist bị xóa: chúng trả lời
  // hai câu hỏi khác nhau, gộp lại sẽ giấu mất trường hợp dòng đã xóa mà session
  // thì chưa.
  console.log(`Allowlist đã upsert:     ${entries.length}`);
  console.log(`Dòng allowlist đã xóa:   ${removedAllowlistRows}`);
  console.log(`Session đã thu hồi:      ${revokedSessions}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
