import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { materialCategoryService } from '../../../../services/materialCategoryService';
import { Modal, Button, Input, FormItem } from '../../../../components/ui';
import type { MaterialCategory } from '../../../../types/materialCategory';

const categorySchema = z.object({
  categoryName: z.string().min(1, 'Tên danh mục không được để trống').max(100, 'Tên danh mục quá dài'),
  description: z.string().max(250, 'Mô tả quá dài').optional().or(z.literal('')),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: MaterialCategory | null;
  onSuccess: (message: string) => void;
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({ isOpen, onClose, category, onSuccess }) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      categoryName: '',
      description: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (category) {
        reset({ categoryName: category.categoryName, description: category.description || '' });
      } else {
        reset({ categoryName: '', description: '' });
      }
    }
  }, [isOpen, category, reset]);

  const mutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      // transform empty string to undefined for description if needed, or backend can handle it
      if (category) {
        return materialCategoryService.updateCategory(category.categoryId, data);
      } else {
        return materialCategoryService.createCategory(data);
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onSuccess(result.message || (category ? 'Cập nhật danh mục thành công.' : 'Thêm danh mục thành công.'));
      onClose();
    },
  });

  const onSubmit = (data: CategoryFormData) => {
    mutation.mutate(data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={category ? 'Chỉnh sửa Danh mục' : 'Thêm Danh mục mới'}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
          <Button variant="secondary" onClick={onClose} type="button">Hủy</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting || mutation.isPending}>
            {category ? 'Lưu thay đổi' : 'Thêm mới'}
          </Button>
        </div>
      }
    >
      <form id="category-form" onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {mutation.isError && (
          <div style={{ padding: '12px', fontSize: '0.875rem', color: 'hsl(var(--danger))', backgroundColor: 'hsl(var(--danger)/0.1)', borderRadius: '4px', border: '1px solid hsl(var(--danger)/0.2)' }}>
            {(mutation.error as any)?.message || 'Có lỗi xảy ra khi lưu danh mục.'}
          </div>
        )}

        <FormItem label="Tên Danh mục" required error={errors.categoryName?.message}>
          <Input
            {...register('categoryName')}
            placeholder="Ví dụ: Sắt thép, Xi măng, Cát đá..."
            disabled={isSubmitting || mutation.isPending}
          />
        </FormItem>

        <FormItem label="Mô tả" error={errors.description?.message}>
          <Input
            {...register('description')}
            placeholder="Mô tả ngắn gọn về danh mục này (không bắt buộc)..."
            disabled={isSubmitting || mutation.isPending}
          />
        </FormItem>
      </form>
    </Modal>
  );
};
