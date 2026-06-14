import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, Input, FormItem } from '../../../components/ui';
import { projectService } from '../../../services/projectService';
import type { Project } from '../../../types/common';

const schema = z.object({
  name: z.string().min(3, 'Tên dự án phải có ít nhất 3 ký tự'),
  address: z.string().min(5, 'Địa chỉ công trường phải có ít nhất 5 ký tự'),
  startDate: z.string().min(1, 'Vui lòng chọn ngày dự kiến bắt đầu'),
  endDate: z.string().min(1, 'Vui lòng chọn ngày dự kiến kết thúc')
});

type FormData = z.infer<typeof schema>;

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: Project | null;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, onClose, onSuccess, project }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as any
  });

  useEffect(() => {
    if (project && isOpen) {
      reset({
        name: project.name,
        address: project.address,
        startDate: project.startDate,
        endDate: project.endDate
      });
    }
  }, [project, isOpen, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!project) return;
      await projectService.updateProject(project.id, {
        name: data.name,
        address: data.address,
        startDate: data.startDate,
        endDate: data.endDate
      });
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    }
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="mr-3">
        Hủy bỏ
      </Button>
      <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting}>
        Cập nhật
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sửa thông tin Dự án" footer={footer} width="md">
      <form className="flex flex-col gap-4">
        <FormItem label="Tên dự án" required error={errors.name?.message}>
          <Input placeholder="Nhập tên dự án công trình" {...register('name')} error={!!errors.name} />
        </FormItem>

        <FormItem label="Địa chỉ công trường" required error={errors.address?.message}>
          <Input placeholder="Số nhà, Tỉnh thành..." {...register('address')} error={!!errors.address} />
        </FormItem>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormItem label="Ngày dự kiến bắt đầu" required error={errors.startDate?.message}>
            <Input type="date" {...register('startDate')} error={!!errors.startDate} />
          </FormItem>
          <FormItem label="Ngày dự kiến kết thúc" required error={errors.endDate?.message}>
            <Input type="date" {...register('endDate')} error={!!errors.endDate} />
          </FormItem>
        </div>
        
        {mutation.isError && (
          <p className="text-sm text-red-600 mt-2">
            Có lỗi xảy ra khi sửa dự án. {mutation.error?.message}
          </p>
        )}
      </form>
    </Modal>
  );
};
