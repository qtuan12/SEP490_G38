import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '../../../components/ui';
import { surplusService } from '../../../services/surplusService';
import type { SurplusActionList } from '../../../types/surplus';
import { formatDateVN, formatCurrency } from '../../../utils/surplusHelpers';
import toast from 'react-hot-toast';
import { DispatchTransferModal } from '../modals/DispatchTransferModal';
import { ReceiveTransferModal } from '../modals/ReceiveTransferModal';
import { useParams } from 'react-router-dom';
import { useSignalREvent } from '../../../hooks/useSignalREvent';
import { useRealtimeDataRefresh } from '../../../hooks/useRealtimeDataRefresh';
import {
  REALTIME_DATA_CHANGED_AGGREGATION_MS,
  RealtimeEntities,
} from '../../../constants/realtimeEntities';

interface SurplusActionInlineDetailProps {
  itemId: number;
  actionId: number;
  actionType: string;
  unitName: string;
  isTPKT: boolean;
  isLeader: boolean;
  onRefresh: () => void;
}

export const SurplusActionInlineDetail: React.FC<SurplusActionInlineDetailProps> = ({
  itemId, actionId, actionType, unitName, isTPKT, isLeader, onRefresh
}) => {
  const { projectId } = useParams<{ projectId: string }>();
  const currentProjectId = Number(projectId);
  const [data, setData] = useState<SurplusActionList | null>(null);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);
  const [dispatchingTransferId, setDispatchingTransferId] = useState<number | null>(null);
  const [receivingTransferId, setReceivingTransferId] = useState<number | null>(null);
  const realtimeRefreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await surplusService.getActionList(itemId);
      const filteredRes = {
        ...res,
        returns: actionType === 'ReturnSupplier' ? res.returns.filter(r => r.surplusReturnSupplierId === actionId) : [],
        transfers: actionType === 'Transfer' ? res.transfers.filter(t => t.surplusTransferId === actionId) : [],
        liquidations: actionType === 'Liquidate' ? res.liquidations.filter(l => l.surplusLiquidationId === actionId) : [],
      };
      setData(filteredRes);
    } catch (err: any) {
      if (showLoading) toast.error(err.message || 'Không thể tải chi tiết thao tác.');
      else console.error('Error refreshing surplus action detail:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const scheduleRealtimeRefresh = () => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadData(false);
    }, REALTIME_DATA_CHANGED_AGGREGATION_MS);
  };

  useEffect(() => () => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
  }, [itemId, actionId, actionType]);

  useEffect(() => {
    loadData();
  }, [itemId, actionId, actionType]);

  useSignalREvent('ReceiveNotification', (noti: any) => {
    if (noti?.referenceType === 'SurplusRequest') {
      scheduleRealtimeRefresh();
    }
  });

  useRealtimeDataRefresh(
    scheduleRealtimeRefresh,
    RealtimeEntities.surplus,
    0,
  );

  const doTransferAction = async (transferId: number, action: 'review-approve' | 'review-reject' | 'dispatch' | 'receive') => {
    if (action === 'dispatch') {
      setDispatchingTransferId(transferId);
      return;
    }
    if (action === 'receive') {
      setReceivingTransferId(transferId);
      return;
    }

    setActioning(transferId);
    try {
      let result: { message?: string } | undefined;
      if (action === 'review-approve') result = await surplusService.reviewTransfer(transferId, true);
      else if (action === 'review-reject') result = await surplusService.reviewTransfer(transferId, false);

      toast.success(result?.message || (action === 'review-approve' ? 'Đã duyệt phiếu điều chuyển vật tư.' : 'Đã từ chối phiếu điều chuyển vật tư.'));
      scheduleRealtimeRefresh();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Không thể xử lý phiếu điều chuyển vật tư.');
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-6 gap-2 bg-slate-50/50 dark:bg-slate-900/50 dark:text-slate-400">
        <LoadingSpinner /><span className="text-sm text-slate-500 dark:text-slate-400">Đang tải chi tiết...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 border-t border-slate-100 dark:border-slate-800 shadow-inner">
      {/* Returns */}
      {data.returns.map(r => (
        <div key={r.surplusReturnSupplierId} className="border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/30 rounded-lg px-4 py-3 text-sm">
          <div className="flex justify-between flex-wrap gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Nhà cung cấp: {r.supplierName || 'Không xác định'}
            </span>
            <span className="text-slate-500 dark:text-slate-400">{formatDateVN(r.createdAt)}</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 mt-1">
            Số lượng trả: <strong>{r.returnQuantity} {unitName}</strong>
            {r.refundAmount != null && (
              <> &nbsp;|&nbsp; Số tiền thu hồi: <strong className="text-green-700 dark:text-green-400">{formatCurrency(r.refundAmount)}</strong></>
            )}
          </p>
          {r.note && <p className="text-slate-500 dark:text-slate-300 text-xs mt-1.5 p-2 bg-white dark:bg-slate-800 rounded border border-purple-100/50 dark:border-purple-900/40">Ghi chú: {r.note}</p>}
          {r.attachments && r.attachments.length > 0 && (
            <div className="mt-2 pt-2 border-t border-purple-200/50 dark:border-purple-900/40">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">File đính kèm:</p>
              <div className="flex flex-wrap gap-2">
                {r.attachments.map(att => (
                  <a key={att.attachmentId} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    {att.fileName}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Transfers */}
      {data.transfers.map(t => {
        const isActioning = actioning === t.surplusTransferId;
        return (
          <div key={t.surplusTransferId} className="border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg px-4 py-3 text-sm">
            <div className="flex justify-between flex-wrap gap-2 items-start">
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  Dự án gửi: <strong className="text-slate-700 dark:text-slate-200">{t.fromProjectName}</strong> → Dự án nhận: <strong className="text-slate-700 dark:text-slate-200">{t.toProjectName}</strong>
                </span>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mt-2">
              Số lượng: <strong>{t.transferQuantity} {unitName}</strong>
              &nbsp;|&nbsp; Ngày tạo: {formatDateVN(t.createdAt)}
            </p>

            {t.attachments && t.attachments.length > 0 && (
              <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-900/40">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">File đính kèm:</p>
                <div className="flex flex-wrap gap-2">
                  {t.attachments.map(att => (
                    <a key={att.attachmentId} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      {att.fileName}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons based on status & role */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {t.status === 'Pending' && isTPKT && (
                <>
                  <button
                    disabled={isActioning}
                    onClick={() => doTransferAction(t.surplusTransferId, 'review-approve')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {isActioning ? '...' : '✓ Duyệt'}
                  </button>
                  <button
                    disabled={isActioning}
                    onClick={() => doTransferAction(t.surplusTransferId, 'review-reject')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50"
                  >
                    {isActioning ? '...' : '✕ Từ chối'}
                  </button>
                </>
              )}
              {t.status === 'Approved' && isLeader && t.fromProjectId === currentProjectId && (
                <button
                  disabled={isActioning}
                  onClick={() => doTransferAction(t.surplusTransferId, 'dispatch')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {isActioning ? '...' : '🚚 Xác nhận đã gửi'}
                </button>
              )}
              {t.status === 'Dispatched' && isLeader && t.toProjectId === currentProjectId && (
                <button
                  disabled={isActioning}
                  onClick={() => doTransferAction(t.surplusTransferId, 'receive')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isActioning ? '...' : '📦 Xác nhận đã nhận'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Liquidations */}
      {data.liquidations.map(l => (
        <div key={l.surplusLiquidationId} className="border border-orange-100 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/30 rounded-lg px-4 py-3 text-sm">
          <div className="flex justify-between flex-wrap gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Khách hàng: {l.buyerName}
            </span>
            <span className="text-slate-500 dark:text-slate-400">{formatDateVN(l.createdAt)}</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 mt-1">
            Số lượng thanh lý: <strong>{l.liquidationQuantity} {unitName}</strong>
            &nbsp;|&nbsp; Giá trị thu hồi: <strong className="text-green-700 dark:text-green-400">{formatCurrency(l.totalAmount)}</strong>
          </p>
          {l.attachments && l.attachments.length > 0 && (
            <div className="mt-2 pt-2 border-t border-orange-200/50 dark:border-orange-900/40">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">File đính kèm:</p>
              <div className="flex flex-wrap gap-2">
                {l.attachments.map(att => (
                  <a key={att.attachmentId} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-slate-700">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    {att.fileName}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {dispatchingTransferId && (
        <DispatchTransferModal
          isOpen={!!dispatchingTransferId}
          onClose={() => setDispatchingTransferId(null)}
          onSuccess={() => {
            scheduleRealtimeRefresh();
            onRefresh();
          }}
          surplusTransferId={dispatchingTransferId}
        />
      )}

      {receivingTransferId && (
        <ReceiveTransferModal
          isOpen={!!receivingTransferId}
          onClose={() => setReceivingTransferId(null)}
          onSuccess={() => {
            scheduleRealtimeRefresh();
            onRefresh();
          }}
          surplusTransferId={receivingTransferId}
        />
      )}
    </div>
  );
};
