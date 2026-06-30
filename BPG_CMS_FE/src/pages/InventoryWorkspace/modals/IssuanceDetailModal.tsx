import React, { useEffect, useState } from 'react';
import { Modal, Button, Input, FormItem } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import type { MaterialIssuanceDetail, MaterialIssuanceItemDetail, MaterialReturn } from '../../../types/inventory';
import {
  Calendar,
  User,
  FileText,
  Briefcase,
  Loader2,
  AlertCircle,
  ArrowLeftCircle,
  RefreshCw,
  Info,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface IssuanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  issuanceId: number | null;
  projectId?: number;
  onSuccess?: () => void; // Triggered when a return succeeds, to refresh parent lists
}

interface ReturnItemInput {
  materialId: number;
  materialCode: string;
  materialName: string;
  unitId: number;
  unitName: string;
  conversionRate: number;
  maxReturnableQty: number; // Qty available to return (issued - previously returned)
  quantity: string;
  error?: string;
}

export const IssuanceDetailModal: React.FC<IssuanceDetailModalProps> = ({
  isOpen,
  onClose,
  issuanceId,
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

  // Return form states
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemInput[]>([]);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccessMsg, setReturnSuccessMsg] = useState<string | null>(null);

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
    setReturnItems([]);
    setReturnError(null);
    setReturnSuccessMsg(null);
  };

  const fetchDetailAndHistory = async () => {
    if (!issuanceId) return;
    setLoading(true);
    setError(null);
    try {
      const [issuanceData, returnsData] = await Promise.all([
        inventoryService.getMaterialIssuanceDetail(issuanceId),
        inventoryService.getMaterialReturns({ issuanceId, pageSize: 50 })
      ]);
      
      setDetail(issuanceData);
      const prevReturns = returnsData.items ?? [];
      setReturns(prevReturns);

      // Initialize return items calculation based on remaining qty
      const items: ReturnItemInput[] = issuanceData.items.map((i: MaterialIssuanceItemDetail) => {
        // Calculate previously returned quantity for this material
        const previouslyReturned = prevReturns.reduce((sum, ret) => {
          const matchedItem = ret.items?.find(ri => ri.materialId === i.materialId);
          return sum + (matchedItem ? matchedItem.quantity : 0);
        }, 0);

        const maxReturnable = Math.max(0, i.quantity - previouslyReturned);

        return {
          materialId: i.materialId,
          materialCode: i.materialCode,
          materialName: i.materialName,
          unitId: i.unitId,
          unitName: i.unitName,
          conversionRate: i.conversionRate,
          maxReturnableQty: maxReturnable,
          quantity: '',
        };
      });

      setReturnItems(items);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Không thể tải chi tiết phiếu xuất kho.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to re-calc returnables after loading returns list
  const refreshReturnsOnly = async () => {
    if (!issuanceId || !detail) return;
    setLoadingReturns(true);
    try {
      const res = await inventoryService.getMaterialReturns({ issuanceId, pageSize: 50 });
      const prevReturns = res.items ?? [];
      setReturns(prevReturns);

      // Re-calc remaining balances on current items
      setReturnItems(prevItems =>
        prevItems.map(item => {
          const previouslyReturned = prevReturns.reduce((sum, ret) => {
            const matchedItem = ret.items?.find(ri => ri.materialId === item.materialId);
            return sum + (matchedItem ? matchedItem.quantity : 0);
          }, 0);

          // Get original quantity from detail
          const originalItem = detail.items.find(i => i.materialId === item.materialId);
          const originalQty = originalItem ? originalItem.quantity : 0;
          const maxReturnable = Math.max(0, originalQty - previouslyReturned);

          return {
            ...item,
            maxReturnableQty: maxReturnable,
            // Reset quantity to empty if it exceeds the new maximum returnable
            quantity: parseFloat(item.quantity) > maxReturnable ? '' : item.quantity,
            error: undefined
          };
        })
      );
    } catch (err) {
      console.error('Error fetching returns:', err);
    } finally {
      setLoadingReturns(false);
    }
  };

  const handleQuantityChange = (index: number, val: string) => {
    setReturnItems(prev => {
      const copy = [...prev];
      const item = copy[index];
      const num = parseFloat(val);
      let err: string | undefined;

      if (!val) {
        err = undefined; // Empty is valid (means ignore this item)
      } else if (isNaN(num) || num <= 0) {
        err = 'Phải lớn hơn 0.';
      } else if (num > item.maxReturnableQty) {
        err = `Tối đa ${item.maxReturnableQty.toLocaleString('vi-VN')} ${item.unitName}`;
      }

      copy[index] = { ...item, quantity: val, error: err };
      return copy;
    });
    setReturnError(null);
  };

  const handleReturnSubmit = async () => {
    setReturnError(null);
    setReasonError(null);

    // Validate reason
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
          quantity: parseFloat(i.quantity),
          conversionRate: i.conversionRate
        }))
      });

      setReturnSuccessMsg('Hoàn trả vật tư thành công! Tồn kho đã tăng.');
      resetReturnForm();
      
      // Reload history and state
      await fetchDetailAndHistory();
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setReturnSuccessMsg(null);
        setIsReturning(false);
      }, 1500);
    } catch (err: any) {
      setReturnError(err.message || 'Lỗi hệ thống khi tạo phiếu hoàn trả.');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Check if any material is still returnable
  const isAnyItemReturnable = returnItems.some(i => i.maxReturnableQty > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Briefcase className="text-blue-500" size={20} />
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
              className="border-slate-300 dark:border-slate-700 text-slate-400 hover:bg-slate-800"
            >
              Quay lại chi tiết
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsReturning(true)}
              disabled={loading || !detail || !isAnyItemReturnable}
              className={`flex items-center gap-1.5 transition-all duration-200
                ${isAnyItemReturnable 
                  ? 'border-amber-500/50 text-amber-500 hover:bg-amber-500/10' 
                  : 'border-slate-700 text-slate-500 cursor-not-allowed'}`}
              title={isAnyItemReturnable ? 'Hoàn trả vật tư dư từ công trường' : 'Vật tư trong phiếu này đã được hoàn trả hết'}
            >
              <ArrowLeftCircle size={15} />
              Hoàn trả vật tư dư
            </Button>
          )}

          <div className="flex gap-2">
            {isReturning && (
              <Button
                variant="primary"
                onClick={handleReturnSubmit}
                disabled={submittingReturn || !reason.trim() || !returnItems.some(i => i.quantity !== '')}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
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
          <Loader2 className="animate-spin text-blue-500" size={24} />
          <span className="text-slate-400 text-sm">Đang tải thông tin chi tiết...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-950/20 border border-red-500/30 text-red-400 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : detail ? (
        <div className={`grid grid-cols-1 ${isReturning ? 'lg:grid-cols-2 gap-6' : 'gap-5'} text-left text-sm text-slate-200 transition-all duration-300`}>
          
          {/* ── COLUMN 1: ISSUANCE DETAIL & RETURN HISTORY ── */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
              <span className="text-slate-400 font-medium">Trạng thái phiếu:</span>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Đã xuất dùng
              </span>
            </div>

            {/* Metadata Card */}
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 grid grid-cols-1 gap-3.5">
              <div className="flex items-start gap-2.5">
                <Briefcase size={16} className="text-slate-500 mt-0.5" />
                <div>
                  <span className="text-slate-400 text-xs block">Công việc thi công:</span>
                  <span className="font-semibold text-slate-200">{detail.taskName}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <FileText size={16} className="text-slate-500 mt-0.5" />
                <div>
                  <span className="text-slate-400 text-xs block">Mục đích xuất dùng:</span>
                  <span className="text-slate-300 font-medium">{detail.purpose}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-700/30 pt-3">
                <div className="flex items-start gap-2.5">
                  <Calendar size={16} className="text-slate-500 mt-0.5" />
                  <div>
                    <span className="text-slate-400 text-xs block">Ngày lập phiếu:</span>
                    <span className="text-slate-300 text-xs font-semibold">
                      {new Date(detail.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <User size={16} className="text-slate-500 mt-0.5" />
                  <div>
                    <span className="text-slate-400 text-xs block">Người lập phiếu:</span>
                    <span className="text-slate-300 text-xs">{detail.createdByName}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <span>Vật tư xuất kho gốc</span>
              </h4>
              <div className="overflow-x-auto border border-slate-700 rounded-lg max-h-[180px]">
                <table className="min-w-full divide-y divide-slate-700 text-left text-xs">
                  <thead className="bg-slate-800 text-slate-400 font-medium uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Tên vật tư</th>
                      <th className="px-3 py-2 text-right">Số lượng xuất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 bg-slate-900/10">
                    {detail.items.map((item: MaterialIssuanceItemDetail) => {
                      const returnable = returnItems.find(ri => ri.materialId === item.materialId)?.maxReturnableQty ?? 0;
                      return (
                        <tr key={item.issuanceItemId} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-200 block">{item.materialName}</span>
                            <span className="text-slate-500 text-[10px]">{item.materialCode}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-200">
                            {item.quantity} <span className="text-slate-500 font-normal">{item.unitName}</span>
                            {returnable < item.quantity && (
                              <span className="block text-[10px] text-amber-400">
                                (Còn: {returnable.toLocaleString('vi-VN')} {item.unitName})
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
                <h4 className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ArrowLeftCircle size={15} className="text-amber-500" />
                  <span>Phiếu hoàn trả liên kết</span>
                  {returns.length > 0 && (
                    <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                      {returns.length}
                    </span>
                  )}
                </h4>
                <button
                  onClick={refreshReturnsOnly}
                  disabled={loadingReturns}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <RefreshCw size={13} className={loadingReturns ? 'animate-spin' : ''} />
                </button>
              </div>

              {loadingReturns ? (
                <div className="text-slate-500 text-xs flex items-center gap-1.5 py-4 justify-center bg-slate-800/20 border border-slate-700/50 border-dashed rounded-lg">
                  <Loader2 size={14} className="animate-spin text-amber-500" />
                  <span>Đang cập nhật lịch sử hoàn trả...</span>
                </div>
              ) : returns.length === 0 ? (
                <div className="text-slate-500 text-xs italic py-4 text-center bg-slate-800/20 border border-slate-700/50 border-dashed rounded-lg">
                  Chưa có phiếu hoàn trả nào cho phiếu xuất này.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-700/50 rounded-lg max-h-[150px]">
                  <table className="min-w-full divide-y divide-slate-700 text-[11px]">
                    <thead className="bg-slate-800/50 text-slate-400 font-medium">
                      <tr>
                        <th className="px-2.5 py-1.5 text-left">Mã phiếu</th>
                        <th className="px-2.5 py-1.5 text-left">Lý do</th>
                        <th className="px-2.5 py-1.5 text-right">Vật tư trả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30 text-slate-300">
                      {returns.map(r => (
                        <tr key={r.materialReturnId} className="hover:bg-slate-800/20">
                          <td className="px-2.5 py-1.5 font-mono font-medium text-amber-400">{r.returnNo}</td>
                          <td className="px-2.5 py-1.5 max-w-[150px] truncate" title={r.reason}>{r.reason}</td>
                          <td className="px-2.5 py-1.5 text-right font-medium text-slate-400">
                            {r.items?.map(ri => (
                              <span key={ri.returnItemId} className="block">
                                {ri.quantity.toLocaleString('vi-VN')} {ri.unitName} - <span className="text-[10px] text-slate-500">{ri.materialName}</span>
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
            <div className="border-t lg:border-t-0 lg:border-l border-slate-700/50 pt-5 lg:pt-0 lg:pl-6 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <h3 className="text-amber-400 font-bold flex items-center gap-1.5">
                  <Sparkles size={16} />
                  Nhập Phiếu Hoàn Trả
                </h3>
                <span className="text-xs text-slate-400">PTra-Auto</span>
              </div>

              {returnSuccessMsg ? (
                <div className="flex flex-col items-center justify-center py-10 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-emerald-400 gap-2">
                  <CheckCircle2 size={36} className="text-emerald-400" />
                  <span className="font-semibold text-sm">{returnSuccessMsg}</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Lý do hoàn trả */}
                  <FormItem label="Lý do hoàn trả" required error={reasonError ?? undefined}>
                    <Input
                      placeholder='Ví dụ: "Công nhân thi công thừa, mang trả lại kho"'
                      value={reason}
                      onChange={e => { setReason(e.target.value); setReasonError(null); }}
                      disabled={submittingReturn}
                    />
                  </FormItem>

                  {/* List of items to return */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-semibold uppercase">Số lượng hoàn trả thực tế</label>
                    <div className="rounded-lg border border-slate-700 divide-y divide-slate-700/50 bg-slate-900/20 overflow-hidden">
                      {returnItems.map((item, idx) => {
                        const isDisable = item.maxReturnableQty <= 0;
                        return (
                          <div
                            key={item.materialId}
                            className={`p-3 grid grid-cols-[1.8fr_1fr_1fr] items-center gap-2.5 text-xs 
                              ${item.quantity !== '' ? 'bg-amber-500/5' : ''} ${isDisable ? 'opacity-50' : ''}`}
                          >
                            {/* Vật tư & Mã */}
                            <div>
                              <p className="font-medium text-slate-300">{item.materialName}</p>
                              <span className="text-[10px] text-slate-500 font-mono">{item.materialCode}</span>
                            </div>

                            {/* Khả dụng còn lại */}
                            <div className="text-slate-400">
                              {isDisable ? (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">
                                  Đã trả hết
                                </span>
                              ) : (
                                <>
                                  Tối đa: <span className="font-semibold text-slate-300">{item.maxReturnableQty.toLocaleString('vi-VN')}</span> {item.unitName}
                                </>
                              )}
                            </div>

                            {/* Input số lượng trả */}
                            <div>
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                disabled={isDisable || submittingReturn}
                                placeholder={isDisable ? "0" : "Nhập số lượng"}
                                value={item.quantity}
                                onChange={e => handleQuantityChange(idx, e.target.value)}
                                className={`w-full bg-slate-800 border rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1
                                  ${item.error ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-amber-500'}`}
                              />
                              {item.error && (
                                <p className="text-red-400 text-[10px] mt-1 flex items-center gap-0.5">
                                  <AlertCircle size={9} />
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
                    <div className="p-3 bg-red-950/20 border border-red-500/25 text-red-400 rounded-lg text-xs flex items-center gap-1.5">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{returnError}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 flex items-start gap-1">
                    <Info size={12} className="shrink-0 mt-0.5" />
                    <span>Lượng trả sẽ tự động tăng số lượng tồn kho khả dụng của vật tư này trong dự án.</span>
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      ) : null}
    </Modal>
  );
};
