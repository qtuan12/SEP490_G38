import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { directPurchaseService } from '../../services/directPurchaseService';
import type { DirectPurchaseRequestDto } from '../../services/directPurchaseService';
import { Select, Badge } from '../../components/ui';
import { DataTable } from '../../components/ui/DataTable';
import { ShoppingBag, AlertCircle, Loader2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: '' },
  { label: 'Nháp', value: 'Draft' },
  { label: 'Đã duyệt', value: 'Approved' },
  { label: 'Từ chối', value: 'Rejected' },
];

const AUDIT_STATUS_OPTIONS = [
  { label: 'Tất cả kiểm toán', value: '' },
  { label: 'Chờ kiểm toán', value: 'PendingAudit' },
  { label: 'Đã kiểm toán', value: 'Audited' },
  { label: 'Từ chối KT', value: 'Rejected' },
];

const statusLabel: Record<string, string> = {
  Draft: 'Nháp',
  Approved: 'Đã duyệt',
  Rejected: 'Từ chối',
};

const statusVariant: Record<string, 'default' | 'success' | 'danger'> = {
  Draft: 'default',
  Approved: 'success',
  Rejected: 'danger',
};

const auditLabel: Record<string, string> = {
  PendingAudit: 'Chờ kiểm toán',
  Audited: 'Đã kiểm toán',
  Rejected: 'Từ chối',
};

const auditVariant: Record<string, 'warning' | 'info' | 'danger'> = {
  PendingAudit: 'warning',
  Audited: 'info',
  Rejected: 'danger',
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const DirectPurchaseList: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [auditFilter, setAuditFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['direct-purchases', page, statusFilter, auditFilter],
    queryFn: () =>
      directPurchaseService.getList({
        pageNumber: page,
        pageSize,
        status: statusFilter || undefined,
        auditStatus: auditFilter || undefined,
      }),
  });

  const columns = [
    {
      key: 'requestNumber',
      header: 'Mã yêu cầu',
      width: '120px',
      render: (item: DirectPurchaseRequestDto) => (
        <span className="font-mono text-xs font-semibold text-blue-600">{item.requestNumber}</span>
      ),
    },
    {
      key: 'projectName',
      header: 'Dự án',
      width: '160px',
      render: (item: DirectPurchaseRequestDto) => (
        <span className="text-sm">{item.projectName}</span>
      ),
    },
    {
      key: 'phaseName',
      header: 'Giai đoạn',
      width: '140px',
      render: (item: DirectPurchaseRequestDto) => (
        <span className="text-sm text-gray-600">{item.phaseName}</span>
      ),
    },
    {
      key: 'requesterName',
      header: 'Người yêu cầu',
      width: '140px',
      render: (item: DirectPurchaseRequestDto) => (
        <span className="text-sm">{item.requesterName}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Lý do',
      width: '200px',
      render: (item: DirectPurchaseRequestDto) => (
        <span title={item.reason} className="block max-w-[200px] truncate text-sm text-gray-700">
          {item.reason}
        </span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Tổng tiền',
      width: '130px',
      render: (item: DirectPurchaseRequestDto) => (
        <span className="font-medium text-sm">{formatCurrency(item.totalAmount)}</span>
      ),
    },
    {
      key: 'purchaseDate',
      header: 'Ngày mua',
      width: '100px',
      render: (item: DirectPurchaseRequestDto) => (
        <span className="text-sm">{formatDate(item.purchaseDate)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      render: (item: DirectPurchaseRequestDto) => (
        <Badge variant={statusVariant[item.status] ?? 'default'}>
          {statusLabel[item.status] ?? item.status}
        </Badge>
      ),
    },
    {
      key: 'auditStatus',
      header: 'Kiểm toán',
      width: '120px',
      render: (item: DirectPurchaseRequestDto) => (
        <Badge variant={auditVariant[item.auditStatus] ?? 'default'}>
          {auditLabel[item.auditStatus] ?? item.auditStatus}
        </Badge>
      ),
    },
    {
      key: 'itemCount',
      header: 'Số VT',
      width: '70px',
      render: (item: DirectPurchaseRequestDto) => (
        <span className="text-center block text-sm">{item.itemCount}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-50">
          <ShoppingBag size={22} className="text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Yêu cầu mua khẩn cấp</h1>
          <p className="text-sm text-gray-500">Danh sách các yêu cầu mua trực tiếp ngoài quy trình PO</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          options={STATUS_OPTIONS}
        />
        <Select
          value={auditFilter}
          onChange={(e) => { setAuditFilter(e.target.value); setPage(1); }}
          options={AUDIT_STATUS_OPTIONS}
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span>Đang tải...</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 text-red-600">
          <AlertCircle size={18} />
          <span>Không thể tải danh sách yêu cầu.</span>
        </div>
      )}

      {!isLoading && !isError && data && (
        <DataTable
          columns={columns}
          data={data.items}
          keyExtractor={(item) => item.directPurchaseId}
          emptyMessage="Chưa có yêu cầu mua khẩn cấp nào."
          currentPage={page}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};
