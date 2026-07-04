import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '../../../components/ui';
import { ArrowLeft, RotateCcw, ArrowRightLeft, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { surplusService } from '../../../services/surplusService';
import type { SurplusRequestDetail, SurplusRequestItem } from '../../../types/surplus';
import {
  getSurplusRequestStatusDetails,
  getSurplusItemStatusDetails,
  getSurplusActionTypeLabel,
  formatDateVN,
} from '../../../utils/surplusHelpers';

interface SurplusRequestDetailTabProps {
  surplusRequestId: number;
  onBack: () => void;
  onRefresh: () => void;
  onCreateReturn: (item: SurplusRequestItem) => void;
  onCreateTransfer: (item: SurplusRequestItem) => void;
  onCreateLiquidation: (item: SurplusRequestItem) => void;
  onViewTransferActions: (item: SurplusRequestItem) => void;
  isAccountant: boolean;
  isLeader: boolean;
  isTPKT: boolean;
  refreshKey: number;
}

export const SurplusRequestDetailTab: React.FC<SurplusRequestDetailTabProps> = ({
  surplusRequestId,
  onBack,
  onCreateReturn,
  onCreateTransfer,
  onCreateLiquidation,
  onViewTransferActions,
  isAccountant,
  isLeader,
  refreshKey,
}) => {
  const [detail, setDetail] = useState<SurplusRequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  useEffect(() => {
    loadDetail();
  }, [surplusRequestId, refreshKey]);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await surplusService.getDetail(surplusRequestId);
      setDetail(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải chi tiết.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16 gap-2">
        <LoadingSpinner />
        <span className="text-slate-500 text-sm">Đang tải chi tiết batch...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-lg text-sm">{error}</div>
    );
  }

  if (!detail) return null;

  const batchBadge = getSurplusRequestStatusDetails(detail.status);
  const progress = detail.totalItems > 0
    ? Math.round((detail.processedItems / detail.totalItems) * 100) : 0;
  const isProcessing = detail.status === 'Processing';

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

      {/* Header card */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-slate-400">Batch #{detail.surplusRequestId}</span>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${batchBadge.color}`}>
                {batchBadge.name}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-800">{detail.projectName}</h2>
            {detail.reason && (
              <p className="text-sm text-slate-500 mt-1">Lý do: {detail.reason}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              Tạo ngày {formatDateVN(detail.createdAt)} bởi <strong>{detail.createdByName}</strong>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-1">Tiến độ xử lý</p>
            <p className="text-3xl font-black text-blue-600">{progress}%</p>
            <p className="text-xs text-slate-500">{detail.processedItems}/{detail.totalItems} vật tư</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Item list */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-700">Danh sách vật tư ({detail.items.length})</h3>

        {detail.items.map(item => {
          const itemBadge = getSurplusItemStatusDetails(item.status);
          const remaining = item.quantity - item.processedQuantity;
          const isExpanded = expandedItemId === item.surplusRequestItemId;
          const canAct = isProcessing && item.status !== 'Completed' && item.status !== 'Cancelled';

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
                    <span>Tổng: <strong className="text-slate-700">{item.quantity} {item.unitName}</strong></span>
                    <span>Đã xử lý: <strong className="text-green-600">{item.processedQuantity} {item.unitName}</strong></span>
                    <span>Còn lại: <strong className="text-orange-600">{remaining} {item.unitName}</strong></span>
                  </div>
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
                        Trả NCC
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
                  {item.actions.length > 0 && (
                    <button
                      onClick={() => setExpandedItemId(isExpanded ? null : item.surplusRequestItemId)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {item.actions.length} action{item.actions.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded actions summary */}
              {isExpanded && item.actions.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                    Lịch sử xử lý
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {item.actions.map((action, idx) => {
                      const typeBadge = getSurplusActionTypeLabel(action.actionType);
                      return (
                        <div key={idx} className="flex items-center gap-3 text-xs">
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold border ${typeBadge.color}`}>
                            {typeBadge.name}
                          </span>
                          <span className="text-slate-600">
                            {action.quantity} {item.unitName}
                          </span>
                          <span className="text-slate-400">#{action.actionId}</span>
                          <span className="text-slate-500">{action.status}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => onViewTransferActions(item)}
                    className="mt-2 text-xs text-blue-600 hover:underline font-medium"
                  >
                    Xem chi tiết tất cả actions →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
