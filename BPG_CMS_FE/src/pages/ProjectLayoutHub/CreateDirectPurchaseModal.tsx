import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button, ConfirmDialog } from '../../components/ui';
import {
  directPurchaseService,
  type PhaseBOQItemDto,
  type CreateDirectPurchaseItemInput,
} from '../../services/directPurchaseService';
import { materialService } from '../../services/materialService';
import { projectService } from '../../services/projectService';
import type { MaterialCatalog } from '../../types/material';
import type { WBSPhase } from '../../types/common';
import { Plus, Trash2, Upload, X, AlertTriangle, Loader2, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { compressAndUploadFile } from '../../utils/uploadHelper';
import type { UploadedFileState } from '../../utils/uploadHelper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  /** Truyền id để mở ở chế độ sửa phiếu nháp. */
  draftId?: number | null;
}

// Chuyển yyyy-mm-dd (giá trị input date) sang dd-mm-yyyy để hiển thị
const toDisplayDate = (isoDate: string) => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
};

interface ItemRow {
  materialId: number;
  materialName: string;
  materialCode: string;
  quantity: string;
  unitPrice: string;
}

const emptyRow = (): ItemRow => ({
  materialId: 0,
  materialName: '',
  materialCode: '',
  quantity: '',
  unitPrice: '',
});

export const CreateDirectPurchaseModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, projectId, draftId }) => {
  const isEditing = !!draftId;

  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');
  const [boqItems, setBoqItems] = useState<PhaseBOQItemDto[]>([]);
  const [catalog, setCatalog] = useState<MaterialCatalog[]>([]);
  const [loadingBOQ, setLoadingBOQ] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [reason, setReason] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [purchaseDateError, setPurchaseDateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- Nạp dữ liệu nền ----------
  useEffect(() => {
    if (!isOpen) return;
    projectService.getPhases(String(projectId)).then(setPhases).catch(() => setPhases([]));
    materialService
      .getMaterials({ pageNumber: 1, pageSize: 1000 })
      .then(res => setCatalog(res.items ?? []))
      .catch(() => setCatalog([]));

    if (!draftId) {
      setSelectedPhaseId('');
      setBoqItems([]);
      setRows([]);
      setReason('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setUploadedFiles([]);
      setPurchaseDateError(null);
    }
  }, [isOpen, projectId, draftId]);

  // Nạp nội dung phiếu nháp khi mở ở chế độ sửa.
  // Phải chờ danh mục vật tư nạp xong: loadUnitOptions lấy đơn vị cơ bản từ đó,
  // thiếu nó thì ô đơn vị của các dòng đã lưu sẽ hiển thị trống.
  useEffect(() => {
    if (!isOpen || !draftId || catalog.length === 0) return;
    setLoadingDraft(true);
    directPurchaseService
      .getById(draftId)
      .then(async dp => {
        setSelectedPhaseId(String(dp.phaseId));
        setReason(dp.reason);
        setPurchaseDate(new Date(dp.purchaseDate).toISOString().split('T')[0]);
        setUploadedFiles(
          dp.invoicePhotoUrls.map((url, i) => ({
            id: `existing-${i}`,
            name: url.split('/').pop() || `hoa-don-${i + 1}`,
            url,
            status: 'success' as const,
          }))
        );
        setRows(dp.items.map(it => ({
          materialId: it.materialId,
          materialName: it.materialName,
          materialCode: it.materialCode,
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
        })));
      })
      .catch(() => toast.error('Không thể tải phiếu nháp.'))
      .finally(() => setLoadingDraft(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, draftId, catalog.length]);

  useEffect(() => {
    if (!selectedPhaseId) {
      setBoqItems([]);
      return;
    }
    setLoadingBOQ(true);
    directPurchaseService
      .getPhaseBOQ(projectId, Number(selectedPhaseId))
      .then(setBoqItems)
      .catch(() => setBoqItems([]))
      .finally(() => setLoadingBOQ(false));
  }, [selectedPhaseId, projectId]);

  /**
   * Đơn vị tính không do người dùng chọn - suy ra từ vật tư, khớp với backend:
   * đơn vị của dòng BOQ nếu vật tư nằm trong định mức, ngược lại là đơn vị cơ bản.
   */
  const unitNameOf = (materialId: number): string => {
    const boq = boqItems.find(b => b.materialId === materialId);
    if (boq) return boq.unitName;
    return catalog.find(m => m.materialId === materialId)?.baseUnitName ?? '';
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const updateRowMaterial = (i: number, materialId: number) => {
    const material = catalog.find(m => m.materialId === materialId);
    if (!material) return;

    setRows(prev => prev.map((r, idx) => idx === i
      ? { ...r, materialId, materialName: material.name, materialCode: material.code, quantity: '', unitPrice: '' }
      : r));
  };

  const updateRowField = (i: number, field: 'quantity' | 'unitPrice', value: string) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  // ---------- Khoảng ngày mua hợp lệ ----------
  // Phiếu mua trực tiếp là hậu kiểm nên ngày mua không được ở tương lai,
  // đồng thời phải nằm trong khoảng thi công của giai đoạn. Backend chốt lại ở bước Gửi.
  const todayStr = new Date().toISOString().split('T')[0];
  const selectedPhase = phases.find(p => String(p.id) === selectedPhaseId);
  const phaseStart = selectedPhase?.startDate?.split('T')[0];
  const phaseEnd = selectedPhase?.endDate?.split('T')[0];
  const maxPurchaseDate = phaseEnd && phaseEnd < todayStr ? phaseEnd : todayStr;
  const minPurchaseDate = phaseStart;

  const purchaseDateHint = (): string | null => {
    if (!purchaseDate) return null;
    if (purchaseDate > todayStr) return 'Ngày mua không được ở tương lai.';
    if (minPurchaseDate && purchaseDate < minPurchaseDate)
      return `Ngày mua phải từ ${toDisplayDate(minPurchaseDate)} (ngày bắt đầu giai đoạn) trở đi.`;
    if (phaseEnd && purchaseDate > phaseEnd)
      return `Ngày mua vượt quá ngày kết thúc giai đoạn (${toDisplayDate(phaseEnd)}).`;
    return null;
  };
  const dateHint = purchaseDateHint();

  // ---------- Đối chiếu định mức BOQ (chỉ để cảnh báo, backend mới là nơi chốt) ----------
  // Số lượng nhập vào luôn cùng đơn vị với dòng BOQ nên so trực tiếp, không cần quy đổi.
  const rowBoqState = useMemo(() => rows.map(row => {
    if (!row.materialId) return { isOver: false, notInBoq: false, remainingLabel: '-' };

    const boq = boqItems.find(b => b.materialId === row.materialId);
    if (!boq) return { isOver: true, notInBoq: true, remainingLabel: 'Ngoài BOQ' };

    return {
      isOver: (parseFloat(row.quantity) || 0) > boq.remainingQuantity,
      notInBoq: false,
      remainingLabel: `${boq.remainingQuantity} ${boq.unitName}`,
    };
  }), [rows, boqItems]);

  const anyOverBOQ = rowBoqState.some(s => s.isOver);

  // ---------- Ảnh hóa đơn ----------
  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (valid.length < files.length) toast.error('Chỉ hỗ trợ file ảnh (jpg, png, ...)');
    if (!valid.length) return;

    valid.forEach(file => {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);

      setUploadedFiles(prev => [...prev, { id: tempId, name: file.name, url: localUrl, status: 'uploading' }]);

      compressAndUploadFile(
        file,
        'direct-purchases/invoices',
        uploadedUrl => {
          setUploadedFiles(prev => prev.map(f => (f.id === tempId ? { ...f, status: 'success', url: uploadedUrl } : f)));
        },
        () => {
          toast.error(`Không thể tải hóa đơn ${file.name} lên.`);
          setUploadedFiles(prev => prev.map(f => (f.id === tempId ? { ...f, status: 'error' } : f)));
        }
      );
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target?.url?.startsWith('blob:')) URL.revokeObjectURL(target.url);
      return prev.filter(f => f.id !== id);
    });
  };

  // ---------- Validate ----------
  /** Nháp chỉ cần đủ thông tin để lưu; phần còn lại backend chốt ở bước Gửi. */
  const validateDraft = (): string | null => {
    if (!selectedPhaseId) return 'Vui lòng chọn giai đoạn.';
    if (!purchaseDate) return 'Vui lòng chọn ngày mua.';
    const filled = rows.filter(r => r.materialId);
    const dupe = filled.find((r, i) => filled.findIndex(x => x.materialId === r.materialId) !== i);
    if (dupe) return `Vật tư "${dupe.materialName}" bị trùng lặp.`;
    return null;
  };

  const validateSubmit = (): string | null => {
    const draftErr = validateDraft();
    if (draftErr) return draftErr;
    if (dateHint) return dateHint;
    if (!reason.trim()) return 'Vui lòng nhập lý do mua khẩn cấp.';
    if (uploadedFiles.length === 0) return 'Bắt buộc phải tải ảnh hóa đơn.';
    if (rows.length === 0) return 'Vui lòng thêm ít nhất một vật tư.';
    for (const r of rows) {
      if (!r.materialId) return 'Vui lòng chọn vật tư cho tất cả các dòng.';
      const qty = parseFloat(r.quantity);
      if (!qty || qty <= 0) return `Số lượng không hợp lệ cho vật tư "${r.materialName}".`;
      const price = parseFloat(r.unitPrice);
      if (!price || price <= 0) return `Đơn giá không hợp lệ cho vật tư "${r.materialName}".`;
    }
    return null;
  };

  const buildItems = (): CreateDirectPurchaseItemInput[] =>
    rows
      .filter(r => r.materialId)
      .map(r => ({
        materialId: r.materialId,
        quantity: parseFloat(r.quantity) || 0,
        unitPrice: parseFloat(r.unitPrice) || 0,
      }));

  const invoiceUrls = () =>
    uploadedFiles.filter(f => f.status === 'success' && f.url).map(f => f.url!);

  const persist = async (): Promise<number> => {
    const payloadBody = {
      phaseId: Number(selectedPhaseId),
      reason: reason.trim(),
      purchaseDate: new Date(purchaseDate).toISOString(),
      items: buildItems(),
      invoicePhotoUrls: invoiceUrls(),
    };

    if (isEditing) {
      await directPurchaseService.updateDraft(draftId!, payloadBody);
      return draftId!;
    }
    const created = await directPurchaseService.create({ projectId, ...payloadBody });
    return created.directPurchaseId;
  };

  const handleSaveDraft = async () => {
    setPurchaseDateError(null);
    const err = validateDraft();
    if (err) { toast.error(err); return; }
    if (uploadedFiles.some(f => f.status === 'uploading')) {
      toast.error('Vui lòng chờ hình ảnh hóa đơn tải lên hoàn tất.');
      return;
    }

    setSaving('draft');
    try {
      await persist();
      toast.success('Đã lưu nháp. Phiếu chưa được gửi và chưa ảnh hưởng tồn kho.');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Không thể lưu phiếu nháp.');
    } finally {
      setSaving(null);
    }
  };

  /** Kiểm tra hợp lệ rồi mở hộp xác nhận - việc gửi thực sự nằm ở doSubmit. */
  const handleSubmit = () => {
    setPurchaseDateError(null);
    const err = validateSubmit();
    if (err) { toast.error(err); return; }

    if (uploadedFiles.some(f => f.status === 'uploading')) {
      toast.error('Vui lòng chờ hình ảnh hóa đơn tải lên hoàn tất.');
      return;
    }
    if (uploadedFiles.some(f => f.status === 'error' || !f.url?.startsWith('http'))) {
      toast.error('Không thể tải ảnh lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.');
      return;
    }

    setIsConfirmOpen(true);
  };

  const doSubmit = async () => {
    setSaving('submit');
    try {
      const id = await persist();
      await directPurchaseService.submit(id);
      toast.success(
        anyOverBOQ
          ? 'Đã gửi phiếu. Tồn kho đã được cập nhật, phiếu đang chờ Kế toán soát hóa đơn.'
          : 'Đã gửi phiếu. Tồn kho đã được cập nhật, phiếu đang chờ Kế toán kiểm toán.'
      );
      setIsConfirmOpen(false);
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e.message || 'Không thể gửi phiếu mua trực tiếp.';
      setIsConfirmOpen(false);
      toast.error(msg);
      if (msg.includes('Ngày mua')) setPurchaseDateError(msg);
    } finally {
      setSaving(null);
    }
  };

  const totalAmount = rows.reduce((sum, r) => {
    const qty = parseFloat(r.quantity) || 0;
    const price = parseFloat(r.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const usedMaterialIds = rows.map(r => r.materialId).filter(Boolean);
  const busy = saving !== null;

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px',
    color: 'hsl(var(--text-secondary))',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))',
    borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))',
    color: 'hsl(var(--text-primary))', fontSize: '0.9rem',
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title={isEditing ? 'Sửa phiếu mua khẩn cấp (nháp)' : 'Tạo phiếu mua khẩn cấp'}
      width="xl"
      footer={
        <div className="flex flex-wrap justify-end items-center gap-2 w-full">
          <Button variant="outline" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button variant="outline" onClick={handleSaveDraft} isLoading={saving === 'draft'} disabled={busy}>
            Lưu nháp
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={saving === 'submit'} disabled={busy}>
            Gửi phiếu
          </Button>
        </div>
      }
    >
      {loadingDraft ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} /> Đang tải phiếu nháp...
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Info banner */}
        <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', backgroundColor: 'hsl(var(--warning) / 0.1)', border: '1px solid hsl(var(--warning) / 0.3)', borderRadius: 'var(--radius-sm)', color: 'hsl(var(--warning))', fontSize: '0.85rem' }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            <b>Lưu nháp</b> chỉ lưu lại, chưa ảnh hưởng gì. <b>Gửi phiếu</b> sẽ sinh Đơn hàng + Phiếu nhập kho và
            cộng tồn kho ngay để thợ dùng — sau đó không sửa được nữa.
            Được phép mua vượt định mức BOQ, nhưng khoản chi sẽ phải qua Kế toán soát hóa đơn rồi Giám đốc duyệt.
          </span>
        </div>

        {/* Row 1: Phase + Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>
              Giai đoạn <span style={{ color: 'hsl(var(--danger))' }}>*</span>
            </label>
            <select value={selectedPhaseId} onChange={e => setSelectedPhaseId(e.target.value)} style={inputStyle}>
              <option value="">-- Chọn giai đoạn --</option>
              {phases.map(ph => (
                <option key={ph.id} value={ph.id}>{ph.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              Ngày mua <span style={{ color: 'hsl(var(--danger))' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                value={purchaseDate}
                min={minPurchaseDate}
                max={maxPurchaseDate}
                onChange={e => { setPurchaseDate(e.target.value); setPurchaseDateError(null); }}
                style={{ ...inputStyle, border: `1px solid ${(purchaseDateError || dateHint) ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`, color: 'transparent' }}
              />
              <span
                style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: '0.9rem', pointerEvents: 'none',
                  color: purchaseDate ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))',
                }}
              >
                {purchaseDate ? toDisplayDate(purchaseDate) : 'dd-mm-yyyy'}
              </span>
            </div>
            {(purchaseDateError || dateHint) && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{purchaseDateError || dateHint}</p>
            )}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label style={labelStyle}>
            Lý do mua khẩn cấp <span style={{ color: 'hsl(var(--danger))' }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder="Mô tả ngắn gọn lý do cần mua ngoài gấp..."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* Material rows */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
              Danh sách vật tư <span style={{ color: 'hsl(var(--danger))' }}>*</span>
            </label>
            {selectedPhaseId && !loadingBOQ && (
              <Button variant="outline" onClick={addRow} style={{ padding: '4px 10px', fontSize: '0.8rem', gap: '4px' }}>
                <Plus size={14} /> Thêm vật tư
              </Button>
            )}
          </div>

          {!selectedPhaseId && (
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '20px 0' }}>
              Chọn giai đoạn để bắt đầu thêm vật tư.
            </p>
          )}

          {loadingBOQ && (
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '20px 0' }}>Đang tải định mức BOQ...</p>
          )}

          {rows.length > 0 && (
            <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '760px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'hsl(var(--bg-sidebar))', borderBottom: '1px solid hsl(var(--border))' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Vật tư</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Đơn vị</th>
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
                    const state = rowBoqState[i];
                    const qtyNegative = row.quantity !== '' && qty <= 0;
                    const priceNegative = row.unitPrice !== '' && price <= 0;
                    const warn = state.isOver && qty > 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border))', backgroundColor: (qtyNegative || priceNegative) ? 'hsl(var(--danger-glow))' : warn ? 'hsl(var(--warning) / 0.08)' : undefined }}>
                        <td style={{ padding: '8px 10px', minWidth: '220px' }}>
                          <select
                            value={row.materialId || ''}
                            onChange={e => updateRowMaterial(i, Number(e.target.value))}
                            style={{ ...inputStyle, padding: '4px 6px', fontSize: '0.85rem' }}
                          >
                            <option value="">-- Chọn --</option>
                            {catalog
                              .filter(m => m.materialId === row.materialId || !usedMaterialIds.includes(m.materialId))
                              .map(m => {
                                const inBoq = boqItems.some(b => b.materialId === m.materialId);
                                return (
                                  <option key={m.materialId} value={m.materialId}>
                                    [{m.code}] {m.name}{inBoq ? '' : ' — ngoài BOQ'}
                                  </option>
                                );
                              })}
                          </select>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap' }}>
                          {row.materialId ? (unitNameOf(row.materialId) || '-') : '-'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: state.notInBoq ? 'hsl(var(--warning))' : 'hsl(var(--text-secondary))', whiteSpace: 'nowrap' }}>
                          {state.remainingLabel}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            className="dp-no-spinner"
                            value={row.quantity}
                            onChange={e => updateRowField(i, 'quantity', e.target.value)}
                            placeholder="0"
                            style={{ width: '80px', padding: '4px 6px', border: `1px solid ${qtyNegative ? 'hsl(var(--danger))' : warn ? 'hsl(var(--warning))' : 'hsl(var(--border))'}`, borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                          {qtyNegative && (
                            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'hsl(var(--danger))' }}>
                              Số lượng phải lớn hơn 0
                            </div>
                          )}
                          {!qtyNegative && warn && (
                            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'hsl(var(--warning))' }}>
                              {state.notInBoq ? 'Vật tư ngoài định mức BOQ' : `Vượt định mức (còn ${state.remainingLabel})`}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="dp-no-spinner"
                            value={row.unitPrice}
                            onChange={e => updateRowField(i, 'unitPrice', e.target.value)}
                            placeholder="0"
                            style={{ width: '110px', padding: '4px 6px', border: `1px solid ${priceNegative ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`, borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                          {priceNegative && (
                            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'hsl(var(--danger))' }}>
                              Đơn giá phải lớn hơn 0
                            </div>
                          )}
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

        {/* Cảnh báo vượt định mức. Không có ô giải trình riêng - ô "Lý do mua khẩn cấp" ở trên
            đã đóng vai trò giải trình cho Kế toán và Giám đốc. */}
        {anyOverBOQ && (
          <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', backgroundColor: 'hsl(var(--warning) / 0.12)', border: '1px solid hsl(var(--warning) / 0.35)', borderRadius: 'var(--radius-sm)', color: 'hsl(var(--warning))', fontSize: '0.85rem' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>
              Phiếu này vượt định mức BOQ. Vật tư vẫn được nhập kho ngay khi gửi, nhưng khoản chi phải
              qua <b>Kế toán soát hóa đơn</b> rồi <b>Giám đốc duyệt chi</b> mới được hoàn tiền.
              Hãy nêu rõ lý do ở ô <b>Lý do mua khẩn cấp</b> để cấp duyệt có căn cứ.
            </span>
          </div>
        )}

        {/* Invoice photo upload */}
        <div>
          <label style={labelStyle}>
            Ảnh hóa đơn <span style={{ color: 'hsl(var(--danger))' }}>*</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
            {uploadedFiles.map(file => (
              <div key={file.id} style={{ position: 'relative', width: '80px', height: '80px' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: file.status === 'error' ? '1px solid #dc2626' : file.status === 'success' ? '1px solid #16a34a' : '1px solid hsl(var(--border))' }}>
                  <img src={file.url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                  {file.status === 'uploading' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={16} className="animate-spin" style={{ color: '#fff' }} />
                    </div>
                  )}

                  {file.status === 'error' && (
                    <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#dc2626', color: '#fff', fontSize: '8px', textAlign: 'center', padding: '1px 0', fontWeight: 'bold' }}>Lỗi</span>
                  )}
                </div>

                <button
                  onClick={() => removeFile(file.id)}
                  style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'hsl(var(--danger))', border: 'none', borderRadius: '50%', cursor: 'pointer', color: 'white', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
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
      )}
      <style>{`
        .dp-no-spinner::-webkit-outer-spin-button,
        .dp-no-spinner::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .dp-no-spinner {
          -moz-appearance: textfield;
        }
      `}</style>
    </Modal>

    <ConfirmDialog
      isOpen={isConfirmOpen}
      onClose={() => setIsConfirmOpen(false)}
      onConfirm={doSubmit}
      title={anyOverBOQ ? 'Gửi phiếu vượt định mức BOQ' : 'Gửi phiếu mua khẩn cấp'}
      message={
        anyOverBOQ
          ? 'Sau khi gửi, vật tư được nhập kho ngay và phiếu không thể sửa. '
            + 'Vì phiếu vượt định mức BOQ, khoản chi phải qua Kế toán soát hóa đơn rồi Giám đốc duyệt mới được hoàn tiền.'
          : 'Sau khi gửi, vật tư được nhập kho ngay và phiếu không thể sửa. '
            + 'Phiếu sẽ chuyển sang Kế toán kiểm toán để hoàn tiền.'
      }
      confirmText="Gửi phiếu"
      cancelText="Xem lại"
      isDanger={anyOverBOQ}
      isLoading={saving === 'submit'}
    />
    </>
  );
};
