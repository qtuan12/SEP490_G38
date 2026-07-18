import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
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

interface AssignEngineerFormProps {
  taskId: string;
  taskName: string;
  projectId: string;
  onSuccess: (message: string) => void;
  onCancel: () => void;
}

export const AssignEngineerForm: React.FC<AssignEngineerFormProps> = ({
  taskId,
  taskName,
  projectId,
  onSuccess,
  onCancel
}) => {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectService.getMembers(projectId)
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => projectService.getTasks(projectId)
  });

  useEffect(() => {
    if (tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.assignedTo) {
        setSelectedUserIds(task.assignedTo.split(',').filter(Boolean));
      } else {
        setSelectedUserIds([]);
      }
    }
  }, [tasks, taskId]);

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
      onCancel();
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
    <div style={{ backgroundColor: 'hsl(var(--bg-card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)', marginTop: '16px' }}>
      <div style={{ padding: '12px', backgroundColor: 'hsl(var(--primary-glow))', borderBottom: '1px solid hsl(var(--border))' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--primary))' }}>Phân công Kỹ sư thực hiện</h4>
      </div>
      <div style={{ padding: '16px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px', color: 'hsl(var(--text-secondary))' }}>Chọn Kỹ sư tham gia công việc:</label>
            
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                <span style={{ fontSize: '0.875rem', color: 'hsl(var(--text-muted))' }}>Đang tải danh sách...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', border: '1px solid hsl(var(--border-light))', borderRadius: 'var(--radius-md)', padding: '12px', backgroundColor: 'hsl(var(--bg-card))' }}>
                {members.length > 0 ? members.map(m => {
                  const isChecked = selectedUserIds.includes(m.userId);
                  let displayRole = m.userRole;
                  if (m.isLeader) displayRole = 'Trưởng dự án';
                  else if (m.userRole === 'TechnicalManager' || m.userRole === 'Technical Manager') displayRole = 'Trưởng phòng kỹ thuật';
                  else if (m.userRole === 'SiteEngineer' || m.userRole === 'Site Engineer' || m.userRole?.toLowerCase() === 'siteengineer') displayRole = 'Nhân viên kỹ thuật';
                  
                  return (
                    <label key={m.userId} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem', padding: '10px 16px', borderRadius: 'var(--radius-md)', backgroundColor: isChecked ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-body))', border: isChecked ? '1px solid hsl(var(--primary))' : '1px solid hsl(var(--border-light))', transition: 'all 0.2s', margin: 0 }}>
                      <input
                        type="checkbox"
                        style={{ margin: 0, cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                        checked={isChecked}
                        onChange={() => handleToggleUser(m.userId)}
                        disabled={mutation.isPending}
                      />
                      <span style={{ color: 'hsl(var(--text-primary))', flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
                        <span>{m.userName}</span>
                        <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem', fontWeight: 400 }}>- {displayRole}</span>
                      </span>
                    </label>
                  );
                }) : (
                  <span style={{ fontSize: '0.875rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Không có kỹ sư nào trong dự án.</span>
                )}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={mutation.isPending}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending || selectedUserIds.length === 0 || isLoading}>
              {mutation.isPending ? 'Đang lưu...' : 'Lưu phân công'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AssignEngineerModal: React.FC<AssignEngineerModalProps> = ({
  isOpen, onClose, taskId, taskName, projectId, onSuccess
}) => {
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Phân công Kỹ sư thực hiện">
      <AssignEngineerForm taskId={taskId} taskName={taskName} projectId={projectId} onSuccess={onSuccess} onCancel={onClose} />
    </Modal>
  );
};
