import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button, ConfirmDialog, ImageLightbox } from '../../components/ui';
import {
  directPurchaseService,
  type PhaseBOQItemDto,
  type CreateDirectPurchaseItemInput,
} from '../../services/directPurchaseService';
import { materialService } from '../../services/materialService';
import { projectService } from '../../services/projectService';
import type { MaterialCatalog, MaterialConversion } from '../../types/material';
import type { WBSPhase } from '../../types/common';
import { Plus, Trash2, Upload, X, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiError } from '../../services/api';
import { DP_PURCHASE_DATE_ERRORS } from '../../constants/errorCodes';
import { todayVnISO, toInputDate } from '../../utils/dateHelpers';
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
  /** Đơn vị người dùng chọn. Số lượng và đơn giá đều tính theo đơn vị này. */
  unitId: number;
  quantity: string;
  unitPrice: string;
}

const emptyRow = (): ItemRow => ({
  materialId: 0,
  materialName: '',
  materialCode: '',
  unitId: 0,
  quantity: '',
  unitPrice: '',
});

interface UnitOption {
  unitId: number;
  unitName: string;
  /** Số đơn vị này trên một đơn vị cơ bản. Đơn vị cơ bản luôn là 1. */
  conversionRate: number;
}

export const CreateDirectPurchaseModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, projectId, draftId }) => {
  const isEditing = !!draftId;

  const [phases, setPhases] = useState<WBSPhase[]>([]);
  /** Ngày bắt đầu dự án (yyyy-mm-dd) — cận dưới của ngày mua. */
  const [projectStart, setProjectStart] = useState<string | undefined>();
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');
  const [boqItems, setBoqItems] = useState<PhaseBOQItemDto[]>([]);
  const [catalog, setCatalog] = useState<MaterialCatalog[]>([]);
  /** Bảng quy đổi theo vật tư, nạp một lần cho mỗi vật tư được chọn. */
  const [conversionsMap, setConversionsMap] = useState<Record<number, MaterialConversion[]>>({});
  const [loadingBOQ, setLoadingBOQ] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [reason, setReason] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayVnISO);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [purchaseDateError, setPurchaseDateError] = useState<string | null>(null);
  /** Ảnh hóa đơn đang xem phóng to. null = chưa mở. */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  /**
   * Chỉ hiện lỗi sau khi người dùng đã bấm nút — không "mắng" ngay lúc họ còn đang nhập dở.
   * Phân biệt hai mức vì lưu nháp dễ hơn gửi: nháp không đòi lý do, ảnh hóa đơn hay số lượng.
   */
  const [issueMode, setIssueMode] = useState<'draft' | 'submit' | null>(null);
  /** Lỗi backend trả về khi gửi thất bại, hiển thị ngay trong phiếu chứ không chỉ toast. */
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  /** Lỗi backend theo từng trường (ApiResponse.fieldErrors), key giữ nguyên dạng "Items[0].Quantity". */
  const [apiFieldErrors, setApiFieldErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- Nạp dữ liệu nền ----------
  useEffect(() => {
    if (!isOpen) return;
    // Lỗi của lần mở trước không được đọng lại sang lần mở sau.
    setIssueMode(null);
    setServerErrors([]);
    projectService.getPhases(String(projectId)).then(setPhases).catch(() => setPhases([]));
    projectService
      .getProjectById(String(projectId))
      .then(p => setProjectStart(p?.startDate ? toInputDate(p.startDate) : undefined))
      .catch(() => setProjectStart(undefined));
    materialService
      .getMaterials({ pageNumber: 1, pageSize: 1000 })
      .then(res => setCatalog(res.items ?? []))
      .catch(() => setCatalog([]));

    if (!draftId) {
      setSelectedPhaseId('');
      setBoqItems([]);
      setRows([]);
      setReason('');
      setPurchaseDate(todayVnISO());
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
        setPurchaseDate(toInputDate(dp.purchaseDate));
        setUploadedFiles(
          dp.invoicePhotoUrls.map((url, i) => ({
            id: `existing-${i}`,
            name: url.split('/').pop() || `hoa-don-${i + 1}`,
            url,
            status: 'success' as const,
          }))
        );
        // Nạp trước bảng quy đổi của các vật tư đã lưu, nếu không dropdown đơn vị sẽ trống
        // và ô "Định mức còn lại" không tính được.
        await Promise.all(dp.items.map(it => ensureConversionsLoaded(it.materialId)));

        setRows(dp.items.map(it => ({
          materialId: it.materialId,
          materialName: it.materialName,
          materialCode: it.materialCode,
          unitId: it.unitId,
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

  /** Nạp bảng quy đổi của một vật tư nếu chưa có. */
  const ensureConversionsLoaded = async (materialId: number) => {
    if (!materialId || conversionsMap[materialId]) return;
    try {
      const convs = await materialService.getConversions(materialId);
      setConversionsMap(prev => ({ ...prev, [materialId]: convs }));
    } catch {
      // Không chặn thao tác: thiếu bảng quy đổi thì chỉ còn đơn vị cơ bản để chọn.
      setConversionsMap(prev => ({ ...prev, [materialId]: [] }));
    }
  };

  /** Đơn vị cơ bản + các đơn vị quy đổi đã khai báo. Khớp danh sách backend chấp nhận. */
  const unitOptionsOf = (materialId: number): UnitOption[] => {
    const material = catalog.find(m => m.materialId === materialId);
    if (!material) return [];
    const base: UnitOption = {
      unitId: material.baseUnitId,
      unitName: material.baseUnitName ?? '',
      conversionRate: 1,
    };
    const alts = (conversionsMap[materialId] ?? [])
      .filter(c => c.alternativeUnitId !== material.baseUnitId && c.conversionRate > 0)
      .map(c => ({
        unitId: c.alternativeUnitId,
        unitName: c.alternativeUnitName ?? '',
        conversionRate: c.conversionRate,
      }));
    return [base, ...alts];
  };

  /**
   * Đơn vị mặc định lấy theo dòng BOQ. Chỉ mua khẩn cấp được vật tư có trong định mức nên nhánh
   * đơn vị cơ bản chỉ còn dùng cho phiếu nháp cũ có vật tư đã bị gỡ khỏi BOQ.
   */
  const defaultUnitIdOf = (materialId: number): number => {
    const boq = boqItems.find(b => b.materialId === materialId);
    if (boq) return boq.unitId;
    return catalog.find(m => m.materialId === materialId)?.baseUnitId ?? 0;
  };

  /**
   * Danh sách đơn vị cho một dòng. Trong lúc bảng quy đổi chưa nạp xong, đơn vị đang chọn có thể
   * chưa nằm trong danh sách — bổ sung tạm từ dòng BOQ để ô select không bị trống.
   */
  const unitOptionsForRow = (row: ItemRow): UnitOption[] => {
    const options = unitOptionsOf(row.materialId);
    if (!row.unitId || options.some(u => u.unitId === row.unitId)) return options;

    const boq = boqItems.find(b => b.materialId === row.materialId);
    if (boq && boq.unitId === row.unitId) {
      return [...options, {
        unitId: boq.unitId,
        unitName: boq.unitName,
        conversionRate: boq.conversionRate > 0 ? boq.conversionRate : 1,
      }];
    }
    return options;
  };

  const unitOf = (row: ItemRow): UnitOption | undefined =>
    unitOptionsForRow(row).find(u => u.unitId === row.unitId);

  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const updateRowMaterial = (i: number, materialId: number) => {
    const material = catalog.find(m => m.materialId === materialId);
    if (!material) return;

    void ensureConversionsLoaded(materialId);

    setRows(prev => prev.map((r, idx) => idx === i
      ? {
        ...r,
        materialId,
        materialName: material.name,
        materialCode: material.code,
        unitId: defaultUnitIdOf(materialId),
        quantity: '',
        unitPrice: '',
      }
      : r));
  };

  /**
   * Đổi đơn vị thì số lượng và đơn giá cũ không còn nghĩa (10 bao ≠ 10 tấn), nên xóa trắng
   * để bắt nhập lại theo đơn vị mới — giống cách phiếu xuất kho đang làm.
   */
  const updateRowUnit = (i: number, unitId: number) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, unitId, quantity: '', unitPrice: '' } : r)));

  const updateRowField = (i: number, field: 'quantity' | 'unitPrice', value: string) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  // ---------- Khoảng ngày mua hợp lệ ----------
  // Phiếu mua trực tiếp là hậu kiểm nên ngày mua không được ở tương lai.
  // Không bắt buộc nằm trong khoảng của giai đoạn: chỉ cần không sớm hơn ngày bắt đầu dự án
  // và không vượt quá ngày kết thúc giai đoạn. Backend chốt lại ở bước Gửi.
  const todayStr = todayVnISO();
  const selectedPhase = phases.find(p => String(p.id) === selectedPhaseId);
  const phaseEnd = selectedPhase?.endDate?.split('T')[0];
  const maxPurchaseDate = phaseEnd && phaseEnd < todayStr ? phaseEnd : todayStr;
  const minPurchaseDate = projectStart;

  const purchaseDateHint = (): string | null => {
    if (!purchaseDate) return null;
    if (purchaseDate > todayStr) return 'Ngày mua không được ở tương lai.';
    if (minPurchaseDate && purchaseDate < minPurchaseDate)
      return `Ngày mua phải từ ${toDisplayDate(minPurchaseDate)} (ngày bắt đầu dự án) trở đi.`;
    if (phaseEnd && purchaseDate > phaseEnd)
      return `Ngày mua vượt quá ngày kết thúc giai đoạn (${toDisplayDate(phaseEnd)}).`;
    return null;
  };
  const dateHint = purchaseDateHint();

  // ---------- Đối chiếu định mức BOQ (chỉ để cảnh báo, backend mới là nơi chốt) ----------
  // Người dùng có thể chọn đơn vị khác đơn vị của dòng BOQ, nên phải quy cả hai về đơn vị cơ bản
  // rồi mới so — đúng cách backend làm trong EvaluateBoqAsync.
  const rowBoqState = useMemo(() => rows.map(row => {
    if (!row.materialId) return { isOver: false, notInBoq: false, remainingLabel: '-' };

    const boq = boqItems.find(b => b.materialId === row.materialId);
    if (!boq) return { isOver: true, notInBoq: true, remainingLabel: 'Ngoài định mức' };

    const unit = unitOf(row);
    // Chưa nạp xong bảng quy đổi thì hiển thị theo đơn vị BOQ, chưa cảnh báo vội.
    if (!unit) return { isOver: false, notInBoq: false, remainingLabel: `${boq.remainingQuantity} ${boq.unitName}` };

    const boqRate = boq.conversionRate > 0 ? boq.conversionRate : 1;
    const remainingInBase = boq.remainingQuantity / boqRate;
    const remainingInRowUnit = remainingInBase * unit.conversionRate;

    return {
      isOver: (parseFloat(row.quantity) || 0) > remainingInRowUnit,
      notInBoq: false,
      remainingLabel: `${Math.round(remainingInRowUnit * 1000) / 1000} ${unit.unitName}`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, boqItems, catalog, conversionsMap]);

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

  // ---------- Validate realtime ----------
  // Kiểm ngay khi người dùng nhập, không đợi bấm nút. Các rule dưới đây phản chiếu rule của
  // backend (SubmitDirectPurchaseCommandHandler) — backend vẫn là chốt chặn cuối cùng.

  /** Lỗi của từng dòng vật tư, tách theo từng ô để gắn dòng đỏ đúng chỗ. */
  const rowErrors = useMemo(
    () =>
      rows.map((r, idx) => {
        const errors: { material?: string; unit?: string; quantity?: string; unitPrice?: string } = {};

        if (!r.materialId) errors.material = 'Chưa chọn vật tư.';
        else if (rows.findIndex(x => x.materialId === r.materialId) !== idx)
          errors.material = 'Trùng với dòng khác.';
        else if (!r.unitId) errors.unit = 'Chưa chọn đơn vị.';

        const qty = parseFloat(r.quantity);
        if (!qty || qty <= 0) errors.quantity = 'Phải lớn hơn 0.';

        const price = parseFloat(r.unitPrice);
        if (!price || price <= 0) errors.unitPrice = 'Phải lớn hơn 0.';

        return errors;
      }),
    [rows]
  );

  const invalidRowCount = useMemo(
    () => rowErrors.filter(e => Object.keys(e).length > 0).length,
    [rowErrors]
  );

  /**
   * Lỗi backend gắn theo từng dòng vật tư. Backend trả key dạng "Items[0].Quantity"
   * (xem SubmitDirectPurchaseCommandHandler) — tách ra chỉ số dòng và tên ô để gắn dòng đỏ
   * đúng chỗ thay vì dồn hết vào một thông báo chung.
   */
  const apiRowErrors = useMemo(() => {
    const byIndex: Record<number, { quantity?: string; unitPrice?: string; general?: string }> = {};
    for (const [key, message] of Object.entries(apiFieldErrors)) {
      const matched = /^items\[(\d+)\](?:\.(\w+))?/i.exec(key);
      if (!matched || !message) continue;
      const index = Number(matched[1]);
      const field = (matched[2] ?? '').toLowerCase();
      const entry = byIndex[index] ?? (byIndex[index] = {});
      if (field === 'quantity') entry.quantity = message;
      else if (field === 'unitprice') entry.unitPrice = message;
      else entry.general = message;
    }
    return byIndex;
  }, [apiFieldErrors]);

  /** Nháp chỉ cần đủ thông tin để lưu; phần còn lại backend chốt ở bước Gửi. */
  const draftIssues = useMemo(() => {
    const issues: string[] = [];
    if (!selectedPhaseId) issues.push('Chưa chọn giai đoạn.');
    if (!purchaseDate) issues.push('Chưa chọn ngày mua.');
    const filled = rows.filter(r => r.materialId);
    const dupe = filled.find((r, i) => filled.findIndex(x => x.materialId === r.materialId) !== i);
    if (dupe) issues.push(`Vật tư "${dupe.materialName}" bị trùng lặp.`);
    return issues;
  }, [selectedPhaseId, purchaseDate, rows]);

  const submitIssues = useMemo(() => {
    const issues = [...draftIssues];
    if (dateHint) issues.push(dateHint);
    if (!reason.trim()) issues.push('Chưa nhập lý do mua khẩn cấp.');
    if (uploadedFiles.length === 0) issues.push('Chưa tải ảnh hóa đơn.');
    if (rows.length === 0) issues.push('Chưa có vật tư nào trong phiếu.');
    if (invalidRowCount > 0) issues.push(`${invalidRowCount} dòng vật tư đang có lỗi.`);
    if (uploadedFiles.some(f => f.status === 'uploading')) issues.push('Ảnh hóa đơn đang tải lên.');
    if (uploadedFiles.some(f => f.status === 'error' || (f.status === 'success' && !f.url?.startsWith('http'))))
      issues.push('Có ảnh hóa đơn tải lên thất bại.');
    // Trùng lặp giữa draftIssues và rowErrors (vật tư trùng) — gộp lại cho gọn.
    return Array.from(new Set(issues));
  }, [draftIssues, dateHint, reason, uploadedFiles, rows.length, invalidRowCount]);

  const canSaveDraft = draftIssues.length === 0 && !uploadedFiles.some(f => f.status === 'uploading');

  const buildItems = (): CreateDirectPurchaseItemInput[] =>
    rows
      .filter(r => r.materialId)
      .map(r => ({
        materialId: r.materialId,
        unitId: r.unitId,
        quantity: parseFloat(r.quantity) || 0,
        unitPrice: parseFloat(r.unitPrice) || 0,
      }));

  const invoiceUrls = () =>
    uploadedFiles.filter(f => f.status === 'success' && f.url).map(f => f.url!);

  /** Ảnh đã tải lên xong — chỉ những ảnh này mới xem phóng to được. */
  const viewableInvoiceUrls = invoiceUrls();

  const persist = async (): Promise<{ id: number; message: string }> => {
    const payloadBody = {
      phaseId: Number(selectedPhaseId),
      reason: reason.trim(),
      purchaseDate: new Date(purchaseDate).toISOString(),
      items: buildItems(),
      invoicePhotoUrls: invoiceUrls(),
    };

    if (isEditing) {
      const result = await directPurchaseService.updateDraft(draftId!, payloadBody);
      return { id: draftId!, message: result.message };
    }
    const created = await directPurchaseService.create({ projectId, ...payloadBody });
    return { id: created.data.directPurchaseId, message: created.message };
  };

  const handleSaveDraft = async () => {
    setPurchaseDateError(null);
    setServerErrors([]);
    setApiFieldErrors({});

    // Nút luôn bấm được; thiếu gì thì chỉ ra cụ thể chứ không im lặng bỏ qua.
    if (!canSaveDraft) {
      setIssueMode('draft');
      toast.error(
        uploadedFiles.some(f => f.status === 'uploading')
          ? 'Ảnh hóa đơn đang tải lên, vui lòng đợi.'
          : 'Chưa lưu nháp được, vui lòng kiểm tra các mục còn thiếu.'
      );
      return;
    }

    setSaving('draft');
    try {
      const result = await persist();
      toast.success(result.message || 'Đã lưu nháp. Phiếu chưa được gửi và chưa ảnh hưởng tồn kho.');
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e.message || 'Không thể lưu phiếu nháp.';
      toast.error(msg);
      const apiErr = e instanceof ApiError ? e : undefined;
      if (apiErr?.fieldErrors) {
        const flat: Record<string, string> = {};
        for (const [key, messages] of Object.entries(apiErr.fieldErrors)) {
          flat[key] = Array.isArray(messages) ? messages.join(' ') : String(messages);
        }
        setApiFieldErrors(flat);
      }
      setServerErrors(apiErr?.errors?.length ? apiErr.errors : [msg]);
    } finally {
      setSaving(null);
    }
  };

  /**
   * Mở hộp xác nhận - việc gửi thực sự nằm ở doSubmit.
   *
   * Nút Gửi phiếu luôn bấm được: nút xám không nói cho người dùng biết họ còn thiếu gì,
   * nên thà cho bấm rồi chỉ ra đúng những chỗ chưa đạt.
   */
  const handleSubmit = () => {
    setPurchaseDateError(null);
    setServerErrors([]);
    setApiFieldErrors({});

    if (submitIssues.length > 0) {
      setIssueMode('submit');
      toast.error('Phiếu chưa gửi được, vui lòng kiểm tra các mục còn thiếu.');
      return;
    }

    setIssueMode(null);
    setIsConfirmOpen(true);
  };

  const doSubmit = async () => {
    setSaving('submit');
    try {
      const persisted = await persist();
      const result = await directPurchaseService.submit(persisted.id);
      // Không còn phân nhánh theo vượt/trong định mức: mọi phiếu đều qua Kế toán soát hóa đơn
      // rồi Giám đốc duyệt chi. Câu dưới chỉ là dự phòng khi backend không trả message.
      toast.success(result.message
        || 'Đã gửi phiếu. Tồn kho đã được cập nhật, phiếu đang chờ Kế toán soát hóa đơn.');
      setIsConfirmOpen(false);
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e.message || 'Không thể gửi phiếu mua trực tiếp.';
      setIsConfirmOpen(false);
      toast.error(msg);

      const apiErr = e instanceof ApiError ? e : undefined;

      // Lỗi theo từng trường/từng dòng → gắn dòng đỏ ngay dưới đúng ô nhập.
      const fieldErrors = apiErr?.fieldErrors;
      if (fieldErrors) {
        const flat: Record<string, string> = {};
        for (const [key, messages] of Object.entries(fieldErrors)) {
          flat[key] = Array.isArray(messages) ? messages.join(' ') : String(messages);
        }
        setApiFieldErrors(flat);
      }

      // Toast tự tắt sau vài giây, mà lỗi nghiệp vụ thường cần đọc kỹ để biết sửa gì —
      // nên giữ lại ngay trong phiếu. Ưu tiên danh sách lỗi chi tiết nếu backend có trả.
      setServerErrors(apiErr?.errors?.length ? apiErr.errors : [msg]);

      // Gắn lỗi vào ô "Ngày mua" theo errorCode của backend, không so khớp nội dung message.
      const code = apiErr?.errorCode;
      if (code && DP_PURCHASE_DATE_ERRORS.includes(code)) setPurchaseDateError(msg);
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

  // Lỗi các ô cấp phiếu: backend trả về trước, còn thiếu sót của người dùng chỉ hiện sau khi bấm Gửi.
  // Yêu cầu chỉ áp khi Gửi phiếu — lưu nháp vẫn cho để trống.
  const strict = issueMode === 'submit';

  const reasonError = apiFieldErrors.reason ?? (strict && !reason.trim() ? 'Vui lòng nhập lý do mua khẩn cấp.' : undefined);
  const invoiceError = strict && uploadedFiles.length === 0 ? 'Bắt buộc phải tải ảnh hóa đơn.' : undefined;
  const itemsError = apiFieldErrors.items ?? (strict && rows.length === 0 ? 'Phiếu phải có ít nhất một vật tư.' : undefined);
  // Giai đoạn và ngày mua thì cả lưu nháp lẫn gửi đều bắt buộc.
  const phaseError = apiFieldErrors.phaseId
    ?? (issueMode !== null && !selectedPhaseId ? 'Vui lòng chọn giai đoạn.' : undefined);
  const dateError = purchaseDateError
    ?? dateHint
    ?? (issueMode !== null && !purchaseDate ? 'Vui lòng chọn ngày mua.' : undefined);

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px',
    color: 'hsl(var(--text-secondary))',
  };
  /**
   * Khối lỗi máy chủ ở đầu phiếu. Thiếu sót của người dùng KHÔNG liệt kê ở đây — mỗi ô đã có
   * dòng đỏ riêng, gom thêm một danh sách phía trên chỉ là nói lại cùng một chuyện hai lần.
   */
  const issueBoxStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid hsl(var(--danger) / 0.4)',
    background: 'hsl(var(--danger) / 0.08)',
    color: 'hsl(var(--danger))',
    fontSize: '0.85rem',
  };

  const issueTitleStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '6px',
  };

  const issueListStyle: React.CSSProperties = {
    margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px',
  };

  /** Dòng đỏ nhỏ ngay dưới một ô nhập (dùng cho các trường ngoài bảng vật tư). */
  const cellErrorStyle: React.CSSProperties = {
    marginTop: '4px', fontSize: '0.75rem', color: 'hsl(var(--danger))',
  };

  /**
   * Chỗ dành sẵn cho dòng ghi chú/lỗi dưới mỗi ô trong bảng vật tư. Luôn chiếm chiều cao kể cả
   * khi không có lỗi, để lúc lỗi hiện ra hàng không cao thêm và ô nhập không bị xê dịch.
   */
  const cellNoteSlotStyle: React.CSSProperties = {
    minHeight: '15px', marginTop: '4px', fontSize: '0.75rem', lineHeight: '15px',
  };

  /** Các ô trong bảng vật tư neo theo đỉnh: căn giữa sẽ đẩy ô nhập lên khi dòng lỗi xuất hiện. */
  const bodyCellStyle: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'top' };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))',
    borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))',
    color: 'hsl(var(--text-primary))', fontSize: '0.9rem',
  };

  /**
   * Select cần chừa chỗ bên phải cho mũi tên do trình duyệt vẽ: mũi tên nằm đè lên phần
   * nội dung, nên tên vật tư dài sẽ bị chữ chạy vào dưới mũi tên. Thêm padding-right và
   * cắt bằng dấu ba chấm thay vì để chữ đâm vào mũi tên.
   */
  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    paddingRight: '28px',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
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
          {/* Không disable theo validate: bấm vào sẽ chỉ ra cụ thể còn thiếu gì. */}
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

        {/* Lỗi backend đứng trước: đó là lý do phiếu vừa bị từ chối, sát thời điểm nhất. */}
        {serverErrors.length > 0 && (
          <div style={issueBoxStyle}>
            <div style={issueTitleStyle}>
              <AlertTriangle size={15} /> Máy chủ từ chối gửi phiếu
            </div>
            <ul style={issueListStyle}>
              {serverErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        {/* Row 1: Phase + Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>
              Giai đoạn <span style={{ color: 'hsl(var(--danger))' }}>*</span>
            </label>
            <select
              value={selectedPhaseId}
              onChange={e => setSelectedPhaseId(e.target.value)}
              style={{ ...selectStyle, borderColor: phaseError ? 'hsl(var(--danger))' : 'hsl(var(--border))' }}
            >
              <option value="">-- Chọn giai đoạn --</option>
              {phases.map(ph => (
                <option key={ph.id} value={ph.id}>{ph.name}</option>
              ))}
            </select>
            {phaseError && <div style={cellErrorStyle}>{phaseError}</div>}
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
                style={{ ...inputStyle, border: `1px solid ${dateError ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`, color: 'transparent' }}
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
            {dateError && <div style={cellErrorStyle}>{dateError}</div>}
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
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'inherit',
              borderColor: reasonError ? 'hsl(var(--danger))' : 'hsl(var(--border))',
            }}
          />
          {reasonError && <div style={cellErrorStyle}>{reasonError}</div>}
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

          {itemsError && <div style={{ ...cellErrorStyle, marginTop: 0, marginBottom: '6px' }}>{itemsError}</div>}

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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '820px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'hsl(var(--bg-sidebar))', borderBottom: '1px solid hsl(var(--border))' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Vật tư</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Đơn vị</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>Định mức còn lại</th>
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
                    const warn = state.isOver && qty > 0;
                    const unitOptions = unitOptionsForRow(row);

                    // Thứ tự ưu tiên: lỗi backend vừa trả về > lỗi người dùng thấy ngay khi gõ >
                    // lỗi còn thiếu, chỉ bung ra sau khi đã bấm Gửi phiếu.
                    const apiRow = apiRowErrors[i];
                    const materialError = apiRow?.general ?? (issueMode !== null ? rowErrors[i]?.material : undefined);
                    const unitError = issueMode !== null ? rowErrors[i]?.unit : undefined;
                    const qtyError = apiRow?.quantity
                      ?? (row.quantity !== '' && qty <= 0 ? 'Phải lớn hơn 0.' : undefined)
                      ?? (strict ? rowErrors[i]?.quantity : undefined);
                    const priceError = apiRow?.unitPrice
                      ?? (row.unitPrice !== '' && price <= 0 ? 'Phải lớn hơn 0.' : undefined)
                      ?? (strict ? rowErrors[i]?.unitPrice : undefined);
                    const hasError = !!(materialError || unitError || qtyError || priceError);

                    return (
                      <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border))', backgroundColor: hasError ? 'hsl(var(--danger-glow))' : warn ? 'hsl(var(--warning) / 0.08)' : undefined }}>
                        <td style={{ ...bodyCellStyle, minWidth: '260px' }}>
                          <select
                            value={row.materialId || ''}
                            onChange={e => updateRowMaterial(i, Number(e.target.value))}
                            title={row.materialName ? `[${row.materialCode}] ${row.materialName}` : undefined}
                            style={{ ...selectStyle, padding: '4px 28px 4px 6px', fontSize: '0.85rem' }}
                          >
                            <option value="">-- Chọn --</option>
                            {catalog
                              // Chỉ mua khẩn cấp được vật tư đã có trong định mức BOQ của giai đoạn.
                              // Vật tư đang chọn sẵn vẫn giữ lại để phiếu nháp cũ không mất dòng.
                              .filter(m => m.materialId === row.materialId
                                || (boqItems.some(b => b.materialId === m.materialId)
                                    && !usedMaterialIds.includes(m.materialId)))
                              .map(m => {
                                const inBoq = boqItems.some(b => b.materialId === m.materialId);
                                return (
                                  <option key={m.materialId} value={m.materialId}>
                                    [{m.code}] {m.name}{inBoq ? '' : ' — không còn trong BOQ'}
                                  </option>
                                );
                              })}
                          </select>
                          <div style={{ ...cellNoteSlotStyle, color: 'hsl(var(--danger))' }}>{materialError ?? ''}</div>
                        </td>
                        <td style={{ ...bodyCellStyle, whiteSpace: 'nowrap' }}>
                          {row.materialId ? (
                            <select
                              value={row.unitId || ''}
                              onChange={e => updateRowUnit(i, Number(e.target.value))}
                              disabled={unitOptions.length <= 1}
                              title={unitOptions.length <= 1
                                ? 'Vật tư này chỉ có đơn vị cơ bản, chưa khai báo quy đổi.'
                                : 'Số lượng và đơn giá tính theo đơn vị này.'}
                              style={{ ...selectStyle, padding: '4px 28px 4px 6px', fontSize: '0.85rem', minWidth: '90px' }}
                            >
                              {unitOptions.length === 0 && <option value="">...</option>}
                              {unitOptions.map(u => (
                                <option key={u.unitId} value={u.unitId}>{u.unitName}</option>
                              ))}
                            </select>
                          ) : '-'}
                          <div style={{ ...cellNoteSlotStyle, color: 'hsl(var(--danger))' }}>{unitError ?? ''}</div>
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: 'right', color: state.notInBoq ? 'hsl(var(--warning))' : 'hsl(var(--text-secondary))', whiteSpace: 'nowrap', paddingTop: '14px' }}>
                          {state.remainingLabel}
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            className="dp-no-spinner"
                            value={row.quantity}
                            onChange={e => updateRowField(i, 'quantity', e.target.value)}
                            placeholder="0"
                            style={{ width: '80px', padding: '4px 6px', border: `1px solid ${qtyError ? 'hsl(var(--danger))' : warn ? 'hsl(var(--warning))' : 'hsl(var(--border))'}`, borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                          {/* Lỗi và cảnh báo vượt định mức dùng chung một chỗ - không bao giờ
                              cùng lúc, và giữ cho hàng luôn một chiều cao.
                              Không nhắc lại số còn lại: cột "Định mức còn lại" ngay bên trái đã có. */}
                          <div style={{ ...cellNoteSlotStyle, color: qtyError ? 'hsl(var(--danger))' : 'hsl(var(--warning))' }}>
                            {qtyError ?? (warn ? (state.notInBoq ? 'Ngoài định mức' : 'Vượt định mức') : '')}
                          </div>
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="dp-no-spinner"
                            value={row.unitPrice}
                            onChange={e => updateRowField(i, 'unitPrice', e.target.value)}
                            placeholder="0"
                            style={{ width: '110px', padding: '4px 6px', border: `1px solid ${priceError ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`, borderRadius: 'var(--radius-sm)', background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                          <div style={{ ...cellNoteSlotStyle, color: 'hsl(var(--danger))' }}>{priceError ?? ''}</div>
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: 'right', fontWeight: lineTotal > 0 ? 600 : 400, whiteSpace: 'nowrap', color: lineTotal > 0 ? undefined : 'hsl(var(--text-muted))', paddingTop: '14px' }}>
                          {lineTotal > 0 ? lineTotal.toLocaleString('vi-VN') + ' ₫' : '—'}
                        </td>
                        <td style={{ padding: '10px 4px', verticalAlign: 'top' }}>
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
          <label style={labelStyle}>
            Ảnh hóa đơn <span style={{ color: 'hsl(var(--danger))' }}>*</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
            {uploadedFiles.map(file => (
              <div key={file.id} style={{ position: 'relative', width: '80px', height: '80px' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: file.status === 'error' ? '1px solid #dc2626' : file.status === 'success' ? '1px solid #16a34a' : '1px solid hsl(var(--border))' }}>
                  <img
                    src={file.url}
                    alt={file.name}
                    onClick={() => {
                      // Chỉ xem được ảnh đã tải lên xong; ảnh đang tải còn là blob tạm.
                      const i = viewableInvoiceUrls.indexOf(file.url ?? '');
                      if (i >= 0) setLightboxIndex(i);
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: file.status === 'success' ? 'zoom-in' : 'default' }}
                  />

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
          {invoiceError && <div style={cellErrorStyle}>{invoiceError}</div>}
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

    <ImageLightbox
      images={viewableInvoiceUrls}
      index={lightboxIndex}
      onClose={() => setLightboxIndex(null)}
      onIndexChange={setLightboxIndex}
      label="Ảnh hóa đơn"
    />

    <ConfirmDialog
      isOpen={isConfirmOpen}
      onClose={() => setIsConfirmOpen(false)}
      onConfirm={doSubmit}
      title="Gửi phiếu mua khẩn cấp"
      message={
        'Sau khi gửi, vật tư được nhập kho ngay và phiếu không thể sửa. '
        + 'Khoản chi phải qua Kế toán soát hóa đơn rồi Giám đốc duyệt mới được hoàn tiền.'
      }
      confirmText="Gửi phiếu"
      cancelText="Xem lại"
      isLoading={saving === 'submit'}
    />
    </>
  );
};
