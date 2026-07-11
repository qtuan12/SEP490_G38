// Chính sách mật khẩu — phải khớp với backend (PasswordValidationExtensions.StrongPassword)

export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

export const passwordRules: PasswordRule[] = [
  { label: 'Ít nhất 8 ký tự', test: (pw) => pw.length >= 8 },
  { label: 'Có chữ in HOA (A-Z)', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Có chữ thường (a-z)', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Có chữ số (0-9)', test: (pw) => /[0-9]/.test(pw) },
  { label: 'Có ký tự đặc biệt (@, #, !, ...)', test: (pw) => /[^a-zA-Z0-9]/.test(pw) },
  { label: 'Không chứa khoảng trắng', test: (pw) => pw.length > 0 && !/\s/.test(pw) },
];

/** Trả về câu lỗi đầu tiên, hoặc null nếu mật khẩu hợp lệ. */
export function validatePassword(pw: string): string | null {
  if (!pw) return 'Vui lòng nhập mật khẩu.';
  if (pw.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.';
  if (pw.length > 100) return 'Mật khẩu không được vượt quá 100 ký tự.';
  if (/\s/.test(pw)) return 'Mật khẩu không được chứa khoảng trắng.';
  if (!/[A-Z]/.test(pw)) return 'Mật khẩu phải có ít nhất 1 chữ in HOA.';
  if (!/[a-z]/.test(pw)) return 'Mật khẩu phải có ít nhất 1 chữ thường.';
  if (!/[0-9]/.test(pw)) return 'Mật khẩu phải có ít nhất 1 chữ số.';
  if (!/[^a-zA-Z0-9]/.test(pw)) return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt (@, #, !, ...).';
  return null;
}
