import React, { useEffect, useState } from 'react';
import { Modal, Button, FormItem, Input } from '../../../components/ui';
import { AlertCircle } from 'lucide-react';
import { surplusService } from '../../../services/surplusService';
import { supplierService } from '../../../services/supplierService';
import type { SurplusRequestItem } from '../../../types/surplus';

interface CreateReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: SurplusRequestItem;
}

interface Supplier { supplierId: number; supplierName: string; }

export const CreateReturnModal: React.FC<CreateReturnModalProps> = ({
  isOpen, onClose, onSuccess, item,
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [returnQty, setReturnQty] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const remaining = item.quantity - item.processedQuantity;

  useEffect(() => {
    if (isOpen) {
      setSuppliers([]); setSupplierId(''); setReturnQty('');
      setRefundAmount(''); setNote(''); setError(null); setFiles([]);
      loadSuppliers();
    }
  }, [isOpen]);

  const loadSuppliers = async () => {
    try {
      const data = await supplierService.getSuppliers({ pageSize: 200 });
      setSuppliers(data.items.map(s => ({ supplierId: s.supplierId, supplierName: s.supplierName })));
    } catch { /* silent */ }
  };

  const handleSubmit = async () => {
    const qty = parseFloat(returnQty);
    if (isNaN(qty) || qty <= 0) { setError('Số lượng phải lớn hơn 0.'); return; }
    if (qty > remaining) { setError(`Số lượng không được vượt quá còn lại (${remaining} ${item.unitName}).`); return; }
    if (files.length === 0) { setError('Bắt buộc phải tải lên ít nhất 1 file minh chứng.'); return; }

    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (supplierId) formData.append('supplierId', supplierId);
      formData.append('returnQuantity', qty.toString());
      if (refundAmount) formData.append('refundAmount', refundAmount);
      if (note.trim()) formData.append('note', note.trim());
      files.forEach(f => formData.append('Attachments', f));

      await surplusService.createReturn(item.surplusRequestItemId, formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi hệ thống.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title="Xử lý trả Nhà Cung Cấp"
      width="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={submitting}>
            Xác nhận trả NCC
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

        {/* Item info */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          <span className="font-semibold text-slate-700">{item.materialName}</span>
          <span className="text-slate-500 ml-2">({item.materialCode})</span>
          <p className="text-slate-500 mt-1">
            Còn lại có thể xử lý: <strong className="text-orange-600">{remaining} {item.unitName}</strong>
          </p>
        </div>

        <FormItem label="Nhà cung cấp">
          <select
            value={supplierId}
            onChange={e => setSupplierId(e.target.value)}
            disabled={submitting}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Chọn NCC (không bắt buộc) --</option>
            {suppliers.map(s => (
              <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
            ))}
          </select>
        </FormItem>

        <div className="grid grid-cols-2 gap-3">
          <FormItem label="Số lượng trả" required>
            <Input
              type="number"
              step="any"
              min={0}
              max={remaining}
              value={returnQty}
              onChange={e => setReturnQty(e.target.value)}
              placeholder={`Tối đa ${remaining}`}
              disabled={submitting}
            />
          </FormItem>
          <FormItem label="Số tiền thu hồi (VNĐ)">
            <Input
              type="number"
              min={0}
              value={refundAmount}
              onChange={e => setRefundAmount(e.target.value)}
              placeholder="0"
              disabled={submitting}
            />
          </FormItem>
        </div>

        <FormItem label="Ghi chú">
          <textarea
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú thêm..."
            disabled={submitting}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </FormItem>

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
