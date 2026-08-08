// Helpers dùng chung cho đơn mua hàng (PO)

/** Nhãn hiển thị thay cho nhà cung cấp của đơn tự sinh từ phiếu mua khẩn cấp. */
export const DIRECT_PURCHASE_SUPPLIER_LABEL = 'Mua ngoài (không qua NCC)';

/**
 * PO tự sinh từ phiếu mua khẩn cấp có PONumber dạng DP-PO-000014 và SupplierId = null,
 * vì hàng được mua lẻ tại cửa hàng ngoài chứ không qua nhà cung cấp có hợp đồng.
 */
export const isDirectPurchaseOrder = (poNumber?: string | null): boolean =>
  !!poNumber && poNumber.startsWith('DP-PO-');

/**
 * Tên nhà cung cấp để hiển thị. Trả về null nếu không xác định được,
 * để nơi gọi tự quyết định placeholder ('—' hay 'N/A').
 */
export const getPOSupplierDisplayName = (
  supplierName?: string | null,
  poNumber?: string | null,
): string | null => {
  if (supplierName) return supplierName;
  if (isDirectPurchaseOrder(poNumber)) return DIRECT_PURCHASE_SUPPLIER_LABEL;
  return null;
};
