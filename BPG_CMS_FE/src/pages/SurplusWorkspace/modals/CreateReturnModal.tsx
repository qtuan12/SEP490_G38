import React, { useEffect, useState } from 'react';
import { Modal, Button, FormItem, Input } from '../../../components/ui';
import { AlertCircle, Loader2, UploadCloud, FileText } from 'lucide-react';
import { isDiscreteUnit } from '../../../utils/unitHelpers';
import { getSurplusMaxActionQuantity } from '../../../utils/surplusHelpers';
import { surplusService } from '../../../services/surplusService';
import type { ProjectReceivedSupplier, SurplusRequestItem } from '../../../types/surplus';

import toast from 'react-hot-toast';

interface CreateReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: SurplusRequestItem;
  projectId: number;
}

export const CreateReturnModal: React.FC<CreateReturnModalProps> = ({
  isOpen, onClose, onSuccess, item, projectId,
}) => {
  const [suppliers, setSuppliers] = useState<ProjectReceivedSupplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierLoadFailed, setSupplierLoadFailed] = useState(false);
  const [returnQty, setReturnQty] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const remaining = item.quantity - item.processedQuantity;
  const maxReturnQuantity = getSurplusMaxActionQuantity(item);

  useEffect(() => {
    if (isOpen) {
      setSupplierId('');
      setSuppliers([]);
      setSupplierLoadFailed(false);
      setReturnQty('');
      setRefundAmount(''); setNote(''); setError(null); setFiles([]);

      setLoadingSuppliers(true);
      surplusService.getProjectReceivedSuppliers(projectId)
        .then(setSuppliers)
        .catch(() => {
          setSupplierLoadFailed(true);
          setError('Không thể tải danh sách nhà cung cấp của dự án. Vui lòng thử lại.');
        })
        .finally(() => setLoadingSuppliers(false));
    }
  }, [isOpen, projectId]);

  const handleSubmit = async () => {
    if (!supplierId) { setError('Vui lòng chọn nhà cung cấp.'); return; }
    const qty = parseFloat(returnQty);
    if (isNaN(qty) || qty <= 0) { setError('Số lượng phải lớn hơn 0.'); return; }
    if (qty > maxReturnQuantity) { setError(`Số lượng tối đa có thể trả trong đợt xử lý này là ${maxReturnQuantity} ${item.unitName}.`); return; }
    if (isDiscreteUnit(item.unitName) && qty % 1 !== 0) { setError(`Đơn vị '${item.unitName}' yêu cầu số lượng phải là số nguyên.`); return; }
    if (files.length === 0) { setError('Bắt buộc phải tải lên ít nhất 1 file minh chứng.'); return; }

    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('supplierId', supplierId);
      formData.append('returnQuantity', qty.toString());
      if (refundAmount) formData.append('refundAmount', refundAmount.replace(/\./g, ''));
      if (note.trim()) formData.append('note', note.trim());
      files.forEach(f => formData.append('Attachments', f));

      await surplusService.createReturn(item.surplusRequestItemId, formData);
      toast.success('Tạo phiếu trả vật tư cho nhà cung cấp thành công!');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Không thể tạo phiếu trả vật tư cho nhà cung cấp.');
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
            Xác nhận trả nhà cung cấp
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
          <div className="mt-1 flex items-center gap-2 text-slate-600">
            <span>Còn lại trong đợt: <strong className="text-orange-600">{remaining.toLocaleString('vi-VN')} {item.unitName}</strong></span>
            <span className="text-slate-300">•</span>
            <span>Có thể trả: <strong className="text-blue-600">{maxReturnQuantity.toLocaleString('vi-VN')} {item.unitName}</strong></span>
          </div>
        </div>

        <FormItem label="Nhà cung cấp" required>
          <div className="relative">
            <select
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              disabled={submitting || loadingSuppliers}
              className="w-full appearance-auto rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                {loadingSuppliers
                  ? 'Đang tải nhà cung cấp...'
                  : supplierLoadFailed
                    ? 'Không thể tải danh sách nhà cung cấp'
                  : suppliers.length === 0
                    ? 'Dự án chưa có nhà cung cấp đã nhập hàng'
                    : '-- Chọn nhà cung cấp --'}
              </option>
              {suppliers.map(supplier => (
                <option key={supplier.supplierId} value={supplier.supplierId}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
            {loadingSuppliers && (
              <Loader2
                size={16}
                className="pointer-events-none absolute right-8 top-2.5 animate-spin text-slate-400"
              />
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Chỉ hiển thị nhà cung cấp đã có phiếu nhập kho được duyệt tại dự án này.
          </p>
        </FormItem>

        <div className="grid grid-cols-2 gap-3">
          <FormItem label="Số lượng trả" required>
            <Input
              type="number"
              step={isDiscreteUnit(item.unitName) ? "1" : "any"}
              min={isDiscreteUnit(item.unitName) ? "1" : "0"}
              max={maxReturnQuantity}
              value={returnQty}
              onChange={e => setReturnQty(e.target.value)}
              placeholder={`Tối đa ${maxReturnQuantity}`}
              disabled={submitting}
            />
          </FormItem>
          <FormItem label="Số tiền thu hồi (VNĐ)">
            <Input
              type="text"
              value={refundAmount}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                setRefundAmount(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
              }}
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
            onClick={() => document.getElementById('return-file-upload')?.click()}
          >
            <input
              id="return-file-upload"
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
