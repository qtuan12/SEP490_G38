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
        <span style={{ color: 'hsl(var(--text-secondary))', fontFamily: 'monospace' }}>#{cat.categoryId}</span>
      ),
    },
    {
      key: 'categoryName',
      header: 'Tên Danh mục',
      render: (cat: MaterialCategory) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '6px', backgroundColor: 'hsl(var(--primary-glow))', borderRadius: '4px', border: '1px solid hsl(var(--border))' }}>
            <Tags size={14} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{cat.categoryName}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      render: (cat: MaterialCategory) => (
        <span style={{ color: 'hsl(var(--text-secondary))' }}>{cat.description || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      render: (cat: MaterialCategory) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            title="Chỉnh sửa danh mục"
            onClick={() => openEditModal(cat)}
            style={{ padding: '8px', height: 'auto' }}
          >
            <Edit2 size={15} style={{ color: 'hsl(var(--primary-hover))' }} />
          </Button>
          <Button
            variant="secondary"
            title="Xóa danh mục"
            onClick={() => openDeleteModal(cat)}
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'hsl(var(--text-primary))', margin: 0 }}>Danh mục Vật tư</h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem', marginTop: '4px' }}>Quản lý các nhóm danh mục phân loại vật tư</p>
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
          <span>{error || (queryError as any)?.message || 'Không thể tải danh sách danh mục.'}</span>
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
            placeholder="Tìm theo tên danh mục..."
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
          <span>Thêm Danh mục</span>
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
