import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import { supplierService } from '../../services/supplierService';
import { projectService } from '../../services/projectService';
import { Button, Input, Select } from '../../components/ui';
import { ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle2, Loader2, ShoppingCart, Upload, X, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiError } from '../../services/api';
import { todayVnISO } from '../../utils/dateHelpers';
import { compressAndUploadFile } from '../../utils/uploadHelper';

/** Ảnh/PDF báo giá đang chờ tải lên hoặc đã có URL trên Cloudinary. */
interface QuotationFileState {
  id: string;
  name: string;
  /** Ảnh: URL preview (blob khi đang tải, URL thật khi xong). PDF: chỉ có URL thật. */
  url?: string;
  isPdf: boolean;
  contentType?: string;
  fileSizeBytes?: number;
  status: 'uploading' | 'success' | 'error';
}

const QUOTATION_FOLDER = 'purchase-orders/quotations';
/** Trùng UploadFilePolicy.MaxFilesPerRequest và MaxFileSizeBytes của backend. */
const MAX_QUOTATION_FILES = 5;
const MAX_QUOTATION_SIZE_BYTES = 20 * 1024 * 1024;

interface POItem {
  materialId: number;
  materialCode: string;
  materialName: string;
  specification: string;
  unitId: number;
  unitName: string;
  /**
   * Số lượng và đơn giá giữ nguyên chuỗi người dùng gõ, không ép về number ngay.
   *
   * Với <input type="number">, React so sánh LỎNG khi đồng bộ DOM: state 1 mà ô đang là "01"
   * thì "01" == 1 nên React để nguyên chữ "01". Còn nếu ép 0 thành ô trống để né chuyện đó thì
   * lại không gõ được số thập phân — vừa gõ "0" của "0.1" là state về 0 và ô bị xóa trắng.
   * Giữ chuỗi thô là cách duy nhất đúng cho cả hai trường hợp; parse khi cần tính toán.
   */
  quantity: string;
  unitPrice: string;
  notes: string;
  maxQuantity: number;
  // Cờ ĐVT nguyên lấy từ backend (Material.BaseUnit.IsDiscrete), không suy đoán từ tên đơn vị
  isDiscreteUnit: boolean;
  baseUnitName: string;
}

/** Chuỗi trong ô số → số để tính toán. Ô trống hoặc đang gõ dở ("1.", "-") coi như 0. */
const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

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

  // Rời trang (huỷ / tạo xong) → quay về tab Đơn hàng của dự án nếu biết dự án,
  // ngược lại mới về danh sách đơn hàng chung.
  const backPath = projectId > 0
    ? `/projects/${projectId}?tab=purchaseorders`
    : '/purchase-orders';

  const [orderDate, setOrderDate] = useState(todayVnISO);
  const [supplierId, setSupplierId] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [headerNotes, setHeaderNotes] = useState('');

  // Báo giá nhà cung cấp (ảnh hoặc PDF) — bắt buộc phải có ít nhất một tệp mới tạo được đơn.
  const [quotationFiles, setQuotationFiles] = useState<QuotationFileState[]>([]);
  const quotationInputRef = useRef<HTMLInputElement>(null);

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
    queryFn: () => supplierService.getSuppliers({ pageSize: 200 }).then((r) => r.items.filter(s => s.collaborationStatus !== 'Blacklisted')),
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

  // Danh sách vật tư gốc của yêu cầu đang chọn (đã gộp trùng, đã loại vật tư hết số lượng còn lại).
  // Giữ riêng để người dùng xóa nhầm còn thêm lại được.
  const baseItems = useMemo<POItem[]>(() => {
    const req = approvedRequests.find((r) => r.requestId === selectedRequestId);
    if (!selectedRequestId || !req) return [];
    const merged: Record<number, POItem> = {};
    for (const ri of req.items) {
      // Bỏ qua vật tư đã đặt đủ qua các PO trước (số lượng còn lại = 0)
      if (ri.remainingQuantity <= 0) continue;
      if (merged[ri.materialId]) {
        merged[ri.materialId].maxQuantity += ri.remainingQuantity;
        merged[ri.materialId].quantity = String(num(merged[ri.materialId].quantity) + ri.remainingQuantity);
      } else {
        merged[ri.materialId] = {
          materialId: ri.materialId,
          materialCode: ri.materialCode,
          materialName: ri.materialName,
          specification: ri.specification,
          unitId: ri.unitId,
          unitName: ri.unitName,
          quantity: String(ri.remainingQuantity),
          unitPrice: '',
          notes: '',
          maxQuantity: ri.remainingQuantity,
          isDiscreteUnit: ri.isDiscreteUnit,
          baseUnitName: ri.baseUnitName || ri.unitName,
        };
      }
    }
    return Object.values(merged);
  }, [selectedRequestId, approvedRequests]);

  // Load items when the selected request changes
  useEffect(() => {
    setItems(baseItems);
  }, [baseItems]);

  // Ô số lượng/đơn giá truyền thẳng chuỗi thô của input vào state (xem ghi chú ở POItem).
  const updateItem = (idx: number, field: keyof POItem, value: number | string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  // Vật tư người dùng đã xóa khỏi bảng — cho phép thêm lại, giữ đúng thứ tự gốc.
  const removedItems = useMemo(
    () => baseItems.filter((b) => !items.some((it) => it.materialId === b.materialId)),
    [baseItems, items]
  );

  const restoreItem = (materialId: number) =>
    setItems((prev) => {
      const restored = baseItems.find((b) => b.materialId === materialId);
      if (!restored || prev.some((it) => it.materialId === materialId)) return prev;
      const next = [...prev, restored];
      const order = baseItems.map((b) => b.materialId);
      return next.sort((a, b) => order.indexOf(a.materialId) - order.indexOf(b.materialId));
    });

  const restoreAllItems = () => setItems(baseItems);

  const totalAmount = useMemo(() => items.reduce((s, it) => s + num(it.quantity) * num(it.unitPrice), 0), [items]);

  /** Đã bấm "Tạo đơn hàng" ít nhất một lần — mốc để bắt đầu nhắc các ô còn bỏ trống. */
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // ---- Validate realtime ----
  // Kiểm ngay khi người dùng gõ, không đợi bấm "Tạo đơn hàng". Các rule dưới đây phản chiếu
  // rule của backend (CreatePurchaseOrderCommandHandler) — backend vẫn là chốt chặn cuối cùng,
  // đây chỉ là lớp phản hồi sớm để đỡ một vòng gọi API.
  // Kèm theo `field` để dòng chữ đỏ hiện đúng dưới ô sai, không dồn hết xuống ô Số lượng.
  //
  // Ô CÒN TRỐNG thì im lặng cho tới khi người dùng bấm "Tạo đơn hàng": chọn xong yêu cầu vật tư
  // là đơn giá vốn để trống, báo đỏ ngay lúc đó chẳng khác gì mắng người dùng vì chưa kịp nhập.
  // Có nhập rồi mà sai (âm, 0, vượt tồn) thì vẫn báo ngay.
  const itemErrors = useMemo<({ field: 'quantity' | 'unitPrice'; message: string } | null)[]>(
    () =>
      items.map((it) => {
        if (it.quantity.trim() === '')
          return attemptedSubmit ? { field: 'quantity', message: 'Vui lòng nhập số lượng đặt.' } : null;

        const quantity = num(it.quantity);
        if (quantity <= 0)
          return { field: 'quantity', message: 'Số lượng đặt phải lớn hơn 0.' };
        if (quantity > it.maxQuantity)
          return { field: 'quantity', message: `Vượt số lượng còn được đặt (tối đa ${it.maxQuantity} ${it.unitName}).` };
        if (it.isDiscreteUnit && quantity % 1 !== 0)
          return { field: 'quantity', message: `Đơn vị tính '${it.baseUnitName}' yêu cầu số lượng phải là số nguyên.` };

        // Đơn hàng gửi nhà cung cấp thì phải có giá — phản chiếu rule của backend.
        if (it.unitPrice.trim() === '')
          return attemptedSubmit ? { field: 'unitPrice', message: 'Vui lòng nhập đơn giá.' } : null;
        if (num(it.unitPrice) <= 0)
          return { field: 'unitPrice', message: 'Đơn giá phải lớn hơn 0.' };
        return null;
      }),
    [items, attemptedSubmit]
  );

  // Lỗi do backend trả về theo từng trường (ApiResponse.fieldErrors) — bấm "Tạo đơn hàng" là gọi API,
  // API thiếu trường nào thì gắn dòng đỏ ngay dưới đúng trường đó.
  const [apiFieldErrors, setApiFieldErrors] = useState<Record<string, string>>({});
  const clearApiFieldError = (field: string) =>
    setApiFieldErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));

  const projectError = apiFieldErrors.projectId || null;
  const supplierError = apiFieldErrors.supplierId || null;
  const requestError = apiFieldErrors.requestId || apiFieldErrors.items || null;

  // Lỗi backend gắn theo từng dòng vật tư: key dạng "items[0].quantity" → index dòng.
  const apiItemErrors = useMemo(() => {
    const byIndex: Record<number, string> = {};
    for (const [key, msg] of Object.entries(apiFieldErrors)) {
      const m = /^items\[(\d+)\]/.exec(key);
      if (m && msg) byIndex[Number(m[1])] = msg;
    }
    return byIndex;
  }, [apiFieldErrors]);

  // ---- Báo giá đính kèm ----
  const uploadedQuotations = useMemo(
    () => quotationFiles.filter((f) => f.status === 'success' && f.url),
    [quotationFiles]
  );
  const isUploadingQuotation = quotationFiles.some((f) => f.status === 'uploading');
  const quotationError =
    apiFieldErrors.quotationFiles ||
    (attemptedSubmit && uploadedQuotations.length === 0
      ? 'Bắt buộc phải đính kèm báo giá của nhà cung cấp (ảnh hoặc PDF).'
      : null);

  const handleQuotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (quotationInputRef.current) quotationInputRef.current.value = '';
    if (!picked.length) return;

    const accepted = picked.filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (accepted.length < picked.length) toast.error('Chỉ hỗ trợ ảnh (jpg, png, ...) hoặc file PDF.');

    const withinSize = accepted.filter((f) => f.size <= MAX_QUOTATION_SIZE_BYTES);
    if (withinSize.length < accepted.length) toast.error('Mỗi tệp báo giá không được vượt quá 10 MB.');

    const slots = MAX_QUOTATION_FILES - quotationFiles.length;
    if (slots <= 0) {
      toast.error(`Chỉ được đính kèm tối đa ${MAX_QUOTATION_FILES} tệp báo giá.`);
      return;
    }
    const files = withinSize.slice(0, slots);
    if (withinSize.length > slots) toast.error(`Chỉ được đính kèm tối đa ${MAX_QUOTATION_FILES} tệp báo giá.`);

    files.forEach((file) => {
      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const isPdf = file.type === 'application/pdf';

      setQuotationFiles((prev) => [
        ...prev,
        {
          id: tempId,
          name: file.name,
          url: isPdf ? undefined : URL.createObjectURL(file),
          isPdf,
          contentType: file.type,
          fileSizeBytes: file.size,
          status: 'uploading',
        },
      ]);
      clearApiFieldError('quotationFiles');

      compressAndUploadFile(
        file,
        QUOTATION_FOLDER,
        (uploadedUrl) =>
          setQuotationFiles((prev) =>
            prev.map((f) => (f.id === tempId ? { ...f, status: 'success', url: uploadedUrl } : f))
          ),
        (message) => {
          toast.error(`Không thể tải báo giá ${file.name} lên. ${message}`);
          setQuotationFiles((prev) => prev.map((f) => (f.id === tempId ? { ...f, status: 'error' } : f)));
        }
      );
    });
  };

  const removeQuotation = (id: string) =>
    setQuotationFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      // Chỉ thu hồi blob preview do trang này tạo, không đụng vào URL Cloudinary.
      if (target?.url?.startsWith('blob:')) URL.revokeObjectURL(target.url);
      return prev.filter((f) => f.id !== id);
    });

  const mutation = useMutation({
    mutationFn: (submitOrderDate: string) =>
      inventoryService.createPurchaseOrder({
        orderDate: submitOrderDate,
        supplierId: supplierId > 0 ? supplierId : undefined,
        projectId,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        notes: headerNotes.trim() || undefined,
        requestId: selectedRequestId,
        items: items.map((it) => ({
          materialId: it.materialId,
          unitId: it.unitId,
          quantity: num(it.quantity),
          unitPrice: num(it.unitPrice),
          notes: it.notes.trim() || undefined,
        })),
        quotationFiles: uploadedQuotations.map((f) => ({
          fileName: f.name,
          fileUrl: f.url!,
          contentType: f.contentType,
          fileSizeBytes: f.fileSizeBytes,
        })),
      }),
    onSuccess: (result) => {
      toast.success(result.message || 'Đã tạo đơn mua hàng.');
      navigate(backPath);
    },
    onError: (err: any) => {
      const msg = err.message || 'Không thể tạo đơn mua hàng.';
      toast.error(msg);
      const apiErr = err instanceof ApiError ? err : undefined;

      // 1. Lỗi validate theo từng trường do API trả về (VAL_001) → dòng đỏ dưới đúng ô.
      const fieldErrors = apiErr?.fieldErrors;
      if (fieldErrors) {
        const flat: Record<string, string> = {};
        for (const [key, messages] of Object.entries(fieldErrors)) {
          flat[key] = Array.isArray(messages) ? messages.join(' ') : String(messages);
        }
        setApiFieldErrors(flat);
        // Ngày đơn hàng / hạn giao hàng có ô riêng, không nằm trong apiFieldErrors phía dưới
        if (flat.orderDate) setOrderDateError(flat.orderDate);
        if (flat.expectedDeliveryDate) setDeliveryDateError(flat.expectedDeliveryDate);
        return;
      }

      // 2. Lỗi nghiệp vụ (BIZ_*) không còn mã nào gắn riêng cho ô ngày — hiển thị ở đầu form.
      setFormError(msg);
    },
  });

  const handleSubmit = () => {
    setAttemptedSubmit(true);
    // Chặn tại chỗ hai trường hợp API không thể tự sửa giúp: báo giá đang tải dở (URL chưa có)
    // và chưa đính kèm tệp nào — gửi lên cũng chỉ nhận lại lỗi 400.
    if (isUploadingQuotation) {
      toast.error('Báo giá đang được tải lên, vui lòng đợi trong giây lát.');
      return;
    }
    if (uploadedQuotations.length === 0) {
      toast.error('Vui lòng đính kèm báo giá của nhà cung cấp (ảnh hoặc PDF).');
      return;
    }
    // Xóa lỗi của lần gửi trước rồi gọi API — để backend là nơi quyết định trường nào còn thiếu/sai,
    // FE chỉ hiển thị lại đúng vị trí.
    setFormError(null);
    setOrderDateError(null);
    setDeliveryDateError(null);
    setApiFieldErrors({});
    // Lấy lại ngày hiện tại lúc bấm gửi — trang mở qua nửa đêm thì ngày đơn hàng vẫn đúng.
    const today = todayVnISO();
    if (today !== orderDate) setOrderDate(today);
    mutation.mutate(today);
  };

  const selectRequest = (id: number) => {
    setSelectedRequestId((prev) => (prev === id ? 0 : id));
    clearApiFieldError('requestId');
    clearApiFieldError('items');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', margin: '0 auto' }}>
      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => navigate(backPath)}
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
                  clearApiFieldError('projectId');
                  // Tự động điền địa điểm giao hàng từ địa chỉ dự án
                  const proj = projectList.find((p) => String(p.id) === String(pid));
                  setDeliveryAddress(proj?.address ?? '');
                }}
                options={[
                  { label: '-- Chọn dự án --', value: '0' },
                  ...projectList.map((p) => ({ label: p.name, value: p.id })),
                ]}
                error={Boolean(projectError)}
                className="h-10"
              />
            )}
            {projectError && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{projectError}</p>
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
            {/* Ngày phát hành chứng từ, không phải thứ để chọn: luôn là ngày tạo đơn theo giờ
                Việt Nam. Mã đơn hàng cũng gắn với ngày này (PO-yyyyMMdd-xxxx) nên cho sửa sẽ
                khiến mã dự kiến lệch với mã thật. Hiển thị chỉ đọc giống ô Mã đơn hàng. */}
            <label style={label}>Ngày đơn hàng</label>
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
              onChange={(e) => { setSupplierId(Number(e.target.value)); clearApiFieldError('supplierId'); }}
              options={[
                { label: '-- Chọn nhà cung cấp --', value: '0' },
                ...suppliers.map((s) => ({ label: s.supplierName, value: s.supplierId.toString() })),
              ]}
              error={Boolean(supplierError)}
              className="h-10"
            />
            {supplierError && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{supplierError}</p>
            )}
            {supplierId > 0 && suppliers.find(s => s.supplierId === supplierId)?.collaborationStatus === 'Restricted' && (
              <div className="mt-2 p-3 bg-[hsl(var(--warning)/0.1)] border border-[hsl(var(--warning))] rounded text-sm text-[hsl(var(--warning-foreground))] flex items-start gap-2">
                <span className="text-[hsl(var(--warning))] font-bold">⚠️</span>
                <span>
                  <strong>Lưu ý:</strong> Nhà cung cấp này đang ở trạng thái <strong>Hạn chế</strong>. 
                  Hãy cân nhắc kỹ hoặc xin ý kiến trước khi chốt đơn.
                </span>
              </div>
            )}
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
              <>Yêu cầu vật tư</>
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
                      // onClick (không phải onChange) để bấm lại đúng yêu cầu đang chọn vẫn bỏ chọn được —
                      // radio đã checked thì onChange không bắn.
                      <input type="radio" name="po-request" checked={checked} readOnly onClick={() => selectRequest(req.requestId)}
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
          {requestError && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{requestError}</p>
          )}
        </div>
      )}

      {/* Đã đặt đủ số lượng — chỉ khi bản thân yêu cầu không còn vật tư nào, không phải do người dùng tự xóa */}
      {selectedRequestId > 0 && baseItems.length === 0 && (
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
                {items.map((it, idx) => {
                  // Lỗi backend không kèm thông tin ô nào nên gắn về ô Số lượng như trước.
                  const rowError = itemErrors[idx]
                    ?? (apiItemErrors[idx] ? { field: 'quantity' as const, message: apiItemErrors[idx] } : null);
                  const qtyError = rowError?.field === 'quantity' ? rowError.message : null;
                  const priceError = rowError?.field === 'unitPrice' ? rowError.message : null;
                  const errorText: React.CSSProperties = {
                    margin: '4px 0 0', fontSize: 11, lineHeight: 1.4, color: 'hsl(var(--danger))', maxWidth: 180,
                  };
                  return (
                  <tr key={it.materialId} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <td style={{ padding: '8px 10px', color: 'hsl(var(--text-muted))' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap', color: 'hsl(var(--primary))' }}>{it.materialCode}</td>
                    {/* Quy cách chuyển thành tooltip khi rê chuột vào tên vật tư cho gọn bảng */}
                    <td
                      style={{ padding: '8px 10px', minWidth: 220, maxWidth: 360 }}
                      title={it.specification ? `${it.materialName}\n${it.specification}` : it.materialName}
                    >
                      <div style={{
                        fontWeight: 500, color: 'hsl(var(--text-primary))',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        cursor: it.specification ? 'help' : 'default',
                      }}>
                        {it.materialName}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'hsl(var(--text-secondary))' }}>{it.unitName}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'hsl(var(--text-muted))' }}>{it.maxQuantity}</td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                      <Input type="number"
                        min={it.isDiscreteUnit ? 1 : 0.001}
                        max={it.maxQuantity}
                        step={it.isDiscreteUnit ? 1 : 0.001}
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className="h-8" style={{ width: 110, ...(qtyError ? { borderColor: 'hsl(var(--danger))' } : {}) }} />
                      {qtyError && <p style={errorText}>{qtyError}</p>}
                    </td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                      <Input type="number" min={0} step={1000}
                        value={it.unitPrice}
                        onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                        className="h-8" style={{ width: 140, ...(priceError ? { borderColor: 'hsl(var(--danger))' } : {}) }} />
                      {priceError && <p style={errorText}>{priceError}</p>}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap', color: 'hsl(var(--text-primary))' }}>
                      {fmt(num(it.quantity) * num(it.unitPrice))}
                    </td>
                    <td style={{ padding: '8px 10px', width: '100%', minWidth: 180 }}>
                      <Input value={it.notes} onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                        placeholder="Ghi chú" className="h-8" style={{ width: '100%' }} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <Button type="button" variant="secondary" className="p-1 h-auto" onClick={() => removeItem(idx)} title="Xóa dòng">
                        <Trash2 size={14} style={{ color: 'hsl(var(--danger))' }} />
                      </Button>
                    </td>
                  </tr>
                  );
                })}
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

      {/* Vật tư đã xóa khỏi bảng — cho thêm lại để không phải chọn lại yêu cầu */}
      {removedItems.length > 0 && (
        <div className="glass-panel p-6">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
              Vật tư đã xóa{' '}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'hsl(var(--text-muted))' }}>
                (bấm "Thêm lại" để đưa trở lại đơn hàng)
              </span>
            </h3>
            <Button type="button" variant="secondary" className="text-sm" onClick={restoreAllItems}>
              Thêm lại tất cả
            </Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {removedItems.map((it) => (
              <div key={it.materialId} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '8px 12px',
                background: 'hsl(var(--bg-card))',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                    <span style={{ color: 'hsl(var(--primary))' }}>{it.materialCode}</span> — {it.materialName}
                  </div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                    Còn lại {it.maxQuantity} {it.unitName}
                  </div>
                </div>
                <Button type="button" variant="secondary" className="text-xs" onClick={() => restoreItem(it.materialId)}>
                  <Plus size={13} /> Thêm lại
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quotation attachments */}
      <div className="glass-panel p-6">
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
          Báo giá nhà cung cấp <span style={{ color: 'hsl(var(--danger))' }}>*</span>
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
          {quotationFiles.map((file) => (
            <div key={file.id} style={{ position: 'relative' }}>
              <div
                style={{
                  width: 96, height: 96, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                  border: `1px solid ${file.status === 'error' ? '#dc2626' : file.status === 'success' ? '#16a34a' : 'hsl(var(--border))'}`,
                  background: 'hsl(var(--bg-card))', position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {file.isPdf ? (
                  <a
                    href={file.status === 'success' ? file.url : undefined}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: 8, textDecoration: 'none', color: 'hsl(var(--text-secondary))',
                      cursor: file.status === 'success' ? 'pointer' : 'default',
                    }}
                  >
                    <FileText size={28} color="hsl(var(--danger))" />
                    <span style={{ fontSize: 10, lineHeight: 1.2, textAlign: 'center', wordBreak: 'break-all' }}>
                      {file.name.length > 24 ? `${file.name.slice(0, 21)}...` : file.name}
                    </span>
                  </a>
                ) : (
                  <img
                    src={file.url}
                    alt={file.name}
                    onClick={() => file.status === 'success' && file.url && window.open(file.url, '_blank', 'noreferrer')}
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      cursor: file.status === 'success' ? 'zoom-in' : 'default',
                    }}
                  />
                )}

                {file.status === 'uploading' && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.45)',
                  }}>
                    <Loader2 size={20} color="#fff" className="animate-spin" />
                  </div>
                )}
                {file.status === 'error' && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(220,38,38,0.15)',
                  }}>
                    <AlertCircle size={20} color="#dc2626" />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeQuotation(file.id)}
                aria-label={`Xóa tệp ${file.name}`}
                style={{
                  position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                  border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {quotationFiles.length < MAX_QUOTATION_FILES && (
            <button
              type="button"
              onClick={() => quotationInputRef.current?.click()}
              style={{
                width: 96, height: 96, borderRadius: 'var(--radius-sm)',
                border: '1px dashed hsl(var(--border))', background: 'transparent',
                color: 'hsl(var(--text-muted))', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Upload size={18} />
              <span style={{ fontSize: 11 }}>Thêm báo giá</span>
            </button>
          )}
        </div>

        <input
          ref={quotationInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={handleQuotationChange}
        />

        {quotationError && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'hsl(var(--danger))' }}>{quotationError}</p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingBottom: 24 }}>
        <button
          type="button"
          onClick={() => navigate(backPath)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '8px 16px', borderRadius: 6, border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-secondary))',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s',
          }}
        >
          Hủy
        </button>
        <Button type="button" variant="primary" disabled={mutation.isPending || isUploadingQuotation} className="font-semibold" onClick={handleSubmit}>
          {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Đang lưu...</> : <><Plus size={16} /> Tạo đơn hàng</>}
        </Button>
      </div>
    </div>
  );
};
