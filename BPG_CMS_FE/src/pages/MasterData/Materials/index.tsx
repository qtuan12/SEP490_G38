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
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[hsl(var(--primary-glow))] rounded border border-solid border-[hsl(var(--border))]">
            <Package size={14} className="text-[hsl(var(--primary))]" />
          </div>
          <span className="font-semibold text-[hsl(var(--text-primary))]">{m.code}</span>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Tên Vật tư',
      render: (m: MaterialCatalog) => <span className="font-medium">{m.name}</span>,
    },
    {
      key: 'categoryName',
      header: 'Danh mục',
      render: (m: MaterialCatalog) => <span className="text-[hsl(var(--text-secondary))]">{m.categoryName}</span>,
    },
    {
      key: 'baseUnitName',
      header: 'ĐVT Gốc',
      render: (m: MaterialCatalog) => <span className="text-[hsl(var(--primary))] font-semibold">{m.baseUnitName}</span>,
    },
    {
      key: 'specification',
      header: 'Quy cách',
      render: (m: MaterialCatalog) => <span className="text-[hsl(var(--text-secondary))] text-xs">{m.specification || '-'}</span>,
    },
    {
      key: 'actions',
      header: 'Hành động',
      render: (m: MaterialCatalog) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            title="Quy đổi đơn vị"
            onClick={() => openConversionDrawer(m)}
            className="px-3 py-1.5 h-auto bg-[hsl(var(--success-glow))] text-emerald-800 border border-solid border-[hsl(var(--success))]/0.3"
          >
            <ArrowRightLeft size={14} className="mr-1" /> Quy đổi
          </Button>
          <Button variant="secondary" title="Chỉnh sửa" onClick={() => openEditModal(m)} className="p-2 h-auto">
            <Edit2 size={15} className="text-[hsl(var(--primary-hover))]" />
          </Button>
          <Button variant="secondary" title="Xóa" onClick={() => openDeleteModal(m)} className="p-2 h-auto">
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
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))] m-0">Danh mục Vật tư</h1>
          <p className="text-xs text-[hsl(var(--text-secondary))] mt-1 m-0">Quản lý danh sách vật tư chuẩn và tỷ lệ quy đổi</p>
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
          <span>{error || (queryError as any)?.message || 'Không thể tải danh sách vật tư.'}</span>
          <button onClick={() => setError(null)} className="ml-auto bg-transparent border-none text-inherit cursor-pointer text-lg opacity-70">&times;</button>
        </div>
      )}

      <div className="glass-panel p-5 flex justify-between items-center flex-wrap gap-4">
        <div className="flex gap-3 flex-1 min-w-[280px] flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" style={{ pointerEvents: 'none' }} />
            <Input
              type="text"
              placeholder="Tìm theo mã hoặc tên..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="pl-9 h-10 w-full"
            />
          </div>
          <Select
            options={categoryOptions}
            value={categoryIdFilter?.toString() || ''}
            onChange={(e) => { setCategoryIdFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
            className="w-[200px] h-10"
          />
        </div>

        <Button variant="primary" onClick={openCreateModal} className="h-10 font-semibold">
          <Plus size={18} className="mr-1" />
          <span>Thêm Vật tư</span>
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
