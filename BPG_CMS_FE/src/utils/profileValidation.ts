// Quy tắc validate hồ sơ cá nhân — phải khớp với backend (UpdateProfileCommandValidator)

const NAME_PATTERN = /^[\p{L}\s0-9.'-]+$/u;
const PHONE_PATTERN = /^(0[0-9]{9}|\+84[0-9]{9})$/;

/** Trả về câu lỗi đầu tiên, hoặc null nếu họ tên hợp lệ. */
export function validateFullName(name: string): string | null {
  // Chuẩn hóa NFC trước khi validate: một số IME/hệ điều hành (macOS, Unikey ở chế độ
  // "Unicode tổ hợp") gõ ra chữ Việt có dấu ở dạng NFD (chữ cái + dấu ghép rời), khiến
  // \p{L} không khớp dấu và làm regex trượt dù tên gõ hoàn toàn hợp lệ.
  const trimmed = name.trim().normalize('NFC');
  if (!trimmed) return 'Họ tên không được để trống.';
  if (trimmed.length < 2) return 'Họ tên phải có ít nhất 2 ký tự.';
  if (trimmed.length > 100) return 'Họ tên không được vượt quá 100 ký tự.';
  if (!NAME_PATTERN.test(trimmed)) return "Họ tên chỉ được chứa chữ cái, số, khoảng trắng và các ký tự - . '";
  return null;
}

/**
 * Lọc ký tự ngay khi gõ vào ô số điện thoại: chỉ giữ số, dấu "+" (đầu số quốc tế),
 * khoảng trắng và dấu "-" (tách nhóm số cho dễ đọc) — chặn chữ, dấu chấm và ký tự khác.
 * Dùng trong onChange để input tự "nuốt" ký tự không hợp lệ thay vì đợi validate lúc submit.
 */
export function sanitizePhoneInput(raw: string): string {
  return raw.replace(/[^0-9+\s-]/g, '');
}

/** Số điện thoại là trường tùy chọn — trả về null nếu để trống hoặc hợp lệ. */
export function validatePhoneNumber(phone: string): string | null {
  // Bỏ khoảng trắng thường, khoảng trắng không ngắt dòng (dán từ Word/Zalo...), dấu gạch,
  // dấu chấm và ngoặc đơn — các cách người dùng hay tách nhóm số điện thoại khi gõ/dán.
  const cleaned = phone.normalize('NFC').replace(/[\s.()-]/g, '');
  if (!cleaned) return null;
  if (!PHONE_PATTERN.test(cleaned)) return 'Số điện thoại không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678.';
  return null;
}
