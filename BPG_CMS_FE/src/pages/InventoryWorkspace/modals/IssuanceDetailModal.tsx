import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Input, FormItem, LoadingSpinner } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import { formatDateVN, formatQuantity, isGreaterThanQuantity, parseQuantityInput } from '../../../utils/inventoryHelpers';
import { formatNumber } from '../../../utils/formatNumber';
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
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRealtimeDataRefresh } from '../../../hooks/useRealtimeDataRefresh';
import { RealtimeEntities } from '../../../constants/realtimeEntities';
import { useProjectAccess } from '../../../hooks/useProjectAccess';

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
  isDiscrete: boolean;
  conversionRate: number;
  maxReturnableQty: number;
  quantity: string;
  error?: string | null;
}

export const IssuanceDetailModal: React.FC<IssuanceDetailModalProps> = ({
  isOpen,
  onClose,
  issuanceId,
  projectId,
  canReturnMaterial = false,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<MaterialIssuanceDetail | null>(null);
  const { isProjectActive } = useProjectAccess(projectId);
  const allowReturn = canReturnMaterial && isProjectActive;
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
  const [showReturnHistory, setShowReturnHistory] = useState(true);

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
          isDiscrete: i.isDiscrete,
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

  const handleQtyChange = (index: number, val: string, maxQty: number, isDiscrete: boolean) => {
    setReturnItems(prev => {
      const copy = [...prev];
      const item = copy[index];
      let err: string | null = null;

      if (val !== '') {
        const parsed = parseQuantityInput(val);
        if (isNaN(parsed) || parsed <= 0) {
          err = 'Số lượng phải lớn hơn 0.';
        } else if (isDiscrete && !Number.isInteger(parsed)) {
          err = 'Đơn vị này chỉ nhận số nguyên.';
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
      const result = await inventoryService.createMaterialReturn({
        originalIssuanceId: issuanceId!,
        reason: reason.trim(),
        items: activeItems.map(i => ({
          materialId: i.materialId,
          unitId: i.unitId,
          quantity: parseQuantityInput(i.quantity),
          conversionRate: i.conversionRate
        }))
      });

      toast.success(result.message || 'Tạo phiếu hoàn trả vật tư thành công! Tồn kho đã được cập nhật.');

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
      mobileFullScreen
      title={
        <div className="flex items-center gap-2">
          <Briefcase className="text-blue-600" size={20} />
          <span>Phiếu Xuất Kho: {detail?.issuanceNo || 'Đang tải...'}</span>
        </div>
      }
      width="xl"
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
            allowReturn ? (
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
        <LoadingSpinner size="md" label="Đang tải thông tin chi tiết..." className="py-12" />
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : detail ? (
        <div className="space-y-4 text-left text-sm text-slate-800">

          {/* Status strip */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <span className="text-slate-500 font-medium">Trạng thái phiếu:</span>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Đã xuất dùng
            </span>
          </div>

          {/* Compact Metadata Strip */}
          <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Briefcase size={13} className="text-slate-400 shrink-0" />
              <span className="text-slate-500 shrink-0">Công việc:</span>
              <span className="font-semibold text-slate-800 truncate">{detail.taskName}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText size={13} className="text-slate-400 shrink-0" />
              <span className="text-slate-500 shrink-0">Mục đích:</span>
              <span className="font-medium text-slate-700 truncate">{detail.purpose}</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <Calendar size={13} className="text-slate-400" />
              <span className="font-semibold text-slate-700">{formatDateVN(detail.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User size={13} className="text-slate-400" />
              <span className="text-slate-700">{detail.createdByName}</span>
            </div>
          </div>

          {/* Return reason — shown inline when returning */}
          {isReturning && (
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
          )}

          {/* Unified Items Table */}
          <div>
            <h4 className="font-semibold text-slate-700 mb-2">
              {isReturning ? 'Chọn vật tư hoàn trả' : 'Vật tư xuất kho gốc'}
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs bg-white">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Tên vật tư</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">SL xuất</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Đã trả</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Có thể trả</th>
                    {isReturning && <th className="px-3 py-2 text-right whitespace-nowrap w-28">Hoàn đợt này</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {detail.items.map((item: MaterialIssuanceItemDetail) => {
                    const returnItem = returnItems.find(ri => ri.materialId === item.materialId);
                    const returnable = returnItem?.maxReturnableQty ?? 0;
                    const totalReturned = item.quantity - returnable;
                    return (
                      <tr key={item.issuanceItemId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2">
                          <span className="font-semibold text-slate-800 block">{item.materialName}</span>
                          <span className="text-slate-400 text-[10px] font-mono">{item.materialCode}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900 whitespace-nowrap">
                          {formatNumber(item.quantity)} <span className="text-slate-500 font-normal">{item.unitName}</span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {totalReturned > 0 ? (
                            <span className="font-semibold text-amber-600">{formatNumber(totalReturned)} <span className="text-slate-400 font-normal">{item.unitName}</span></span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {returnable > 0 ? (
                            <span className="font-medium text-slate-600">{formatQuantity(returnable)} <span className="text-slate-400 font-normal">{item.unitName}</span></span>
                          ) : (
                            <span className="text-emerald-500 text-[10px] font-semibold">Đã trả hết</span>
                          )}
                        </td>
                        {isReturning && (
                          <td className="px-3 py-2">
                            {returnable > 0 ? (
                              <div>
                                <Input
                                  type="number"
                                  step={returnItem?.isDiscrete ? 1 : 'any'}
                                  disabled={submittingReturn}
                                  placeholder="0"
                                  value={returnItem?.quantity ?? ''}
                                  onChange={e => {
                                    const idx = returnItems.findIndex(ri => ri.materialId === item.materialId);
                                    if (idx >= 0) handleQtyChange(idx, e.target.value, returnable, returnItem?.isDiscrete ?? false);
                                  }}
                                  error={!!returnItem?.error}
                                  className="text-right w-full"
                                />
                                {returnItem?.error && (
                                  <p className="text-red-600 text-[10px] mt-0.5 text-right">{returnItem.error}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[10px]">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Return form errors */}
          {isReturning && returnError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0" />
              <span>{returnError}</span>
            </div>
          )}

          {/* Return History — Collapsible */}
          <div>
            <div
              className="flex items-center justify-between mb-2 cursor-pointer select-none group"
              onClick={() => setShowReturnHistory(prev => !prev)}
            >
              <h4 className="font-semibold text-slate-700 flex items-center gap-1.5">
                <RotateCcw size={15} className="text-amber-500" />
                <span>Phiếu hoàn trả liên kết</span>
                {returns.length > 0 && (
                  <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                    {returns.length}
                  </span>
                )}
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); refreshReturnsOnly(); }}
                  disabled={loadingReturns}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <RefreshCw size={13} className={loadingReturns ? 'animate-spin' : ''} />
                </button>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${showReturnHistory ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {showReturnHistory && (
              <>
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
                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[200px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-[11px] bg-white">
                      <thead className="bg-slate-50 text-slate-500 font-semibold uppercase sticky top-0">
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
                            <td className="px-2.5 py-1.5 max-w-[200px] truncate text-slate-600" title={r.reason}>{r.reason}</td>
                            <td className="px-2.5 py-1.5 text-right font-medium text-slate-500">
                              {r.items?.map(ri => (
                                <div key={ri.returnItemId} className="text-xs font-medium text-slate-900">
                                  {formatNumber(ri.quantity)} {ri.unitName} - <span className="text-slate-400 font-normal">{ri.materialName}</span>
                                </div>
                              )) || `${r.totalItems} vật tư`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      ) : null}
    </Modal>
  );
};
