import React, { useState, useEffect } from 'react';
import { Modal, Button, FormItem } from '../../../components/ui';
import { inventoryAdjustmentService } from '../../../services/inventoryAdjustmentService';
import { masterDataService } from '../../../services/masterDataService';
import { projectService } from '../../../services/projectService';
import { directPurchaseService } from '../../../services/directPurchaseService';
import type { PhaseBOQItemDto } from '../../../services/directPurchaseService';
import type { MaterialCatalog } from '../../../types/masterData';
import { isDiscreteUnit } from '../../../utils/unitHelpers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  onError?: (msg: string) => void;
  projectId: number;
}

export const CreateIncreaseAdjustmentModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, projectId }) => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<MaterialCatalog[]>([]);
  const [phases, setPhases] = useState<any[]>([]);

  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [phaseId, setPhaseId] = useState<number | ''>('');
  const [boqMaterials, setBoqMaterials] = useState<PhaseBOQItemDto[]>([]);
  const [loadingBOQ, setLoadingBOQ] = useState(false);
  const [items, setItems] = useState<{ materialId: number; quantity: number }[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number | ''>('');

  useEffect(() => {
    if (isOpen) {
      setLocalError(null);
      loadMaterials();
      loadPhases();
      setReason('');
      setDescription('');
      setPhaseId('');
      setBoqMaterials([]);
      setItems([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!phaseId) {
      setBoqMaterials([]);
      setSelectedMaterialId('');
      return;
    }
    setLoadingBOQ(true);
    setSelectedMaterialId('');
    directPurchaseService
      .getPhaseBOQ(projectId, Number(phaseId))
      .then(res => {
        setBoqMaterials(res || []);
      })
      .catch(err => {
        console.error('Lỗi khi tải BOQ theo giai đoạn:', err);
        setBoqMaterials([]);
      })
      .finally(() => setLoadingBOQ(false));
  }, [phaseId, projectId]);

  const loadPhases = async () => {
    try {
      const phaseData = await projectService.getPhases(projectId.toString());
      const activePhases = (phaseData || []).filter((ph: any) => {
        const s = (ph.status || '').toLowerCase();
        const rawS = (ph.rawStatus || '').toLowerCase();
        const progress = ph.progress ?? ph.progressPercent ?? 0;
        const isFinished = s === 'frozen' || s === 'completed' || s === 'approved' || rawS === 'completed' || rawS === 'approved' || progress >= 100;
        return !isFinished;
      });
      setPhases(activePhases);
    } catch (err) {
      console.error('Failed to load phases:', err);
    }
  };

  const loadMaterials = async () => {
    try {
      const res = await masterDataService.getMaterials({ pageSize: 1000 });
      setMaterials(res.items);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = () => {
    if (!selectedMaterialId) {
      setLocalError('Vui lòng chọn vật tư.');
      return;
    }

    if (selectedQuantity === '' || isNaN(Number(selectedQuantity)) || Number(selectedQuantity) <= 0) {
      setLocalError('Số lượng tăng phải là số dương lớn hơn 0.');
      return;
    }

    // Check if already exists
    if (items.some(x => x.materialId === Number(selectedMaterialId))) {
      setLocalError('Vật tư này đã được chọn.');
      return;
    }

    const selectedBoqMaterial = boqMaterials.find(x => x.materialId === Number(selectedMaterialId));
    const selectedCatalog = materials.find(x => x.materialId === Number(selectedMaterialId));
    const unitName = selectedBoqMaterial?.unitName || selectedCatalog?.baseUnitName || '';

    if (unitName && isDiscreteUnit(unitName) && Number(selectedQuantity) % 1 !== 0) {
      setLocalError(`Đơn vị '${unitName}' yêu cầu số lượng phải là số nguyên.`);
      return;
    }

    setLocalError(null);
    setItems([...items, { materialId: Number(selectedMaterialId), quantity: Number(selectedQuantity) }]);
    setSelectedMaterialId('');
    setSelectedQuantity('');
  };

  const handleRemoveItem = (id: number) => {
    setItems(items.filter(x => x.materialId !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseId) {
      setLocalError('Vui lòng chọn giai đoạn.');
      return;
    }
    if (!reason.trim()) {
      setLocalError('Vui lòng nhập lý do điều chỉnh.');
      return;
    }
    if (items.length === 0) {
      setLocalError('Vui lòng thêm ít nhất 1 vật tư.');
      return;
    }

    setLoading(true);
    setLocalError(null);
    try {
      const result = await inventoryAdjustmentService.createIncrease(projectId, {
        phaseId: Number(phaseId),
        reason,
        description,
        items
      });
      onSuccess(result.message);
    } catch (err: any) {
      setLocalError(err.message || 'Không thể tạo phiếu tăng tồn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo Phiếu Tăng Tồn Kho " width="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {localError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
            {localError}
          </div>
        )}

        <FormItem label="Chọn giai đoạn (*)">
          <select
            className="w-full px-3 py-2 border rounded-lg"
            value={phaseId}
            onChange={e => setPhaseId(Number(e.target.value))}
          >
            <option value="">-- Chọn giai đoạn --</option>
            {phases.map(ph => {
              const numId = typeof ph.id === 'string' ? parseInt(ph.id.replace('ph-', '')) || ph.id : ph.id;
              return (
                <option key={ph.id} value={numId}>{ph.name}</option>
              );
            })}
          </select>
        </FormItem>

        <FormItem label="Lý do điều chỉnh (*)">
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="VD: Nhập thêm vật tư từ kho tổng..."
          />
        </FormItem>

        <FormItem label="Mô tả / Ghi chú">
          <textarea
            className="w-full px-3 py-2 border rounded-lg"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
        </FormItem>

        <div className="border border-gray-800 rounded-2xl p-5 bg-white flex flex-col gap-3">
          <h4 className="font-semibold text-sm">Thêm vật tư (Theo BOQ giai đoạn)</h4>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <FormItem label="Vật tư">
                <select
                  className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                  value={selectedMaterialId}
                  onChange={e => setSelectedMaterialId(Number(e.target.value))}
                  disabled={!phaseId || loadingBOQ}
                >
                  {!phaseId ? (
                    <option value="">-- Vui lòng chọn giai đoạn trước --</option>
                  ) : loadingBOQ ? (
                    <option value="">Đang tải vật tư theo BOQ giai đoạn...</option>
                  ) : boqMaterials.length === 0 ? (
                    <option value="">Không có vật tư trong BOQ giai đoạn này</option>
                  ) : (
                    <>
                      <option value="">-- Chọn vật tư theo BOQ --</option>
                      {boqMaterials.map(m => (
                        <option key={m.materialId} value={m.materialId}>
                          {m.materialCode} - {m.materialName} ({m.unitName})
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </FormItem>
            </div>
            <div className="w-32">
              <FormItem label="Số lượng tăng">
                <input
                  type="number"
                  step={(() => {
                    const selBoq = boqMaterials.find(m => m.materialId === Number(selectedMaterialId));
                    const selCat = materials.find(m => m.materialId === Number(selectedMaterialId));
                    const unitName = selBoq?.unitName || selCat?.baseUnitName || '';
                    return unitName && isDiscreteUnit(unitName) ? "1" : "any";
                  })()}
                  className="w-full px-3 py-2 border rounded-lg"
                  value={selectedQuantity}
                  onChange={e => setSelectedQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </FormItem>
            </div>
            <Button type="button" variant="secondary" onClick={handleAddItem} disabled={!selectedMaterialId}>Thêm</Button>
          </div>

          {items.length > 0 && (
            <div className="mt-3 bg-white rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vật tư</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Số lượng</th>
                    <th className="px-4 py-3 w-16 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {items.map(it => {
                    const bm = boqMaterials.find(x => x.materialId === it.materialId);
                    const cm = materials.find(x => x.materialId === it.materialId);
                    const code = bm?.materialCode || cm?.code || '';
                    const name = bm?.materialName || cm?.name || '';
                    return (
                      <tr key={it.materialId}>
                        <td className="px-4 py-3 text-gray-900">{code ? `${code} - ${name}` : `Vật tư #${it.materialId}`}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{it.quantity}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" className="text-red-500 hover:underline" onClick={() => handleRemoveItem(it.materialId)}>Xóa</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary" isLoading={loading}>Tạo Phiếu Tăng</Button>
        </div>
      </form>
    </Modal>
  );
};
