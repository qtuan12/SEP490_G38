// Force IDE TS Server to re-parse this file
import React, { useState, useEffect } from 'react';
import { inventoryAdjustmentService, type InventoryAdjustmentDto } from '../../../services/inventoryAdjustmentService';
import { formatDateVN } from '../../../utils/inventoryHelpers';
import { Button, Badge, Pagination } from '../../../components/ui';
import { Plus, Minus, CheckCircle, XCircle, Clock, Search } from 'lucide-react';
import { CreateIncreaseAdjustmentModal } from './CreateIncreaseAdjustmentModal';
import { CreateDecreaseAdjustmentModal } from './CreateDecreaseAdjustmentModal';
import { ReviewAdjustmentModal } from './ReviewAdjustmentModal';
import { useNotification } from '../../../context/NotificationContext';
import { useSignalREvent } from '../../../hooks/useSignalREvent';
import { useProjectAccess } from '../../../hooks/useProjectAccess';
import { useRealtimeDataRefresh } from '../../../hooks/useRealtimeDataRefresh';

import toast from 'react-hot-toast';

import {
  REALTIME_DATA_CHANGED_AGGREGATION_MS,
  RealtimeEntities,
} from '../../../constants/realtimeEntities';

const INVENTORY_ADJUSTMENT_REALTIME_ENTITIES = RealtimeEntities.inventory.filter(
  entity => entity === 'InventoryAdjustment' || entity === 'AdjustmentItem',
);

interface AdjustmentListProps {
  projectId: number;
}

export const AdjustmentList: React.FC<AdjustmentListProps> = ({ projectId }) => {
  const { isProjectLeader, canManageAccounting, canApprove, isTechnicalManager, isPaused, isProjectActive } = useProjectAccess(projectId > 0 ? projectId : null);

  const [data, setData] = useState<InventoryAdjustmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const { connection } = useNotification();
  const realtimeRefreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isIncreaseOpen, setIsIncreaseOpen] = useState(false);
  const [isDecreaseOpen, setIsDecreaseOpen] = useState(false);
  const [reviewId, setReviewId] = useState<number | null>(null);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await inventoryAdjustmentService.getAdjustments(projectId, {
        pageNumber: page,
        pageSize,
        adjustmentType: typeFilter || undefined,
        status: statusFilter || undefined,
        searchTerm: searchTerm || undefined
      });
      setData(res.items);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId === null || projectId === undefined || projectId < 0) return;
    const timeout = setTimeout(() => {
      loadData();
    }, 500); // debounce search
    return () => clearTimeout(timeout);
  }, [projectId, page, pageSize, typeFilter, statusFilter, searchTerm]);

  // Tham gia SignalR group của dự án (hoặc group chung Project_0 nếu projectId = 0)
  useEffect(() => {
    if (!connection || projectId === null || projectId === undefined || projectId < 0) return;
    let active = true;

    const joinGroup = () => {
      if (!active || connection.state !== 'Connected') return;
      connection.invoke('JoinProjectGroup', Number(projectId))
        .catch((e) => console.error(`[SignalR] JoinProjectGroup error:`, e));
    };

    if (connection.state === 'Connected') {
      joinGroup();
    }

    connection.onreconnected(joinGroup);

    return () => {
      active = false;
      if (connection.state === 'Connected') {
        connection.invoke('LeaveProjectGroup', Number(projectId)).catch(console.error);
      }
    };
  }, [connection, projectId]);

  const scheduleRealtimeRefresh = () => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadData(false);
    }, REALTIME_DATA_CHANGED_AGGREGATION_MS);
  };

  useEffect(() => () => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
  }, [projectId, page, pageSize, typeFilter, statusFilter, searchTerm]);

  useSignalREvent('InventoryAdjustmentCreated', scheduleRealtimeRefresh);
  useSignalREvent('InventoryAdjustmentUpdated', scheduleRealtimeRefresh);

  // Covers inventory/incident writes that do not emit the legacy named event.
  // loadData only replaces the table rows, so any open review/create modal stays open.
  useRealtimeDataRefresh(
    scheduleRealtimeRefresh,
    INVENTORY_ADJUSTMENT_REALTIME_ENTITIES,
    0,
  );

  const handleSuccess = (msg?: string) => {
    setIsIncreaseOpen(false);
    setIsDecreaseOpen(false);
    setReviewId(null);
    if (msg) {
      toast.success(msg);
    }
    scheduleRealtimeRefresh();
  };

  const handleError = (msg: string) => {
    toast.error(msg);
  };

  const getStatusBadge = (status: string, adjustmentType?: string) => {
    const isIncrease = adjustmentType?.toLowerCase() === 'increase';
    switch (status) {
      case 'Pending':
        return (
          <Badge variant="warning">
            <Clock size={12} className="mr-1" />
            {isIncrease ? 'Chờ phê duyệt' : 'Chờ Giám đốc duyệt'}
          </Badge>
        );
      case 'Approved': return <Badge variant="success"><CheckCircle size={12} className="mr-1" /> Đã duyệt</Badge>;
      case 'Rejected': return <Badge variant="danger"><XCircle size={12} className="mr-1" /> Từ chối</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const isIncrease = type?.toLowerCase() === 'increase';
    const isDecrease = type?.toLowerCase() === 'decrease';
    if (isIncrease) return <span className="text-[hsl(var(--success))] font-medium">Tăng</span>;
    if (isDecrease) return <span className="text-[hsl(var(--danger))] font-medium">Giảm</span>;
    return <span>{type}</span>;
  };

  const canCreateIncrease =
    projectId > 0 &&
    isProjectLeader &&
    isProjectActive;
  const canCreateDecrease =
    projectId > 0 &&
    canManageAccounting;

  return (
    <div className="bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-[hsl(var(--border))] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col md:flex-row gap-2 w-full lg:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" size={16} />
            <input
              type="text"
              placeholder="Tìm theo mã, lý do..."
              className="pl-9 pr-3 py-1.5 border border-[hsl(var(--border))] rounded-lg text-sm bg-transparent w-full min-w-[200px]"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="px-3 py-1.5 border border-[hsl(var(--border))] rounded-lg text-sm bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]"
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="" className="bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]">Tất cả loại</option>
            <option value="Increase" className="bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]">Tăng tồn kho</option>
            <option value="Decrease" className="bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]">Giảm tồn kho</option>
          </select>

          <select
            className="px-3 py-1.5 border border-[hsl(var(--border))] rounded-lg text-sm bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="" className="bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]">Tất cả trạng thái</option>
            <option value="Pending" className="bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]">Chờ duyệt</option>
            <option value="Approved" className="bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]">Đã duyệt</option>
            <option value="Rejected" className="bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]">Từ chối</option>
          </select>
        </div>

        <div className="flex gap-2">
          {canCreateDecrease && (
            <Button variant="danger" className="flex items-center gap-1.5 text-sm" onClick={() => setIsDecreaseOpen(true)}>
              <Minus size={16} /> Phiếu Giảm (Giai đoạn)
            </Button>
          )}
          {canCreateIncrease && (
            <Button variant="primary" className="flex items-center gap-1.5 text-sm" onClick={() => setIsIncreaseOpen(true)}>
              <Plus size={16} /> Phiếu Tăng
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={`w-full text-sm text-left ${loading ? 'opacity-50' : ''}`}>
          <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--border))]">
            <tr>
              <th className="px-4 py-3 font-medium">Mã Phiếu</th>
              {projectId === 0 && <th className="px-4 py-3 font-medium">Dự án</th>}
              <th className="px-4 py-3 font-medium">Loại</th>
              <th className="px-4 py-3 font-medium">Lý do</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Ngày tạo</th>
              <th className="px-4 py-3 font-medium">Người duyệt</th>
              <th className="px-4 py-3 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {data.length === 0 ? (
              <tr>
                <td colSpan={projectId === 0 ? 8 : 7} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">
                  Không có dữ liệu phiếu kiểm kê
                </td>
              </tr>
            ) : (
              data.map(item => {
                const isIncreaseItem = item.adjustmentType?.toLowerCase() === 'increase';
                const canUserReview = (isIncreaseItem ? isTechnicalManager : canApprove) && !isPaused;
                return (
                  <tr key={item.adjustmentId} className="hover:bg-[hsl(var(--bg-main))]/50 transition-colors">
                    <td className="px-4 py-3 font-medium">ADJ-{item.adjustmentId.toString().padStart(5, '0')}</td>
                    {projectId === 0 && <td className="px-4 py-3 text-[hsl(var(--primary))] font-semibold truncate max-w-[150px]" title={item.projectName}>{item.projectName || `Dự án #${item.projectId}`}</td>}
                    <td className="px-4 py-3">{getTypeBadge(item.adjustmentType)}</td>
                    <td className="px-4 py-3 max-w-xs truncate" title={item.reason}>{item.reason}</td>
                    <td className="px-4 py-3">{getStatusBadge(item.status, item.adjustmentType)}</td>
                    <td className="px-4 py-3">{formatDateVN(item.createdAt)}</td>
                    <td className="px-4 py-3">{item.approverName || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setReviewId(item.adjustmentId)}>
                        {item.status === 'Pending' && canUserReview ? 'Duyệt' : 'Xem chi tiết'}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-[hsl(var(--border))]">
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(totalCount / pageSize)}
          onPageChange={setPage}
        />
      </div>

      {isIncreaseOpen && (
        <CreateIncreaseAdjustmentModal
          isOpen={isIncreaseOpen}
          onClose={() => setIsIncreaseOpen(false)}
          onSuccess={(message) => handleSuccess(message || 'Đã tạo phiếu tăng tồn. Phiếu đang chờ Trưởng phòng kỹ thuật phê duyệt.')}
          onError={handleError}
          projectId={projectId}
        />
      )}

      {isDecreaseOpen && (
        <CreateDecreaseAdjustmentModal
          isOpen={isDecreaseOpen}
          onClose={() => setIsDecreaseOpen(false)}
          onSuccess={(message) => handleSuccess(message || 'Đã tạo phiếu giảm tồn. Phiếu đang chờ Giám đốc phê duyệt.')}
          onError={handleError}
          projectId={projectId}
        />
      )}

      {reviewId !== null && (
        <ReviewAdjustmentModal
          isOpen={reviewId !== null}
          onClose={() => setReviewId(null)}
          onSuccess={(approved, message) => handleSuccess(message || (approved ? 'Đã duyệt phiếu điều chỉnh tồn. Tồn kho đã được cập nhật.' : 'Đã từ chối phiếu điều chỉnh tồn.'))}
          onError={handleError}
          adjustmentId={reviewId}
          adjustmentData={data.find(x => x.adjustmentId === reviewId)}
        />
      )}
    </div>
  );
};
