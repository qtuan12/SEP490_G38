import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supplierService } from '../../services/supplierService';
import { SupplierFormModal } from './modals/SupplierFormModal';
import { ConfirmDialog, Button, Select, Badge, DataTable, Pagination, LoadingSpinner } from '../../components/ui';
import type { Supplier } from '../../types/supplier';
import { useAuth } from '../../context/AuthContext';
import { RoleGroup } from '../../auth/roles';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Building2
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SupplierManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canManageSuppliers = hasAnyRole(RoleGroup.SupplierManagers);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Modal control states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Message states
  const [error, setError] = useState<string | null>(null);

  // Selected supplier for edit/delete
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Fetch suppliers query
  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['suppliers', page, searchTerm, statusFilter],
    queryFn: () =>
      supplierService.getSuppliers({
        pageNumber: page,
        pageSize: pageSize,
        search: searchTerm || undefined,
        collaborationStatus: statusFilter || undefined,
        sortBy: 'name',
      }),
  });

  const showSuccess = (message: string) => {
    console.log(message);
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => supplierService.deleteSupplier(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsDeleteOpen(false);
      showSuccess(result.message || `Đã xóa nhà cung cấp ${selectedSupplier?.supplierName} thành công.`);
      setSelectedSupplier(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể xóa nhà cung cấp.');
      setIsDeleteOpen(false);
    },
  });

  const handleDeleteConfirm = () => {
    if (selectedSupplier) {
      deleteMutation.mutate(selectedSupplier.supplierId);
    }
  };

  const openCreateModal = () => {
    if (!canManageSuppliers) return;
    setSelectedSupplier(null);
    setError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    if (!canManageSuppliers) return;
    setSelectedSupplier(supplier);
    setError(null);
    setIsFormOpen(true);
  };

  const openDeleteModal = (supplier: Supplier) => {
    if (!canManageSuppliers) return;
    setSelectedSupplier(supplier);
    setError(null);
    setIsDeleteOpen(true);
  };

  // Helper to draw stars
  const renderStars = (rating?: number) => {
    if (!rating) return <span className="text-[hsl(var(--text-muted))] text-xs font-normal">Chưa có đánh giá</span>;
    return (
      <span className="text-amber-500 font-semibold" title={`${rating}/5 sao`}>
        {'⭐'.repeat(Math.round(rating))} <span className="text-[11px] text-[hsl(var(--text-secondary))] ml-0.5">({rating})</span>
      </span>
    );
  };

  // DataTable columns
  const columns = [
    {
      key: 'supplierName',
      header: 'Tên nhà cung cấp',
      render: (supplier: Supplier) => (
        <div className="flex items-center gap-2">
          <div className="p-1 bg-[hsl(var(--primary-glow))] rounded-sm border border-[hsl(var(--border))]">
            <Building2 size={15} className="text-[hsl(var(--primary))]" />
          </div>
          <span className="font-semibold text-[hsl(var(--text-primary))]">{supplier.supplierName}</span>
        </div>
      ),
    },
    {
      key: 'contactInfo',
      header: 'Thông tin liên hệ',
      render: (supplier: Supplier) => (
        <span className="text-[hsl(var(--text-secondary))] block max-w-[180px] whitespace-normal break-words" title={supplier.contactInfo}>
          {supplier.contactInfo || '-'}
        </span>
      ),
    },
    {
      key: 'address',
      header: 'Địa chỉ',
      render: (supplier: Supplier) => (
        <span className="text-[hsl(var(--text-secondary))] block max-w-[200px] whitespace-normal break-words" title={supplier.address}>
          {supplier.address || '-'}
        </span>
      ),
    },
    {
      key: 'serviceArea',
      header: 'Khu vực phục vụ',
      render: (supplier: Supplier) => (
        <span className="text-[hsl(var(--text-secondary))]" title={supplier.serviceArea}>
          {supplier.serviceArea || '-'}
        </span>
      ),
    },
    {
      key: 'rating',
      header: 'Đánh giá',
      render: (supplier: Supplier) => renderStars(supplier.rating),
    },
    {
      key: 'evaluationNote',
      header: 'Ghi chú đánh giá',
      render: (supplier: Supplier) => (
        <span className="text-[hsl(var(--text-secondary))] block max-w-[220px] whitespace-normal break-words italic text-xs" title={supplier.evaluationNote}>
          {supplier.evaluationNote || '-'}
        </span>
      ),
    },
    {
      key: 'collaborationStatus',
      header: 'Trạng thái',
      render: (supplier: Supplier) => (
        <Badge
          variant={supplier.collaborationStatus === 'Active' ? 'success' : 'danger'}
          className="normal-case font-medium"
        >
          {supplier.collaborationStatus === 'Active' ? 'Đang hoạt động' : 'Tạm ngưng'}
        </Badge>
      ),
    },
    ...(canManageSuppliers ? [{
      key: 'actions',
      header: 'Hành động',
      render: (supplier: Supplier) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            className="p-2 h-auto"
            title="Chỉnh sửa thông tin"
            onClick={() => openEditModal(supplier)}
          >
            <Edit2 size={15} className="text-[hsl(var(--primary-hover))]" />
          </Button>
          <Button
            variant="secondary"
            className="p-2 h-auto"
            title="Xóa nhà cung cấp"
            onClick={() => openDeleteModal(supplier)}
          >
            <Trash2 size={15} className="text-[hsl(var(--danger))]" />
          </Button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {(error || isError) && (
        <div className="flex items-center gap-2.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.3)] rounded-sm py-3 px-4 text-[hsl(346_84%_35%)] text-sm font-medium animate-fade-in">
          <AlertCircle size={18} className="text-[hsl(var(--danger))] shrink-0" />
          <span>{error || (queryError as any)?.message || 'Không thể tải danh sách nhà cung cấp.'}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto bg-transparent border-none text-inherit cursor-pointer opacity-70 hover:opacity-100 text-lg"
          >
            &times;
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
        {/* Filters & Actions bar */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-grow max-w-xl">
            <div className="relative flex-grow">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên, liên hệ, khu vực..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-48 shrink-0">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-10"
                options={[
                  { label: 'Tất cả trạng thái', value: '' },
                  { label: 'Đang hoạt động', value: 'Active' },
                  { label: 'Tạm ngưng', value: 'Inactive' },
                ]}
              />
            </div>
          </div>

          {canManageSuppliers && (
            <Button variant="primary" onClick={openCreateModal} className="h-10 font-semibold flex items-center gap-1.5">
              <Plus size={18} />
              <span>Thêm Nhà cung cấp</span>
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-[240px]">
            <LoadingSpinner size="lg" label="Đang tải dữ liệu nhà cung cấp..." />
          </div>
        ) : (
          <div className="animate-fade-in flex flex-col gap-4">
            <DataTable
              columns={columns}
              data={data?.items || []}
              keyExtractor={(item) => item.supplierId.toString()}
              emptyMessage="Không tìm thấy nhà cung cấp nào phù hợp."
            />

            {data && data.totalCount > 0 && (
              <Pagination
                currentPage={page}
                totalPages={data.totalPages}
                onPageChange={(p) => setPage(p)}
              />
            )}
          </div>
        )}
      </div>

      {canManageSuppliers && (
        <>
          {/* Supplier Create/Edit Modal */}
          <SupplierFormModal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            supplier={selectedSupplier}
            onSuccess={showSuccess}
          />

          {/* Soft Delete Confirmation Modal */}
          <ConfirmDialog
            isOpen={isDeleteOpen}
            onClose={() => setIsDeleteOpen(false)}
            onConfirm={handleDeleteConfirm}
            title="Xóa nhà cung cấp"
            message={`Bạn có chắc chắn muốn xóa nhà cung cấp ${selectedSupplier?.supplierName || ''}? Hệ thống sẽ lưu trữ và ẩn nhà cung cấp này khỏi các giao dịch mới.`}
            confirmText="Xác nhận xóa"
          />
        </>
      )}
    </div>
  );
};
