import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { wbsService } from '../../../../src/services/wbsService';
import type {WBSPhase} from '../../../types/common';
import { Modal } from '../../../../src/components/ui/Modal';

const editPhaseSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên Phase.'),
  description: z.string().optional(),
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
      description: phase.description || '',
      startDate: phase.startDate || '',
      endDate: phase.deadline || phase.endDate || ''
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        name: phase.name || '',
        description: phase.description || '',
        startDate: phase.startDate || '',
        endDate: phase.deadline || phase.endDate || ''
      });
    }
  }, [isOpen, phase, reset]);

  const mutation = useMutation({
    mutationFn: (data: EditPhaseForm) => {
      const pId = parseInt(phase.projectId.replace('p-', ''));
      const phId = parseInt(phase.id.replace('ph-', ''));
      return wbsService.updatePhase(pId, phId, {
        phaseId: phId,
        name: data.name.trim(),
        description: data.description || null,
        orderIndex: phase.sortOrder,
        startDate: data.startDate || null,
        endDate: data.endDate || null
      });
    },
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

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">
            Mô tả Phase
          </label>
          <textarea
            placeholder="Mô tả các yêu cầu chung cho Giai đoạn này..."
            {...register('description')}
            rows={3}
            className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
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
