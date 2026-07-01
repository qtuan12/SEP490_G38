import React, { useEffect } from 'react';
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

  // Fetch materials catalog for dropdown list
  const { data: materialsData, isLoading: loadingMaterials } = useQuery({
    queryKey: ['materialCatalogList'],
    queryFn: () => materialService.getMaterials({ pageNumber: 1, pageSize: 1000 }),
    enabled: isOpen
  });
  const materialList = materialsData?.items || [];

  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm<PhaseBOQForm>({
    resolver: zodResolver(phaseBOQSchema),
    defaultValues: {
      materials: [{ materialId: 0, quantity: 1, unitId: 0, unit: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'materials'
  });

  // Map initial values from phase.materials using material names
  useEffect(() => {
    if (isOpen && materialList.length > 0) {
      reset({
        materials: phase.materials && phase.materials.length > 0
          ? phase.materials.map(it => {
              const matchMat = materialList.find(m => m.name === it.name);
              return {
                materialId: matchMat ? matchMat.materialId : 0,
                quantity: it.quantity,
                unitId: matchMat ? matchMat.baseUnitId : 0,
                unit: matchMat ? matchMat.baseUnitName || it.unit : it.unit
              };
            })
          : [{ materialId: 0, quantity: 1, unitId: 0, unit: '' }]
      });
    }
  }, [isOpen, phase, reset, materialList]);

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
      const msg = `Đã cập nhật Bảng vật tư BOQ cho Phase: ${phase.name}`;
      toast.success(msg);
      onSuccess(msg);
      
      // Invalidate project or phase data to reflect BOQ
      queryClient.invalidateQueries(); 
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi cập nhật BOQ.');
    }
  });

  const onSubmit = (data: PhaseBOQForm) => {
    mutation.mutate(data);
  };

  const loading = loadingMaterials;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Cập nhật Bảng vật tư BOQ: ${phase.name}`}>
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
              ⚠️ <strong>Đã có Yêu cầu vật tư</strong> cho Giai đoạn này. Không thể tùy tiện thay đổi Định mức (BOQ) để tránh sai lệch kiểm soát. Việc thay đổi BOQ lúc này cần lập tờ trình xin Giám đốc phê duyệt ngoài luồng.
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-slate-700">Danh sách vật tư định mức (BOQ) <span className="text-red-500">*</span></span>
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
                <div key={item.id} className="grid grid-cols-[2.5fr_1fr_1fr_auto] gap-2 items-start">
                  <div>
                    <select
                      {...register(`materials.${idx}.materialId` as const, { valueAsNumber: true })}
                      disabled={hasActiveMRs}
                      onChange={(e) => {
                        const selectedId = parseInt(e.target.value);
                        const mat = materialList.find(m => m.materialId === selectedId);
                        if (mat) {
                          setValue(`materials.${idx}.unitId` as any, mat.baseUnitId);
                          setValue(`materials.${idx}.unit` as any, mat.baseUnitName || 'bao');
                        }
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
                    <input 
                      type="text" 
                      placeholder="ĐVT" 
                      disabled
                      {...register(`materials.${idx}.unit` as const)}
                      className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 bg-slate-100 text-slate-500 focus:outline-none"
                    />
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
              {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Lưu Bảng BOQ'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
