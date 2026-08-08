import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2, ArrowLeft, ClipboardList, AlertTriangle } from 'lucide-react';
import { projectService } from '../../services/projectService';
import { materialService } from '../../services/materialService';
import type { WBSPhase, Project } from '../../types/common';
import { Button, SearchSelect, TableLoader } from '../../components/ui';
import { isDiscreteUnit } from '../../utils/unitHelpers';
import { useProjectAccess } from '../../hooks/useProjectAccess';
import { useRealtimeDataRefresh } from '../../hooks/useRealtimeDataRefresh';
import { RealtimeEntities, RealtimeEntityGroups } from '../../constants/realtimeEntities';

const materialItemSchema = z.object({
  materialId: z.number().min(1, 'Vui lòng chọn vật tư.'),
  quantity: z.number({ message: 'Vui lòng nhập số lượng.' }).min(0.001, 'Số lượng phải lớn hơn 0'),
  unitId: z.any(),
  unit: z.any()
}).superRefine((data, ctx) => {
  if (data.materialId > 0) {
    const uId = Number(data.unitId);
    if (isNaN(uId) || uId < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ĐVT không hợp lệ',
        path: ['unitId']
      });
    }

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

const phaseBOQSchema = z.object({
  materials: z.array(materialItemSchema)
}).superRefine((data, ctx) => {
  // Find all duplicate materialIds
  const counts: Record<number, number> = {};
  data.materials.forEach(m => {
    if (m.materialId > 0) {
      counts[m.materialId] = (counts[m.materialId] || 0) + 1;
    }
  });

  // Flag duplicate rows
  data.materials.forEach((m, idx) => {
    if (m.materialId > 0 && counts[m.materialId] > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Vật tư này bị trùng lặp trong danh sách.',
        path: ['materials', idx, 'materialId']
      });
    }
  });
});

type PhaseBOQForm = z.infer<typeof phaseBOQSchema>;

export const PhaseBOQ: React.FC = () => {
  const { projectId, phaseId } = useParams<{ projectId: string; phaseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTechnicalManager } = useProjectAccess(projectId);
  const canEdit = isTechnicalManager;

  const [project, setProject] = useState<Project | null>(null);
  const [phase, setPhase] = useState<WBSPhase | null>(null);
  const [hasActiveMRs, setHasActiveMRs] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(true);
  const [rowConversions, setRowConversions] = useState<Record<number, { unitId: number; unitName: string }[]>>({});

  const isDraft = !project?.status || project?.status?.toLowerCase() === 'draft';

  const isFrozen = !isDraft;
  const isReadOnly = isFrozen || hasActiveMRs || !canEdit;

  // Fetch materials catalog for dropdown list
  const { data: materialsData, isLoading: loadingMaterials } = useQuery({
    queryKey: ['materialCatalogList'],
    queryFn: () => materialService.getMaterials({ pageNumber: 1, pageSize: 1000 })
  });
  const materialList = React.useMemo(() => materialsData?.items ?? [], [materialsData?.items]);

  const { register, control, handleSubmit, reset, setValue, watch, trigger, formState: { errors, isDirty } } = useForm<PhaseBOQForm>({
    resolver: zodResolver(phaseBOQSchema),
    mode: 'onTouched',
    defaultValues: {
      materials: [{ materialId: 0, quantity: 1, unitId: 0, unit: '' }]
    }
  });
  const isDirtyRef = React.useRef(isDirty);
  isDirtyRef.current = isDirty;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'materials'
  });

  const watchedMaterials = watch('materials') || [];

  const loadPhaseData = React.useCallback(async (silent = false) => {
    if (!projectId || !phaseId) return;
    if (!silent) setLoadingPhase(true);
    try {
      const pList = await projectService.getPhases(projectId);
      const currentPhase = pList.find(p => p.id === phaseId);
      setPhase(currentPhase || null);

      const allProjs = await projectService.getProjects();
      setProject(allProjs.find(p => p.id === projectId) || null);

      const reqs = await projectService.getMaterialRequests(projectId);
      const phaseHasActiveMRs = reqs.some(mr => mr.phaseId === phaseId && mr.status !== 'rejected');
      setHasActiveMRs(phaseHasActiveMRs);
    } catch (err) {
      console.error('Error loading BOQ data:', err);
      if (!silent) toast.error('Lỗi khi tải thông tin Giai đoạn.');
    } finally {
      if (!silent) setLoadingPhase(false);
    }
  }, [projectId, phaseId]);

  useEffect(() => {
    loadPhaseData();
  }, [loadPhaseData]);

  useRealtimeDataRefresh(async () => {
    if (isDirty) return;
    await loadPhaseData(true);
  }, [...RealtimeEntities.projects, ...RealtimeEntityGroups.projectMaterials]);

  // Chỉ đồng bộ dữ liệu phase vào form khi phase thay đổi và người dùng không có
  // chỉnh sửa chưa lưu. Dùng ref để reset(savedForm) sau khi lưu không kích hoạt
  // effect này lần nữa với dữ liệu phase cũ.
  useEffect(() => {
    if (isDirtyRef.current || !phase) return;

    const initialMaterials = phase.materials && phase.materials.length > 0
      ? phase.materials.map(it => ({
        materialId: it.materialId,
        quantity: it.quantity,
        unitId: it.unitId,
        unit: it.unit
      }))
      : (isDraft ? [{ materialId: 0, quantity: 1, unitId: 0, unit: '' }] : []);

    reset({ materials: initialMaterials });
  }, [phase, reset, isDraft]);

  // Material catalog có thể refetch realtime; chỉ cập nhật lựa chọn đơn vị,
  // không reset giá trị form.
  useEffect(() => {
    if (phase && materialList.length > 0) {
      const initialMaterials = phase.materials && phase.materials.length > 0
        ? phase.materials.map(it => ({
          materialId: it.materialId,
          quantity: it.quantity,
          unitId: it.unitId,
          unit: it.unit
        }))
        : [];

      initialMaterials.forEach(async (item) => {
        if (item.materialId > 0) {
          const matchMat = materialList.find(m => m.materialId === item.materialId);
          if (matchMat) {
            try {
              const convs = await materialService.getConversions(item.materialId);
              const options = [
                { unitId: matchMat.baseUnitId, unitName: matchMat.baseUnitName || 'bao' },
                ...convs.map(c => ({ unitId: c.alternativeUnitId, unitName: c.alternativeUnitName || '' }))
              ];
              setRowConversions(prev => ({ ...prev, [item.materialId]: options }));
            } catch (err) {
              console.error(err);
            }
          }
        }
      });
    }
  }, [phase, materialList]);

  const handleMaterialChange = async (idx: number, selectedId: number) => {
    const mat = materialList.find(m => m.materialId === selectedId);
    if (mat) {
      setValue(`materials.${idx}.unitId` as any, mat.baseUnitId, { shouldDirty: true, shouldValidate: true });
      setValue(`materials.${idx}.unit` as any, mat.baseUnitName || 'bao', { shouldDirty: true, shouldValidate: true });

      try {
        const convs = await materialService.getConversions(selectedId);
        const options = [
          { unitId: mat.baseUnitId, unitName: mat.baseUnitName || 'bao' },
          ...convs.map(c => ({ unitId: c.alternativeUnitId, unitName: c.alternativeUnitName || '' }))
        ];
        setRowConversions(prev => ({ ...prev, [selectedId]: options }));
      } catch (err) {
        console.error(err);
        setRowConversions(prev => ({ ...prev, [selectedId]: [{ unitId: mat.baseUnitId, unitName: mat.baseUnitName || 'bao' }] }));
      }
    } else {
      setValue(`materials.${idx}.unitId` as any, 0, { shouldDirty: true, shouldValidate: true });
      setValue(`materials.${idx}.unit` as any, '', { shouldDirty: true, shouldValidate: true });
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: PhaseBOQForm) => {
      if (!projectId || !phase) return;
      const payload = data.materials.map(it => ({
        materialId: it.materialId,
        quantity: it.quantity,
        unitId: it.unitId
      }));
      return projectService.updatePhaseMaterials(projectId, phase.id, payload);
    },
    onSuccess: async (_result, savedForm) => {
      // Đánh dấu dữ liệu vừa lưu là trạng thái gốc để các cập nhật realtime tiếp theo
      // không bị chặn bởi guard bảo vệ thay đổi chưa lưu.
      reset(savedForm);
      const msg = `Đã cập nhật Bảng vật tư cho Giai đoạn: ${phase?.name}`;
      console.log(msg);

      // Reload phase data to display updated values in place
      if (projectId && phaseId) {
        try {
          const pList = await projectService.getPhases(projectId);
          const currentPhase = pList.find(p => p.id === phaseId);
          if (currentPhase) {
            setPhase(currentPhase);
            // Chỉ refresh query sau khi phase đã có dữ liệu mới, tránh material
            // catalog làm effect reset form về BOQ cũ ngay sau khi lưu.
            await queryClient.invalidateQueries();
          }
        } catch (err) {
          console.error('Lỗi khi tải lại dữ liệu giai đoạn:', err);
        }
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi cập nhật BOQ.');
    }
  });

  const onSubmit = (data: PhaseBOQForm) => {
    mutation.mutate(data);
  };

  if (loadingPhase || loadingMaterials) {
    return (
      <TableLoader isTable={false} message="Đang tải thông tin định mức vật tư giai đoạn..." minHeight="350px" />
    );
  }

  if (!project || !phase) {
    return (
      <div className="card text-center p-10 max-w-md mx-auto mt-10">
        <AlertTriangle size={48} className="text-[hsl(var(--danger))] mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Không tìm thấy thông tin Giai đoạn</h3>
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Quay lại danh sách dự án
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full">
      {/* Header điều hướng */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="inline-flex items-center gap-1.5 bg-transparent border-none text-[hsl(var(--text-secondary))] cursor-pointer text-[0.9rem] font-medium w-fit hover:text-[hsl(var(--primary))] transition-colors p-0"
        >
          <ArrowLeft size={16} />
          <span>Quay lại</span>
        </button>
        <h1 className="text-[1.75rem] font-extrabold m-0">Bảng định mức vật tư</h1>
        <p className="text-[0.875rem] text-[hsl(var(--text-secondary))] m-0">
          Dự án: <strong className="font-semibold">{project.name}</strong> &rarr; Giai đoạn: <strong className="font-semibold">{phase.name}</strong>
        </p>
      </div>

      {/* Cảnh báo trạng thái khóa nếu không ở dạng Nháp (Draft) */}
      {!isDraft ? (
        <div className="card bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-sm text-amber-800 flex items-center gap-3">
          <AlertTriangle size={20} className="shrink-0 text-amber-600" />
          <div className="text-xs text-slate-700 leading-relaxed">
            <strong className="text-sm text-amber-900 block font-semibold mb-0.5">Dự án đã hoạt động</strong>
            Bảng định mức vật tư chỉ được phép sửa đổi khi dự án chưa kích hoạt).
          </div>
        </div>
      ) : hasActiveMRs ? (
        <div className="card bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-lg p-4 shadow-sm text-[hsl(var(--danger))] flex items-center gap-3">
          <AlertTriangle size={20} className="shrink-0" />
          <div className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed">
            <strong className="text-sm text-[hsl(var(--danger))] block font-semibold mb-0.5">Giai đoạn đã phát sinh Yêu cầu Vật tư</strong>
            Đã khóa chỉnh sửa bảng định mức.
          </div>
        </div>
      ) : null}

      {/* Card chính: Bảng BOQ Full-Width */}
      <div className="card bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-lg p-6 shadow-sm flex flex-col gap-5 w-full">
        <div className="flex justify-between items-center pb-3 border-b border-[hsl(var(--border-light))]">
          <h3 className="text-lg font-bold flex items-center gap-2 m-0 text-[hsl(var(--text-primary))]">
            <ClipboardList size={20} className="text-[hsl(var(--primary))]" />
            <span>Định mức Vật tư Giai đoạn</span>
          </h3>
          {!isReadOnly && (
            <Button
              type="button"
              onClick={() => append({ materialId: 0, quantity: 1, unitId: 0, unit: '' })}
              className="flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3"
            >
              <Plus size={15} />
              <span>Thêm vật tư</span>
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6 w-full">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 bg-[hsl(var(--bg-main))/0.2] border border-dashed border-[hsl(var(--border))] rounded-lg text-slate-500">
              <ClipboardList size={40} className="text-slate-400 mb-2" />
              <p className="text-sm m-0">Chưa có vật tư định mức cho giai đoạn này.</p>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => append({ materialId: 0, quantity: 1, unitId: 0, unit: '' })}
                  className="mt-3 text-xs font-semibold py-1.5 px-3 rounded-md bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary-hover))] cursor-pointer border-none transition-colors"
                >
                  Thêm vật tư định mức đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] font-semibold">
                    <th className="pb-3 pl-3 w-[60px] text-center">STT</th>
                    <th className="pb-3 min-w-[300px]">Tên vật tư kỹ thuật / Quy cách</th>
                    <th className="pb-3 w-[200px] text-center">Số lượng định mức</th>
                    <th className="pb-3 w-[220px]">Đơn vị tính (ĐVT)</th>
                    {!isReadOnly && <th className="pb-3 pr-3 text-center w-[70px]">Xóa</th>}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((item, idx) => (
                    <tr key={item.id} className="border-b border-[hsl(var(--border-light))] align-top hover:bg-[hsl(var(--bg-main))/0.3]">
                      {/* STT */}
                      <td className="pt-4 pl-3 font-medium text-[hsl(var(--text-secondary))] text-center">
                        {idx + 1}
                      </td>

                      {/* Vật tư */}
                      <td className="py-2.5 pr-4">
                        <SearchSelect
                          options={materialList.map(m => ({
                            label: m.name + (m.specification ? ` (${m.specification})` : ''),
                            value: m.materialId.toString(),
                            sublabel: m.code ? `Mã: ${m.code}` : undefined
                          }))}
                          value={watchedMaterials[idx]?.materialId?.toString() || '0'}
                          disabled={isReadOnly}
                          onChange={async (val) => {
                            const selectedId = parseInt(val) || 0;
                            setValue(`materials.${idx}.materialId`, selectedId, { shouldValidate: true, shouldDirty: true });
                            handleMaterialChange(idx, selectedId);

                            // Trigger validation for all rows that have a material selected, to update duplicate state!
                            watchedMaterials.forEach((m, i) => {
                              if (m.materialId > 0 || i === idx) {
                                void trigger(`materials.${i}.materialId`);
                              }
                            });
                            await trigger(`materials.${idx}.quantity`);
                            await trigger(`materials.${idx}.unitId`);
                          }}
                          placeholder="-- Chọn vật tư kỹ thuật --"
                          error={!!errors.materials?.[idx]?.materialId}
                        />
                        {errors.materials?.[idx]?.materialId && (
                          <p className="text-red-500 text-xs mt-1 mb-0">{errors.materials[idx]?.materialId?.message}</p>
                        )}
                      </td>

                      {/* Số lượng */}
                      <td className="py-2.5 pr-4 text-center">
                        <input
                          type="number"
                          step={isDiscreteUnit(watchedMaterials[idx]?.unit) ? "1" : "any"}
                          min={isDiscreteUnit(watchedMaterials[idx]?.unit) ? 1 : 0.001}
                          placeholder="Nhập SL..."
                          {...register(`materials.${idx}.quantity` as const, {
                            valueAsNumber: true,
                            onChange: async () => {
                              await trigger(`materials.${idx}.quantity`);
                            }
                          })}
                          disabled={isReadOnly}
                          className={`w-full text-center text-sm px-3 py-2 rounded-md border ${errors.materials?.[idx]?.quantity ? 'border-red-500' : 'border-slate-200'} ${isReadOnly ? 'bg-slate-100/50 cursor-not-allowed' : 'bg-white'} text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                        />
                        {errors.materials?.[idx]?.quantity && (
                          <p className="text-red-500 text-xs mt-1 mb-0 text-left">{errors.materials[idx]?.quantity?.message}</p>
                        )}
                      </td>

                      {/* ĐVT */}
                      <td className="py-2.5 pr-2">
                        <select
                          {...register(`materials.${idx}.unitId` as const, { valueAsNumber: true })}
                          disabled={isReadOnly}
                          onChange={async (e) => {
                            const uId = parseInt(e.target.value);
                            setValue(`materials.${idx}.unitId`, uId, { shouldValidate: true, shouldDirty: true });
                            const currentMatId = watchedMaterials[idx]?.materialId;
                            const opts = (currentMatId && rowConversions[currentMatId]) || [];
                            const opt = opts.find(o => o.unitId === uId);
                            if (opt) {
                              setValue(`materials.${idx}.unit` as any, opt.unitName, { shouldDirty: true });
                            }
                            await trigger(`materials.${idx}.quantity`);
                            await trigger(`materials.${idx}.unitId`);
                          }}
                          className={`w-full text-sm px-3 py-2 rounded-md border ${errors.materials?.[idx]?.unitId ? 'border-red-500' : 'border-slate-200'} ${isReadOnly ? 'bg-slate-100/50 cursor-not-allowed' : 'bg-white'} text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 pr-8`}
                        >
                          {((watchedMaterials[idx]?.materialId && rowConversions[watchedMaterials[idx]?.materialId]) || (item.unitId ? [{ unitId: item.unitId, unitName: item.unit }] : [])).map(opt => (
                            <option key={opt.unitId} value={opt.unitId}>
                              {opt.unitName}
                            </option>
                          ))}
                        </select>
                        {errors.materials?.[idx]?.unitId && (
                          <p className="text-red-500 text-xs mt-1 mb-0">{errors.materials[idx]?.unitId?.message as string}</p>
                        )}
                      </td>

                      {/* Hợp tác hành động */}
                      {!isReadOnly && (
                        <td className="pt-3.5 pr-3 text-center align-top">
                          <button
                            type="button"
                            onClick={async () => {
                              remove(idx);
                              await trigger('materials');
                            }}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer transition-colors border-none bg-transparent"
                            title="Xóa dòng vật tư"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(errors.materials?.message || (errors.materials as any)?.root?.message) && (
            <div className="p-3 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-md text-[hsl(var(--danger))] text-sm font-medium">
              {errors.materials?.message || (errors.materials as any)?.root?.message}
            </div>
          )}

          {/* Các nút Submit */}
          {!isReadOnly && (
            <div className="flex justify-end gap-3 pt-4 border-t border-[hsl(var(--border-light))]">
              <Button type="button" variant="secondary" onClick={() => navigate(`/projects/${projectId}`)} disabled={mutation.isPending}>
                Hủy bỏ
              </Button>
              <Button type="submit" variant="primary" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Lưu bảng định mức'}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
