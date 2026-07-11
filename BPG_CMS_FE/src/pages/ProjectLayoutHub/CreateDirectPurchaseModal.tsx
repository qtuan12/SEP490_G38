import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui';
import { directPurchaseService, type PhaseBOQItemDto } from '../../services/directPurchaseService';
import { projectService } from '../../services/projectService';
import type { WBSPhase } from '../../types/common';
import { Plus, Trash2, Upload, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
}

interface ItemRow {
  materialId: number;
  materialName: string;
  materialCode: string;
  unitName: string;
  remainingQty: number;
  quantity: string;
  unitPrice: string;
}

export const CreateDirectPurchaseModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, projectId }) => {
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');
  const [boqItems, setBoqItems] = useState<PhaseBOQItemDto[]>([]);
  const [loadingBOQ, setLoadingBOQ] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [reason, setReason] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [invoicePreviews, setInvoicePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseDateError, setPurchaseDateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    projectService.getPhases(String(projectId)).then(setPhases).catch(() => setPhases([]));
    setSelectedPhaseId('');
    setBoqItems([]);
    setRows([]);
    setReason('');
    setInvoiceFiles([]);
    setInvoicePreviews([]);
  }, [isOpen, projectId]);

  useEffect(() => {
    if (!selectedPhaseId) {
      setBoqItems([]);
      setRows([]);
      return;
    }
    setLoadingBOQ(true);
    directPurchaseService.getPhaseBOQ(projectId, Number(selectedPhaseId))
      .then(items => {
        setBoqItems(items.filter(i => i.remainingQuantity > 0));
      })
      .catch(() => setBoqItems([]))
      .finally(() => setLoadingBOQ(false));
    setRows([]);
  }, [selectedPhaseId, projectId]);

  const addRow = () => {
    setRows(prev => [...prev, { materialId: 0, materialName: '', materialCode: '', unitName: '', remainingQty: 0, quantity: '', unitPrice: '' }]);
  };

  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const updateRowMaterial = (i: number, materialId: number) => {
    const boq = boqItems.find(b => b.materialId === materialId);
    if (!boq) return;
    setRows(prev => prev.map((r, idx) => idx === i
      ? { ...r, materialId: boq.materialId, materialName: boq.materialName, materialCode: boq.materialCode, unitName: boq.unitName, remainingQty: boq.remainingQuantity, quantity: '', unitPrice: '' }
      : r
    ));
  };

  const updateRowField = (i: number, field: 'quantity' | 'unitPrice', value: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (valid.length < files.length) toast.error('Chỉ hỗ trợ file ảnh (jpg, png, ...)');
    const newFiles = [...invoiceFiles, ...valid];
    setInvoiceFiles(newFiles);
    setInvoicePreviews(newFiles.map(f => URL.createObjectURL(f)));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (i: number) => {
    const newFiles = invoiceFiles.filter((_, idx) => idx !== i);
    setInvoiceFiles(newFiles);
    setInvoicePreviews(newFiles.map(f => URL.createObjectURL(f)));
  };

  const validate = (): string | null => {
    if (!selectedPhaseId) return 'Vui lòng chọn giai đoạn.';
    if (!purchaseDate) return 'Vui lòng chọn ngày mua.';
    if (invoiceFiles.length === 0) return 'Bắt buộc phải tải ảnh hóa đơn.';
    if (rows.length === 0) return 'Vui lòng thêm ít nhất một vật tư.';
    for (const r of rows) {
      if (!r.materialId) return 'Vui lòng chọn vật tư cho tất cả các dòng.';
      const qty = parseFloat(r.quantity);
      if (!qty || qty <= 0) return `Số lượng không hợp lệ cho vật tư "${r.materialName}".`;
      if (qty > r.remainingQty) return `Vật tư "${r.materialName}" vượt định mức BOQ (còn được phép: ${r.remainingQty} ${r.unitName}).`;
      const price = parseFloat(r.unitPrice);
      if (!price || price <= 0) return `Đơn giá không hợp lệ cho vật tư "${r.materialName}".`;
    }
    const dupe = rows.find((r, i) => rows.findIndex(x => x.materialId === r.materialId) !== i);
    if (dupe) return `Vật tư "${dupe.materialName}" bị trùng lặp.`;
    return null;
  };

  const handleSubmit = async () => {
    setPurchaseDateError(null);
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const urls = await projectService.uploadFiles(invoiceFiles, 'direct-purchases/invoices');
      await directPurchaseService.create({
        projectId,
        phaseId: Number(selectedPhaseId),
        reason: reason.trim(),
        purchaseDate: new Date(purchaseDate).toISOString(),
        items: rows.map(r => ({
          materialId: r.materialId,
          quantity: parseFloat(r.quantity),
          unitPrice: parseFloat(r.unitPrice),
        })),
        invoicePhotoUrls: urls,
      });
      toast.success('Tạo phiếu mua khẩn cấp thành công! Tồn kho đã được cập nhật.');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Tạo phiếu thất bại.';
      toast.error(msg, { position: 'top-center' });
      if (msg.includes('Ngày mua')) {
        setPurchaseDateError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = rows.reduce((sum, r) => {
    const qty = parseFloat(r.quantity) || 0;
    const price = parseFloat(r.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const usedMaterialIds = rows.map(r => r.materialId).filter(Boolean);
  const availableForNew = boqItems.filter(b => !usedMaterialIds.includes(b.materialId));

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title="Tạo phiếu mua khẩn cấp"
      width="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={submitting} disabled={submitting}>
            Xác nhận & Tạo phiếu
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Info banner */}
        <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', backgroundColor: 'hsl(var(--warning) / 0.1)', border: '1px solid hsl(var(--warning) / 0.3)', borderRadius: 'var(--radius-sm)', color: 'hsl(var(--warning))', fontSize: '0.85rem' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>Hệ thống sẽ tự động sinh Đơn hàng và Phiếu nhập kho. Tồn kho ảo tăng ngay để thợ sử dụng. Chỉ áp dụng vật tư trong định mức BOQ.</span>
        </div>

        {/* Row 1: Phase + Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'hsl(var(--text-secondary))' }}>
              Giai đoạn <span style={{ color: 'hsl(var(--danger))' }}>*</span>
            </label>
            <select
              value={selectedPhaseId}
              onChange={e => setSelectedPhaseId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.9rem' }}
            >
              <option value="">-- Chọn giai đoạn --</option>
              {phases.map(ph => (
                <option key={ph.id} value={ph.id}>{ph.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'hsl(var(--text-secondary))' }}>
              Ngày mua <span style={{ color: 'hsl(var(--danger))' }}>*</span>
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={e => { setPurchaseDate(e.target.value); setPurchaseDateError(null); }}
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${purchaseDateError ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`, borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.9rem' }}
            />
            {purchaseDateError && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{purchaseDateError}</p>
            )}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'hsl(var(--text-secondary))' }}>
            Lý do mua khẩn cấp
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder="Mô tả ngắn gọn lý do cần mua ngoài gấp..."
            style={{ width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* Material rows */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
              Danh sách vật tư <span style={{ color: 'hsl(var(--danger))' }}>*</span>
            </label>
            {selectedPhaseId && !loadingBOQ && (
              <Button variant="outline" onClick={addRow} disabled={availableForNew.length === 0} style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} /> Thêm vật tư
              </Button>
            )}
          </div>

          {!selectedPhaseId && (
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '20px 0' }}>Chọn giai đoạn để xem danh sách vật tư BOQ.</p>
          )}

          {loadingBOQ && (
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '20px 0' }}>Đang tải định mức BOQ...</p>
          )}

          {selectedPhaseId && !loadingBOQ && boqItems.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--warning))', textAlign: 'center', padding: '20px 0' }}>
              Giai đoạn này không còn định mức BOQ nào khả dụng.
            </p>
          )}

          {rows.length > 0 && (
            <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'hsl(var(--bg-sidebar))', borderBottom: '1px solid hsl(var(--border))' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Vật tư</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>Còn lại (BOQ)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>Số lượng</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>Đơn giá (VNĐ)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>Thành tiền</th>
                    <th style={{ width: '36px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const qty = parseFloat(row.quantity) || 0;
                    const price = parseFloat(row.unitPrice) || 0;
                    const lineTotal = qty * price;
                    const exceeds = row.materialId > 0 && qty > row.remainingQty;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border))', backgroundColor: exceeds ? 'hsl(var(--danger-glow))' : undefined }}>
                        <td style={{ padding: '8px 10px' }}>
                          <select
                            value={row.materialId || ''}
                            onChange={e => updateRowMaterial(i, Number(e.target.value))}
                            style={{ width: '100%', padding: '4px 6px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.85rem' }}
                          >
                            <option value="">-- Chọn --</option>
                            {boqItems
                              .filter(b => b.materialId === row.materialId || !usedMaterialIds.includes(b.materialId))
                              .map(b => (
                                <option key={b.materialId} value={b.materialId}>
                                  [{b.materialCode}] {b.materialName}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'hsl(var(--text-secondary))' }}>
                          {row.materialId > 0 ? `${row.remainingQty} ${row.unitName}` : '-'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={row.quantity}
                            onChange={e => updateRowField(i, 'quantity', e.target.value)}
                            placeholder="0"
                            style={{ width: '80px', padding: '4px 6px', border: `1px solid ${exceeds ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`, borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                          {row.materialId > 0 && <span style={{ marginLeft: '4px', color: 'hsl(var(--text-muted))' }}>{row.unitName}</span>}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={row.unitPrice}
                            onChange={e => updateRowField(i, 'unitPrice', e.target.value)}
                            placeholder="0"
                            style={{ width: '110px', padding: '4px 6px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {lineTotal > 0 ? lineTotal.toLocaleString('vi-VN') + ' ₫' : '-'}
                        </td>
                        <td style={{ padding: '4px' }}>
                          <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--danger))', padding: '4px' }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {totalAmount > 0 && (
                <div style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--bg-sidebar))' }}>
                  Tổng cộng: {totalAmount.toLocaleString('vi-VN')} ₫
                </div>
              )}
            </div>
          )}
        </div>

        {/* Invoice photo upload */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'hsl(var(--text-secondary))' }}>
            Ảnh hóa đơn <span style={{ color: 'hsl(var(--danger))' }}>*</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
            {invoicePreviews.map((url, i) => (
              <div key={i} style={{ position: 'relative', width: '80px', height: '80px' }}>
                <img src={url} alt={`invoice-${i}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }} />
                <button
                  onClick={() => removeFile(i)}
                  style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'hsl(var(--danger))', border: 'none', borderRadius: '50%', cursor: 'pointer', color: 'white', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '80px', height: '80px', border: '2px dashed hsl(var(--border))', borderRadius: 'var(--radius-sm)', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}
            >
              <Upload size={16} />
              <span>Tải ảnh</span>
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFilesChange} />
        </div>

      </div>
    </Modal>
  );
};
