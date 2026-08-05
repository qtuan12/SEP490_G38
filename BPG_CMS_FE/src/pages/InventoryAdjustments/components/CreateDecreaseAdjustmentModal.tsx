import React, { useState, useEffect } from 'react';
import { Modal, Button, FormItem } from '../../../components/ui';
import { inventoryAdjustmentService } from '../../../services/inventoryAdjustmentService';
import { inventoryService } from '../../../services/inventoryService';
import { projectService } from '../../../services/projectService';
import type { CurrentInventory } from '../../../types/inventory';
import type { IncidentReport } from '../../../types/common';
import { incidentService } from '../../../services/incidentService';
import { isDiscreteUnit } from '../../../utils/unitHelpers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  onError?: (msg: string) => void;
  projectId: number;
  incident?: IncidentReport; // Optional incident to link
}

export const CreateDecreaseAdjustmentModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, projectId, incident }) => {
  const [loading, setLoading] = useState(false);
  const [inventoryList, setInventoryList] = useState<CurrentInventory[]>([]);
  const [phases, setPhases] = useState<any[]>([]);

  const [reason, setReason] = useState('Incident');
  const [description, setDescription] = useState('');
  const [phaseId, setPhaseId] = useState<number | ''>(incident ? (incident as any).phaseId || '' : '');
  const [createdAdjustmentId, setCreatedAdjustmentId] = useState<number | null>(null);
  const [items, setItems] = useState<{ materialId: number; quantity: number }[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number | ''>('');

  useEffect(() => {
    if (isOpen) {
      setLocalError(null);
      loadData();
      if (incident) {
        setReason('Xử lý sự cố');
        setDescription('');
        setPhaseId(incident.phaseId ? Number(incident.phaseId) : '');
      } else {
        setReason('');
        setDescription('');
        setPhaseId('');
        setItems([]);
      }
    }
  }, [isOpen, incident]);

  // Extract info from incident description for beautiful display
  let parsedDesc = incident?.description || '';
  let incidentTime = '';
  let witness = '';
  let location = '';

  if (incident) {
    const timeMatch = parsedDesc.match(/\*\*Ngày\/Giờ phát hiện:\*\*([^\r\n]+)/);
    if (timeMatch) incidentTime = timeMatch[1].trim();

    const witnessMatch = parsedDesc.match(/\*\*Người làm chứng\/Liên đới:\*\*([^\r\n]+)/);
    if (witnessMatch) witness = witnessMatch[1].trim();

    const locMatch = parsedDesc.match(/\*\*Vị trí kho\/Lô hàng:\*\*([^\r\n]+)/);
    if (locMatch) location = locMatch[1].trim();

    parsedDesc = parsedDesc.replace(/\*\*Ngày\/Giờ phát hiện:\*\*([^\r\n]+)/g, '');
    parsedDesc = parsedDesc.replace(/\*\*Người làm chứng\/Liên đới:\*\*([^\r\n]+)/g, '');
    parsedDesc = parsedDesc.replace(/\*\*Vị trí kho\/Lô hàng:\*\*([^\r\n]+)/g, '');

    parsedDesc = parsedDesc.replace('--- Thông tin sự cố gốc ---', '');
    parsedDesc = parsedDesc.replace(/\[System\] Liên kết sự cố #\d+/g, '');
    parsedDesc = parsedDesc.split('\n').filter(l => !l.startsWith('![')).join('\n').trim();
  }

  const loadData = async () => {
    try {
      const [invData, phaseData] = await Promise.all([
        inventoryService.getCurrentInventory(projectId),
        projectService.getPhases(projectId.toString())
      ]);
      setInventoryList(invData);
      setPhases(phaseData || []);

      // Auto-populate items from incident.damageDescription if available
      if (incident && incident.damageDescription && invData) {
        const lines = incident.damageDescription.split('\n');
        const newItems: { materialId: number; quantity: number }[] = [];
        for (const line of lines) {
          if (line.trim().startsWith('|') && !line.includes('Mã vật tư') && !line.includes('---')) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 5) {
              const materialCode = parts[1];
              const qtyStr = parts[4].replace(/\*/g, ''); // remove **
              const qty = parseFloat(qtyStr);

              if (materialCode && !isNaN(qty) && qty > 0) {
                const invItem = invData.find((x: CurrentInventory) => x.materialCode === materialCode);
                if (invItem) {
                  if (!newItems.some(x => x.materialId === invItem.materialId)) {
                    newItems.push({ materialId: invItem.materialId, quantity: qty });
                  }
                }
              }
            }
          }
        }

        if (newItems.length > 0) {
          // If items is empty, populate it automatically. We check items.length to not override user choices if they re-open?
          // Actually, we should just set it since this runs on load.
          setItems(newItems);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = () => {
    if (!selectedMaterialId || !selectedQuantity || selectedQuantity <= 0) return;

    // Check if already exists
    if (items.some(x => x.materialId === Number(selectedMaterialId))) {
      setLocalError('Vật tư này đã được chọn.');
      return;
    }

    const currentInv = inventoryList.find(x => x.materialId === Number(selectedMaterialId));
    if (!currentInv || currentInv.quantity < Number(selectedQuantity)) {
      setLocalError('Số lượng giảm không được vượt quá số lượng tồn kho hiện tại.');
      return;
    }

    if (currentInv && isDiscreteUnit(currentInv.unitName) && Number(selectedQuantity) % 1 !== 0) {
      setLocalError(`Đơn vị '${currentInv.unitName}' yêu cầu số lượng phải là số nguyên.`);
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
      setLocalError('Vui lòng chọn Giai đoạn (Phase).');
      return;
    }
    if (items.length === 0) {
      setLocalError('Vui lòng thêm ít nhất 1 vật tư.');
      return;
    }

    setLoading(true);
    setLocalError(null);
    try {
      let originalIncidentDesc = incident ? incident.description : '';
      if (incident && incident.images && incident.images.length > 0) {
        originalIncidentDesc += '\n\n**Hình ảnh đính kèm:**\n' + incident.images.map((url, i) => `![Ảnh ${i + 1}](${url})`).join('\n');
      }

      const finalDesc = incident
        ? `${description}\n\n--- Thông tin sự cố gốc ---\n${originalIncidentDesc}\n\n[System] Liên kết sự cố #${incident.id}`
        : description;

      let newAdjustmentId = createdAdjustmentId;

      if (!createdAdjustmentId) {
        const result = await inventoryAdjustmentService.createDecrease(projectId, {
          reason,
          description: finalDesc,
          phaseId: Number(phaseId),
          items
        });
        newAdjustmentId = (result as any).data || (result as any).id || 1; // store in case confirmIncident fails
        setCreatedAdjustmentId(newAdjustmentId);
      }

      if (incident) {
        await incidentService.confirmIncident(Number(incident.id || (incident as any).incidentId), {
          incidentId: Number(incident.id || (incident as any).incidentId),
          createReworkTask: false,
          handlingInstruction: description || 'Kế toán đã xác minh.'
        });
      }

      onSuccess(createdAdjustmentId ? 'Xác minh thành công' : 'Tạo phiếu điều chỉnh giảm tồn thành công, chờ phê duyệt');
    } catch (err: any) {
      setLocalError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo Phiếu Giảm Tồn Kho (Theo Giai đoạn)" width="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {localError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
            {localError}
          </div>
        )}

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

        <FormItem label="Giai đoạn liên quan (*)">
          <select
            required
            className={`w-full px-3 py-2 border rounded-lg ${incident ? 'bg-gray-100 cursor-not-allowed text-gray-600 font-medium appearance-none' : ''}`}
            value={phaseId}
            onChange={e => setPhaseId(Number(e.target.value))}
            disabled={!!incident}
          >
            <option value="">-- Chọn giai đoạn --</option>
            {phases.map(ph => {
              // phase id might be "ph-123" or "123" depending on mock/real, let's normalize to number
              const numId = typeof ph.id === 'string' ? parseInt(ph.id.replace('ph-', '')) || ph.id : ph.id;
              return (
                <option key={ph.id} value={numId}>{ph.name}</option>
              );
            })}
          </select>
        </FormItem>

        <FormItem label="Mô tả / Ghi chú của bạn">
          <textarea
            className="w-full px-3 py-2 border rounded-lg"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
        </FormItem>

        {incident && (
          <div className="border border-gray-800 rounded-2xl p-5 bg-slate-50 flex flex-col gap-4">
            <h4 className="font-semibold text-sm text-gray-900 border-b border-gray-300 pb-3">
              Thông tin sự cố đính kèm
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: incident.images && incident.images.length > 0 ? '1.8fr 1fr' : '1fr', gap: '20px' }}>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Người báo cáo</span>
                    <strong className="text-gray-900">{incident.reporterName || 'N/A'}</strong>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Ngày báo cáo</span>
                    <strong className="text-gray-900">{incident.date || 'N/A'}</strong>
                  </div>

                  {incidentTime && (
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Thời gian phát hiện</span>
                      <strong className="text-gray-900">{incidentTime}</strong>
                    </div>
                  )}
                  {location && (
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Vị trí / Lô hàng</span>
                      <strong className="text-gray-900">{location}</strong>
                    </div>
                  )}
                  {witness && (
                    <div className="flex flex-col gap-1 col-span-2">
                      <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Người làm chứng / Liên đới</span>
                      <strong className="text-gray-900">{witness}</strong>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Mô tả sự cố</span>
                  <div className="bg-white p-3 rounded-xl border border-gray-300 text-gray-800 whitespace-pre-wrap leading-relaxed text-sm">
                    {parsedDesc || 'Không có mô tả chi tiết'}
                  </div>
                </div>
              </div>

              {incident.images && incident.images.length > 0 && (
                <div className="border-l border-gray-300 pl-5 flex flex-col gap-2">
                  <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Hình ảnh đính kèm</span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {incident.images.map((img, idx) => (
                      <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-gray-300 hover:border-blue-500 transition-all">
                        <img src={img} alt={`Ảnh đính kèm ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border border-gray-800 rounded-2xl p-5 bg-white flex flex-col gap-3">
          <h4 className="font-semibold text-sm">
            Danh sách vật tư giảm tồn {incident ? '(Được trích xuất từ sự cố)' : '(Chỉ những vật tư đang có tồn kho)'}
          </h4>
          {!incident && (
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
                    {inventoryList.map(inv => (
                      <option key={inv.materialId} value={inv.materialId}>
                        [{inv.materialCode}] {inv.materialName} (Tồn: {inv.quantity} {inv.unitName})
                      </option>
                    ))}
                  </select>
                </FormItem>
              </div>
              <div className="w-32">
                <FormItem label="Số lượng giảm">
                  <input
                    type="number"
                    min={(() => {
                      const sel = inventoryList.find(x => x.materialId === Number(selectedMaterialId));
                      return sel && isDiscreteUnit(sel.unitName) ? "1" : "0.01";
                    })()}
                    step={(() => {
                      const sel = inventoryList.find(x => x.materialId === Number(selectedMaterialId));
                      return sel && isDiscreteUnit(sel.unitName) ? "1" : "any";
                    })()}
                    className="w-full px-3 py-2 border rounded-lg"
                    value={selectedQuantity}
                    onChange={e => setSelectedQuantity(Number(e.target.value))}
                  />
                </FormItem>
              </div>
              <Button type="button" onClick={handleAddItem} disabled={!selectedMaterialId || !selectedQuantity} className="h-[42px]">
                Thêm
              </Button>
            </div>
          )}

          <div className="mt-3 bg-white rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Mã VT</th>
                  <th className="px-4 py-3 text-left font-medium">Tên vật tư</th>
                  <th className="px-4 py-3 text-center font-medium">Tồn kho trước giảm</th>
                  <th className="px-4 py-3 text-center font-medium">S.Lượng Giảm</th>
                  <th className="px-4 py-3 text-center font-medium">Tồn kho sau giảm</th>
                  {!incident && <th className="px-4 py-3 text-center font-medium w-16">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {items.map(item => {
                  const invItem = inventoryList.find(x => x.materialId === item.materialId);
                  const currentQty = invItem?.quantity ?? 0;
                  const remainingQty = Math.max(0, currentQty - item.quantity);
                  return (
                    <tr key={item.materialId}>
                      <td className="px-4 py-3 text-gray-500">{invItem?.materialCode}</td>
                      <td className="px-4 py-3 text-gray-900">{invItem?.materialName}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{currentQty} {invItem?.unitName}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">-{item.quantity} {invItem?.unitName}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-900">{remainingQty} {invItem?.unitName}</td>
                      {!incident && (
                        <td className="px-4 py-3 text-center">
                          <button type="button" className="text-red-500 hover:text-red-700" onClick={() => handleRemoveItem(item.materialId)}>
                            Xóa
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={!incident ? 6 : 5} className="text-center text-gray-500 py-3">Chưa có vật tư nào</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary" isLoading={loading}>Tạo Phiếu Trình Duyệt</Button>
        </div>
      </form>
    </Modal>
  );
};
