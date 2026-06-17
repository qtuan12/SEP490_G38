import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { projectService } from '../../../../src/services/projectService';
import { wbsService } from '../../../../src/services/wbsService';
import { Modal } from '../../../../src/components/ui/Modal';

interface AssignEngineerModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
  projectId: string;
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
}

export const AssignEngineerModal: React.FC<AssignEngineerModalProps> = ({
  isOpen,
  onClose,
  taskId,
  taskName,
  projectId,
  onSuccess
}) => {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: isOpen
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => projectService.getTasks(projectId),
    enabled: isOpen
  });

  useEffect(() => {
    if (isOpen && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.assignedTo) {
        setSelectedUserIds(task.assignedTo.split(',').filter(Boolean));
      } else {
        setSelectedUserIds([]);
      }
    } else if (!isOpen) {
      setSelectedUserIds([]);
    }
  }, [isOpen, tasks, taskId]);

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (selectedUserIds.length === 0) {
        throw new Error('Vui lòng chọn ít nhất một kỹ sư.');
      }
      
      const selectedMembers = members.filter(m => selectedUserIds.includes(m.userId));
      const assignedToVal = selectedUserIds.join(',');
      const assignedNameVal = selectedMembers.map(m => m.userName).join(', ');

      return wbsService.assignTask(parseInt(taskId.replace('t-', '')), {
        taskId: parseInt(taskId.replace('t-', '')),
        assigneeIds: selectedUserIds.map(id => parseInt(id))
      });
    },
    onSuccess: () => {
      const selectedMembers = members.filter(m => selectedUserIds.includes(m.userId));
      const assignedNameVal = selectedMembers.map(m => m.userName).join(', ');
      
      const msg = `Đã phân công công việc "${taskName}" cho các kỹ sư: ${assignedNameVal}`;
      toast.success(msg);
      onSuccess(msg);
      
      // Invalidate tasks query to refresh data
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi phân công.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const isLoading = isLoadingMembers || isLoadingTasks;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Phân công Kỹ sư thực hiện">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-slate-500 mb-3">
            Phân công cho công việc: <strong className="text-slate-900">{taskName}</strong>
          </p>
          <label className="block text-sm font-medium mb-2 text-slate-600">Chọn danh sách kỹ sư thi công</label>
          
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : members.length > 0 ? (
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto border border-slate-200 rounded-md p-3 bg-slate-50/50">
              {members.filter(m => m.userRole === 'Site Engineer' || m.userRole === 'SiteEngineer' || m.userRole.toLowerCase() === 'siteengineer' || m.userRole === 'Nhân viên kỹ thuật').length > 0 ? members.filter(m => m.userRole === 'Site Engineer' || m.userRole === 'SiteEngineer' || m.userRole.toLowerCase() === 'siteengineer' || m.userRole === 'Nhân viên kỹ thuật').map((m) => {
                const isChecked = selectedUserIds.includes(m.userId);
                return (
                  <label key={m.userId} className="flex items-center gap-2 cursor-pointer font-normal text-sm py-1 hover:bg-slate-100 rounded px-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleUser(m.userId)}
                      className="w-4 h-4 cursor-pointer text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span>{m.userName} <span className="text-slate-500 text-xs">({m.isLeader ? 'Trưởng dự án' : 'Nhân viên kỹ thuật'})</span></span>
                  </label>
                );
              }) : <div className="text-sm text-slate-500 p-2">Không có kỹ sư nào trong dự án này.</div>}
            </div>
          ) : (
            <div className="p-3 bg-slate-100 rounded-md text-slate-500 text-sm">
              Dự án chưa có thành viên kỹ sư nào để gán. Hãy thêm thành viên trước.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending || members.length === 0 || isLoading}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Xác nhận gán'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
