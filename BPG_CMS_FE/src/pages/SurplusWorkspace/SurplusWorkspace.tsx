import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui';
import { RefreshCw, PackageX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { projectService } from '../../services/projectService';
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

interface SurplusWorkspaceProps {
  projectId: number;
  projectName: string;
}

export const SurplusWorkspace: React.FC<SurplusWorkspaceProps> = ({
  projectId,
  projectName,
}) => {
  const { user } = useAuth();
  const { connection } = useNotification();
  const [isLeader, setIsLeader] = useState(false);
  
  const isAccountant = user?.role === 'accountant';
  const isTPKT = user?.role === 'technicalmanager' || user?.role === 'admin';

  // isLeader = true nếu user là SiteEngineer VÀ được gán làm trưởng dự án trong bảng ProjectMembers
  useEffect(() => {
    const checkLeaderStatus = async () => {
      if (user?.role === 'siteengineer') {
        try {
          const members = await projectService.getMembers(projectId.toString());
          const me = members.find(m => m.userId === user.id);
          setIsLeader(!!me?.isLeader);
        } catch (err) {
          console.error('Error checking leader status:', err);
          setIsLeader(false);
        }
      } else {
        setIsLeader(false);
      }
    };
    checkLeaderStatus();
  }, [projectId, user]);

  // Quyền tạo đề xuất xử lý vật tư thừa:
  // - Trưởng phòng kỹ thuật (TechnicalManager) hoặc Admin: luôn được tạo
  // - Trưởng dự án (SiteEngineer có isLeader=true trong dự án): được tạo
  // - Nhân viên kỹ thuật thường (SiteEngineer không phải leader): KHÔNG được tạo
  const canCreateSurplusRequest = isTPKT || isLeader;

  const [activeTab, setActiveTab] = useState<'outbound' | 'inbound'>('outbound');
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal states
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [returnItem, setReturnItem] = useState<SurplusRequestItem | null>(null);
  const [transferItem, setTransferItem] = useState<SurplusRequestItem | null>(null);
  const [liquidationItem, setLiquidationItem] = useState<SurplusRequestItem | null>(null);


  const handleRefresh = () => setRefreshKey(k => k + 1);

  // ── Join/Leave SignalR project group khi mở tab Xử lý Vật tư thừa ──
  useEffect(() => {
    if (!connection) return;
    const numericProjectId = Number(projectId);

    connection.invoke('JoinProjectGroup', numericProjectId)
      .catch(err => console.error('SurplusWorkspace: JoinProjectGroup error', err));

    const handleSurplusUpdated = (_payload: any) => {
      handleRefresh();
      toast('Dữ liệu Vật tư thừa đã được cập nhật!', { icon: '🔄' });
    };

    connection.on('SurplusUpdated', handleSurplusUpdated);

    return () => {
      connection.off('SurplusUpdated', handleSurplusUpdated);
      connection.invoke('LeaveProjectGroup', numericProjectId)
        .catch(err => console.error('SurplusWorkspace: LeaveProjectGroup error', err));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, projectId]);

  // ── Giữ lại listener ReceiveNotification cho các user có notification cá nhân ──
  useSignalREvent('ReceiveNotification', (noti: any) => {
    if (noti?.referenceType === 'SurplusRequest') {
      handleRefresh();
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

  const handleActionSuccess = () => {
    toast.success('Thao tác thành công!');
    handleRefresh();
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
            onCreateRequest={() => setShowCreateBatch(true)}
            isLeader={canCreateSurplusRequest}
          />
        )}

        {activeTab === 'outbound' && view === 'detail' && selectedBatchId !== null && (
          <SurplusRequestDetailTab
            surplusRequestId={selectedBatchId}
            onBack={handleBack}
            onRefresh={handleRefresh}
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
          onSuccess={() => { handleActionSuccess(); setShowCreateBatch(false); }}
          projectId={projectId}
          projectName={projectName}
        />
      )}

      {returnItem && (
        <CreateReturnModal
          isOpen={!!returnItem}
          onClose={() => setReturnItem(null)}
          onSuccess={() => { handleActionSuccess(); setReturnItem(null); }}
          item={returnItem}
        />
      )}

      {transferItem && (
        <CreateTransferModal
          isOpen={!!transferItem}
          onClose={() => setTransferItem(null)}
          onSuccess={() => { handleActionSuccess(); setTransferItem(null); }}
          item={transferItem}
          currentProjectId={projectId}
        />
      )}

      {liquidationItem && (
        <CreateLiquidationModal
          isOpen={!!liquidationItem}
          onClose={() => setLiquidationItem(null)}
          onSuccess={() => { handleActionSuccess(); setLiquidationItem(null); }}
          item={liquidationItem}
        />
      )}

    </div>
  );
};
