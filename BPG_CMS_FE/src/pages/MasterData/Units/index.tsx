import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { unitService } from '../../../services/unitService';
import { UnitFormModal } from './modals/UnitFormModal';
import { ConfirmDialog, Button, DataTable, Pagination, TableLoader } from '../../../components/ui';
import type { Unit } from '../../../types/unit';
import { Search, Plus, Edit2, Trash2, AlertCircle, Ruler } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { RoleGroup, hasAnyRole } from '../../../auth/roles';

export const UnitManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManageMasterData = hasAnyRole(user?.roles, RoleGroup.MasterData);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Modal control states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Message states
  const [error, setError] = useState<string | null>(null);

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
    toast.success(message);
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => unitService.deleteUnit(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setIsDeleteOpen(false);
      showSuccess(result.message || `Đã xóa đơn vị tính ${selectedUnit?.unitName} thành công.`);
      setSelectedUnit(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể xóa đơn vị tính.');
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
      key: 'isDiscrete',
      header: 'Loại Đơn vị',
      render: (unit: Unit) => (
        unit.isDiscrete ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Số nguyên</span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-600 border border-slate-500/20">Số thập phân</span>
        )
      ),
    },
    ...(canManageMasterData ? [{
      key: 'actions',
      header: 'Hành động',
      align: 'right' as const,
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
    }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
        {/* Filters & Actions bar */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="relative min-w-[280px] flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Tìm theo tên đơn vị..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {canManageMasterData && (
            <Button variant="primary" onClick={openCreateModal} className="h-10 font-semibold flex items-center gap-1.5">
              <Plus size={18} />
              <span>Thêm Đơn vị</span>
            </Button>
          )}
        </div>

        {isLoading ? (
          <TableLoader isTable={false} message="Đang tải dữ liệu đơn vị tính..." minHeight="200px" />
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
      </div>

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
