import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import {projectService} from '../../../../src/services/projectService';
import type {WBSPhase} from '../../../types/common';
import { Modal } from '../../../../src/components/Modal';

const editPhaseSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên Phase.'),
  startDate: z.string().optional(),
  endDate: z.string().optional()
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'Ngày bắt đầu không được lớn hơn ngày kết thúc.',
  path: ['startDate']
});

type EditPhaseForm = z.infer<typeof editPhaseSchema>;

interface EditPhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  phase: WBSPhase;
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
}

export const EditPhaseModal: React.FC<EditPhaseModalProps> = ({
  isOpen,
  onClose,
  phase,
  onSuccess
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditPhaseForm>({
    resolver: zodResolver(editPhaseSchema),
    defaultValues: {
      name: phase.name || '',
      startDate: phase.startDate || '',
      endDate: phase.deadline || phase.endDate || ''
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        name: phase.name || '',
        startDate: phase.startDate || '',
        endDate: phase.deadline || phase.endDate || ''
      });
    }
  }, [isOpen, phase, reset]);

  const mutation = useMutation({
    mutationFn: (data: EditPhaseForm) => 
      projectService.updatePhase(phase.id, {
        name: data.name.trim(),
        startDate: data.startDate || undefined,
        deadline: data.endDate || undefined,
        endDate: data.endDate || undefined
      }),
    onSuccess: (_, variables) => {
      const msg = `Đã cập nhật Phase: ${variables.name.trim()}`;
      toast.success(msg);
      onSuccess(msg);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi cập nhật Phase.');
    }
  });

  const onSubmit = (data: EditPhaseForm) => {
    mutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa Giai đoạn (Phase)">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">
            Tên Giai đoạn <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name')}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.name ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-600">Ngày bắt đầu dự kiến</label>
            <input 
              type="date" 
              {...register('startDate')}
              className={`w-full text-sm px-3 py-2 rounded-md border ${errors.startDate ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
            />
            {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-600">Ngày kết thúc (Deadline)</label>
            <input 
              type="date" 
              {...register('endDate')}
              className={`w-full text-sm px-3 py-2 rounded-md border ${errors.endDate ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
            />
            {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate.message}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Lưu Thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
