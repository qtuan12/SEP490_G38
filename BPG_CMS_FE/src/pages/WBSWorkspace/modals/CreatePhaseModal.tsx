import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { projectService } from '../../../../src/services/projectService';
import { Modal } from '../../../../src/components/ui/Modal';

const createPhaseSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên Phase.'),
  startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu.'),
  endDate: z.string().min(1, 'Vui lòng chọn ngày kết thúc.')
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
  message: 'Ngày bắt đầu không được lớn hơn ngày kết thúc.',
  path: ['startDate']
});

type CreatePhaseForm = z.infer<typeof createPhaseSchema>;

interface CreatePhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: (message: string) => void;
  onError?: (message: string) => void; // Keeping it for compatibility if needed
}

export const CreatePhaseModal: React.FC<CreatePhaseModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onSuccess
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreatePhaseForm>({
    resolver: zodResolver(createPhaseSchema)
  });

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const mutation = useMutation({
    mutationFn: (data: CreatePhaseForm) => 
      projectService.createPhase(projectId, data.name.trim(), data.startDate, data.endDate, []),
    onSuccess: (_, variables) => {
      const msg = `Đã tạo thành công Phase mới: ${variables.name.trim()}`;
      toast.success(msg);
      onSuccess(msg);
      reset();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi tạo Phase.');
    }
  });

  const onSubmit = (data: CreatePhaseForm) => {
    mutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo Giai đoạn (Phase) mới">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
        <div>
          <label htmlFor="phase-name" className="block text-sm font-medium mb-1.5 text-slate-600">
            Tên Giai đoạn <span className="text-red-500">*</span>
          </label>
          <input
            id="phase-name"
            type="text"
            placeholder="Ví dụ: Phase 4: Hoàn thiện nội thất"
            {...register('name')}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.name ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium mb-1.5 text-slate-600">
              Ngày bắt đầu dự kiến <span className="text-red-500">*</span>
            </label>
            <input 
              id="start-date" 
              type="date" 
              {...register('startDate')}
              className={`w-full text-sm px-3 py-2 rounded-md border ${errors.startDate ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
            />
            {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium mb-1.5 text-slate-600">
              Ngày kết thúc (Deadline) <span className="text-red-500">*</span>
            </label>
            <input 
              id="end-date" 
              type="date" 
              {...register('endDate')}
              className={`w-full text-sm px-3 py-2 rounded-md border ${errors.endDate ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
            />
            {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate.message}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Tạo Phase'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
