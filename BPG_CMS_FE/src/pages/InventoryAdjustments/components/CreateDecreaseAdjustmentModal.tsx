import React, { useState, useEffect } from 'react';
import { Modal, Button, FormItem } from '../../../components/ui';
import { inventoryAdjustmentService } from '../../../services/inventoryAdjustmentService';
import { inventoryService } from '../../../services/inventoryService';
import { projectService } from '../../../services/projectService';
import type { CurrentInventory } from '../../../types/inventory';
import type { IncidentReport } from '../../../types/common';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (msg: string) => void;
  projectId: number;
}

export const CreateDecreaseAdjustmentModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, onError, projectId }) => {
  const [loading, setLoading] = useState(false);
  const [inventoryList, setInventoryList] = useState<CurrentInventory[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [incidentId, setIncidentId] = useState<number | ''>('');
  const [items, setItems] = useState<{ materialId: number; quantity: number }[]>([]);

  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number | ''>('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [invData, incData] = await Promise.all([
        inventoryService.getCurrentInventory(projectId),
        projectService.getIncidents(projectId.toString())
      ]);
      setInventoryList(invData);
      setIncidents(incData || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = () => {
    if (!selectedMaterialId || !selectedQuantity || selectedQuantity <= 0) return;
    
    // Check if already exists
    if (items.some(x => x.materialId === Number(selectedMaterialId))) {
      if (onError) onError('Vật tư này đã được chọn.');
      return;
    }

    const currentInv = inventoryList.find(x => x.materialId === Number(selectedMaterialId));
    if (!currentInv || currentInv.quantity < Number(selectedQuantity)) {
      alert('Số lượng giảm không được vượt quá số lượng tồn kho hiện tại.');
      return;
    }

    setItems([...items, { materialId: Number(selectedMaterialId), quantity: Number(selectedQuantity) }]);
    setSelectedMaterialId('');
    setSelectedQuantity('');
  };

  const handleRemoveItem = (id: number) => {
    setItems(items.filter(x => x.materialId !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentId) {
      if (onError) onError('Vui lòng chọn sự cố liên quan.');
      return;
    }
    if (items.length === 0) {
      if (onError) onError('Vui lòng thêm ít nhất 1 vật tư.');
      return;
    }

    setLoading(true);
    try {
      await inventoryAdjustmentService.createDecrease(projectId, {
        reason,
        description,
        incidentId: Number(incidentId),
        items
      });
      onSuccess();
    } catch (err: any) {
      if (onError) onError(err.message || 'Lỗi khi tạo phiếu giảm tồn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo Phiếu Giảm Tồn Kho (Kèm Sự cố)" width="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormItem label="Lý do điều chỉnh (*)">
          <input 
            type="text" 
            required 
            className="w-full px-3 py-2 border rounded-lg" 
            value={reason} 
            onChange={e => setReason(e.target.value)} 
            placeholder="VD: Hư hỏng vật tư do thời tiết..."
          />
        </FormItem>

        <FormItem label="Sự cố liên quan (*)">
          <select 
            required
            className="w-full px-3 py-2 border rounded-lg"
            value={incidentId}
            onChange={e => setIncidentId(Number(e.target.value))}
          >
            <option value="">-- Chọn sự cố --</option>
            {incidents.map(inc => (
              <option key={inc.id} value={inc.id}>{inc.incidentType} - {inc.taskName} ({inc.status})</option>
            ))}
          </select>
        </FormItem>

        <FormItem label="Mô tả / Ghi chú">
          <textarea 
            className="w-full px-3 py-2 border rounded-lg" 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            rows={2}
          />
        </FormItem>

        <div className="border rounded-xl p-4 bg-slate-50 flex flex-col gap-3">
          <h4 className="font-semibold text-sm">Thêm vật tư (Chỉ những vật tư đang có tồn kho)</h4>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <FormItem label="Vật tư">
                <select 
                  className="w-full px-3 py-2 border rounded-lg"
                  value={selectedMaterialId}
                  onChange={e => {
                    setSelectedMaterialId(Number(e.target.value));
                    setSelectedQuantity('');
                  }}
                >
                  <option value="">-- Chọn vật tư --</option>
                  {inventoryList.filter(x => x.quantity > 0).map(m => (
                    <option key={m.materialId} value={m.materialId}>{m.materialCode} - {m.materialName} (Tồn: {m.quantity})</option>
                  ))}
                </select>
              </FormItem>
            </div>
            <div className="w-32">
              <FormItem label="Số lượng giảm">
                <input 
                  type="number" 
                  min="0.01" 
                  step="0.01"
                  max={selectedMaterialId ? inventoryList.find(x => x.materialId === Number(selectedMaterialId))?.quantity : undefined}
                  className="w-full px-3 py-2 border rounded-lg"
                  value={selectedQuantity}
                  onChange={e => setSelectedQuantity(Number(e.target.value))}
                />
              </FormItem>
            </div>
            <Button type="button" variant="secondary" onClick={handleAddItem}>Thêm</Button>
          </div>

          {items.length > 0 && (
            <div className="mt-3 bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Vật tư</th>
                    <th className="px-3 py-2 text-right font-medium w-24">Số lượng</th>
                    <th className="px-3 py-2 w-16 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map(it => {
                    const m = inventoryList.find(x => x.materialId === it.materialId);
                    return (
                      <tr key={it.materialId}>
                        <td className="px-3 py-2">{m?.materialCode} - {m?.materialName}</td>
                        <td className="px-3 py-2 text-right">{it.quantity}</td>
                        <td className="px-3 py-2 text-center">
                          <button type="button" className="text-red-500 hover:underline" onClick={() => handleRemoveItem(it.materialId)}>Xóa</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary" isLoading={loading}>Tạo Phiếu Trình Duyệt</Button>
        </div>
      </form>
    </Modal>
  );
};
