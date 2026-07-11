import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { materialService } from '../../../../services/materialService';
import { unitService } from '../../../../services/unitService';
import { materialCategoryService } from '../../../../services/materialCategoryService';
import { Modal, Button, Input, FormItem, SearchSelect } from '../../../../components/ui';
import type { MaterialCatalog } from '../../../../types/material';

const materialSchema = z.object({
  code: z.string().min(1, 'Mã vật tư không được để trống').max(50, 'Mã vật tư quá dài'),
  name: z.string().min(1, 'Tên vật tư không được để trống').max(200, 'Tên vật tư quá dài'),
  categoryId: z.number().min(1, 'Vui lòng chọn danh mục'),
  baseUnitId: z.number().min(1, 'Vui lòng chọn đơn vị cơ sở'),
  specification: z.string().max(500, 'Quy cách quá dài').optional().or(z.literal('')),
});

type MaterialFormData = z.infer<typeof materialSchema>;

interface MaterialFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: MaterialCatalog | null;
  onSuccess: (message: string) => void;
}

export const MaterialFormModal: React.FC<MaterialFormModalProps> = ({ isOpen, onClose, material, onSuccess }) => {
  const queryClient = useQueryClient();

  // Load dropdown data (we can use page 1, size 1000 for simplicity in master data)
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => materialCategoryService.getCategories({ pageNumber: 1, pageSize: 1000 }),
    enabled: isOpen,
  });

  const { data: unitsData, isLoading: isLoadingUnits } = useQuery({
    queryKey: ['units', 'all'],
    queryFn: () => unitService.getUnits({ pageNumber: 1, pageSize: 1000 }),
    enabled: isOpen,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      code: '',
      name: '',
      categoryId: 0,
      baseUnitId: 0,
      specification: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (material) {
        reset({
          code: material.code,
          name: material.name,
          categoryId: material.categoryId,
          baseUnitId: material.baseUnitId,
          specification: material.specification || '',
        });
      } else {
        reset({
          code: '',
          name: '',
          categoryId: 0,
          baseUnitId: 0,
          specification: '',
        });
      }
    }
  }, [isOpen, material, reset]);

  const mutation = useMutation({
    mutationFn: async (data: MaterialFormData) => {
      if (material) {
        return materialService.updateMaterial(material.materialId, data);
      } else {
        return materialService.createMaterial(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      onSuccess(material ? 'Cập nhật vật tư thành công.' : 'Thêm vật tư thành công.');
      onClose();
    },
  });

  const onSubmit = (data: MaterialFormData) => {
    mutation.mutate(data);
  };



  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={material ? 'Chỉnh sửa Vật tư' : 'Thêm Vật tư mới'}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
          <Button variant="secondary" onClick={onClose} type="button">Hủy</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting || mutation.isPending}>
            {material ? 'Lưu thay đổi' : 'Thêm mới'}
          </Button>
        </div>
      }
    >
      <form id="material-form" onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {mutation.isError && (
          <div style={{ padding: '12px', fontSize: '0.875rem', color: 'hsl(var(--danger))', backgroundColor: 'hsl(var(--danger)/0.1)', borderRadius: '4px', border: '1px solid hsl(var(--danger)/0.2)' }}>
            {(mutation.error as any)?.message || 'Có lỗi xảy ra khi lưu vật tư.'}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormItem label="Mã Vật tư" required error={errors.code?.message}>
            <Input
              {...register('code')}
              placeholder="VD: THEP-D10..."
              disabled={isSubmitting || mutation.isPending || !!material}
            />
          </FormItem>

          <FormItem label="Tên Vật tư" required error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder="VD: Thép vằn D10..."
              disabled={isSubmitting || mutation.isPending}
            />
          </FormItem>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormItem label="Danh mục" required error={errors.categoryId?.message}>
            <SearchSelect
              options={categoriesData?.items.map(c => ({ label: c.categoryName, value: c.categoryId.toString() })) || []}
              value={watch('categoryId')?.toString() || ''}
              onChange={(val) => setValue('categoryId', Number(val) || 0, { shouldValidate: true })}
              disabled={isLoadingCategories || isSubmitting || mutation.isPending}
              placeholder="-- Chọn danh mục --"
              error={!!errors.categoryId}
            />
          </FormItem>

          <FormItem label="Đơn vị cơ sở" required error={errors.baseUnitId?.message}>
            <SearchSelect
              options={unitsData?.items.map(u => ({ label: `${u.unitName} (${u.unitCode})`, value: u.unitId.toString() })) || []}
              value={watch('baseUnitId')?.toString() || ''}
              onChange={(val) => setValue('baseUnitId', Number(val) || 0, { shouldValidate: true })}
              disabled={isLoadingUnits || isSubmitting || mutation.isPending || !!material} // Không nên đổi đơn vị cơ sở sau khi tạo
              placeholder="-- Chọn đơn vị cơ sở --"
              error={!!errors.baseUnitId}
            />
          </FormItem>
        </div>

        <FormItem label="Quy cách / Ghi chú" error={errors.specification?.message}>
          <Input
            {...register('specification')}
            placeholder="Kích thước, tiêu chuẩn kỹ thuật..."
            disabled={isSubmitting || mutation.isPending}
          />
        </FormItem>
      </form>
    </Modal>
  );
};
