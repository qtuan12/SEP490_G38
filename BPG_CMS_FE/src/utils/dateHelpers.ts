export const parseDateSafe = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  if (!dateStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(dateStr)) {
    const formatted = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    return new Date(formatted + 'Z');
  }
  return new Date(dateStr);
};

export const formatRelativeTime = (dateString: string): string => {
  const diffMins = Math.floor((Date.now() - parseDateSafe(dateString).getTime()) / 60000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return parseDateSafe(dateString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

export const formatDate = (dateString: string): string =>
  parseDateSafe(dateString).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
