import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingSpinner, Pagination } from '../../../components/ui';
import { Search, Eye } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import type { MaterialIssuance } from '../../../types/inventory';
import { formatDateVN } from '../../../utils/inventoryHelpers';

interface MaterialIssuancesTabProps {
  projectId: number;
  onViewIssuance: (id: number) => void;
  refreshKey: number;
}

export const MaterialIssuancesTab: React.FC<MaterialIssuancesTabProps> = ({
  projectId,
  onViewIssuance,
  refreshKey
}) => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [issuancesList, setIssuancesList] = useState<MaterialIssuance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const searchVal = searchParams.get('search');
    if (searchVal !== null) {
      setSearchTerm(searchVal);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadIssuances();
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [projectId, page, searchTerm, refreshKey]);

  const loadIssuances = async () => {
    setLoading(true);
    setError(null);
    try {
      const pagedData = await inventoryService.getMaterialIssuances(
        projectId,
        page,
        10,
        searchTerm
      );
      setIssuancesList(pagedData.items);
      setTotalPages(pagedData.totalPages);
    } catch (err: any) {
      console.error('Error loading issuances:', err);
      setError(err.message || 'Không thể tải danh sách phiếu xuất kho.');
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
            placeholder="Tìm kiếm theo công việc, mục đích..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1);
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
          <span className="text-slate-500 text-sm">Đang tải phiếu xuất kho...</span>
        </div>
      ) : (
        <>
          {/* Bảng danh sách */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Mã phiếu</th>
                  <th className="px-4 py-3">Công việc thi công</th>
                  <th className="px-4 py-3">Mục đích xuất</th>
                  <th className="px-4 py-3 text-center">Số loại vật tư</th>
                  <th className="px-4 py-3">Ngày xuất</th>
                  <th className="px-4 py-3">Người lập phiếu</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {issuancesList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Không tìm thấy phiếu xuất kho nào.
                    </td>
                  </tr>
                ) : (
                  issuancesList.map(i => (
                    <tr key={i.materialIssuanceId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-blue-600 font-mono text-xs">
                        {i.issuanceNo || `PXK-${String(i.materialIssuanceId).padStart(5, '0')}`}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {i.taskName}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {i.purpose}
                      </td>
                      <td className="px-4 py-3.5 text-center font-medium text-slate-900">
                        {i.totalItems}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatDateVN(i.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {i.createdByName}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Đã xuất dùng
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => onViewIssuance(i.materialIssuanceId)}
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
