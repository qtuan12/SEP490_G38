import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, Input, Select, Textarea, FormItem } from '../../../components/ui';
import { supplierService } from '../../../services/supplierService';
import type { Supplier } from '../../../types/supplier';
import { useLoading } from '../../../context/LoadingContext';

const schema = z.object({
  supplierName: z.string()
    .trim()
    .min(1, 'Tên nhà cung cấp không được để trống hoặc chỉ chứa khoảng trắng.')
    .max(200, 'Tên nhà cung cấp không được vượt quá 200 ký tự.'),
  contactInfo: z.string().trim().max(500, 'Thông tin liên hệ không được vượt quá 500 ký tự.').optional().or(z.literal('')),
  address: z.string().trim().max(500, 'Địa chỉ không được vượt quá 500 ký tự.').optional().or(z.literal('')),
  serviceArea: z.string().trim().max(200, 'Khu vực phục vụ không được vượt quá 200 ký tự.').optional().or(z.literal('')),
  rating: z.string().optional().or(z.literal('')),
  evaluationNote: z.string().trim().max(1000, 'Ghi chú đánh giá không được vượt quá 1000 ký tự.').optional().or(z.literal('')),
  collaborationStatus: z.enum(['Strategic', 'Regular', 'Restricted', 'Blacklisted']).default('Regular'),
});

type SupplierFormData = z.infer<typeof schema>;

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onSuccess: (msg: string) => void;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onSuccess,
}) => {
  const { withLoading } = useLoading();
  const queryClient = useQueryClient();
  const isEdit = !!supplier;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<SupplierFormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      supplierName: '',
      contactInfo: '',
      address: '',
      serviceArea: '',
      rating: '',
      evaluationNote: '',
      collaborationStatus: 'Regular',
    },
  });

  // Reset form when modal opens/closes or supplier changes
  useEffect(() => {
    if (isOpen) {
      if (supplier) {
        setValue('supplierName', supplier.supplierName);
        setValue('contactInfo', supplier.contactInfo || '');
        setValue('address', supplier.address || '');
        setValue('serviceArea', supplier.serviceArea || '');
        setValue('rating', supplier.rating ? supplier.rating.toString() : '');
        setValue('evaluationNote', supplier.evaluationNote || '');
        setValue('collaborationStatus', supplier.collaborationStatus);
      } else {
        reset({
          supplierName: '',
          contactInfo: '',
          address: '',
          serviceArea: '',
          rating: '',
          evaluationNote: '',
          collaborationStatus: 'Regular',
        });
      }
    }
  }, [isOpen, supplier, setValue, reset]);

  const mutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      // Map form data to payload format
      const payload = {
        supplierName: data.supplierName,
        contactInfo: data.contactInfo || undefined,
        address: data.address || undefined,
        serviceArea: data.serviceArea || undefined,
        rating: data.rating ? Number(data.rating) : undefined,
        evaluationNote: data.evaluationNote || undefined,
        collaborationStatus: data.collaborationStatus,
      };

      if (isEdit && supplier) {
        return await supplierService.updateSupplier(supplier.supplierId, payload);
      } else {
        return await supplierService.createSupplier(payload);
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      const savedSupplier = result.data;
      onSuccess(
        result.message ||
        (isEdit
          ? `Đã cập nhật thông tin nhà cung cấp ${savedSupplier.supplierName} thành công.`
          : `Đã thêm nhà cung cấp ${savedSupplier.supplierName} thành công.`)
      );
      onClose();
    },
  });

  const onSubmit = (data: SupplierFormData) => {
    withLoading(async () => {
      await mutation.mutateAsync(data);
    }, isEdit ? 'Đang cập nhật nhà cung cấp...' : 'Đang thêm nhà cung cấp mới...');
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={mutation.isPending} className="mr-3">
        Hủy
      </Button>
      <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={mutation.isPending} disabled={mutation.isPending}>
        Xác nhận
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Cập nhật thông tin Nhà cung cấp' : 'Thêm Nhà cung cấp mới'}
      footer={footer}
      width="md"
    >
      <form className="flex flex-col gap-4 text-left">
        <FormItem label="Tên Nhà cung cấp" required error={errors.supplierName?.message}>
          <Input
            placeholder="Nhập tên đầy đủ của nhà cung cấp"
            {...register('supplierName')}
            error={!!errors.supplierName}
          />
        </FormItem>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormItem label="Thông tin liên hệ" error={errors.contactInfo?.message}>
            <Input
              placeholder="SĐT, Email, Người đại diện..."
              {...register('contactInfo')}
              error={!!errors.contactInfo}
            />
          </FormItem>

          <FormItem label="Khu vực phục vụ" error={errors.serviceArea?.message}>
            <Input
              placeholder="Ví dụ: Toàn quốc, Miền Bắc..."
              {...register('serviceArea')}
              error={!!errors.serviceArea}
            />
          </FormItem>
        </div>

        <FormItem label="Địa chỉ văn phòng / kho" error={errors.address?.message}>
          <Input
            placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố..."
            {...register('address')}
            error={!!errors.address}
          />
        </FormItem>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormItem label="Đánh giá năng lực (Sao)" error={errors.rating?.message}>
            <Select
              {...register('rating')}
              error={!!errors.rating}
              options={[
                { label: 'Chưa có đánh giá', value: '' },
                { label: '⭐ (1 Sao)', value: '1' },
                { label: '⭐⭐ (2 Sao)', value: '2' },
                { label: '⭐⭐⭐ (3 Sao)', value: '3' },
                { label: '⭐⭐⭐⭐ (4 Sao)', value: '4' },
                { label: '⭐⭐⭐⭐⭐ (5 Sao)', value: '5' },
              ]}
            />
          </FormItem>

          <FormItem label="Trạng thái hợp tác" error={errors.collaborationStatus?.message}>
            <Select
              {...register('collaborationStatus')}
              error={!!errors.collaborationStatus}
              options={[
                { label: 'Chiến lược (Rất tốt)', value: 'Strategic' },
                { label: 'Thường xuyên', value: 'Regular' },
                { label: 'Hạn chế (Có rủi ro)', value: 'Restricted' },
                { label: 'Danh sách đen', value: 'Blacklisted' },
              ]}
            />
          </FormItem>
        </div>

        <FormItem label="Ghi chú đánh giá chi tiết" error={errors.evaluationNote?.message}>
          <Textarea
            placeholder="Nhập nhận xét về năng lực, mức độ uy tín, tốc độ giao hàng của nhà cung cấp..."
            rows={4}
            {...register('evaluationNote')}
            error={!!errors.evaluationNote}
          />
        </FormItem>

        {mutation.isError && (
          <p className="text-sm text-red-600 mt-2 font-medium">
            {(mutation.error as any).message || 'Có lỗi xảy ra khi lưu thông tin.'}
          </p>
        )}
      </form>
    </Modal>
  );
};
