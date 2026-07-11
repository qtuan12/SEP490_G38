// Surplus status helpers — dùng chung cho batch, item, transfer

export const getSurplusRequestStatusDetails = (status: string) => {
  switch (status) {
    case 'Processing':
      return { name: 'Đang xử lý', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'Processed':
      return { name: 'Đã hoàn tất', color: 'bg-green-50 text-green-700 border-green-200' };
    default:
      return { name: status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
  }
};

export const getSurplusItemStatusDetails = (status: string) => {
  switch (status) {
    case 'Pending':
      return { name: 'Chờ xử lý', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
    case 'Processing':
      return { name: 'Đang xử lý', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'Completed':
      return { name: 'Hoàn thành', color: 'bg-green-50 text-green-700 border-green-200' };
    case 'Cancelled':
      return { name: 'Đã hủy', color: 'bg-red-50 text-red-700 border-red-200' };
    default:
      return { name: status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
  }
};

export const getSurplusTransferStatusDetails = (status: string) => {
  switch (status) {
    case 'Pending':
      return { name: 'Chờ duyệt', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
    case 'Approved':
      return { name: 'Đã duyệt', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'Rejected':
      return { name: 'Từ chối', color: 'bg-red-50 text-red-700 border-red-200' };
    case 'Dispatched':
      return { name: 'Đang vận chuyển', color: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'Received':
      return { name: 'Đã nhận', color: 'bg-green-50 text-green-700 border-green-200' };
    default:
      return { name: status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
  }
};

export const getGeneralActionStatusName = (status: string) => {
  switch (status) {
    case 'Pending': return 'Chờ duyệt';
    case 'Approved': return 'Đã duyệt';
    case 'Rejected': return 'Từ chối';
    case 'Dispatched': return 'Đang vận chuyển';
    case 'Received': return 'Đã nhận';
    case 'Completed': return 'Hoàn thành';
    default: return status;
  }
};

export const getSurplusActionTypeLabel = (actionType: string) => {
  switch (actionType) {
    case 'ReturnSupplier': return { name: 'Trả NCC', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'Transfer':      return { name: 'Chuyển kho', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'Liquidate':     return { name: 'Thanh lý', color: 'bg-orange-50 text-orange-700 border-orange-200' };
    default:             return { name: actionType, color: 'bg-slate-50 text-slate-600 border-slate-200' };
  }
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export const formatDateVN = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};
