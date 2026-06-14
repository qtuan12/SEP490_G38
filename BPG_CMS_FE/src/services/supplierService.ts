import { apiClient, USE_MOCK_API } from './api';
import type { Supplier, GetSuppliersQuery } from '../types/supplier';
import type { PagedList } from './notificationService';

type ApiResponse<T> = { success: boolean; message?: string; data: T };

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
};

// Interface mở rộng cho mock để lưu thuộc tính IsDeleted
interface MockSupplier extends Supplier {
  isDeleted?: boolean;
}

const getLocalSuppliers = (): MockSupplier[] => {
  const data = localStorage.getItem('bpg_suppliers');
  if (!data) {
    const defaults: MockSupplier[] = [
      {
        supplierId: 1,
        supplierName: 'Công ty Cổ phần Thép Hòa Phát',
        contactInfo: '024 3976 3888 - sales@hoaphat.com.vn',
        address: '66 Nguyễn Du, Hai Bà Trưng, Hà Nội',
        serviceArea: 'Toàn quốc',
        rating: 5,
        evaluationNote: 'Nhà cung cấp thép uy tín chất lượng cao, giao hàng đúng hẹn.',
        collaborationStatus: 'Active',
        isDeleted: false
      },
      {
        supplierId: 2,
        supplierName: 'Tổng Công ty Xi măng Việt Nam (VICEM)',
        contactInfo: '024 3851 2425 - contact@vicem.vn',
        address: '228 Lê Duẩn, Trung Phụng, Đống Đa, Hà Nội',
        serviceArea: 'Miền Bắc & Miền Trung',
        rating: 4.5,
        evaluationNote: 'Xi măng chất lượng ổn định, giá cả cạnh tranh.',
        collaborationStatus: 'Active',
        isDeleted: false
      },
      {
        supplierId: 3,
        supplierName: 'Công ty Nhựa Tiền Phong',
        contactInfo: '0225 3813 979 - contact@nhuatienphong.vn',
        address: '222 An Đà, Đằng Giang, Ngô Quyền, Hải Phòng',
        serviceArea: 'Miền Bắc',
        rating: 4,
        evaluationNote: 'Ống nhựa chất lượng rất tốt, có nhiều chứng chỉ chất lượng.',
        collaborationStatus: 'Active',
        isDeleted: false
      },
      {
        supplierId: 4,
        supplierName: 'Nhà phân phối Cát Đá Hùng Cường',
        contactInfo: '0909 123 456 - hungcuongmaterials@gmail.com',
        address: '15 Xa Lộ Hà Nội, Quận 2, TP. Hồ Chí Minh',
        serviceArea: 'Miền Nam',
        rating: 3.5,
        evaluationNote: 'Cát đá xây dựng chất lượng khá, thỉnh thoảng giao hàng trễ do thời tiết.',
        collaborationStatus: 'Active',
        isDeleted: false
      },
      {
        supplierId: 5,
        supplierName: 'Công ty Cổ phần Viglacera',
        contactInfo: '024 3558 2060 - info@viglacera.com.vn',
        address: 'Tòa nhà Viglacera, Đại lộ Thăng Long, Mễ Trì, Nam Từ Liêm, Hà Nội',
        serviceArea: 'Toàn quốc',
        rating: 4.8,
        evaluationNote: 'Thiết bị vệ sinh, gạch ốp lát mẫu mã đa dạng, dịch vụ bảo hành tốt.',
        collaborationStatus: 'Inactive',
        isDeleted: false
      }
    ];
    localStorage.setItem('bpg_suppliers', JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(data);
};

const saveLocalSuppliers = (suppliers: MockSupplier[]) => {
  localStorage.setItem('bpg_suppliers', JSON.stringify(suppliers));
};

export const supplierService = {
  async getSuppliers(query: GetSuppliersQuery): Promise<PagedList<Supplier>> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 400));
      let list = getLocalSuppliers().filter(s => !s.isDeleted);

      // Search filter
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        list = list.filter(
          s =>
            s.supplierName.toLowerCase().includes(searchLower) ||
            (s.contactInfo && s.contactInfo.toLowerCase().includes(searchLower)) ||
            (s.serviceArea && s.serviceArea.toLowerCase().includes(searchLower))
        );
      }

      // Status filter
      if (query.collaborationStatus) {
        list = list.filter(s => s.collaborationStatus === query.collaborationStatus);
      }

      // Sorting
      if (query.sortBy) {
        const sortByLower = query.sortBy.toLowerCase();
        const desc = !!query.sortDescending;

        list.sort((a, b) => {
          let valA = '';
          let valB = '';

          if (sortByLower === 'name' || sortByLower === 'suppliername') {
            valA = a.supplierName;
            valB = b.supplierName;
          } else if (sortByLower === 'status' || sortByLower === 'collaborationstatus') {
            valA = a.collaborationStatus;
            valB = b.collaborationStatus;
          } else if (sortByLower === 'rating') {
            const numA = a.rating ?? 0;
            const numB = b.rating ?? 0;
            return desc ? numB - numA : numA - numB;
          }

          if (valA < valB) return desc ? 1 : -1;
          if (valA > valB) return desc ? -1 : 1;
          return 0;
        });
      }

      // Pagination
      const page = query.pageNumber ?? 1;
      const size = query.pageSize ?? 10;
      const totalCount = list.length;
      const totalPages = Math.ceil(totalCount / size);
      const items = list.slice((page - 1) * size, page * size);

      return {
        items,
        pageNumber: page,
        pageSize: size,
        totalCount,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages
      };
    }

    const params: Record<string, string> = {};
    if (query.pageNumber) params.pageNumber = query.pageNumber.toString();
    if (query.pageSize) params.pageSize = query.pageSize.toString();
    if (query.search) params.search = query.search;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sortDescending !== undefined) params.sortDescending = query.sortDescending.toString();
    if (query.collaborationStatus) params.collaborationStatus = query.collaborationStatus;

    return unwrap(
      await apiClient.get<ApiResponse<PagedList<Supplier>>>('/suppliers', { params })
    );
  },

  async getSupplierById(id: number): Promise<Supplier> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const supplier = getLocalSuppliers().find(s => s.supplierId === id && !s.isDeleted);
      if (!supplier) throw new Error('Không tìm thấy nhà cung cấp.');
      return supplier;
    }
    return unwrap(await apiClient.get<ApiResponse<Supplier>>(`/suppliers/${id}`));
  },

  async createSupplier(supplierData: Omit<Supplier, 'supplierId'>): Promise<Supplier> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const suppliers = getLocalSuppliers();

      const nameExists = suppliers.some(
        s => !s.isDeleted && s.supplierName.toLowerCase() === supplierData.supplierName.toLowerCase()
      );
      if (nameExists) {
        throw new Error('Tên nhà cung cấp đã tồn tại trong hệ thống.');
      }

      const newId = suppliers.length > 0 ? Math.max(...suppliers.map(s => s.supplierId)) + 1 : 1;
      const newSupplier: MockSupplier = {
        ...supplierData,
        supplierId: newId,
        isDeleted: false
      };

      suppliers.push(newSupplier);
      saveLocalSuppliers(suppliers);
      return newSupplier;
    }
    return unwrap(await apiClient.post<ApiResponse<Supplier>>('/suppliers', supplierData));
  },

  async updateSupplier(id: number, supplierData: Omit<Supplier, 'supplierId'>): Promise<Supplier> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const suppliers = getLocalSuppliers();
      const index = suppliers.findIndex(s => s.supplierId === id && !s.isDeleted);
      if (index === -1) throw new Error('Không tìm thấy nhà cung cấp.');

      const nameExists = suppliers.some(
        s =>
          !s.isDeleted &&
          s.supplierId !== id &&
          s.supplierName.toLowerCase() === supplierData.supplierName.toLowerCase()
      );
      if (nameExists) {
        throw new Error('Tên nhà cung cấp đã tồn tại trong hệ thống.');
      }

      const updatedSupplier: MockSupplier = {
        ...suppliers[index],
        ...supplierData
      };
      suppliers[index] = updatedSupplier;
      saveLocalSuppliers(suppliers);
      return updatedSupplier;
    }
    return unwrap(await apiClient.put<ApiResponse<Supplier>>(`/suppliers/${id}`, supplierData));
  },

  async deleteSupplier(id: number): Promise<void> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const suppliers = getLocalSuppliers();
      const index = suppliers.findIndex(s => s.supplierId === id && !s.isDeleted);
      if (index === -1) throw new Error('Không tìm thấy nhà cung cấp.');

      // Soft delete
      suppliers[index].isDeleted = true;
      saveLocalSuppliers(suppliers);
      return;
    }
    await apiClient.delete<ApiResponse<null>>(`/suppliers/${id}`);
  }
};
