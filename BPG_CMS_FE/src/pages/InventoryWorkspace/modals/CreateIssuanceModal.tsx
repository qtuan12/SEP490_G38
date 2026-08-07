import React, { useEffect, useState } from 'react';
import { Modal, Button, Input, FormItem, Select, LoadingSpinner } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import { projectService } from '../../../services/projectService';
import { materialService } from '../../../services/materialService';
import type { CurrentInventory } from '../../../types/inventory';
import type { WBSTask } from '../../../types/common';
import type { MaterialConversion } from '../../../types/material';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import { isDiscreteUnit } from '../../../utils/unitHelpers';
import { formatQuantity, isGreaterThanQuantity, parseQuantityInput } from '../../../utils/inventoryHelpers';

interface CreateIssuanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
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
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [selectedItems, setSelectedItems] = useState<IssuanceItemInput[]>([]);

  // Field-specific error states
  const [taskError, setTaskError] = useState<string | null>(null);
  const [purposeError, setPurposeError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFormData();
      setSelectedTaskId('');
      setTaskSearchQuery('');
      setIsTaskDropdownOpen(false);
      setPurpose('');
      setSelectedItems([]);
      setTaskError(null);
      setPurposeError(null);
      setItemsError(null);
      setGeneralError(null);
    }
  }, [isOpen]);

  const loadFormData = async () => {
    setLoadingData(true);
    setGeneralError(null);
    try {
      // 1. Fetch tasks
      const allTasks = await projectService.getTasks(`p-${projectId}`);
      // Lọc các công việc đang thi công hợp lệ (chưa bị khóa, chưa hoàn thành, chưa bị dừng/hủy, và đã xong các task tiền nhiệm)
      const inactiveStatuses = ['obsolete', 'completed', 'approved', 'done', 'paused', 'stopped', 'cancelled', 'canceled'];
      const activeTasks = allTasks.filter(t => {
        if (t.isLocked) return false;
        if ((t.progress ?? 0) >= 100) return false;
        const statusLower = (t.status || '').toLowerCase();
        if (inactiveStatuses.includes(statusLower)) return false;

        // Kiểm tra công việc tiền nhiệm (predecessor) chưa hoàn thành 100%
        if (t.predecessorTaskIds && t.predecessorTaskIds.length > 0) {
          const hasIncompletePredecessor = t.predecessorTaskIds.some(preId => {
            const predecessor = allTasks.find(p => p.id === String(preId) || p.id === `t-${preId}`);
            if (!predecessor) return false;
            return (predecessor.progress ?? 0) < 100 && (predecessor.status || '').toLowerCase() !== 'obsolete';
          });
          if (hasIncompletePredecessor) return false;
        }

        return true;
      });
      setTasks(activeTasks);

      // Tự động chọn task nếu có tham số tìm kiếm từ URL chuyển qua
      const searchTaskName = new URLSearchParams(window.location.search).get('search');
      if (searchTaskName) {
        const decodedSearch = decodeURIComponent(searchTaskName);
        const matchedTask = activeTasks.find(
          t => t.name.toLowerCase() === decodedSearch.toLowerCase()
        );
        if (matchedTask) {
          setSelectedTaskId(matchedTask.id);
          setTaskSearchQuery(matchedTask.name);
        }
      }

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
      const num = parseQuantityInput(val);

      let err: string | undefined = undefined;
      if (!val) {
        err = 'Vui lòng nhập số lượng.';
      } else if (isNaN(num) || num <= 0) {
        err = 'Số lượng xuất phải lớn hơn 0.';
      } else if (num < 0.001) {
        err = 'Số lượng xuất tối thiểu là 0.001.';
      } else if (isGreaterThanQuantity(num, item.maxQty)) {
        err = `Không vượt quá tồn khả dụng (${formatQuantity(item.maxQty)} ${item.unitName}).`;
      } else if (isDiscreteUnit(item.unitName) && num % 1 !== 0) {
        err = `Đơn vị "${item.unitName}" yêu cầu số lượng phải là số nguyên.`;
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
    setGeneralError(null);
    setTaskError(null);
    setPurposeError(null);
    setItemsError(null);

    let hasError = false;

    if (!selectedTaskId) {
      setTaskError('Vui lòng chọn công việc thi công.');
      hasError = true;
    }
    if (!purpose.trim()) {
      setPurposeError('Vui lòng nhập mục đích xuất kho.');
      hasError = true;
    }
    if (selectedItems.length === 0) {
      setItemsError('Vui lòng thêm ít nhất một vật tư xuất kho.');
      hasError = true;
    }

    // Check for errors in items
    const hasItemErrors = selectedItems.some(i => i.error || !i.quantity);
    if (hasItemErrors) {
      setItemsError('Vui lòng sửa các lỗi số lượng vật tư trước khi lưu.');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setSubmitting(true);

    try {
      // Chuẩn hóa TaskId (bỏ tiền tố 't-' nếu có)
      const numericTaskId = parseInt(selectedTaskId.replace('t-', ''));

      const result = await inventoryService.createMaterialIssuance({
        taskId: numericTaskId,
        purpose: purpose.trim(),
        items: selectedItems.map(i => ({
          materialId: i.materialId,
          unitId: i.unitId,
          quantity: parseQuantityInput(i.quantity),
          conversionRate: i.conversionRate
        }))
      });

      onSuccess(result.message);
      onClose();
    } catch (err: any) {
      console.error('Error creating material issuance:', err);
      setGeneralError(err.message || 'Không thể tạo phiếu xuất kho.');
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
        <LoadingSpinner size="md" label="Đang tải dữ liệu khởi tạo..." className="py-12" />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm text-left">
          {generalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormItem label="Công việc thi công liên quan" required error={taskError || undefined}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Gõ để tìm kiếm công việc..."
                  value={taskSearchQuery}
                  onChange={e => {
                    setTaskSearchQuery(e.target.value);
                    setSelectedTaskId(''); // Reset id khi người dùng đang gõ tìm kiếm mới
                    setTaskError(null);
                    setIsTaskDropdownOpen(true);
                  }}
                  onFocus={() => setIsTaskDropdownOpen(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setIsTaskDropdownOpen(false);
                      const current = tasks.find(t => t.id === selectedTaskId);
                      if (current) {
                        setTaskSearchQuery(current.name);
                      } else {
                        setTaskSearchQuery('');
                      }
                    }, 200);
                  }}
                  className={`block w-full rounded-md shadow-sm sm:text-sm pl-3 pr-10 py-2 border ${taskError ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} bg-white`}
                />
                <div className="absolute right-3 top-2.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isTaskDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {tasks.filter(t => 
                      t.name.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
                      (t.phaseName && t.phaseName.toLowerCase().includes(taskSearchQuery.toLowerCase()))
                    ).length > 0 ? (
                      tasks.filter(t => 
                        t.name.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
                        (t.phaseName && t.phaseName.toLowerCase().includes(taskSearchQuery.toLowerCase()))
                      ).map(t => (
                        <div
                          key={t.id}
                          onMouseDown={(e) => {
                            e.preventDefault(); // Ngăn sự kiện blur của input ẩn dropdown trước khi kịp chọn
                            setSelectedTaskId(t.id);
                            setTaskSearchQuery(t.name);
                            setTaskError(null);
                            setIsTaskDropdownOpen(false);
                          }}
                          className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 text-left"
                        >
                          <div className="font-semibold text-slate-800 text-xs">{t.name}</div>
                          {t.phaseName && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{t.phaseName}</div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-xs text-slate-400 text-center">
                        Không tìm thấy công việc nào
                      </div>
                    )}
                  </div>
                )}
              </div>
            </FormItem>

            <FormItem label="Mục đích xuất kho" required error={purposeError || undefined}>
              <Input
                value={purpose}
                onChange={e => {
                  setPurpose(e.target.value);
                  setPurposeError(null);
                }}
                placeholder="Ví dụ: Đổ bê tông móng, Xây tường trục A..."
                className={purposeError ? 'border-red-500 focus:ring-red-200' : ''}
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
                onClick={() => {
                  handleAddItem();
                  setItemsError(null);
                }}
                disabled={inventoryList.length === 0}
                className="flex items-center gap-1"
              >
                <Plus size={14} />
                <span>Thêm vật tư</span>
              </Button>
            </div>

            {itemsError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-red-600 text-xs font-medium flex items-center gap-1.5 mb-2 animate-fade-in">
                <AlertCircle size={14} className="shrink-0" />
                <span>{itemsError}</span>
              </div>
            )}

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
                              step={isDiscreteUnit(item.unitName) ? "1" : "any"}
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
                        {item.quantity && !isNaN(parseQuantityInput(item.quantity)) && parseQuantityInput(item.quantity) > 0 && !isGreaterThanQuantity(parseQuantityInput(item.quantity), item.maxQty) ? (
                          <span className="text-emerald-600 font-medium">
                            Còn lại sau xuất: {formatQuantity(item.maxQty - parseQuantityInput(item.quantity))} {item.unitName}
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
