import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialService } from '../../../services/materialService';
import { materialCategoryService } from '../../../services/materialCategoryService';
import { MaterialFormModal } from './modals/MaterialFormModal';
import { MaterialConversionDrawer } from './drawers/MaterialConversionDrawer';
import { ConfirmDialog, Button, Input, Select, DataTable, Pagination } from '../../../components/ui';
import type { MaterialCatalog } from '../../../types/material';
import { Search, Plus, Edit2, Trash2, AlertCircle, Loader2, CheckCircle2, Package, ArrowRightLeft } from 'lucide-react';

export const MaterialManagement: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryIdFilter, setCategoryIdFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isConversionOpen, setIsConversionOpen] = useState(false);

  // State
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialCatalog | null>(null);

  // Categories Dropdown
  const { data: categoriesData } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => materialCategoryService.getCategories({ pageNumber: 1, pageSize: 1000 }),
  });

  // Fetch Materials
  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['materials', page, searchTerm, categoryIdFilter],
    queryFn: () =>
      materialService.getMaterials({
        pageNumber: page,
        pageSize: pageSize,
        search: searchTerm || undefined,
        categoryId: categoryIdFilter,
      }),
  });

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => materialService.deleteMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setIsDeleteOpen(false);
      showSuccess(`Đã xóa vật tư ${selectedMaterial?.name} thành công.`);
      setSelectedMaterial(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Không thể xóa vật tư.');
      setIsDeleteOpen(false);
    },
  });

  const handleDeleteConfirm = () => {
    if (selectedMaterial) deleteMutation.mutate(selectedMaterial.materialId);
  };

  const openCreateModal = () => { setSelectedMaterial(null); setError(null); setIsFormOpen(true); };
  const openEditModal = (material: MaterialCatalog) => { setSelectedMaterial(material); setError(null); setIsFormOpen(true); };
  const openDeleteModal = (material: MaterialCatalog) => { setSelectedMaterial(material); setError(null); setIsDeleteOpen(true); };
  const openConversionDrawer = (material: MaterialCatalog) => { setSelectedMaterial(material); setError(null); setIsConversionOpen(true); };

  const categoryOptions = [
    { label: 'Tất cả danh mục', value: '' },
    ...(categoriesData?.items.map(c => ({ label: c.categoryName, value: c.categoryId.toString() })) || [])
  ];

  const columns = [
    {
      key: 'code',
      header: 'Mã Vật tư',
      render: (m: MaterialCatalog) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '6px', backgroundColor: 'hsl(var(--primary-glow))', borderRadius: '4px', border: '1px solid hsl(var(--border))' }}>
            <Package size={14} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{m.code}</span>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Tên Vật tư',
      render: (m: MaterialCatalog) => <span style={{ fontWeight: 500 }}>{m.name}</span>,
    },
    {
      key: 'categoryName',
      header: 'Danh mục',
      render: (m: MaterialCatalog) => <span style={{ color: 'hsl(var(--text-secondary))' }}>{m.categoryName}</span>,
    },
    {
      key: 'baseUnitName',
      header: 'ĐVT Gốc',
      render: (m: MaterialCatalog) => <span style={{ color: 'hsl(var(--primary))', fontWeight: 600 }}>{m.baseUnitName}</span>,
    },
    {
      key: 'specification',
      header: 'Quy cách',
      render: (m: MaterialCatalog) => <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>{m.specification || '-'}</span>,
    },
    {
      key: 'actions',
      header: 'Hành động',
      render: (m: MaterialCatalog) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            title="Quy đổi đơn vị"
            onClick={() => openConversionDrawer(m)}
            style={{ padding: '6px 12px', height: 'auto', backgroundColor: 'hsl(var(--success-glow))', color: 'hsl(142_70%_35%)', borderColor: 'hsl(var(--success)/0.3)' }}
          >
            <ArrowRightLeft size={14} style={{ marginRight: '4px' }} /> Quy đổi
          </Button>
          <Button variant="secondary" title="Chỉnh sửa" onClick={() => openEditModal(m)} style={{ padding: '8px', height: 'auto' }}>
            <Edit2 size={15} style={{ color: 'hsl(var(--primary-hover))' }} />
          </Button>
          <Button variant="secondary" title="Xóa" onClick={() => openDeleteModal(m)} style={{ padding: '8px', height: 'auto' }}>
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'hsl(var(--text-primary))', margin: 0 }}>Danh mục Vật tư</h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem', marginTop: '4px' }}>Quản lý danh sách vật tư chuẩn và tỷ lệ quy đổi</p>
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
          <span>{error || (queryError as any)?.message || 'Không thể tải danh sách vật tư.'}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.125rem', opacity: 0.7 }}>&times;</button>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <Input
              type="text"
              placeholder="Tìm theo mã hoặc tên..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              style={{ paddingLeft: '36px', height: '40px', width: '100%' }}
            />
          </div>
          <Select
            options={categoryOptions}
            value={categoryIdFilter?.toString() || ''}
            onChange={(e) => { setCategoryIdFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
            style={{ width: '200px', height: '40px' }}
          />
        </div>

        <Button variant="primary" onClick={openCreateModal} style={{ height: '40px', fontWeight: 600 }}>
          <Plus size={18} style={{ marginRight: '4px' }} />
          <span>Thêm Vật tư</span>
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
            keyExtractor={(item) => item.materialId.toString()}
            emptyMessage="Không tìm thấy vật tư nào."
          />

          {data && data.totalCount > 0 && (
            <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage} />
          )}
        </div>
      )}

      <MaterialFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} material={selectedMaterial} onSuccess={showSuccess} />
      <MaterialConversionDrawer isOpen={isConversionOpen} onClose={() => setIsConversionOpen(false)} material={selectedMaterial} onSuccess={showSuccess} />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Xóa Vật tư"
        message={`Bạn có chắc chắn muốn xóa vật tư "${selectedMaterial?.name}"? Các tỷ lệ quy đổi đi kèm cũng sẽ bị mất. Vật tư chỉ được xóa nếu chưa được sử dụng ở kho hoặc hóa đơn.`}
        confirmText="Xác nhận xóa"
      />
    </div>
  );
};
