#!/usr/bin/env bash
# Phép thử RUNTIME cho route guard — thứ duy nhất bắt được CR-01.
#
# Vì sao script này tồn tại: gate build kiểm tra dòng `ƒ Proxy (Middleware)`
# trong output, và dòng đó chứng minh file proxy ĐÃ MẮC DÂY. Nó không chứng
# minh proxy TỪ CHỐI. Hai việc đó khác nhau, và khoảng cách giữa chúng là toàn
# bộ nội dung của CR-01: guard chạy, đặt cookie csrf, rồi cho mọi request đi
# qua. Mọi gate tĩnh — tsc, biome, vitest, next build — đều xanh trong khi mọi
# route được bảo vệ đang mở toang.
#
# Chỉ một request thật không mang cookie phân biệt được hai trạng thái đó.
#
# Chạy: pnpm guard:probe   (cần một bản build sẵn: pnpm exec next build)
set -euo pipefail

PORT="${PORT:-3999}"
BASE="http://localhost:${PORT}"

echo "Khởi động next start trên cổng ${PORT}…"
pnpm exec next start -p "${PORT}" >/tmp/guard-probe-server.log 2>&1 &
SERVER_PID=$!
# Dọn dẹp dù thoát kiểu gì, nếu không cổng sẽ kẹt cho lần chạy sau.
trap 'kill "${SERVER_PID}" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -s -o /dev/null --max-time 2 "${BASE}/dang-nhap"; then break; fi
  sleep 1
done

fail=0

# Một route được bảo vệ, không cookie, PHẢI bị đá đi — không được trả 200.
expect_redirect() {
  local path="$1"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE}${path}")
  if [ "${code}" = "307" ] || [ "${code}" = "302" ]; then
    echo "  ok      ${path} → ${code}"
  else
    echo "  FAIL    ${path} → ${code} (phải là 307; guard không từ chối)"
    fail=1
  fi
}

# Những đường người chưa đăng nhập BẮT BUỘC phải tới được. Chặn nhầm ở đây thì
# guard tự khóa chính nó: không ai đăng nhập xong được.
expect_ok() {
  local path="$1"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE}${path}")
  if [ "${code}" = "200" ]; then
    echo "  ok      ${path} → 200"
  else
    echo "  FAIL    ${path} → ${code} (phải là 200; guard chặn nhầm)"
    fail=1
  fi
}

echo "Route được bảo vệ (không cookie) phải bị từ chối:"
expect_redirect "/"
# Một đường chưa tồn tại: chứng minh MẶC ĐỊNH LÀ ĐƯỢC BẢO VỆ, tức là route tiền
# của Phase 2 sẽ được che ngay khi vừa thêm vào.
expect_redirect "/bat-ky-route-moi"

echo "Route công khai phải vào được:"
expect_ok "/dang-nhap"
expect_ok "/chua-duoc-moi"
expect_ok "/api/auth/providers"

if [ "${fail}" -ne 0 ]; then
  echo "GUARD PROBE THẤT BẠI"
  exit 1
fi
echo "GUARD PROBE ĐẠT"
