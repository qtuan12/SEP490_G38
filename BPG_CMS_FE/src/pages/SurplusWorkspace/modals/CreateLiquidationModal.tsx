import React, { useState } from 'react';
import { Modal, Button, FormItem, Input } from '../../../components/ui';
import { AlertCircle } from 'lucide-react';
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

  const remaining = item.quantity - item.processedQuantity;

  const handleClose = () => {
    if (submitting) return;
    setBuyerName(''); setLiqQty(''); setTotalAmount(''); setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!buyerName.trim()) { setError('Vui lòng nhập tên người mua/đơn vị thu mua.'); return; }
    const qty = parseFloat(liqQty);
    if (isNaN(qty) || qty <= 0) { setError('Số lượng phải lớn hơn 0.'); return; }
    if (qty > remaining) { setError(`Số lượng không được vượt quá còn lại (${remaining} ${item.unitName}).`); return; }
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount < 0) { setError('Giá trị thu hồi phải >= 0.'); return; }

    setError(null);
    setSubmitting(true);
    try {
      await surplusService.createLiquidation(item.surplusRequestItemId, {
        buyerName: buyerName.trim(),
        liquidationQuantity: qty,
        totalAmount: amount,
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi hệ thống.');
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
            Còn lại: <strong className="text-orange-600">{remaining} {item.unitName}</strong>
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
              step="any"
              min={0}
              max={remaining}
              value={liqQty}
              onChange={e => setLiqQty(e.target.value)}
              placeholder={`Tối đa ${remaining}`}
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
      </div>
    </Modal>
  );
};
