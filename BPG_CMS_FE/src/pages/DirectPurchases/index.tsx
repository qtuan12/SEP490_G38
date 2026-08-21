import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { directPurchaseService, DP_STATUS_LABEL } from '../../services/directPurchaseService';
import type { DirectPurchaseRequestDto } from '../../services/directPurchaseService';
import { Select, Badge, LoadingSpinner } from '../../components/ui';
import { DataTable } from '../../components/ui/DataTable';
import { DirectPurchaseDetailModal } from '../ProjectLayoutHub/DirectPurchaseDetailModal';
import { useAuth } from '../../context/AuthContext';
import { RoleGroup } from '../../auth/roles';
import { ShoppingBag, AlertCircle } from 'lucide-react';
import { formatPlainDate } from '../../utils/dateHelpers';

const STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: '' },
  { label: 'Nháp', value: 'Draft' },
  { label: 'Chờ Kế toán', value: 'Pending' },
  { label: 'Chờ Giám đốc', value: 'WaitingApproval' },
  { label: 'Đã duyệt', value: 'Approved' },
  { label: 'Từ chối', value: 'Rejected' },
];

const BOQ_CHECK_OPTIONS = [
  { label: 'Tất cả định mức', value: '' },
  { label: 'Trong định mức', value: 'WithinBOQ' },
  { label: 'Vượt định mức', value: 'OverBOQ' },
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


export const DirectPurchaseList: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasAnyRole } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [boqFilter, setBoqFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const pageSize = 10;

  // Trang này là nơi thông báo dẫn tới, nên Kế toán và Giám đốc phải thao tác được ngay tại đây.
  const canAudit = hasAnyRole(RoleGroup.Accounting);
  const canApproveSpending = hasAnyRole(RoleGroup.Approval);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['direct-purchases', page, statusFilter, boqFilter],
    queryFn: () =>
      directPurchaseService.getList({
        pageNumber: page,
        pageSize,
        status: statusFilter || undefined,
        boqCheckStatus: boqFilter || undefined,
      }),
  });

  const columns = [
    {
      key: 'stt',
      header: 'STT',
      render: (_item: any, index: number) => (
        <span className="text-[hsl(var(--text-muted))] text-sm font-medium tabular-nums">
          {(page - 1) * pageSize + index + 1}
        </span>
      ),
    },
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
        <span className="text-sm">{formatPlainDate(item.purchaseDate)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '130px',
      render: (item: DirectPurchaseRequestDto) => (
        <Badge variant={statusVariant[item.status] ?? 'default'}>
          {DP_STATUS_LABEL[item.status] ?? item.status}
        </Badge>
      ),
    },
    {
      key: 'itemCount',
      header: 'Vật tư',
      width: '90px',
      render: (item: DirectPurchaseRequestDto) => (
        <span className="text-center block text-sm">{item.itemCount} loại</span>
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
          value={boqFilter}
          onChange={(e) => { setBoqFilter(e.target.value); setPage(1); }}
          options={BOQ_CHECK_OPTIONS}
        />
      </div>

      {isLoading && (
        <LoadingSpinner size="md" label="Đang tải..." className="py-16" />
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
          onRowClick={(item) => setDetailId(item.directPurchaseId)}
        />
      )}

      <DirectPurchaseDetailModal
        isOpen={detailId !== null}
        onClose={() => setDetailId(null)}
        onAudited={() => queryClient.invalidateQueries({ queryKey: ['direct-purchases'] })}
        directPurchaseId={detailId}
        canAudit={canAudit}
        canApproveSpending={canApproveSpending}
      />
    </div>
  );
};
