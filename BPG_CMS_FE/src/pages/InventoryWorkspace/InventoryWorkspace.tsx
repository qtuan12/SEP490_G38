import React, { useEffect, useState } from 'react';
import { Button, LoadingSpinner } from '../../components/ui';
import { inventoryService } from '../../services/inventoryService';
import type { CurrentInventory } from '../../types/inventory';

// Import các sub-components được bóc tách
import { InventoryOverviewCards } from './components/InventoryOverviewCards';
import { CurrentStockTab } from './components/CurrentStockTab';
import { GoodsReceiptsTab } from './components/GoodsReceiptsTab';
import { MaterialIssuancesTab } from './components/MaterialIssuancesTab';
import { LedgerHistoryTab } from './components/LedgerHistoryTab';

import { CreateReceiptModal } from './modals/CreateReceiptModal';
import { ReceiptDetailModal } from './modals/ReceiptDetailModal';
import { CreateIssuanceModal } from './modals/CreateIssuanceModal';
import { IssuanceDetailModal } from './modals/IssuanceDetailModal';
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  AlertTriangle,
  Plus,
  RefreshCw
} from 'lucide-react';

interface InventoryWorkspaceProps {
  projectId: number;
}

export const InventoryWorkspace: React.FC<InventoryWorkspaceProps> = ({ projectId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'current' | 'receipts' | 'issuances' | 'ledger'>('current');
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Danh sách vật tư hiện có (để phục vụ card thống kê và bộ lọc thẻ kho)
  const [inventoryList, setInventoryList] = useState<CurrentInventory[]>([]);

  // Key để bắt các sub-components gọi lại API khi có thay đổi dữ liệu (tạo mới/hủy)
  const [refreshKey, setRefreshKey] = useState(0);

  // Quản lý trạng thái đóng/mở Modals
  const [isCreateReceiptOpen, setIsCreateReceiptOpen] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  const [isCreateIssuanceOpen, setIsCreateIssuanceOpen] = useState(false);
  const [selectedIssuanceId, setSelectedIssuanceId] = useState<number | null>(null);

  // Tải thông tin kho hiện tại để làm dữ liệu thống kê
  useEffect(() => {
    loadInventorySummary();
  }, [projectId, refreshKey]);

  const loadInventorySummary = async () => {
    setLoading(true);
    setGeneralError(null);
    try {
      const data = await inventoryService.getCurrentInventory(projectId);
      setInventoryList(data);
    } catch (err: any) {
      console.error('Error loading inventory summary:', err);
      setGeneralError(err.message || 'Không thể tải dữ liệu kho.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleCreateReceiptSuccess = () => {
    setIsCreateReceiptOpen(false);
    handleRefreshAll();
  };

  const handleCreateIssuanceSuccess = () => {
    setIsCreateIssuanceOpen(false);
    handleRefreshAll();
  };

  // Tính toán trước các chỉ số thống kê
  const totalMaterials = inventoryList.length;
  const lowStockCount = inventoryList.filter(item => item.quantity - item.reservedQuantity < item.safetyThreshold).length;
  const inStockCount = inventoryList.reduce((acc, curr) => acc + (curr.quantity > 0 ? 1 : 0), 0);

  // Danh sách vật tư phục vụ bộ lọc dropdown bên Lịch sử Thẻ Kho
  const uniqueMaterials = inventoryList.map(item => ({
    id: item.materialId,
    name: item.materialName
  }));

  return (
    <div className="flex flex-col gap-6 text-left">
      
      {/* 1. Các thẻ Widget Thống kê */}
      <InventoryOverviewCards
        totalMaterials={totalMaterials}
        lowStockCount={lowStockCount}
        inStockCount={inStockCount}
      />

      {/* 2. Thanh Tabs Điều Hướng & Các Nút Hành Động */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-3 gap-4">
        
        {/* Nút bấm chuyển Tab */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('current')}
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
            onClick={() => setActiveSubTab('receipts')}
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
            onClick={() => setActiveSubTab('issuances')}
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
            onClick={() => setActiveSubTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeSubTab === 'ledger'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={16} />
            <span>Nhật ký Nhập - Xuất Kho</span>
          </button>
        </div>

        {/* Nút hành động */}
        <div className="flex gap-2.5">
          {activeSubTab === 'receipts' && (
            <Button
              variant="primary"
              onClick={() => setIsCreateReceiptOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus size={16} />
              <span>Nhập kho PO</span>
            </Button>
          )}

          {activeSubTab === 'issuances' && (
            <Button
              variant="primary"
              onClick={() => setIsCreateIssuanceOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus size={16} />
              <span>Xuất kho thi công</span>
            </Button>
          )}
        </div>
      </div>

      {/* 3. Hiển thị thông báo lỗi chung nếu có */}
      {generalError && (
        <div className="p-4 bg-red-50 text-red-700 text-sm border border-red-200 rounded-xl flex gap-2">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* 4. Phần Nội dung chính của Tab đang chọn */}
      {loading && inventoryList.length === 0 ? (
        <div className="flex justify-center items-center py-20 gap-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <LoadingSpinner />
          <span className="text-slate-500 text-sm">Đang tải thông tin kho...</span>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-5 flex flex-col gap-4">
          
          {activeSubTab === 'current' && (
            <CurrentStockTab inventoryList={inventoryList} />
          )}

          {activeSubTab === 'receipts' && (
            <GoodsReceiptsTab
              projectId={projectId}
              onViewReceipt={setSelectedReceiptId}
              refreshKey={refreshKey}
            />
          )}

          {activeSubTab === 'issuances' && (
            <MaterialIssuancesTab
              projectId={projectId}
              onViewIssuance={setSelectedIssuanceId}
              refreshKey={refreshKey}
            />
          )}

          {activeSubTab === 'ledger' && (
            <LedgerHistoryTab
              projectId={projectId}
              uniqueMaterials={uniqueMaterials}
              refreshKey={refreshKey}
            />
          )}
        </div>
      )}

      {/* 5. Khai báo các Popup Modals */}
      {isCreateReceiptOpen && (
        <CreateReceiptModal
          isOpen={isCreateReceiptOpen}
          onClose={() => setIsCreateReceiptOpen(false)}
          onSuccess={handleCreateReceiptSuccess}
          projectId={projectId}
        />
      )}

      {selectedReceiptId !== null && (
        <ReceiptDetailModal
          isOpen={selectedReceiptId !== null}
          onClose={() => setSelectedReceiptId(null)}
          receiptId={selectedReceiptId}
          onSuccess={handleRefreshAll}
        />
      )}

      {isCreateIssuanceOpen && (
        <CreateIssuanceModal
          isOpen={isCreateIssuanceOpen}
          onClose={() => setIsCreateIssuanceOpen(false)}
          onSuccess={handleCreateIssuanceSuccess}
          projectId={projectId}
        />
      )}

      {selectedIssuanceId !== null && (
        <IssuanceDetailModal
          isOpen={selectedIssuanceId !== null}
          onClose={() => setSelectedIssuanceId(null)}
          issuanceId={selectedIssuanceId}
        />
      )}

    </div>
  );
};
