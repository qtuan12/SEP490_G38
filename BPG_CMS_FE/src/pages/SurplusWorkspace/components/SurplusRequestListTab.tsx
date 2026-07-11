import React, { useEffect, useState } from 'react';
import { LoadingSpinner, Pagination } from '../../../components/ui';
import { Search, Eye, Plus } from 'lucide-react';
import { surplusService } from '../../../services/surplusService';
import type { SurplusRequest } from '../../../types/surplus';
import {
  getSurplusRequestStatusDetails,
  formatDateVN,
} from '../../../utils/surplusHelpers';

interface SurplusRequestListTabProps {
  projectId: number;
  refreshKey: number;
  onViewDetail: (id: number) => void;
  onCreateRequest: () => void;
  isLeader: boolean;
}

export const SurplusRequestListTab: React.FC<SurplusRequestListTabProps> = ({
  projectId,
  refreshKey,
  onViewDetail,
  onCreateRequest,
  isLeader,
}) => {
  const [list, setList] = useState<SurplusRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => loadList(), 150);
    return () => clearTimeout(timer);
  }, [projectId, page, search, statusFilter, refreshKey]);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await surplusService.getList({
        projectId,
        search: search || undefined,
        status: statusFilter || undefined,
        pageNumber: page,
        pageSize: 10,
      });
      setList(result.items);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-1">
          <div className="relative max-w-xs flex-grow">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên dự án, lý do..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="Processing">Đang xử lý</option>
            <option value="Processed">Đã hoàn tất</option>
          </select>
        </div>

        {isLeader && (
          <button
            onClick={onCreateRequest}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            <span>Tạo đề xuất xử lý thừa</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-10 gap-2">
          <LoadingSpinner />
          <span className="text-slate-500 text-sm">Đang tải...</span>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Mã đề xuất</th>
                  <th className="px-4 py-3">Dự án</th>
                  <th className="px-4 py-3">Lý do</th>
                  <th className="px-4 py-3 text-center">Tiến độ</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                  <th className="px-4 py-3">Người tạo</th>
                  <th className="px-4 py-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Chưa có đề xuất xử lý vật tư thừa nào.
                    </td>
                  </tr>
                ) : (
                  list.map(item => {
                    const badge = getSurplusRequestStatusDetails(item.status);
                    const progress = item.totalItems > 0
                      ? Math.round((item.processedItems / item.totalItems) * 100)
                      : 0;
                    return (
                      <tr key={item.surplusRequestId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-blue-600">
                          #{item.surplusRequestId}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">{item.projectName}</td>
                        <td className="px-4 py-3.5 text-slate-500 max-w-[160px] truncate">
                          {item.reason || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-600 font-medium">
                              {item.processedItems}/{item.totalItems}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}>
                            {badge.name}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{formatDateVN(item.createdAt)}</td>
                        <td className="px-4 py-3.5 text-slate-700">{item.createdByName}</td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => onViewDetail(item.surplusRequestId)}
                            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 mx-auto"
                          >
                            <Eye size={14} />
                            <span>Xem</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};
