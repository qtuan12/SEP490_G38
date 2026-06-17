import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { wbsService } from '../../../services/wbsService';
import { Modal } from '../../../components/ui/Modal';
import type { WBSTask } from '../../../types/common';

interface ObsoleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: WBSTask;
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
}

export const ObsoleteTaskModal: React.FC<ObsoleteTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onSuccess
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
      onClose();
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
    <Modal isOpen={isOpen} onClose={onClose} title="Hủy bỏ / Đánh dấu lỗi thời">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-slate-500 mb-3">
            Xác nhận hủy bỏ công việc: <strong className="text-slate-900">{task.name}</strong>
          </p>
          <label className="block text-sm font-medium mb-1 text-slate-600">Lý do hủy bỏ <span className="text-red-500">*</span></label>
          <textarea
            className="input w-full min-h-[100px] resize-none"
            placeholder="Nhập lý do tại sao công việc này bị hủy bỏ hoặc không còn giá trị..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            maxLength={1000}
          />
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Thoát</button>
          <button type="submit" className="btn" style={{ backgroundColor: 'hsl(var(--danger))', color: '#fff' }} disabled={mutation.isPending || !reason.trim()}>
            {mutation.isPending ? 'Đang xử lý...' : 'Xác nhận hủy'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
