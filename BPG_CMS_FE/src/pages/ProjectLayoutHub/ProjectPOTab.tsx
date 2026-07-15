import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import type { PurchaseOrderDto } from '../../services/inventoryService';
import { Select, Badge, DataTable, Pagination, Button } from '../../components/ui';
import { ShoppingCart, AlertCircle, Loader2, Lock, Ban } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const CANCELLABLE = ['Draft', 'Sent'];

const PO_STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: '' },
  { label: 'Nháp', value: 'Draft' },
  { label: 'Đã gửi', value: 'Sent' },
  { label: 'Nhận một phần', value: 'PartiallyReceived' },
  { label: 'Nhận đủ', value: 'FullyReceived' },
  { label: 'Đã đóng', value: 'Closed' },
  { label: 'Đã hủy', value: 'Cancelled' },
];

const statusLabel: Record<string, string> = {
  Draft: 'Nháp',
  Sent: 'Đã gửi',
  PartiallyReceived: 'Nhận một phần',
  FullyReceived: 'Nhận đủ',
  Closed: 'Đã đóng',
  Cancelled: 'Đã hủy',
};

const statusVariant: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  Draft: 'default',
  Sent: 'warning',
  PartiallyReceived: 'info',
  FullyReceived: 'success',
  Closed: 'default',
  Cancelled: 'danger',
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

export const ProjectPOTab: React.FC<Props> = ({ projectId, isLeader }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { connection } = useNotification();
  const { user } = useAuth();
  const isAccountant = user?.role === 'accountant';
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [actionModal, setActionModal] = useState<{ type: 'cancel' | 'close'; po: PurchaseOrderDto } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const closeActionModal = () => {
    setActionModal(null);
    setActionReason('');
    setActionError(null);
  };

  const cancelMutation = useMutation({
    mutationFn: () => inventoryService.cancelPurchaseOrder(actionModal!.po.poId, actionReason),
    onSuccess: () => {
      toast.success('Đã hủy đơn mua hàng thành công.');
      closeActionModal();
      queryClient.invalidateQueries({ queryKey: ['project-purchase-orders', projectId] });
    },
    onError: (err: any) => setActionError(err.message || 'Hủy đơn hàng thất bại.'),
  });

  const closeMutation = useMutation({
    mutationFn: () => inventoryService.closePurchaseOrder(actionModal!.po.poId, actionReason),
    onSuccess: () => {
      toast.success('Đã đóng đơn mua hàng. Phần vật tư chưa nhận được trả lại yêu cầu vật tư.');
      closeActionModal();
      queryClient.invalidateQueries({ queryKey: ['project-purchase-orders', projectId] });
    },
    onError: (err: any) => setActionError(err.message || 'Đóng đơn hàng thất bại.'),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project-purchase-orders', projectId, page, statusFilter],
    queryFn: () =>
      inventoryService.getPurchaseOrders({
        projectId,
        status: statusFilter || undefined,
        pageNumber: page,
        pageSize,
      }),
  });

  // Realtime: tự làm mới danh sách khi có PO thay đổi (tạo/hủy/đóng) từ người dùng khác
  useEffect(() => {
    if (!connection) return;

    connection.invoke('JoinProjectGroup', projectId).catch(err => console.error('SignalR JoinProjectGroup error:', err));

    const handlePOUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['project-purchase-orders', projectId] });
    };
    connection.on('PurchaseOrderUpdated', handlePOUpdated);

    return () => {
      connection.off('PurchaseOrderUpdated', handlePOUpdated);
      connection.invoke('LeaveProjectGroup', projectId).catch(err => console.error('SignalR LeaveProjectGroup error:', err));
    };
  }, [connection, projectId, queryClient]);

  const columns = [
    {
      key: 'poNumber',
      header: 'Số đơn hàng',
      render: (po: PurchaseOrderDto) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: 4, background: 'hsl(var(--primary-glow))', borderRadius: 4, border: '1px solid hsl(var(--border))' }}>
            <ShoppingCart size={14} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{po.poNumber}</span>
        </div>
      ),
    },
    {
      key: 'supplierName',
      header: 'Nhà cung cấp',
      render: (po: PurchaseOrderDto) => (
        <span style={{ color: 'hsl(var(--text-secondary))' }}>{po.supplierName || 'N/A'}</span>
      ),
    },
    {
      key: 'orderDate',
      header: 'Ngày đặt',
      render: (po: PurchaseOrderDto) => (
        <span style={{ color: 'hsl(var(--text-secondary))' }}>{formatDate(po.orderDate)}</span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Tổng tiền',
      render: (po: PurchaseOrderDto) => (
        <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
          {formatCurrency(po.totalAmount)}
        </span>
      ),
    },
    {
      key: 'itemCount',
      header: 'Số vật tư',
      render: (po: PurchaseOrderDto) => (
        <span style={{ color: 'hsl(var(--text-muted))' }}>{po.items.length} dòng</span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (po: PurchaseOrderDto) => (
        <Badge variant={statusVariant[po.status] ?? 'default'}>
          {statusLabel[po.status] ?? po.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (po: PurchaseOrderDto) => {
        if (isAccountant) {
          const canClose = po.status === 'PartiallyReceived';
          const canCancel = CANCELLABLE.includes(po.status);
          if (!canClose && !canCancel) return <span style={{ color: 'hsl(var(--text-muted))' }}>—</span>;
          return (
            <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
              {canClose && (
                <button
                  onClick={() => setActionModal({ type: 'close', po })}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Lock size={12} /> Đóng
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => setActionModal({ type: 'cancel', po })}
                  className="btn btn-sm btn-danger"
                  style={{ fontSize: '0.78rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Ban size={12} /> Hủy
                </button>
              )}
            </div>
          );
        }

        const canReceive = isLeader && (po.status === 'Sent' || po.status === 'PartiallyReceived');
        return (
          <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            {canReceive && (
              <button
                onClick={() => {
                  navigate(`/projects/${projectId}?tab=inventory&subTab=receipts&openCreate=receipt&poId=${po.poId}&poNumber=${encodeURIComponent(po.poNumber)}`);
                }}
                className="btn btn-sm btn-primary"
                style={{ fontSize: '0.78rem', padding: '4px 8px' }}
              >
                Nhập kho
              </button>
            )}
          </div>
        );
      }
    },
  ];

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-56 h-10"
          options={PO_STATUS_OPTIONS}
        />
        {data && (
          <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>
            {data.totalCount} đơn mua hàng
          </span>
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
          <span>Không thể tải danh sách đơn mua hàng.</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="flex flex-col gap-4">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            keyExtractor={(po) => po.poId.toString()}
            emptyMessage="Dự án này chưa có đơn mua hàng nào."
            onRowClick={(po) => navigate(`/purchase-orders/${po.poId}`)}
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

      {actionModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => {
          if (!cancelMutation.isPending && !closeMutation.isPending) closeActionModal();
        }}>
          <div style={{
            background: 'hsl(var(--bg-card))', borderRadius: 12,
            border: '1px solid hsl(var(--border))', padding: 28,
            width: 440, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {actionModal.type === 'cancel'
                ? <Ban size={20} style={{ color: 'hsl(var(--danger))' }} />
                : <Lock size={20} style={{ color: 'hsl(var(--primary))' }} />}
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                {actionModal.type === 'cancel' ? 'Xác nhận hủy đơn hàng' : 'Xác nhận đóng đơn hàng'}
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
              {actionModal.type === 'cancel'
                ? <>Hủy đơn mua hàng <strong style={{ color: 'hsl(var(--text-primary))' }}>{actionModal.po.poNumber}</strong>. Thao tác này không thể hoàn tác.</>
                : <>Đóng đơn mua hàng <strong style={{ color: 'hsl(var(--text-primary))' }}>{actionModal.po.poNumber}</strong> đang nhận một phần.
                  Phần vật tư <strong style={{ color: 'hsl(var(--text-primary))' }}>chưa nhận</strong> sẽ được trả lại yêu cầu vật tư,
                  cho phép tạo đơn mua hàng khác cho phần còn thiếu. Thao tác này không thể hoàn tác.</>}
            </p>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: 6 }}>
                {actionModal.type === 'cancel' ? 'Lý do hủy' : 'Lý do đóng đơn hàng'} <span style={{ color: 'hsl(var(--danger))' }}>*</span>
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => { setActionReason(e.target.value); setActionError(null); }}
                placeholder={actionModal.type === 'cancel' ? 'Nhập lý do hủy đơn mua hàng...' : 'Nhập lý do đóng đơn mua hàng...'}
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px', borderRadius: 6, fontSize: 13,
                  border: `1px solid ${actionError ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`,
                  background: 'hsl(var(--bg-input, var(--bg-card)))',
                  color: 'hsl(var(--text-primary))', resize: 'vertical', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              {actionError && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{actionError}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={closeActionModal}
                disabled={cancelMutation.isPending || closeMutation.isPending}>
                Đóng
              </Button>
              <Button
                type="button"
                variant={actionModal.type === 'cancel' ? 'danger' : 'primary'}
                disabled={cancelMutation.isPending || closeMutation.isPending}
                onClick={() => {
                  if (!actionReason.trim()) {
                    setActionError(actionModal.type === 'cancel' ? 'Vui lòng nhập lý do hủy.' : 'Vui lòng nhập lý do đóng đơn hàng.');
                    return;
                  }
                  if (actionModal.type === 'cancel') cancelMutation.mutate();
                  else closeMutation.mutate();
                }}
              >
                {(actionModal.type === 'cancel' ? cancelMutation.isPending : closeMutation.isPending)
                  ? <><Loader2 size={14} className="animate-spin" /> Đang xử lý...</>
                  : actionModal.type === 'cancel'
                    ? <><Ban size={14} /> Xác nhận hủy</>
                    : <><Lock size={14} /> Xác nhận đóng đơn hàng</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
