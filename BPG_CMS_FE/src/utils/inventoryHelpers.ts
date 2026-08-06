import { parseDateSafe } from './dateHelpers';

/**
 * Trả về tên hiển thị và class màu sắc (Tailwind) cho từng loại giao dịch kho (Ledger Transaction Type)
 */
export const getTransactionTypeDetails = (type: number) => {
  switch (type) {
    case 1:
      return { name: 'Nhập kho (Đơn mua)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 2:
      return { name: 'Xuất thi công', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 3:
      return { name: 'Chuyển kho đến', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 4:
      return { name: 'Chuyển kho đi', color: 'bg-violet-50 text-violet-700 border-violet-200' };
    case 5:
      return { name: 'Trả hàng NCC', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 6:
      return { name: 'Điều chỉnh/Hủy', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 7:
      return { name: 'Thanh lý', color: 'bg-slate-100 text-slate-800 border-slate-300' };
    case 8:
      return { name: 'Hoàn trả thi công', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 9:
      return { name: 'Giảm tồn (sự cố)', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    default:
      return { name: 'Giao dịch khác', color: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
};

/**
 * Trả về thông tin nhãn hiển thị và class màu sắc cho trạng thái phiếu nhập kho (Goods Receipt Status)
 */
export const getGoodsReceiptStatusDetails = (status: string) => {
  if (status === 'Cancelled') {
    return { name: 'Đã hủy', color: 'bg-red-50 text-red-700 border-red-200' };
  }
  return { name: 'Đã nhập kho', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
};

/**
 * Định dạng ngày giờ hiển thị theo chuẩn Việt Nam (dd/MM/yyyy hh:mm)
 */
export const formatDateTimeVN = (dateString: string): string => {
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

/**
 * Định dạng ngày hiển thị theo chuẩn Việt Nam (dd/MM/yyyy)
 */
export const formatDateVN = (dateString: string): string => {
  if (!dateString) return '';
  const d = parseDateSafe(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const parseQuantityInput = (value: string): number => {
  return Number(value.trim().replace(',', '.'));
};

export const formatQuantity = (value: number, maximumFractionDigits = 3): string => {
  if (!Number.isFinite(value)) return '0';
  const normalized = Math.abs(value) < 1e-9 ? 0 : value;
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(normalized);
};

export const isGreaterThanQuantity = (value: number, max: number, epsilon = 1e-9): boolean => {
  return value - max > epsilon;
};
