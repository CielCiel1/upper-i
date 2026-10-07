import { defineConfig } from "vitest/config";

// Phần mở rộng phải là .mts: package.json không có "type": "module", nên một
// file config .ts sẽ khiến Vite cảnh báo là đang nạp ESM dưới dạng CommonJS.
//
// Vite 8 phân giải path alias của tsconfig sẵn, nên KHÔNG cần vite-tsconfig-paths
// và cũng không cần @vitejs/plugin-react — cả hai đều thừa ở đây.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // Phase 1 và Phase 2 đều là logic thuần, không đụng DOM. Chỉ thêm jsdom khi
    // thực sự có component cần render.
    environment: "node",
    // prisma/ phải nằm trong danh sách: CR-02 và HI-01 đều là lỗi của logic
    // seed, nên đó đúng là thư mục cần test nhất — và cũng là thư mục mà runner
    // không nhìn thấy. Một file prisma/seed.test.ts sẽ không chạy, không báo
    // lỗi, chỉ im lặng không tồn tại.
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
  },
});
