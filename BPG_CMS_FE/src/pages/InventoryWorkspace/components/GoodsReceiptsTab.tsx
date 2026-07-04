import React, { useState, useEffect } from 'react';
import { LoadingSpinner, Pagination } from '../../../components/ui';
import { Search, Eye } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import type { GoodsReceipt } from '../../../types/inventory';
import { getGoodsReceiptStatusDetails, formatDateVN } from '../../../utils/inventoryHelpers';

interface GoodsReceiptsTabProps {
  projectId: number;
  onViewReceipt: (id: number) => void;
  refreshKey: number;
}

export const GoodsReceiptsTab: React.FC<GoodsReceiptsTabProps> = ({
  projectId,
  onViewReceipt,
  refreshKey
}) => {
  const [receiptsList, setReceiptsList] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Gọi API tải danh sách phiếu nhập khi page, searchTerm, projectId, hoặc refreshKey thay đổi
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadReceipts();
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [projectId, page, searchTerm, refreshKey]);

  const loadReceipts = async () => {
    setLoading(true);
    setError(null);
    try {
      const pagedData = await inventoryService.getGoodsReceipts(
        projectId,
        page,
        10,
        searchTerm
      );
      setReceiptsList(pagedData.items);
      setTotalPages(pagedData.totalPages);
    } catch (err: any) {
      console.error('Error loading receipts:', err);
      setError(err.message || 'Không thể tải danh sách phiếu nhập kho.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tìm kiếm */}
      <div className="flex gap-4 items-center">
        <div className="relative max-w-sm flex-grow">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã receipt, mã PO, deliverer..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1); // Reset về trang 1 khi gõ tìm kiếm mới
            }}
            className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-10 gap-2">
          <LoadingSpinner />
          <span className="text-slate-500 text-sm">Đang tải phiếu nhập kho...</span>
        </div>
      ) : (
        <>
          {/* Bảng danh sách */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Mã phiếu</th>
                  <th className="px-4 py-3">Mã đơn PO</th>
                  <th className="px-4 py-3">Người giao</th>
                  <th className="px-4 py-3">Số phiếu giao</th>
                  <th className="px-4 py-3">Ngày nhận</th>
                  <th className="px-4 py-3">Người tiếp nhận</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {receiptsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Không tìm thấy phiếu nhập kho nào.
                    </td>
                  </tr>
                ) : (
                  receiptsList.map(r => (
                    <tr key={r.receiptId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-blue-600 font-mono text-xs">
                        {r.receiptNo}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900 font-mono text-xs">
                        {r.poNumber}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {(() => {
                          const info = r.delivererInfo || 'N/A';
                          const match = info.match(/^\[QC:\s*([^\]]+)\](.*)$/);
                          if (match) {
                            const status = match[1];
                            const rest = match[2].trim();
                            let badgeClass = "bg-slate-50 text-slate-600 border-slate-200";
                            if (status.includes("Đạt")) badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                            else if (status.includes("Không")) badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                            else if (status.includes("Chờ")) badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                            
                            return (
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${badgeClass}`}>
                                  QC: {status}
                                </span>
                                {rest && <span className="text-xs text-slate-600">{rest}</span>}
                              </div>
                            );
                          }
                          return info;
                        })()}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">
                        {r.deliveryDocNo || 'N/A'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatDateVN(r.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {r.createdByName}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {(() => {
                          const badge = getGoodsReceiptStatusDetails(r.status);
                          return (
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}>
                              {badge.name}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => onViewReceipt(r.receiptId)}
                          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 mx-auto"
                        >
                          <Eye size={14} />
                          <span>Xem</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
};
