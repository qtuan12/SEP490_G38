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
  const d = parseDateSafe(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const d = parseDateSafe(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export const formatDateOnly = (dateString: string): string => {
  if (!dateString) return '';
  const d = parseDateSafe(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};
