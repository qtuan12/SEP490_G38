import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button, Badge } from '../../components/ui';
import { directPurchaseService, type DirectPurchaseDetailDto } from '../../services/directPurchaseService';
import { Loader2, CheckCircle, XCircle, FileText, Package } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAudited: () => void;
  directPurchaseId: number | null;
  /** Cho phép kế toán thao tác kiểm toán */
  canAudit: boolean;
}

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

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const DirectPurchaseDetailModal: React.FC<Props> = ({ isOpen, onClose, onAudited, directPurchaseId, canAudit }) => {
  const [detail, setDetail] = useState<DirectPurchaseDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditNote, setAuditNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !directPurchaseId) return;
    setLoading(true);
    setAuditNote('');
    setDetail(null);
    directPurchaseService.getById(directPurchaseId)
      .then(setDetail)
      .catch(() => toast.error('Không tải được chi tiết phiếu.'))
      .finally(() => setLoading(false));
  }, [isOpen, directPurchaseId]);

  const handleAudit = async (approve: boolean) => {
    if (!directPurchaseId) return;
    if (!approve && !auditNote.trim()) {
      toast.error('Vui lòng nhập lý do khi từ chối kiểm toán.');
      return;
    }
    setSubmitting(true);
    try {
      await directPurchaseService.audit(directPurchaseId, { approve, auditNote: auditNote.trim() || undefined });
      toast.success(approve ? 'Đã xác nhận kiểm toán / hoàn tiền.' : 'Đã từ chối kiểm toán phiếu.');
      onAudited();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = detail?.auditStatus === 'PendingAudit';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={detail ? `Chi tiết phiếu ${detail.requestNumber}` : 'Chi tiết phiếu mua khẩn cấp'}
      width="lg"
      footer={
        canAudit && isPending ? (
          <>
            <Button
              variant="danger"
              onClick={() => handleAudit(false)}
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <XCircle size={16} /> Từ chối
            </Button>
            <Button
              variant="primary"
              onClick={() => handleAudit(true)}
              isLoading={submitting}
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CheckCircle size={16} /> Xác nhận đã hoàn tiền
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        )
      }
    >
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, gap: 10 }}>
          <Loader2 className="animate-spin" size={22} style={{ color: 'hsl(var(--primary))' }} />
          <span style={{ color: 'hsl(var(--text-secondary))' }}>Đang tải...</span>
        </div>
      )}

      {!loading && detail && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Header info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '0.9rem' }}>
            <InfoRow label="Dự án" value={detail.projectName} />
            <InfoRow label="Giai đoạn" value={detail.phaseName} />
            <InfoRow label="Người tạo" value={detail.requesterName} />
            <InfoRow label="Ngày mua" value={formatDate(detail.purchaseDate)} />
            <div>
              <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>Trạng thái kiểm toán</span>
              <div style={{ marginTop: '2px' }}>
                <Badge variant={auditVariant[detail.auditStatus] ?? 'default'}>
                  {auditLabel[detail.auditStatus] ?? detail.auditStatus}
                </Badge>
              </div>
            </div>
            <InfoRow label="Tổng tiền" value={formatCurrency(detail.totalAmount)} bold />
          </div>

          {detail.reason && (
            <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-sidebar))', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              <strong>Lý do:</strong> {detail.reason}
            </div>
          )}

          {/* Auto-generated documents */}
          {(detail.autoPONumber || detail.autoReceiptNo) && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {detail.autoPONumber && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'hsl(var(--primary-glow))', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'hsl(var(--primary))' }}>
                  <FileText size={13} /> PO: {detail.autoPONumber}
                </span>
              )}
              {detail.autoReceiptNo && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'hsl(var(--primary-glow))', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'hsl(var(--primary))' }}>
                  <Package size={13} /> Phiếu nhập: {detail.autoReceiptNo}
                </span>
              )}
            </div>
          )}

          {/* Items table */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--text-secondary))' }}>Danh sách vật tư</h4>
            <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'hsl(var(--bg-sidebar))', borderBottom: '1px solid hsl(var(--border))' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Vật tư</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>SL</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>Đơn giá</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                      <td style={{ padding: '8px 10px' }}>[{it.materialCode}] {it.materialName}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{it.quantity} {it.unitName}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(it.unitPrice)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice photos */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--text-secondary))' }}>
              Ảnh hóa đơn ({detail.invoicePhotoUrls.length})
            </h4>
            {detail.invoicePhotoUrls.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Không có ảnh hóa đơn.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {detail.invoicePhotoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`invoice-${i}`} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', cursor: 'zoom-in' }} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Audit note history (already audited) */}
          {!isPending && detail.auditorName && (
            <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-sidebar))', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              <div><strong>Người kiểm toán:</strong> {detail.auditorName}{detail.auditedAt ? ` — ${formatDate(detail.auditedAt)}` : ''}</div>
              {detail.auditNote && <div style={{ marginTop: '4px' }}><strong>Ghi chú:</strong> {detail.auditNote}</div>}
            </div>
          )}

          {/* Audit input (pending + accountant) */}
          {canAudit && isPending && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'hsl(var(--text-secondary))' }}>
                Ghi chú kiểm toán <span style={{ fontWeight: 400, color: 'hsl(var(--text-muted))' }}>(bắt buộc khi từ chối)</span>
              </label>
              <textarea
                value={auditNote}
                onChange={e => setAuditNote(e.target.value)}
                rows={2}
                placeholder="Ghi chú đối chiếu hóa đơn, lý do từ chối..."
                style={{ width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

const InfoRow: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
  <div>
    <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>{label}</span>
    <div style={{ marginTop: '2px', fontWeight: bold ? 700 : 500 }}>{value}</div>
  </div>
);
