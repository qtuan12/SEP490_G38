import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import type { PurchaseOrderDto } from '../../services/inventoryService';
import { Badge, Pagination, Button, DateInput } from '../../components/ui';
import { AlertCircle, Loader2, Lock, Ban, Search, MoreVertical, Eye, PackagePlus, ChevronDown, SlidersHorizontal, X, Plus } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import toast from 'react-hot-toast';
import { useProjectAccess } from '../../hooks/useProjectAccess';

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 12px', fontSize: '0.82rem', cursor: 'pointer',
  color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap',
};

interface RowMenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}

const RowActionsMenu: React.FC<{ items: RowMenuItem[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const closeMenu = () => setOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [open]);

  if (items.length === 0) return <span className="text-[hsl(var(--text-muted))]">—</span>;

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  return (
    <div className="inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        className="p-1.5 rounded-md hover:bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]"
      >
        <MoreVertical size={14} />
      </button>
      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="z-[1000] bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-md shadow-lg min-w-[170px] overflow-hidden py-1"
        >
          {items.map(item => (
            <div
              key={item.key}
              style={{ ...menuItemStyle, color: item.danger ? 'hsl(var(--danger))' : menuItemStyle.color }}
              onMouseEnter={(e) => (e.currentTarget.style.background = item.danger ? 'hsl(var(--danger-glow))' : 'hsl(var(--primary-glow))')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { setOpen(false); item.onClick(); }}
            >
              {item.icon} {item.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

const CANCELLABLE = ['Draft', 'Sent'];

const PO_STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: '' },
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
}

export const ProjectPOTab: React.FC<Props> = ({ projectId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { connection } = useNotification();
  const { canManageExecution, canManageAccounting } = useProjectAccess(projectId);
  const isAccountant = canManageAccounting;
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setPage(1);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // Popup "Bộ lọc nâng cao" gom Trạng thái / Ngày đặt (không có lọc theo dự án vì tab này đã scoped theo dự án)
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = [statusFilter, dateFrom || dateTo].filter(Boolean).length;

  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterBtnRef.current && !filterBtnRef.current.contains(e.target as Node) &&
        filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)
      ) setIsFilterOpen(false);
    };
    const closePanel = () => setIsFilterOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', closePanel, true);
    window.addEventListener('resize', closePanel);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', closePanel, true);
      window.removeEventListener('resize', closePanel);
    };
  }, [isFilterOpen]);

  const toggleFilterPanel = () => {
    if (!isFilterOpen && filterBtnRef.current) {
      const rect = filterBtnRef.current.getBoundingClientRect();
      setFilterPos({ top: rect.bottom + 6, left: rect.left });
    }
    setIsFilterOpen(o => !o);
  };

  const handleClearAllFilters = () => {
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

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
    onSuccess: (result) => {
      toast.success(result.message || 'Đã hủy đơn mua hàng.');
      closeActionModal();
      queryClient.invalidateQueries({ queryKey: ['project-purchase-orders', projectId] });
    },
    onError: (err: any) => setActionError(err.message || 'Không thể hủy đơn mua hàng.'),
  });

  const closeMutation = useMutation({
    mutationFn: () => inventoryService.closePurchaseOrder(actionModal!.po.poId, actionReason),
    onSuccess: (result) => {
      toast.success(result.message || 'Đã đóng đơn mua hàng. Phần vật tư chưa nhận đã được trả lại yêu cầu vật tư.');
      closeActionModal();
      queryClient.invalidateQueries({ queryKey: ['project-purchase-orders', projectId] });
    },
    onError: (err: any) => setActionError(err.message || 'Không thể đóng đơn mua hàng.'),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project-purchase-orders', projectId, page, statusFilter, debouncedSearchTerm, dateFrom, dateTo],
    queryFn: () =>
      inventoryService.getPurchaseOrders({
        projectId,
        status: statusFilter || undefined,
        search: debouncedSearchTerm || undefined,
        orderDateFrom: dateFrom || undefined,
        orderDateTo: dateTo || undefined,
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

  const getRowMenuItems = (po: PurchaseOrderDto): RowMenuItem[] => {
    const items: RowMenuItem[] = [
      {
        key: 'view',
        label: 'Xem chi tiết',
        icon: <Eye size={14} style={{ color: 'hsl(var(--primary))' }} />,
        onClick: () => navigate(`/purchase-orders/${po.poId}`),
      },
    ];

    if (isAccountant) {
      const canClose = po.status === 'PartiallyReceived';
      const canCancel = CANCELLABLE.includes(po.status);
      if (canClose) {
        items.push({
          key: 'close',
          label: 'Đóng đơn hàng',
          icon: <Lock size={14} style={{ color: 'hsl(var(--primary))' }} />,
          onClick: () => setActionModal({ type: 'close', po }),
        });
      }
      if (canCancel) {
        items.push({
          key: 'cancel',
          label: 'Hủy đơn hàng',
          icon: <Ban size={14} />,
          danger: true,
          onClick: () => setActionModal({ type: 'cancel', po }),
        });
      }
      return items;
    }

    const canReceive = canManageExecution && (po.status === 'Sent' || po.status === 'PartiallyReceived');
    if (canReceive) {
      items.push({
        key: 'receive',
        label: 'Nhập kho',
        icon: <PackagePlus size={14} style={{ color: 'hsl(var(--primary))' }} />,
        onClick: () => navigate(`/projects/${projectId}?tab=inventory&subTab=receipts&openCreate=receipt&poId=${po.poId}&poNumber=${encodeURIComponent(po.poNumber)}`),
      });
    }
    return items;
  };

  return (
    <div className="bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {isError && (
        <div className="m-4 mb-0 animate-fade-in py-2.5 px-3.5 flex items-center gap-2 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm text-[hsl(346_84%_35%)] text-[0.85rem]">
          <AlertCircle size={16} className="flex-shrink-0" />
          Không thể tải danh sách đơn mua hàng.
        </div>
      )}

      <div className="p-4 border-b border-[hsl(var(--border))] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="Tìm theo số đơn hàng, nhà cung cấp..."
              className="py-2 pl-9 pr-3 border border-[hsl(var(--border))] rounded-lg text-sm bg-transparent w-full"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            ref={filterBtnRef}
            type="button"
            onClick={toggleFilterPanel}
            className={`relative flex items-center gap-1.5 py-2 px-3 border rounded-lg text-sm font-medium transition-colors ${
              isFilterOpen || activeFilterCount > 0
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-[hsl(var(--primary-glow))]'
                : 'border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] bg-[hsl(var(--bg-card))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]'
            }`}
          >
            <SlidersHorizontal size={15} />
            Bộ lọc nâng cao
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[hsl(var(--primary))] text-white text-[11px] font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-4">
          {data && (
            <span className="text-[13px] text-[hsl(var(--text-muted))] whitespace-nowrap">
              {data.totalCount} đơn mua hàng
            </span>
          )}
          {isAccountant && (
            <Button
              variant="primary"
              onClick={() => navigate(`/purchase-orders/new?projectId=${projectId}`)}
              className="flex items-center gap-1.5 text-sm"
            >
              <Plus size={16} /> Tạo đơn hàng
            </Button>
          )}
        </div>
      </div>

      {isFilterOpen && filterPos && createPortal(
        <div
          ref={filterPanelRef}
          style={{ position: 'fixed', top: filterPos.top, left: filterPos.left }}
          className="z-[1000] w-[336px] bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-xl shadow-lg p-4 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[hsl(var(--text-primary))]">Bộ lọc nâng cao</span>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="p-1 rounded text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-main))]"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[hsl(var(--text-secondary))] uppercase tracking-wide">Trạng thái</label>
            <div className="relative">
              <select
                className="appearance-none pl-3 pr-9 py-2 border border-[hsl(var(--border))] rounded-lg text-sm bg-[hsl(var(--bg-main))] text-[hsl(var(--text-primary))] w-full"
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              >
                {PO_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] pointer-events-none" size={14} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[hsl(var(--text-secondary))] uppercase tracking-wide">Ngày đặt</label>
            <div className="flex items-center gap-2">
              <DateInput
                className="w-[136px] shrink-0"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(v) => { setDateFrom(v); setPage(1); }}
                title="Từ ngày đặt"
              />
              <span className="text-[hsl(var(--text-muted))] text-sm shrink-0">–</span>
              <DateInput
                className="w-[136px] shrink-0"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(v) => { setDateTo(v); setPage(1); }}
                title="Đến ngày đặt"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
            <button
              type="button"
              onClick={handleClearAllFilters}
              disabled={activeFilterCount === 0}
              className="text-[13px] font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--danger))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Xóa tất cả bộ lọc
            </button>
            <Button variant="primary" size="sm" onClick={() => setIsFilterOpen(false)} className="text-[13px] py-1.5 px-3">
              Xong
            </Button>
          </div>
        </div>,
        document.body
      )}

      <div className="overflow-x-auto">
        <table className={`w-full min-w-[860px] table-fixed text-sm text-left ${isLoading ? 'opacity-50' : ''}`}>
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--border))]">
            <tr>
              <th className="px-4 py-3 font-medium">Số đơn hàng</th>
              <th className="px-4 py-3 font-medium">Nhà cung cấp</th>
              <th className="px-4 py-3 font-medium">Ngày đặt</th>
              <th className="px-4 py-3 font-medium text-right">Tổng tiền</th>
              <th className="px-4 py-3 font-medium text-center">Số vật tư</th>
              <th className="px-4 py-3 font-medium text-center">Trạng thái</th>
              <th className="px-4 py-3 font-medium text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    Đang tải...
                  </div>
                </td>
              </tr>
            ) : (data?.items ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">
                  Dự án này chưa có đơn mua hàng nào.
                </td>
              </tr>
            ) : (
              (data?.items ?? []).map(po => (
                <tr
                  key={po.poId}
                  className="hover:bg-[hsl(var(--bg-main))]/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/purchase-orders/${po.poId}`)}
                >
                  <td className="px-4 py-3 font-semibold text-[hsl(var(--primary))] truncate" title={po.poNumber}>{po.poNumber}</td>
                  <td className="px-4 py-3 text-[hsl(var(--text-secondary))] truncate" title={po.supplierName || 'N/A'}>{po.supplierName || 'N/A'}</td>
                  <td className="px-4 py-3 text-[hsl(var(--text-secondary))] whitespace-nowrap">{formatDate(po.orderDate)}</td>
                  <td className="px-4 py-3 font-semibold text-right whitespace-nowrap">{formatCurrency(po.totalAmount)}</td>
                  <td className="px-4 py-3 text-[hsl(var(--text-muted))] text-center whitespace-nowrap">{po.items.length} dòng</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={statusVariant[po.status] ?? 'default'}>
                      {statusLabel[po.status] ?? po.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RowActionsMenu items={getRowMenuItems(po)} />
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
