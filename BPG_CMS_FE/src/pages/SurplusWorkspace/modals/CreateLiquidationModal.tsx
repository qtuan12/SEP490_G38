import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, Button, FormItem, Input } from '../../../components/ui';
import { AlertCircle } from 'lucide-react';
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
    if (qty > maxLiquidationQuantity) { setError(`Số lượng thanh lý tối đa là ${maxLiquidationQuantity} ${item.unitName} sau khi trừ phần đang tạm khóa.`); return; }
    if (isDiscreteUnit(item.unitName) && qty % 1 !== 0) { setError(`Đơn vị tính '${item.unitName}' yêu cầu số lượng phải là số nguyên.`); return; }
    const amount = parseFloat(totalAmount);
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
          <p className="text-slate-500 mt-1">
            Còn lại trong đợt: <strong className="text-orange-600">{remaining} {item.unitName}</strong>
            <span className="mx-2">•</span>
            Có thể thanh lý: <strong className="text-blue-600">{maxLiquidationQuantity} {item.unitName}</strong>
          </p>
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
              type="number"
              min={0}
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              placeholder="0"
              disabled={submitting}
            />
          </FormItem>
        </div>

        <FormItem label="File minh chứng (Bắt buộc)" required>
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={e => {
              if (e.target.files) {
                setFiles(Array.from(e.target.files));
              }
            }}
            disabled={submitting}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          {files.length > 0 && (
            <ul className="mt-2 text-sm text-slate-600 list-disc pl-5">
              {files.map((f, i) => <li key={i}>{f.name}</li>)}
            </ul>
          )}
        </FormItem>
      </div>
    </Modal>
  );
};
