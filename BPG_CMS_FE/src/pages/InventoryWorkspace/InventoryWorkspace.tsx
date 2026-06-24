import React, { useEffect, useState } from 'react';
import { Button, LoadingSpinner, FormItem, Select, Pagination } from '../../components/ui';
import { inventoryService } from '../../services/inventoryService';
import type {
  CurrentInventory,
  InventoryTransaction,
  GoodsReceipt
} from '../../types/inventory';
import { CreateReceiptModal } from './modals/CreateReceiptModal';
import { ReceiptDetailModal } from './modals/ReceiptDetailModal';
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  AlertTriangle,
  Search,
  Plus,
  Eye,
  RefreshCw
} from 'lucide-react';

interface InventoryWorkspaceProps {
  projectId: number;
}

export const InventoryWorkspace: React.FC<InventoryWorkspaceProps> = ({ projectId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'current' | 'receipts' | 'issuances' | 'ledger'>('current');
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Data states
  const [inventoryList, setInventoryList] = useState<CurrentInventory[]>([]);
  const [receiptsList, setReceiptsList] = useState<GoodsReceipt[]>([]);
  const [transactionsList, setTransactionsList] = useState<InventoryTransaction[]>([]);

  // Search/Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMaterialId, setFilterMaterialId] = useState<string>('');
  const [filterTxType, setFilterTxType] = useState<string>('');

  // Pagination states
  const [receiptsPage, setReceiptsPage] = useState(1);
  const [receiptsTotalPages, setReceiptsTotalPages] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);

  // Modals state
  const [isCreateReceiptOpen, setIsCreateReceiptOpen] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);

  // Unified data loader with batching & debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadData();
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [projectId, activeSubTab, receiptsPage, ledgerPage, filterMaterialId, filterTxType, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    setGeneralError(null);
    try {
      if (activeSubTab === 'current') {
        const data = await inventoryService.getCurrentInventory(projectId);
        setInventoryList(data);
      } else if (activeSubTab === 'receipts') {
        const pagedData = await inventoryService.getGoodsReceipts(
          projectId,
          receiptsPage,
          10,
          searchTerm
        );
        setReceiptsList(pagedData.items);
        setReceiptsTotalPages(pagedData.totalPages);
      } else if (activeSubTab === 'ledger') {
        const pagedData = await inventoryService.getInventoryTransactions(projectId, {
          materialId: filterMaterialId ? parseInt(filterMaterialId) : undefined,
          transactionType: filterTxType ? parseInt(filterTxType) : undefined,
          pageNumber: ledgerPage,
          pageSize: 10,
          search: searchTerm
        });
        setTransactionsList(pagedData.items);
        setLedgerTotalPages(pagedData.totalPages);
      }
    } catch (err: any) {
      console.error('Error loading inventory data:', err);
      setGeneralError(err.message || 'Không thể tải dữ liệu kho.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReceiptSuccess = () => {
    // Reset pages to 1 and reload
    setReceiptsPage(1);
    setLedgerPage(1);
    loadData();
  };

  // Helper formatting values
  const getTransactionTypeName = (type: number) => {
    switch (type) {
      case 1:
        return { name: 'Nhập kho PO', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 2:
        return { name: 'Xuất thi công', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 3:
        return { name: 'Chuyển kho đến', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 4:
        return { name: 'Chuyển kho đi', color: 'bg-violet-50 text-violet-700 border-violet-200' };
      case 5:
        return { name: 'Trả hàng NCC', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 6:
        return { name: 'Điều chỉnh', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { name: 'Giao dịch khác', color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  // Filter current stock on client side (for responsiveness)
  const filteredInventory = inventoryList.filter(
    item =>
      item.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.materialCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Extract unique materials from project stock list for dropdown filter
  const uniqueMaterials = inventoryList.map(item => ({
    id: item.materialId,
    name: item.materialName
  }));

  // Safety items count
  const lowStockItemsCount = inventoryList.filter(item => item.quantity - item.reservedQuantity < item.safetyThreshold).length;

  return (
    <div className="flex flex-col gap-6 text-left">
      
      {/* Overview Cards / Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 flex items-center justify-between border border-slate-100 bg-white shadow-sm rounded-xl">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tổng số loại vật tư</span>
            <strong className="text-2xl font-extrabold text-slate-900 mt-1">{inventoryList.length}</strong>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Package size={22} />
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center justify-between border border-slate-100 bg-white shadow-sm rounded-xl">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Vật tư sắp hết kho</span>
            <strong className={`text-2xl font-extrabold mt-1 ${lowStockItemsCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-900'}`}>
              {lowStockItemsCount}
            </strong>
          </div>
          <div className={`p-3 rounded-xl ${lowStockItemsCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center justify-between border border-slate-100 bg-white shadow-sm rounded-xl">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Mặt hàng tồn kho</span>
            <strong className="text-2xl font-extrabold text-slate-900 mt-1">
              {inventoryList.reduce((acc, curr) => acc + (curr.quantity > 0 ? 1 : 0), 0)}
            </strong>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ArrowDownToLine size={22} />
          </div>
        </div>
      </div>

      {/* Tabs Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-3 gap-4">
        {/* Navigation buttons */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setActiveSubTab('current');
              setSearchTerm('');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeSubTab === 'current'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package size={16} />
            <span>Tồn kho hiện tại</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('receipts');
              setSearchTerm('');
              setReceiptsPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeSubTab === 'receipts'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownToLine size={16} />
            <span>Phiếu Nhập Kho</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('issuances');
              setSearchTerm('');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeSubTab === 'issuances'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpFromLine size={16} />
            <span>Phiếu Xuất Kho</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('ledger');
              setSearchTerm('');
              setLedgerPage(1);
              setFilterMaterialId('');
              setFilterTxType('');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeSubTab === 'ledger'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={16} />
            <span>Lịch sử Thẻ Kho</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsCreateReceiptOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Nhập kho PO</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {generalError && (
        <div className="p-4 bg-red-50 text-red-700 text-sm border border-red-200 rounded-xl flex gap-2">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20 gap-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <LoadingSpinner />
          <span className="text-slate-500 text-sm">Đang tải thông tin...</span>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-5 flex flex-col gap-4">
          
          {/* Sub-tab 1: Current stock */}
          {activeSubTab === 'current' && (
            <>
              {/* Search bar */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm vật tư theo tên hoặc mã..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Mã vật tư</th>
                      <th className="px-4 py-3">Tên vật tư</th>
                      <th className="px-4 py-3">Quy cách</th>
                      <th className="px-4 py-3 text-right">Tồn thực tế</th>
                      <th className="px-4 py-3 text-right">Đang đóng băng</th>
                      <th className="px-4 py-3 text-right">Khả dụng</th>
                      <th className="px-4 py-3 text-center">Trạng thái kho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Không tìm thấy vật tư nào trong kho dự án.
                        </td>
                      </tr>
                    ) : (
                      filteredInventory.map(item => {
                        const isUnderThreshold = item.availableQuantity < item.safetyThreshold;
                        return (
                          <tr
                            key={item.inventoryId}
                            className={`hover:bg-slate-50 transition-colors ${
                              isUnderThreshold ? 'bg-amber-50/40 hover:bg-amber-50/70' : ''
                            }`}
                          >
                            <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                              {item.materialCode}
                            </td>
                            <td className="px-4 py-3.5 font-semibold text-slate-800">
                              {item.materialName}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500">
                              {item.specification || 'N/A'}
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                              {item.quantity} <span className="text-xs text-slate-400 font-normal">{item.unitName}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right text-slate-500">
                              {item.reservedQuantity > 0 ? (
                                <span className="text-rose-600 font-medium">-{item.reservedQuantity}</span>
                              ) : (
                                '0'
                              )}{' '}
                              <span className="text-xs text-slate-400 font-normal">{item.unitName}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                              {item.availableQuantity} <span className="text-xs text-slate-400 font-normal">{item.unitName}</span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              {isUnderThreshold ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <AlertTriangle size={12} />
                                  <span>Dưới hạn an toàn ({item.safetyThreshold})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  An toàn
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Sub-tab 2: Goods Receipts */}
          {activeSubTab === 'receipts' && (
            <>
              {/* Search and Filters */}
              <div className="flex gap-4 items-center">
                <div className="relative max-w-sm flex-grow">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo mã receipt, mã PO, deliverer..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Table */}
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
                            {r.delivererInfo || 'N/A'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">
                            {r.deliveryDocNo || 'N/A'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">
                            {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700">
                            {r.createdByName}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {r.status === 'Cancelled' ? (
                              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                Đã hủy
                              </span>
                            ) : (
                              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Đã nhập kho
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => setSelectedReceiptId(r.receiptId)}
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

              {/* Pagination component */}
              <Pagination
                currentPage={receiptsPage}
                totalPages={receiptsTotalPages}
                onPageChange={setReceiptsPage}
              />
            </>
          )}

          {/* Sub-tab 3: Material Issuances */}
          {activeSubTab === 'issuances' && (
            <div className="py-12 text-center flex flex-col items-center gap-3">
              <ArrowUpFromLine size={48} className="text-slate-300" />
              <h4 className="text-base font-bold text-slate-800">Phiếu Xuất Kho Thi Công</h4>
              <p className="text-slate-500 text-sm max-w-md">
                Chức năng quản lý phiếu xuất kho thi công, định mức công việc WBS sẽ được triển khai đầy đủ ở nhánh tiếp theo (`feature/duc/material-issuance`).
              </p>
            </div>
          )}

          {/* Sub-tab 4: Ledger History */}
          {activeSubTab === 'ledger' && (
            <>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="relative col-span-1 md:col-span-2">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo vật tư..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
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
                      setLedgerPage(1);
                    }}
                    className="py-1.5 text-sm"
                  />
                </FormItem>

                <FormItem label="" className="mb-0">
                  <Select
                    options={[
                      { label: '-- Loại biến động --', value: '' },
                      { label: 'Nhập kho PO', value: '1' },
                      { label: 'Xuất thi công', value: '2' },
                      { label: 'Điều chỉnh', value: '6' }
                    ]}
                    value={filterTxType}
                    onChange={(e: any) => {
                      setFilterTxType(e.target.value);
                      setLedgerPage(1);
                    }}
                    className="py-1.5 text-sm"
                  />
                </FormItem>
              </div>

              {/* Ledger Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Ngày giờ</th>
                      <th className="px-4 py-3">Mã vật tư</th>
                      <th className="px-4 py-3">Vật tư</th>
                      <th className="px-4 py-3 text-center">Loại giao dịch</th>
                      <th className="px-4 py-3 text-right">Lượng thay đổi</th>
                      <th className="px-4 py-3 text-right">Tồn sau GD</th>
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
                      transactionsList.map(t => {
                        const typeInfo = getTransactionTypeName(t.transactionType);
                        return (
                          <tr key={t.transactionId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3.5 text-slate-600">
                              {new Date(t.createdAt).toLocaleString('vi-VN')}
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
                            <td className={`px-4 py-3.5 text-right font-bold ${
                              t.quantityChange > 0 ? 'text-emerald-600' : 'text-rose-600'
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
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination component */}
              <Pagination
                currentPage={ledgerPage}
                totalPages={ledgerTotalPages}
                onPageChange={setLedgerPage}
              />
            </>
          )}

        </div>
      )}

      {/* Modals */}
      {isCreateReceiptOpen && (
        <CreateReceiptModal
          isOpen={isCreateReceiptOpen}
          onClose={() => setIsCreateReceiptOpen(false)}
          onSuccess={handleCreateReceiptSuccess}
          projectId={projectId}
        />
      )}

      {selectedReceiptId && (
        <ReceiptDetailModal
          isOpen={selectedReceiptId !== null}
          onClose={() => setSelectedReceiptId(null)}
          receiptId={selectedReceiptId}
          onSuccess={handleCreateReceiptSuccess}
        />
      )}

    </div>
  );
};
