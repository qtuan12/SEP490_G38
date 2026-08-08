export interface MaterialPhaseUsage {
  phaseId: number;
  phaseName: string;
  boqQuantity: number;
  usedQuantity: number;
}

export interface CurrentInventory {
  inventoryId: number;
  projectId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  specification: string;
  unitId: number;
  unitName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  safetyThreshold: number;
  boqQuantity?: number;
  usedQuantity?: number;
  phaseUsages?: MaterialPhaseUsage[];
  lastUpdated: string;
  supplierName: string;
}

export interface InventoryTransaction {
  transactionId: number;
  projectId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  transactionType: number;
  referenceId: number;
  quantityChange: number;
  balanceAfter: number;
  unitName: string;
  createdBy: number | null;
  createdByName: string;
  createdAt: string;
}

export interface GoodsReceipt {
  receiptId: number;
  receiptNo: string;
  poId: number;
  poNumber: string;
  delivererInfo: string | null;
  deliveryDocNo: string | null;
  status: string;
  createdAt: string;
  createdByName: string;
}

export interface GoodsReceiptItemDetail {
  receiptItemId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  specification: string;
  unitId: number;
  unitName: string;
  quantity: number;
}

export interface GoodsReceiptDetail {
  receiptId: number;
  receiptNo: string;
  poId: number;
  poNumber: string;
  /** Null với phiếu nhập của đơn tự sinh từ phiếu mua khẩn cấp. */
  supplierName: string | null;
  delivererInfo: string | null;
  deliveryDocNo: string | null;
  status: string;
  createdAt: string;
  createdByName: string;
  items: GoodsReceiptItemDetail[];
  images: string[];
}

export interface CreateGoodsReceiptItemDto {
  materialId: number;
  unitId: number;
  quantity: number;
}

export interface CreateGoodsReceiptCommand {
  poId: number;
  delivererInfo?: string | null;
  deliveryDocNo?: string | null;
  items: CreateGoodsReceiptItemDto[];
  images?: string[] | null;
}

export interface PatchGoodsReceiptMetadataCommand {
  receiptId: number;
  delivererInfo?: string | null;
  deliveryDocNo?: string | null;
  images?: string[] | null;
}

export interface MaterialIssuance {
  materialIssuanceId: number;
  issuanceNo: string; // Mã phiếu xuất kho nghiệp vụ, ví dụ: PXK-20240624-A3F8B2
  taskId: number;
  taskName: string;
  purpose: string;
  totalItems: number;
  createdAt: string;
  createdByName: string;
}

export interface MaterialIssuanceItemDetail {
  issuanceItemId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  unitId: number;
  unitName: string;
  quantity: number;
  conversionRate: number;
}

export interface MaterialIssuanceDetail {
  materialIssuanceId: number;
  issuanceNo: string; // Mã phiếu xuất kho nghiệp vụ, ví dụ: PXK-20240624-A3F8B2
  taskId: number;
  taskName: string;
  purpose: string;
  createdAt: string;
  createdByName: string;
  items: MaterialIssuanceItemDetail[];
}

export interface CreateMaterialIssuanceItemDto {
  materialId: number;
  unitId: number;
  quantity: number;
  conversionRate?: number;
}

export interface CreateMaterialIssuanceCommand {
  taskId: number;
  purpose: string;
  items: CreateMaterialIssuanceItemDto[];
}

// ─── Material Return (Phiếu Hoàn Trả Vật Tư) ─────────────────────────────────

export interface MaterialReturn {
  materialReturnId: number;
  /** Mã phiếu hoàn trả, ví dụ: PTra-20240630-A3F8B2 */
  returnNo: string;
  originalIssuanceId: number;
  /** Mã phiếu xuất kho gốc, ví dụ: PXK-20240628-D4C1A0 */
  originalIssuanceNo: string;
  taskId: number;
  taskName: string;
  reason: string;
  totalItems: number;
  createdAt: string;
  createdByName: string;
  items?: MaterialReturnItemDetail[];
}

export interface MaterialReturnItemDetail {
  returnItemId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  unitId: number;
  unitName: string;
  quantity: number;
  conversionRate: number;
}

export interface MaterialReturnDetail {
  materialReturnId: number;
  returnNo: string;
  originalIssuanceId: number;
  originalIssuanceNo: string;
  taskId: number;
  taskName: string;
  reason: string;
  createdAt: string;
  createdByName: string;
  items: MaterialReturnItemDetail[];
}

export interface CreateMaterialReturnItemDto {
  materialId: number;
  unitId: number;
  quantity: number;
  conversionRate?: number;
}

export interface CreateMaterialReturnCommand {
  originalIssuanceId: number;
  reason: string;
  items: CreateMaterialReturnItemDto[];
}
