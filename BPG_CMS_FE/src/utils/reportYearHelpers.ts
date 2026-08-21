export const getNearestAvailableYear = (
  selectedYear: number,
  availableYears: readonly number[],
): number | null => {
  const uniqueYears = Array.from(new Set(availableYears.filter(Number.isFinite)));
  if (uniqueYears.length === 0) return null;

  return uniqueYears.reduce((nearest, year) => {
    const distance = Math.abs(year - selectedYear);
    const nearestDistance = Math.abs(nearest - selectedYear);

    if (distance < nearestDistance) return year;
    if (distance === nearestDistance && year > nearest) return year;
    return nearest;
  });
};

/**
 * Tự động chọn năm phù hợp nhất để hiển thị biểu đồ:
 * Ưu tiên chọn năm gần nhất có dữ liệu thực tế (thay vì chọn năm rỗng 0 dữ liệu).
 */
export const getPreferredReportYear = <T extends { year: number }>(
  trends: readonly T[],
  hasDataChecker?: (item: T) => boolean,
): number => {
  const uniqueYears = Array.from(new Set(trends.map(t => t.year).filter(Number.isFinite))).sort((a, b) => b - a);
  if (uniqueYears.length === 0) return new Date().getFullYear();

  if (hasDataChecker) {
    const yearsWithData = uniqueYears.filter(y => trends.some(t => t.year === y && hasDataChecker(t)));
    if (yearsWithData.length > 0) {
      return yearsWithData[0];
    }
  }

  return uniqueYears[0];
};
