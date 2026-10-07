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
  let hostname: string;
  try {
    hostname = new URL(raw).hostname;
  } catch {
    // Chuỗi hỏng bị từ chối chứ không được mặc nhiên coi là hợp lệ.
    return false;
  }

  // URL không hạ chữ hostname với scheme postgresql://, nên tự hạ.
  const firstLabel = hostname.toLowerCase().split(".")[0];
  if (!firstLabel) return false;

  return firstLabel.endsWith("-pooler");
}
