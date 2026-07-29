import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { directPurchaseService } from '../../services/directPurchaseService';
import { Badge, Pagination, Button } from '../../components/ui';
import { AlertCircle, Loader2, Plus, Search, ChevronDown } from 'lucide-react';
import { CreateDirectPurchaseModal } from './CreateDirectPurchaseModal';
import { DirectPurchaseDetailModal } from './DirectPurchaseDetailModal';
import { useNotification } from '../../context/NotificationContext';
import { useProjectAccess } from '../../hooks/useProjectAccess';
import { ProjectPermission } from '../../auth/permissions';

const AUDIT_OPTIONS = [
  { label: 'Tất cả', value: '' },
  { label: 'Chờ kiểm toán', value: 'PendingAudit' },
  { label: 'Đã kiểm toán', value: 'Audited' },
  { label: 'Từ chối kiểm toán', value: 'Rejected' },
];

const auditLabel: Record<string, string> = {
  PendingAudit: 'Chờ kiểm toán',
  Audited: 'Đã kiểm toán',
  Rejected: 'Từ chối',
};

const auditVariant: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  PendingAudit: 'warning',
  Audited: 'success',
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
  const { hasProjectPermission } = useProjectAccess(projectId);
  const { connection } = useNotification();
  const isAccountant = hasProjectPermission(ProjectPermission.AccountingManage);
  const canCreate = hasProjectPermission(ProjectPermission.ExecutionManage);
  const [auditFilter, setAuditFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const pageSize = 10;

  const refetchList = () => queryClient.invalidateQueries({ queryKey: ['project-direct-purchases', projectId] });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setPage(1);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project-direct-purchases', projectId, page, auditFilter, debouncedSearchTerm],
    queryFn: () =>
      directPurchaseService.getList({
        projectId,
        auditStatus: auditFilter || undefined,
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
              className="appearance-none pl-3 pr-9 py-2 border border-[hsl(var(--border))] rounded-lg text-sm bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))] w-full sm:w-52"
              value={auditFilter}
              onChange={e => { setAuditFilter(e.target.value); setPage(1); }}
            >
              {AUDIT_OPTIONS.map(opt => (
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
        <table className={`w-full min-w-[900px] table-fixed text-sm text-left ${isLoading ? 'opacity-50' : ''}`}>
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[9%]" />
            <col className="w-[15%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--border))]">
            <tr>
              <th className="px-4 py-3 font-medium">Số phiếu</th>
              <th className="px-4 py-3 font-medium">Giai đoạn</th>
              <th className="px-4 py-3 font-medium">Ngày mua</th>
              <th className="px-4 py-3 font-medium">Người tạo</th>
              <th className="px-4 py-3 font-medium text-right">Tổng tiền</th>
              <th className="px-4 py-3 font-medium text-center">Vật tư</th>
              <th className="px-4 py-3 font-medium text-center">Trạng thái kiểm toán</th>
              <th className="px-4 py-3 font-medium text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    Đang tải...
                  </div>
                </td>
              </tr>
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
                  <td className="px-4 py-3 font-medium truncate" title={dp.requestNumber}>{dp.requestNumber}</td>
                  <td className="px-4 py-3 text-[hsl(var(--text-secondary))] truncate" title={dp.phaseName}>{dp.phaseName}</td>
                  <td className="px-4 py-3 text-[hsl(var(--text-secondary))] whitespace-nowrap">{formatDate(dp.purchaseDate)}</td>
                  <td className="px-4 py-3 text-[hsl(var(--text-secondary))] truncate" title={dp.requesterName}>{dp.requesterName}</td>
                  <td className="px-4 py-3 font-semibold text-right whitespace-nowrap">{formatCurrency(dp.totalAmount)}</td>
                  <td className="px-4 py-3 text-[hsl(var(--text-muted))] text-center whitespace-nowrap">{dp.itemCount} dòng</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={auditVariant[dp.auditStatus] ?? 'default'}>
                      {auditLabel[dp.auditStatus] ?? dp.auditStatus}
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

      {data && data.totalPages > 1 && (
        <div className="p-4 border-t border-[hsl(var(--border))]">
          <Pagination
            currentPage={page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <CreateDirectPurchaseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={refetchList}
        projectId={projectId}
      />

      <DirectPurchaseDetailModal
        isOpen={detailId !== null}
        onClose={() => setDetailId(null)}
        onAudited={refetchList}
        directPurchaseId={detailId}
        canAudit={isAccountant}
      />
    </div>
  );
};
