import React, { useState } from 'react';
import { Modal, Button } from '../../../components/ui';
import { surplusService } from '../../../services/surplusService';
import toast from 'react-hot-toast';

interface DispatchTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  surplusTransferId: number;
}

export const DispatchTransferModal: React.FC<DispatchTransferModalProps> = ({
  isOpen, onClose, onSuccess, surplusTransferId
}) => {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('Bắt buộc phải tải lên file minh chứng phiếu xuất kho / ảnh chụp.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('Attachments', f));
      await surplusService.dispatchTransfer(surplusTransferId, formData);
      toast.success('Đã xác nhận gửi vật tư điều chuyển.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Không thể xác nhận gửi vật tư điều chuyển.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận đã gửi"
      width="md"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button variant="outline" onClick={onClose} disabled={loading}>Hủy</Button>
          <Button onClick={handleSubmit} isLoading={loading}>
            Xác nhận
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Vui lòng tải lên file minh chứng (phiếu xuất kho, ảnh chụp xe chở hàng, v.v.) trước khi xác nhận đã gửi.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            File minh chứng (Bắt buộc)
          </label>
          <input
            type="file"
            multiple
            onChange={(e) => {
              if (e.target.files) {
                setFiles(Array.from(e.target.files));
              }
            }}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          {files.length > 0 && (
            <ul className="mt-2 text-xs text-slate-500 list-disc list-inside">
              {files.map((f, i) => <li key={i}>{f.name}</li>)}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
};
