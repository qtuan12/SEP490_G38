import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialCategoryService } from '../../../services/materialCategoryService';
import { CategoryFormModal } from './modals/CategoryFormModal';
import { ConfirmDialog, Button, Input, DataTable, Pagination } from '../../../components/ui';
import type { MaterialCategory } from '../../../types/materialCategory';
import { Search, Plus, Edit2, Trash2, AlertCircle, Loader2, CheckCircle2, Tags } from 'lucide-react';

export const CategoryManagement: React.FC = () => {
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

  // Selected category for edit/delete
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | null>(null);

  // Fetch queries
  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['categories', page, searchTerm],
    queryFn: () =>
      materialCategoryService.getCategories({
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
      await materialCategoryService.deleteCategory(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsDeleteOpen(false);
      showSuccess(`Đã xóa danh mục ${selectedCategory?.categoryName} thành công.`);
      setSelectedCategory(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Không thể xóa danh mục.');
      setIsDeleteOpen(false);
    },
  });

  const handleDeleteConfirm = () => {
    if (selectedCategory) {
      deleteMutation.mutate(selectedCategory.categoryId);
    }
  };

  const openCreateModal = () => {
    setSelectedCategory(null);
    setError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (category: MaterialCategory) => {
    setSelectedCategory(category);
    setError(null);
    setIsFormOpen(true);
  };

  const openDeleteModal = (category: MaterialCategory) => {
    setSelectedCategory(category);
    setError(null);
    setIsDeleteOpen(true);
  };

  const columns = [
    {
      key: 'categoryId',
      header: 'ID',
      render: (cat: MaterialCategory) => (
        <span className="text-[hsl(var(--text-secondary))] font-mono">#{cat.categoryId}</span>
      ),
    },
    {
      key: 'categoryName',
      header: 'Tên Danh mục',
      render: (cat: MaterialCategory) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[hsl(var(--primary-glow))] rounded border border-solid border-[hsl(var(--border))]">
            <Tags size={14} className="text-[hsl(var(--primary))]" />
          </div>
          <span className="font-semibold text-[hsl(var(--text-primary))]">{cat.categoryName}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      render: (cat: MaterialCategory) => (
        <span className="text-[hsl(var(--text-secondary))]">{cat.description || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      render: (cat: MaterialCategory) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            title="Chỉnh sửa danh mục"
            onClick={() => openEditModal(cat)}
            className="p-2 h-auto"
          >
            <Edit2 size={15} className="text-[hsl(var(--primary-hover))]" />
          </Button>
          <Button
            variant="secondary"
            title="Xóa danh mục"
            onClick={() => openDeleteModal(cat)}
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
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))] m-0">Danh mục Vật tư</h1>
          <p className="text-xs text-[hsl(var(--text-secondary))] mt-1 m-0">Quản lý các nhóm danh mục phân loại vật tư</p>
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
          <span>{error || (queryError as any)?.message || 'Không thể tải danh sách danh mục.'}</span>
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
            placeholder="Tìm theo tên danh mục..."
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
          <span>Thêm Danh mục</span>
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
            keyExtractor={(item) => item.categoryId.toString()}
            emptyMessage="Không tìm thấy danh mục nào."
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

      <CategoryFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        category={selectedCategory}
        onSuccess={showSuccess}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Xóa Danh mục"
        message={`Bạn có chắc chắn muốn xóa danh mục "${selectedCategory?.categoryName}"? Danh mục chỉ có thể xóa nếu chưa có vật tư nào trực thuộc.`}
        confirmText="Xác nhận xóa"
      />
    </div>
  );
};
