import React, { useState } from 'react';
import { Modal, Button } from '../../../components/ui';
import { surplusService } from '../../../services/surplusService';
import toast from 'react-hot-toast';
import { UploadCloud, FileText } from 'lucide-react';

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
  const [dragging, setDragging] = useState(false);

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('Bắt buộc phải tải lên file minh chứng phiếu xuất kho / ảnh chụp.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('Attachments', f));
      const result = await surplusService.dispatchTransfer(surplusTransferId, formData);
      toast.success(result.message || 'Xác nhận gửi vật tư điều chuyển thành công!');
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
          <div
            className={`mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files) {
                setFiles(Array.from(e.dataTransfer.files));
              }
            }}
            onClick={() => document.getElementById('dispatch-file-upload')?.click()}
          >
            <input
              id="dispatch-file-upload"
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => {
                if (e.target.files) {
                  setFiles(Array.from(e.target.files));
                }
              }}
              className="hidden"
              disabled={loading}
            />
            <UploadCloud size={28} className="text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium mb-1">
              Nhấn để chọn hoặc kéo thả file vào đây
            </p>
            <p className="text-xs text-slate-400">
              Hỗ trợ ảnh và PDF
            </p>
          </div>
          {files.length > 0 && (
            <ul className="mt-3 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
};
