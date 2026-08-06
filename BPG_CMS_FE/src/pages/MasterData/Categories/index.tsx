import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialCategoryService } from '../../../services/materialCategoryService';
import { CategoryFormModal } from './modals/CategoryFormModal';
import { ConfirmDialog, Button, DataTable, Pagination, TableLoader } from '../../../components/ui';
import type { MaterialCategory } from '../../../types/materialCategory';
import { Search, Plus, Edit2, Trash2, AlertCircle, Tags } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { RoleGroup, hasAnyRole } from '../../../auth/roles';

export const CategoryManagement: React.FC = () => {
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
    console.log(message);
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => materialCategoryService.deleteCategory(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsDeleteOpen(false);
      showSuccess(result.message || `Đã xóa danh mục ${selectedCategory?.categoryName} thành công.`);
      setSelectedCategory(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể xóa danh mục.');
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
    ...(canManageMasterData ? [{
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
    }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
        {/* Filters & Actions bar */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="relative min-w-[280px] flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Tìm theo tên danh mục..."
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
              <span>Thêm Loại vật tư</span>
            </Button>
          )}
        </div>

        {isLoading ? (
          <TableLoader isTable={false} message="Đang tải dữ liệu danh mục..." minHeight="200px" />
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
      </div>

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
