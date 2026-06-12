import React, { useState } from 'react';
import { Modal } from './Modal';
import { projectService } from '../services/projectService';
import type { WBSTask, WBSPhase, MaterialRequest } from '../services/projectService';

// ─── CREATE MATERIAL REQUEST MODAL (STEP 5) ───
export interface CreateMaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: WBSTask;
  phase?: WBSPhase;
  projectId: string;
  user: any;
  isLeader?: boolean;
  allMaterialRequests: MaterialRequest[];
  requestType: 'normal' | 'emergency';
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const CreateMaterialRequestModal: React.FC<CreateMaterialRequestModalProps> = ({
  isOpen,
  onClose,
  task,
  phase,
  projectId,
  user,
  isLeader,
  allMaterialRequests,
  onSuccess,
  onError,
  requestType
}) => {
  const type = requestType;
  const [reason, setReason] = useState('');
  const [invoiceImage, setInvoiceImage] = useState('');
  const [items, setItems] = useState<{ name: string; quantity: number; unit: string }[]>([
    { name: '', quantity: 1, unit: '' }
  ]);
  const [saving, setSaving] = useState(false);

  // Tính tổng số lượng vật tư Phase đã yêu cầu
  const phaseRequestedMaterials = React.useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; unit: string }>();
    allMaterialRequests.forEach(r => {
      if (r.phaseId === phase?.id && !r.taskId && r.status !== 'rejected') {
        r.items.forEach(item => {
          const existing = map.get(item.name);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            map.set(item.name, { ...item });
          }
        });
      }
    });
    return Array.from(map.values());
  }, [allMaterialRequests, phase?.id]);

  // Nguồn vật tư gốc để chọn (Task lấy từ Phase, Phase lấy từ BOQ)
  const sourceMaterials = task ? phaseRequestedMaterials : (phase?.materials || []);

  // Tính tổng số lượng đã được dùng/yêu cầu
  const getUsedQuantity = (materialName: string) => {
    let sum = 0;
    allMaterialRequests.forEach(r => {
      if (r.phaseId === phase?.id && r.status !== 'rejected') {
        if (task) {
          // Task chỉ tính những vật tư đã được các Task khác yêu cầu
          if (r.taskId) {
            const item = r.items.find(i => i.name === materialName);
            if (item) sum += item.quantity;
          }
        } else {
          // Phase chỉ tính những vật tư đã được Phase yêu cầu
          if (!r.taskId) {
            const item = r.items.find(i => i.name === materialName);
            if (item) sum += item.quantity;
          }
        }
      }
    });
    return sum;
  };

  const checkIsOverBOQ = () => {
    for (const it of items) {
      if (!it.name) continue;
      const sourceItem = sourceMaterials.find(m => m.name === it.name);
      const limit = sourceItem ? sourceItem.quantity : 0;
      const used = getUsedQuantity(it.name);
      if (used + it.quantity > limit) {
        return true;
      }
    }
    return false;
  };

  const isOverBOQ = checkIsOverBOQ();

  const handleAddItem = () => {
    setItems([...items, { name: '', quantity: 1, unit: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof typeof items[0], value: string | number) => {
    const updated = [...items];
    const targetItem = updated[index];
    (targetItem as any)[field] = value;
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(it => !it.name.trim() || !it.unit.trim() || it.quantity <= 0)) {
      alert('Vui lòng điền đầy đủ thông tin tên vật tư, đơn vị và số lượng (> 0).');
      return;
    }
    if (type === 'emergency' && !invoiceImage.trim()) {
      alert('Mua ngoài khẩn cấp bắt buộc phải tải ảnh hóa đơn.');
      return;
    }
    if (isOverBOQ && !reason.trim()) {
      alert('Yêu cầu VƯỢT ĐỊNH MỨC bắt buộc phải nhập Lý do giải trình!');
      return;
    }

    setSaving(true);
    try {
      await projectService.createMaterialRequest({
        projectId,
        taskId: task?.id,
        taskName: task?.name,
        phaseId: phase?.id,
        phaseName: phase?.name,
        requesterName: user?.name || 'PL',
        items: items.map(it => ({ name: it.name, quantity: it.quantity, unit: it.unit })),
        type,
        invoiceImage: type === 'emergency' ? invoiceImage.trim() : undefined,
        reason: reason.trim() || undefined,
        isOverBOQ: isOverBOQ
      }, user?.role, isLeader);
      onSuccess(type === 'emergency'
        ? 'Đã lập phiếu mua ngoài khẩn cấp! Hệ thống tự động sinh PO & Phiếu nhập kho, tăng tồn kho ảo tức thì.'
        : (isOverBOQ ? 'Đã gửi yêu cầu vật tư VƯỢT ĐỊNH MỨC (Chờ Giám đốc).' : 'Đã gửi yêu cầu vật tư (Chờ Kế toán).')
      );
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi tạo yêu cầu vật tư.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? "Đề xuất Vật tư cho Công việc" : "Yêu cầu Vật tư cho Phase"}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
        <div style={{ fontSize: '0.85rem', backgroundColor: 'hsl(var(--primary-glow))', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
          {task ? (
            <span>Công việc: <strong>{task.name}</strong></span>
          ) : (
            <span>Giai đoạn (Phase): <strong>{phase?.name}</strong></span>
          )}
        </div>

        {/* Hiển thị loại yêu cầu tĩnh */}
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Hình thức yêu cầu:</label>
          <div style={{ marginTop: '4px', fontSize: '0.9rem', color: type === 'emergency' ? 'hsl(var(--warning-hover))' : 'hsl(var(--primary))' }}>
            {type === 'normal' ? 'Yêu cầu thông thường (Chờ Kế toán)' : 'Mua ngoài khẩn cấp (Direct Purchase - Chờ Kế toán duyệt)'}
          </div>
        </div>

        {isOverBOQ ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--danger))' }}>
              ⚠️ TỔNG YÊU CẦU VƯỢT ĐỊNH MỨC BOQ. Bắt buộc giải trình lý do và phải chờ Giám đốc duyệt.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: 'hsl(var(--success-glow))', border: '1px solid hsl(var(--success) / 0.3)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--success))' }}>
              ✅ Các vật tư yêu cầu nằm trong định mức {task ? 'của Phase' : 'cho phép'}. Sau khi được duyệt sẽ cấp phát cho công trường.
            </span>
          </div>
        )}

        {/* Dynamic Items List */}
        <div>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span>Danh sách vật tư yêu cầu <span style={{ color: 'hsl(var(--danger))' }}>*</span></span>
            <button type="button" onClick={handleAddItem} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
              + Thêm vật tư
            </button>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                  {sourceMaterials.length > 0 ? (
                    <select
                      value={item.name}
                      onChange={e => {
                        const selName = e.target.value;
                        const selSource = sourceMaterials.find(m => m.name === selName);
                        handleItemChange(idx, 'name', selName);
                        if (selSource) handleItemChange(idx, 'unit', selSource.unit);
                      }}
                      required
                      style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                    >
                      <option value="" disabled>-- Chọn vật tư ({task ? 'Từ Phase' : 'BOQ'}) --</option>
                      {sourceMaterials.map(sm => (
                        <option key={sm.name} value={sm.name}>{sm.name} (Max: {sm.quantity} {sm.unit})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Tên vật tư..."
                      value={item.name}
                      onChange={e => handleItemChange(idx, 'name', e.target.value)}
                      required
                      style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                    />
                  )}
                  <input
                    type="number"
                    min={1}
                    placeholder="SL"
                    value={item.quantity}
                    onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                    required
                    style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid hsl(var(--border))`, backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                  />
                  <input
                    type="text"
                    placeholder="ĐVT"
                    value={item.unit}
                    onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                    required
                    disabled={sourceMaterials.length > 0}
                    style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                  />
                  <button
                    type="button"
                    disabled={items.length === 1}
                    onClick={() => handleRemoveItem(idx)}
                    className="btn"
                    style={{ padding: '4px', backgroundColor: 'transparent', color: 'hsl(var(--danger))', cursor: items.length === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    X
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {type === 'emergency' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="invoice-url">Hình ảnh hóa đơn mua ngoài bắt buộc <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input
              id="invoice-url"
              type="text"
              placeholder="https://example.com/invoice.jpg"
              value={invoiceImage}
              onChange={e => setInvoiceImage(e.target.value)}
              required
              style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '4px' }}>
              * Hệ thống sẽ tự động đối chiếu, tăng tồn kho ảo lập tức để thợ sử dụng tại công trường.
            </span>
          </div>
        )}

        <div>
          <label htmlFor="req-reason">Lý do yêu cầu / Giải trình</label>
          <textarea
            id="req-reason"
            placeholder="Nêu lý do hao hụt, hư hỏng hoặc sự cần thiết..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', width: '100%', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Đang gửi...' : type === 'emergency' ? 'Nhập kho khẩn cấp' : 'Gửi yêu cầu'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ─── RESUBMIT MATERIAL REQUEST MODAL ───
export interface ResubmitMaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: MaterialRequest;
  projectId: string;
  user: any;
  isLeader?: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const ResubmitMaterialRequestModal: React.FC<ResubmitMaterialRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  user,
  isLeader,
  onSuccess,
  onError
}) => {
  const [type, setType] = useState<'normal' | 'emergency'>(request.type || 'normal');
  const [reason, setReason] = useState(request.reason || '');
  const [invoiceImage, setInvoiceImage] = useState(request.invoiceImage || '');
  const [isOverBOQ, setIsOverBOQ] = useState(request.isOverBOQ || false);
  const [items, setItems] = useState<{ name: string; quantity: number; unit: string }[]>(
    request.items.map(it => ({ name: it.name, quantity: it.quantity, unit: it.unit }))
  );
  const [saving, setSaving] = useState(false);

  const handleAddItem = () => {
    setItems([...items, { name: '', quantity: 1, unit: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof typeof items[0], value: string | number) => {
    const updated = [...items];
    const targetItem = updated[index];
    (targetItem as any)[field] = value;
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.some(it => !it.name.trim() || !it.unit.trim() || it.quantity <= 0)) {
      alert('Vui lòng điền đầy đủ thông tin tên vật tư, đơn vị và số lượng (> 0).');
      return;
    }
    if (type === 'emergency' && !invoiceImage.trim()) {
      alert('Mua ngoài khẩn cấp bắt buộc phải tải ảnh hóa đơn.');
      return;
    }

    setSaving(true);
    try {
      await projectService.resubmitMaterialRequest(request.id, {
        items: items.map(it => ({ name: it.name.trim(), quantity: it.quantity, unit: it.unit })),
        type,
        invoiceImage: type === 'emergency' ? invoiceImage.trim() : undefined,
        reason: reason.trim() || undefined,
        isOverBOQ
      }, user?.role, isLeader);
      onSuccess(type === 'emergency'
        ? 'Đã gửi lại yêu cầu mua ngoài khẩn cấp! Hệ thống tự động sinh PO & Phiếu nhập kho, tăng tồn kho ảo tức thì.'
        : 'Đã gửi lại yêu cầu cấp vật tư.'
      );
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi gửi lại yêu cầu vật tư.');
    } finally {
      setSaving(false);
    }
  };

  const isPhaseRequest = !!request.phaseId && !request.taskId;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sửa & Gửi lại Yêu cầu cấp Vật tư">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
        <div style={{ fontSize: '0.85rem', backgroundColor: 'hsl(var(--danger-glow))', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--danger) / 0.2)' }}>
          Lý do từ chối trước đó: <strong>{request.rejectionReason || 'Không có'}</strong>
        </div>

        <div style={{ fontSize: '0.85rem', backgroundColor: 'hsl(var(--primary-glow))', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
          {isPhaseRequest ? (
            <span>Giai đoạn: <strong>{request.phaseName}</strong></span>
          ) : (
            <span>Công việc: <strong>{request.taskName}</strong></span>
          )}
        </div>

        {!isPhaseRequest && (
          <div>
            <label>Hình thức yêu cầu</label>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'normal', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input type="radio" checked={type === 'normal'} onChange={() => setType('normal')} style={{ width: 'auto' }} />
                Yêu cầu thông thường (Trình duyệt)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'normal', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input type="radio" checked={type === 'emergency'} onChange={() => setType('emergency')} style={{ width: 'auto' }} />
                Mua ngoài khẩn cấp (Direct Purchase)
              </label>
            </div>
          </div>
        )}

        {/* Over BOQ Checkbox */}
        {!isPhaseRequest && type === 'normal' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              id="is-over-boq-resubmit"
              type="checkbox"
              checked={isOverBOQ}
              onChange={e => setIsOverBOQ(e.target.checked)}
              style={{ width: 'auto', cursor: 'pointer' }}
            />
            <label htmlFor="is-over-boq-resubmit" style={{ fontSize: '0.85rem', fontWeight: 'normal', cursor: 'pointer', color: 'hsl(var(--danger))' }}>
              ⚠️ Vượt định mức (Over BOQ) - Cần Giám đốc phê duyệt
            </label>
          </div>
        )}

        {/* Dynamic Items List */}
        <div>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span>Danh sách vật tư yêu cầu <span style={{ color: 'hsl(var(--danger))' }}>*</span></span>
            <button type="button" onClick={handleAddItem} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
              + Thêm vật tư
            </button>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Tên vật tư..."
                  value={item.name}
                  onChange={e => handleItemChange(idx, 'name', e.target.value)}
                  required
                  style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                />
                <input
                  type="number"
                  min={1}
                  placeholder="SL"
                  value={item.quantity}
                  onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                  required
                  style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                />
                <input
                  type="text"
                  placeholder="ĐVT"
                  value={item.unit}
                  onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                  required
                  style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                />
                <button
                  type="button"
                  disabled={items.length === 1}
                  onClick={() => handleRemoveItem(idx)}
                  className="btn"
                  style={{ padding: '4px', backgroundColor: 'transparent', color: 'hsl(var(--danger))', cursor: items.length === 1 ? 'not-allowed' : 'pointer' }}
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>

        {type === 'emergency' && !isPhaseRequest && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="resubmit-invoice-url">Hình ảnh hóa đơn mua ngoài bắt buộc <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input
              id="resubmit-invoice-url"
              type="text"
              placeholder="https://example.com/invoice.jpg"
              value={invoiceImage}
              onChange={e => setInvoiceImage(e.target.value)}
              required
              style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
            />
          </div>
        )}

        <div>
          <label htmlFor="resubmit-reason">Lý do yêu cầu / Giải trình</label>
          <textarea
            id="resubmit-reason"
            placeholder="Nêu lý do hao hụt, hư hỏng hoặc giải trình bổ sung..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', width: '100%', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Đang gửi...' : 'Gửi lại yêu cầu'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
