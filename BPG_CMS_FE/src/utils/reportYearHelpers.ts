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
