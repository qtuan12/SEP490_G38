import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { directPurchaseService } from '../../services/directPurchaseService';
import type { DirectPurchaseRequestDto } from '../../services/directPurchaseService';
import { Select, Badge, DataTable, Pagination } from '../../components/ui';
import { Button } from '../../components/ui';
import { ShoppingBag, AlertCircle, Loader2, Plus } from 'lucide-react';
import { CreateDirectPurchaseModal } from './CreateDirectPurchaseModal';
import { DirectPurchaseDetailModal } from './DirectPurchaseDetailModal';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

const STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: '' },
  { label: 'Đã duyệt', value: 'Approved' },
  { label: 'Từ chối', value: 'Rejected' },
];

const AUDIT_OPTIONS = [
  { label: 'Tất cả kiểm toán', value: '' },
  { label: 'Chờ kiểm toán', value: 'PendingAudit' },
  { label: 'Đã kiểm toán', value: 'Audited' },
  { label: 'Từ chối kiểm toán', value: 'Rejected' },
];

const statusLabel: Record<string, string> = {
  Draft: 'Nháp',
  Approved: 'Đã duyệt',
  Rejected: 'Từ chối',
};

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
  isLeader: boolean;
}

export const ProjectDirectPurchaseTab: React.FC<Props> = ({ projectId, isLeader }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { connection } = useNotification();
  const isAccountant = user?.role === 'accountant';
  const [statusFilter, setStatusFilter] = useState('');
  const [auditFilter, setAuditFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const pageSize = 10;

  const refetchList = () => queryClient.invalidateQueries({ queryKey: ['project-direct-purchases', projectId] });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project-direct-purchases', projectId, page, statusFilter, auditFilter],
    queryFn: () =>
      directPurchaseService.getList({
        projectId,
        status: statusFilter || undefined,
        auditStatus: auditFilter || undefined,
        pageNumber: page,
        pageSize,
      }),
  });

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

  const columns = [
    {
      key: 'requestNumber',
      header: 'Số phiếu',
      render: (dp: DirectPurchaseRequestDto) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: 4, background: 'hsl(var(--primary-glow))', borderRadius: 4, border: '1px solid hsl(var(--border))' }}>
            <ShoppingBag size={14} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <span style={{ fontWeight: 600 }}>{dp.requestNumber}</span>
        </div>
      ),
    },
    {
      key: 'phaseName',
      header: 'Giai đoạn',
      render: (dp: DirectPurchaseRequestDto) => (
        <span style={{ color: 'hsl(var(--text-secondary))' }}>{dp.phaseName}</span>
      ),
    },
    {
      key: 'purchaseDate',
      header: 'Ngày mua',
      render: (dp: DirectPurchaseRequestDto) => (
        <span style={{ color: 'hsl(var(--text-secondary))' }}>{formatDate(dp.purchaseDate)}</span>
      ),
    },
    {
      key: 'requesterName',
      header: 'Người tạo',
      render: (dp: DirectPurchaseRequestDto) => (
        <span style={{ color: 'hsl(var(--text-secondary))' }}>{dp.requesterName}</span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Tổng tiền',
      render: (dp: DirectPurchaseRequestDto) => (
        <span style={{ fontWeight: 600 }}>{formatCurrency(dp.totalAmount)}</span>
      ),
    },
    {
      key: 'itemCount',
      header: 'Vật tư',
      render: (dp: DirectPurchaseRequestDto) => (
        <span style={{ color: 'hsl(var(--text-muted))' }}>{dp.itemCount} dòng</span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (dp: DirectPurchaseRequestDto) => (
        <Badge variant={dp.status === 'Rejected' ? 'danger' : 'success'}>
          {statusLabel[dp.status] ?? dp.status}
        </Badge>
      ),
    },
    {
      key: 'auditStatus',
      header: 'Kiểm toán',
      render: (dp: DirectPurchaseRequestDto) => (
        <Badge variant={auditVariant[dp.auditStatus] ?? 'default'}>
          {auditLabel[dp.auditStatus] ?? dp.auditStatus}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px',
          padding: '14px 16px', borderRadius: 10,
          border: '1px solid hsl(var(--border))', background: 'hsl(var(--bg-card))',
        }}
      >
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Trạng thái</label>
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-48 h-10"
              options={STATUS_OPTIONS}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Kiểm toán</label>
            <Select
              value={auditFilter}
              onChange={(e) => { setAuditFilter(e.target.value); setPage(1); }}
              className="w-48 h-10"
              options={AUDIT_OPTIONS}
            />
          </div>
          {data && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px',
                borderRadius: 999, background: 'hsl(var(--primary-glow))',
                fontSize: 13, fontWeight: 600, color: 'hsl(var(--primary))',
              }}
            >
              <ShoppingBag size={14} />
              {data.totalCount} phiếu
            </span>
          )}
        </div>
        {isLeader && (
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: 40 }}
          >
            <Plus size={16} />
            Tạo phiếu mua khẩn cấp
          </Button>
        )}
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, gap: 10 }}>
          <Loader2 className="animate-spin" size={22} style={{ color: 'hsl(var(--primary))' }} />
          <span style={{ color: 'hsl(var(--text-secondary))' }}>Đang tải...</span>
        </div>
      )}

      {isError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)', borderRadius: 4, padding: '12px 16px', color: 'hsl(346 84% 35%)', fontSize: 14 }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>Không thể tải danh sách phiếu mua khẩn cấp.</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="flex flex-col gap-4">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            keyExtractor={(dp) => dp.directPurchaseId.toString()}
            emptyMessage="Dự án này chưa có phiếu mua khẩn cấp nào."
            onRowClick={(dp) => setDetailId(dp.directPurchaseId)}
          />
          {data && data.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Pagination
                currentPage={page}
                totalPages={data.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
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
