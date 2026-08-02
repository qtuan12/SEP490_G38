import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui';
import { RefreshCw, PackageX } from 'lucide-react';
import toast from 'react-hot-toast';
import { surplusService } from '../../services/surplusService';
import { useSignalREvent } from '../../hooks/useSignalREvent';
import { useNotification } from '../../context/NotificationContext';

import { SurplusRequestListTab } from './components/SurplusRequestListTab';
import { SurplusRequestDetailTab } from './components/SurplusRequestDetailTab';
import { IncomingTransfersTab } from './components/IncomingTransfersTab';
import { CreateSurplusRequestModal } from './modals/CreateSurplusRequestModal';
import { CreateReturnModal } from './modals/CreateReturnModal';
import { CreateTransferModal } from './modals/CreateTransferModal';
import { CreateLiquidationModal } from './modals/CreateLiquidationModal';
import type { SurplusRequestItem } from '../../types/surplus';
import { useProjectAccess } from '../../hooks/useProjectAccess';
import { useRealtimeDataRefresh } from '../../hooks/useRealtimeDataRefresh';
import {
  REALTIME_DATA_CHANGED_AGGREGATION_MS,
  RealtimeEntities,
} from '../../constants/realtimeEntities';

const SURPLUS_WORKSPACE_REALTIME_ENTITIES = [
  ...RealtimeEntities.surplus,
  ...RealtimeEntities.inventory.filter(
    entity => entity === 'CurrentInventory' || entity === 'InventoryTransaction',
  ),
] as const;

interface SurplusWorkspaceProps {
  projectId: number;
  projectName: string;
}

export const SurplusWorkspace: React.FC<SurplusWorkspaceProps> = ({
  projectId,
  projectName,
}) => {
  const { connection } = useNotification();
  const { isProjectLeader, canManageTechnical, canManageAccounting } = useProjectAccess(projectId);
  const isLeader = isProjectLeader;
  const isAccountant = canManageAccounting;
  const isTPKT = canManageTechnical;
  const canCreateSurplusRequest = isLeader;

  const [activeTab, setActiveTab] = useState<'outbound' | 'inbound'>('outbound');
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCheckingCreateEligibility, setIsCheckingCreateEligibility] = useState(false);

  // Modal states
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [returnItem, setReturnItem] = useState<SurplusRequestItem | null>(null);
  const [transferItem, setTransferItem] = useState<SurplusRequestItem | null>(null);
  const [liquidationItem, setLiquidationItem] = useState<SurplusRequestItem | null>(null);


  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);
  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      handleRefresh();
    }, REALTIME_DATA_CHANGED_AGGREGATION_MS);
  }, [handleRefresh]);

  useEffect(() => () => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
  }, [projectId]);

  // Some surplus actions do not send the legacy SurplusUpdated/notification
  // event to every viewer. DataChanged keeps list/detail state in sync and the
  // refresh key deliberately leaves the active view and parent modals intact.
  useRealtimeDataRefresh(scheduleRealtimeRefresh, SURPLUS_WORKSPACE_REALTIME_ENTITIES, 0);

  // ── Join/Leave SignalR project group khi mở tab Xử lý Vật tư thừa ──
  useEffect(() => {
    if (!connection) return;
    const numericProjectId = Number(projectId);

    connection.invoke('JoinProjectGroup', numericProjectId)
      .catch(err => console.error('SurplusWorkspace: JoinProjectGroup error', err));

    const handleSurplusUpdated = (_payload: any) => {
      scheduleRealtimeRefresh();
      toast('Dữ liệu Vật tư thừa đã được cập nhật!', { icon: '🔄' });
    };

    connection.on('SurplusUpdated', handleSurplusUpdated);

    return () => {
      connection.off('SurplusUpdated', handleSurplusUpdated);
      connection.invoke('LeaveProjectGroup', numericProjectId)
        .catch(err => console.error('SurplusWorkspace: LeaveProjectGroup error', err));
    };
  }, [connection, projectId, scheduleRealtimeRefresh]);

  // ── Giữ lại listener ReceiveNotification cho các user có notification cá nhân ──
  useSignalREvent('ReceiveNotification', (noti: any) => {
    if (noti?.referenceType === 'SurplusRequest') {
      scheduleRealtimeRefresh();
    }
  });

  const handleViewDetail = (id: number) => {
    setSelectedBatchId(id);
    setView('detail');
  };

  const handleBack = () => {
    setView('list');
    setSelectedBatchId(null);
  };

  const handleOpenCreateBatch = async () => {
    if (isCheckingCreateEligibility) return;

    setIsCheckingCreateEligibility(true);
    try {
      const activeRequests = await surplusService.getList({
        projectId,
        status: 'Processing',
        pageNumber: 1,
        pageSize: 1,
      });

      if (activeRequests.items.length > 0) {
        toast.error('Dự án đang có đợt xử lý vật tư thừa chưa hoàn tất.');
        return;
      }

      setShowCreateBatch(true);
    } catch {
      toast.error('Không thể kiểm tra trạng thái xử lý vật tư thừa. Vui lòng thử lại.');
    } finally {
      setIsCheckingCreateEligibility(false);
    }
  };

  const handleActionSuccess = (message: string) => {
    toast.success(message);
    scheduleRealtimeRefresh();
  };

  return (
    <div className="flex flex-col gap-6 text-left">

      {/* Header row */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <PackageX size={20} className="text-orange-500" />
          <span className="font-semibold text-slate-700 text-base">Quản lý Vật tư Thừa</span>
          {activeTab === 'outbound' && view === 'detail' && selectedBatchId && (
            <span className="text-slate-400 text-sm">/ Đề xuất #{selectedBatchId}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('outbound')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'outbound' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Danh sách đề xuất
            </button>
            {isLeader && (
              <button
                onClick={() => setActiveTab('inbound')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'inbound' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Vật tư chuyển đến
              </button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-5 min-h-[500px]">
        {activeTab === 'outbound' && view === 'list' && (
          <SurplusRequestListTab
            projectId={projectId}
            refreshKey={refreshKey}
            onViewDetail={handleViewDetail}
            onCreateRequest={handleOpenCreateBatch}
            isCheckingCreateEligibility={isCheckingCreateEligibility}
            isLeader={canCreateSurplusRequest}
          />
        )}

        {activeTab === 'outbound' && view === 'detail' && selectedBatchId !== null && (
          <SurplusRequestDetailTab
            surplusRequestId={selectedBatchId}
            onBack={handleBack}
            onRefresh={scheduleRealtimeRefresh}
            onCreateReturn={item => setReturnItem(item)}
            onCreateTransfer={item => setTransferItem(item)}
            onCreateLiquidation={item => setLiquidationItem(item)}

            isAccountant={isAccountant}
            isLeader={isLeader}
            isTPKT={isTPKT}
            refreshKey={refreshKey}
          />
        )}

        {activeTab === 'inbound' && isLeader && (
          <IncomingTransfersTab projectId={projectId} />
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {showCreateBatch && (
        <CreateSurplusRequestModal
          isOpen={showCreateBatch}
          onClose={() => setShowCreateBatch(false)}
          onSuccess={() => { handleActionSuccess('Đã tạo đề xuất xử lý vật tư thừa.'); setShowCreateBatch(false); }}
          projectId={projectId}
          projectName={projectName}
        />
      )}

      {returnItem && (
        <CreateReturnModal
          isOpen={!!returnItem}
          onClose={() => setReturnItem(null)}
          onSuccess={() => { handleActionSuccess('Đã tạo phiếu trả vật tư thừa cho nhà cung cấp.'); setReturnItem(null); }}
          item={returnItem}
          projectId={projectId}
        />
      )}

      {transferItem && (
        <CreateTransferModal
          isOpen={!!transferItem}
          onClose={() => setTransferItem(null)}
          onSuccess={() => { handleActionSuccess('Đã tạo phiếu điều chuyển vật tư thừa.'); setTransferItem(null); }}
          item={transferItem}
          currentProjectId={projectId}
        />
      )}

      {liquidationItem && (
        <CreateLiquidationModal
          isOpen={!!liquidationItem}
          onClose={() => setLiquidationItem(null)}
          onSuccess={() => { handleActionSuccess('Đã tạo phiếu thanh lý vật tư thừa.'); setLiquidationItem(null); }}
          item={liquidationItem}
        />
      )}

    </div>
  );
};
