import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, Input, Select, FormItem } from '../../../components/ui';
import { userService } from '../../../services/userService';

const schema = z.object({
  name: z.string().min(2, 'Họ và Tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Địa chỉ email không hợp lệ'),
  role: z.enum(['admin', 'director', 'technicalmanager', 'siteengineer', 'accountant']).default('siteengineer'),
});

type FormData = z.infer<typeof schema>;

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      role: 'siteengineer'
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      await userService.createUser(data);
      return data;
    },
    onSuccess: (data) => {
      onSuccess(`Đã tạo tài khoản cho ${data.name} thành công.`);
      reset();
      onClose();
    }
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="mr-3">
        Hủy
      </Button>
      <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting}>
        Xác nhận
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm Thành viên mới" footer={footer} width="sm">
      <form className="flex flex-col gap-4">
        <FormItem label="Họ và Tên" required error={errors.name?.message}>
          <Input placeholder="Nhập tên nhân viên" {...register('name')} error={!!errors.name} />
        </FormItem>

        <FormItem label="Địa chỉ Email" required error={errors.email?.message}>
          <Input type="email" placeholder="nhanvien@bpg.com" {...register('email')} error={!!errors.email} />
        </FormItem>

        <FormItem label="Vai trò hệ thống" error={errors.role?.message}>
          <Select 
            {...register('role')} 
            error={!!errors.role}
            options={[
              { label: 'Admin', value: 'admin' },
              { label: 'Giám Đốc', value: 'director' },
              { label: 'Trưởng phòng Kĩ thuật (TechnicalManager)', value: 'technicalmanager' },
              { label: 'Nhân viên kỹ thuật (SiteEngineer)', value: 'siteengineer' },
              { label: 'Kế Toán (Accountant)', value: 'accountant' },
            ]}
          />
        </FormItem>

        {mutation.isError && (
          <p className="text-sm text-red-600 mt-2">
            {(mutation.error as any).message || 'Có lỗi xảy ra khi tạo tài khoản.'}
          </p>
        )}
      </form>
    </Modal>
  );
};
