import type { AttachmentDto } from './common';

// ─── Surplus Request (Batch) ───────────────────────────────────────────────
export interface SurplusRequest {
  surplusRequestId: number;
  projectId: number;
  projectName: string;
  reason?: string;
  status: string; // Processing | Processed
  createdAt: string;
  createdByName: string;
  totalItems: number;
  processedItems: number;
}

export interface SurplusRequestDetail extends SurplusRequest {
  items: SurplusRequestItem[];
}

// ─── Surplus Request Item ──────────────────────────────────────────────────
export interface SurplusRequestItem {
  surplusRequestItemId: number;
  surplusRequestId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  unitId: number;
  unitName: string;
  quantity: number;
  processedQuantity: number;
  status: string; // Pending | Processing | Completed | Cancelled
  actions: SurplusActionSummary[];
}

export interface SurplusActionSummary {
  actionType: string; // ReturnSupplier | Transfer | Liquidate
  actionId: number;
  status: string;
  quantity: number;
}

// ─── Actions ──────────────────────────────────────────────────────────────
export interface SurplusReturnSupplier {
  surplusReturnSupplierId: number;
  surplusRequestItemId: number;
  supplierId?: number;
  supplierName?: string;
  returnQuantity: number;
  refundAmount?: number;
  note?: string;
  createdAt: string;
  attachments?: AttachmentDto[];
}

export interface SurplusTransfer {
  surplusTransferId: number;
  surplusRequestItemId: number;
  fromProjectId: number;
  fromProjectName: string;
  toProjectId: number;
  toProjectName: string;
  transferQuantity: number;
  status: string; // Pending | Approved | Rejected | Dispatched | Received
  approverName?: string;
  approvedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  createdAt: string;
  attachments?: AttachmentDto[];
}

export interface IncomingTransfer extends SurplusTransfer {
  materialId: number;
  materialCode: string;
  materialName: string;
  unitId: number;
  unitName: string;
}

export interface SurplusLiquidation {
  surplusLiquidationId: number;
  surplusRequestItemId: number;
  buyerName: string;
  liquidationQuantity: number;
  totalAmount: number;
  createdAt: string;
  attachments?: AttachmentDto[];
}

export interface SurplusActionList {
  surplusRequestItemId: number;
  returns: SurplusReturnSupplier[];
  transfers: SurplusTransfer[];
  liquidations: SurplusLiquidation[];
}
