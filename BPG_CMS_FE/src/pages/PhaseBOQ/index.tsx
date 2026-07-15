import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2, ArrowLeft, ClipboardList, Info, AlertTriangle } from 'lucide-react';
import { projectService } from '../../services/projectService';
import { materialService } from '../../services/materialService';
import type { WBSPhase, Project } from '../../types/common';
import { Button, SearchSelect } from '../../components/ui';
import { isDiscreteUnit } from '../../utils/unitHelpers';
import { useAuth } from '../../context/AuthContext';
import { useSignalREvent } from '../../hooks/useSignalREvent';

const phaseBOQSchema = z.object({
  materials: z.array(
    z.object({
      materialId: z.number().min(1, 'Vui lòng chọn vật tư.'),
      quantity: z.number({ message: 'Vui lòng nhập số lượng.' }).min(0.001, 'Số lượng phải lớn hơn 0'),
      unitId: z.number().min(1, 'ĐVT không hợp lệ'),
      unit: z.string()
    })
  )
}).superRefine((data, ctx) => {
  // 1. Kiểm tra trùng lặp vật tư
  const ids = data.materials.map(m => m.materialId).filter(id => id > 0);
  if (ids.length !== new Set(ids).size) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Danh sách vật tư không được trùng lặp.',
      path: ['materials']
    });
  }

  // 2. Ràng buộc ĐVT số nguyên không chấp nhận số lượng lẻ
  data.materials.forEach((m, idx) => {
    if (m.materialId > 0 && isDiscreteUnit(m.unit)) {
      if (m.quantity % 1 !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Đơn vị "${m.unit}" yêu cầu số lượng phải là số nguyên.`,
          path: ['materials', idx, 'quantity']
        });
      }
    }
  });
});

type PhaseBOQForm = z.infer<typeof phaseBOQSchema>;

export const PhaseBOQ: React.FC = () => {
  const { projectId, phaseId } = useParams<{ projectId: string; phaseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user && ['admin', 'technicalmanager', 'projectleader'].includes(user.role);

  const [project, setProject] = useState<Project | null>(null);
  const [phase, setPhase] = useState<WBSPhase | null>(null);
  const [hasActiveMRs, setHasActiveMRs] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(true);
  const [rowConversions, setRowConversions] = useState<Record<number, { unitId: number; unitName: string }[]>>({});

  // Fetch materials catalog for dropdown list
  const { data: materialsData, isLoading: loadingMaterials } = useQuery({
    queryKey: ['materialCatalogList'],
    queryFn: () => materialService.getMaterials({ pageNumber: 1, pageSize: 1000 })
  });
  const materialList = materialsData?.items || [];

  const { register, control, handleSubmit, reset, setValue, watch, trigger, formState: { errors } } = useForm<PhaseBOQForm>({
    resolver: zodResolver(phaseBOQSchema),
    mode: 'onTouched',
    defaultValues: {
      materials: [{ materialId: 0, quantity: 1, unitId: 0, unit: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'materials'
  });

  const watchedMaterials = watch('materials') || [];

  const loadPhaseData = React.useCallback(async () => {
    if (!projectId || !phaseId) return;
    setLoadingPhase(true);
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
      toast.error('Lỗi khi tải thông tin Giai đoạn.');
    } finally {
      setLoadingPhase(false);
    }
  }, [projectId, phaseId]);

  useEffect(() => {
    loadPhaseData();
  }, [loadPhaseData]);

  // Lắng nghe thay đổi từ SignalR
  useSignalREvent('ReceiveNotification', (noti: any) => {
    // Reload khi có thông báo liên quan tới MaterialRequest hoặc Project
    if (noti?.referenceType === 'MaterialRequest' || noti?.referenceType === 'Project' || noti?.referenceType?.includes('/materialrequests') || noti?.referenceType?.includes('/boq')) {
      loadPhaseData();
      toast('Định mức & trạng thái yêu cầu vật tư của giai đoạn được cập nhật!', { icon: '📋' });
    }
  });

  // Map initial values from phase.materials using material names and pre-load their units
  useEffect(() => {
    if (phase && materialList.length > 0) {
      const initialMaterials = phase.materials && phase.materials.length > 0
        ? phase.materials.map(it => {
          return {
            materialId: it.materialId,
            quantity: it.quantity,
            unitId: it.unitId,
            unit: it.unit
          };
        })
        : [];

      reset({ materials: initialMaterials });

      // Fetch units options for each material
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
  }, [phase, reset, materialList]);

  const handleMaterialChange = async (idx: number, selectedId: number) => {
    const mat = materialList.find(m => m.materialId === selectedId);
    if (mat) {
      setValue(`materials.${idx}.unitId` as any, mat.baseUnitId);
      setValue(`materials.${idx}.unit` as any, mat.baseUnitName || 'bao');

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
      setValue(`materials.${idx}.unitId` as any, 0);
      setValue(`materials.${idx}.unit` as any, '');
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
    onSuccess: async () => {
      const msg = `Đã cập nhật Bảng vật tư BOQ cho Phase: ${phase?.name}`;
      toast.success(msg);
      queryClient.invalidateQueries();

      // Reload phase data to display updated values in place
      if (projectId && phaseId) {
        try {
          const pList = await projectService.getPhases(projectId);
          const currentPhase = pList.find(p => p.id === phaseId);
          if (currentPhase) {
            setPhase(currentPhase);
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
      <div className="flex flex-col justify-center items-center h-[350px] gap-3">
        <Loader2 size={36} className="animate-spin text-[hsl(var(--primary))]" />
        <span className="text-sm text-[hsl(var(--text-secondary))]">Đang tải thông tin định mức vật tư giai đoạn...</span>
      </div>
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
    <div className="flex flex-col gap-6 animate-fade-in max-w-[1200px] mx-auto">
      {/* Header điều hướng */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="inline-flex items-center gap-1.5 bg-transparent border-none text-[hsl(var(--text-secondary))] cursor-pointer text-[0.9rem] font-medium w-fit hover:text-[hsl(var(--primary))] transition-colors p-0"
        >
          <ArrowLeft size={16} />
          <span>Quay lại không gian dự án</span>
        </button>
        <h1 className="text-[1.75rem] font-extrabold m-0">Cập nhật Bảng vật tư định mức</h1>
        <p className="text-[0.875rem] text-[hsl(var(--text-secondary))] m-0">
          Dự án: <strong className="font-semibold">{project.name}</strong> &rarr; Giai đoạn: <strong className="font-semibold">{phase.name}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-6 items-start">
        {/* Cột chính: Bảng BOQ */}
        <div className="card bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-lg p-6 shadow-sm flex flex-col gap-5">
          <div className="flex justify-between items-center pb-3 border-b border-[hsl(var(--border-light))]">
            <h3 className="text-lg font-bold flex items-center gap-2 m-0 text-[hsl(var(--text-primary))]">
              <ClipboardList size={20} className="text-[hsl(var(--primary))]" />
              <span>Định mức Vật tư Giai đoạn</span>
            </h3>
            {!hasActiveMRs && canEdit && (
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

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 bg-[hsl(var(--bg-main))/0.2] border border-dashed border-[hsl(var(--border))] rounded-lg text-slate-500">
                <ClipboardList size={40} className="text-slate-400 mb-2" />
                <p className="text-sm m-0">Chưa có vật tư định mức cho giai đoạn này.</p>
                {!hasActiveMRs && canEdit && (
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
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] font-semibold">
                      <th className="pb-3 pl-2 w-[40px]">STT</th>
                      <th className="pb-3 w-[55%]">Tên vật tư kỹ thuật / Quy cách</th>
                      <th className="pb-3 w-[20%] text-center">Số lượng định mức</th>
                      <th className="pb-3 w-[20%]">Đơn vị tính (ĐVT)</th>
                      {!hasActiveMRs && canEdit && <th className="pb-3 pr-2 text-center w-[50px]">Xóa</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((item, idx) => (
                      <tr key={item.id} className="border-b border-[hsl(var(--border-light))] align-top hover:bg-[hsl(var(--bg-main))/0.3]">
                        {/* STT */}
                        <td className="py-3 pl-2 font-medium text-[hsl(var(--text-secondary))] text-center">
                          {idx + 1}
                        </td>

                        {/* Vật tư */}
                        <td className="py-2 pr-4">
                          <SearchSelect
                            options={materialList.map(m => ({
                              label: m.name + (m.specification ? ` (${m.specification})` : ''),
                              value: m.materialId.toString(),
                              sublabel: m.code ? `Mã: ${m.code}` : undefined
                            }))}
                            value={watchedMaterials[idx]?.materialId?.toString() || '0'}
                            disabled={hasActiveMRs || !canEdit}
                            onChange={async (val) => {
                              const selectedId = parseInt(val) || 0;
                              setValue(`materials.${idx}.materialId`, selectedId, { shouldValidate: true });
                              handleMaterialChange(idx, selectedId);
                              await trigger('materials');
                            }}
                            placeholder="-- Chọn vật tư kỹ thuật --"
                            error={!!errors.materials?.[idx]?.materialId}
                          />
                          {errors.materials?.[idx]?.materialId && (
                            <p className="text-red-500 text-xs mt-1 mb-0">{errors.materials[idx]?.materialId?.message}</p>
                          )}
                        </td>

                        {/* Số lượng */}
                        <td className="py-2 pr-4 text-center">
                          <input
                            type="number"
                            step={isDiscreteUnit(watchedMaterials[idx]?.unit) ? "1" : "any"}
                            min={isDiscreteUnit(watchedMaterials[idx]?.unit) ? 1 : 0.001}
                            placeholder="Nhập SL..."
                            {...register(`materials.${idx}.quantity` as const, { valueAsNumber: true })}
                            disabled={hasActiveMRs || !canEdit}
                            className={`w-full text-center text-sm px-3 py-2 rounded-md border ${errors.materials?.[idx]?.quantity ? 'border-red-500' : 'border-slate-200'} ${(hasActiveMRs || !canEdit) ? 'bg-slate-100/50 cursor-not-allowed' : 'bg-white'} text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                          />
                          {errors.materials?.[idx]?.quantity && (
                            <p className="text-red-500 text-xs mt-1 mb-0 text-left">{errors.materials[idx]?.quantity?.message}</p>
                          )}
                        </td>

                        {/* ĐVT */}
                        <td className="py-2 pr-2">
                          <select
                            {...register(`materials.${idx}.unitId` as const, { valueAsNumber: true })}
                            disabled={hasActiveMRs || !canEdit}
                            onChange={(e) => {
                              const uId = parseInt(e.target.value);
                              const currentMatId = watchedMaterials[idx]?.materialId;
                              const opts = (currentMatId && rowConversions[currentMatId]) || [];
                              const opt = opts.find(o => o.unitId === uId);
                              if (opt) {
                                setValue(`materials.${idx}.unit` as any, opt.unitName);
                              }
                            }}
                            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.materials?.[idx]?.unitId ? 'border-red-500' : 'border-slate-200'} ${(hasActiveMRs || !canEdit) ? 'bg-slate-100/50 cursor-not-allowed' : 'bg-white'} text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                          >
                            {((watchedMaterials[idx]?.materialId && rowConversions[watchedMaterials[idx]?.materialId]) || (item.unitId ? [{ unitId: item.unitId, unitName: item.unit }] : [])).map(opt => (
                              <option key={opt.unitId} value={opt.unitId}>
                                {opt.unitName}
                              </option>
                            ))}
                          </select>
                          {errors.materials?.[idx]?.unitId && (
                            <p className="text-red-500 text-xs mt-1 mb-0">{errors.materials[idx]?.unitId?.message}</p>
                          )}
                        </td>

                        {/* Hợp tác hành động */}
                        {!hasActiveMRs && canEdit && (
                          <td className="py-2 pr-2 text-center align-middle">
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
            <div className="flex justify-end gap-3 pt-4 border-t border-[hsl(var(--border-light))]">
              {canEdit ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => navigate(`/projects/${projectId}`)} disabled={mutation.isPending}>
                    Hủy bỏ
                  </Button>
                  <Button type="submit" variant="primary" disabled={mutation.isPending}>
                    {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Lưu bảng định mức'}
                  </Button>
                </>
              ) : (
                <Button type="button" variant="primary" onClick={() => navigate(`/projects/${projectId}`)}>
                  Quay lại
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Cột phụ: Thông tin hướng dẫn */}
        <div className="flex flex-col gap-4">
          <div className="card bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-lg p-5 shadow-sm">
            <h4 className="text-sm font-bold flex items-center gap-2 mt-0 mb-3 text-[hsl(var(--text-primary))]">
              <Info size={16} className="text-[hsl(var(--primary))]" />
              <span>Hướng dẫn sử dụng</span>
            </h4>
            <ul className="text-xs text-[hsl(var(--text-secondary))] space-y-2.5 pl-4 list-disc">
              <li>
                <strong>Định mức vật tư:</strong> Giới hạn số lượng vật tư tối đa các kỹ sư hiện trường có thể đề xuất cho Giai đoạn này.
              </li>
              <li>
                <strong>Quy tắc khóa:</strong> Khi đã có bất kỳ **Yêu cầu vật tư** nào được Tổ trưởng duyệt hoặc gửi kế toán, bảng định mức này sẽ bị khóa để tránh sai lệch kiểm soát.
              </li>
              <li>
                <strong>Trùng lặp:</strong> Hệ thống kiểm tra trùng lặp vật tư, vui lòng gộp chung số lượng của cùng một loại vật tư thay vì tạo nhiều dòng.
              </li>
            </ul>
          </div>

          {hasActiveMRs && (
            <div className="card bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-lg p-5 shadow-sm text-[hsl(var(--danger))] flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="shrink-0" />
                <strong className="text-sm">Giai đoạn đã phát sinh Yêu cầu Vật tư</strong>
              </div>
              <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed m-0">
                Để tránh rủi ro vỡ định mức ngân sách dự án, hệ thống đã khóa chỉnh sửa bảng định mức vật tư này. Việc thay đổi định mức tại thời điểm này bắt buộc phải làm tờ trình xin phê duyệt ngoài luồng từ Giám đốc.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
