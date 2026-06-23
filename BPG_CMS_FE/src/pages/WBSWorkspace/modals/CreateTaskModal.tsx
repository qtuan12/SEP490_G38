import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { wbsService } from '../../../../src/services/wbsService';
import type {ProjectMember, WBSTask} from '../../../types/common';
import { Modal } from '../../../../src/components/ui/Modal';

const createTaskSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên công việc.'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu.'),
  deadline: z.string().min(1, 'Vui lòng chọn hạn chót (Deadline).'),
  assignedTo: z.string().optional(),
  weight: z.any().optional()
}).refine(data => new Date(data.startDate) <= new Date(data.deadline), {
  message: 'Ngày bắt đầu không được lớn hơn hạn chót.',
  path: ['startDate']
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  phaseId: string;
  parentTaskId?: string;
  parentDeadline?: string;
  maxTaskOrder: number;
  members: ProjectMember[];
  tasks: WBSTask[];
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  phaseId,
  parentTaskId,
  parentDeadline,
  maxTaskOrder,
  members,
  tasks,
  onSuccess
}) => {
  const [selectedPredecessorIds, setSelectedPredecessorIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      deadline: '',
      assignedTo: '',
      weight: undefined
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset();
      setSelectedPredecessorIds([]);
      setSearchTerm('');
    }
  }, [isOpen, reset]);

  const engineers = members.filter(m => 
    m.userRole === 'Site Engineer' || 
    m.userRole === 'SiteEngineer' || 
    m.userRole.toLowerCase() === 'siteengineer' || 
    m.userRole === 'Nhân viên kỹ thuật'
  );

  // Tìm tất cả tổ tiên (ancestor) của parentTaskId để tránh vòng lặp khóa tiến độ
  const getAncestors = (startId: string | undefined): Set<string> => {
    const ancestors = new Set<string>();
    let currentId = startId;
    while (currentId) {
      ancestors.add(currentId);
      const parentTask = tasks.find(t => t.id === currentId);
      currentId = parentTask?.parentTaskId;
    }
    return ancestors;
  };

  const parentAncestors = getAncestors(parentTaskId);
  const potentialPredecessors = tasks.filter(t => 
    t.status !== 'obsolete' && 
    !parentAncestors.has(t.id)
  );

  const filteredPredecessors = potentialPredecessors.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        assigneeIds: data.assignedTo ? [parseInt(data.assignedTo)] : [],
        weight: (data.weight !== undefined && data.weight !== '' && data.weight !== null) ? Number(data.weight) : null
      });
    },
    onSuccess: async (newTaskId, variables) => {
      if (selectedPredecessorIds.length > 0) {
        for (const predIdStr of selectedPredecessorIds) {
          try {
            const predId = parseInt(predIdStr.replace('t-', ''));
            await wbsService.addTaskDependency(newTaskId, predId);
          } catch (err: any) {
            toast.error(err.message || `Lỗi khi liên kết công việc đi trước: ${predIdStr}`);
          }
        }
      }
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto p-1">
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
          <label className="block text-sm font-medium mb-1.5 text-slate-600">Trọng số (Tùy chọn)</label>
          <input 
            type="number" 
            step="any"
            placeholder="Ví dụ: 10, 100, 1000..." 
            {...register('weight')}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.weight ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
          />
          <p className="text-[11px] text-slate-400 mt-1">Gợi ý: Nhập ngân sách dự toán, hoặc số giờ công. Nếu để trống, hệ thống tự động tính theo số ngày thi công.</p>
          {errors.weight && <p className="text-red-500 text-xs mt-1">{errors.weight.message?.toString()}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">Giao cho Nhân viên kỹ thuật (Tùy chọn)</label>
          <select 
            {...register('assignedTo')} 
            className="w-full text-sm px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Chưa phân công --</option>
            {engineers.map(e => (
              <option key={e.userId} value={e.userId}>
                {e.userName} ({e.isLeader ? 'Trưởng dự án' : 'Nhân viên kỹ thuật'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">Công việc đi trước (Tùy chọn - Finish-to-Start)</label>
          {potentialPredecessors.length > 0 && (
            <input 
              type="text"
              placeholder="Tìm kiếm công việc đi trước..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-1.5 mb-2 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          )}
          <div className="border border-slate-200 rounded-md p-2 max-h-40 overflow-y-auto bg-white flex flex-col gap-1.5">
            {filteredPredecessors.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">
                {searchTerm ? 'Không tìm thấy công việc nào phù hợp' : 'Không có công việc nào khả dụng'}
              </p>
            ) : (
              filteredPredecessors.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 p-1.5 rounded cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    value={t.id}
                    checked={selectedPredecessorIds.includes(t.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPredecessorIds([...selectedPredecessorIds, t.id]);
                      } else {
                        setSelectedPredecessorIds(selectedPredecessorIds.filter(id => id !== t.id));
                      }
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t.name} ({t.progress}%)</span>
                </label>
              ))
            )}
          </div>
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
