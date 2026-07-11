import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Button, Badge } from '../../components/ui';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ShoppingCart, Building2, CalendarDays, MapPin,
  FileText, Package, Link2, AlertCircle, Loader2, XCircle, Ban, Lock,
} from 'lucide-react';

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

const CANCELLABLE = ['Draft', 'Sent'];

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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { connection } = useNotification();
  const poId = Number(id);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelMutation = useMutation({
    mutationFn: () => inventoryService.cancelPurchaseOrder(poId, cancelReason),
    onSuccess: () => {
      toast.success('Đã hủy đơn mua hàng thành công.');
      setShowCancelModal(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['po-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => setCancelError(err.message || 'Hủy đơn hàng thất bại.'),
  });

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closeError, setCloseError] = useState<string | null>(null);

  const closeMutation = useMutation({
    mutationFn: () => inventoryService.closePurchaseOrder(poId, closeReason),
    onSuccess: () => {
      toast.success('Đã đóng đơn mua hàng. Phần vật tư chưa nhận được trả lại yêu cầu vật tư.');
      setShowCloseModal(false);
      setCloseReason('');
      queryClient.invalidateQueries({ queryKey: ['po-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => setCloseError(err.message || 'Đóng đơn hàng thất bại.'),
  });

  const { data: po, isLoading, isError, error } = useQuery({
    queryKey: ['po-detail', poId],
    queryFn: () => inventoryService.getPurchaseOrderById(poId),
    enabled: !isNaN(poId) && poId > 0,
  });

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
        <Button type="button" variant="secondary" onClick={() => navigate('/purchase-orders')}>
          <ArrowLeft size={16} /> Quay lại danh sách
        </Button>
      </div>
    );
  }

  const receivedTotal = po.items.reduce((s, it) => s + it.totalReceived * it.unitPrice, 0);
  const canCancel = CANCELLABLE.includes(po.status) && user?.role === 'accountant';
  const canClose = po.status === 'PartiallyReceived' && user?.role === 'accountant';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1120, margin: '0 auto' }}>
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button type="button" variant="secondary" className="p-2 h-auto" onClick={() => navigate('/purchase-orders')}>
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
                to={`/projects/${req.projectId}/phases/${req.phaseId}/material-requests?requestId=${req.requestId}`}
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
          Chi tiết vật tư ({po.items.length} dòng)
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

      {/* Back button */}
      <div style={{ paddingBottom: 24 }}>
        <Button type="button" variant="secondary" onClick={() => navigate('/purchase-orders')}>
          <ArrowLeft size={16} /> Quay lại danh sách
        </Button>
      </div>

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
                disabled={cancelMutation.isPending}
                onClick={() => {
                  if (!cancelReason.trim()) return setCancelError('Vui lòng nhập lý do hủy.');
                  cancelMutation.mutate();
                }}
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
                disabled={closeMutation.isPending}
                onClick={() => {
                  if (!closeReason.trim()) return setCloseError('Vui lòng nhập lý do đóng đơn hàng.');
                  closeMutation.mutate();
                }}
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
