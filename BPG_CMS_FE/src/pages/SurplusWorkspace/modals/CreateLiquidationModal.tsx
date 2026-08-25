import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, Button, FormItem, Input } from '../../../components/ui';
import { AlertCircle, UploadCloud, FileText } from 'lucide-react';
import { isDiscreteUnit } from '../../../utils/unitHelpers';
import { getSurplusMaxActionQuantity } from '../../../utils/surplusHelpers';
import { surplusService } from '../../../services/surplusService';
import type { SurplusRequestItem } from '../../../types/surplus';

interface CreateLiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: SurplusRequestItem;
}

export const CreateLiquidationModal: React.FC<CreateLiquidationModalProps> = ({
  isOpen, onClose, onSuccess, item,
}) => {
  const [buyerName, setBuyerName] = useState('');
  const [liqQty, setLiqQty] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const remaining = item.quantity - item.processedQuantity;
  const maxLiquidationQuantity = getSurplusMaxActionQuantity(item);

  const handleClose = () => {
    if (submitting) return;
    setBuyerName(''); setLiqQty(''); setTotalAmount(''); setError(null); setFiles([]);
    onClose();
  };

  const handleSubmit = async () => {
    if (!buyerName.trim()) { setError('Vui lòng nhập tên người mua/đơn vị thu mua.'); return; }
    const qty = parseFloat(liqQty);
    if (isNaN(qty) || qty <= 0) { setError('Số lượng phải lớn hơn 0.'); return; }
    if (qty > maxLiquidationQuantity) { setError(`Số lượng tối đa có thể thanh lý trong đợt xử lý này là ${maxLiquidationQuantity} ${item.unitName}.`); return; }
    if (isDiscreteUnit(item.unitName) && qty % 1 !== 0) { setError(`Đơn vị tính '${item.unitName}' yêu cầu số lượng phải là số nguyên.`); return; }
    const amount = parseFloat(totalAmount.replace(/\./g, ''));
    if (isNaN(amount) || amount < 0) { setError('Giá trị thu hồi phải >= 0.'); return; }
    if (files.length === 0) { setError('Bắt buộc phải tải lên ít nhất 1 file minh chứng.'); return; }

    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('buyerName', buyerName.trim());
      formData.append('liquidationQuantity', qty.toString());
      formData.append('totalAmount', amount.toString());
      files.forEach(f => formData.append('Attachments', f));

      await surplusService.createLiquidation(item.surplusRequestItemId, formData);
      toast.success('Thanh lý vật tư thành công!');
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Không thể tạo phiếu thanh lý vật tư thừa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Xử lý thanh lý vật tư"
      width="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={submitting}>
            Xác nhận thanh lý
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

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          <span className="font-semibold text-slate-700">{item.materialName}</span>
          <span className="text-slate-500 ml-2">({item.materialCode})</span>
          <div className="mt-1 flex items-center gap-2 text-slate-600">
            <span>Còn lại trong đợt: <strong className="text-orange-600">{remaining.toLocaleString('vi-VN')} {item.unitName}</strong></span>
            <span className="text-slate-300">•</span>
            <span>Có thể thanh lý: <strong className="text-blue-600">{maxLiquidationQuantity.toLocaleString('vi-VN')} {item.unitName}</strong></span>
          </div>
        </div>

        <FormItem label="Tên người mua / Đơn vị thu mua" required>
          <Input
            value={buyerName}
            onChange={e => setBuyerName(e.target.value)}
            placeholder="VD: Công ty TNHH Vật tư A"
            disabled={submitting}
          />
        </FormItem>

        <div className="grid grid-cols-2 gap-3">
          <FormItem label="Số lượng thanh lý" required>
            <Input
              type="number"
              step={isDiscreteUnit(item.unitName) ? "1" : "any"}
              min={isDiscreteUnit(item.unitName) ? "1" : "0"}
              max={maxLiquidationQuantity}
              value={liqQty}
              onChange={e => setLiqQty(e.target.value)}
              placeholder={`Tối đa ${maxLiquidationQuantity}`}
              disabled={submitting}
            />
          </FormItem>
          <FormItem label="Giá trị thu hồi (VNĐ)" required>
            <Input
              type="text"
              value={totalAmount}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                setTotalAmount(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
              }}
              placeholder="0"
              disabled={submitting}
            />
          </FormItem>
        </div>

        <FormItem label="File minh chứng (Bắt buộc)" required>
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
            onClick={() => document.getElementById('liquidation-file-upload')?.click()}
          >
            <input
              id="liquidation-file-upload"
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => {
                if (e.target.files) {
                  setFiles(Array.from(e.target.files));
                }
              }}
              className="hidden"
              disabled={submitting}
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
        </FormItem>
      </div>
    </Modal>
  );
};
