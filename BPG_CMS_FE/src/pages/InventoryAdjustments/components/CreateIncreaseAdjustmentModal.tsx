import React, { useState, useEffect } from 'react';
import { Modal, Button, FormItem } from '../../../components/ui';
import { inventoryAdjustmentService } from '../../../services/inventoryAdjustmentService';
import { masterDataService } from '../../../services/masterDataService';
import type { MaterialCatalog } from '../../../types/masterData';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
}

export const CreateIncreaseAdjustmentModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, projectId }) => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<MaterialCatalog[]>([]);
  
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<{ materialId: number; quantity: number }[]>([]);

  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number | ''>('');

  useEffect(() => {
    if (isOpen) {
      loadMaterials();
    }
  }, [isOpen]);

  const loadMaterials = async () => {
    try {
      const res = await masterDataService.getMaterials({ pageSize: 1000 });
      setMaterials(res.items);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = () => {
    if (!selectedMaterialId || !selectedQuantity || selectedQuantity <= 0) return;
    
    // Check if already exists
    if (items.some(x => x.materialId === Number(selectedMaterialId))) {
      alert('Vật tư này đã được chọn.');
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
    if (items.length === 0) {
      alert('Vui lòng thêm ít nhất 1 vật tư.');
      return;
    }

    setLoading(true);
    try {
      await inventoryAdjustmentService.createIncrease(projectId, {
        reason,
        description,
        items
      });
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tạo phiếu tăng tồn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo Phiếu Tăng Tồn Kho (Auto Duyệt)" width="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormItem label="Lý do điều chỉnh (*)">
          <input 
            type="text" 
            required 
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

        <div className="border rounded-xl p-4 bg-slate-50 flex flex-col gap-3">
          <h4 className="font-semibold text-sm">Thêm vật tư</h4>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <FormItem label="Vật tư">
                <select 
                  className="w-full px-3 py-2 border rounded-lg"
                  value={selectedMaterialId}
                  onChange={e => setSelectedMaterialId(Number(e.target.value))}
                >
                  <option value="">-- Chọn vật tư --</option>
                  {materials.map(m => (
                    <option key={m.materialId} value={m.materialId}>{m.code} - {m.name}</option>
                  ))}
                </select>
              </FormItem>
            </div>
            <div className="w-32">
              <FormItem label="Số lượng tăng">
                <input 
                  type="number" 
                  min="0.01" 
                  step="0.01" 
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
                    const m = materials.find(x => x.materialId === it.materialId);
                    return (
                      <tr key={it.materialId}>
                        <td className="px-3 py-2">{m?.code} - {m?.name}</td>
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
          <Button type="submit" variant="primary" isLoading={loading}>Tạo Phiếu Tăng</Button>
        </div>
      </form>
    </Modal>
  );
};
