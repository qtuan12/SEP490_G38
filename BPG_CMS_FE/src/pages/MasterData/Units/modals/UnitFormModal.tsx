import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unitService } from '../../../../services/unitService';
import { Modal, Button, Input, FormItem } from '../../../../components/ui';
import type { Unit } from '../../../../types/unit';

const unitSchema = z.object({
  unitCode: z.string().min(1, 'Mã đơn vị không được để trống').max(20, 'Mã đơn vị quá dài'),
  unitName: z.string().min(1, 'Tên đơn vị không được để trống').max(50, 'Tên đơn vị quá dài'),
});

type UnitFormData = z.infer<typeof unitSchema>;

interface UnitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: Unit | null;
  onSuccess: (message: string) => void;
}

export const UnitFormModal: React.FC<UnitFormModalProps> = ({ isOpen, onClose, unit, onSuccess }) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      unitCode: '',
      unitName: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (unit) {
        reset({ unitCode: unit.unitCode, unitName: unit.unitName });
      } else {
        reset({ unitCode: '', unitName: '' });
      }
    }
  }, [isOpen, unit, reset]);

  const mutation = useMutation({
    mutationFn: async (data: UnitFormData) => {
      if (unit) {
        return unitService.updateUnit(unit.unitId, data);
      } else {
        return unitService.createUnit(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      onSuccess(unit ? 'Cập nhật đơn vị tính thành công.' : 'Thêm đơn vị tính thành công.');
      onClose();
    },
  });

  const onSubmit = (data: UnitFormData) => {
    mutation.mutate(data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={unit ? 'Chỉnh sửa đơn vị tính' : 'Thêm đơn vị tính mới'}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
          <Button variant="secondary" onClick={onClose} type="button">Hủy</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting || mutation.isPending}>
            {unit ? 'Lưu thay đổi' : 'Thêm mới'}
          </Button>
        </div>
      }
    >
      <form id="unit-form" onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {mutation.isError && (
          <div style={{ padding: '12px', fontSize: '0.875rem', color: 'hsl(var(--danger))', backgroundColor: 'hsl(var(--danger)/0.1)', borderRadius: '4px', border: '1px solid hsl(var(--danger)/0.2)' }}>
            {(mutation.error as any)?.message || 'Có lỗi xảy ra khi lưu đơn vị tính.'}
          </div>
        )}

        <FormItem label="Mã đơn vị tính" required error={errors.unitCode?.message}>
          <Input
            {...register('unitCode')}
            placeholder="Ví dụ: KG, TAN, M..."
            disabled={isSubmitting || mutation.isPending || !!unit}
          />
        </FormItem>

        <FormItem label="Tên đơn vị tính" required error={errors.unitName?.message}>
          <Input
            {...register('unitName')}
            placeholder="Ví dụ: Kilôgam, Tấn, Mét..."
            disabled={isSubmitting || mutation.isPending}
          />
        </FormItem>
      </form>
    </Modal>
  );
};
