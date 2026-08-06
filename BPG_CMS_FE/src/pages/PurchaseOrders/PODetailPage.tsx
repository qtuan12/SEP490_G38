import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import { useNotification } from '../../context/NotificationContext';
import { Button, Badge } from '../../components/ui';
import {
  ArrowLeft, ShoppingCart, Building2, CalendarDays, MapPin,
  FileText, Package, Link2, AlertCircle, Loader2, XCircle, Ban, Lock,
  CheckCircle2, Clock,
} from 'lucide-react';
import { useProjectAccess } from '../../hooks/useProjectAccess';
import toast from 'react-hot-toast';

const fmt = (v: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const statusLabel: Record<string, string> = {
  Draft: 'Nháp',
  PendingApproval: 'Chờ Giám đốc duyệt',
  Rejected: 'Bị từ chối',
  Sent: 'Đã gửi',
  PartiallyReceived: 'Nhận một phần',
  FullyReceived: 'Nhận đủ',
  Closed: 'Đã đóng',
  Cancelled: 'Đã hủy',
};

const statusVariant: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  Draft: 'default',
  PendingApproval: 'warning',
  Rejected: 'danger',
  Sent: 'warning',
  PartiallyReceived: 'info',
  FullyReceived: 'success',
  Closed: 'default',
  Cancelled: 'danger',
};

// Đơn bị từ chối là trạng thái kết thúc, không hủy thêm được nữa.
const CANCELLABLE = ['Draft', 'PendingApproval', 'Sent'];

const infoRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2,
};
const infoLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const infoValue: React.CSSProperties = {
  fontSize: 14, color: 'hsl(var(--text-primary))', fontWeight: 500,
};

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div style={infoRow}>
      <span style={infoLabel}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'hsl(var(--text-muted))', flexShrink: 0 }}>{icon}</span>
        <span style={infoValue}>{value || '—'}</span>
      </div>
    </div>
  );
}

export const PODetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { connection } = useNotification();
  const poId = Number(id);

  // Vào từ thông báo thì không có lịch sử duyệt để lùi lại, và người dùng mong đợi
  // quay về danh sách đơn hàng của chính dự án đó chứ không phải danh sách tổng.
  const fromProject = searchParams.get('fromProject');
  const goBack = () => {
    if (fromProject) navigate(`/projects/${fromProject}?tab=purchaseorders`);
    else navigate(-1);
  };

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelMutation = useMutation({
    mutationFn: () => inventoryService.cancelPurchaseOrder(poId, cancelReason),
    onSuccess: (result) => {
      toast.success(result.message || 'Đã hủy đơn mua hàng.');
      setShowCancelModal(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['po-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => setCancelError(err.message || 'Không thể hủy đơn mua hàng.'),
  });

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closeError, setCloseError] = useState<string | null>(null);

  const closeMutation = useMutation({
    mutationFn: () => inventoryService.closePurchaseOrder(poId, closeReason),
    onSuccess: (result) => {
      toast.success(result.message || 'Đã đóng đơn mua hàng. Phần vật tư chưa nhận đã được trả lại yêu cầu vật tư.');
      setShowCloseModal(false);
      setCloseReason('');
      queryClient.invalidateQueries({ queryKey: ['po-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => setCloseError(err.message || 'Không thể đóng đơn mua hàng.'),
  });

  // Duyệt / từ chối của Giám đốc: mọi đơn hàng đều phải qua bước này trước khi gửi NCC.
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveNote, setApproveNote] = useState('');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const invalidatePO = () => {
    queryClient.invalidateQueries({ queryKey: ['po-detail', poId] });
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => inventoryService.approvePurchaseOrder(poId, approveNote.trim() || undefined),
    onSuccess: (result) => {
      toast.success(result.message || 'Đã duyệt đơn mua hàng.');
      setShowApproveModal(false);
      setApproveNote('');
      invalidatePO();
    },
    onError: (err: any) => toast.error(err.message || 'Không thể duyệt đơn mua hàng.'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => inventoryService.rejectPurchaseOrder(poId, rejectReason),
    onSuccess: (result) => {
      toast.success(result.message || 'Đã từ chối đơn mua hàng.');
      setShowRejectModal(false);
      setRejectReason('');
      invalidatePO();
    },
    onError: (err: any) => setRejectError(err.message || 'Không thể từ chối đơn mua hàng.'),
  });

  const { data: po, isLoading, isError, error } = useQuery({
    queryKey: ['po-detail', poId],
    queryFn: () => inventoryService.getPurchaseOrderById(poId),
    enabled: !isNaN(poId) && poId > 0,
  });
  const { canManageAccounting, canApprove } = useProjectAccess(po?.projectId);

  // Realtime: tự làm mới nếu PO này bị người khác hủy/đóng trong khi đang xem
  const poProjectId = po?.projectId;
  useEffect(() => {
    if (!connection || !poProjectId) return;

    connection.invoke('JoinProjectGroup', poProjectId).catch(err => console.error('SignalR JoinProjectGroup error:', err));

    const handlePOUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['po-detail', poId] });
    };
    connection.on('PurchaseOrderUpdated', handlePOUpdated);

    return () => {
      connection.off('PurchaseOrderUpdated', handlePOUpdated);
      connection.invoke('LeaveProjectGroup', poProjectId).catch(err => console.error('SignalR LeaveProjectGroup error:', err));
    };
  }, [connection, poProjectId, poId, queryClient]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, gap: 10 }}>
        <Loader2 className="animate-spin" size={24} style={{ color: 'hsl(var(--primary))' }} />
        <span style={{ color: 'hsl(var(--text-secondary))' }}>Đang tải chi tiết đơn hàng...</span>
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div style={{ maxWidth: 600, margin: '48px auto', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <AlertCircle size={40} style={{ color: 'hsl(var(--danger))' }} />
        <p style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>
          {(error as any)?.message || 'Không thể tải thông tin đơn mua hàng.'}
        </p>
        <Button type="button" variant="secondary" onClick={goBack}>
          <ArrowLeft size={16} /> Quay lại
        </Button>
      </div>
    );
  }

  const receivedTotal = po.items.reduce((s, it) => s + it.totalReceived * it.unitPrice, 0);
  const canCancel = CANCELLABLE.includes(po.status) && canManageAccounting;
  const canClose = po.status === 'PartiallyReceived' && canManageAccounting;
  const canDecide = po.status === 'PendingApproval' && canApprove;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1120, margin: '0 auto' }}>
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button type="button" variant="secondary" className="p-2 h-auto" onClick={goBack}>
          <ArrowLeft size={18} />
        </Button>
        <ShoppingCart size={22} style={{ color: 'hsl(var(--primary))' }} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
          {po.poNumber}
        </h2>
        <Badge variant={statusVariant[po.status] ?? 'default'}>
          {statusLabel[po.status] ?? po.status}
        </Badge>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {canDecide && (
            <>
              <Button type="button" variant="primary" onClick={() => setShowApproveModal(true)}>
                <CheckCircle2 size={16} /> Duyệt đơn hàng
              </Button>
              <Button type="button" variant="danger" onClick={() => { setRejectError(null); setShowRejectModal(true); }}>
                <XCircle size={16} /> Từ chối
              </Button>
            </>
          )}
          {canClose && (
            <Button type="button" variant="secondary" onClick={() => { setCloseError(null); setShowCloseModal(true); }}>
              <Lock size={16} /> Đóng đơn hàng
            </Button>
          )}
          {canCancel && (
            <Button type="button" variant="danger" onClick={() => { setCancelError(null); setShowCancelModal(true); }}>
              <Ban size={16} /> Hủy đơn hàng
            </Button>
          )}
        </div>
      </div>

      {/* Pending approval banner */}
      {po.status === 'PendingApproval' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'hsl(38 92% 50% / 0.12)', border: '1px solid hsl(38 92% 50% / 0.35)',
          borderRadius: 8, padding: '12px 16px',
        }}>
          <Clock size={16} style={{ color: 'hsl(38 92% 40%)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(38 92% 35%)' }}>Đang chờ Giám đốc duyệt</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
              Đơn hàng chưa được gửi nhà cung cấp và chưa thể lập phiếu nhập kho cho tới khi được duyệt.
            </div>
          </div>
        </div>
      )}

      {/* Rejected reason banner */}
      {po.status === 'Rejected' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)',
          borderRadius: 8, padding: '12px 16px',
        }}>
          <XCircle size={16} style={{ color: 'hsl(var(--danger))', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--danger))' }}>
              Giám đốc từ chối{po.approverName ? ` — ${po.approverName}` : ''}
              {po.approvedAt ? ` (${fmtDate(po.approvedAt)})` : ''}
            </div>
            <div style={{ fontSize: 13, color: 'hsl(346 84% 35%)', marginTop: 2 }}>{po.rejectedReason || '—'}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
              Số lượng vật tư của đơn này đã được trả lại yêu cầu vật tư, có thể lập đơn mua hàng khác.
            </div>
          </div>
        </div>
      )}

      {/* Approved banner */}
      {po.approverName && po.status !== 'Rejected' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'hsl(142 70% 45% / 0.1)', border: '1px solid hsl(142 70% 45% / 0.3)',
          borderRadius: 8, padding: '12px 16px',
        }}>
          <CheckCircle2 size={16} style={{ color: 'hsl(142 70% 35%)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(142 70% 30%)' }}>
              Đã được Giám đốc {po.approverName} duyệt{po.approvedAt ? ` ngày ${fmtDate(po.approvedAt)}` : ''}
            </div>
            {po.approvalNote && (
              <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>{po.approvalNote}</div>
            )}
          </div>
        </div>
      )}

      {/* Cancelled reason banner */}
      {po.status === 'Cancelled' && po.cancelledReason && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)',
          borderRadius: 8, padding: '12px 16px',
        }}>
          <XCircle size={16} style={{ color: 'hsl(var(--danger))', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--danger))' }}>Lý do hủy</div>
            <div style={{ fontSize: 13, color: 'hsl(346 84% 35%)', marginTop: 2 }}>{po.cancelledReason}</div>
          </div>
        </div>
      )}

      {/* Closed reason banner */}
      {po.status === 'Closed' && po.closedReason && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'hsl(var(--primary-glow))', border: '1px solid hsl(var(--border))',
          borderRadius: 8, padding: '12px 16px',
        }}>
          <Lock size={16} style={{ color: 'hsl(var(--primary))', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--primary))' }}>Lý do đóng đơn hàng</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>{po.closedReason}</div>
          </div>
        </div>
      )}

      {/* Header info grid */}
      <div className="glass-panel p-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px 32px' }}>
        <InfoItem icon={<CalendarDays size={14} />} label="Ngày đơn hàng" value={fmtDate(po.orderDate)} />
        <InfoItem icon={<CalendarDays size={14} />} label="Hạn giao hàng" value={po.expectedDeliveryDate ? fmtDate(po.expectedDeliveryDate) : undefined} />
        <InfoItem icon={<Building2 size={14} />} label="Dự án" value={po.projectName || undefined} />
        <InfoItem icon={<Building2 size={14} />} label="Nhà cung cấp" value={po.supplierName || undefined} />
        {po.supplierContactInfo && (
          <InfoItem icon={<FileText size={14} />} label="Liên hệ nhà cung cấp" value={po.supplierContactInfo} />
        )}
        <InfoItem icon={<MapPin size={14} />} label="Địa điểm giao hàng" value={po.deliveryAddress || undefined} />
        {po.notes && (
          <div style={{ ...infoRow, gridColumn: '1 / -1' }}>
            <span style={infoLabel}>Ghi chú</span>
            <span style={{ ...infoValue, color: 'hsl(var(--text-secondary))' }}>{po.notes}</span>
          </div>
        )}
      </div>

      {/* Linked requests */}
      {po.linkedRequests.length > 0 && (
        <div className="glass-panel p-6">
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={16} style={{ color: 'hsl(var(--primary))' }} />
            Yêu cầu vật tư liên kết
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {po.linkedRequests.map((req) => (
              <Link
                key={req.requestId}
                // Kèm fromPO để đóng modal chi tiết YCVT thì quay lại đúng đơn hàng này,
                // thay vì bỏ người dùng lại ở tab yêu cầu vật tư của dự án.
                to={`/projects/${req.projectId}?tab=materialrequests&phaseId=${req.phaseId}&requestId=${req.requestId}&fromPO=${po.poId}`}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 13,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--primary-glow))',
                  color: 'hsl(var(--text-primary))',
                  textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'hsl(var(--primary))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'hsl(var(--border))'; }}
              >
                <span style={{ fontWeight: 700, color: 'hsl(var(--primary))' }}>YCVT-{req.requestId}</span>
                {req.phaseName && <span style={{ color: 'hsl(var(--text-muted))', marginLeft: 6 }}>— {req.phaseName}</span>}
                {req.reason && <span style={{ color: 'hsl(var(--text-secondary))', marginLeft: 6 }}>{req.reason}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="glass-panel p-6">
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={16} style={{ color: 'hsl(var(--primary))' }} />
          Chi tiết vật tư ({po.items.length} loại)
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid hsl(var(--border))' }}>
                {['STT', 'Mã VT', 'Tên vật tư', 'ĐVT', 'SL đặt', 'SL đã nhận', 'Đơn giá', 'Thành tiền', 'Ghi chú'].map((h) => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left',
                    color: 'hsl(var(--text-muted))', fontWeight: 600, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {po.items.map((it, idx) => {
                const remaining = it.quantity - it.totalReceived;
                const fullyReceived = remaining <= 0;
                return (
                  <tr key={it.poItemId} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--text-muted))' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'hsl(var(--primary))' }}>{it.materialCode}</td>
                    <td style={{ padding: '10px 12px', minWidth: 160 }}>
                      <div style={{ fontWeight: 500, color: 'hsl(var(--text-primary))' }}>{it.materialName}</div>
                      {it.specification && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{it.specification}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--text-secondary))' }}>{it.unitName}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: 'hsl(var(--text-primary))' }}>{it.quantity}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontWeight: 600,
                        color: fullyReceived ? 'hsl(142 70% 40%)' : it.totalReceived > 0 ? 'hsl(38 92% 40%)' : 'hsl(var(--text-muted))',
                      }}>
                        {it.totalReceived}
                      </span>
                      {!fullyReceived && it.totalReceived > 0 && (
                        <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginLeft: 4 }}>
                          (còn {remaining})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap' }}>
                      {fmt(it.unitPrice)}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap', color: 'hsl(var(--text-primary))' }}>
                      {fmt(it.lineTotal)}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--text-secondary))', maxWidth: 160 }}>
                      {it.notes || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 12,
          borderTop: '1px solid hsl(var(--border))', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
        }}>
          {receivedTotal > 0 && (
            <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
              Đã nhận: <span style={{ fontWeight: 600, color: 'hsl(142 70% 40%)' }}>{fmt(receivedTotal)}</span>
            </div>
          )}
          <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
            Tổng cộng: <span style={{ color: 'hsl(var(--primary))', marginLeft: 8 }}>{fmt(po.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Không lặp lại nút quay lại ở cuối trang: mũi tên trên thanh tiêu đề đã làm việc đó. */}

      {/* Approve modal */}
      {showApproveModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => !approveMutation.isPending && setShowApproveModal(false)}>
          <div style={{
            background: 'hsl(var(--bg-card))', borderRadius: 12,
            border: '1px solid hsl(var(--border))', padding: 28,
            width: 440, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={20} style={{ color: 'hsl(142 70% 40%)' }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                Xác nhận duyệt đơn hàng
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
              Duyệt đơn mua hàng <strong style={{ color: 'hsl(var(--text-primary))' }}>{po.poNumber}</strong> trị giá{' '}
              <strong style={{ color: 'hsl(var(--text-primary))' }}>{fmt(po.totalAmount)}</strong>.
              Sau khi duyệt, đơn có thể gửi nhà cung cấp và lập phiếu nhập kho.
            </p>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: 6 }}>
                Ghi chú duyệt (không bắt buộc)
              </label>
              <textarea
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Nhập ghi chú của Giám đốc..."
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px', borderRadius: 6, fontSize: 13,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--bg-input, var(--bg-card)))',
                  color: 'hsl(var(--text-primary))', resize: 'vertical', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={() => setShowApproveModal(false)}
                disabled={approveMutation.isPending}>
                Đóng
              </Button>
              <Button type="button" variant="primary" disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}>
                {approveMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Đang duyệt...</>
                  : <><CheckCircle2 size={14} /> Xác nhận duyệt</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => !rejectMutation.isPending && setShowRejectModal(false)}>
          <div style={{
            background: 'hsl(var(--bg-card))', borderRadius: 12,
            border: '1px solid hsl(var(--border))', padding: 28,
            width: 440, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <XCircle size={20} style={{ color: 'hsl(var(--danger))' }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                Xác nhận từ chối đơn hàng
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
              Từ chối đơn mua hàng <strong style={{ color: 'hsl(var(--text-primary))' }}>{po.poNumber}</strong>.
              Số lượng vật tư sẽ được trả lại yêu cầu vật tư để lập đơn khác. Thao tác này không thể hoàn tác.
            </p>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: 6 }}>
                Lý do từ chối <span style={{ color: 'hsl(var(--danger))' }}>*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => { setRejectReason(e.target.value); setRejectError(null); }}
                placeholder="Nhập lý do từ chối đơn mua hàng..."
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px', borderRadius: 6, fontSize: 13,
                  border: `1px solid ${rejectError ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`,
                  background: 'hsl(var(--bg-input, var(--bg-card)))',
                  color: 'hsl(var(--text-primary))', resize: 'vertical', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              {rejectError && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{rejectError}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={() => setShowRejectModal(false)}
                disabled={rejectMutation.isPending}>
                Đóng
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                title={!rejectReason.trim() ? 'Vui lòng nhập lý do từ chối đơn mua hàng.' : undefined}
                onClick={() => rejectMutation.mutate()}
              >
                {rejectMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Đang xử lý...</>
                  : <><XCircle size={14} /> Xác nhận từ chối</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowCancelModal(false)}>
          <div style={{
            background: 'hsl(var(--bg-card))', borderRadius: 12,
            border: '1px solid hsl(var(--border))', padding: 28,
            width: 440, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Ban size={20} style={{ color: 'hsl(var(--danger))' }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                Xác nhận hủy đơn hàng
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
              Hủy đơn mua hàng <strong style={{ color: 'hsl(var(--text-primary))' }}>{po.poNumber}</strong>.
              Thao tác này không thể hoàn tác.
            </p>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: 6 }}>
                Lý do hủy <span style={{ color: 'hsl(var(--danger))' }}>*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => { setCancelReason(e.target.value); setCancelError(null); }}
                placeholder="Nhập lý do hủy đơn mua hàng..."
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px', borderRadius: 6, fontSize: 13,
                  border: `1px solid ${cancelError ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`,
                  background: 'hsl(var(--bg-input, var(--bg-card)))',
                  color: 'hsl(var(--text-primary))', resize: 'vertical', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              {cancelError && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{cancelError}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={() => setShowCancelModal(false)}
                disabled={cancelMutation.isPending}>
                Đóng
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={cancelMutation.isPending || !cancelReason.trim()}
                title={!cancelReason.trim() ? 'Vui lòng nhập lý do hủy đơn mua hàng.' : undefined}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Đang hủy...</>
                  : <><Ban size={14} /> Xác nhận hủy</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Close modal */}
      {showCloseModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => !closeMutation.isPending && setShowCloseModal(false)}>
          <div style={{
            background: 'hsl(var(--bg-card))', borderRadius: 12,
            border: '1px solid hsl(var(--border))', padding: 28,
            width: 440, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={20} style={{ color: 'hsl(var(--primary))' }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                Xác nhận đóng đơn hàng
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
              Đóng đơn mua hàng <strong style={{ color: 'hsl(var(--text-primary))' }}>{po.poNumber}</strong> đang nhận một phần.
              Phần vật tư <strong style={{ color: 'hsl(var(--text-primary))' }}>chưa nhận</strong> sẽ được trả lại yêu cầu vật tư,
              cho phép tạo đơn mua hàng khác cho phần còn thiếu. Thao tác này không thể hoàn tác.
            </p>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: 6 }}>
                Lý do đóng đơn hàng <span style={{ color: 'hsl(var(--danger))' }}>*</span>
              </label>
              <textarea
                value={closeReason}
                onChange={(e) => { setCloseReason(e.target.value); setCloseError(null); }}
                placeholder="Nhập lý do đóng đơn mua hàng..."
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px', borderRadius: 6, fontSize: 13,
                  border: `1px solid ${closeError ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`,
                  background: 'hsl(var(--bg-input, var(--bg-card)))',
                  color: 'hsl(var(--text-primary))', resize: 'vertical', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              {closeError && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{closeError}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={() => setShowCloseModal(false)}
                disabled={closeMutation.isPending}>
                Đóng
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={closeMutation.isPending || !closeReason.trim()}
                title={!closeReason.trim() ? 'Vui lòng nhập lý do đóng đơn mua hàng.' : undefined}
                onClick={() => closeMutation.mutate()}
              >
                {closeMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Đang đóng...</>
                  : <><Lock size={14} /> Xác nhận đóng đơn hàng</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
