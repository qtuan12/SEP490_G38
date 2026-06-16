import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { wbsService } from '../../../../src/services/wbsService';
import type {ProjectMember} from '../../../types/common';
import { Modal } from '../../../../src/components/ui/Modal';

const createTaskSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên công việc.'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu.'),
  deadline: z.string().min(1, 'Vui lòng chọn hạn chót (Deadline).'),
  assignedTo: z.string().optional()
}).refine(data => new Date(data.startDate) <= new Date(data.deadline), {
  message: 'Ngày bắt đầu không được lớn hơn hạn chót.',
  path: ['startDate']
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  phaseId: string;
  parentTaskId?: string;
  parentDeadline?: string;
  maxTaskOrder: number;
  members: ProjectMember[];
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  projectId,
  phaseId,
  parentTaskId,
  parentDeadline,
  maxTaskOrder,
  members,
  onSuccess
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      deadline: '',
      assignedTo: ''
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const engineers = members.filter(m => m.userRole === 'Site Engineer' || m.userRole === 'Nhân viên kỹ thuật');

  const mutation = useMutation({
    mutationFn: async (data: CreateTaskForm) => {
      if (parentDeadline && new Date(data.deadline) > new Date(parentDeadline)) {
        throw new Error(`Hạn chót không được vượt quá deadline của cấp cha (${parentDeadline}).`);
      }

      return wbsService.createTask(parseInt(phaseId.replace('ph-', '')), {
        phaseId: parseInt(phaseId.replace('ph-', '')),
        parentTaskId: parentTaskId ? parseInt(parentTaskId.replace('t-', '')) : null,
        name: data.name.trim(),
        description: data.description || null,
        orderIndex: maxTaskOrder,
        startDate: data.startDate,
        endDate: data.deadline,
        assigneeIds: data.assignedTo ? [parseInt(data.assignedTo)] : []
      });
    },
    onSuccess: (_, variables) => {
      const msg = `Đã tạo thành công Công việc: ${variables.name}`;
      toast.success(msg);
      onSuccess(msg);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi tạo Task.');
    }
  });

  const onSubmit = (data: CreateTaskForm) => {
    mutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={parentTaskId ? "Thêm Công việc con (Sub-Task)" : "Thêm Công việc mới"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">
            Tên công việc <span className="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            placeholder="Ví dụ: Đổ bê tông móng..." 
            {...register('name')}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.name ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">Mô tả chi tiết</label>
          <textarea 
            placeholder="Mô tả các yêu cầu kỹ thuật, vị trí..." 
            {...register('description')} 
            rows={3} 
            className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-600">Ngày bắt đầu <span className="text-red-500">*</span></label>
            <input 
              type="date" 
              {...register('startDate')} 
              className={`w-full text-sm px-3 py-2 rounded-md border ${errors.startDate ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
            />
            {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-600">Hạn chót (Deadline) <span className="text-red-500">*</span></label>
            <input 
              type="date" 
              {...register('deadline')} 
              className={`w-full text-sm px-3 py-2 rounded-md border ${errors.deadline ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
            />
            {errors.deadline && <p className="text-red-500 text-xs mt-1">{errors.deadline.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">Giao cho Kỹ sư hiện trường (Tùy chọn)</label>
          <select 
            {...register('assignedTo')} 
            className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          >
            <option value="">-- Để trống nếu chưa giao --</option>
            {engineers.map(e => (
              <option key={e.userId} value={e.userId}>{e.userName}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : (parentTaskId ? 'Thêm Sub-Task' : 'Thêm Task')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
