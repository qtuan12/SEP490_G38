import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Modal, Textarea } from '../../components/ui';
import { phaseAcceptanceService } from '../../services/phaseAcceptanceService';

interface CancelAcceptanceModalProps {
  acceptanceId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CancelAcceptanceModal: React.FC<CancelAcceptanceModalProps> = ({
  acceptanceId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cancelMutation = useMutation({
    mutationFn: () => phaseAcceptanceService.cancelAcceptance(acceptanceId, { cancellationReason: reason }),
    onSuccess: (message) => {
      console.log(message || 'Đã hủy biên bản nghiệm thu.');
      onSuccess();
    },
    onError: (error: any) => {
      setErrorMsg(error.message || 'Không thể hủy biên bản nghiệm thu.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập lý do hủy');
      return;
    }
    setErrorMsg(null);
    cancelMutation.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Hủy Nghiệm thu (ID: ${acceptanceId})`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-red-50 p-4 rounded-md border border-red-100">
          <p className="text-sm text-red-800 font-medium">Lưu ý quan trọng:</p>
          <ul className="list-disc list-inside text-sm text-red-700 mt-1">
            <li>Hành động này không thể hoàn tác.</li>
            <li>Giai đoạn sẽ được mở khóa (InProgress) và tiếp tục thi công.</li>
            <li>Chỉ cho phép hủy trong vòng 7 ngày kể từ khi nghiệm thu.</li>
          </ul>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lý do hủy
          </label>
          <Textarea
            placeholder="Nhập lý do chi tiết..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            required
            rows={4}
          />
          {errorMsg && (
            <div className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded p-2.5 mt-2">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[hsl(var(--border-light))]">
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="submit"
            variant="danger"
            isLoading={cancelMutation.isPending}
            disabled={!reason.trim()}
          >
            Xác nhận Hủy
          </Button>
        </div>
      </form>
    </Modal>
  );
};
