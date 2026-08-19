/**
 * Định dạng số theo chuẩn Việt Nam (vi-VN):
 * - Phân cách hàng nghìn bằng dấu chấm (.)
 * - Phân cách thập phân bằng dấu phẩy (,)
 * - Không tự động thêm số 0 vô nghĩa ở đuôi (ví dụ: 1 -> "1", không phải "1.000")
 * - Giới hạn tối đa 3 chữ số thập phân (hoặc có thể tuỳ chỉnh qua tham số)
 * 
 * @param value Số cần định dạng (có thể là number, string hoặc null/undefined)
 * @param maxFractionDigits Số lượng chữ số thập phân tối đa (mặc định 3)
 * @returns Chuỗi đã định dạng
 */
export const formatNumber = (value: number | string | null | undefined, maxFractionDigits: number = 3): string => {
  if (value === null || value === undefined || value === '') return '';
  
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value; // Xử lý cả TH truyền chuỗi số có dấu phẩy
  if (isNaN(num)) return typeof value === 'string' ? value : '';
  
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: maxFractionDigits,
  }).format(num);
};
