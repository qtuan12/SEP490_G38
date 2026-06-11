import React, { useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {projectService} from '../../../../src/services/projectService';
import type {WBSTask, WBSPhase, MaterialRequest} from '../../../types/common';
import { Modal } from '../../../../src/components/Modal';

const createMaterialRequestSchema = z.object({
  type: z.enum(['normal', 'emergency']),
  reason: z.string().optional(),
  invoiceImage: z.string().optional(),
  items: z.array(
    z.object({
      name: z.string().min(1, 'Vui lòng chọn vật tư.'),
      quantity: z.number().min(0.01, 'Số lượng phải > 0'),
      unit: z.string().min(1, 'Vui lòng nhập ĐVT')
    })
  ).min(1, 'Cần ít nhất 1 vật tư')
}).superRefine((data, ctx) => {
  if (data.type === 'emergency' && (!data.invoiceImage || data.invoiceImage.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mua ngoài khẩn cấp bắt buộc phải tải ảnh hóa đơn.',
      path: ['invoiceImage']
    });
  }
});

type CreateMaterialRequestForm = z.infer<typeof createMaterialRequestSchema>;

export interface CreateMaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: WBSTask;
  phase?: WBSPhase;
  projectId: string;
  user: any;
  isLeader?: boolean;
  allMaterialRequests: MaterialRequest[];
  requestType: 'normal' | 'emergency';
  onSuccess: (msg: string) => void;
  onError?: (msg: string) => void;
}

export const CreateMaterialRequestModal: React.FC<CreateMaterialRequestModalProps> = ({
  isOpen,
  onClose,
  task,
  phase,
  projectId,
  user,
  isLeader,
  allMaterialRequests,
  requestType,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  
  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateMaterialRequestForm>({
    resolver: zodResolver(createMaterialRequestSchema),
    defaultValues: {
      type: requestType,
      reason: '',
      invoiceImage: '',
      items: [{ name: '', quantity: 1, unit: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchedItems = watch('items') || [];
  const type = watch('type');
  const reason = watch('reason') || '';

  useEffect(() => {
    if (isOpen) {
      reset({
        type: requestType,
        reason: '',
        invoiceImage: '',
        items: [{ name: '', quantity: 1, unit: '' }]
      });
    }
  }, [isOpen, requestType, reset]);

  // Tính tổng số lượng vật tư Phase đã yêu cầu
  const phaseRequestedMaterials = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; unit: string }>();
    allMaterialRequests.forEach(r => {
      if (r.phaseId === phase?.id && !r.taskId && r.status !== 'rejected') {
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
  }, [allMaterialRequests, phase?.id]);

  // Nguồn vật tư gốc để chọn
  const sourceMaterials = task ? phaseRequestedMaterials : (phase?.materials || []);

  const getUsedQuantity = (materialName: string) => {
    let sum = 0;
    allMaterialRequests.forEach(r => {
      if (r.phaseId === phase?.id && r.status !== 'rejected') {
        if (task && r.taskId) {
          const item = r.items.find(i => i.name === materialName);
          if (item) sum += item.quantity;
        } else if (!task && !r.taskId) {
          const item = r.items.find(i => i.name === materialName);
          if (item) sum += item.quantity;
        }
      }
    });
    return sum;
  };

  const isOverBOQ = useMemo(() => {
    for (const it of watchedItems) {
      if (!it.name) continue;
      const sourceItem = sourceMaterials.find(m => m.name === it.name);
      const limit = sourceItem ? sourceItem.quantity : 0;
      const used = getUsedQuantity(it.name);
      if (used + (it.quantity || 0) > limit) {
        return true;
      }
    }
    return false;
  }, [watchedItems, sourceMaterials, getUsedQuantity]);

  const mutation = useMutation({
    mutationFn: async (data: CreateMaterialRequestForm) => {
      if (isOverBOQ && (!data.reason || data.reason.trim() === '')) {
        throw new Error('Yêu cầu VƯỢT ĐỊNH MỨC bắt buộc phải nhập Lý do giải trình!');
      }

      return projectService.createMaterialRequest({
        projectId,
        taskId: task?.id,
        taskName: task?.name,
        phaseId: phase?.id,
        phaseName: phase?.name,
        requesterName: user?.name || 'PL',
        items: data.items.map(it => ({ name: it.name, quantity: it.quantity, unit: it.unit })),
        type: data.type,
        invoiceImage: data.type === 'emergency' ? data.invoiceImage?.trim() : undefined,
        reason: data.reason?.trim() || undefined,
        isOverBOQ: isOverBOQ
      }, user?.role, isLeader);
    },
    onSuccess: (_, variables) => {
      const msg = variables.type === 'emergency'
        ? 'Đã lập phiếu mua ngoài khẩn cấp! Hệ thống tự động sinh PO & Phiếu nhập kho, tăng tồn kho ảo tức thì.'
        : (isOverBOQ ? 'Đã gửi yêu cầu vật tư VƯỢT ĐỊNH MỨC (Chờ Giám đốc).' : 'Đã gửi yêu cầu vật tư (Chờ Kế toán).');
      toast.success(msg);
      onSuccess(msg);
      queryClient.invalidateQueries({ queryKey: ['materialRequests'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi tạo yêu cầu vật tư.');
    }
  });

  const onSubmit = (data: CreateMaterialRequestForm) => {
    mutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? "Đề xuất Vật tư cho Công việc" : "Yêu cầu Vật tư cho Phase"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="text-sm bg-blue-50 text-blue-800 p-3 rounded-md border border-blue-100">
          {task ? (
            <span>Công việc: <strong>{task.name}</strong></span>
          ) : (
            <span>Giai đoạn (Phase): <strong>{phase?.name}</strong></span>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-slate-600">Hình thức yêu cầu:</label>
          <div className={`text-sm font-medium ${type === 'emergency' ? 'text-amber-600' : 'text-blue-600'}`}>
            {type === 'normal' ? 'Yêu cầu thông thường (Chờ Kế toán)' : 'Mua ngoài khẩn cấp (Direct Purchase - Chờ Kế toán duyệt)'}
          </div>
        </div>

        {isOverBOQ ? (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-600">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span className="text-sm font-semibold">
              TỔNG YÊU CẦU VƯỢT ĐỊNH MỨC BOQ. Bắt buộc giải trình lý do và phải chờ Giám đốc duyệt.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-600">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span className="text-sm font-semibold">
              Các vật tư yêu cầu nằm trong định mức {task ? 'của Phase' : 'cho phép'}. Sau khi được duyệt sẽ cấp phát cho công trường.
            </span>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-slate-700">Danh sách vật tư yêu cầu <span className="text-red-500">*</span></span>
            <button 
              type="button" 
              onClick={() => append({ name: '', quantity: 1, unit: '' })} 
              className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1"
            >
              <Plus size={14} /><span>Thêm vật tư</span>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {fields.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-start">
                <div>
                  {sourceMaterials.length > 0 ? (
                    <select
                      {...register(`items.${idx}.name` as const)}
                      onChange={(e) => {
                        const selName = e.target.value;
                        setValue(`items.${idx}.name`, selName);
                        const selSource = sourceMaterials.find(m => m.name === selName);
                        if (selSource) {
                          setValue(`items.${idx}.unit`, selSource.unit);
                        }
                      }}
                      className={`w-full text-sm px-3 py-2 rounded-md border ${errors.items?.[idx]?.name ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
                    >
                      <option value="" disabled>-- Chọn vật tư ({task ? 'Từ Phase' : 'BOQ'}) --</option>
                      {sourceMaterials.map(sm => (
                        <option key={sm.name} value={sm.name}>{sm.name} (Max: {sm.quantity} {sm.unit})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Tên vật tư..."
                      {...register(`items.${idx}.name` as const)}
                      className={`w-full text-sm px-3 py-2 rounded-md border ${errors.items?.[idx]?.name ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
                    />
                  )}
                  {errors.items?.[idx]?.name && <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.name?.message}</p>}
                </div>

                <div>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    placeholder="SL"
                    {...register(`items.${idx}.quantity` as const, { valueAsNumber: true })}
                    className={`w-full text-sm px-3 py-2 rounded-md border ${errors.items?.[idx]?.quantity ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
                  />
                  {errors.items?.[idx]?.quantity && <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.quantity?.message}</p>}
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="ĐVT"
                    {...register(`items.${idx}.unit` as const)}
                    disabled={sourceMaterials.length > 0}
                    className={`w-full text-sm px-3 py-2 rounded-md border ${errors.items?.[idx]?.unit ? 'border-red-500' : 'border-slate-200'} ${sourceMaterials.length > 0 ? 'bg-slate-100' : 'bg-white'} text-slate-900 focus:outline-none focus:border-blue-600`}
                  />
                  {errors.items?.[idx]?.unit && <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.unit?.message}</p>}
                </div>

                <button
                  type="button"
                  disabled={fields.length === 1}
                  onClick={() => remove(idx)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {errors.items?.message && <p className="text-red-500 text-xs mt-1">{errors.items.message}</p>}
          </div>
        </div>

        {type === 'emergency' && (
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

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">Lý do yêu cầu / Giải trình</label>
          <textarea
            placeholder="Nêu lý do hao hụt, hư hỏng hoặc sự cần thiết..."
            {...register('reason')}
            rows={2}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.reason ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
          />
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending || (isOverBOQ && !reason)}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : type === 'emergency' ? 'Nhập kho khẩn cấp' : 'Gửi yêu cầu'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
