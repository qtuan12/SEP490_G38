// Quy tắc validate hồ sơ cá nhân — phải khớp với backend (UpdateProfileCommandValidator)

const NAME_PATTERN = /^[\p{L}\s]+$/u;
const PHONE_PATTERN = /^(0[0-9]{9}|\+84[0-9]{9})$/;

/** Trả về câu lỗi đầu tiên, hoặc null nếu họ tên hợp lệ. */
export function validateFullName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Họ tên không được để trống.';
  if (trimmed.length < 2) return 'Họ tên phải có ít nhất 2 ký tự.';
  if (trimmed.length > 100) return 'Họ tên không được vượt quá 100 ký tự.';
  if (!NAME_PATTERN.test(trimmed)) return 'Họ tên chỉ được chứa chữ cái và khoảng trắng.';
  return null;
}

/** Số điện thoại là trường tùy chọn — trả về null nếu để trống hoặc hợp lệ. */
export function validatePhoneNumber(phone: string): string | null {
  const cleaned = phone.replace(/[\s-]/g, '');
  if (!cleaned) return null;
  if (!PHONE_PATTERN.test(cleaned)) return 'Số điện thoại không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678.';
  return null;
}
