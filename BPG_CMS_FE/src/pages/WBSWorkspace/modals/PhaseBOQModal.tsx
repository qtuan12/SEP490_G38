import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { projectService } from '../../../services/projectService';
import { materialService } from '../../../services/materialService';
import type { WBSPhase } from '../../../types/common';
import { Modal } from '../../../components/ui/Modal';

const phaseBOQSchema = z.object({
  materials: z.array(
    z.object({
      materialId: z.number().min(1, 'Vui lòng chọn vật tư.'),
      quantity: z.number().min(0.001, 'Số lượng phải lớn hơn 0'),
      unitId: z.number().min(1, 'ĐVT không hợp lệ'),
      unit: z.string()
    })
  ).min(1, 'Cần ít nhất 1 vật tư')
}).refine(data => {
  const ids = data.materials.map(m => m.materialId).filter(id => id > 0);
  return ids.length === new Set(ids).size;
}, {
  message: 'Danh sách vật tư không được trùng lặp.',
  path: ['materials']
});

type PhaseBOQForm = z.infer<typeof phaseBOQSchema>;

interface PhaseBOQModalProps {
  isOpen: boolean;
  onClose: () => void;
  phase: WBSPhase;
  projectId: string;
  hasActiveMRs?: boolean;
  onSuccess: (msg: string) => void;
  onError?: (msg: string) => void;
}

export const PhaseBOQModal: React.FC<PhaseBOQModalProps> = ({
  isOpen,
  onClose,
  phase,
  projectId,
  hasActiveMRs,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const [rowConversions, setRowConversions] = useState<Record<number, { unitId: number; unitName: string }[]>>({});

  // Fetch materials catalog for dropdown list
  const { data: materialsData, isLoading: loadingMaterials } = useQuery({
    queryKey: ['materialCatalogList'],
    queryFn: () => materialService.getMaterials({ pageNumber: 1, pageSize: 1000 }),
    enabled: isOpen
  });
  const materialList = React.useMemo(() => materialsData?.items ?? [], [materialsData?.items]);

  const { register, control, handleSubmit, reset, setValue, getValues, formState: { errors, isDirty } } = useForm<PhaseBOQForm>({
    resolver: zodResolver(phaseBOQSchema),
    defaultValues: {
      materials: [{ materialId: 0, quantity: 1, unitId: 0, unit: '' }]
    }
  });
  const initializedPhaseRef = React.useRef<string | null>(null);
  const isDirtyRef = React.useRef(isDirty);
  isDirtyRef.current = isDirty;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'materials'
  });

  // Khởi tạo lại khi mở một phiên modal/phase mới. Khi modal đang mở và form đã
  // thay đổi, catalog refetch realtime chỉ cập nhật option, không reset dữ liệu nhập.
  useEffect(() => {
    if (!isOpen) {
      initializedPhaseRef.current = null;
      return;
    }
    if (materialList.length > 0) {
      const phaseIdAtLoad = phase.id;
      const isNewSession = initializedPhaseRef.current !== phase.id;
      const formMaterials = isNewSession || !isDirtyRef.current
        ? (phase.materials || []).map(it => {
          return {
            materialId: it.materialId,
            quantity: it.quantity,
            unitId: it.unitId,
            unit: it.unit
          };
        })
        : (getValues('materials') || []);

      if (isNewSession || !isDirtyRef.current) {
        reset({
          materials: formMaterials.length > 0
            ? formMaterials
            : [{ materialId: 0, quantity: 1, unitId: 0, unit: '' }],
        });
        initializedPhaseRef.current = phase.id;
        if (isNewSession) setRowConversions({});
      }

      // Fetch units options for each material
      formMaterials.forEach(async (item, idx) => {
        if (item.materialId > 0) {
          const matchMat = materialList.find(m => m.materialId === item.materialId);
          if (matchMat) {
            try {
              const convs = await materialService.getConversions(item.materialId);
              const options = [
                { unitId: matchMat.baseUnitId, unitName: matchMat.baseUnitName || 'bao' },
                ...convs.map(c => ({ unitId: c.alternativeUnitId, unitName: c.alternativeUnitName || '' }))
              ];
              if (
                initializedPhaseRef.current === phaseIdAtLoad
                && getValues(`materials.${idx}.materialId`) === item.materialId
              ) {
                setRowConversions(prev => ({ ...prev, [idx]: options }));
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      });
    }
  }, [getValues, isOpen, phase, reset, materialList]);

  // Load conversions when user changes material dropdown
  const handleMaterialChange = async (idx: number, selectedId: number) => {
    const mat = materialList.find(m => m.materialId === selectedId);
    if (mat) {
      setValue(`materials.${idx}.unitId` as any, mat.baseUnitId, { shouldDirty: true, shouldValidate: true });
      setValue(`materials.${idx}.unit` as any, mat.baseUnitName || 'bao', { shouldDirty: true });

      try {
        const convs = await materialService.getConversions(selectedId);
        const options = [
          { unitId: mat.baseUnitId, unitName: mat.baseUnitName || 'bao' },
          ...convs.map(c => ({ unitId: c.alternativeUnitId, unitName: c.alternativeUnitName || '' }))
        ];
        if (getValues(`materials.${idx}.materialId`) === selectedId) {
          setRowConversions(prev => ({ ...prev, [idx]: options }));
        }
      } catch (err) {
        console.error(err);
        if (getValues(`materials.${idx}.materialId`) === selectedId) {
          setRowConversions(prev => ({ ...prev, [idx]: [{ unitId: mat.baseUnitId, unitName: mat.baseUnitName || 'bao' }] }));
        }
      }
    } else {
      setValue(`materials.${idx}.unitId` as any, 0, { shouldDirty: true, shouldValidate: true });
      setValue(`materials.${idx}.unit` as any, '', { shouldDirty: true });
      setRowConversions(prev => ({ ...prev, [idx]: [] }));
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: PhaseBOQForm) => {
      const payload = data.materials.map(it => ({
        materialId: it.materialId,
        quantity: it.quantity,
        unitId: it.unitId
      }));
      return projectService.updatePhaseMaterials(projectId, phase.id, payload);
    },
    onSuccess: () => {
      const msg = `Đã cập nhật Bảng vật tư định mức cho Giai đoạn: ${phase.name}`;
      console.log(msg);
      onSuccess(msg);

      // Invalidate project or phase data to reflect BOQ
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi cập nhật định mức vật tư.');
    }
  });

  const onSubmit = (data: PhaseBOQForm) => {
    mutation.mutate(data);
  };

  const loading = loadingMaterials;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Cập nhật Bảng vật tư định mức: ${phase.name}`}>
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-slate-500">Đang tải danh mục vật tư...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">

          <div className="text-sm bg-blue-50/50 p-3 rounded-md border border-blue-100 text-blue-800">
            Bạn đang chỉnh sửa định mức vật tư dự kiến cho <strong>{phase.name}</strong>. Các kỹ sư khi yêu cầu vật tư cho công việc thuộc Phase này sẽ bị giới hạn bởi số lượng trong bảng này.
          </div>

          {hasActiveMRs && (
            <div className="text-sm bg-red-50 p-3 rounded-md border border-red-200 text-red-600">
              ⚠️ <strong>Đã có Yêu cầu vật tư</strong> cho Giai đoạn này. Không thể tùy tiện thay đổi Định mức để tránh sai lệch kiểm soát. Việc thay đổi định mức lúc này cần lập tờ trình xin Giám đốc phê duyệt ngoài luồng.
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-slate-700">Danh sách vật tư định mức <span className="text-red-500">*</span></span>
              {!hasActiveMRs && (
                <button
                  type="button"
                  onClick={() => append({ materialId: 0, quantity: 1, unitId: 0, unit: '' })}
                  className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /><span>Thêm vật tư</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {fields.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-[2.5fr_1fr_1.2fr_auto] gap-2 items-start">
                  <div>
                    <select
                      {...register(`materials.${idx}.materialId` as const, { valueAsNumber: true })}
                      disabled={hasActiveMRs}
                      onChange={(e) => {
                        const selectedId = parseInt(e.target.value);
                        setValue(`materials.${idx}.materialId`, selectedId, { shouldDirty: true, shouldValidate: true });
                        void handleMaterialChange(idx, selectedId);
                      }}
                      className={`w-full text-sm px-3 py-2 rounded-md border ${errors.materials?.[idx]?.materialId ? 'border-red-500' : 'border-slate-200'} ${hasActiveMRs ? 'bg-slate-100' : 'bg-white'} text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                    >
                      <option value={0}>-- Chọn vật tư --</option>
                      {materialList.map(m => (
                        <option key={m.materialId} value={m.materialId}>
                          {m.name} {m.specification ? `(${m.specification})` : ''}
                        </option>
                      ))}
                    </select>
                    {errors.materials?.[idx]?.materialId && <p className="text-red-500 text-xs mt-1">{errors.materials[idx]?.materialId?.message}</p>}
                  </div>

                  <div>
                    <input
                      type="number"
                      step="any"
                      min={0.001}
                      placeholder="SL"
                      {...register(`materials.${idx}.quantity` as const, { valueAsNumber: true })}
                      disabled={hasActiveMRs}
                      className={`w-full text-sm px-3 py-2 rounded-md border ${errors.materials?.[idx]?.quantity ? 'border-red-500' : 'border-slate-200'} ${hasActiveMRs ? 'bg-slate-100' : 'bg-white'} text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                    />
                    {errors.materials?.[idx]?.quantity && <p className="text-red-500 text-xs mt-1">{errors.materials[idx]?.quantity?.message}</p>}
                  </div>

                  <div>
                    <select
                      {...register(`materials.${idx}.unitId` as const, { valueAsNumber: true })}
                      disabled={hasActiveMRs}
                      onChange={(e) => {
                        const uId = parseInt(e.target.value);
                        setValue(`materials.${idx}.unitId`, uId, { shouldDirty: true, shouldValidate: true });
                        const opts = rowConversions[idx] || [];
                        const opt = opts.find(o => o.unitId === uId);
                        if (opt) {
                          setValue(`materials.${idx}.unit` as any, opt.unitName, { shouldDirty: true });
                        }
                      }}
                      className={`w-full text-sm px-3 py-2 rounded-md border ${errors.materials?.[idx]?.unitId ? 'border-red-500' : 'border-slate-200'} ${hasActiveMRs ? 'bg-slate-100' : 'bg-white'} text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                    >
                      {(rowConversions[idx] || (item.unitId ? [{ unitId: item.unitId, unitName: item.unit }] : [])).map(opt => (
                        <option key={opt.unitId} value={opt.unitId}>
                          {opt.unitName}
                        </option>
                      ))}
                    </select>
                    {errors.materials?.[idx]?.unitId && <p className="text-red-500 text-xs mt-1">{errors.materials[idx]?.unitId?.message}</p>}
                  </div>

                  {!hasActiveMRs && (
                    <button
                      type="button"
                      disabled={fields.length === 1}
                      onClick={() => remove(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
              {errors.materials?.message && <p className="text-red-500 text-xs mt-1">{errors.materials.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button type="button" className="btn btn-secondary cursor-pointer" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
            <button type="submit" className="btn btn-primary cursor-pointer" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Lưu'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
