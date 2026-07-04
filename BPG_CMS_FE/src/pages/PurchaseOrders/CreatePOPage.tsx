import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import { supplierService } from '../../services/supplierService';
import { projectService } from '../../services/projectService';
import { Button, Input, Select } from '../../components/ui';
import { ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle2, Loader2, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

interface POItem {
  materialId: number;
  materialCode: string;
  materialName: string;
  specification: string;
  unitId: number;
  unitName: string;
  quantity: number;
  unitPrice: number;
  notes: string;
  maxQuantity: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

const label: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 4, display: 'block',
};

export const CreatePOPage: React.FC = () => {
  const navigate = useNavigate();

  // Header state
  const [projectId, setProjectId] = useState(0);
  const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);
  const [poNumber, setPONumber] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [headerNotes, setHeaderNotes] = useState('');

  // Item table
  const [items, setItems] = useState<POItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch data
  const { data: projectList = [] } = useQuery({
    queryKey: ['projects-dropdown'],
    queryFn: () => projectService.getProjects(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: () => supplierService.getSuppliers({ pageSize: 200, collaborationStatus: 'Active' }).then((r) => r.items),
  });

  const { data: approvedRequestsData, isLoading: loadingRequests } = useQuery({
    queryKey: ['approved-requests-po', projectId],
    queryFn: () => inventoryService.getApprovedRequestsForPO(projectId),
    enabled: projectId > 0,
  });
  // useMemo giữ stable reference khi data là undefined (query bị disable)
  // tránh [] mới mỗi render gây infinite re-render loop trong useEffect bên dưới
  const approvedRequests = useMemo(() => approvedRequestsData ?? [], [approvedRequestsData]);

  // Merge items when request selection changes
  useEffect(() => {
    if (selectedRequestIds.length === 0) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const selectedReqs = approvedRequests.filter((r) => selectedRequestIds.includes(r.requestId));
    const merged: Record<number, POItem> = {};
    for (const req of selectedReqs) {
      for (const ri of req.items) {
        if (merged[ri.materialId]) {
          merged[ri.materialId].maxQuantity += ri.quantity;
          merged[ri.materialId].quantity += ri.quantity;
        } else {
          merged[ri.materialId] = {
            materialId: ri.materialId,
            materialCode: ri.materialCode,
            materialName: ri.materialName,
            specification: ri.specification,
            unitId: ri.unitId,
            unitName: ri.unitName,
            quantity: ri.quantity,
            unitPrice: 0,
            notes: '',
            maxQuantity: ri.quantity,
          };
        }
      }
    }
    setItems(Object.values(merged));
  }, [selectedRequestIds, approvedRequests]);

  const updateItem = (idx: number, field: keyof POItem, value: number | string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const totalAmount = useMemo(() => items.reduce((s, it) => s + it.quantity * it.unitPrice, 0), [items]);

  const mutation = useMutation({
    mutationFn: () =>
      inventoryService.createPurchaseOrder({
        poNumber: poNumber.trim() || undefined,
        orderDate,
        supplierId: supplierId > 0 ? supplierId : undefined,
        projectId,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        notes: headerNotes.trim() || undefined,
        requestIds: selectedRequestIds,
        items: items.map((it) => ({
          materialId: it.materialId,
          unitId: it.unitId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          notes: it.notes.trim() || undefined,
        })),
      }),
    onSuccess: () => {
      toast.success('Tạo đơn mua hàng thành công!');
      navigate('/purchase-orders');
    },
    onError: (err: any) => setFormError(err.message || 'Tạo PO thất bại.'),
  });

  const handleSubmit = () => {
    setFormError(null);
    if (!projectId) return setFormError('Vui lòng chọn dự án.');
    if (!supplierId) return setFormError('Vui lòng chọn nhà cung cấp.');
    if (!selectedRequestIds.length) return setFormError('Vui lòng chọn ít nhất một yêu cầu vật tư.');
    if (!items.length) return setFormError('Không có dòng vật tư nào.');
    for (const it of items) {
      if (it.quantity <= 0) return setFormError(`Số lượng "${it.materialName}" phải lớn hơn 0.`);
      if (it.quantity > it.maxQuantity)
        return setFormError(`Số lượng "${it.materialName}" vượt quá số lượng yêu cầu (${it.maxQuantity}).`);
    }
    mutation.mutate();
  };

  const toggleRequest = (id: number) =>
    setSelectedRequestIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1120, margin: '0 auto' }}>
      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          to="/purchase-orders"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: 8, borderRadius: 6, border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-secondary))',
            cursor: 'pointer', textDecoration: 'none', transition: 'background 0.15s',
          }}
        >
          <ArrowLeft size={18} />
        </Link>
        <ShoppingCart size={22} style={{ color: 'hsl(var(--primary))' }} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
          Tạo Đơn Mua Hàng (PO)
        </h2>
      </div>

      {formError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)',
          borderRadius: 4, padding: '12px 16px', color: 'hsl(346 84% 35%)', fontSize: 14,
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0, color: 'hsl(var(--danger))' }} />
          <span>{formError}</span>
        </div>
      )}

      {/* PO Header */}
      <div className="glass-panel p-6">
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Thông tin PO</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px 20px' }}>
          <div>
            <label style={label}>Dự án <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <Select
              value={projectId.toString()}
              onChange={(e) => { setProjectId(Number(e.target.value)); setSelectedRequestIds([]); }}
              options={[
                { label: '-- Chọn dự án --', value: '0' },
                ...projectList.map((p) => ({ label: p.name, value: p.id })),
              ]}
              className="h-10"
            />
          </div>
          <div>
            <label style={label}>Mã PO (để trống = tự sinh)</label>
            <Input value={poNumber} onChange={(e) => setPONumber(e.target.value)} placeholder="VD: PO-20260701-0001" className="h-10" />
          </div>
          <div>
            <label style={label}>Ngày PO <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-10" />
          </div>
          <div>
            <label style={label}>Nhà cung cấp <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <Select
              value={supplierId.toString()}
              onChange={(e) => setSupplierId(Number(e.target.value))}
              options={[
                { label: '-- Chọn NCC --', value: '0' },
                ...suppliers.map((s) => ({ label: s.supplierName, value: s.supplierId.toString() })),
              ]}
              className="h-10"
            />
          </div>
          <div>
            <label style={label}>Hạn giao hàng</label>
            <Input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="h-10" />
          </div>
          <div>
            <label style={label}>Địa điểm giao hàng</label>
            <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Địa chỉ nhận hàng" className="h-10" />
          </div>
          <div>
            <label style={label}>Ghi chú</label>
            <Input value={headerNotes} onChange={(e) => setHeaderNotes(e.target.value)} placeholder="Ghi chú bổ sung" className="h-10" />
          </div>
        </div>
      </div>

      {/* Request selection */}
      {projectId > 0 && (
        <div className="glass-panel p-6">
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
            Chọn yêu cầu vật tư đã duyệt
          </h3>
          {loadingRequests ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'hsl(var(--text-muted))' }}>
              <Loader2 size={16} className="animate-spin" /> Đang tải...
            </div>
          ) : approvedRequests.length === 0 ? (
            <p style={{ color: 'hsl(var(--text-muted))', margin: 0, fontSize: 14 }}>
              Không có yêu cầu đã duyệt cho dự án này.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {approvedRequests.map((req) => {
                const checked = selectedRequestIds.includes(req.requestId);
                return (
                  <label key={req.requestId} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                    padding: '10px 12px', borderRadius: 6,
                    border: `1px solid ${checked ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                    background: checked ? 'hsl(var(--primary-glow))' : 'transparent',
                    transition: 'all 0.15s',
                  }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleRequest(req.requestId)}
                      style={{ marginTop: 2, accentColor: 'hsl(var(--primary))' }} />
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'hsl(var(--text-primary))' }}>
                          Yêu cầu #{req.requestId}
                        </span>
                        <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                          Giai đoạn: {req.phaseName}
                        </span>
                        {req.hasPO && (
                          <span style={{ fontSize: 11, color: 'hsl(142 70% 40%)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CheckCircle2 size={12} /> Đã có PO
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
                        {req.reason} — {req.items.length} loại vật tư
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Items table */}
      {items.length > 0 && (
        <div className="glass-panel p-6">
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
            Chi tiết đơn hàng
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid hsl(var(--border))' }}>
                  {['STT', 'Mã VT', 'Tên vật tư', 'ĐVT', 'SL y/cầu', 'SL đặt *', 'Đơn giá (VND) *', 'Thành tiền', 'Ghi chú', ''].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'hsl(var(--text-muted))', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.materialId} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <td style={{ padding: '8px 10px', color: 'hsl(var(--text-muted))' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: 'hsl(var(--primary))' }}>{it.materialCode}</td>
                    <td style={{ padding: '8px 10px', minWidth: 160 }}>
                      <div style={{ fontWeight: 500, color: 'hsl(var(--text-primary))' }}>{it.materialName}</div>
                      {it.specification && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{it.specification}</div>}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'hsl(var(--text-secondary))' }}>{it.unitName}</td>
                    <td style={{ padding: '8px 10px', color: 'hsl(var(--text-muted))' }}>{it.maxQuantity}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <Input type="number" min={0.001} max={it.maxQuantity} step={0.001}
                        value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                        className="h-8" style={{ width: 90 }} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <Input type="number" min={0} step={1000}
                        value={it.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))}
                        className="h-8" style={{ width: 120 }} />
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap', color: 'hsl(var(--text-primary))' }}>
                      {fmt(it.quantity * it.unitPrice)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <Input value={it.notes} onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                        placeholder="Ghi chú" className="h-8" style={{ width: 130 }} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <Button type="button" variant="secondary" className="p-1 h-auto" onClick={() => removeItem(idx)} title="Xóa dòng">
                        <Trash2 size={14} style={{ color: 'hsl(var(--danger))' }} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: '1px solid hsl(var(--border))' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
              Tổng cộng: <span style={{ color: 'hsl(var(--primary))', marginLeft: 8 }}>{fmt(totalAmount)}</span>
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingBottom: 24 }}>
        <Link
          to="/purchase-orders"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '8px 16px', borderRadius: 6, border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-secondary))',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', transition: 'background 0.15s',
          }}
        >
          Hủy
        </Link>
        <Button type="button" variant="primary" disabled={mutation.isPending} className="font-semibold" onClick={handleSubmit}>
          {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Đang lưu...</> : <><Plus size={16} /> Tạo PO</>}
        </Button>
      </div>
    </div>
  );
};
