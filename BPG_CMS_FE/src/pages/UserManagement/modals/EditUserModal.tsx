import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, Input, Select, FormItem } from '../../../components/ui';
import { userService } from '../../../services/userService';
import type { UserProfile } from '../../../services/authService';
import { validateFullName, validatePhoneNumber, sanitizePhoneInput } from '../../../utils/profileValidation';

const schema = z.object({
  name: z.string().superRefine((val, ctx) => {
    const error = validateFullName(val);
    if (error) ctx.addIssue({ code: 'custom', message: error });
  }),
  email: z.string().email('Địa chỉ email không hợp lệ'),
  phoneNumber: z.string().optional().superRefine((val, ctx) => {
    const error = validatePhoneNumber(val ?? '');
    if (error) ctx.addIssue({ code: 'custom', message: error });
  }),
  role: z.enum(['admin', 'director', 'technicalmanager', 'siteengineer', 'accountant']),
});

type FormData = z.infer<typeof schema>;

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  user: UserProfile | null;
}

import { useLoading } from '../../../context/LoadingContext';

export const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, onSuccess, user }) => {
  const { withLoading } = useLoading();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  });

  useEffect(() => {
    if (user && isOpen) {
      reset({
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber ?? '',
        role: user.role,
      });
    }
  }, [user, isOpen, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!user) throw new Error('Không có user');
      return userService.updateUser(user.id, data);
    },
    onSuccess: (result) => {
      onSuccess(result.message || 'Thao tác thành công.');
      onClose();
    }
  });

  const onSubmit = (data: FormData) => {
    withLoading(async () => {
      await mutation.mutateAsync(data);
    }, 'Đang lưu thay đổi...');
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={isSubmitting || mutation.isPending} className="mr-3">
        Hủy
      </Button>
      <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting || mutation.isPending}>
        Lưu thay đổi
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cập nhật thông tin thành viên" footer={footer} width="sm">
      <form className="flex flex-col gap-4">
        <FormItem label="Họ và Tên" required error={errors.name?.message}>
          <Input {...register('name')} error={!!errors.name} />
        </FormItem>

        <FormItem label="Địa chỉ Email" required error={errors.email?.message}>
          <Input type="email" {...register('email')} error={!!errors.email} />
        </FormItem>

        <FormItem label="Số điện thoại" error={errors.phoneNumber?.message}>
          <Input
            type="tel"
            placeholder="Ví dụ: 0912345678"
            {...register('phoneNumber', {
              onChange: e => { e.target.value = sanitizePhoneInput(e.target.value); },
            })}
            error={!!errors.phoneNumber}
          />
        </FormItem>

        <FormItem label="Vai trò hệ thống" error={errors.role?.message}>
          <Select 
            {...register('role')} 
            error={!!errors.role}
            options={[
              { label: 'Admin', value: 'admin' },
              { label: 'Giám Đốc', value: 'director' },
              { label: 'Trưởng phòng Kĩ thuật', value: 'technicalmanager' },
              { label: 'Nhân viên kỹ thuật', value: 'siteengineer' },
              { label: 'Kế Toán', value: 'accountant' },
            ]}
          />
        </FormItem>

        {mutation.isError && (
          <p className="text-sm text-red-600 mt-2">
            {(mutation.error as any).message || 'Không thể cập nhật tài khoản.'}
          </p>
        )}
      </form>
    </Modal>
  );
};
