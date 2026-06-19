import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { wbsService } from '../../../services/wbsService';
import { Modal } from '../../../components/ui/Modal';
import type { WBSTask } from '../../../types/common';

interface ObsoleteTaskFormProps {
  task: WBSTask;
  onSuccess: (message: string) => void;
  onCancel: () => void;
}

export const ObsoleteTaskForm: React.FC<ObsoleteTaskFormProps> = ({
  task,
  onSuccess,
  onCancel
}) => {
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) {
        throw new Error('Vui lòng nhập lý do hủy bỏ/đánh dấu lỗi thời.');
      }
      
      const tId = parseInt(task.id.replace('t-', ''));
      return wbsService.markTaskObsolete(tId, {
        taskId: tId,
        obsoleteReason: reason.trim()
      });
    },
    onSuccess: () => {
      const msg = `Đã đánh dấu lỗi thời công việc: ${task.name}`;
      toast.success(msg);
      onSuccess(msg);
      setReason('');
      onCancel();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi đánh dấu lỗi thời.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--text-muted))', marginBottom: '12px' }}>
          Xác nhận hủy bỏ công việc: <strong style={{ color: 'hsl(var(--text-primary))' }}>{task.name}</strong>
        </p>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px', color: 'hsl(var(--text-secondary))' }}>Lý do hủy bỏ <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
        <textarea
          className="input"
          style={{ width: '100%', minHeight: '100px', resize: 'none' }}
          placeholder="Nhập lý do tại sao công việc này bị hủy bỏ hoặc không còn giá trị..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          maxLength={1000}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={mutation.isPending}>Thoát</button>
        <button type="submit" className="btn" style={{ backgroundColor: 'hsl(var(--danger))', color: '#fff' }} disabled={mutation.isPending || !reason.trim()}>
          {mutation.isPending ? 'Đang xử lý...' : 'Xác nhận hủy'}
        </button>
      </div>
    </form>
  );
};

interface ObsoleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: WBSTask;
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
}

export const ObsoleteTaskModal: React.FC<ObsoleteTaskModalProps> = ({
  isOpen, onClose, task, onSuccess
}) => {
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hủy bỏ / Đánh dấu lỗi thời">
      <ObsoleteTaskForm task={task} onSuccess={onSuccess} onCancel={onClose} />
    </Modal>
  );
};
