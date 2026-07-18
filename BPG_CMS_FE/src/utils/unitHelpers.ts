const DISCRETE_UNITS = [
  'cái', 'bộ', 'cuộn', 'thùng', 'hộp', 'bao', 'tấm', 'viên', 
  'thanh', 'ống', 'chai', 'lon', 'cặp', 'cây', 'chiếc', 'quả', 'kiện'
];

/**
 * Kiểm tra xem Đơn vị tính có thuộc nhóm số nguyên (Discrete Units) không.
 * Hỗ trợ nhận vào string (tên ĐVT) hoặc object chứa thuộc tính isDiscrete.
 */
export const isDiscreteUnit = (unit?: string | { isDiscrete?: boolean; unitName?: string; name?: string }): boolean => {
  if (!unit) return false;

  if (typeof unit === 'object') {
    if (typeof unit.isDiscrete === 'boolean') {
      return unit.isDiscrete;
    }
    return isDiscreteUnit(unit.unitName || unit.name);
  }

  const normalized = unit.toLowerCase().trim();
  // Kiểm tra tên ĐVT có khớp hoàn toàn hoặc chứa ĐVT số nguyên trong ngoặc đơn
  return DISCRETE_UNITS.some(u => 
    normalized === u || 
    normalized.startsWith(u + ' ') || 
    normalized.includes(`(${u})`)
  );
};
