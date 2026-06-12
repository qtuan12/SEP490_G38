import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {projectService} from '../../../../src/services/projectService';
import type {WBSPhase} from '../../../types/common';
import { Modal } from '../../../../src/components/ui/Modal';

const phaseBOQSchema = z.object({
  materials: z.array(
    z.object({
      name: z.string().min(1, 'Vui lòng nhập tên vật tư.'),
      quantity: z.number().min(1, 'Số lượng phải > 0'),
      unit: z.string().min(1, 'Vui lòng nhập ĐVT')
    })
  ).min(1, 'Cần ít nhất 1 vật tư')
});

type PhaseBOQForm = z.infer<typeof phaseBOQSchema>;

interface PhaseBOQModalProps {
  isOpen: boolean;
  onClose: () => void;
  phase: WBSPhase;
  hasActiveMRs?: boolean;
  onSuccess: (msg: string) => void;
  onError?: (msg: string) => void;
}

export const PhaseBOQModal: React.FC<PhaseBOQModalProps> = ({
  isOpen,
  onClose,
  phase,
  hasActiveMRs,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<PhaseBOQForm>({
    resolver: zodResolver(phaseBOQSchema),
    defaultValues: {
      materials: [{ name: '', quantity: 1, unit: 'bao' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'materials'
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        materials: phase.materials && phase.materials.length > 0
          ? phase.materials
          : [{ name: '', quantity: 1, unit: 'bao' }]
      });
    }
  }, [isOpen, phase, reset]);

  const mutation = useMutation({
    mutationFn: async (data: PhaseBOQForm) => {
      const validMaterials = data.materials.map(it => ({ ...it, name: it.name.trim() }));
      return projectService.updatePhaseMaterials(phase.id, validMaterials);
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Cập nhật Bảng vật tư BOQ: ${phase.name}`}>
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
                onClick={() => append({ name: '', quantity: 1, unit: 'bao' })} 
                className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1"
              >
                <Plus size={14} /><span>Thêm vật tư</span>
              </button>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            {fields.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-[2.5fr_1fr_1fr_auto] gap-2 items-start">
                <div>
                  <input 
                    type="text" 
                    placeholder="Tên vật tư (VD: Xi măng PCB40)..." 
                    {...register(`materials.${idx}.name` as const)}
                    disabled={hasActiveMRs}
                    className={`w-full text-sm px-3 py-2 rounded-md border ${errors.materials?.[idx]?.name ? 'border-red-500' : 'border-slate-200'} ${hasActiveMRs ? 'bg-slate-100' : 'bg-white'} text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                  />
                  {errors.materials?.[idx]?.name && <p className="text-red-500 text-xs mt-1">{errors.materials[idx]?.name?.message}</p>}
                </div>
                
                <div>
                  <input 
                    type="number" 
                    min={1} 
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
                    {...register(`materials.${idx}.unit` as const)}
                    disabled={hasActiveMRs}
                    className={`w-full text-sm px-3 py-2 rounded-md border ${errors.materials?.[idx]?.unit ? 'border-red-500' : 'border-slate-200'} ${hasActiveMRs ? 'bg-slate-100' : 'bg-white'} text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                  />
                  {errors.materials?.[idx]?.unit && <p className="text-red-500 text-xs mt-1">{errors.materials[idx]?.unit?.message}</p>}
                </div>
                
                {!hasActiveMRs && (
                  <button 
                    type="button" 
                    disabled={fields.length === 1}
                    onClick={() => remove(idx)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
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
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Lưu Bảng BOQ'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
