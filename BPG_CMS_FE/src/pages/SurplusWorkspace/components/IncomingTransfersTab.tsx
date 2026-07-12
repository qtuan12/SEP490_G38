import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '../../../components/ui';
import { surplusService } from '../../../services/surplusService';
import type { IncomingTransfer } from '../../../types/surplus';
import { getSurplusTransferStatusDetails, formatDateVN } from '../../../utils/surplusHelpers';
import { useAuth } from '../../../context/AuthContext';
import { useSignalREvent } from '../../../hooks/useSignalREvent';
import toast from 'react-hot-toast';
import { RefreshCw, Package } from 'lucide-react';
import { ReceiveTransferModal } from '../modals/ReceiveTransferModal';

interface IncomingTransfersTabProps {
  projectId: number;
}

export const IncomingTransfersTab: React.FC<IncomingTransfersTabProps> = ({ projectId }) => {
  const [list, setList] = useState<IncomingTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [receivingTransferId, setReceivingTransferId] = useState<number | null>(null);
  const { user } = useAuth(); // Leader is a type of Site Engineer
  const isSiteEngineer = user?.role === 'siteengineer';
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (projectId) loadData();
  }, [projectId, refreshKey]);

  useSignalREvent('ReceiveNotification', (noti: any) => {
    if (noti?.referenceType === 'SurplusRequest') {
      setRefreshKey(k => k + 1);
    }
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await surplusService.getIncomingTransfers(projectId);
      setList(data);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải danh sách hàng đến');
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = (transferId: number) => {
    setReceivingTransferId(transferId);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-100 text-green-600 rounded-xl">
            <Package size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Vật tư chuyển đến</h2>
            <p className="text-sm text-slate-500">
              Quản lý các chuyến hàng vật tư từ dự án khác chuyển tới
            </p>
          </div>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="py-3 px-4 font-semibold text-slate-600 text-sm whitespace-nowrap">Mã chuyến</th>
              <th className="py-3 px-4 font-semibold text-slate-600 text-sm whitespace-nowrap">Dự án gửi</th>
              <th className="py-3 px-4 font-semibold text-slate-600 text-sm whitespace-nowrap">Tên vật tư</th>
              <th className="py-3 px-4 font-semibold text-slate-600 text-sm whitespace-nowrap text-right">Số lượng</th>
              <th className="py-3 px-4 font-semibold text-slate-600 text-sm whitespace-nowrap">Ngày gửi</th>
              <th className="py-3 px-4 font-semibold text-slate-600 text-sm whitespace-nowrap text-center">Trạng thái</th>
              <th className="py-3 px-4 font-semibold text-slate-600 text-sm whitespace-nowrap text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && list.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  <div className="flex justify-center items-center gap-2">
                    <LoadingSpinner /> <span className="text-slate-500">Đang tải dữ liệu...</span>
                  </div>
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500">
                  Không có chuyến hàng nào chuyển đến.
                </td>
              </tr>
            ) : (
              list.map((item) => {
                const badge = getSurplusTransferStatusDetails(item.status);
                return (
                  <tr key={item.surplusTransferId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-700">#{item.surplusTransferId}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {item.fromProjectName}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700">{item.materialName}</span>
                        <span className="text-xs text-slate-400 font-mono">{item.materialCode}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-slate-800">{item.transferQuantity}</span>
                      <span className="text-xs text-slate-500 ml-1">{item.unitName}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {item.dispatchedAt ? formatDateVN(item.dispatchedAt) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                        {badge.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.status === 'Dispatched' && isSiteEngineer && (
                        <button
                          onClick={() => handleReceive(item.surplusTransferId)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                        >
                          📦 Xác nhận đã nhận
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {receivingTransferId && (
        <ReceiveTransferModal
          isOpen={!!receivingTransferId}
          onClose={() => setReceivingTransferId(null)}
          onSuccess={() => setRefreshKey(k => k + 1)}
          surplusTransferId={receivingTransferId}
        />
      )}
    </div>
  );
};
