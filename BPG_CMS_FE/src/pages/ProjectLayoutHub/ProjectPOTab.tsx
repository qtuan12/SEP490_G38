import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import type { PurchaseOrderDto } from '../../services/inventoryService';
import { Select, Badge, DataTable, Pagination } from '../../components/ui';
import { ShoppingCart, AlertCircle, Loader2 } from 'lucide-react';

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

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

interface Props {
  projectId: number;
}

export const ProjectPOTab: React.FC<Props> = ({ projectId }) => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

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

  const columns = [
    {
      key: 'poNumber',
      header: 'Số PO',
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
    </div>
  );
};
