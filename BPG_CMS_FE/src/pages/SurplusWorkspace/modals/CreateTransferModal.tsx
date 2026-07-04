import React, { useEffect, useState } from 'react';
import { Modal, Button, FormItem, Input, Select } from '../../../components/ui';
import { AlertCircle } from 'lucide-react';
import { surplusService } from '../../../services/surplusService';
import { projectService } from '../../../services/projectService';
import type { SurplusRequestItem } from '../../../types/surplus';

interface CreateTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: SurplusRequestItem;
  currentProjectId: number;
}

interface ProjectOption { id: number; name: string; }

export const CreateTransferModal: React.FC<CreateTransferModalProps> = ({
  isOpen, onClose, onSuccess, item, currentProjectId,
}) => {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [toProjectId, setToProjectId] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = item.quantity - item.processedQuantity;

  useEffect(() => {
    if (isOpen) {
      setToProjectId(''); setTransferQty(''); setError(null);
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    try {
      const data = await projectService.getProjects();
      // Exclude current project; id is string
      setProjects(
        data
          .filter((p: any) => p.id !== currentProjectId.toString() && p.status === 'inprogress')
          .map((p: any) => ({ id: Number(p.id), name: p.name }))
      );
    } catch { /* silent */ }
  };

  const handleSubmit = async () => {
    if (!toProjectId) { setError('Vui lòng chọn dự án nhận.'); return; }
    const qty = parseFloat(transferQty);
    if (isNaN(qty) || qty <= 0) { setError('Số lượng phải lớn hơn 0.'); return; }
    if (qty > remaining) { setError(`Số lượng không được vượt quá còn lại (${remaining} ${item.unitName}).`); return; }

    setError(null);
    setSubmitting(true);
    try {
      await surplusService.createTransfer(item.surplusRequestItemId, {
        toProjectId: Number(toProjectId),
        transferQuantity: qty,
      });
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
      title="Đề xuất chuyển kho"
      width="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={submitting}>
            Tạo đề xuất chuyển kho
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

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          Đề xuất này sẽ được gửi cho <strong>TPKT phê duyệt</strong> trước khi tiến hành vận chuyển.
        </div>

        <FormItem label="Dự án nhận" required>
          <Select
            options={[
              { label: '-- Chọn dự án nhận --', value: '' },
              ...projects.map(p => ({ label: p.name, value: p.id.toString() })),
            ]}
            value={toProjectId}
            onChange={e => setToProjectId(e.target.value)}
            disabled={submitting}
          />
        </FormItem>

        <FormItem label="Số lượng chuyển" required>
          <Input
            type="number"
            step="any"
            min={0}
            max={remaining}
            value={transferQty}
            onChange={e => setTransferQty(e.target.value)}
            placeholder={`Tối đa ${remaining} ${item.unitName}`}
            disabled={submitting}
          />
        </FormItem>
      </div>
    </Modal>
  );
};
