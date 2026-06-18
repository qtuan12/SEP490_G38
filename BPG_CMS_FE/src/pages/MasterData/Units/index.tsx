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
        <span style={{ color: 'hsl(var(--text-secondary))', fontFamily: 'monospace' }}>#{unit.unitId}</span>
      ),
    },
    {
      key: 'unitCode',
      header: 'Mã Đơn vị',
      render: (unit: Unit) => (
        <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>{unit.unitCode}</span>
      ),
    },
    {
      key: 'unitName',
      header: 'Tên Đơn vị tính',
      render: (unit: Unit) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '6px', backgroundColor: 'hsl(var(--primary-glow))', borderRadius: '4px', border: '1px solid hsl(var(--border))' }}>
            <Ruler size={14} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{unit.unitName}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      render: (unit: Unit) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            title="Chỉnh sửa đơn vị tính"
            onClick={() => openEditModal(unit)}
            style={{ padding: '8px', height: 'auto' }}
          >
            <Edit2 size={15} style={{ color: 'hsl(var(--primary-hover))' }} />
          </Button>
          <Button
            variant="secondary"
            title="Xóa đơn vị tính"
            onClick={() => openDeleteModal(unit)}
            style={{ padding: '8px', height: 'auto' }}
          >
            <Trash2 size={15} style={{ color: 'hsl(var(--danger))' }} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'hsl(var(--text-primary))', margin: 0 }}>Quản lý Đơn vị tính</h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem', marginTop: '4px' }}>Cấu hình các đơn vị đo lường sử dụng trong hệ thống</p>
        </div>
      </div>

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'hsl(var(--success-glow))', border: '1px solid hsl(var(--success)/0.3)', borderRadius: '4px', padding: '12px 16px', color: 'hsl(142_70%_35%)', fontSize: '0.875rem', fontWeight: 500 }}>
          <CheckCircle2 size={18} style={{ color: 'hsl(var(--success))', flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      {(error || isError) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger)/0.3)', borderRadius: '4px', padding: '12px 16px', color: 'hsl(346_84%_35%)', fontSize: '0.875rem', fontWeight: 500 }}>
          <AlertCircle size={18} style={{ color: 'hsl(var(--danger))', flexShrink: 0 }} />
          <span>{error || (queryError as any)?.message || 'Không thể tải danh sách đơn vị tính.'}</span>
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.125rem', opacity: 0.7 }}
          >
            &times;
          </button>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ position: 'relative', minWidth: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <Input
            type="text"
            placeholder="Tìm theo tên đơn vị..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '36px', height: '40px', width: '100%' }}
          />
        </div>

        <Button variant="primary" onClick={openCreateModal} style={{ height: '40px', fontWeight: 600 }}>
          <Plus size={18} style={{ marginRight: '4px' }} />
          <span>Thêm Đơn vị</span>
        </Button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px', gap: '10px' }}>
          <Loader2 className="animate-spin" style={{ color: 'hsl(var(--primary))' }} size={24} />
          <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>Đang tải dữ liệu...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <DataTable
            columns={columns}
            data={data?.items || []}
            keyExtractor={(item) => item.unitId.toString()}
            emptyMessage="Không tìm thấy đơn vị tính nào."
          />

          {data && data.totalCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Pagination
                currentPage={page}
                totalPages={data.totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
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
