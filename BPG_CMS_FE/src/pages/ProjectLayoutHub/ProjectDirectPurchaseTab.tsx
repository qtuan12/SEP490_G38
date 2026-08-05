import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  directPurchaseService,
  DP_STATUS,
  DP_STATUS_LABEL,
  DP_BOQ_CHECK,
} from '../../services/directPurchaseService';
import { Badge, Pagination, Button, TableLoader } from '../../components/ui';
import { AlertCircle, Plus, Search, ChevronDown, AlertTriangle } from 'lucide-react';
import { CreateDirectPurchaseModal } from './CreateDirectPurchaseModal';
import { DirectPurchaseDetailModal } from './DirectPurchaseDetailModal';
import { useNotification } from '../../context/NotificationContext';
import { useProjectAccess } from '../../hooks/useProjectAccess';

const STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: '' },
  { label: 'Nháp', value: DP_STATUS.Draft },
  { label: 'Chờ Kế toán', value: DP_STATUS.Pending },
  { label: 'Chờ Giám đốc', value: DP_STATUS.WaitingApproval },
  { label: 'Đã duyệt', value: DP_STATUS.Approved },
  { label: 'Từ chối', value: DP_STATUS.Rejected },
];

const statusVariant: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  Draft: 'default',
  Pending: 'warning',
  WaitingApproval: 'warning',
  Approved: 'success',
  Rejected: 'danger',
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

interface Props {
  projectId: number;
}

export const ProjectDirectPurchaseTab: React.FC<Props> = ({ projectId }) => {
  const queryClient = useQueryClient();
  const { canManageTechnical, canManageAccounting, canApprove } = useProjectAccess(projectId);
  const { connection } = useNotification();
  const isAccountant = canManageAccounting;
  // Technical Manager hoặc Trưởng dự án của chính dự án này - khớp với DirectPurchaseGuard ở backend.
  // Dùng canManageTechnical (= TM || isLeader) chứ không phải canManageExecution, vì cái sau còn
  // gồm mọi Site Engineer, kể cả người không phải Trưởng dự án - sẽ thấy nút rồi bị backend chặn.
  const canCreate = canManageTechnical;
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const pageSize = 10;

  const closeEditor = () => { setIsCreateOpen(false); setEditingDraftId(null); };

  // Deep-link từ thông báo: /projects/{id}?tab=directpurchases&directPurchaseId=123
  // Mở thẳng chi tiết phiếu; đóng lại thì gỡ tham số để lộ ra danh sách của chính dự án này.
  useEffect(() => {
    const deepLinkId = searchParams.get('directPurchaseId');
    if (deepLinkId) setDetailId(Number(deepLinkId));
  }, [searchParams]);

  const closeDetail = () => {
    setDetailId(null);
    if (searchParams.has('directPurchaseId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('directPurchaseId');
      setSearchParams(next, { replace: true });
    }
  };

  const refetchList = () => queryClient.invalidateQueries({ queryKey: ['project-direct-purchases', projectId] });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setPage(1);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project-direct-purchases', projectId, page, statusFilter, debouncedSearchTerm],
    queryFn: () =>
      directPurchaseService.getList({
        projectId,
        status: statusFilter || undefined,
        searchTerm: debouncedSearchTerm || undefined,
        pageNumber: page,
        pageSize,
      }),
  });

  const items = data?.items ?? [];

  // Realtime: tự làm mới danh sách khi có phiếu mua khẩn cấp thay đổi (tạo/kiểm toán) từ người dùng khác
  useEffect(() => {
    if (!connection) return;

    connection.invoke('JoinProjectGroup', projectId).catch(err => console.error('SignalR JoinProjectGroup error:', err));

    const handleDPUpdated = () => {
      refetchList();
    };
    connection.on('DirectPurchaseUpdated', handleDPUpdated);

    return () => {
      connection.off('DirectPurchaseUpdated', handleDPUpdated);
      connection.invoke('LeaveProjectGroup', projectId).catch(err => console.error('SignalR LeaveProjectGroup error:', err));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, projectId]);

  return (
    <div className="bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {isError && (
        <div className="m-4 mb-0 animate-fade-in py-2.5 px-3.5 flex items-center gap-2 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm text-[hsl(346_84%_35%)] text-[0.85rem]">
          <AlertCircle size={16} className="flex-shrink-0" />
          Không thể tải danh sách phiếu mua khẩn cấp.
        </div>
      )}

      <div className="p-4 border-b border-[hsl(var(--border))] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="Tìm theo số phiếu, lý do..."
              className="py-2 pl-9 pr-3 border border-[hsl(var(--border))] rounded-lg text-sm bg-transparent w-full sm:w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-full sm:w-auto">
            <select
              className="appearance-none pl-3 pr-9 py-2 border border-[hsl(var(--border))] rounded-lg text-sm bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))] w-full sm:w-48"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] pointer-events-none" size={14} />
          </div>
        </div>

        {canCreate && (
          <Button variant="primary" className="flex items-center gap-1.5 text-sm w-full lg:w-auto justify-center" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} /> Tạo phiếu mua khẩn cấp
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className={`w-full min-w-[920px] table-fixed text-sm text-left ${isLoading ? 'opacity-50' : ''}`}>
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--border))]">
            <tr>
              <th className="px-4 py-3 font-medium">Số phiếu</th>
              <th className="px-4 py-3 font-medium">Giai đoạn</th>
              <th className="px-4 py-3 font-medium">Ngày mua</th>
              <th className="px-4 py-3 font-medium">Người tạo</th>
              <th className="px-4 py-3 font-medium text-right">Tổng tiền</th>
              <th className="px-4 py-3 font-medium text-center">Vật tư</th>
              <th className="px-4 py-3 font-medium text-center">Trạng thái</th>
              <th className="px-4 py-3 font-medium text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {isLoading ? (
              <TableLoader colSpan={8} message="Đang tải danh sách mua trực tiếp..." />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">
                  Dự án này chưa có phiếu mua khẩn cấp nào.
                </td>
              </tr>
            ) : (
              items.map(dp => (
                <tr
                  key={dp.directPurchaseId}
                  className="hover:bg-[hsl(var(--bg-main))]/50 transition-colors cursor-pointer"
                  onClick={() => setDetailId(dp.directPurchaseId)}
                >
                  <td className="px-4 py-3 font-medium truncate" title={dp.requestNumber}>
                    <span className="flex items-center gap-1.5">
                      {dp.requestNumber}
                      {dp.boqCheckStatus === DP_BOQ_CHECK.OverBOQ && (
                        <AlertTriangle size={13} className="text-[hsl(var(--warning))] flex-shrink-0" aria-label="Vượt định mức BOQ" />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--text-secondary))] truncate" title={dp.phaseName}>{dp.phaseName}</td>
                  <td className="px-4 py-3 text-[hsl(var(--text-secondary))] whitespace-nowrap">{formatDate(dp.purchaseDate)}</td>
                  <td className="px-4 py-3 text-[hsl(var(--text-secondary))] truncate" title={dp.requesterName}>{dp.requesterName}</td>
                  <td className="px-4 py-3 font-semibold text-right whitespace-nowrap">{formatCurrency(dp.totalAmount)}</td>
                  <td className="px-4 py-3 text-[hsl(var(--text-muted))] text-center whitespace-nowrap">{dp.itemCount} dòng</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={statusVariant[dp.status] ?? 'default'}>
                      {DP_STATUS_LABEL[dp.status] ?? dp.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDetailId(dp.directPurchaseId); }}
                      className="text-[hsl(var(--primary))] font-semibold text-sm hover:underline"
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="p-4 border-t border-[hsl(var(--border))]">
          <Pagination
            currentPage={page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <CreateDirectPurchaseModal
        key={editingDraftId ?? 'new'}
        isOpen={isCreateOpen || editingDraftId !== null}
        onClose={closeEditor}
        onSuccess={refetchList}
        projectId={projectId}
        draftId={editingDraftId}
      />

      <DirectPurchaseDetailModal
        isOpen={detailId !== null}
        onClose={closeDetail}
        onAudited={refetchList}
        directPurchaseId={detailId}
        canAudit={isAccountant}
        canApproveSpending={canApprove}
        canCreateDraft={canCreate}
        onEditDraft={(id) => setEditingDraftId(id)}
      />
    </div>
  );
};
