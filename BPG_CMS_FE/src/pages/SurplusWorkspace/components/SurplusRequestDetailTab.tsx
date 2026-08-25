import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, LoadingSpinner, Modal } from '../../../components/ui';
import { ArrowLeft, RotateCcw, ArrowRightLeft, Flame, ChevronDown, ChevronUp, CircleSlash2, Search } from 'lucide-react';
import { surplusService } from '../../../services/surplusService';
import type { SurplusRequestDetail, SurplusRequestItem } from '../../../types/surplus';
import {
  getSurplusItemStatusDetails,
  getSurplusActionTypeLabel,
  getGeneralActionStatusName,
} from '../../../utils/surplusHelpers';
import { SurplusActionInlineDetail } from './SurplusActionInlineDetail';
import { useProjectAccess } from '../../../hooks/useProjectAccess';

interface SurplusRequestDetailTabProps {
  surplusRequestId: number;
  onBack: () => void;
  onRefresh: () => void;
  onCreateReturn: (item: SurplusRequestItem) => void;
  onCreateTransfer: (item: SurplusRequestItem) => void;
  onCreateLiquidation: (item: SurplusRequestItem) => void;
  isAccountant: boolean;
  isLeader: boolean;
  isTPKT: boolean;
  refreshKey: number;
}

export const SurplusRequestDetailTab: React.FC<SurplusRequestDetailTabProps> = ({
  surplusRequestId,
  onBack,
  onRefresh,
  onCreateReturn,
  onCreateTransfer,
  onCreateLiquidation,
  isAccountant,
  isLeader,
  isTPKT,
  refreshKey,
}) => {
  const [detail, setDetail] = useState<SurplusRequestDetail | null>(null);
  const { isProjectActive } = useProjectAccess(detail?.projectId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<number | null>(null);
  const [expandedActionType, setExpandedActionType] = useState<string | null>(null);
  const [closingItemId, setClosingItemId] = useState<number | null>(null);
  const [closeItem, setCloseItem] = useState<SurplusRequestItem | null>(null);
  const [closeReason, setCloseReason] = useState('');
  const [closeError, setCloseError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadDetail = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    if (showLoading) setError(null);
    try {
      const data = await surplusService.getDetail(surplusRequestId);
      setDetail(data);
    } catch (err: any) {
      if (showLoading) {
        setError(err.message || 'Không thể tải chi tiết.');
      } else {
        console.error('Error refreshing surplus request detail:', err);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const openCloseModal = (item: SurplusRequestItem) => {
    const hasActiveTransfer = item.actions.some(action => 
        action.actionType === 'Transfer' && 
        action.status !== 'Rejected' && 
        action.status !== 'Received'
    );
    if (hasActiveTransfer) {
        toast.error('Không thể đóng khi vật tư còn phiếu điều chuyển đang chờ xử lý.');
        return;
    }
    setCloseItem(item);
    setCloseReason('');
    setCloseError(null);
  };

  const dismissCloseModal = () => {
    if (closingItemId !== null) return;
    setCloseItem(null);
    setCloseReason('');
    setCloseError(null);
  };

  const closeRemaining = async () => {
    if (!closeItem) return;
    const reason = closeReason.trim();
    if (reason.length < 10) {
      setCloseError('Lý do đóng phần còn lại phải có ít nhất 10 ký tự.');
      return;
    }
    setCloseError(null);
    setClosingItemId(closeItem.surplusRequestItemId);
    try {
      await surplusService.closeItem(closeItem.surplusRequestItemId, reason);
      toast.success('Đã đóng phần vật tư còn lại.');
      setCloseItem(null);
      setCloseReason('');
      await loadDetail();
      onRefresh();
    } catch (err: any) {
      setCloseError(err.message || 'Không thể đóng phần vật tư còn lại.');
    } finally {
      setClosingItemId(null);
    }
  };

  useEffect(() => {
    // Subsequent refreshes run in the background so expanded rows and any
    // action modal inside them are not unmounted.
    loadDetail(detail === null);
  }, [surplusRequestId, refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16 gap-2">
        <LoadingSpinner />
        <span className="text-slate-500 text-sm">Đang tải chi tiết đề xuất...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-lg text-sm">{error}</div>
    );
  }

  if (!detail) return null;

  const isProcessing = detail.status === 'Processing';

  const filteredItems = detail.items.filter(item => {
    const matchSearch = item.materialName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        item.materialCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium w-fit"
      >
        <ArrowLeft size={15} />
        Quay lại danh sách
      </button>



      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-2">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="Tìm theo mã hoặc tên vật tư..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="Pending">Chờ xử lý</option>
            <option value="Processing">Đang xử lý</option>
            <option value="Completed">Hoàn thành</option>
            <option value="Cancelled">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Item list */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-700">Danh sách vật tư ({filteredItems.length})</h3>

        {filteredItems.map(item => {
          const itemBadge = getSurplusItemStatusDetails(item.status);
          const remaining = item.quantity - item.processedQuantity;
          const isExpanded = expandedItemId === item.surplusRequestItemId;
          const canAct = isProjectActive && isProcessing && item.status !== 'Completed' && item.status !== 'Cancelled';

          return (
            <div key={item.surplusRequestItemId} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Item row */}
              <div className="bg-white px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-400">{item.materialCode}</span>
                    <span className="font-semibold text-slate-800">{item.materialName}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${itemBadge.color}`}>
                      {itemBadge.name}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-slate-500">
                    <span>Tổng: <strong className="text-slate-700">{item.quantity.toLocaleString('vi-VN')} {item.unitName}</strong></span>
                    <span>Đã xử lý: <strong className="text-green-600">{item.processedQuantity.toLocaleString('vi-VN')} {item.unitName}</strong></span>
                    <span>Còn lại: <strong className="text-orange-600">{remaining.toLocaleString('vi-VN')} {item.unitName}</strong></span>
                    <span>Tồn hiện tại: <strong className="text-slate-700">{item.currentInventoryQuantity.toLocaleString('vi-VN')} {item.unitName}</strong></span>
                    <span>Tạm khóa: <strong className="text-rose-600">{item.reservedQuantity.toLocaleString('vi-VN')} {item.unitName}</strong></span>
                    <span>Khả dụng: <strong className="text-blue-600">{item.availableQuantity.toLocaleString('vi-VN')} {item.unitName}</strong></span>
                  </div>
                  {item.status === 'Cancelled' && item.closeReason && (
                    <div className="mt-2 text-xs text-slate-500">
                      Đã đóng phần còn lại: <strong>{item.closeReason}</strong>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canAct && isAccountant && (
                    <>
                      <button
                        onClick={() => onCreateReturn(item)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
                      >
                        <RotateCcw size={12} />
                        Trả nhà cung cấp
                      </button>
                      <button
                        onClick={() => onCreateLiquidation(item)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors"
                      >
                        <Flame size={12} />
                        Thanh lý
                      </button>
                    </>
                  )}
                  {canAct && isLeader && (
                    <button
                      onClick={() => onCreateTransfer(item)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      <ArrowRightLeft size={12} />
                      Chuyển kho
                    </button>
                  )}
                  {canAct && (isTPKT || isLeader) && (
                    <button
                      disabled={closingItemId === item.surplusRequestItemId}
                      onClick={() => openCloseModal(item)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 text-slate-700 border border-slate-300 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                    >
                      <CircleSlash2 size={12} />
                      {closingItemId === item.surplusRequestItemId ? 'Đang đóng...' : 'Đóng phần còn lại'}
                    </button>
                  )}
                  {item.actions.length > 0 && (
                    <button
                      onClick={() => {
                        setExpandedItemId(isExpanded ? null : item.surplusRequestItemId);
                        setExpandedActionId(null);
                        setExpandedActionType(null);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {item.actions.length} thao tác
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded actions summary */}
              {isExpanded && item.actions.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                    Lịch sử xử lý
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 mt-2">
                    <table className="w-full text-left border-collapse bg-white dark:bg-slate-900">
                      <thead>
                        <tr className="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          <th className="py-2 px-3 font-semibold w-16">STT</th>
                          <th className="py-2 px-3 font-semibold">Loại xử lý</th>
                          <th className="py-2 px-3 font-semibold text-right">Số lượng</th>
                          <th className="py-2 px-3 font-semibold text-center">Trạng thái</th>
                          <th className="py-2 px-3 font-semibold text-right w-24"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {item.actions.map((action, idx) => {
                          const typeBadge = getSurplusActionTypeLabel(action.actionType);
                          const isActionExpanded = expandedActionId === action.actionId && expandedActionType === action.actionType;
                          
                          return (
                            <React.Fragment key={idx}>
                              <tr 
                                className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${isActionExpanded ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
                                onClick={() => {
                                  if (isActionExpanded) {
                                    setExpandedActionId(null);
                                    setExpandedActionType(null);
                                  } else {
                                    setExpandedActionId(action.actionId);
                                    setExpandedActionType(action.actionType);
                                  }
                                }}
                              >
                                <td className="py-2 px-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-3 text-xs">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold border ${typeBadge.color}`}>
                                    {typeBadge.name}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-xs text-slate-700 dark:text-slate-200 font-semibold text-right">
                                  {action.quantity} <span className="text-slate-500 dark:text-slate-400 font-normal">{item.unitName}</span>
                                </td>
                                <td className="py-2 px-3 text-xs text-center">
                                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                                    {getGeneralActionStatusName(action.status)}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <span className="inline-flex items-center gap-1 text-blue-600 font-semibold text-[11px] opacity-70 group-hover:opacity-100 transition-opacity">
                                    Chi tiết
                                    {isActionExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </span>
                                </td>
                              </tr>
                              
                              {/* Expanded Inline Detail */}
                              {isActionExpanded && (
                                <tr>
                                  <td colSpan={5} className="p-0 border-b border-slate-200">
                                    <div className="bg-slate-50/30 overflow-hidden">
                                      <SurplusActionInlineDetail
                                        itemId={item.surplusRequestItemId}
                                        actionId={action.actionId}
                                        actionType={action.actionType}
                                        unitName={item.unitName}
                                        isTPKT={isTPKT}
                                        isLeader={isLeader}
                                        onRefresh={onRefresh}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={closeItem !== null}
        onClose={dismissCloseModal}
        title="Đóng phần vật tư còn lại"
        width="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={dismissCloseModal} disabled={closingItemId !== null}>
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={closeRemaining}
              isLoading={closingItemId !== null}
              disabled={closeReason.trim().length < 10}
            >
              Xác nhận đóng
            </Button>
          </div>
        }
      >
        {closeItem && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">{closeItem.materialName} ({closeItem.materialCode})</p>
              <p className="mt-1">
                Phần chưa xử lý sẽ được đóng:
                {' '}
                <strong>{closeItem.quantity - closeItem.processedQuantity} {closeItem.unitName}</strong>.
                Thao tác này không làm giảm tồn kho.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Lý do đóng <span className="text-red-500">*</span>
              </label>
              <textarea
                autoFocus
                rows={4}
                maxLength={500}
                value={closeReason}
                onChange={e => {
                  setCloseReason(e.target.value);
                  if (closeError) setCloseError(null);
                }}
                disabled={closingItemId !== null}
                placeholder="Ví dụ: Số lượng thực tế đã được kiểm kê và điều chỉnh, phần chênh lệch không còn trong kho..."
                className={`w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                  closeError
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                }`}
              />
              <div className="mt-1 flex justify-between text-xs">
                <span className={closeError ? 'text-red-600' : 'text-slate-400'}>
                  {closeError || 'Tối thiểu 10 ký tự. Lý do sẽ được lưu vào lịch sử.'}
                </span>
                <span className="text-slate-400">{closeReason.length}/500</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
