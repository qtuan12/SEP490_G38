import React, { useEffect, useState } from 'react';
import { Modal, Button, Input, FormItem, Select } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import { projectService } from '../../../services/projectService';
import { materialService } from '../../../services/materialService';
import type { CurrentInventory } from '../../../types/inventory';
import type { WBSTask } from '../../../types/common';
import type { MaterialConversion } from '../../../types/material';
import { Trash2, Plus, AlertCircle, Loader2 } from 'lucide-react';

interface CreateIssuanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
}

interface IssuanceItemInput {
  materialId: number;
  materialName: string;
  unitId: number;
  unitName: string;
  baseUnitId: number;
  baseUnitName: string;
  quantity: string;
  maxQty: number; // Tồn khả dụng hiện có theo đơn vị được chọn
  conversionRate: number; // Tỉ lệ quy đổi về đơn vị cơ bản
  error?: string;
}

export const CreateIssuanceModal: React.FC<CreateIssuanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId
}) => {
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [inventoryList, setInventoryList] = useState<CurrentInventory[]>([]);
  const [conversionsMap, setConversionsMap] = useState<Record<number, MaterialConversion[]>>({});

  // Form states
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [purpose, setPurpose] = useState('');
  const [selectedItems, setSelectedItems] = useState<IssuanceItemInput[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFormData();
      setSelectedTaskId('');
      setPurpose('');
      setSelectedItems([]);
      setGeneralError(null);
    }
  }, [isOpen]);

  const loadFormData = async () => {
    setLoadingData(true);
    setGeneralError(null);
    try {
      // 1. Fetch tasks
      const allTasks = await projectService.getTasks(`p-${projectId}`);
      // Lọc các công việc đang thi công và chưa bị khóa
      const activeTasks = allTasks.filter(t => t.status !== 'obsolete' && !t.isLocked);
      setTasks(activeTasks);

      // 2. Fetch inventory list
      const inv = await inventoryService.getCurrentInventory(projectId);
      // Lọc các vật tư có tồn khả dụng (availableQuantity > 0)
      const availableInv = inv.filter(i => i.availableQuantity > 0);
      setInventoryList(availableInv);

      // 3. Tải trước bảng quy đổi đơn vị của các vật tư có trong kho
      const convsMap: Record<number, MaterialConversion[]> = {};
      await Promise.all(
        availableInv.map(async item => {
          try {
            const convs = await materialService.getConversions(item.materialId);
            convsMap[item.materialId] = convs;
          } catch (e) {
            console.error('Error preloading conversions for material', item.materialId, e);
          }
        })
      );
      setConversionsMap(convsMap);
    } catch (err: any) {
      console.error('Error loading data for issuance:', err);
      setGeneralError('Không thể tải danh sách công việc hoặc vật tư tồn kho.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddItem = () => {
    // Tìm vật tư đầu tiên chưa được chọn
    const unselected = inventoryList.find(
      inv => !selectedItems.some(item => item.materialId === inv.materialId)
    );

    if (!unselected) {
      setGeneralError('Tất cả vật tư có sẵn trong kho đã được thêm.');
      return;
    }

    setSelectedItems(prev => [
      ...prev,
      {
        materialId: unselected.materialId,
        materialName: unselected.materialName,
        unitId: unselected.unitId,
        unitName: unselected.unitName,
        baseUnitId: unselected.unitId,
        baseUnitName: unselected.unitName,
        quantity: '',
        maxQty: unselected.availableQuantity,
        conversionRate: 1
      }
    ]);
    setGeneralError(null);
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, idx) => idx !== index));
    setGeneralError(null);
  };

  const handleMaterialChange = (index: number, materialId: number) => {
    const inv = inventoryList.find(i => i.materialId === materialId);
    if (!inv) return;

    setSelectedItems(prev => {
      const copy = [...prev];
      copy[index] = {
        materialId: inv.materialId,
        materialName: inv.materialName,
        unitId: inv.unitId,
        unitName: inv.unitName,
        baseUnitId: inv.unitId,
        baseUnitName: inv.unitName,
        quantity: '',
        maxQty: inv.availableQuantity,
        conversionRate: 1,
        error: undefined
      };
      return copy;
    });
  };

  const handleUnitChange = (index: number, unitId: number) => {
    setSelectedItems(prev => {
      const copy = [...prev];
      const item = copy[index];

      let rate = 1;
      let unitName = item.baseUnitName;

      if (unitId !== item.baseUnitId) {
        const conv = (conversionsMap[item.materialId] || []).find(c => c.alternativeUnitId === unitId);
        if (conv && conv.conversionRate > 0) {
          rate = conv.conversionRate;
          unitName = conv.alternativeUnitName || `Đơn vị ${unitId}`;
        }
      }

      // Tính lại tồn khả dụng tối đa theo đơn vị mới: Tồn cơ bản * Tỷ lệ quy đổi
      const inv = inventoryList.find(i => i.materialId === item.materialId);
      const baseAvailable = inv ? inv.availableQuantity : 0;
      const newMaxQty = baseAvailable * rate;

      copy[index] = {
        ...item,
        unitId,
        unitName,
        conversionRate: rate,
        maxQty: newMaxQty,
        quantity: '', // reset quantity để bắt nhập lại theo đơn vị mới
        error: undefined
      };
      return copy;
    });
  };

  const handleQuantityChange = (index: number, val: string) => {
    setSelectedItems(prev => {
      const copy = [...prev];
      const item = copy[index];
      const num = parseFloat(val);

      let err: string | undefined = undefined;
      if (!val) {
        err = 'Vui lòng nhập số lượng.';
      } else if (isNaN(num) || num <= 0) {
        err = 'Số lượng xuất phải lớn hơn 0.';
      } else if (num < 0.001) {
        err = 'Số lượng xuất tối thiểu là 0.001.';
      } else if (num > item.maxQty) {
        err = `Không vượt quá tồn khả dụng (${item.maxQty.toFixed(3)} ${item.unitName}).`;
      }

      copy[index] = {
        ...item,
        quantity: val,
        error: err
      };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) {
      setGeneralError('Vui lòng chọn công việc thi công.');
      return;
    }
    if (!purpose.trim()) {
      setGeneralError('Vui lòng nhập mục đích xuất kho.');
      return;
    }
    if (selectedItems.length === 0) {
      setGeneralError('Vui lòng thêm ít nhất một vật tư xuất kho.');
      return;
    }

    // Check for errors in items
    const hasErrors = selectedItems.some(i => i.error || !i.quantity);
    if (hasErrors) {
      setGeneralError('Vui lòng sửa các lỗi số lượng vật tư trước khi lưu.');
      return;
    }

    setSubmitting(true);
    setGeneralError(null);

    try {
      // Chuẩn hóa TaskId (bỏ tiền tố 't-' nếu có)
      const numericTaskId = parseInt(selectedTaskId.replace('t-', ''));

      await inventoryService.createMaterialIssuance({
        taskId: numericTaskId,
        purpose: purpose.trim(),
        items: selectedItems.map(i => ({
          materialId: i.materialId,
          unitId: i.unitId,
          quantity: parseFloat(i.quantity),
          conversionRate: i.conversionRate
        }))
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating material issuance:', err);
      setGeneralError(err.message || 'Lỗi hệ thống khi tạo phiếu xuất kho.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title="Tạo Phiếu Xuất Kho Thi Công"
      width="lg"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Hủy bỏ
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={submitting} disabled={loadingData}>
            Xuất kho
          </Button>
        </div>
      }
    >
      {loadingData ? (
        <div className="flex justify-center items-center py-12 gap-3">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span className="text-slate-500 text-sm">Đang tải dữ liệu khởi tạo...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm text-left">
          {generalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormItem label="Công việc thi công liên quan (Task)" required>
              <select
                value={selectedTaskId}
                onChange={e => setSelectedTaskId(e.target.value)}
                className="block w-full rounded-md shadow-sm sm:text-sm transition-colors pl-3 pr-10 py-2 border border-gray-300 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">-- Chọn công việc --</option>
                {Object.entries(
                  tasks.reduce<Record<string, WBSTask[]>>((acc, t) => {
                    const phase = t.phaseName || 'Chưa phân nhóm';
                    if (!acc[phase]) acc[phase] = [];
                    acc[phase].push(t);
                    return acc;
                  }, {})
                ).map(([phaseName, phaseTasks]) => (
                  <optgroup key={phaseName} label={phaseName}>
                    {phaseTasks.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </FormItem>

            <FormItem label="Mục đích xuất kho" required>
              <Input
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="Ví dụ: Đổ bê tông móng, Xây tường trục A..."
              />
            </FormItem>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-slate-700">Danh sách vật tư xuất dùng</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                disabled={inventoryList.length === 0}
                className="flex items-center gap-1"
              >
                <Plus size={14} />
                <span>Thêm vật tư</span>
              </Button>
            </div>

            {selectedItems.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 italic">
                Chưa chọn vật tư nào. Bấm "Thêm vật tư" để bắt đầu.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
                {selectedItems.map((item, idx) => {
                  // Lọc ra các vật tư chưa được chọn ở các dòng khác để tránh trùng lặp
                  const availableOptions = inventoryList.filter(
                    inv => inv.materialId === item.materialId || !selectedItems.some((s, sIdx) => s.materialId === inv.materialId && sIdx !== idx)
                  );

                  return (
                    <div key={idx} className="flex flex-col gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="flex-grow">
                          <Select
                            options={availableOptions.map(o => ({
                              label: `${o.materialName} (Tồn: ${o.availableQuantity} ${o.unitName})`,
                              value: o.materialId.toString()
                            }))}
                            value={item.materialId.toString()}
                            onChange={e => handleMaterialChange(idx, parseInt(e.target.value))}
                            className="w-full text-xs py-1"
                          />
                        </div>

                        {/* Nhập số lượng & Chọn đơn vị side-by-side */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Ô nhập số lượng */}
                          <div className="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                            <input
                              type="number"
                              step="0.001"
                              placeholder="0.00"
                              value={item.quantity}
                              onChange={e => handleQuantityChange(idx, e.target.value)}
                              className="w-full bg-transparent border-none outline-none focus:ring-0 p-0 text-right text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          
                          {/* Ô chọn đơn vị */}
                          <div className="w-22 bg-white border border-slate-300 rounded-lg px-1.5 py-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                            <select
                              value={item.unitId.toString()}
                              onChange={e => handleUnitChange(idx, parseInt(e.target.value))}
                              className="w-full text-xs text-slate-600 font-semibold bg-transparent border-none outline-none focus:ring-0 p-0 cursor-pointer hover:text-slate-800"
                            >
                              <option value={item.baseUnitId.toString()}>{item.baseUnitName}</option>
                              {(conversionsMap[item.materialId] || []).map(conv => (
                                <option key={conv.alternativeUnitId} value={conv.alternativeUnitId.toString()}>
                                  {conv.alternativeUnitName || `Đơn vị ${conv.alternativeUnitId}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Dòng hiển thị thông tin tồn kho còn lại & lỗi validate */}
                      <div className="flex justify-between items-center px-1 text-xs min-h-[16px]">
                        {item.quantity && !isNaN(parseFloat(item.quantity)) && parseFloat(item.quantity) > 0 && parseFloat(item.quantity) <= item.maxQty ? (
                          <span className="text-emerald-600 font-medium">
                            Còn lại sau xuất: {(item.maxQty - parseFloat(item.quantity)).toFixed(3)} {item.unitName}
                          </span>
                        ) : (
                          <span></span>
                        )}

                        {item.error && (
                          <span className="text-red-600 ml-auto flex items-center gap-1 font-medium">
                            <AlertCircle size={12} />
                            {item.error}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
};
