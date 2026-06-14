# Kế hoạch phát triển Frontend cho Quản lý Nhà cung cấp (Supplier CRUD)

Kế hoạch này chi tiết hóa việc xây dựng giao diện (UI) và tích hợp API kiểm soát danh sách nhà cung cấp ở Frontend của hệ thống BPG-CMS, tuân thủ các quy định về DRY, vanila CSS, `@tanstack/react-query` và `react-hook-form` + `zod`.

---

## User Review Required

> [!IMPORTANT]
> **Quyền truy cập trang Quản lý Nhà cung cấp:**
> - Theo định nghĩa phân quyền trong `BUSINESS_CONTEXT.md` (mục 5), chỉ **Admin** mới có quyền quản lý danh mục vật tư bao gồm nhà cung cấp (`supplier`).
> - Do đó, đường dẫn `/suppliers` sẽ được bảo vệ bằng Route Guard: `allowedRoles={['admin']}`.
> - Sidebar sẽ hiển thị liên kết "Quản lý Nhà cung cấp" chỉ đối với tài khoản có role `Admin`.

---

## Open Questions

> [!NOTE]
> **Các tính năng phụ trợ:**
> Hiện tại, API backend của `GetSuppliers` hỗ trợ phân trang (`pageNumber`, `pageSize`), tìm kiếm (`Search`) và lọc trạng thái (`CollaborationStatus`). Giao diện sẽ hiển thị đầy đủ các bộ lọc này kèm phân trang động dưới chân bảng dữ liệu.

---

## Proposed Changes

### Frontend Component (BPG_CMS_FE)

Thêm định nghĩa kiểu dữ liệu, viết service gọi API, xây dựng trang quản lý nhà cung cấp và modal nhập liệu, cập nhật menu điều hướng và định tuyến chính.

---

#### [NEW] [supplier.ts](file:///d:/Semester_9_SU26/SEP490/Project/SEP490_G38/BPG_CMS_FE/src/types/supplier.ts)
- Khai báo interface `Supplier` đại diện cho nhà cung cấp:
  ```typescript
  export interface Supplier {
    supplierId: number;
    supplierName: string;
    contactInfo?: string;
    address?: string;
    serviceArea?: string;
    rating?: number;
    evaluationNote?: string;
    collaborationStatus: 'Active' | 'Inactive';
  }

  export interface GetSuppliersQuery {
    pageNumber?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortDescending?: boolean;
    collaborationStatus?: string;
  }
  ```

#### [NEW] [supplierService.ts](file:///d:/Semester_9_SU26/SEP490/Project/SEP490_G38/BPG_CMS_FE/src/services/supplierService.ts)
- Cung cấp các phương thức tương tác API thông qua `apiClient` từ `src/services/api.ts`.
- Hỗ trợ mock dữ liệu khi biến môi trường `USE_MOCK_API === true` để dev offline không lỗi luồng.
- Bao gồm các phương thức: `getSuppliers`, `getSupplierById`, `createSupplier`, `updateSupplier`, `deleteSupplier`.

#### [NEW] [SupplierFormModal.tsx](file:///d:/Semester_9_SU26/SEP490/Project/SEP490_G38/BPG_CMS_FE/src/pages/SupplierManagement/modals/SupplierFormModal.tsx)
- Sử dụng `react-hook-form` + `zodResolver` + `zod` để tạo form kiểm soát tính hợp lệ của dữ liệu trước khi gửi lên API.
- Tự động thay đổi tiêu đề ("Thêm nhà cung cấp" hoặc "Cập nhật nhà cung cấp") tùy thuộc vào việc có truyền prop `supplier` hay không.
- Sử dụng các UI components có sẵn như `<Modal>`, `<Input>`, `<Select>`, `<Textarea>`, `<FormItem>`, `<Button>`.

#### [NEW] [index.tsx](file:///d:/Semester_9_SU26/SEP490/Project/SEP490_G38/BPG_CMS_FE/src/pages/SupplierManagement/index.tsx)
- Trang quản lý chính, hiển thị bảng danh sách các nhà cung cấp sử dụng component `<DataTable>` và thanh phân trang `<Pagination>`.
- Cung cấp các bộ lọc tìm kiếm text, lọc trạng thái (`CollaborationStatus`), nút thêm mới và các nút hành động (Sửa, Xóa mềm).
- Sử dụng `@tanstack/react-query` (`useQuery` và `useMutation`) để thực hiện các thao tác đọc và chỉnh sửa dữ liệu bất đồng bộ.

#### [MODIFY] [App.tsx](file:///d:/Semester_9_SU26/SEP490/Project/SEP490_G38/BPG_CMS_FE/src/App.tsx)
- Khai báo route mới `/suppliers` bọc trong `ProtectedRoute` với `allowedRoles={['admin']}`:
  ```tsx
  import { SupplierManagement } from './pages/SupplierManagement';
  ...
  <Route 
    path="/suppliers" 
    element={
      <ProtectedRoute allowedRoles={['admin']}>
        <SupplierManagement />
      </ProtectedRoute>
    } 
  />
  ```

#### [MODIFY] [MainLayout.tsx](file:///d:/Semester_9_SU26/SEP490/Project/SEP490_G38/BPG_CMS_FE/src/components/layout/MainLayout.tsx)
- Import thêm icon `Truck` từ `lucide-react`.
- Cập nhật mảng `navItems` để hiển thị menu quản lý nhà cung cấp cho Admin:
  ```typescript
  { name: 'Nhà cung cấp', path: '/suppliers', icon: <Truck size={20} />, roles: ['admin'] }
  ```
- Cập nhật text tiêu đề Header hiển thị `Quản lý Nhà cung cấp` khi URL là `/suppliers`.

---

## Verification Plan

### Automated Tests
- Biên dịch dự án frontend để đảm bảo không lỗi kiểu TypeScript hoặc lỗi cú pháp:
  ```powershell
  cd BPG_CMS_FE
  npm run build
  ```

### Manual Verification
1. **Kiểm tra phân quyền và điều hướng**:
   - Đăng nhập bằng tài khoản Admin -> Kiểm tra xem sidebar có xuất hiện menu "Nhà cung cấp" không. Click vào menu này để truy cập trang `/suppliers`.
   - Đăng nhập bằng tài khoản Technical Manager hoặc Site Engineer -> Kiểm tra xem có bị ẩn menu này không và nếu gõ tay địa chỉ `/suppliers` trên thanh URL thì có bị redirect về `/dashboard` không.
2. **Kiểm tra CRUD hoạt động**:
   - **Tạo mới**: Bấm "Thêm Nhà cung cấp", điền thông tin và lưu lại. Xác nhận tên NCC xuất hiện trên danh sách bảng dữ liệu. Thử tạo trùng tên xem có báo lỗi đỏ từ Backend trả về không.
   - **Tìm kiếm & Bộ lọc**: Gõ một phần tên NCC hoặc khu vực dịch vụ và đổi trạng thái lọc từ "Tất cả" sang "Active"/"Inactive" xem dữ liệu bảng có tự lọc tương ứng không.
   - **Chỉnh sửa**: Chọn một NCC và sửa thông tin bất kỳ (như Rating, EvaluationNote). Lưu và kiểm tra dữ liệu dòng đó trên bảng có cập nhật chuẩn không.
   - **Xóa mềm**: Bấm nút Xóa một nhà cung cấp -> Xác nhận qua hộp thoại confirm -> Sau khi đồng ý xóa, NCC đó biến mất khỏi danh sách (Backend đã set `IsDeleted = true` và query filter đã tự loại bỏ NCC đó khỏi kết quả truy vấn).
