import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { wbsService } from '../../../../src/services/wbsService';
import { Modal } from '../../../../src/components/ui/Modal';
import type { Project, WBSPhase } from '../../../types/common';

const createPhaseSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên Phase.'),
  description: z.string().optional(),
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
  maxPhaseOrder: number;
  project?: Project | null;
  phases?: WBSPhase[];
  onSuccess: (message: string) => void;
  onError?: (message: string) => void; // Keeping it for compatibility if needed
}

export const CreatePhaseModal: React.FC<CreatePhaseModalProps> = ({
  isOpen,
  onClose,
  projectId,
  maxPhaseOrder,
  project,
  phases,
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
    mutationFn: (data: CreatePhaseForm) => {
      const pId = projectId.replace('p-', '');
      return wbsService.createPhase(parseInt(pId), {
        projectId: parseInt(pId),
        name: data.name.trim(),
        description: data.description || null,
        orderIndex: maxPhaseOrder,
        startDate: data.startDate,
        endDate: data.endDate
      });
    },
    onSuccess: (_, variables) => {
      const msg = `Đã tạo thành công Giai đoạn mới: ${variables.name.trim()}`;
      toast.success(msg);
      onSuccess(msg);
      reset();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi tạo Giai đoạn.');
    }
  });

  const onSubmit = (data: CreatePhaseForm) => {
    const phaseStart = new Date(data.startDate);
    const phaseEnd = new Date(data.endDate);

    // Xóa giờ để so sánh chính xác theo ngày
    phaseStart.setHours(0,0,0,0);
    phaseEnd.setHours(0,0,0,0);

    // 1. Phải trong thời gian dự án
    if (project) {
        const projStart = new Date(project.startDate);
        const projEnd = new Date(project.endDate);
        projStart.setHours(0,0,0,0);
        projEnd.setHours(0,0,0,0);

        if (phaseStart < projStart || phaseEnd > projEnd) {
            toast.error(`Thời gian Giai đoạn phải nằm trong khoảng thời gian Dự án (${projStart.toLocaleDateString('vi-VN')} - ${projEnd.toLocaleDateString('vi-VN')})`);
            return;
        }
    }

    // 2. Phải sau giai đoạn trước (nếu có)
    if (phases && phases.length > 0) {
        // Tìm giai đoạn có ngày kết thúc muộn nhất
        const latestPhase = phases.reduce((latest, current) => {
             const latestDate = new Date(latest.endDate || latest.deadline || latest.startDate || 0);
             const currentDate = new Date(current.endDate || current.deadline || current.startDate || 0);
             return currentDate > latestDate ? current : latest;
        }, phases[0]);

        if (latestPhase) {
            const prevEndDateStr = latestPhase.endDate || latestPhase.deadline || latestPhase.startDate;
            if (prevEndDateStr) {
                const prevEndDate = new Date(prevEndDateStr);
                prevEndDate.setHours(0,0,0,0);
                
                if (phaseStart <= prevEndDate) {
                    toast.error(`Ngày bắt đầu phải sau ngày kết thúc của Giai đoạn trước ("${latestPhase.name}" kết thúc vào ${prevEndDate.toLocaleDateString('vi-VN')})`);
                    return;
                }
            }
        }
    }

    mutation.mutate(data);
  };

  const latestPhase = phases && phases.length > 0 ? phases.reduce((latest, current) => {
       const latestDate = new Date(latest.endDate || latest.deadline || latest.startDate || 0);
       const currentDate = new Date(current.endDate || current.deadline || current.startDate || 0);
       return currentDate > latestDate ? current : latest;
  }, phases[0]) : null;

  const latestDateStr = latestPhase ? (latestPhase.endDate || latestPhase.deadline || latestPhase.startDate) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo Giai đoạn mới">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
        
        {/* THÔNG TIN THỜI GIAN DỰ ÁN VÀ GIAI ĐOẠN TRƯỚC */}
        <div className="flex flex-col gap-2 -mb-1">
          {project && (
            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex flex-col">
              <p className="text-xs text-slate-500 mb-1">Thời gian dự án:</p>
              <p className="text-sm font-medium text-slate-700">
                {new Date(project.startDate).toLocaleDateString('vi-VN')} - {new Date(project.endDate).toLocaleDateString('vi-VN')}
              </p>
            </div>
          )}
          
          {latestPhase && (
            <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100 flex flex-col">
              <p className="text-xs text-slate-500 mb-1">Giai đoạn trước nhất ({latestPhase.name}):</p>
              <p className="text-sm font-medium text-slate-700">
                {latestPhase.startDate ? new Date(latestPhase.startDate).toLocaleDateString('vi-VN') : 'N/A'} - {latestDateStr ? new Date(latestDateStr).toLocaleDateString('vi-VN') : 'N/A'}
              </p>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="phase-name" className="block text-sm font-medium mb-1.5 text-slate-600">
            Tên Giai đoạn <span className="text-red-500">*</span>
          </label>
          <input
            id="phase-name"
            type="text"
            placeholder="Ví dụ: Giai đoạn 4: Hoàn thiện nội thất"
            {...register('name')}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.name ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="phase-description" className="block text-sm font-medium mb-1.5 text-slate-600">
            Mô tả Giai đoạn
          </label>
          <textarea
            id="phase-description"
            placeholder="Mô tả các yêu cầu chung cho Giai đoạn này..."
            {...register('description')}
            rows={3}
            className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium mb-1.5 text-slate-600">
              Ngày bắt đầu <span className="text-red-500">*</span>
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
              Ngày kết thúc <span className="text-red-500">*</span>
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
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Tạo Giai đoạn'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
