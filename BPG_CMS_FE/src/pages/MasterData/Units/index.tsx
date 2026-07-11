import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { unitService } from '../../../services/unitService';
import { UnitFormModal } from './modals/UnitFormModal';
import { ConfirmDialog, Button, Input, DataTable, Pagination } from '../../../components/ui';
import type { Unit } from '../../../types/unit';
import { Search, Plus, Edit2, Trash2, AlertCircle, Loader2, CheckCircle2, Ruler } from 'lucide-react';

export const UnitManagement: React.FC = () => {
  const queryClient = useQueryClient();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Modal control states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Message states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selected unit for edit/delete
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // Fetch queries
  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['units', page, searchTerm],
    queryFn: () =>
      unitService.getUnits({
        pageNumber: page,
        pageSize: pageSize,
        search: searchTerm || undefined,
      }),
  });

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await unitService.deleteUnit(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setIsDeleteOpen(false);
      showSuccess(`Đã xóa đơn vị tính ${selectedUnit?.unitName} thành công.`);
      setSelectedUnit(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Không thể xóa đơn vị tính.');
      setIsDeleteOpen(false);
    },
  });

  const handleDeleteConfirm = () => {
    if (selectedUnit) {
      deleteMutation.mutate(selectedUnit.unitId);
    }
  };

  const openCreateModal = () => {
    setSelectedUnit(null);
    setError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (unit: Unit) => {
    setSelectedUnit(unit);
    setError(null);
    setIsFormOpen(true);
  };

  const openDeleteModal = (unit: Unit) => {
    setSelectedUnit(unit);
    setError(null);
    setIsDeleteOpen(true);
  };

  const columns = [
    {
      key: 'unitId',
      header: 'ID',
      render: (unit: Unit) => (
        <span className="text-[hsl(var(--text-secondary))] font-mono">#{unit.unitId}</span>
      ),
    },
    {
      key: 'unitCode',
      header: 'Mã Đơn vị',
      render: (unit: Unit) => (
        <span className="text-[hsl(var(--text-secondary))] font-medium">{unit.unitCode}</span>
      ),
    },
    {
      key: 'unitName',
      header: 'Tên Đơn vị tính',
      render: (unit: Unit) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[hsl(var(--primary-glow))] rounded border border-solid border-[hsl(var(--border))]">
            <Ruler size={14} className="text-[hsl(var(--primary))]" />
          </div>
          <span className="font-semibold text-[hsl(var(--text-primary))]">{unit.unitName}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      render: (unit: Unit) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            title="Chỉnh sửa đơn vị tính"
            onClick={() => openEditModal(unit)}
            className="p-2 h-auto"
          >
            <Edit2 size={15} className="text-[hsl(var(--primary-hover))]" />
          </Button>
          <Button
            variant="secondary"
            title="Xóa đơn vị tính"
            onClick={() => openDeleteModal(unit)}
            className="p-2 h-auto"
          >
            <Trash2 size={15} className="text-[hsl(var(--danger))]" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))] m-0">Quản lý Đơn vị tính</h1>
          <p className="text-xs text-[hsl(var(--text-secondary))] mt-1 m-0">Cấu hình các đơn vị đo lường sử dụng trong hệ thống</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2.5 bg-[hsl(var(--success-glow))] border border-solid border-[hsl(var(--success))]/0.3 rounded px-4 py-3 text-emerald-800 text-sm font-medium">
          <CheckCircle2 size={18} className="text-[hsl(var(--success))] shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {(error || isError) && (
        <div className="flex items-center gap-2.5 bg-[hsl(var(--danger-glow))] border border-solid border-[hsl(var(--danger))]/0.3 rounded px-4 py-3 text-rose-800 text-sm font-medium">
          <AlertCircle size={18} className="text-[hsl(var(--danger))] shrink-0" />
          <span>{error || (queryError as any)?.message || 'Không thể tải danh sách đơn vị tính.'}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto bg-transparent border-none text-inherit cursor-pointer text-lg opacity-70"
          >
            &times;
          </button>
        </div>
      )}

      <div className="glass-panel p-5 flex justify-between items-center flex-wrap gap-4">
        <div className="relative min-w-[280px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" style={{ pointerEvents: 'none' }} />
          <Input
            type="text"
            placeholder="Tìm theo tên đơn vị..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-10 w-full"
          />
        </div>

        <Button variant="primary" onClick={openCreateModal} className="h-10 font-semibold">
          <Plus size={18} className="mr-1" />
          <span>Thêm Đơn vị</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-[250px] gap-2.5">
          <Loader2 className="animate-spin text-[hsl(var(--primary))]" size={24} />
          <span className="text-[hsl(var(--text-secondary))] font-medium">Đang tải dữ liệu...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable
            columns={columns}
            data={data?.items || []}
            keyExtractor={(item) => item.unitId.toString()}
            emptyMessage="Không tìm thấy đơn vị tính nào."
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

      <UnitFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        unit={selectedUnit}
        onSuccess={showSuccess}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Xóa đơn vị tính"
        message={`Bạn có chắc chắn muốn xóa đơn vị tính "${selectedUnit?.unitName}"? Đơn vị tính chỉ có thể xóa nếu chưa được sử dụng trong giao dịch nào.`}
        confirmText="Xác nhận xóa"
      />
    </div>
  );
};
