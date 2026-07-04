import React, { useEffect, useState } from 'react';
import { Modal, Button, LoadingSpinner } from '../../../components/ui';
import { surplusService } from '../../../services/surplusService';
import type { SurplusRequestItem, SurplusActionList } from '../../../types/surplus';
import {
  getSurplusTransferStatusDetails,
  formatDateVN,
  formatCurrency,
} from '../../../utils/surplusHelpers';
import toast from 'react-hot-toast';

interface SurplusActionListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  item: SurplusRequestItem;
  isTPKT: boolean;
  isLeader: boolean;
}

export const SurplusActionListModal: React.FC<SurplusActionListModalProps> = ({
  isOpen, onClose, onRefresh, item, isTPKT, isLeader,
}) => {
  const [data, setData] = useState<SurplusActionList | null>(null);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, item.surplusRequestItemId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await surplusService.getActionList(item.surplusRequestItemId);
      setData(res);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải actions.');
    } finally {
      setLoading(false);
    }
  };

  const doTransferAction = async (transferId: number, action: 'review-approve' | 'review-reject' | 'dispatch' | 'receive') => {
    setActioning(transferId);
    try {
      if (action === 'review-approve') await surplusService.reviewTransfer(transferId, true);
      else if (action === 'review-reject') await surplusService.reviewTransfer(transferId, false);
      else if (action === 'dispatch') await surplusService.dispatchTransfer(transferId);
      else if (action === 'receive') await surplusService.receiveTransfer(transferId);
      toast.success('Thao tác thành công!');
      await loadData();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi hệ thống.');
    } finally {
      setActioning(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Actions — ${item.materialName}`}
      width="lg"
      footer={<Button variant="outline" onClick={onClose}>Đóng</Button>}
    >
      {loading ? (
        <div className="flex justify-center items-center py-10 gap-2">
          <LoadingSpinner /><span className="text-sm text-slate-500">Đang tải...</span>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-6">

          {/* Returns */}
          {data.returns.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-purple-600 mb-2">
                Trả Nhà Cung Cấp ({data.returns.length})
              </h4>
              <div className="flex flex-col gap-2">
                {data.returns.map(r => (
                  <div key={r.surplusReturnSupplierId} className="border border-purple-100 bg-purple-50 rounded-lg px-4 py-3 text-sm">
                    <div className="flex justify-between flex-wrap gap-2">
                      <span className="font-semibold text-slate-700">
                        #{r.surplusReturnSupplierId} — {r.supplierName || 'NCC không xác định'}
                      </span>
                      <span className="text-slate-500">{formatDateVN(r.createdAt)}</span>
                    </div>
                    <p className="text-slate-600 mt-1">
                      Số lượng: <strong>{r.returnQuantity} {item.unitName}</strong>
                      {r.refundAmount != null && (
                        <> &nbsp;|&nbsp; Thu hồi: <strong className="text-green-700">{formatCurrency(r.refundAmount)}</strong></>
                      )}
                    </p>
                    {r.note && <p className="text-slate-400 text-xs mt-0.5">Ghi chú: {r.note}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Transfers */}
          {data.transfers.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">
                Chuyển Kho ({data.transfers.length})
              </h4>
              <div className="flex flex-col gap-2">
                {data.transfers.map(t => {
                  const badge = getSurplusTransferStatusDetails(t.status);
                  const isActioning = actioning === t.surplusTransferId;
                  return (
                    <div key={t.surplusTransferId} className="border border-blue-100 bg-blue-50 rounded-lg px-4 py-3 text-sm">
                      <div className="flex justify-between flex-wrap gap-2 items-start">
                        <div>
                          <span className="font-semibold text-slate-700">#{t.surplusTransferId}</span>
                          <span className="text-slate-500 ml-2">
                            {t.fromProjectName} → {t.toProjectName}
                          </span>
                        </div>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}>
                          {badge.name}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">
                        Số lượng: <strong>{t.transferQuantity} {item.unitName}</strong>
                        &nbsp;|&nbsp; Tạo: {formatDateVN(t.createdAt)}
                      </p>

                      {/* Action buttons based on status & role */}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {t.status === 'Pending' && isTPKT && (
                          <>
                            <button
                              disabled={isActioning}
                              onClick={() => doTransferAction(t.surplusTransferId, 'review-approve')}
                              className="px-3 py-1 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {isActioning ? '...' : '✓ Duyệt'}
                            </button>
                            <button
                              disabled={isActioning}
                              onClick={() => doTransferAction(t.surplusTransferId, 'review-reject')}
                              className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 disabled:opacity-50"
                            >
                              {isActioning ? '...' : '✕ Từ chối'}
                            </button>
                          </>
                        )}
                        {t.status === 'Approved' && isLeader && (
                          <button
                            disabled={isActioning}
                            onClick={() => doTransferAction(t.surplusTransferId, 'dispatch')}
                            className="px-3 py-1 text-xs font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            {isActioning ? '...' : '🚚 Xác nhận đã gửi'}
                          </button>
                        )}
                        {t.status === 'Dispatched' && isLeader && (
                          <button
                            disabled={isActioning}
                            onClick={() => doTransferAction(t.surplusTransferId, 'receive')}
                            className="px-3 py-1 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {isActioning ? '...' : '📦 Xác nhận đã nhận'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Liquidations */}
          {data.liquidations.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-2">
                Thanh Lý ({data.liquidations.length})
              </h4>
              <div className="flex flex-col gap-2">
                {data.liquidations.map(l => (
                  <div key={l.surplusLiquidationId} className="border border-orange-100 bg-orange-50 rounded-lg px-4 py-3 text-sm">
                    <div className="flex justify-between flex-wrap gap-2">
                      <span className="font-semibold text-slate-700">
                        #{l.surplusLiquidationId} — {l.buyerName}
                      </span>
                      <span className="text-slate-500">{formatDateVN(l.createdAt)}</span>
                    </div>
                    <p className="text-slate-600 mt-1">
                      Số lượng: <strong>{l.liquidationQuantity} {item.unitName}</strong>
                      &nbsp;|&nbsp; Giá trị thu hồi: <strong className="text-green-700">{formatCurrency(l.totalAmount)}</strong>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.returns.length === 0 && data.transfers.length === 0 && data.liquidations.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">Chưa có action nào cho vật tư này.</p>
          )}
        </div>
      ) : null}
    </Modal>
  );
};
