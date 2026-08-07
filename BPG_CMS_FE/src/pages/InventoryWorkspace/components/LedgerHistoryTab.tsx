import React, { useState, useEffect } from 'react';
import { FormItem, Select, TableLoader, Pagination } from '../../../components/ui';
import { Search } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import type { InventoryTransaction } from '../../../types/inventory';
import { getTransactionTypeDetails, formatDateTimeVN } from '../../../utils/inventoryHelpers';
import { useVirtualRows } from '../../../hooks/useVirtualRows';

interface LedgerHistoryTabProps {
  projectId: number;
  uniqueMaterials: Array<{ id: number; name: string }>;
  refreshKey: number;
}

export const LedgerHistoryTab: React.FC<LedgerHistoryTabProps> = ({
  projectId,
  uniqueMaterials,
  refreshKey
}) => {
  const [transactionsList, setTransactionsList] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMaterialId, setFilterMaterialId] = useState<string>('');
  const [filterTxType, setFilterTxType] = useState<string>('');

  // Phân trang
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const virtualTransactions = useVirtualRows(transactionsList, {
    rowHeight: 56,
    containerHeight: 560,
    threshold: 30,
  });

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadTransactions();
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [projectId, page, searchTerm, filterMaterialId, filterTxType, refreshKey]);

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const pagedData = await inventoryService.getInventoryTransactions(projectId, {
        materialId: filterMaterialId ? parseInt(filterMaterialId) : undefined,
        transactionType: filterTxType ? parseInt(filterTxType) : undefined,
        pageNumber: page,
        pageSize: 10,
        search: searchTerm
      });
      setTransactionsList(pagedData.items);
      setTotalPages(pagedData.totalPages);
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      setError(err.message || 'Không thể tải lịch sử biến động.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="flex flex-col gap-4">
      {/* Bộ lọc */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên vật tư..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <FormItem label="" className="mb-0">
          <Select
            options={[
              { label: '-- Lọc theo vật tư --', value: '' },
              ...uniqueMaterials.map(m => ({
                label: m.name,
                value: m.id.toString()
              }))
            ]}
            value={filterMaterialId}
            onChange={(e: any) => {
              setFilterMaterialId(e.target.value);
              setPage(1);
            }}
            className="py-1.5 text-sm"
          />
        </FormItem>

        <FormItem label="" className="mb-0">
          <Select
            options={[
              { label: '-- Loại biến động --', value: '' },
              { label: 'Nhập kho (Đơn mua)', value: '1' },
              { label: 'Xuất thi công', value: '2' },
              { label: 'Nhận chuyển kho', value: '3' },
              { label: 'Chuyển kho đi', value: '4' },
              { label: 'Trả hàng nhà cung cấp', value: '5' },
              { label: 'Điều chỉnh/Hủy', value: '6' },
              { label: 'Thanh lý', value: '7' },
              { label: 'Hoàn trả thi công', value: '8' },
              { label: 'Giảm tồn do sự cố', value: '9' }
            ]}
            value={filterTxType}
            onChange={(e: any) => {
              setFilterTxType(e.target.value);
              setPage(1);
            }}
            className="py-1.5 text-sm"
          />
        </FormItem>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading && transactionsList.length === 0 ? (
        <TableLoader isTable={false} message="Đang tải lịch sử biến động kho..." />
      ) : (
        <>
          {/* Bảng Thẻ kho */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl" {...virtualTransactions.scrollContainerProps}>
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Ngày giờ</th>
                  <th className="px-4 py-3">Mã vật tư</th>
                  <th className="px-4 py-3">Vật tư</th>
                  <th className="px-4 py-3 text-center">Loại </th>
                  <th className="px-4 py-3 text-right">Lượng thay đổi</th>
                  <th className="px-4 py-3 text-right">Tồn sau biến động</th>
                  <th className="px-4 py-3">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {transactionsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Không tìm thấy biến động kho nào.
                    </td>
                  </tr>
                ) : (
                  <>
                    {virtualTransactions.topPadding > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={7} style={{ height: virtualTransactions.topPadding, padding: 0 }} />
                      </tr>
                    )}
                    {virtualTransactions.visibleRows.map(({ item: t }) => {
                      const typeInfo = getTransactionTypeDetails(t.transactionType);
                      return (
                        <tr key={t.transactionId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3.5 text-slate-600">
                            {formatDateTimeVN(t.createdAt)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                            {t.materialCode}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-800">
                            {t.materialName}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${typeInfo.color}`}>
                              {typeInfo.name}
                            </span>
                          </td>
                          <td className={`px-4 py-3.5 text-right font-bold ${t.quantityChange > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                            {t.quantityChange > 0 ? `+${t.quantityChange}` : t.quantityChange}{' '}
                            <span className="text-xs text-slate-400 font-normal">{t.unitName}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                            {t.balanceAfter}{' '}
                            <span className="text-xs text-slate-400 font-normal">{t.unitName}</span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-700">
                            {t.createdByName}
                          </td>
                        </tr>
                      );
                    })}
                    {virtualTransactions.bottomPadding > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={7} style={{ height: virtualTransactions.bottomPadding, padding: 0 }} />
                      </tr>
                    )}
                  </>
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
