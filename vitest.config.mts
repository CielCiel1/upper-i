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
    include: ["src/**/*.test.ts"],
  },
});
