import { apiClient } from './api';
import type { ApiResponse, PagedList } from '../types/api';
import type {
  CurrentInventory,
  InventoryTransaction,
  GoodsReceipt,
  GoodsReceiptDetail,
  CreateGoodsReceiptCommand,
  PatchGoodsReceiptMetadataCommand,
  MaterialIssuance,
  MaterialIssuanceDetail,
  CreateMaterialIssuanceCommand,
  MaterialReturn,
  MaterialReturnDetail,
  CreateMaterialReturnCommand
} from '../types/inventory';

// ─── PO Types ───────────────────────────────────────────────────────────────

export interface ApprovedRequestForPODto {
  requestId: number;
  reason: string;
  projectId: number;
  projectName: string;
  phaseId: number;
  phaseName: string;
  hasPO: boolean;
  items: RequestItemForPODto[];
}

export interface RequestItemForPODto {
  requestItemId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  specification: string;
  unitId: number;
  unitName: string;
  quantity: number;
  conversionRate: number;
}

export interface CreatePurchaseOrderCommand {
  poNumber?: string;
  orderDate: string;
  supplierId?: number;
  projectId: number;
  expectedDeliveryDate?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  notes?: string;
  requestIds: number[];
  items: CreatePOItemDto[];
}

export interface CreatePOItemDto {
  materialId: number;
  unitId: number;
  quantity: number;
  unitPrice: number;
  conversionRate?: number;
  notes?: string;
}

// PO Detail
export interface PurchaseOrderDetailDto {
  poId: number;
  poNumber: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  notes?: string;
  totalAmount: number;
  supplierId?: number;
  supplierName: string;
  supplierContactInfo?: string;
  projectId?: number;
  projectName: string;
  cancelledReason?: string;
  items: PODetailItemDto[];
  linkedRequests: LinkedRequestDto[];
}

export interface PODetailItemDto {
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
  notes?: string;
}

export interface LinkedRequestDto {
  requestId: number;
  reason: string;
  phaseName: string;
}

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

  // Get POs for dropdown (Sent and PartiallyReceived) — pass large pageSize to load all
  getPurchaseOrdersForReceipt: async (projectId: number): Promise<PurchaseOrderDto[]> => {
    const params: Record<string, string> = {
      projectId: projectId.toString(),
      pageSize: '100',
    };
    const paged = unwrap(
      await apiClient.get<ApiResponse<PagedList<PurchaseOrderDto>>>('/purchaseorders', { params })
    );
    return paged.items ?? [];
  },

  // Get approved material requests for a project (for PO creation)
  getApprovedRequestsForPO: async (projectId: number): Promise<ApprovedRequestForPODto[]> => {
    return unwrap(
      await apiClient.get<ApiResponse<ApprovedRequestForPODto[]>>('/purchaseorders/approved-requests', {
        params: { projectId: projectId.toString() },
      })
    );
  },

  // Cancel PO
  cancelPurchaseOrder: async (poId: number, reason: string): Promise<boolean> => {
    return unwrap(
      await apiClient.post<ApiResponse<boolean>>(`/purchaseorders/${poId}/cancel`, { reason })
    );
  },

  // Get PO detail by ID
  getPurchaseOrderById: async (poId: number): Promise<PurchaseOrderDetailDto> => {
    return unwrap(
      await apiClient.get<ApiResponse<PurchaseOrderDetailDto>>(`/purchaseorders/${poId}`)
    );
  },

  // Create Purchase Order
  createPurchaseOrder: async (command: CreatePurchaseOrderCommand): Promise<number> => {
    return unwrap(
      await apiClient.post<ApiResponse<number>>('/purchaseorders', command)
    );
  },

  // Get paginated PO list for Accountant
  getPurchaseOrders: async (params: {
    poNumber?: string;
    status?: string;
    projectId?: number;
    pageNumber?: number;
    pageSize?: number;
  }): Promise<PagedList<PurchaseOrderDto>> => {
    const q: Record<string, string> = {
      pageNumber: (params.pageNumber ?? 1).toString(),
      pageSize: (params.pageSize ?? 10).toString(),
    };
    if (params.poNumber) q.poNumber = params.poNumber;
    if (params.status) q.status = params.status;
    if (params.projectId) q.projectId = params.projectId.toString();
    return unwrap(
      await apiClient.get<ApiResponse<PagedList<PurchaseOrderDto>>>('/purchaseorders', { params: q })
    );
  },

  // Material Issuance List
  getMaterialIssuances: async (
    projectId: number,
    pageNumber: number = 1,
    pageSize: number = 10,
    search?: string
  ): Promise<PagedList<MaterialIssuance>> => {
    const params: Record<string, string> = {
      projectId: projectId.toString(),
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString()
    };
    if (search) params.search = search;

    return unwrap(
      await apiClient.get<ApiResponse<PagedList<MaterialIssuance>>>('/materialissuances', { params })
    );
  },

  // Material Issuance Detail
  getMaterialIssuanceDetail: async (issuanceId: number): Promise<MaterialIssuanceDetail> => {
    return unwrap(
      await apiClient.get<ApiResponse<MaterialIssuanceDetail>>(`/materialissuances/${issuanceId}`)
    );
  },

  // Create Material Issuance
  createMaterialIssuance: async (command: CreateMaterialIssuanceCommand): Promise<number> => {
    return unwrap(
      await apiClient.post<ApiResponse<number>>('/materialissuances', command)
    );
  },

  // ─── Material Return (Phếu Hoàn Trả Vật Tư) ─────────────────────────────────

  /** Lấy danh sách phiếu hoàn trả, lọc theo dự án hoặc phiếu xuất gốc */
  getMaterialReturns: async (params: {
    projectId?: number;
    issuanceId?: number;
    pageNumber?: number;
    pageSize?: number;
    search?: string;
  }): Promise<PagedList<MaterialReturn>> => {
    const queryParams: Record<string, string> = {};
    if (params.projectId !== undefined) queryParams.projectId = params.projectId.toString();
    if (params.issuanceId !== undefined) queryParams.issuanceId = params.issuanceId.toString();
    if (params.pageNumber !== undefined) queryParams.pageNumber = params.pageNumber.toString();
    if (params.pageSize !== undefined) queryParams.pageSize = params.pageSize.toString();
    if (params.search) queryParams.search = params.search;

    return unwrap(
      await apiClient.get<ApiResponse<PagedList<MaterialReturn>>>('/materialreturns', { params: queryParams })
    );
  },

  /** Lấy chi tiết 1 phiếu hoàn trả */
  getMaterialReturnDetail: async (returnId: number): Promise<MaterialReturnDetail> => {
    return unwrap(
      await apiClient.get<ApiResponse<MaterialReturnDetail>>(`/materialreturns/${returnId}`)
    );
  },

  /** Tạo phiếu hoàn trả vật tư mới */
  createMaterialReturn: async (command: CreateMaterialReturnCommand): Promise<number> => {
    return unwrap(
      await apiClient.post<ApiResponse<number>>('/materialreturns', command)
    );
  }
};
