import { apiClient } from './api';
import type { ApiResponse, ApiResult, PagedList } from '../types/api';
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
  orderedQuantity: number;
  remainingQuantity: number;
  /** Đơn vị cơ sở của vật tư có bắt buộc số lượng nguyên không (nguồn: Material.BaseUnit.IsDiscrete). */
  isDiscreteUnit: boolean;
  /** Tên đơn vị cơ sở — dùng trong message khi số lượng không nguyên. */
  baseUnitName: string;
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
  requestId: number;
  items: CreatePOItemDto[];
  /** Ảnh hoặc PDF báo giá nhà cung cấp — bắt buộc ít nhất một tệp. */
  quotationFiles: POQuotationFileDto[];
}

export interface POQuotationFileDto {
  fileName: string;
  fileUrl: string;
  contentType?: string;
  fileSizeBytes?: number;
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
  closedReason?: string;
  creatorName?: string;
  createdAt?: string;
  cancelledByName?: string;
  cancelledAt?: string;
  closedByName?: string;
  closedAt?: string;
  approverName?: string;
  approvedAt?: string;
  approvalNote?: string;
  rejectedReason?: string;
  items: PODetailItemDto[];
  linkedRequests: LinkedRequestDto[];
  quotationFiles: POQuotationDto[];
}

export interface POQuotationDto {
  attachmentId: number;
  fileName: string;
  fileUrl: string;
  contentType?: string;
  fileSizeBytes?: number;
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
  projectId: number;
  phaseId: number;
  phaseName: string;
}

// Type for PO list dropdown
export interface PurchaseOrderDto {
  poId: number;
  poNumber: string;
  status: string;
  totalAmount: number;
  orderDate: string;
  /** Null với đơn tự sinh từ phiếu mua khẩn cấp - xem getPOSupplierDisplayName. */
  supplierName: string | null;
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
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return res.data;
};

const unwrapWithMessage = <T>(res: ApiResponse<T>): ApiResult<T> => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return { data: res.data, message: res.message };
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
  createGoodsReceipt: async (command: CreateGoodsReceiptCommand): Promise<ApiResult<number>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<number>>('/goodsreceipts', command)
    );
  },

  // Patch Goods Receipt Metadata
  patchGoodsReceiptMetadata: async (receiptId: number, command: PatchGoodsReceiptMetadataCommand): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.patch<ApiResponse<boolean>>(`/goodsreceipts/${receiptId}/metadata`, command)
    );
  },

  // Cancel Goods Receipt
  cancelGoodsReceipt: async (receiptId: number): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<boolean>>(`/goodsreceipts/${receiptId}/cancel`, {})
    );
  },

  // Get POs for dropdown (Sent and PartiallyReceived) — pass large pageSize to load all
  getPurchaseOrdersForReceipt: async (projectId: number): Promise<PurchaseOrderDto[]> => {
    const params: Record<string, string> = {
      pageSize: '100',
    };
    const paged = unwrap(
      await apiClient.get<ApiResponse<PagedList<PurchaseOrderDto>>>(
        `/projects/${projectId}/purchase-orders`,
        { params },
      )
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

  // Xem trước mã PO sẽ được sinh cho ngày chỉ định (chỉ tham khảo, không đảm bảo tuyệt đối)
  getNextPoNumber: async (orderDate: string): Promise<string> => {
    return unwrap(
      await apiClient.get<ApiResponse<string>>('/purchaseorders/next-number', {
        params: { orderDate },
      })
    );
  },

  // Cancel PO
  cancelPurchaseOrder: async (poId: number, reason: string): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<boolean>>(`/purchaseorders/${poId}/cancel`, { reason })
    );
  },

  // Giám đốc duyệt PO đang chờ duyệt — duyệt xong mới gửi NCC và nhập kho được
  approvePurchaseOrder: async (poId: number, note?: string): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<boolean>>(`/purchaseorders/${poId}/approve`, { note })
    );
  },

  // Giám đốc từ chối PO — số lượng vật tư được trả lại yêu cầu vật tư
  rejectPurchaseOrder: async (poId: number, reason: string): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<boolean>>(`/purchaseorders/${poId}/reject`, { reason })
    );
  },

  // Close PO (nhận một phần) — phần chưa nhận được trả lại yêu cầu vật tư
  closePurchaseOrder: async (poId: number, reason: string): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<boolean>>(`/purchaseorders/${poId}/close`, { reason })
    );
  },

  // Get PO detail by ID
  getPurchaseOrderById: async (poId: number): Promise<PurchaseOrderDetailDto> => {
    return unwrap(
      await apiClient.get<ApiResponse<PurchaseOrderDetailDto>>(`/purchaseorders/${poId}`)
    );
  },

  // Create Purchase Order
  createPurchaseOrder: async (command: CreatePurchaseOrderCommand): Promise<ApiResult<number>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<number>>('/purchaseorders', command)
    );
  },

  // Get paginated PO list for Accountant
  getPurchaseOrders: async (params: {
    search?: string;
    status?: string;
    projectId?: number;
    sourceType?: string;
    orderDateFrom?: string;
    orderDateTo?: string;
    pageNumber?: number;
    pageSize?: number;
  }): Promise<PagedList<PurchaseOrderDto>> => {
    const q: Record<string, string> = {
      pageNumber: (params.pageNumber ?? 1).toString(),
      pageSize: (params.pageSize ?? 10).toString(),
    };
    if (params.search) q.search = params.search;
    if (params.status) q.status = params.status;
    if (params.sourceType) q.sourceType = params.sourceType;
    if (params.orderDateFrom) q.orderDateFrom = params.orderDateFrom;
    if (params.orderDateTo) q.orderDateTo = params.orderDateTo;
    const endpoint = params.projectId
      ? `/projects/${params.projectId}/purchase-orders`
      : '/purchaseorders';
    return unwrap(
      await apiClient.get<ApiResponse<PagedList<PurchaseOrderDto>>>(endpoint, { params: q })
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
  createMaterialIssuance: async (command: CreateMaterialIssuanceCommand): Promise<ApiResult<number>> => {
    return unwrapWithMessage(
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
  createMaterialReturn: async (command: CreateMaterialReturnCommand): Promise<ApiResult<number>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<number>>('/materialreturns', command)
    );
  }
};
