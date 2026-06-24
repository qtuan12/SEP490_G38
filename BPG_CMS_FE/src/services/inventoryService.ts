import { apiClient } from './api';
import type { ApiResponse, PagedList } from '../types/api';
import type {
  CurrentInventory,
  InventoryTransaction,
  GoodsReceipt,
  GoodsReceiptDetail,
  CreateGoodsReceiptCommand,
  PatchGoodsReceiptMetadataCommand
} from '../types/inventory';

// Type for PO list dropdown
export interface PurchaseOrderDto {
  poId: number;
  poNumber: string;
  status: string;
  totalAmount: number;
  orderDate: string;
  supplierName: string;
  items: PurchaseOrderItemDto[];
}

export interface PurchaseOrderItemDto {
  poItemId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  specification: string;
  unitId: number;
  unitName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  conversionRate: number;
  totalReceived: number;
}

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
};

export const inventoryService = {
  // Current Inventory
  getCurrentInventory: async (projectId: number): Promise<CurrentInventory[]> => {
    return unwrap(
      await apiClient.get<ApiResponse<CurrentInventory[]>>(`/projects/${projectId}/inventory`)
    );
  },

  // Inventory Transactions (Ledger)
  getInventoryTransactions: async (
    projectId: number,
    params?: { 
      materialId?: number; 
      transactionType?: number;
      pageNumber?: number;
      pageSize?: number;
      search?: string;
    }
  ): Promise<PagedList<InventoryTransaction>> => {
    const queryParams: Record<string, string> = {};
    if (params?.materialId) queryParams.materialId = params.materialId.toString();
    if (params?.transactionType) queryParams.transactionType = params.transactionType.toString();
    if (params?.pageNumber) queryParams.pageNumber = params.pageNumber.toString();
    if (params?.pageSize) queryParams.pageSize = params.pageSize.toString();
    if (params?.search) queryParams.search = params.search;

    return unwrap(
      await apiClient.get<ApiResponse<PagedList<InventoryTransaction>>>(
        `/projects/${projectId}/inventory/transactions`,
        { params: queryParams }
      )
    );
  },

  // Goods Receipts List
  getGoodsReceipts: async (
    projectId?: number,
    pageNumber: number = 1,
    pageSize: number = 10,
    search?: string
  ): Promise<PagedList<GoodsReceipt>> => {
    const params: Record<string, string> = {
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
    };
    if (projectId) params.projectId = projectId.toString();
    if (search) params.search = search;

    return unwrap(
      await apiClient.get<ApiResponse<PagedList<GoodsReceipt>>>('/goodsreceipts', { params })
    );
  },

  // Goods Receipt Detail
  getGoodsReceiptDetail: async (receiptId: number): Promise<GoodsReceiptDetail> => {
    return unwrap(
      await apiClient.get<ApiResponse<GoodsReceiptDetail>>(`/goodsreceipts/${receiptId}`)
    );
  },

  // Create Goods Receipt
  createGoodsReceipt: async (command: CreateGoodsReceiptCommand): Promise<number> => {
    return unwrap(
      await apiClient.post<ApiResponse<number>>('/goodsreceipts', command)
    );
  },

  // Patch Goods Receipt Metadata
  patchGoodsReceiptMetadata: async (receiptId: number, command: PatchGoodsReceiptMetadataCommand): Promise<boolean> => {
    return unwrap(
      await apiClient.patch<ApiResponse<boolean>>(`/goodsreceipts/${receiptId}/metadata`, command)
    );
  },

  // Cancel Goods Receipt
  cancelGoodsReceipt: async (receiptId: number): Promise<boolean> => {
    return unwrap(
      await apiClient.post<ApiResponse<boolean>>(`/goodsreceipts/${receiptId}/cancel`, {})
    );
  },

  // Get POs for dropdown (Sent and PartiallyReceived)
  getPurchaseOrdersForReceipt: async (projectId: number): Promise<PurchaseOrderDto[]> => {
    const params: Record<string, string> = {
      projectId: projectId.toString()
    };
    return unwrap(
      await apiClient.get<ApiResponse<PurchaseOrderDto[]>>('/purchaseorders', { params })
    );
  }
};
