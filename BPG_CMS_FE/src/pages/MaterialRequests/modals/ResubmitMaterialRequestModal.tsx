import React, { useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { projectService } from '../../../../src/services/projectService';
import { materialService } from '../../../../src/services/materialService';
import type { MaterialCatalog } from '../../../../src/types/material';
import type { MaterialRequest, WBSPhase } from '../../../types/common';
import { Modal } from '../../../../src/components/ui/Modal';
import { SearchSelect } from '../../../../src/components/ui/SearchSelect';
import { isDiscreteUnit } from '../../../../src/utils/unitHelpers';

const requestItemSchema = z.object({
  name: z.string().min(1, 'Vui lòng chọn vật tư.'),
  quantity: z.number({ message: 'Vui lòng nhập số lượng.' }).min(0.01, 'Số lượng phải > 0'),
  unit: z.any()
}).superRefine((data, ctx) => {
  if (data.name && data.name.trim() !== '') {
    // 1. Verify unit is selected
    if (!data.unit || data.unit.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Vui lòng chọn ĐVT',
        path: ['unit']
      });
    }

    // 2. Discrete unit check
    if (isDiscreteUnit(data.unit)) {
      if (data.quantity % 1 !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Đơn vị "${data.unit}" yêu cầu số lượng phải là số nguyên.`,
          path: ['quantity']
        });
      }
    }
  }
});

const resubmitMaterialRequestSchema = z.object({
  type: z.enum(['normal', 'emergency']),
  reason: z.string().optional(),
  invoiceImage: z.string().optional(),
  items: z.array(requestItemSchema).min(1, 'Cần ít nhất 1 vật tư')
}).superRefine((data, ctx) => {
  // Check duplicates
  const counts: Record<string, number> = {};
  data.items.forEach(it => {
    if (it.name && it.name.trim() !== '') {
      counts[it.name] = (counts[it.name] || 0) + 1;
    }
  });

  data.items.forEach((it, idx) => {
    if (it.name && counts[it.name] > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Vật tư này bị trùng lặp trong danh sách.',
        path: ['items', idx, 'name']
      });
    }
  });

  if (data.type === 'emergency' && (!data.invoiceImage || data.invoiceImage.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mua ngoài khẩn cấp bắt buộc phải tải ảnh hóa đơn.',
      path: ['invoiceImage']
    });
  }
});

type ResubmitMaterialRequestForm = z.infer<typeof resubmitMaterialRequestSchema>;

export interface ResubmitMaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: MaterialRequest;
  projectId: string;
  user: any;
  allMaterialRequests: MaterialRequest[];
  phases: WBSPhase[];
  onSuccess: (msg: string) => void;
  onError?: (msg: string) => void;
}

export const ResubmitMaterialRequestModal: React.FC<ResubmitMaterialRequestModalProps> = ({
  isOpen,
  onClose,
  request,


  allMaterialRequests,
  phases,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const [allCatalogs, setAllCatalogs] = React.useState<MaterialCatalog[]>([]);
  const [materialUnits, setMaterialUnits] = React.useState<Record<string, string[]>>({});
  const [conversionsMap, setConversionsMap] = React.useState<Record<string, { alternativeUnitName: string; conversionRate: number }[]>>({});

  useEffect(() => {
    materialService.getMaterials({ pageSize: 1000 }).then(res => {
      setAllCatalogs(res.items || []);
    }).catch(console.error);
  }, []);

  const { register, control, handleSubmit, reset, watch, setValue, setError, trigger, formState: { errors } } = useForm<ResubmitMaterialRequestForm>({
    resolver: zodResolver(resubmitMaterialRequestSchema),
    mode: 'onTouched',
    defaultValues: {
      type: request.type || 'normal',
      reason: request.reason || '',
      invoiceImage: request.invoiceImage || '',
      items: request.items.length > 0
        ? request.items.map(it => ({ name: it.name, quantity: it.quantity, unit: it.unit }))
        : [{ name: '', quantity: 1, unit: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const type = watch('type');
  const watchedItems = watch('items') || [];
  const isPhaseRequest = !request.taskId;
  const phase = phases.find(p => p.id === request.phaseId);
  const task = request.taskId ? { id: request.taskId, name: request.taskName || '' } : undefined;

  // Tính tổng số lượng vật tư Phase đã yêu cầu
  const phaseRequestedMaterials = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; unit: string; conversionRate?: number }>();
    allMaterialRequests.forEach(r => {
      // Bỏ qua chính yêu cầu đang sửa để không bị trùng lắp dữ liệu cũ
      if (r.id !== request.id && r.phaseId === request.phaseId && !r.taskId && r.status !== 'rejected') {
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
  }, [allMaterialRequests, request.phaseId, request.id]);

  // Nguồn vật tư gốc để chọn
  const sourceMaterials = task ? phaseRequestedMaterials : (phase?.materials || []);
  const displayMaterials = sourceMaterials.length > 0 ? sourceMaterials : allCatalogs;

  // Preload conversions and units for all displayMaterials on open
  useEffect(() => {
    const loadAllConversions = async () => {
      if (displayMaterials.length === 0) return;
      const mapConvs: Record<string, { alternativeUnitName: string; conversionRate: number }[]> = {};
      const mapUnits: Record<string, string[]> = {};

      await Promise.all(
        displayMaterials.map(async (sm) => {
          let catalog = allCatalogs.find(c => c.name === sm.name);
          if (catalog) {
            try {
              const baseUnit = catalog.baseUnitName || '';
              const convs = await materialService.getConversions(catalog.materialId);
              mapConvs[sm.name] = convs.map(c => ({
                alternativeUnitName: c.alternativeUnitName || '',
                conversionRate: c.conversionRate
              }));
              const altUnits = convs.map(c => c.alternativeUnitName).filter(Boolean) as string[];
              mapUnits[sm.name] = Array.from(new Set([baseUnit, ...altUnits]));
            } catch (err) {
              console.error(err);
            }
          }
        })
      );
      setConversionsMap(mapConvs);
      setMaterialUnits(prev => ({ ...prev, ...mapUnits }));
    };
    loadAllConversions();
  }, [displayMaterials, allCatalogs]);

  const handleMaterialChange = async (idx: number, name: string) => {
    const selectedItem = displayMaterials.find(m => m.name === name);
    const selectedUnitName = selectedItem ? ('unit' in selectedItem ? (selectedItem as any).unit : (selectedItem as any).baseUnitName) : '';

    let catalog = allCatalogs.find(c => c.name === name && c.baseUnitName === selectedUnitName);
    if (!catalog) {
      catalog = allCatalogs.find(c => c.name === name);
    }

    if (!catalog) return;

    const baseUnit = catalog.baseUnitName || '';
    let units = [baseUnit];
    let convList: { alternativeUnitName: string; conversionRate: number }[] = [];

    try {
      const convs = await materialService.getConversions(catalog.materialId);
      convList = convs.map(c => ({
        alternativeUnitName: c.alternativeUnitName || '',
        conversionRate: c.conversionRate
      }));
      const altUnits = convs.map(c => c.alternativeUnitName).filter(Boolean) as string[];
      units = Array.from(new Set([baseUnit, ...altUnits]));
    } catch (err) {
      console.error('Error fetching conversions:', err);
    }

    setMaterialUnits(prev => ({ ...prev, [name]: units }));
    setConversionsMap(prev => ({ ...prev, [name]: convList }));
    setValue(`items.${idx}.unit`, baseUnit, { shouldValidate: true, shouldTouch: true, shouldDirty: true });
  };

  const getUsedQtyInBase = (materialName: string) => {
    let sumInBase = 0;
    allMaterialRequests.forEach(r => {
      // Bỏ qua chính yêu cầu đang sửa đổi để không cộng dồn số lượng cũ
      if (r.id !== request.id && r.phaseId === request.phaseId && r.status !== 'rejected' && r.status !== 'cancelled') {
        if (task && r.taskId) {
          const item = r.items.find(i => i.name === materialName);
          if (item) {
            const cr = item.conversionRate || 1;
            sumInBase += item.quantity / (cr === 0 ? 1 : cr);
          }
        } else if (!task && !r.taskId) {
          const item = r.items.find(i => i.name === materialName);
          if (item) {
            const cr = item.conversionRate || 1;
            sumInBase += item.quantity / (cr === 0 ? 1 : cr);
          }
        }
      }
    });
    return sumInBase;
  };

  const isOverBOQ = useMemo(() => {
    for (let idx = 0; idx < watchedItems.length; idx++) {
      const it = watchedItems[idx];
      if (!it.name) continue;

      const sourceItem = sourceMaterials.find(m => m.name === it.name);
      const boqLimit = sourceItem ? sourceItem.quantity : 0;
      const boqCR = sourceItem ? (sourceItem.conversionRate || 1) : 1;

      let itemCR = 1;
      const catalog = allCatalogs.find(c => c.name === it.name);
      if (catalog) {
        const baseUnit = catalog.baseUnitName || '';
        if (it.unit && it.unit !== baseUnit) {
          const convList = conversionsMap[it.name] || [];
          const conv = convList.find(c => c.alternativeUnitName === it.unit);
          itemCR = conv ? conv.conversionRate : 1;
        }
      }

      const boqLimitInBase = boqLimit / (boqCR === 0 ? 1 : boqCR);
      const requestedQtyInBase = (it.quantity || 0) / (itemCR === 0 ? 1 : itemCR);
      const usedQtyInBase = getUsedQtyInBase(it.name);

      if (usedQtyInBase + requestedQtyInBase > boqLimitInBase) {
        return true;
      }
    }
    return false;
  }, [watchedItems, sourceMaterials, allCatalogs, conversionsMap, allMaterialRequests, request.phaseId, request.id, task]);

  const getRowComparison = (idx: number) => {
    const item = watchedItems[idx];
    if (!item || !item.name) return null;

    const sourceItem = sourceMaterials.find(m => m.name === item.name);
    const boqLimit = sourceItem ? sourceItem.quantity : 0;
    const boqUnit = sourceItem ? sourceItem.unit : item.unit;
    const boqCR = sourceItem ? (sourceItem.conversionRate || 1) : 1;

    let itemCR = 1;
    const catalog = allCatalogs.find(c => c.name === item.name);
    if (catalog) {
      const baseUnit = catalog.baseUnitName || '';
      if (item.unit && item.unit !== baseUnit) {
        const convList = conversionsMap[item.name] || [];
        const conv = convList.find(c => c.alternativeUnitName === item.unit);
        itemCR = conv ? conv.conversionRate : 1;
      }
    }

    const boqLimitInBase = boqLimit / (boqCR === 0 ? 1 : boqCR);
    const requestedQtyInBase = (item.quantity || 0) / (itemCR === 0 ? 1 : itemCR);
    const usedQtyInBase = getUsedQtyInBase(item.name);

    const totalRequestedInBase = usedQtyInBase + requestedQtyInBase;
    const isOver = totalRequestedInBase > boqLimitInBase;

    const totalQtyInBOQ = parseFloat((totalRequestedInBase * boqCR).toFixed(3));
    const boqLimitInBOQ = parseFloat(boqLimit.toFixed(3));

    const statusBadge = isOver ? (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
        Vượt định mức
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-600 border border-green-100">
        Trong định mức
      </span>
    );

    return {
      text: `${totalQtyInBOQ} / ${boqLimitInBOQ} ${boqUnit}`,
      badge: statusBadge
    };
  };

  useEffect(() => {
    if (isOpen) {
      reset({
        type: request.type || 'normal',
        reason: request.reason || '',
        invoiceImage: request.invoiceImage || '',
        items: request.items.length > 0
          ? request.items.map(it => ({ name: it.name, quantity: it.quantity, unit: it.unit }))
          : [{ name: '', quantity: 1, unit: '' }]
      });
    }
  }, [isOpen, request, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ResubmitMaterialRequestForm) => {
      if (isOverBOQ && (!data.reason || data.reason.trim().length < 5)) {
        throw new Error('Yêu cầu vượt định mức bắt buộc phải nhập lý do giải trình (tối thiểu 5 ký tự)!');
      }

      return projectService.resubmitMaterialRequest(request.id, {
        items: data.items.map(it => ({ name: it.name.trim(), quantity: it.quantity, unit: it.unit.trim() })),
        type: data.type,
        invoiceImage: data.type === 'emergency' ? data.invoiceImage?.trim() : undefined,
        reason: data.reason?.trim() || undefined,
        isOverBOQ: isOverBOQ
      });
    },
    onSuccess: (_, variables) => {
      const msg = variables.type === 'emergency'
        ? 'Đã gửi lại yêu cầu mua ngoài khẩn cấp! Hệ thống tự động sinh PO & Phiếu nhập kho, tăng tồn kho ảo tức thì.'
        : (isOverBOQ ? 'Đã gửi lại yêu cầu vật tư vượt định mức, chờ phê duyệt.' : 'Đã gửi lại yêu cầu cấp vật tư.');
      console.log(msg);
      onSuccess(msg);
      queryClient.invalidateQueries({ queryKey: ['materialRequests'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi gửi lại yêu cầu vật tư.');
    }
  });

  const onSubmit = (data: ResubmitMaterialRequestForm) => {
    if (isOverBOQ && (!data.reason || data.reason.trim().length < 5)) {
      setError('reason', { type: 'manual', message: 'Yêu cầu vượt định mức bắt buộc phải nhập lý do giải trình (tối thiểu 5 ký tự)!' });
      return;
    }
    mutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gửi lại Yêu cầu Vật tư" width="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-600">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            Lý do từ chối: <strong>{request.rejectionReason || 'Không có'}</strong>
          </div>
        </div>

        <div className="text-sm bg-blue-50 text-blue-800 p-3 rounded-md border border-blue-100">
          {isPhaseRequest ? (
            <span>Giai đoạn: <strong>{request.phaseName}</strong></span>
          ) : (
            <span>Công việc: <strong>{request.taskName}</strong></span>
          )}
        </div>

        {!isPhaseRequest && (
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-600">Hình thức yêu cầu</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-2 rounded border border-slate-200">
                <input type="radio" value="normal" {...register('type')} className="text-blue-600 focus:ring-blue-500 w-4 h-4" />
                Yêu cầu thông thường (Trình duyệt)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-2 rounded border border-slate-200">
                <input type="radio" value="emergency" {...register('type')} className="text-amber-600 focus:ring-amber-500 w-4 h-4" />
                Mua ngoài khẩn cấp (Direct Purchase)
              </label>
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-3 mt-2">
            <span className="text-sm font-medium text-slate-700">Danh sách vật tư yêu cầu <span className="text-red-500">*</span></span>
            <button
              type="button"
              onClick={() => append({ name: '', quantity: 1, unit: '' })}
              className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1"
            >
              <Plus size={14} /><span>Thêm vật tư</span>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {fields.map((item, idx) => {
              const rowComparison = getRowComparison(idx);
              return (
                <div key={item.id} className="flex flex-col gap-2.5 p-3.5 bg-slate-50/50 border border-slate-100 rounded-lg">
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-start">
                    <div>
                      <SearchSelect
                        options={displayMaterials.map(sm => {
                          const isBOQ = 'quantity' in sm;
                          return {
                            label: sm.name,
                            value: sm.name,
                            sublabel: isBOQ ? `BOQ: ${(sm as any).quantity} ${(sm as any).unit}` : undefined
                          };
                        })}
                        value={watchedItems[idx]?.name || ''}
                        onChange={async (selName) => {
                          setValue(`items.${idx}.name`, selName, { shouldValidate: true, shouldDirty: true });
                          await handleMaterialChange(idx, selName);

                          // Trigger validation for all rows that have a material selected, to update duplicate state!
                          watchedItems.forEach((it, i) => {
                            if (it.name || i === idx) {
                              void trigger(`items.${i}.name`);
                            }
                          });
                          await trigger(`items.${idx}.quantity`);
                          await trigger(`items.${idx}.unit`);
                        }}
                        placeholder="-- Chọn vật tư --"
                        error={!!errors.items?.[idx]?.name}
                      />
                      {errors.items?.[idx]?.name && <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.name?.message}</p>}
                    </div>

                    <div>
                      <input
                        type="number"
                        min={isDiscreteUnit(watchedItems[idx]?.unit) ? 1 : 0.01}
                        step={isDiscreteUnit(watchedItems[idx]?.unit) ? "1" : "any"}
                        placeholder="SL"
                        {...register(`items.${idx}.quantity` as const, {
                          valueAsNumber: true,
                          onChange: async () => {
                            await trigger(`items.${idx}.quantity`);
                          }
                        })}
                        className={`w-full text-sm px-3 py-2 rounded-md border ${errors.items?.[idx]?.quantity ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
                      />
                      {errors.items?.[idx]?.quantity && <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.quantity?.message}</p>}
                    </div>

                    <div>
                      <select
                        {...register(`items.${idx}.unit` as const, {
                          onChange: async () => {
                            await trigger(`items.${idx}.quantity`);
                            await trigger(`items.${idx}.unit`);
                          }
                        })}
                        className={`w-full text-sm px-3 py-2 rounded-md border ${errors.items?.[idx]?.unit ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
                      >
                        <option value="" disabled>-- ĐVT --</option>
                        {(materialUnits[watchedItems[idx]?.name] || []).map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      {errors.items?.[idx]?.unit && <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.unit?.message}</p>}
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        remove(idx);
                        await trigger('items');
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                      title="Xóa vật tư"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {rowComparison && (
                    <div className="flex items-center justify-between text-xs px-3 py-2 bg-white border border-slate-100 rounded-md shadow-sm">
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                        <span>Định mức:</span>
                        <strong className="text-slate-800 font-semibold">{rowComparison.text}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        <span>Trạng thái:</span>
                        {rowComparison.badge}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {(errors.items?.message || (errors.items as any)?.root?.message) && (
              <p className="text-red-500 text-xs mt-1">
                {errors.items?.message || (errors.items as any)?.root?.message}
              </p>
            )}
          </div>
        </div>

        {type === 'emergency' && !isPhaseRequest && (
          <div className="flex flex-col gap-1.5 animate-in fade-in duration-300">
            <label className="block text-sm font-medium text-slate-600">Hình ảnh hóa đơn mua ngoài bắt buộc <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="https://example.com/invoice.jpg"
              {...register('invoiceImage')}
              className={`w-full text-sm px-3 py-2 rounded-md border ${errors.invoiceImage ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
            />
            {errors.invoiceImage && <p className="text-red-500 text-xs">{errors.invoiceImage.message}</p>}
            <span className="text-xs text-slate-500 mt-1 italic">
              * Hệ thống sẽ tự động đối chiếu, tăng tồn kho ảo lập tức để thợ sử dụng tại công trường.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="block text-sm font-medium text-slate-600">
            Ghi chú{isOverBOQ && <span className="text-red-500">*</span>}
          </label>
          <textarea
            placeholder=""
            {...register('reason')}
            rows={3}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.reason ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
          />
          {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason.message}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Gửi lại yêu cầu'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
