import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { projectService } from '../../../../src/services/projectService';
import { Modal } from '../../../../src/components/ui/Modal';

const adjustDeadlineSchema = z.object({
  newDeadline: z.string().min(1, 'Vui lòng chọn ngày mới.'),
  reason: z.string().min(1, 'Vui lòng nhập lý do dời hạn chót.')
});

type AdjustDeadlineForm = z.infer<typeof adjustDeadlineSchema>;

interface AdjustDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
  currentDeadline: string;
  user: string;
  projectId?: string; // Add this if available to invalidate queries
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
}

export const AdjustDeadlineModal: React.FC<AdjustDeadlineModalProps> = ({
  isOpen,
  onClose,
  taskId,
  taskName,
  currentDeadline,
  user,
  projectId,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdjustDeadlineForm>({
    resolver: zodResolver(adjustDeadlineSchema),
    defaultValues: {
      newDeadline: '',
      reason: ''
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        newDeadline: currentDeadline,
        reason: ''
      });
    }
  }, [isOpen, currentDeadline, reset]);

  const mutation = useMutation({
    mutationFn: async (data: AdjustDeadlineForm) => {
      if (data.newDeadline === currentDeadline) {
        throw new Error('Ngày mới phải khác ngày hiện tại.');
      }
      return projectService.adjustTaskDeadline(taskId, data.newDeadline, data.reason.trim(), user);
    },
    onSuccess: (_, variables) => {
      const msg = `Đã dời hạn chót việc "${taskName}" sang ngày ${variables.newDeadline}`;
      toast.success(msg);
      onSuccess(msg);
      
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      }
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi dời hạn chót.');
    }
  });

  const onSubmit = (data: AdjustDeadlineForm) => {
    mutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yêu cầu dời Hạn chót (Deadline)">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-slate-500 mb-1">
            Công việc: <strong className="text-slate-900">{taskName}</strong>
          </p>
          <p className="text-sm text-slate-500">
            Hạn chót hiện tại: <strong className="text-slate-900">{currentDeadline}</strong>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">
            Chọn hạn chót mới <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            {...register('newDeadline')}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.newDeadline ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
          />
          {errors.newDeadline && <p className="text-red-500 text-xs mt-1">{errors.newDeadline.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">
            Lý do dời hạn (Bắt buộc) <span className="text-red-500">*</span>
          </label>
          <textarea
            placeholder="Ví dụ: Do trời mưa bão dầm dề 3 ngày liên tiếp không thể thi công kết cấu cốt thép dầm sàn..."
            {...register('reason')}
            rows={3}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.reason ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
          />
          {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason.message}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Xác nhận dời hạn'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
