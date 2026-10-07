/**
 * Phân biệt hai endpoint của Neon bằng hostname.
 *
 * Neon cấp hai chuỗi kết nối tới cùng một database, chỉ khác host: bản pooled
 * mang hậu tố `-pooler` ở nhãn ĐẦU TIÊN, bản direct thì không. Đó là dấu hiệu
 * phân biệt duy nhất, nên cũng là thứ duy nhất đáng kiểm tra.
 *
 * Hàm này phân tích hostname chứ không tìm chuỗi con trên toàn URL, và sự khác
 * biệt đó có thật: một mật khẩu, một query param hay một tên database chứa
 * `-pooler` đều sẽ khiến phép `includes('-pooler')` cho một chuỗi direct đi qua.
 * Khi đó khẳng định INFRA-06 chỉ còn là lời tuyên bố, không phải phép kiểm tra.
 *
 * Tách thành module thuần để test được mà không phải nạp Prisma client.
 */
export function isPooledConnectionString(raw: string): boolean {
  return poolingProblem(raw) === null;
}

/**
 * Mô tả CHÍNH XÁC vì sao một chuỗi kết nối không phải endpoint pooled, hoặc
 * `null` nếu nó hợp lệ.
 *
 * Tồn tại vì `isPooledConnectionString` trả `false` cho BA nguyên nhân khác
 * hẳn nhau, trong khi thông báo lỗi ở src/lib/db.ts chỉ khẳng định được một:
 *
 *   | đầu vào                       | nguyên nhân thật              |
 *   |-------------------------------|-------------------------------|
 *   | host direct                   | đúng là không pooled          |
 *   | chuỗi không phân tích được    | KHÔNG phải "không pooled"     |
 *   | giá trị còn nguyên dấu nháy   | KHÔNG phải "không pooled"     |
 *
 * Trường hợp thứ ba là trường hợp đã thực sự xảy ra khi chạy gate build: một
 * dòng `.env` viết `DATABASE_URL="postgres...-pooler..."` mà dấu nháy lọt vào
 * giá trị khiến ký tự đầu là `"`, `new URL()` throw, và build chết với lời
 * nhắn bảo người vận hành rằng chuỗi pooled của họ không pooled. Chuỗi đó
 * GENUINELY có chứa `-pooler`, nên thông báo đọc như một lỗi của phép kiểm
 * tra — người đọc đi tìm sai chỗ.
 *
 * Điều đó đặc biệt đắt ở checkpoint 01-06, nơi người vận hành vừa dán một chuỗi
 * Neon thật vào ô biến môi trường trên dashboard Vercel.
 *
 * Vì vậy hàm echo lại một đoạn đầu của giá trị: đó là thứ khiến trường hợp dấu
 * nháy TỰ NÓ chẩn đoán được. Chỉ lấy 24 ký tự đầu — đủ để thấy dấu nháy hay
 * scheme sai, chưa chạm tới mật khẩu nằm sau `://user:`.
 */
export function poolingProblem(raw: string): string | null {
  let hostname: string;
  try {
    hostname = new URL(raw).hostname;
  } catch {
    // Chuỗi hỏng bị từ chối chứ không được mặc nhiên coi là hợp lệ.
    return (
      `không phân tích được thành URL (nhận được: ${JSON.stringify(raw.slice(0, 24))}…). ` +
      "Kiểm tra dấu nháy thừa quanh giá trị — dán vào Vercel thì KHÔNG kèm dấu nháy."
    );
  }

  // URL không hạ chữ hostname với scheme postgresql://, nên tự hạ.
  const firstLabel = hostname.toLowerCase().split(".")[0];
  if (!firstLabel) {
    return `không có hostname (nhận được: ${JSON.stringify(raw.slice(0, 24))}…).`;
  }

  if (!firstLabel.endsWith("-pooler")) {
    return `host '${hostname}' là endpoint DIRECT (nhãn đầu '${firstLabel}' thiếu hậu tố '-pooler').`;
  }

  return null;
}
