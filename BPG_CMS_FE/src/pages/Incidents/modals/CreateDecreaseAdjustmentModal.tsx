import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Modal } from '../../../components/ui/Modal';
import { inventoryAdjustmentService } from '../../../services/inventoryAdjustmentService';
import { materialService } from '../../../services/materialService';
import type { IncidentReport } from '../../../types/common';
import type { MaterialCatalog } from '../../../types/material';
import { Trash2, Plus, Info } from 'lucide-react';

const schema = z.object({
  reason: z.string().min(5, 'Lý do phải có ít nhất 5 ký tự'),
  description: z.string().optional(),
  items: z.array(z.object({
    materialId: z.coerce.number().min(1, 'Vui lòng chọn vật tư'),
    quantity: z.coerce.number().min(0.01, 'Số lượng phải lớn hơn 0')
  })).min(1, 'Cần thêm ít nhất 1 vật tư')
});

type FormData = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentReport;
  projectId: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Parse vật tư từ Markdown table trong damageDescription.
 * Trả về danh sách { materialCode, quantity } để tìm materialId.
 */
function parseMaterialsFromMarkdown(md: string): { materialCode: string; quantity: number }[] {
  const result: { materialCode: string; quantity: number }[] = [];
  const lines = md.split('\n');
  let inTable = false;
  let headerParsed = false;

  for (const line of lines) {
    if (!line.startsWith('|')) { inTable = false; headerParsed = false; continue; }
    if (line.match(/^\|[-| ]+\|$/)) continue; // separator

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (!inTable) {
      // Check if this is a materials table header
      if (cells.some(c => c.toLowerCase().includes('mã vật tư') || c.toLowerCase().includes('ma vat tu'))) {
        inTable = true;
        headerParsed = true;
        continue;
      }
    }

    if (inTable && headerParsed && cells.length >= 4) {
      const code = cells[0];
      // quantity is in last column, strip markdown bold
      const rawQty = cells[cells.length - 1].replace(/\*\*/g, '');
      const qty = parseFloat(rawQty);
      if (code && !isNaN(qty) && qty > 0) {
        result.push({ materialCode: code, quantity: qty });
      }
    }
  }

  return result;
}

export const CreateDecreaseAdjustmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  incident,
  projectId,
  onSuccess,
  onError
}) => {
  const [materials, setMaterials] = useState<MaterialCatalog[]>([]);
  const [prePopulated, setPrePopulated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      materialService.getMaterials({ pageSize: 1000 }).then(res => {
        setMaterials(res.items);
      }).catch(err => console.error(err));
    }
  }, [isOpen]);

  const { register, handleSubmit, control, formState: { errors }, reset, setValue } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      reason: `Giảm tồn kho do sự cố #${incident.id}: ${incident.taskName}`,
      description: '',
      items: []
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Auto-populate items from Markdown table in damageDescription
  useEffect(() => {
    if (!isOpen || materials.length === 0 || prePopulated) return;

    const parsed = parseMaterialsFromMarkdown(incident.damageDescription || '');
    if (parsed.length > 0) {
      const matched = parsed
        .map(p => {
          const mat = materials.find(m => m.code?.toLowerCase() === p.materialCode.toLowerCase());
          return mat ? { materialId: mat.materialId, quantity: p.quantity } : null;
        })
        .filter(Boolean) as { materialId: number; quantity: number }[];

      if (matched.length > 0) {
        setValue('items', matched);
        setPrePopulated(true);
        toast.success(`Đã tự động điền ${matched.length} vật tư từ báo cáo PL.`);
        return;
      }
    }

    // Fallback: empty row
    if (fields.length === 0) {
      append({ materialId: 0, quantity: 0 });
    }
    setPrePopulated(true);
  }, [materials, isOpen, prePopulated]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      await inventoryAdjustmentService.createDecrease(Number(projectId), {
        incidentId: Number(incident.id),
        reason: data.reason,
        description: data.description,
        items: data.items
      });
    },
    onSuccess: () => {
      onSuccess('Tạo phiếu điều chỉnh giảm tồn thành công. Chờ Giám đốc phê duyệt.');
      reset();
      onClose();
    },
    onError: (err: any) => {
      onError(err.message || 'Lỗi khi tạo phiếu giảm tồn.');
    }
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

  const onInvalid = (errs: any) => {
    console.error('[CreateDecreaseAdjustmentModal] Validation errors:', errs);
    // Find deepest error message
    let msg = 'Vui lòng kiểm tra lại các trường bắt buộc.';
    if (errs.reason?.message) msg = errs.reason.message;
    else if (errs.items?.message) msg = errs.items.message;
    else if (Array.isArray(errs.items)) {
      const itemErr = errs.items.find((e: any) => e);
      if (itemErr?.materialId?.message) msg = `Dòng vật tư: ${itemErr.materialId.message}`;
      else if (itemErr?.quantity?.message) msg = `Dòng vật tư: ${itemErr.quantity.message}`;
    }
    toast.error(msg);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Xác minh & Tạo Phiếu Điều Chỉnh Giảm Tồn" width="lg">
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-4">

        {/* Incident summary */}
        <div style={{ padding: '12px 14px', background: 'hsl(210, 100%, 97%)', border: '1px solid hsl(210, 70%, 78%)', borderRadius: '8px', fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 700, color: 'hsl(210, 70%, 40%)', marginBottom: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Info size={14} /> Sự cố gốc cần xác minh
          </div>
          <div><strong>Hạng mục:</strong> {incident.taskName}</div>
          <div><strong>Báo cáo bởi:</strong> {incident.reporterName} · {incident.date}</div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Lý do giảm tồn <span className="text-red-500">*</span></label>
          <input
            type="text"
            className="input w-full"
            {...register('reason')}
          />
          {errors.reason && <span className="text-red-500 text-xs">{errors.reason.message}</span>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Ghi chú thêm của Kế toán</label>
          <textarea
            className="input w-full"
            rows={2}
            placeholder="Kế toán có thể bổ sung ghi chú xác minh tại đây..."
            {...register('description')}
          />
        </div>

        {/* Material items */}
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '12px', background: 'hsl(var(--bg-main)/0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--primary))' }}>
              Danh sách vật tư giảm tồn <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '6px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--bg-card))', cursor: 'pointer' }}
              onClick={() => append({ materialId: 0, quantity: 0 })}
            >
              <Plus size={13} /> Thêm vật tư
            </button>
          </div>

          {fields.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border))', borderRadius: '6px' }}>
              Chưa có vật tư nào. Nhấn "Thêm vật tư" hoặc kiểm tra dữ liệu báo cáo PL.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <select
                      className="input w-full text-sm"
                      {...register(`items.${index}.materialId`, { valueAsNumber: true })}
                    >
                      <option value={0} disabled>-- Chọn mã vật tư --</option>
                      {materials.map(m => (
                        <option key={m.materialId} value={m.materialId}>{m.code} - {m.name} ({m.baseUnitName})</option>
                      ))}
                    </select>
                    {errors.items?.[index]?.materialId && (
                      <span className="text-red-500 text-xs">{errors.items[index]?.materialId?.message}</span>
                    )}
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input w-full text-sm"
                      placeholder="Số lượng"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                    {errors.items?.[index]?.quantity && (
                      <span className="text-red-500 text-xs">{errors.items[index]?.quantity?.message}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700 p-2 border border-transparent hover:bg-red-50 rounded"
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {(errors.items as any)?.message && (
                <span className="text-red-500 text-xs mt-1">{(errors.items as any).message}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-[hsl(var(--border))]">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending || fields.length === 0}>
            {mutation.isPending ? 'Đang tạo phiếu...' : '📦 Xác minh & Tạo Phiếu Giảm Tồn'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
