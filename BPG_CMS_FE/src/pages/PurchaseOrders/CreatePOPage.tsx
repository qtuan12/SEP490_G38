import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import { supplierService } from '../../services/supplierService';
import { projectService } from '../../services/projectService';
import { Button, Input, Select } from '../../components/ui';
import { ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle2, Loader2, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { isDiscreteUnit } from '../../utils/unitHelpers';

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

// Chuyển yyyy-mm-dd (giá trị input date) sang dd-mm-yyyy để hiển thị
const toDisplayDate = (isoDate: string) => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
};

const label: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 4, display: 'block',
};

export const CreatePOPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get('projectId');
  const queryRequestId = searchParams.get('requestId');
  // Được điều hướng kèm projectId (từ tab YCVT hoặc tab Đơn hàng trong dự án) → khóa dự án, không cho đổi.
  const isProjectLocked = Boolean(queryProjectId);
  // Kèm cả requestId (từ tab YCVT, bấm "Tạo PO" trên một yêu cầu cụ thể) → khóa luôn yêu cầu vật tư.
  // Nếu chỉ có projectId (từ tab Đơn hàng), người dùng vẫn được chọn yêu cầu vật tư hợp lệ của dự án.
  const isRequestLocked = Boolean(queryProjectId && queryRequestId);

  // Header state
  const [projectId, setProjectId] = useState(0);
  const [selectedRequestId, setSelectedRequestId] = useState(0);

  // Tự động chọn Dự án nếu được truyền từ Tab Yêu cầu vật tư
  useEffect(() => {
    if (queryProjectId) {
      const pId = Number(queryProjectId);
      if (pId > 0 && pId !== projectId) {
        setProjectId(pId);
      }
    }
  }, [queryProjectId]);
  const [orderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [headerNotes, setHeaderNotes] = useState('');

  // Item table
  const [items, setItems] = useState<POItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [orderDateError, setOrderDateError] = useState<string | null>(null);
  const [deliveryDateError, setDeliveryDateError] = useState<string | null>(null);

  // Fetch data
  const { data: projectList = [] } = useQuery({
    queryKey: ['projects-dropdown'],
    queryFn: () => projectService.getProjects(),
  });

  // Khi dự án bị khóa (không có dropdown để người dùng tự chọn), tự điền địa chỉ giao hàng
  // ngay khi danh sách dự án tải xong — tương đương hành vi chọn dự án thủ công.
  useEffect(() => {
    if (isProjectLocked && projectId > 0 && !deliveryAddress && projectList.length > 0) {
      const proj = projectList.find((p) => String(p.id) === String(projectId));
      if (proj?.address) setDeliveryAddress(proj.address);
    }
  }, [isProjectLocked, projectId, projectList, deliveryAddress]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: () => supplierService.getSuppliers({ pageSize: 200, collaborationStatus: 'Active' }).then((r) => r.items),
  });

  // Mã đơn hàng dự kiến sẽ được backend sinh — chỉ hiển thị tham khảo, không cho chỉnh sửa
  const { data: nextPoNumber } = useQuery({
    queryKey: ['next-po-number', orderDate],
    queryFn: () => inventoryService.getNextPoNumber(orderDate),
  });

  const { data: approvedRequestsData, isLoading: loadingRequests } = useQuery({
    queryKey: ['approved-requests-po', projectId],
    queryFn: () => inventoryService.getApprovedRequestsForPO(projectId),
    enabled: projectId > 0,
  });
  // useMemo giữ stable reference khi data là undefined (query bị disable)
  // tránh [] mới mỗi render gây infinite re-render loop trong useEffect bên dưới
  const approvedRequests = useMemo(() => approvedRequestsData ?? [], [approvedRequestsData]);

  // Loại bỏ các yêu cầu đã được đặt đủ số lượng qua PO trước (không còn vật tư nào để tạo đơn mới)
  // khỏi danh sách cho chọn — tránh người dùng chọn nhầm một yêu cầu không thể tạo được PO.
  const selectableRequests = useMemo(
    () => approvedRequests.filter((r) => r.items.some((it) => it.remainingQuantity > 0)),
    [approvedRequests]
  );

  // Tự động chọn Phiếu yêu cầu sau khi danh sách yêu cầu được tải
  useEffect(() => {
    if (queryRequestId && approvedRequests.length > 0 && !selectedRequestId) {
      const rId = Number(queryRequestId);
      const exists = approvedRequests.some(r => r.requestId === rId);
      if (exists) {
        setSelectedRequestId(rId);
      }
    }
  }, [queryRequestId, approvedRequests, selectedRequestId]);

  // Load items when the selected request changes
  useEffect(() => {
    if (!selectedRequestId) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const req = approvedRequests.find((r) => r.requestId === selectedRequestId);
    if (!req) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const merged: Record<number, POItem> = {};
    for (const ri of req.items) {
      // Bỏ qua vật tư đã đặt đủ qua các PO trước (số lượng còn lại = 0)
      if (ri.remainingQuantity <= 0) continue;
      if (merged[ri.materialId]) {
        merged[ri.materialId].maxQuantity += ri.remainingQuantity;
        merged[ri.materialId].quantity += ri.remainingQuantity;
      } else {
        merged[ri.materialId] = {
          materialId: ri.materialId,
          materialCode: ri.materialCode,
          materialName: ri.materialName,
          specification: ri.specification,
          unitId: ri.unitId,
          unitName: ri.unitName,
          quantity: ri.remainingQuantity,
          unitPrice: 0,
          notes: '',
          maxQuantity: ri.remainingQuantity,
        };
      }
    }
    setItems(Object.values(merged));
  }, [selectedRequestId, approvedRequests]);

  const updateItem = (idx: number, field: keyof POItem, value: number | string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const totalAmount = useMemo(() => items.reduce((s, it) => s + it.quantity * it.unitPrice, 0), [items]);

  const mutation = useMutation({
    mutationFn: () =>
      inventoryService.createPurchaseOrder({
        orderDate,
        supplierId: supplierId > 0 ? supplierId : undefined,
        projectId,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        notes: headerNotes.trim() || undefined,
        requestId: selectedRequestId,
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
    onError: (err: any) => {
      const msg = err.message || 'Tạo đơn hàng thất bại.';
      // Hiện popup ở giữa (trên) màn hình để không bị bỏ sót lỗi
      toast.error(msg, { position: 'top-center' });
      // Đồng thời gắn lỗi ngay dưới trường liên quan nếu nhận diện được
      if (msg.includes('Ngày đơn hàng')) {
        setOrderDateError(msg);
      } else if (msg.includes('Hạn giao hàng') || msg.includes('giao hàng')) {
        setDeliveryDateError(msg);
      } else {
        setFormError(msg);
      }
    },
  });

  const handleSubmit = () => {
    setFormError(null);
    setOrderDateError(null);
    setDeliveryDateError(null);
    if (!projectId) return setFormError('Vui lòng chọn dự án.');
    if (!supplierId) return setFormError('Vui lòng chọn nhà cung cấp.');
    if (!selectedRequestId) return setFormError('Vui lòng chọn một yêu cầu vật tư.');
    if (!items.length) return setFormError('Không có dòng vật tư nào.');
    for (const it of items) {
      if (it.quantity <= 0) return setFormError(`Số lượng "${it.materialName}" phải lớn hơn 0.`);
      if (it.quantity > it.maxQuantity)
        return setFormError(`Số lượng "${it.materialName}" vượt quá số lượng yêu cầu (${it.maxQuantity}).`);
      if (isDiscreteUnit(it.unitName) && it.quantity % 1 !== 0) {
        return setFormError(`Đơn vị tính '${it.unitName}' của vật tư "${it.materialName}" yêu cầu số lượng phải là số nguyên.`);
      }
    }
    mutation.mutate();
  };

  const selectRequest = (id: number) =>
    setSelectedRequestId((prev) => (prev === id ? 0 : id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1120, margin: '0 auto' }}>
      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: 8, borderRadius: 6, border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-secondary))',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <ShoppingCart size={22} style={{ color: 'hsl(var(--primary))' }} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
          Tạo Đơn Hàng
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

      {/* Đơn hàng Header */}
      <div className="glass-panel p-6">
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Thông tin đơn hàng</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px 20px' }}>
          <div>
            <label style={label}>Dự án <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            {isProjectLocked ? (
              <div
                className="h-10"
                style={{
                  display: 'flex', alignItems: 'center',
                  borderRadius: 6, padding: '0 12px', fontSize: 14, fontWeight: 600,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--bg-muted, var(--bg-card)))', color: 'hsl(var(--text-secondary))',
                }}
              >
                {projectList.find((p) => String(p.id) === String(projectId))?.name ?? '...'}
              </div>
            ) : (
              <Select
                value={projectId.toString()}
                onChange={(e) => {
                  const pid = Number(e.target.value);
                  setProjectId(pid);
                  setSelectedRequestId(0);
                  // Tự động điền địa điểm giao hàng từ địa chỉ dự án
                  const proj = projectList.find((p) => String(p.id) === String(pid));
                  setDeliveryAddress(proj?.address ?? '');
                }}
                options={[
                  { label: '-- Chọn dự án --', value: '0' },
                  ...projectList.map((p) => ({ label: p.name, value: p.id })),
                ]}
                className="h-10"
              />
            )}
          </div>
          <div>
            <label style={label}>Mã đơn hàng <span style={{ fontWeight: 400, color: 'hsl(var(--text-muted))' }}>(dự kiến)</span></label>
            <div
              className="h-10"
              style={{
                display: 'flex', alignItems: 'center',
                borderRadius: 6, padding: '0 12px', fontSize: 14, fontWeight: 600,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--bg-muted, var(--bg-card)))', color: 'hsl(var(--text-secondary))',
              }}
            >
              {nextPoNumber ?? '...'}
            </div>
          </div>
          <div>
            <label style={label}>Ngày đơn hàng <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <div
              className="h-10"
              style={{
                display: 'flex', alignItems: 'center',
                borderRadius: 6, padding: '0 12px', fontSize: 14,
                border: `1px solid ${orderDateError ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`,
                background: 'hsl(var(--bg-muted, var(--bg-card)))', color: 'hsl(var(--text-secondary))',
              }}
            >
              {toDisplayDate(orderDate)}
            </div>
            {orderDateError && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{orderDateError}</p>
            )}
          </div>
          <div>
            <label style={label}>Nhà cung cấp <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <Select
              value={supplierId.toString()}
              onChange={(e) => setSupplierId(Number(e.target.value))}
              options={[
                { label: '-- Chọn nhà cung cấp --', value: '0' },
                ...suppliers.map((s) => ({ label: s.supplierName, value: s.supplierId.toString() })),
              ]}
              className="h-10"
            />
          </div>
          <div>
            <label style={label}>Hạn giao hàng</label>
            <div style={{ position: 'relative' }}>
              <Input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => { setExpectedDeliveryDate(e.target.value); setDeliveryDateError(null); }}
                className="h-10"
                style={{
                  color: 'transparent',
                  ...(deliveryDateError ? { borderColor: 'hsl(var(--danger))' } : {}),
                }}
              />
              <span
                style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 14, pointerEvents: 'none',
                  color: expectedDeliveryDate ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))',
                }}
              >
                {expectedDeliveryDate ? toDisplayDate(expectedDeliveryDate) : 'dd-mm-yyyy'}
              </span>
            </div>
            {deliveryDateError && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{deliveryDateError}</p>
            )}
          </div>
          <div>
            <label style={label}>Địa điểm giao hàng <span style={{ fontWeight: 400, color: 'hsl(var(--text-muted))' }}>(theo địa chỉ dự án)</span></label>
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
            {isRequestLocked ? (
              <>Yêu cầu vật tư <span style={{ fontSize: 12, fontWeight: 500, color: 'hsl(var(--text-muted))' }}>(đã chọn từ tab Yêu cầu vật tư)</span></>
            ) : (
              <>Chọn yêu cầu vật tư đã duyệt <span style={{ fontSize: 12, fontWeight: 500, color: 'hsl(var(--text-muted))' }}>(mỗi đơn hàng thuộc một yêu cầu)</span></>
            )}
          </h3>
          {loadingRequests ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'hsl(var(--text-muted))' }}>
              <Loader2 size={16} className="animate-spin" /> Đang tải...
            </div>
          ) : (isRequestLocked ? approvedRequests : selectableRequests).length === 0 ? (
            <p style={{ color: 'hsl(var(--text-muted))', margin: 0, fontSize: 14 }}>
              {isRequestLocked
                ? 'Không có yêu cầu đã duyệt cho dự án này.'
                : 'Không có yêu cầu nào có thể tạo đơn hàng (tất cả đã được đặt đủ số lượng qua các đơn hàng trước).'}
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
              {(isRequestLocked
                ? approvedRequests.filter((r) => String(r.requestId) === queryRequestId)
                : selectableRequests
              ).map((req) => {
                const checked = selectedRequestId === req.requestId;
                return (
                  <label key={req.requestId} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    cursor: isRequestLocked ? 'default' : 'pointer',
                    padding: '12px 14px', borderRadius: 8,
                    border: `1px solid ${checked ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                    background: checked ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-card))',
                    boxShadow: checked ? '0 0 0 1px hsl(var(--primary))' : 'none',
                    transition: 'all 0.15s',
                  }}>
                    {!isRequestLocked && (
                      <input type="radio" name="po-request" checked={checked} onChange={() => selectRequest(req.requestId)}
                        style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, accentColor: 'hsl(var(--primary))', cursor: 'pointer' }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'hsl(var(--text-primary))' }}>
                          Yêu cầu #{req.requestId}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: 'hsl(var(--primary))',
                          background: 'hsl(var(--primary-glow))', padding: '2px 8px', borderRadius: 999,
                        }}>
                          {req.phaseName}
                        </span>
                        {req.hasPO && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: 'hsl(142 70% 35%)',
                            background: 'hsl(142 70% 40% / 0.12)', padding: '2px 8px', borderRadius: 999,
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                          }}>
                            <CheckCircle2 size={11} /> Đã có đơn hàng
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                        {req.reason}
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4, fontWeight: 500 }}>
                        {req.items.length} loại vật tư
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Đã đặt đủ số lượng */}
      {selectedRequestId > 0 && items.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'hsl(var(--warning) / 0.1)', border: '1px solid hsl(var(--warning) / 0.3)',
          borderRadius: 6, padding: '12px 16px', color: 'hsl(var(--warning))', fontSize: 14,
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>Yêu cầu này đã được đặt đủ số lượng qua các đơn hàng trước, không còn vật tư nào để tạo đơn hàng mới.</span>
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
                  {['STT', 'Mã VT', 'Tên vật tư', 'ĐVT', 'SL còn lại', 'SL đặt *', 'Đơn giá (VND) *', 'Thành tiền', 'Ghi chú', ''].map((h) => (
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
                      <Input type="number" 
                        min={isDiscreteUnit(it.unitName) ? 1 : 0.001} 
                        max={it.maxQuantity} 
                        step={isDiscreteUnit(it.unitName) ? 1 : 0.001}
                        value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                        className="h-8" style={{ width: 110 }} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <Input type="number" min={0} step={1000}
                        value={it.unitPrice === 0 ? '' : it.unitPrice}
                        onChange={(e) => updateItem(idx, 'unitPrice', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="h-8" style={{ width: 140 }} />
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap', color: 'hsl(var(--text-primary))' }}>
                      {fmt(it.quantity * it.unitPrice)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <Input value={it.notes} onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                        placeholder="Ghi chú" className="h-8" style={{ width: 200 }} />
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
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '8px 16px', borderRadius: 6, border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-secondary))',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s',
          }}
        >
          Hủy
        </button>
        <Button type="button" variant="primary" disabled={mutation.isPending} className="font-semibold" onClick={handleSubmit}>
          {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Đang lưu...</> : <><Plus size={16} /> Tạo đơn hàng</>}
        </Button>
      </div>
    </div>
  );
};
