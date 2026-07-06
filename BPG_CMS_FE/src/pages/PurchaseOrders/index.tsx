import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import type { PurchaseOrderDto } from '../../services/inventoryService';
import { Input, Select, Badge, DataTable, Pagination, Button } from '../../components/ui';
import { Search, ShoppingCart, AlertCircle, Loader2, Plus } from 'lucide-react';

const PO_STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: '' },
  { label: 'Nháp', value: 'Draft' },
  { label: 'Đã gửi NCC', value: 'Sent' },
  { label: 'Nhập kho một phần', value: 'PartiallyReceived' },
  { label: 'Đã nhập đủ', value: 'FullyReceived' },
  { label: 'Đã đóng', value: 'Closed' },
];

const statusLabel: Record<string, string> = {
  Draft: 'Nháp',
  Sent: 'Đã gửi NCC',
  PartiallyReceived: 'Nhập kho một phần',
  FullyReceived: 'Đã nhập đủ',
  Closed: 'Đã đóng',
};

const statusVariant: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  Draft: 'default',
  Sent: 'warning',
  PartiallyReceived: 'info',
  FullyReceived: 'success',
  Closed: 'default',
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

export const PurchaseOrderList: React.FC = () => {
  const navigate = useNavigate();
  const [searchPO, setSearchPO] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const handleSearch = useCallback((val: string) => {
    setSearchPO(val);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(1);
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['purchase-orders', page, searchPO, statusFilter],
    queryFn: () =>
      inventoryService.getPurchaseOrders({
        poNumber: searchPO || undefined,
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
        <span style={{ color: 'hsl(var(--text-secondary))' }}>{po.supplierName}</span>
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
    <div className="flex flex-col gap-6 animate-fade-in">
      {isError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)',
          borderRadius: 4, padding: '12px 16px', color: 'hsl(346 84% 35%)', fontSize: 14,
        }}>
          <AlertCircle size={16} style={{ color: 'hsl(var(--danger))', flexShrink: 0 }} />
          <span>{(error as any)?.message || 'Không thể tải danh sách đơn mua hàng.'}</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="glass-panel p-5 sm:px-6 flex items-center flex-wrap gap-3 justify-between">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <Input
            type="text"
            placeholder="Tìm theo số PO..."
            value={searchPO}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-56 h-10"
          options={PO_STATUS_OPTIONS}
        />
        {data && (
          <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>
            {data.totalCount} đơn mua hàng
          </span>
        )}
        <Button variant="primary" onClick={() => navigate('/purchase-orders/new')} className="h-10 font-semibold shrink-0">
          <Plus size={18} />
          <span>Tạo PO</span>
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 250, gap: 10 }}>
          <Loader2 className="animate-spin" size={24} style={{ color: 'hsl(var(--primary))' }} />
          <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>Đang tải danh sách PO...</span>
        </div>
      ) : (
        <div className="animate-fade-in flex flex-col gap-4">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            keyExtractor={(po) => po.poId.toString()}
            emptyMessage="Không tìm thấy đơn mua hàng nào phù hợp."
            onRowClick={(po) => navigate(`/purchase-orders/${po.poId}`)}
          />
          {data && data.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
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
