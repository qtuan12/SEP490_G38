import React, { useState, useEffect } from 'react';
import { Modal, Button, FormItem } from '../../../components/ui';
import { inventoryAdjustmentService } from '../../../services/inventoryAdjustmentService';
import { inventoryService } from '../../../services/inventoryService';
import { projectService } from '../../../services/projectService';
import { masterDataService } from '../../../services/masterDataService';
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
  const [masterMaterials, setMasterMaterials] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);

  const [reason, setReason] = useState('Cân bằng tồn kho sau kiểm kê định kỳ');
  const [presetReason, setPresetReason] = useState<string>('Cân bằng tồn kho sau kiểm kê định kỳ');
  const [customReason, setCustomReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [phaseId, setPhaseId] = useState<number | ''>(incident ? (incident as any).phaseId || '' : '');
  const [createdAdjustmentId, setCreatedAdjustmentId] = useState<number | null>(null);
  const [items, setItems] = useState<{ materialId: number; quantity: number; fallbackCode?: string; fallbackName?: string; fallbackUnit?: string }[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number | ''>('');

  useEffect(() => {
    if (isOpen) {
      setLocalError(null);
      loadData();
      if (incident) {
        setReason('Xử lý sự cố');
        setPresetReason('Xử lý sự cố');
        setCustomReason('');
        setDescription('');
        setPhaseId(incident.phaseId ? Number(incident.phaseId) : '');
      } else {
        setReason('Cân bằng tồn kho sau kiểm kê định kỳ');
        setPresetReason('Cân bằng tồn kho sau kiểm kê định kỳ');
        setCustomReason('');
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
      const [invData, phaseData, matCatalogRes] = await Promise.all([
        inventoryService.getCurrentInventory(projectId).catch(() => []),
        projectService.getPhases(projectId.toString()).catch(() => []),
        masterDataService.getMaterials({ pageSize: 1000 }).catch(() => ({ items: [] }))
      ]);

      const catItems = matCatalogRes?.items || [];
      setInventoryList(invData || []);
      setMasterMaterials(catItems);

      const activePhases = (phaseData || []).filter((ph: any) => {
        const s = (ph.status || '').toLowerCase();
        const rawS = (ph.rawStatus || '').toLowerCase();
        const progress = ph.progress ?? ph.progressPercent ?? 0;
        const isFinished = s === 'frozen' || s === 'completed' || s === 'approved' || rawS === 'completed' || rawS === 'approved' || progress >= 100;
        return !isFinished;
      });
      setPhases(activePhases);

      // Auto-populate items from incident description/damageDescription
      const textToParse = [incident?.damageDescription, incident?.description].filter(Boolean).join('\n');
      if (incident && textToParse) {
        const lines = textToParse.split('\n');
        const newItems: { materialId: number; quantity: number; fallbackCode?: string; fallbackName?: string; fallbackUnit?: string }[] = [];
        for (const line of lines) {
          if (line.trim().startsWith('|') && !line.includes('Mã vật tư') && !line.includes('Mã VT') && !line.includes('---')) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 5) {
              const materialCode = parts[1];
              const materialName = parts[2];
              const unitName = parts[3];
              const qtyStr = parts[4].replace(/\*/g, ''); // remove **
              const qty = parseFloat(qtyStr);

              if ((materialCode || materialName) && !isNaN(qty) && qty > 0) {
                // Try to find materialId in inventory
                const invItem = (invData || []).find((x: CurrentInventory) =>
                  (materialCode && x.materialCode.toLowerCase() === materialCode.toLowerCase()) ||
                  (materialName && x.materialName.toLowerCase() === materialName.toLowerCase())
                );

                // Try to find in master catalog
                const catItem = catItems.find((x: any) =>
                  (materialCode && (x.code || x.materialCode)?.toLowerCase() === materialCode.toLowerCase()) ||
                  (materialName && x.name?.toLowerCase() === materialName.toLowerCase())
                );

                const foundMatId = invItem?.materialId || catItem?.materialId || (catItem as any)?.id;

                if (foundMatId) {
                  if (!newItems.some(x => x.materialId === foundMatId)) {
                    newItems.push({
                      materialId: foundMatId,
                      quantity: qty,
                      fallbackCode: invItem?.materialCode || catItem?.code || (catItem as any)?.materialCode || materialCode,
                      fallbackName: invItem?.materialName || catItem?.name || materialName,
                      fallbackUnit: invItem?.unitName || catItem?.baseUnitName || unitName
                    });
                  }
                }
              }
            }
          }
        }

        if (newItems.length > 0) {
          setItems(newItems);
        }
      }
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
      setLocalError('Số lượng giảm phải là số dương lớn hơn 0.');
      return;
    }

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
    if (!reason.trim()) {
      setLocalError('Vui lòng nhập lý do điều chỉnh.');
      return;
    }
    if (!phaseId) {
      setLocalError('Vui lòng chọn giai đoạn.');
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

      const actualIncidentId = incident ? (incident.id || (incident as any).incidentId) : null;
      const finalDesc = incident
        ? `${description}\n\n--- Thông tin sự cố gốc ---\n${originalIncidentDesc}\n\n[System] Liên kết sự cố #${actualIncidentId}`
        : description;

      let newAdjustmentId = createdAdjustmentId;

      if (!createdAdjustmentId) {
        const result = await inventoryAdjustmentService.createDecrease(projectId, {
          reason,
          description: finalDesc,
          phaseId: Number(phaseId),
          incidentId: actualIncidentId ? Number(actualIncidentId) : undefined,
          items
        });
        newAdjustmentId = (result as any).data || (result as any).id || 1;
        setCreatedAdjustmentId(newAdjustmentId);
      }

      // Nếu có incident, gọi confirmIncident để chuyển trạng thái từ WaitingAccountant → WaitingDirector
      // Chỉ gọi một lần duy nhất, KHÔNG gọi lại nếu đã tạo phiếu trước đó
      if (incident && !createdAdjustmentId) {
        try {
          await incidentService.confirmIncident(Number(incident.id || (incident as any).incidentId), {
            incidentId: Number(incident.id || (incident as any).incidentId),
            createReworkTask: false,
            handlingInstruction: description || 'Kế toán đã xác minh.'
          });
        } catch (confirmErr: any) {
          // Bỏ qua lỗi confirm nếu trạng thái đã chuyển (có thể do race condition)
          console.warn('[CreateDecreaseAdjustmentModal] confirmIncident error (ignored):', confirmErr?.message);
        }
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {localError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
            {localError}
          </div>
        )}

        <FormItem label="Lý do điều chỉnh (*)">
          {incident ? (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed font-medium text-gray-700"
              value={reason}
              disabled
            />
          ) : (
            <div className="flex flex-col gap-2">
              <select
                className="w-full px-3 py-2 border rounded-lg bg-white font-medium text-gray-800"
                value={presetReason}
                onChange={e => {
                  const val = e.target.value;
                  setPresetReason(val);
                  if (val !== 'Khác (Nhập lý do chi tiết)') {
                    setReason(val);
                  } else {
                    setReason(customReason);
                  }
                }}
              >
                <option value="Cân bằng tồn kho sau kiểm kê định kỳ">Cân bằng tồn kho sau kiểm kê định kỳ</option>
                <option value="Hao hụt vật tư trong định mức cho phép">Hao hụt vật tư trong định mức cho phép</option>
                <option value="Xuất hủy vật tư hết hạn / hư hỏng lưu kho">Xuất hủy vật tư hết hạn / hư hỏng lưu kho</option>
                <option value="Khác (Nhập lý do chi tiết)">Khác (Nhập lý do chi tiết)</option>
              </select>

              {presetReason === 'Khác (Nhập lý do chi tiết)' && (
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg animate-fade-in"
                  value={customReason}
                  onChange={e => {
                    setCustomReason(e.target.value);
                    setReason(e.target.value);
                  }}
                  placeholder="Nhập lý do chi tiết cụ thể..."
                  autoFocus
                />
              )}
            </div>
          )}
        </FormItem>

        <FormItem label="Giai đoạn liên quan (*)">
          <select
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
                    step={(() => {
                      const sel = inventoryList.find(x => x.materialId === Number(selectedMaterialId));
                      return sel && isDiscreteUnit(sel.unitName) ? "1" : "any";
                    })()}
                    className="w-full px-3 py-2 border rounded-lg"
                    value={selectedQuantity}
                    onChange={e => setSelectedQuantity(e.target.value === '' ? '' : Number(e.target.value))}
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
                  const catItem = masterMaterials.find(x => x.id === item.materialId);
                  const currentQty = invItem?.quantity ?? 0;
                  const remainingQty = Math.max(0, currentQty - item.quantity);
                  const matCode = invItem?.materialCode || catItem?.materialCode || item.fallbackCode || '-';
                  const matName = invItem?.materialName || catItem?.name || item.fallbackName || '-';
                  const uName = invItem?.unitName || catItem?.baseUnitName || item.fallbackUnit || '';

                  return (
                    <tr key={item.materialId}>
                      <td className="px-4 py-3 text-gray-500">{matCode}</td>
                      <td className="px-4 py-3 text-gray-900">{matName}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{currentQty} {uName}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">-{item.quantity} {uName}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-900">{remainingQty} {uName}</td>
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
