import React, { useEffect, useState } from 'react';
import { Modal, Button, Input, FormItem, Select } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import { projectService } from '../../../services/projectService';
import type { CurrentInventory } from '../../../types/inventory';
import type { WBSTask } from '../../../types/common';
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
  quantity: string;
  maxQty: number; // Tồn khả dụng hiện có
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
        quantity: '',
        maxQty: unselected.availableQuantity
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
        ...copy[index],
        materialId: inv.materialId,
        materialName: inv.materialName,
        unitId: inv.unitId,
        unitName: inv.unitName,
        quantity: '',
        maxQty: inv.availableQuantity,
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
      } else if (num > item.maxQty) {
        err = `Không vượt quá tồn khả dụng (${item.maxQty} ${item.unitName}).`;
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
      // Chuẩn hóaTaskId (bỏ tiền tố 't-' nếu có)
      const numericTaskId = parseInt(selectedTaskId.replace('t-', ''));

      await inventoryService.createMaterialIssuance({
        taskId: numericTaskId,
        purpose: purpose.trim(),
        items: selectedItems.map(i => ({
          materialId: i.materialId,
          unitId: i.unitId,
          quantity: parseFloat(i.quantity),
          conversionRate: 1 // default rate 1 for base unit issuance
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
              <Select
                options={[
                  { label: '-- Chọn công việc --', value: '' },
                  ...tasks.map(t => ({
                    label: t.name,
                    value: t.id
                  }))
                ]}
                value={selectedTaskId}
                onChange={e => setSelectedTaskId(e.target.value)}
              />
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

                        <div className="w-32 flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-1">
                          <input
                            type="number"
                            step="any"
                            placeholder="Số lượng"
                            value={item.quantity}
                            onChange={e => handleQuantityChange(idx, e.target.value)}
                            className="w-full border-none outline-none focus:ring-0 text-right text-xs"
                          />
                          <span className="text-xs text-slate-500 font-medium shrink-0">{item.unitName}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {item.error && (
                        <span className="text-red-600 text-xs pl-1 flex items-center gap-1">
                          <AlertCircle size={12} />
                          {item.error}
                        </span>
                      )}
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
