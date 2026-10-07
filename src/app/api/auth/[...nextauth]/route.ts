import { handlers } from "@/auth";

// Toàn bộ endpoint HTTP của Auth.js: /api/auth/signin, /callback, /signout,
// /session, /csrf. Route này phải nằm ngoài matcher của src/proxy.ts, nếu không
// route guard sẽ chặn chính đường OAuth callback và việc đăng nhập không bao giờ
// hoàn tất được.
export const { GET, POST } = handlers;
