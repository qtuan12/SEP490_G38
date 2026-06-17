import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { projectService } from '../../../services/projectService';
import type { WBSTask } from '../../../types/common';

interface AdjustProgressFormProps {
  task: WBSTask;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}

export const AdjustProgressForm: React.FC<AdjustProgressFormProps> = ({
  task, onSuccess, onError, onCancel
}) => {
  const [adjustProgress, setAdjustProgress] = useState<number | ''>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    if (task) {
      setAdjustProgress(task.progress);
      setAdjustReason('');
    }
  }, [task]);

  const handleSubmit = async () => {
    if (typeof adjustProgress !== 'number' || adjustProgress < 0 || adjustProgress > 100) {
      onError('Vui lòng nhập tiến độ hợp lệ (từ 0 đến 100)');
      return;
    }
    if (!adjustReason.trim()) {
      onError('Vui lòng nhập lý do điều chỉnh');
      return;
    }
    try {
      setIsAdjusting(true);
      await projectService.adjustTaskProgressDirectly(task.id, adjustProgress, adjustReason);
      onSuccess('Cập nhật tiến độ thành công');
      onCancel();
    } catch (e: any) {
      onError(e.message || 'Lỗi khi cập nhật tiến độ');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setAdjustProgress('');
      return;
    }
    const num = Number(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setAdjustProgress(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-', '.'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleQuickAdd = (amount: number) => {
    const current = typeof adjustProgress === 'number' ? adjustProgress : 0;
    const next = current + amount;
    setAdjustProgress(next > 100 ? 100 : next);
  };

  return (
    <div className="bg-[hsl(var(--bg-card))] rounded-md border border-[hsl(var(--border))] overflow-hidden animate-fade-in shadow-sm mt-4">
      <div className="p-3 bg-[hsl(var(--primary-glow))] border-b border-[hsl(var(--border))]">
        <h4 className="m-0 text-[0.95rem] font-semibold text-[hsl(var(--primary))]">Điều chỉnh tiến độ (Chỉ dành cho TPKT)</h4>
      </div>
      <div className="p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.8rem] font-semibold text-[hsl(var(--text-secondary))]">
            Tiến độ mới (%):
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={adjustProgress}
            onChange={handleProgressChange}
            onKeyDown={handleKeyDown}
            className="p-2 bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))] rounded-md text-[0.85rem] focus:outline-none focus:border-[hsl(var(--primary))]"
          />
          <div className="flex gap-2 mt-1">
            {[5, 10, 15, 20].map((val) => (
              <button
                key={val}
                onClick={() => handleQuickAdd(val)}
                className="px-2 py-1 text-[0.75rem] font-medium rounded-md border border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] hover:text-white transition-colors cursor-pointer bg-transparent"
              >
                +{val}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[0.8rem] font-semibold text-[hsl(var(--text-secondary))]">
            Lý do điều chỉnh:
          </label>
          <textarea
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            placeholder="Nhập lý do điều chỉnh tiến độ..."
            rows={3}
            className="p-2 bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))] rounded-md text-[0.85rem] focus:outline-none focus:border-[hsl(var(--primary))]"
          />
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-md border border-[hsl(var(--border))] text-[0.85rem] font-medium bg-transparent hover:bg-[hsl(var(--bg-main))] transition-colors"
            disabled={isAdjusting}
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-md border-none text-white text-[0.85rem] font-medium bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] transition-colors cursor-pointer"
            disabled={isAdjusting}
          >
            {isAdjusting ? 'Đang cập nhật...' : 'Cập nhật tiến độ'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface AdjustProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: WBSTask;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const AdjustProgressModal: React.FC<AdjustProgressModalProps> = ({
  isOpen, onClose, task, onSuccess, onError
}) => {
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Điều chỉnh tiến độ (Chỉ dành cho TPKT)">
      <AdjustProgressForm task={task} onSuccess={onSuccess} onError={onError} onCancel={onClose} />
    </Modal>
  );
};
