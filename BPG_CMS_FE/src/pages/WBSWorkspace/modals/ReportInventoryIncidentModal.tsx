import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { incidentService } from '../../../services/incidentService';
import { UploadCloud, X, Plus, Trash2, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LazyImage } from '../../../utils/imageOptimizer';
import { compressAndUploadFile } from '../../../utils/uploadHelper';
import type { UploadedFileState } from '../../../utils/uploadHelper';
import { directPurchaseService } from '../../../services/directPurchaseService';
import type { PhaseBOQItemDto } from '../../../services/directPurchaseService';
import { inventoryService } from '../../../services/inventoryService';
import { serializeInventoryIncidentDamage } from '../../../utils/inventoryIncidentDamage';
import { isDiscreteUnit } from '../../../utils/unitHelpers';

const getLocalISOString = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
};

const schema = z.object({
  incidentType: z.enum(['InventoryLoss', 'InventoryDamage']),
  description: z.string().min(5, 'Mô tả sự cố phải có ít nhất 5 ký tự'),
  incidentDate: z.string()
    .min(1, 'Vui lòng chọn ngày phát hiện')
    .refine((val) => {
      const selected = new Date(val);
      const now = new Date();
      return selected <= now;
    }, 'Ngày/Giờ phát hiện không được vượt quá thời gian hiện tại'),
  estimatedLaborDays: z.coerce.number().optional().default(0),
  estimatedDelayDays: z.coerce.number().optional().default(0),
});

type FormData = z.infer<typeof schema>;

interface ReportInventoryIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  phaseId: string;
  phaseName: string;
  user: { id: string; name: string } | null;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

interface IncidentMaterialOption {
  materialId: number;
  materialCode: string;
  materialName: string;
  unitId: number;
  unitName: string;
  conversionRate: number;
  stockQuantity: number;
  phaseBoqQuantity?: number;
  isInPhaseBoq: boolean;
}

type DamagedMaterial = IncidentMaterialOption & { rawQuantity?: string; quantityLost: number };

const formatQuantity = (value: number) => value.toLocaleString('vi-VN', {
  maximumFractionDigits: 3,
});

export const ReportInventoryIncidentModal: React.FC<ReportInventoryIncidentModalProps> = ({
  isOpen,
  onClose,
  projectId,
  phaseId,
  phaseName,
  onSuccess,
  onError,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [dragging, setDragging] = useState(false);

  const [damagedMaterials, setDamagedMaterials] = useState<DamagedMaterial[]>([]);
  const [inventoryItems, setInventoryItems] = useState<IncidentMaterialOption[]>([]);
  const [loadingBOQ, setLoadingBOQ] = useState(false);
  const [activeIncidentId, setActiveIncidentId] = useState<number | null>(null);

  React.useEffect(() => {
    if (isOpen && phaseId) {
      setLoadingBOQ(true);
      setInventoryItems([]);
      setDamagedMaterials([]);
      setActiveIncidentId(null);
      Promise.all([
        directPurchaseService.getPhaseBOQ(Number(projectId), Number(phaseId)).catch(() => []),
        inventoryService.getCurrentInventory(Number(projectId)).catch(() => []),
        incidentService.getIncidents(Number(projectId)).catch(() => [])
      ])
        .then(([boqRes, invRes, incidents]) => {
          const terminalStatuses = new Set(['Resolved', 'Closed', 'Rejected', 'Approved']);
          const activeIncident = incidents.find(incident =>
            incident.phaseId === Number(phaseId)
            && (incident.incidentType === 'InventoryLoss' || incident.incidentType === 'InventoryDamage')
            && !terminalStatuses.has(incident.status)
          );
          setActiveIncidentId(activeIncident?.incidentId ?? null);

          const boqByMaterial = new Map<number, PhaseBOQItemDto>();
          (boqRes || []).forEach(item => {
            if (!boqByMaterial.has(item.materialId)) boqByMaterial.set(item.materialId, item);
          });

          // Inventory is the source of selectable materials. A matching phase BOQ row
          // only enriches the option with its display unit and planned quantity.
          const optionsByMaterial = new Map<number, IncidentMaterialOption>();
          (invRes || []).forEach(inv => {
            const availableBaseQuantity = inv.availableQuantity ?? inv.quantity ?? 0;
            if (availableBaseQuantity <= 0) return;

            const boqItem = boqByMaterial.get(inv.materialId);
            const conversionRate = boqItem && boqItem.conversionRate > 0
              ? boqItem.conversionRate
              : 1;
            const existing = optionsByMaterial.get(inv.materialId);

            if (existing) {
              existing.stockQuantity += availableBaseQuantity * existing.conversionRate;
              return;
            }

            optionsByMaterial.set(inv.materialId, {
              materialId: inv.materialId,
              materialCode: inv.materialCode,
              materialName: inv.materialName,
              unitId: boqItem?.unitId ?? inv.unitId,
              unitName: boqItem?.unitName ?? inv.unitName,
              conversionRate,
              stockQuantity: availableBaseQuantity * conversionRate,
              phaseBoqQuantity: boqItem?.boqQuantity,
              isInPhaseBoq: !!boqItem,
            });
          });

          setInventoryItems([...optionsByMaterial.values()].sort((left, right) => {
            if (left.isInPhaseBoq !== right.isInPhaseBoq) return left.isInPhaseBoq ? -1 : 1;
            return left.materialCode.localeCompare(right.materialCode, 'vi');
          }));
        })
        .catch(console.error)
        .finally(() => setLoadingBOQ(false));
    }
  }, [isOpen, projectId, phaseId]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<any>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      incidentType: 'InventoryLoss',
      description: '',
      incidentDate: getLocalISOString(),
      estimatedLaborDays: 0,
      estimatedDelayDays: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let finalDesc = data.description.trim();

      const d = new Date(data.incidentDate);
      const dateStr = `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${d.toLocaleDateString('vi-VN')}`;
      finalDesc += `\n\n**Ngày/Giờ phát hiện:** ${dateStr}`;

      // Collect successfully uploaded URLs
      const successfulUrls = uploadedFiles
        .filter(f => f.status === 'success' && f.url)
        .map(f => f.url!);

      if (successfulUrls.length > 0) {
        finalDesc += '\n\n**Hình ảnh đính kèm:**\n' + successfulUrls.map((url, i) => `![Ảnh ${i + 1}](${url})`).join('\n');
      }

      const finalDamageDesc = serializeInventoryIncidentDamage(damagedMaterials);

      await incidentService.createAndAssessIncident({
        projectId: Number(projectId),
        phaseId: Number(phaseId), // Passed PhaseId instead of TaskId
        incidentType: data.incidentType,
        description: finalDesc,
        damageDescription: finalDamageDesc,
        estimatedMaterialLoss: 0,
        estimatedLaborDays: data.estimatedLaborDays ?? 0,
        estimatedDelayDays: data.estimatedDelayDays ?? 0,
      });
    },
    onSuccess: () => {
      onSuccess('Báo cáo sự cố vật tư kho đã được lưu và gửi thông báo tới Kế toán xác minh.');
      reset();
      setUploadedFiles([]);
      onClose();
    },
    onError: (err: any) => {
      onError(err.message || 'Lỗi khi báo cáo sự cố vật tư.');
    },
  });

  const onSubmit = (data: any) => {
    if (activeIncidentId) {
      toast.error(`Giai đoạn này còn sự cố vật tư #${activeIncidentId} chưa xử lý xong.`);
      return;
    }

    if (uploadedFiles.some(f => f.status === 'uploading')) {
      toast.error('Vui lòng chờ hình ảnh tải lên hoàn tất.');
      return;
    }
    if (uploadedFiles.some(f => f.status === 'error')) {
      toast.error('Có hình ảnh tải lên bị lỗi. Vui lòng xóa ảnh lỗi và thử lại.');
      return;
    }

    if (damagedMaterials.length === 0) {
      toast.error('Vui lòng thêm ít nhất một vật tư bị mất hoặc hư hỏng.');
      return;
    }

    const unselectedItem = damagedMaterials.find(m => !m.materialId || m.materialId === 0);
    if (unselectedItem) {
      toast.error('Vui lòng chọn vật tư cho tất cả các dòng.');
      return;
    }

    const emptyItem = damagedMaterials.find(m => !m.quantityLost || isNaN(m.quantityLost) || m.quantityLost <= 0);
    if (emptyItem) {
      toast.error(`Vui lòng nhập SL > 0 cho vật tư "${emptyItem.materialName || 'đã chọn'}".`);
      return;
    }

    const nonIntegerDiscreteItem = damagedMaterials.find(
      m => isDiscreteUnit(m.unitName) && m.quantityLost % 1 !== 0
    );
    if (nonIntegerDiscreteItem) {
      toast.error(`Đơn vị tính '${nonIntegerDiscreteItem.unitName}' của vật tư "${nonIntegerDiscreteItem.materialName}" yêu cầu số lượng phải là số nguyên.`);
      return;
    }

    const overStockItem = damagedMaterials.find(m => m.quantityLost > m.stockQuantity);
    if (overStockItem) {
      toast.error(`Số lượng thiệt hại của "${overStockItem.materialName}" (${formatQuantity(overStockItem.quantityLost)} ${overStockItem.unitName}) không được vượt quá tồn khả dụng (${formatQuantity(overStockItem.stockQuantity)} ${overStockItem.unitName}).`);
      return;
    }

    mutation.mutate(data);
  };

  const onInvalid = (errors: any) => {
    console.error('[ReportInventoryIncidentModal] Validation errors:', errors);
    const firstError = Object.values(errors)[0] as any;
    const msg = firstError?.message || 'Vui lòng kiểm tra lại các trường bắt buộc.';
    toast.error(msg);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addImages(Array.from(e.dataTransfer.files));
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addImages(Array.from(e.target.files));
    e.target.value = '';
  };
  const addImages = (files: File[]) => {
    const remaining = 5 - uploadedFiles.length;
    if (remaining <= 0) { toast.error('Đã đạt giới hạn tối đa 5 ảnh.'); return; }
    const MAX = 10 * 1024 * 1024;
    if (files.some(f => f.size > MAX)) { toast.error('Hình ảnh không được vượt quá 10MB.'); return; }
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, remaining);
    if (!valid.length) return;

    valid.forEach(file => {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);

      const newFileState: UploadedFileState = {
        id: tempId,
        name: file.name,
        url: localUrl,
        status: 'uploading',
        file,
      };

      setUploadedFiles(prev => [...prev, newFileState]);

      compressAndUploadFile(
        file,
        'incidents',
        (uploadedUrl) => {
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'success', url: uploadedUrl } : f)
          );
        },
        () => {
          toast.error(`Không thể tải ảnh ${file.name} lên.`);
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'error' } : f)
          );
        }
      );
    });
  };

  const retryUpload = (id: string) => {
    const target = uploadedFiles.find(f => f.id === id);
    if (!target || !target.file) return;

    setUploadedFiles(prev =>
      prev.map(f => f.id === id ? { ...f, status: 'uploading' } : f)
    );

    compressAndUploadFile(
      target.file,
      'incidents',
      (uploadedUrl) => {
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: 'success', url: uploadedUrl } : f)
        );
      },
      () => {
        toast.error(`Không thể tải ảnh ${target.name} lên.`);
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: 'error' } : f)
        );
      }
    );
  };

  const removeImage = (id: string) => {
    setUploadedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target && target.url && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleAddMaterialRow = () => {
    setDamagedMaterials(prev => [
      ...prev,
      {
        materialId: 0,
        materialCode: '',
        materialName: '',
        unitId: 0,
        unitName: '',
        conversionRate: 1,
        stockQuantity: 0,
        isInPhaseBoq: false,
        rawQuantity: '',
        quantityLost: 0,
      }
    ]);
  };

  const handleSelectMaterial = (idx: number, selectedIdStr: string) => {
    const selectedId = Number(selectedIdStr);
    const found = inventoryItems.find(it => it.materialId === selectedId);
    if (!found) return;

    setDamagedMaterials(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...found,
        rawQuantity: updated[idx]?.rawQuantity || '',
        quantityLost: updated[idx]?.quantityLost || 0,
      };
      return updated;
    });
  };

  const handleQuantityChange = (idx: number, raw: string) => {
    const num = parseFloat(raw);
    setDamagedMaterials(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        rawQuantity: raw,
        quantityLost: isNaN(num) ? 0 : num,
      };
      return updated;
    });
  };

  const handleRemoveMaterialRow = (idx: number) => {
    setDamagedMaterials(prev => prev.filter((_, i) => i !== idx));
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lập Báo cáo Sự cố Vật tư Kho" width="full" maxWidth="1180px">

      <div className="text-sm bg-blue-50 text-blue-800 p-3 rounded-md border border-blue-100 mb-4 flex items-center justify-between">
        <span>Giai đoạn: <strong>{phaseName}</strong></span>
        <span className="text-xs font-semibold text-blue-600 bg-blue-100/70 px-2 py-0.5 rounded">Sự cố Vật tư Kho</span>
      </div>

      {activeIncidentId && (
        <div className="text-sm bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 mb-4 flex items-start gap-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>
            Giai đoạn này đang có sự cố vật tư <strong>#{activeIncidentId}</strong> chưa xử lý xong.
            Chỉ có thể lập báo cáo mới sau khi sự cố hiện tại đã được giải quyết.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-[4.2fr_5.8fr] gap-6" style={{ minHeight: '480px' }}>
          
          {/* ── PHẦN 1: THÔNG TIN SỰ CỐ ────────────────────────── */}
          <div className="flex flex-col gap-3">
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Phần 1: Thông tin Sự cố
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Loại sự cố vật tư <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                </label>
                <select className="input mt-1" {...register('incidentType')}>
                  <option value="InventoryLoss">Mất mát vật tư</option>
                  <option value="InventoryDamage">Hư hỏng vật tư</option>
                </select>
              </div>

              <div>
                <label htmlFor="report-desc" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Mô tả nguyên nhân và tình trạng sự cố
                  {' '}<span style={{ color: 'hsl(var(--danger))' }}>*</span>
                </label>
                <textarea
                  id="report-desc"
                  className="input mt-1"
                  placeholder="Mô tả vật tư bị mất/hư hỏng, số lượng ước tính, điều kiện phát hiện..."
                  {...register('description')}
                  rows={3}
                  style={{ resize: 'none' }}
                />
                {(errors as any).description && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{String((errors as any).description?.message)}</span>}
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Ngày/Giờ phát hiện <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  className="input mt-1"
                  max={getLocalISOString()}
                  {...register('incidentDate')}
                />
                {(errors as any).incidentDate && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{String((errors as any).incidentDate?.message)}</span>}
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Hình ảnh hiện trường (Tối đa 5 ảnh)
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => { if (uploadedFiles.length < 5) document.getElementById('inventory-incident-img-input')?.click(); }}
                  className={`mt-1 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${
                    dragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/80'
                  } ${uploadedFiles.length >= 5 ? 'cursor-not-allowed opacity-90' : ''}`}
                  style={{ padding: uploadedFiles.length > 0 ? '16px' : '24px' }}
                >
                  <input
                    id="inventory-incident-img-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploadedFiles.length >= 5}
                  />

                  {uploadedFiles.length > 0 ? (
                    <div>
                      <div
                        className="flex flex-wrap items-center justify-center gap-3 my-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.id}
                            className={`relative w-16 h-16 rounded shadow-sm border overflow-hidden group ${
                              file.status === 'error' ? 'border-red-500' : file.status === 'success' ? 'border-green-500' : 'border-slate-200'
                            }`}
                          >
                            <LazyImage src={file.url} alt={file.name} widthOption={200} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                            {file.status === 'uploading' && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Loader2 size={14} className="animate-spin text-white" />
                              </div>
                            )}

                            {file.status === 'error' && (
                              <>
                                <span className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[8px] text-center py-0.5 font-bold">Lỗi</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    retryUpload(file.id);
                                  }}
                                  className="absolute top-1 left-1 bg-blue-600 text-white rounded-full p-0.5 opacity-90 hover:opacity-100 transition-opacity z-10"
                                  title="Thử lại upload"
                                >
                                  <RotateCcw size={10} />
                                </button>
                              </>
                            )}

                            {file.status === 'success' && (
                              <span className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-[8px] text-center py-0.5 font-bold">Mới</span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(file.id);
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-90 hover:opacity-100 transition-opacity z-10"
                              title="Xóa ảnh"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {uploadedFiles.length < 5 ? (
                        <div className="mt-3 text-xs text-blue-600 font-semibold">
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => document.getElementById('inventory-incident-img-input')?.click()}
                          >
                            + Thêm ảnh khác (Đã chọn {uploadedFiles.length}/5 ảnh)
                          </span>
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-slate-500 font-medium">
                          Đã đạt tối đa 5/5 ảnh
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <UploadCloud size={32} className="text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-600 mb-0.5">
                        Kéo thả hình ảnh vào đây hoặc click để chọn ảnh
                      </p>
                      <span className="text-xs text-slate-400">
                        Hỗ trợ tối đa 5 ảnh, dung lượng tối đa 10MB/ảnh
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── PHẦN 2: DANH SÁCH VẬT TƯ THIỆT HẠI ──────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-slate-700">
                Danh sách vật tư thiệt hại <span className="text-red-500">*</span>
              </span>
              <button
                type="button"
                onClick={handleAddMaterialRow}
                disabled={loadingBOQ || (inventoryItems.length > 0 && damagedMaterials.length >= inventoryItems.length)}
                className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
              >
                <Plus size={14} /><span>Thêm vật tư</span>
              </button>
            </div>

            {loadingBOQ ? (
              <div className="p-8 text-center text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                <Loader2 size={18} className="animate-spin inline mr-2 text-blue-500" />
                Đang tải danh sách vật tư từ kho và BOQ...
              </div>
            ) : damagedMaterials.length > 0 ? (
              <div className="flex flex-col gap-3 max-h-[440px] overflow-y-auto pr-1">
                {damagedMaterials.map((m, idx) => {
                  const isDiscrete = m.unitName ? isDiscreteUnit(m.unitName) : false;
                  const isOverStock = m.materialId > 0 && m.quantityLost > m.stockQuantity;
                  const isDiscreteError = m.materialId > 0 && isDiscrete && m.quantityLost > 0 && m.quantityLost % 1 !== 0;

                  const availableOptions = inventoryItems.filter(
                    inv => inv.materialId === m.materialId || !damagedMaterials.some((d, dIdx) => d.materialId === inv.materialId && dIdx !== idx)
                  );

                  return (
                    <div key={idx} className="flex flex-col gap-2.5 p-3.5 bg-slate-50/60 border border-slate-200 rounded-lg shadow-sm">
                      <div className="grid grid-cols-[1fr_105px_95px_auto] gap-2 items-start">
                        {/* Material Selection */}
                        <div className="min-w-0">
                          <SearchSelect
                            options={availableOptions.map(inv => ({
                              label: inv.materialName,
                              value: String(inv.materialId),
                              sublabel: `Mã: ${inv.materialCode} · Tồn: ${formatQuantity(inv.stockQuantity)} ${inv.unitName}${inv.isInPhaseBoq ? ` · BOQ: ${formatQuantity(inv.phaseBoqQuantity ?? 0)} ${inv.unitName}` : ''}`
                            }))}
                            value={m.materialId ? String(m.materialId) : ''}
                            onChange={(val) => handleSelectMaterial(idx, val)}
                            placeholder="-- Chọn vật tư --"
                            error={!m.materialId}
                          />
                          {!m.materialId && <p className="text-red-500 text-xs mt-1">Vui lòng chọn vật tư</p>}
                        </div>

                        {/* Quantity */}
                        <div className="min-w-0">
                          <input
                            type="number"
                            min={isDiscrete ? 1 : 0.01}
                            step={isDiscrete ? "1" : "any"}
                            placeholder="SL"
                            value={m.rawQuantity !== undefined ? m.rawQuantity : (m.quantityLost ? String(m.quantityLost) : '')}
                            onChange={e => handleQuantityChange(idx, e.target.value)}
                            disabled={!m.materialId}
                            className={`w-full text-sm px-3 py-2 rounded-md border ${
                              isOverStock || isDiscreteError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'
                            } bg-white text-slate-900 focus:outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed text-center font-medium`}
                          />
                          {isOverStock && <p className="text-red-500 text-[11px] mt-1 font-medium">Vượt tồn kho</p>}
                          {isDiscreteError && <p className="text-red-500 text-[11px] mt-1 font-medium">Phải là số nguyên</p>}
                        </div>

                        {/* Unit */}
                        <div className="min-w-0">
                          <select
                            disabled
                            className="w-full text-sm px-2.5 py-2 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none cursor-default font-medium text-center"
                            value={m.unitName || ''}
                          >
                            <option value={m.unitName || ''}>{m.unitName ? m.unitName : '-- ĐVT --'}</option>
                          </select>
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterialRow(idx)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0"
                          title="Xóa vật tư"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      {/* Bottom Info Bar matching CreateMaterialRequestModal */}
                      {m.materialId > 0 && (
                        <div className="flex items-center justify-between text-xs px-3 py-2 bg-white border border-slate-100 rounded-md shadow-sm">
                          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                            <span>Tồn khả dụng:</span>
                            <strong className="text-slate-800 font-semibold">{formatQuantity(m.stockQuantity)} {m.unitName}</strong>
                            {m.isInPhaseBoq && (
                              <>
                                <span className="text-slate-300">|</span>
                                <span>Định mức BOQ:</span>
                                <strong className="text-slate-700 font-semibold">{formatQuantity(m.phaseBoqQuantity ?? 0)} {m.unitName}</strong>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 font-medium">
                            <span>Trạng thái:</span>
                            {isOverStock ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
                                Vượt tồn kho
                              </span>
                            ) : isDiscreteError ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                                Cần số nguyên
                              </span>
                            ) : m.quantityLost > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                                Trong định mức
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
                                Chưa nhập SL
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200 italic">
                {inventoryItems.length === 0
                  ? 'Dự án không có vật tư nào còn tồn khả dụng.'
                  : 'Chưa có vật tư nào được chọn. Bấm "+ Thêm vật tư" để bắt đầu.'}
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ACTIONS ──────────────────────────────────── */}
        <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-[hsl(var(--border))]">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={mutation.isPending || loadingBOQ || activeIncidentId !== null}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'hsl(210, 70%, 45%)' }}
          >
            {mutation.isPending && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {mutation.isPending ? 'Đang lưu...' : activeIncidentId ? 'Đang có sự cố chưa xử lý' : '📦 Gửi báo cáo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
