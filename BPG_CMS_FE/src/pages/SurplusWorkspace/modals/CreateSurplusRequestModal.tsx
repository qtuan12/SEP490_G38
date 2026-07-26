import React, { useState } from 'react';
import { Modal, Button, FormItem } from '../../../components/ui';
import { AlertCircle } from 'lucide-react';
import { surplusService } from '../../../services/surplusService';

interface CreateSurplusRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  projectName: string;
}

export const CreateSurplusRequestModal: React.FC<CreateSurplusRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  projectName,
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await surplusService.createRequest(projectId, reason.trim() || undefined);
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi hệ thống khi tạo đề xuất.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tạo đề xuất xử lý vật tư thừa"
      width="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={submitting}>
            Xác nhận tạo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          <p className="font-semibold mb-1">Dự án: {projectName}</p>
          <p>
            Hệ thống sẽ <strong>tự động lấy toàn bộ vật tư đang có trong kho</strong> (số lượng &gt; 0)
            của dự án này để tạo đợt xử lý. Bạn không thể tạo đợt mới khi dự án đang có
            đợt xử lý chưa hoàn tất.
          </p>
        </div>

        <FormItem label="Lý do xử lý vật tư thừa">
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="VD: Dự án chuẩn bị kết thúc giai đoạn, cần thanh lý vật tư..."
            disabled={submitting}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            maxLength={500}
          />
          <p className="text-xs text-slate-400 text-right mt-0.5">{reason.length}/500</p>
        </FormItem>
      </div>
    </Modal>
  );
};
