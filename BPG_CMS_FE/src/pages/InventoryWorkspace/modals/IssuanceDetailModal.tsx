import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Input, FormItem } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import { formatDateVN, formatQuantity, isGreaterThanQuantity, parseQuantityInput } from '../../../utils/inventoryHelpers';
import type { MaterialIssuanceDetail, MaterialIssuanceItemDetail, MaterialReturn } from '../../../types/inventory';
import {
  Calendar,
  User,
  FileText,
  Briefcase,
  Loader2,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRealtimeDataRefresh } from '../../../hooks/useRealtimeDataRefresh';
import { RealtimeEntities } from '../../../constants/realtimeEntities';

const MATERIAL_ISSUANCE_REALTIME_ENTITIES = RealtimeEntities.inventory.filter(
  entity => [
    'MaterialIssuance',
    'MaterialIssuanceItem',
    'MaterialReturn',
    'MaterialReturnItem',
  ].includes(entity),
);

interface IssuanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  issuanceId: number | null;
  projectId?: number;
  canReturnMaterial?: boolean;
  onSuccess?: () => void; // Triggered when a return succeeds, to refresh parent lists
}

interface ReturnItemInput {
  materialId: number;
  materialCode: string;
  materialName: string;
  unitId: number;
  unitName: string;
  conversionRate: number;
  maxReturnableQty: number;
  quantity: string;
  error?: string | null;
}

export const IssuanceDetailModal: React.FC<IssuanceDetailModalProps> = ({
  isOpen,
  onClose,
  issuanceId,
  canReturnMaterial = false,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<MaterialIssuanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Return history
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [returns, setReturns] = useState<MaterialReturn[]>([]);

  // Side-by-side mode control
  const [isReturning, setIsReturning] = useState(false);
  const isReturningRef = useRef(false);
  isReturningRef.current = isReturning;

  // Return form states
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemInput[]>([]);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && issuanceId) {
      fetchDetailAndHistory();
      setIsReturning(false);
      resetReturnForm();
    }
  }, [isOpen, issuanceId]);

  const resetReturnForm = () => {
    setReason('');
    setReasonError(null);
    setReturnError(null);
    setReturnItems(prev => prev.map(item => ({
      ...item,
      quantity: '',
      error: null
    })));
  };

  const fetchDetailAndHistory = async (showLoading = true, preserveReturnForm = false) => {
    if (!issuanceId) return;
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const [issuanceData, returnsData] = await Promise.all([
        inventoryService.getMaterialIssuanceDetail(issuanceId),
        inventoryService.getMaterialReturns({ issuanceId, pageSize: 100 })
      ]);
      
      setDetail(issuanceData);
      const prevReturns = returnsData.items ?? [];
      setReturns(prevReturns);
      setError(null);

      // Initialize return items calculation based on remaining qty
      const items: ReturnItemInput[] = issuanceData.items.map((i: MaterialIssuanceItemDetail) => {
        const totalReturned = prevReturns.reduce((sum, ret) => {
          const matchedItem = ret.items?.find(ri => ri.materialId === i.materialId);
          return sum + (matchedItem ? matchedItem.quantity : 0);
        }, 0);

        const maxReturnable = Math.max(0, i.quantity - totalReturned);

        return {
          materialId: i.materialId,
          materialCode: i.materialCode,
          materialName: i.materialName,
          unitId: i.unitId,
          unitName: i.unitName,
          conversionRate: i.conversionRate,
          maxReturnableQty: maxReturnable,
          quantity: ''
        };
      });

      // Do not let an earlier realtime request overwrite a return form that the
      // user opened while that request was still in flight.
      if (!preserveReturnForm || !isReturningRef.current) {
        setReturnItems(items);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      if (showLoading) setError(err.message || 'Không thể tải chi tiết phiếu xuất kho.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useRealtimeDataRefresh(
    () => {
      // Never overwrite quantities/reason while the return form is being filled.
      if (!isOpen || !issuanceId || isReturning) return;
      return fetchDetailAndHistory(false, true);
    },
    MATERIAL_ISSUANCE_REALTIME_ENTITIES,
  );

  const refreshReturnsOnly = async () => {
    if (!issuanceId || !detail) return;
    setLoadingReturns(true);
    try {
      const res = await inventoryService.getMaterialReturns({ issuanceId, pageSize: 100 });
      const prevReturns = res.items ?? [];
      setReturns(prevReturns);

      // Re-calc remaining balances on current items
      setReturnItems(prevItems =>
        prevItems.map(item => {
          const previouslyReturned = prevReturns.reduce((sum, ret) => {
            const matchedItem = ret.items?.find(ri => ri.materialId === item.materialId);
            return sum + (matchedItem ? matchedItem.quantity : 0);
          }, 0);

          const originalItem = detail.items.find(i => i.materialId === item.materialId);
          const originalQty = originalItem ? originalItem.quantity : 0;
          const maxReturnable = Math.max(0, originalQty - previouslyReturned);

          return {
            ...item,
            maxReturnableQty: maxReturnable,
            quantity: isGreaterThanQuantity(parseQuantityInput(item.quantity), maxReturnable) ? '' : item.quantity,
            error: null
          };
        })
      );
    } catch (err) {
      console.error('Error fetching returns:', err);
    } finally {
      setLoadingReturns(false);
    }
  };

  const handleQtyChange = (index: number, val: string, maxQty: number) => {
    setReturnItems(prev => {
      const copy = [...prev];
      const item = copy[index];
      let err: string | null = null;

      if (val !== '') {
        const parsed = parseQuantityInput(val);
        if (isNaN(parsed) || parsed <= 0) {
          err = 'Số lượng phải lớn hơn 0.';
        } else if (isGreaterThanQuantity(parsed, maxQty)) {
          err = `Tối đa: ${formatQuantity(maxQty)}`;
        }
      }

      copy[index] = { ...item, quantity: val, error: err };
      return copy;
    });
    setReturnError(null);
  };

  const handleReturnSubmit = async () => {
    setReturnError(null);
    setReasonError(null);

    if (!reason.trim()) {
      setReasonError('Vui lòng nhập lý do hoàn trả.');
      return;
    }

    const activeItems = returnItems.filter(i => i.quantity !== '');
    if (activeItems.length === 0) {
      setReturnError('Vui lòng nhập số lượng hoàn trả cho ít nhất một vật tư.');
      return;
    }

    const hasErrors = returnItems.some(i => i.error);
    if (hasErrors) {
      setReturnError('Vui lòng sửa các lỗi nhập liệu trước khi gửi.');
      return;
    }

    setSubmittingReturn(true);
    try {
      await inventoryService.createMaterialReturn({
        originalIssuanceId: issuanceId!,
        reason: reason.trim(),
        items: activeItems.map(i => ({
          materialId: i.materialId,
          unitId: i.unitId,
          quantity: parseQuantityInput(i.quantity),
          conversionRate: i.conversionRate
        }))
      });

      toast.success('Đã tạo phiếu hoàn trả vật tư. Tồn kho đã được cập nhật.');
      
      // Reload history and state
      await fetchDetailAndHistory();
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setIsReturning(false);
        resetReturnForm();
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tạo phiếu hoàn trả vật tư.');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Determine if there is any returnable item remaining
  const isAnyItemReturnable = returnItems.some(item => item.maxReturnableQty > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submittingReturn && onClose()}
      title={
        <div className="flex items-center gap-2">
          <Briefcase className="text-blue-600" size={20} />
          <span>Phiếu Xuất Kho: {detail?.issuanceNo || 'Đang tải...'}</span>
        </div>
      }
      width={isReturning ? 'xl' : 'lg'}
      footer={
        <div className="flex justify-between w-full">
          {isReturning ? (
            <Button
              variant="outline"
              onClick={() => { setIsReturning(false); resetReturnForm(); }}
              disabled={submittingReturn}
            >
              Quay lại chi tiết
            </Button>
          ) : (
            canReturnMaterial ? (
              <Button
                variant="outline"
                onClick={() => setIsReturning(true)}
                disabled={loading || !detail || !isAnyItemReturnable}
                className={`flex items-center gap-1.5 transition-all duration-200
                  ${isAnyItemReturnable 
                    ? 'border-amber-500 text-amber-600 hover:bg-amber-50' 
                    : 'border-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                <RotateCcw size={15} />
                Hoàn trả vật tư thừa
              </Button>
            ) : <div />
          )}

          <div className="flex gap-2">
            {isReturning && (
              <Button
                variant="primary"
                onClick={handleReturnSubmit}
                disabled={submittingReturn || !reason.trim() || !returnItems.some(i => i.quantity !== '')}
              >
                {submittingReturn ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={13} className="animate-spin" />
                    Đang xử lý...
                  </span>
                ) : (
                  'Xác nhận hoàn trả'
                )}
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={loading || submittingReturn}>
              Đóng
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center items-center py-16 gap-3">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span className="text-slate-500 text-sm">Đang tải thông tin chi tiết...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : detail ? (
        <div className={`grid grid-cols-1 ${isReturning ? 'lg:grid-cols-2 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-200' : 'gap-5'} text-left text-sm text-slate-800 transition-all duration-300`}>
          
          {/* ── COLUMN 1: ISSUANCE DETAIL & RETURN HISTORY ── */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Trạng thái phiếu:</span>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Đã xuất dùng
              </span>
            </div>

            {/* Metadata Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 gap-3">
              <div className="flex items-start gap-2.5">
                <Briefcase size={16} className="text-slate-400 mt-0.5" />
                <div>
                  <span className="text-slate-500 text-xs block">Công việc thi công:</span>
                  <span className="font-semibold text-slate-900">{detail.taskName}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <FileText size={16} className="text-slate-400 mt-0.5" />
                <div>
                  <span className="text-slate-500 text-xs block">Mục đích xuất dùng:</span>
                  <span className="text-slate-800 font-medium">{detail.purpose}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
                <div className="flex items-start gap-2.5">
                  <Calendar size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-500 text-xs block">Ngày lập phiếu:</span>
                    <span className="text-slate-800 text-xs font-semibold">
                      {formatDateVN(detail.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <User size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-500 text-xs block">Người lập phiếu:</span>
                    <span className="text-slate-800 text-xs">{detail.createdByName}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Vật tư xuất kho gốc</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs bg-white">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Tên vật tư</th>
                      <th className="px-3 py-2 text-right">Số lượng xuất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {detail.items.map((item: MaterialIssuanceItemDetail) => {
                      const returnable = returnItems.find(ri => ri.materialId === item.materialId)?.maxReturnableQty ?? 0;
                      return (
                        <tr key={item.issuanceItemId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2">
                            <span className="font-semibold text-slate-800 block">{item.materialName}</span>
                            <span className="text-slate-400 text-[10px] font-mono">{item.materialCode}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900">
                            {item.quantity.toLocaleString('vi-VN')} <span className="text-slate-500 font-normal">{item.unitName}</span>
                            {returnable < item.quantity && (
                              <span className="block text-[10px] text-amber-600 font-semibold">
                                (Còn có thể trả: {formatQuantity(returnable)} {item.unitName})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Return History */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <RotateCcw size={15} className="text-amber-500" />
                  <span>Phiếu hoàn trả liên kết</span>
                  {returns.length > 0 && (
                    <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                      {returns.length}
                    </span>
                  )}
                </h4>
                <button
                  type="button"
                  onClick={refreshReturnsOnly}
                  disabled={loadingReturns}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <RefreshCw size={13} className={loadingReturns ? 'animate-spin' : ''} />
                </button>
              </div>

              {loadingReturns ? (
                <div className="text-slate-400 text-xs flex items-center gap-1.5 py-4 justify-center bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                  <Loader2 size={14} className="animate-spin text-amber-500" />
                  <span>Đang cập nhật lịch sử hoàn trả...</span>
                </div>
              ) : returns.length === 0 ? (
                <div className="text-slate-400 text-xs italic py-4 text-center bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                  Chưa có phiếu hoàn trả nào cho phiếu xuất này.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[150px]">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-[11px] bg-white">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="px-2.5 py-1.5">Mã phiếu</th>
                        <th className="px-2.5 py-1.5">Lý do</th>
                        <th className="px-2.5 py-1.5 text-right">Vật tư trả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {returns.map(r => (
                        <tr key={r.materialReturnId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-2.5 py-1.5 font-mono font-semibold text-amber-600">{r.returnNo}</td>
                          <td className="px-2.5 py-1.5 max-w-[150px] truncate text-slate-600" title={r.reason}>{r.reason}</td>
                          <td className="px-2.5 py-1.5 text-right font-medium text-slate-500">
                            {r.items?.map(ri => (
                              <span key={ri.returnItemId} className="block text-[10px]">
                                {ri.quantity.toLocaleString('vi-VN')} {ri.unitName} - <span className="text-slate-400 font-normal">{ri.materialName}</span>
                              </span>
                            )) || `${r.totalItems} vật tư`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── COLUMN 2: SIDE-BY-SIDE RETURN FORM ── */}
          {isReturning && (
            <div className="pt-5 lg:pt-0 lg:pl-6 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <h3 className="text-amber-600 font-bold flex items-center gap-1.5">
                  <Sparkles size={16} />
                  Nhập Phiếu Hoàn Trả
                </h3>
                <span className="text-xs text-slate-500 font-mono">PTra-Auto</span>
              </div>

              <div className="space-y-4">
                  {/* Lý do hoàn trả */}
                  <FormItem label="Lý do hoàn trả" required error={reasonError ?? undefined}>
                    <textarea
                      rows={2}
                      placeholder='Ví dụ: "Công nhân thi công thừa, mang trả lại kho"'
                      value={reason}
                      onChange={e => { setReason(e.target.value); setReasonError(null); }}
                      disabled={submittingReturn}
                      className="block w-full rounded-md shadow-sm sm:text-sm pl-3 pr-3 py-2 border border-gray-300 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </FormItem>

                  {/* List of items to return */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 font-semibold uppercase">Số lượng hoàn trả thực tế</label>
                    <div className="rounded-xl border border-slate-200 divide-y divide-slate-200 bg-slate-50 overflow-hidden">
                      {returnItems.map((item, idx) => {
                        const isDisable = item.maxReturnableQty <= 0;
                        if (isDisable) return null; // Only show items that are returnable to keep it basic and easy to use
                        
                        return (
                          <div
                            key={item.materialId}
                            className={`p-3 grid grid-cols-[1.5fr_1fr_1.2fr] items-center gap-2.5 text-xs bg-white`}
                          >
                            {/* Vật tư & Mã */}
                            <div>
                              <p className="font-semibold text-slate-800">{item.materialName}</p>
                              <span className="text-[10px] text-slate-400 font-mono">{item.materialCode}</span>
                            </div>

                            {/* Khả dụng còn lại */}
                            <div className="text-slate-500">
                              Tối đa: <span className="font-semibold text-slate-700">{formatQuantity(item.maxReturnableQty)}</span> {item.unitName}
                            </div>

                            {/* Input số lượng trả */}
                            <div>
                              <Input
                                type="number"
                                step="any"
                                disabled={submittingReturn}
                                placeholder="Nhập..."
                                value={item.quantity}
                                onChange={e => handleQtyChange(idx, e.target.value, item.maxReturnableQty)}
                                error={!!item.error}
                                className="text-right"
                              />
                              {item.error && (
                                <p className="text-red-600 text-[10px] mt-1 text-right">
                                  {item.error}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Return form errors */}
                  {returnError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-1.5">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{returnError}</span>
                    </div>
                  )}
              </div>
            </div>
          )}

        </div>
      ) : null}
    </Modal>
  );
};
