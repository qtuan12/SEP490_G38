import React, { useState, useEffect } from 'react';
import { Modal, Button, FormItem } from '../../../components/ui';
import { inventoryAdjustmentService } from '../../../services/inventoryAdjustmentService';
import { inventoryService } from '../../../services/inventoryService';
import { projectService } from '../../../services/projectService';
import { masterDataService } from '../../../services/masterDataService';
import { directPurchaseService } from '../../../services/directPurchaseService';
import type { CurrentInventory } from '../../../types/inventory';
import type { IncidentReport } from '../../../types/common';
import type { MaterialCatalog } from '../../../types/masterData';
import { Search, X } from 'lucide-react';
import { isDiscreteUnit } from '../../../utils/unitHelpers';
import { LazyImage } from '../../../utils/imageOptimizer';
import { parseInventoryIncidentDamage } from '../../../utils/inventoryIncidentDamage';

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
  const [masterMaterials, setMasterMaterials] = useState<MaterialCatalog[]>([]);
  const [phases, setPhases] = useState<any[]>([]);

  const [reason, setReason] = useState('Cân bằng tồn kho sau kiểm kê định kỳ');
  const [presetReason, setPresetReason] = useState<string>('Cân bằng tồn kho sau kiểm kê định kỳ');
  const [customReason, setCustomReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [phaseId, setPhaseId] = useState<number | ''>(incident ? (incident as any).phaseId || '' : '');
  const [createdAdjustmentId, setCreatedAdjustmentId] = useState<number | null>(null);
  const [items, setItems] = useState<{ materialId: number; unitId: number; quantity: number; fallbackCode?: string; fallbackName?: string; fallbackUnit?: string }[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number | ''>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [phaseMaterials, setPhaseMaterials] = useState<{
    materialId: number;
    materialCode: string;
    materialName: string;
    unitId: number;
    unitName: string;
    stockQuantity: number;
  }[]>([]);
  const [loadingPhaseMaterials, setLoadingPhaseMaterials] = useState(false);

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

  useEffect(() => {
    if (phaseId && projectId) {
      setLoadingPhaseMaterials(true);
      directPurchaseService.getPhaseBOQ(projectId, Number(phaseId))
        .then(boqItems => {
          const invMap = new Map<number, number>();
          (inventoryList || []).forEach(inv => {
            const qty = inv.availableQuantity ?? inv.quantity ?? 0;
            invMap.set(inv.materialId, qty);
          });

          const boqMaterialIds = new Set((boqItems || []).map(b => b.materialId));
          const mapped = (boqItems || []).map(boq => ({
            materialId: boq.materialId,
            materialCode: boq.materialCode,
            materialName: boq.materialName,
            unitId: boq.unitId,
            unitName: boq.unitName,
            // CurrentInventory is stored in the base unit; show/validate in the BOQ unit.
            stockQuantity: (invMap.get(boq.materialId) || 0) * (boq.conversionRate || 1)
          }));

          (inventoryList || []).forEach(inv => {
            if (!boqMaterialIds.has(inv.materialId)) {
              mapped.push({
                materialId: inv.materialId,
                materialCode: inv.materialCode,
                materialName: inv.materialName,
                unitId: inv.unitId,
                unitName: inv.unitName,
                stockQuantity: inv.availableQuantity ?? inv.quantity ?? 0
              });
            }
          });

          setPhaseMaterials(mapped);
        })
        .catch(err => {
          console.error('[CreateDecreaseAdjustmentModal] Fetch phase BOQ error:', err);
          setPhaseMaterials([]);
        })
        .finally(() => setLoadingPhaseMaterials(false));
    } else {
      setPhaseMaterials([]);
    }
  }, [phaseId, projectId, inventoryList]);

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
      const incidentPhaseId = incident?.phaseId ? Number(incident.phaseId) : 0;
      const [invData, phaseData, matCatalogRes, incidentBoqItems] = await Promise.all([
        inventoryService.getCurrentInventory(projectId).catch(() => []),
        projectService.getPhases(projectId.toString()).catch(() => []),
        masterDataService.getMaterials({ pageSize: 1000 }).catch(() => ({ items: [] })),
        incidentPhaseId
          ? directPurchaseService.getPhaseBOQ(projectId, incidentPhaseId).catch(() => [])
          : Promise.resolve([])
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
        const newItems: { materialId: number; unitId: number; quantity: number; fallbackCode?: string; fallbackName?: string; fallbackUnit?: string }[] = [];
        const damageItems = parseInventoryIncidentDamage(incident.damageDescription);
        const incidentItems = damageItems.length > 0
          ? damageItems
          : parseInventoryIncidentDamage(incident.description);

        for (const damageItem of incidentItems) {
          // V2 reports carry stable IDs. Legacy reports still resolve by code/name.
          const invItem = (invData || []).find((inventoryItem: CurrentInventory) =>
            (damageItem.materialId != null && inventoryItem.materialId === damageItem.materialId)
            || inventoryItem.materialCode.toLowerCase() === damageItem.materialCode.toLowerCase()
            || inventoryItem.materialName.toLowerCase() === damageItem.materialName.toLowerCase()
          );
          const catItem = catItems.find((catalogItem: MaterialCatalog) =>
            (damageItem.materialId != null && catalogItem.materialId === damageItem.materialId)
            || catalogItem.code.toLowerCase() === damageItem.materialCode.toLowerCase()
            || catalogItem.name.toLowerCase() === damageItem.materialName.toLowerCase()
          );

          const materialId = damageItem.materialId ?? invItem?.materialId ?? catItem?.materialId;
          if (!materialId || newItems.some(item => item.materialId === materialId)) continue;

          const boqItem = (incidentBoqItems || []).find(boq =>
            boq.materialId === materialId
            && (!damageItem.unitName || boq.unitName.toLowerCase() === damageItem.unitName.toLowerCase())
          );
          const unitId = damageItem.unitId ?? boqItem?.unitId ?? invItem?.unitId ?? catItem?.baseUnitId;
          if (!unitId) continue;

          newItems.push({
            materialId,
            unitId,
            quantity: damageItem.quantityLost,
            fallbackCode: invItem?.materialCode ?? catItem?.code ?? damageItem.materialCode,
            fallbackName: invItem?.materialName ?? catItem?.name ?? damageItem.materialName,
            fallbackUnit: damageItem.unitName || boqItem?.unitName || invItem?.unitName || catItem?.baseUnitName,
          });
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
    if (!phaseId) {
      setLocalError('Vui lòng chọn giai đoạn liên quan trước.');
      return;
    }

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
      setLocalError('Vật tư này đã được thêm vào danh sách.');
      return;
    }

    const currentMat = phaseMaterials.find(x => x.materialId === Number(selectedMaterialId));
    const inventoryItem = inventoryList.find(x => x.materialId === Number(selectedMaterialId));
    const stockQty = currentMat
      ? currentMat.stockQuantity
      : (inventoryItem?.availableQuantity ?? inventoryItem?.quantity ?? 0);

    if (stockQty <= 0) {
      setLocalError(`Vật tư "${currentMat?.materialName || 'này'}" không có trong kho (Tồn kho: 0), không thể giảm tồn.`);
      return;
    }

    if (Number(selectedQuantity) > stockQty) {
      setLocalError(`Số lượng giảm (${selectedQuantity}) vượt quá số lượng tồn kho hiện tại (${stockQty}).`);
      return;
    }

    if (currentMat && isDiscreteUnit(currentMat.unitName) && Number(selectedQuantity) % 1 !== 0) {
      setLocalError(`Đơn vị '${currentMat.unitName}' yêu cầu số lượng phải là số nguyên.`);
      return;
    }

    setLocalError(null);
    setItems([
      ...items,
      {
        materialId: Number(selectedMaterialId),
        unitId: currentMat?.unitId ?? inventoryItem?.unitId ?? 0,
        quantity: Number(selectedQuantity),
        fallbackCode: currentMat?.materialCode,
        fallbackName: currentMat?.materialName,
        fallbackUnit: currentMat?.unitName
      }
    ]);
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

    const itemWithoutUnit = items.find(item => item.unitId <= 0);
    if (itemWithoutUnit) {
      setLocalError('Có vật tư chưa cấu hình đơn vị tính.');
      return;
    }

    const insufficientItem = items.find(item => {
      const phaseMat = phaseMaterials.find(material => material.materialId === item.materialId);
      if (phaseMat) return item.quantity > phaseMat.stockQuantity;

      const inventoryItem = inventoryList.find(inventory => inventory.materialId === item.materialId);
      return item.quantity > (inventoryItem?.availableQuantity ?? inventoryItem?.quantity ?? 0);
    });
    if (insufficientItem) {
      setLocalError('Số lượng giảm vượt quá tồn kho khả dụng. Vui lòng tải lại và kiểm tra số lượng.');
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
            onChange={e => {
              const newPhaseId = e.target.value ? Number(e.target.value) : '';
              setPhaseId(newPhaseId);
              setSelectedMaterialId('');
              setSelectedQuantity('');
              setSearchKeyword('');
              setIsDropdownOpen(false);
              setItems([]);
            }}
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
                        <LazyImage src={img} alt={`Ảnh đính kèm ${idx + 1}`} widthOption={400} className="w-full h-full object-cover" />
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
            Danh sách vật tư giảm tồn {incident ? '(Được trích xuất từ sự cố)' : ''}
          </h4>
          {!incident && (
            <div className="flex flex-col gap-3 p-3.5 bg-slate-50 border border-gray-200 rounded-xl">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_90px] gap-3 items-end">
                {/* Search Input */}
                <div>
                  <FormItem label="Tìm kiếm vật tư cần giảm">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                      <input
                        type="text"
                        placeholder={
                          !phaseId
                            ? "-- Vui lòng chọn Giai đoạn trước --"
                            : loadingPhaseMaterials
                              ? "Đang tải danh sách vật tư..."
                              : "Tìm theo mã hoặc tên vật tư..."
                        }
                        className="w-full pl-9 pr-8 py-2 border rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        value={searchKeyword}
                        onChange={e => {
                          setSearchKeyword(e.target.value);
                          setSelectedMaterialId('');
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => {
                          if (phaseId && !loadingPhaseMaterials) setIsDropdownOpen(true);
                        }}
                        disabled={!phaseId || loadingPhaseMaterials}
                      />
                      {searchKeyword && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchKeyword('');
                            setSelectedMaterialId('');
                          }}
                          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 p-0.5"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </FormItem>
                </div>

                {/* Quantity Input */}
                <div>
                  <FormItem label="Số lượng giảm">
                    <input
                      type="number"
                      placeholder="0"
                      step={(() => {
                        const sel = phaseMaterials.find(x => x.materialId === Number(selectedMaterialId));
                        return sel && isDiscreteUnit(sel.unitName) ? "1" : "any";
                      })()}
                      className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed text-sm bg-white"
                      value={selectedQuantity}
                      onChange={e => setSelectedQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={!phaseId || !selectedMaterialId}
                    />
                  </FormItem>
                </div>

                {/* Add Button */}
                <Button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!phaseId || !selectedMaterialId || !selectedQuantity}
                  className="h-[38px] px-4 font-medium"
                >
                  Thêm
                </Button>
              </div>

              {/* Selected Banner */}
              {selectedMaterialId && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-2 px-3 text-xs animate-fade-in">
                  <div className="flex items-center gap-2 text-blue-900 font-medium">
                    <span className="font-semibold text-blue-700">Đã chọn:</span>
                    <span>{searchKeyword}</span>
                  </div>
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-800 font-semibold hover:underline text-[11px]"
                    onClick={() => {
                      setSelectedMaterialId('');
                      setSearchKeyword('');
                      setIsDropdownOpen(true);
                    }}
                  >
                    Đổi vật tư khác
                  </button>
                </div>
              )}

              {/* Inline Material Choice List Box (Fits smoothly within modal scroll container, no clipping) */}
              {isDropdownOpen && phaseId && !loadingPhaseMaterials && !selectedMaterialId && (
                <div className="flex flex-col gap-1 mt-1 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {searchKeyword.trim() ? "Kết quả tìm kiếm:" : "Vật tư thuộc giai đoạn (Nhấn để chọn):"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(false)}
                      className="text-[11px] text-gray-400 hover:text-gray-600 font-medium"
                    >
                      Đóng danh sách ✖
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-xl divide-y divide-gray-100 shadow-sm">
                    {phaseMaterials.filter(m =>
                      !searchKeyword.trim() ||
                      m.materialCode.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
                      m.materialName.toLowerCase().includes(searchKeyword.toLowerCase().trim())
                    ).length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-500">
                        {phaseMaterials.length === 0
                          ? "Giai đoạn này không có vật tư trong BOQ"
                          : "Không tìm thấy vật tư phù hợp với từ khóa"}
                      </div>
                    ) : (
                      phaseMaterials
                        .filter(m =>
                          !searchKeyword.trim() ||
                          m.materialCode.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
                          m.materialName.toLowerCase().includes(searchKeyword.toLowerCase().trim())
                        )
                        .map(mat => {
                          const isAlreadyAdded = items.some(x => x.materialId === mat.materialId);
                          return (
                            <div
                              key={mat.materialId}
                              className={`p-2 px-3 flex items-center justify-between cursor-pointer transition-colors ${isAlreadyAdded
                                ? 'bg-gray-50 opacity-60'
                                : 'hover:bg-blue-50/80 text-gray-800'
                                }`}
                              onClick={() => {
                                setSelectedMaterialId(mat.materialId);
                                setSearchKeyword(`[${mat.materialCode}] ${mat.materialName}`);
                                setIsDropdownOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold shrink-0">
                                  {mat.materialCode}
                                </span>
                                <span className="text-xs font-medium text-gray-900 truncate">{mat.materialName}</span>
                                <span className="text-[11px] text-gray-400 shrink-0">({mat.unitName})</span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {mat.stockQuantity > 0 ? (
                                  <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    Tồn: {mat.stockQuantity} {mat.unitName}
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                                    Tồn: 0 {mat.unitName}
                                  </span>
                                )}
                                {isAlreadyAdded ? (
                                  <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-medium">Đã thêm</span>
                                ) : (
                                  <span className="text-xs text-blue-600 font-semibold hover:underline">Chọn</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}
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
                  const phaseMat = phaseMaterials.find(x => x.materialId === item.materialId);
                  const invItem = inventoryList.find(x => x.materialId === item.materialId);
                  const catItem = masterMaterials.find(x => x.materialId === item.materialId);
                  const currentQty = phaseMat
                    ? phaseMat.stockQuantity
                    : (invItem?.availableQuantity ?? invItem?.quantity ?? 0);
                  const remainingQty = Math.max(0, currentQty - item.quantity);
                  const matCode = phaseMat?.materialCode || invItem?.materialCode || catItem?.code || item.fallbackCode || '-';
                  const matName = phaseMat?.materialName || invItem?.materialName || catItem?.name || item.fallbackName || '-';
                  const uName = phaseMat?.unitName || invItem?.unitName || catItem?.baseUnitName || item.fallbackUnit || '';

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
          <Button type="submit" variant="primary" isLoading={loading}>Xác Nhận</Button>
        </div>
      </form>
    </Modal>
  );
};
