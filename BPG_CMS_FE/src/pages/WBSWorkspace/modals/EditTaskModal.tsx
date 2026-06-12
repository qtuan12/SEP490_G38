import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import {projectService} from '../../../../src/services/projectService';
import type {ProjectMember, WBSTask} from '../../../types/common';
import { Modal } from '../../../../src/components/Modal';

const editTaskSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên công việc.'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu.'),
  deadline: z.string().min(1, 'Vui lòng chọn hạn chót (Deadline).'),
  assignedTo: z.string().optional()
}).refine(data => new Date(data.startDate) <= new Date(data.deadline), {
  message: 'Ngày bắt đầu không được lớn hơn hạn chót.',
  path: ['startDate']
});

type EditTaskForm = z.infer<typeof editTaskSchema>;

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: WBSTask;
  parentDeadline?: string;
  members: ProjectMember[];
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  parentDeadline,
  members,
  onSuccess
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditTaskForm>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      name: task.name || '',
      description: task.description || '',
      startDate: task.startDate || '',
      deadline: task.deadline || '',
      assignedTo: task.assignedTo || ''
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        name: task.name || '',
        description: task.description || '',
        startDate: task.startDate || '',
        deadline: task.deadline || '',
        assignedTo: task.assignedTo || ''
      });
    }
  }, [isOpen, task, reset]);

  const engineers = members.filter(m => m.userRole === 'Site Engineer' || m.userRole === 'kỹ sư' || m.userRole === 'Nhân viên kỹ thuật');

  const mutation = useMutation({
    mutationFn: async (data: EditTaskForm) => {
      if (parentDeadline && new Date(data.deadline) > new Date(parentDeadline)) {
        throw new Error(`Hạn chót không được vượt quá deadline của cấp cha (${parentDeadline}).`);
      }

      let assignedName = '';
      if (data.assignedTo) {
        const eng = engineers.find(e => e.userId === data.assignedTo);
        if (eng) assignedName = eng.userName;
      }

      return projectService.updateTask(task.id, {
        name: data.name,
        description: data.description || '',
        startDate: data.startDate,
        deadline: data.deadline,
        assignedTo: data.assignedTo || '',
        assignedName
      });
    },
    onSuccess: (_, variables) => {
      const msg = `Đã cập nhật công việc: ${variables.name}`;
      toast.success(msg);
      onSuccess(msg);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi cập nhật Task.');
    }
  });

  const onSubmit = (data: EditTaskForm) => {
    mutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa Công việc">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">
            Tên công việc <span className="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            {...register('name')}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.name ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">Mô tả chi tiết</label>
          <textarea 
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
          <label className="block text-sm font-medium mb-1.5 text-slate-600">Người phụ trách (Kỹ sư)</label>
          <select 
            {...register('assignedTo')} 
            className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          >
            <option value="">-- Chưa phân công --</option>
            {engineers.map(e => (
              <option key={e.userId} value={e.userId}>{e.userName}</option>
            ))}
          </select>
          {engineers.length === 0 && <div className="text-xs text-amber-600 mt-1">* Không có kỹ sư nào trong dự án này.</div>}
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
