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
  supplierName: string;
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
