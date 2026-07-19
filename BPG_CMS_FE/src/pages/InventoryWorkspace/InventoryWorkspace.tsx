import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, LoadingSpinner } from '../../components/ui';
import { inventoryService } from '../../services/inventoryService';
import type { CurrentInventory } from '../../types/inventory';
import { useNotification } from '../../context/NotificationContext';
import { useSignalREvent } from '../../hooks/useSignalREvent';

const PROJECT_ZERO = 0;

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
  Plus
} from 'lucide-react';

interface InventoryWorkspaceProps {
  projectId: number;
}

export const InventoryWorkspace: React.FC<InventoryWorkspaceProps> = ({ projectId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { connection } = useNotification();
  const [activeSubTab, setActiveSubTab] = useState<'current' | 'receipts' | 'issuances' | 'ledger'>(
    (searchParams.get('subTab') as any) || 'current'
  );

  useEffect(() => {
    const subTab = searchParams.get('subTab');
    if (subTab && ['current', 'receipts', 'issuances', 'ledger'].includes(subTab)) {
      setActiveSubTab(subTab as any);
    }
  }, [searchParams]);

  useEffect(() => {
    const openCreate = searchParams.get('openCreate');
    if (openCreate === 'receipt' && activeSubTab === 'receipts') {
      setIsCreateReceiptOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('openCreate');
      setSearchParams(newParams);
    }
  }, [searchParams, activeSubTab]);

  const handleSubTabChange = (subTab: 'current' | 'receipts' | 'issuances' | 'ledger') => {
    setActiveSubTab(subTab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('subTab', subTab);
    setSearchParams(newParams);
  };
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

  // Realtime: tham gia group dự án + group toàn cục (Project_0) để nhận cập nhật kho
  useEffect(() => {
    if (!connection) return;

    const joinGroups = () => {
      connection.invoke('JoinProjectGroup', Number(projectId)).catch((e) =>
        console.error('[SignalR] JoinProjectGroup error:', e)
      );
      connection.invoke('JoinProjectGroup', PROJECT_ZERO).catch((e) =>
        console.error('[SignalR] JoinProjectGroup (global) error:', e)
      );
    };

    if (connection.state === 'Connected') {
      joinGroups();
    }
    connection.onreconnected(joinGroups);

    return () => {
      if (connection.state === 'Connected') {
        connection.invoke('LeaveProjectGroup', Number(projectId)).catch(console.error);
        connection.invoke('LeaveProjectGroup', PROJECT_ZERO).catch(console.error);
      }
    };
  }, [connection, projectId]);

  // Realtime: khi có biến động kho từ SignalR, làm mới toàn bộ workspace
  useSignalREvent('GoodsReceiptChanged', () => handleRefreshAll());
  useSignalREvent('MaterialIssuanceChanged', () => handleRefreshAll());
  useSignalREvent('MaterialReturnChanged', () => handleRefreshAll());

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

  const getItemStatus = (item: CurrentInventory): 'over_boq' | 'approaching' | 'low_stock' | 'stable' => {
    const available = item.availableQuantity;
    const safety = item.safetyThreshold;
    const boq = item.boqQuantity || 0;
    const used = item.usedQuantity || 0;

    if ((boq > 0 && used >= boq) || (boq === 0 && used > 0)) {
      return 'over_boq';
    }
    if (boq > 0 && used >= 0.8 * boq && used < boq) {
      return 'approaching';
    }
    if (available <= safety) {
      return 'low_stock';
    }
    return 'stable';
  };

  const lowStockCount = inventoryList.filter(item => getItemStatus(item) === 'low_stock').length;
  const inStockCount = inventoryList.reduce((acc, curr) => acc + (curr.quantity > 0 ? 1 : 0), 0);
  const overBOQCount = inventoryList.filter(item => getItemStatus(item) === 'over_boq').length;

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
        overBOQCount={overBOQCount}
      />

      {/* 2. Thanh Tabs Điều Hướng & Các Nút Hành Động */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-3 gap-4">
        
        {/* Nút bấm chuyển Tab */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => handleSubTabChange('current')}
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
            onClick={() => handleSubTabChange('receipts')}
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
            onClick={() => handleSubTabChange('issuances')}
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
            onClick={() => handleSubTabChange('ledger')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeSubTab === 'ledger'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={16} />
            <span>Nhật Ký Biến Động Vật Tư</span>
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
              <span>Nhập kho (Đơn mua hàng)</span>
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
          projectId={projectId}
          onSuccess={() => setRefreshKey(prev => prev + 1)}
        />
      )}

    </div>
  );
};
