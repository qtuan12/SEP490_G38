import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button, Badge, ConfirmDialog, ImageLightbox } from '../../components/ui';
import {
  directPurchaseService,
  DP_STATUS,
  DP_STATUS_LABEL,
  type DirectPurchaseDetailDto,
} from '../../services/directPurchaseService';
import { useAuth } from '../../context/AuthContext';
import { formatDateOnly, formatPlainDate } from '../../utils/dateHelpers';
import { CheckCircle, XCircle, FileText, Package, AlertTriangle, Send, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAudited: () => void;
  directPurchaseId: number | null;
  /** Cho phép kế toán thao tác kiểm toán */
  canAudit: boolean;
  /** Cho phép Giám đốc duyệt chi phiếu mua khẩn cấp */
  canApproveSpending?: boolean;
  /** Cho phép sửa/xóa/gửi phiếu nháp */
  canCreateDraft?: boolean;
  /** Callback khi bấm sửa phiếu nháp */
  onEditDraft?: (id: number) => void;
}

const statusVariant: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  Draft: 'default',
  Pending: 'warning',
  WaitingApproval: 'warning',
  Approved: 'success',
  Rejected: 'danger',
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);


export const DirectPurchaseDetailModal: React.FC<Props> = ({
  isOpen, onClose, onAudited, directPurchaseId, canAudit, canApproveSpending, canCreateDraft, onEditDraft,
}) => {
  const { user } = useAuth();
  const [detail, setDetail] = useState<DirectPurchaseDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'submit' | 'delete' | null>(null);

  useEffect(() => {
    if (!isOpen || !directPurchaseId) return;
    setLoading(true);
    setNote('');
    setDetail(null);
    setConfirmAction(null);
    directPurchaseService.getById(directPurchaseId)
      .then(setDetail)
      .catch(() => toast.error('Không thể tải chi tiết phiếu mua trực tiếp.'))
      .finally(() => setLoading(false));
  }, [isOpen, directPurchaseId]);

  /** Ảnh hóa đơn đang xem phóng to. null = chưa mở. */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isDraft = detail?.status === DP_STATUS.Draft;
  const isMine = !!detail && String(detail.requestedBy) === String(user?.id);

  // Kế toán chỉ thao tác được khi phiếu đã gửi và chưa kiểm toán.
  // Pending là trạng thái duy nhất thỏa cả hai điều kiện đó.
  const canDoAudit = canAudit && detail?.status === DP_STATUS.Pending;
  // Giám đốc chỉ thao tác khi Kế toán đã soát hóa đơn. Mọi phiếu đều qua bước này,
  // kể cả phiếu nằm trong dự toán vật tư.
  const canDoDirector = !!canApproveSpending && detail?.status === DP_STATUS.WaitingApproval;

  // Message thành công do backend quyết định. Tham số fallback chỉ dùng khi không có message.
  const run = async (fn: () => Promise<{ message?: string }>, fallbackMsg = 'Thao tác thành công.') => {
    setSubmitting(true);
    try {
      const result = await fn();
      toast.success(result.message || fallbackMsg);
      onAudited();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Không thể xử lý phiếu mua trực tiếp.');
    } finally {
      setSubmitting(false);
      setConfirmAction(null);
    }
  };

  // Từ chối bắt buộc có lý do — nút đã bị disable khi ô lý do trống, đây chỉ là chốt an toàn.
  const handleAudit = (approve: boolean) => {
    if (!directPurchaseId) return;
    if (!approve && !note.trim()) return;
    run(() => directPurchaseService.audit(directPurchaseId, { approve, auditNote: note.trim() || undefined }));
  };

  const handleDirector = (approve: boolean) => {
    if (!directPurchaseId) return;
    if (!approve && !note.trim()) return;
    if (approve) {
      run(() => directPurchaseService.directorApprove(directPurchaseId, { approvalNote: note.trim() || undefined }));
    } else {
      run(() => directPurchaseService.directorReject(directPurchaseId, { reason: note.trim() }));
    }
  };

  const doSubmitDraft = () => {
    if (!directPurchaseId) return;
    run(() => directPurchaseService.submit(directPurchaseId));
  };

  const doDeleteDraft = () => {
    if (!directPurchaseId) return;
    run(() => directPurchaseService.deleteDraft(directPurchaseId));
  };

  // Button đã là inline-flex sẵn - chỉ cần gap cho khoảng cách icon/chữ.
  // Đừng đặt display:'flex' ở đây, nó biến nút thành block và làm các nút xuống dòng.
  const iconGap: React.CSSProperties = { gap: 6 };

  /** Bọc trong hàng flex căn phải để các nút luôn nằm ngang, cách đều nhau. */
  const footerRow = (children: React.ReactNode) => (
    <div className="flex flex-wrap justify-end items-center gap-2 w-full">{children}</div>
  );

  const renderFooter = () => {
    if (!detail) return footerRow(<Button variant="outline" onClick={onClose}>Đóng</Button>);

    if (isDraft && isMine && canCreateDraft) {
      return footerRow(
        <>
          <Button variant="danger" onClick={() => setConfirmAction('delete')} disabled={submitting} style={iconGap}>
            <Trash2 size={16} /> Xóa nháp
          </Button>
          {onEditDraft && (
            <Button variant="outline" onClick={() => { onClose(); onEditDraft(detail.directPurchaseId); }} disabled={submitting} style={iconGap}>
              <Pencil size={16} /> Sửa
            </Button>
          )}
          <Button variant="primary" onClick={() => setConfirmAction('submit')} isLoading={submitting} disabled={submitting} style={iconGap}>
            <Send size={16} /> Gửi phiếu
          </Button>
        </>
      );
    }

    if (canDoDirector) {
      return footerRow(
        <>
          <Button variant="danger" onClick={() => handleDirector(false)}
            disabled={submitting || !note.trim()}
            title={!note.trim() ? 'Vui lòng nhập lý do khi từ chối duyệt chi.' : undefined}
            style={iconGap}>
            <XCircle size={16} /> Từ chối duyệt chi
          </Button>
          <Button variant="primary" onClick={() => handleDirector(true)} isLoading={submitting} disabled={submitting} style={iconGap}>
            <CheckCircle size={16} /> Duyệt chi
          </Button>
        </>
      );
    }

    if (canDoAudit) {
      return footerRow(
        <>
          <Button variant="danger" onClick={() => handleAudit(false)}
            disabled={submitting || !note.trim()}
            title={!note.trim() ? 'Vui lòng nhập lý do khi từ chối kiểm toán.' : undefined}
            style={iconGap}>
            <XCircle size={16} /> Từ chối
          </Button>
          <Button variant="primary" onClick={() => handleAudit(true)} isLoading={submitting} disabled={submitting} style={iconGap}>
            <CheckCircle size={16} /> Xác nhận & trình Giám đốc
          </Button>
        </>
      );
    }

    return footerRow(<Button variant="outline" onClick={onClose}>Đóng</Button>);
  };

  const showNoteInput = canDoAudit || canDoDirector;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={detail ? `Chi tiết phiếu ${detail.requestNumber}` : 'Chi tiết phiếu mua khẩn cấp'}
      width="lg"
      mobileFullScreen
      footer={renderFooter()}
    >
      {loading && (
        <LoadingSpinner size="md" label="Đang tải..." className="py-12" />
      )}

      {!loading && detail && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {isDraft && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'hsl(var(--bg-sidebar))', border: '1px dashed hsl(var(--border))', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
              <FileText size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Phiếu đang là <b>bản nháp</b>: chưa gửi, chưa sinh Đơn hàng/Phiếu nhập kho và chưa ảnh hưởng tồn kho.</span>
            </div>
          )}

          {/* Header info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '0.9rem' }}>
            <InfoRow label="Dự án" value={detail.projectName} />
            <InfoRow label="Giai đoạn" value={detail.phaseName} />
            <InfoRow label="Người tạo" value={detail.requesterName} />
            <InfoRow label="Ngày mua" value={formatPlainDate(detail.purchaseDate)} />
            <div>
              {/* Một trục trạng thái duy nhất. Diễn biến chi tiết (ai kiểm toán, ai duyệt chi,
                  ghi chú/lý do) nằm ở khối lịch sử xử lý phía dưới.
                  Không lặp lại trạng thái dự toán ở đây: dòng vật tư vượt dự toán đã có cảnh
                  báo riêng kèm số lượng vượt, cụ thể hơn hẳn một nhãn ở đầu phiếu. */}
              <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>Trạng thái</span>
              <div style={{ marginTop: '2px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Badge variant={statusVariant[detail.status] ?? 'default'}>
                  {DP_STATUS_LABEL[detail.status] ?? detail.status}
                </Badge>
              </div>
            </div>
            <InfoRow label="Tổng tiền" value={formatCurrency(detail.totalAmount)} bold />
            {detail.submittedAt && <InfoRow label="Ngày gửi" value={formatDateOnly(detail.submittedAt)} />}
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
                  <FileText size={13} /> Đơn hàng: {detail.autoPONumber}
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
            <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', overflowX: 'auto' }}>
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
                    <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border))', backgroundColor: it.isOverBOQ ? 'hsl(var(--warning) / 0.08)' : undefined }}>
                      <td style={{ padding: '8px 10px' }}>
                        [{it.materialCode}] {it.materialName}
                        {it.isOverBOQ && (
                          <div style={{ marginTop: 2, fontSize: '0.75rem', color: 'hsl(var(--warning))', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={12} /> {it.explanation ?? 'Vượt dự toán vật tư'}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{it.quantity} {it.unitName}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(it.unitPrice)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(it.lineTotal)}</td>
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
                  <img
                    key={i}
                    src={url}
                    alt={`invoice-${i}`}
                    onClick={() => setLightboxIndex(i)}
                    style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', cursor: 'zoom-in' }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Lịch sử xử lý */}
          {detail.auditorName && (
            <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-sidebar))', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              <div><strong>Kế toán:</strong> {detail.auditorName}{detail.auditedAt ? ` — ${formatDateOnly(detail.auditedAt)}` : ''}</div>
              {detail.auditNote && <div style={{ marginTop: '4px' }}><strong>Ghi chú:</strong> {detail.auditNote}</div>}
            </div>
          )}

          {detail.approverName && (
            <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-sidebar))', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              <div><strong>Giám đốc:</strong> {detail.approverName}{detail.approvedAt ? ` — ${formatDateOnly(detail.approvedAt)}` : ''}</div>
              {detail.approvalNote && <div style={{ marginTop: '4px' }}><strong>Ý kiến:</strong> {detail.approvalNote}</div>}
            </div>
          )}

          {showNoteInput && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'hsl(var(--text-secondary))' }}>
                {canDoDirector ? 'Ý kiến duyệt chi' : 'Ghi chú kiểm toán'}{' '}
                <span style={{ fontWeight: 400, color: 'hsl(var(--text-muted))' }}>(bắt buộc khi từ chối)</span>
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder={canDoDirector ? 'Ý kiến của Giám đốc, lý do từ chối...' : 'Ghi chú đối chiếu hóa đơn, lý do từ chối...'}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          )}
        </div>
      )}
    </Modal>

    <ImageLightbox
      images={detail?.invoicePhotoUrls ?? []}
      index={lightboxIndex}
      onClose={() => setLightboxIndex(null)}
      onIndexChange={setLightboxIndex}
      label="Ảnh hóa đơn"
    />

    <ConfirmDialog
      isOpen={confirmAction !== null}
      onClose={() => setConfirmAction(null)}
      onConfirm={confirmAction === 'delete' ? doDeleteDraft : doSubmitDraft}
      title={confirmAction === 'delete' ? 'Xóa phiếu nháp' : 'Gửi phiếu mua khẩn cấp'}
      message={
        confirmAction === 'delete'
          ? `Xóa phiếu nháp ${detail?.requestNumber ?? ''}? Phiếu chưa gửi nên không ảnh hưởng tồn kho, nhưng nội dung đã soạn sẽ mất.`
          : 'Sau khi gửi, vật tư được nhập kho ngay và phiếu không thể sửa. '
            + 'Khoản chi phải qua Kế toán soát hóa đơn rồi Giám đốc duyệt mới được hoàn tiền.'
      }
      confirmText={confirmAction === 'delete' ? 'Xác nhận xóa' : 'Gửi phiếu'}
      cancelText={confirmAction === 'delete' ? 'Đóng' : 'Xem lại'}
      isDanger={confirmAction === 'delete'}
      isLoading={submitting}
    />
    </>
  );
};

const InfoRow: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
  <div>
    <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>{label}</span>
    <div style={{ marginTop: '2px', fontWeight: bold ? 700 : 500 }}>{value}</div>
  </div>
);
