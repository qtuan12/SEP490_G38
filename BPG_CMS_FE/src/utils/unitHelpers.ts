const DISCRETE_UNITS = [
  'cái', 'bộ', 'cuộn', 'thùng', 'hộp', 'bao', 'tấm', 'viên', 
  'thanh', 'ống', 'chai', 'lon', 'cặp', 'cây', 'chiếc', 'quả', 'kiện'
];

/**
 * Kiểm tra xem Đơn vị tính có thuộc nhóm số nguyên (Discrete Units) không.
 * So khớp không phân biệt chữ hoa/thường và khoảng trắng.
 */
export const isDiscreteUnit = (unitName?: string): boolean => {
  if (!unitName) return false;
  const normalized = unitName.toLowerCase().trim();
  // Kiểm tra tên ĐVT có khớp hoàn toàn hoặc chứa ĐVT số nguyên trong ngoặc đơn
  return DISCRETE_UNITS.some(u => 
    normalized === u || 
    normalized.startsWith(u + ' ') || 
    normalized.includes(`(${u})`)
  );
};
