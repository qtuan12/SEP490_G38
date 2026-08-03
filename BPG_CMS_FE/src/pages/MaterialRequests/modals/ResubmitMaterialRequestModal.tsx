import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { projectService } from '../../../../src/services/projectService';
import { materialService } from '../../../../src/services/materialService';
import type { MaterialCatalog } from '../../../../src/types/material';
import type { MaterialRequest } from '../../../types/common';
import { Modal } from '../../../../src/components/ui/Modal';
import { SearchSelect } from '../../../../src/components/ui/SearchSelect';
import { isDiscreteUnit } from '../../../../src/utils/unitHelpers';

const resubmitMaterialRequestSchema = z.object({
  type: z.enum(['normal', 'emergency']),
  reason: z.string().optional(),
  invoiceImage: z.string().optional(),
  isOverBOQ: z.boolean(),
  items: z.array(
    z.object({
      name: z.string().min(1, 'Vui lòng nhập tên vật tư.'),
      quantity: z.number({ message: 'Vui lòng nhập số lượng.' }).min(0.01, 'Số lượng phải > 0'),
      unit: z.string().min(1, 'Vui lòng nhập ĐVT')
    })
  ).min(1, 'Cần ít nhất 1 vật tư')
}).superRefine((data, ctx) => {
  // Kiểm tra trùng lặp vật tư
  const names = data.items.map(it => it.name).filter(name => name.trim() !== '');
  if (names.length !== new Set(names).size) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Danh sách vật tư yêu cầu không được trùng lặp.',
      path: ['items']
    });
  }

  if (data.type === 'emergency' && (!data.invoiceImage || data.invoiceImage.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mua ngoài khẩn cấp bắt buộc phải tải ảnh hóa đơn.',
      path: ['invoiceImage']
    });
  }

  // Ràng buộc ĐVT số nguyên không chấp nhận số lượng lẻ
  data.items.forEach((item, idx) => {
    if (item.name && isDiscreteUnit(item.unit)) {
      if (item.quantity % 1 !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Đơn vị "${item.unit}" yêu cầu số lượng phải là số nguyên.`,
          path: ['items', idx, 'quantity']
        });
      }
    }
  });
});

type ResubmitMaterialRequestForm = z.infer<typeof resubmitMaterialRequestSchema>;

export interface ResubmitMaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: MaterialRequest;
  projectId: string;
  onSuccess: (msg: string) => void;
  onError?: (msg: string) => void;
}

export const ResubmitMaterialRequestModal: React.FC<ResubmitMaterialRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const [allCatalogs, setAllCatalogs] = React.useState<MaterialCatalog[]>([]);

  useEffect(() => {
    materialService.getMaterials({ pageSize: 1000 }).then(res => {
      setAllCatalogs(res.items || []);
    }).catch(console.error);
  }, []);

  const { register, control, handleSubmit, reset, watch, setValue, trigger, formState: { errors } } = useForm<ResubmitMaterialRequestForm>({
    resolver: zodResolver(resubmitMaterialRequestSchema),
    mode: 'onTouched',
    defaultValues: {
      type: request.type || 'normal',
      reason: request.reason || '',
      invoiceImage: request.invoiceImage || '',
      isOverBOQ: request.isOverBOQ || false,
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
  const isPhaseRequest = !!request.phaseId && !request.taskId;

  const handleMaterialChange = (index: number, name: string) => {
    const mat = allCatalogs.find(m => m.name === name);
    if (mat) {
      setValue(`items.${index}.unit`, mat.baseUnitName || '', { shouldValidate: true, shouldTouch: true, shouldDirty: true });
    }
  };

  useEffect(() => {
    if (isOpen) {
      reset({
        type: request.type || 'normal',
        reason: request.reason || '',
        invoiceImage: request.invoiceImage || '',
        isOverBOQ: request.isOverBOQ || false,
        items: request.items.length > 0
          ? request.items.map(it => ({ name: it.name, quantity: it.quantity, unit: it.unit }))
          : [{ name: '', quantity: 1, unit: '' }]
      });
    }
  }, [isOpen, request, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ResubmitMaterialRequestForm) => {
      return projectService.resubmitMaterialRequest(request.id, {
        items: data.items.map(it => ({ name: it.name.trim(), quantity: it.quantity, unit: it.unit.trim() })),
        type: data.type,
        invoiceImage: data.type === 'emergency' ? data.invoiceImage?.trim() : undefined,
        reason: data.reason?.trim() || undefined,
        isOverBOQ: data.isOverBOQ
      });
    },
    onSuccess: (_, variables) => {
      const msg = variables.type === 'emergency'
        ? 'Đã gửi lại yêu cầu mua ngoài khẩn cấp! Hệ thống tự động sinh PO & Phiếu nhập kho, tăng tồn kho ảo tức thì.'
        : 'Đã gửi lại yêu cầu cấp vật tư.';
      toast.success(msg);
      onSuccess(msg);
      queryClient.invalidateQueries({ queryKey: ['materialRequests'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi gửi lại yêu cầu vật tư.');
    }
  });

  const onSubmit = (data: ResubmitMaterialRequestForm) => {
    mutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gửi lại Yêu cầu Vật tư">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-600">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            Lý do: <strong>{request.rejectionReason || 'Không có'}</strong>
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

        {!isPhaseRequest && type === 'normal' && (
          <div className="flex items-center gap-2 mt-2">
            <input
              id="is-over-boq-resubmit"
              type="checkbox"
              {...register('isOverBOQ')}
              className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
            />
            <label htmlFor="is-over-boq-resubmit" className="text-sm font-medium text-red-600 cursor-pointer">
              ⚠️ Vượt định mức (Over BOQ) - Cần Giám đốc phê duyệt
            </label>
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

          <div className="flex flex-col gap-2">
            {fields.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-start">
                <div>
                  <SearchSelect
                    options={allCatalogs.map(sm => ({
                      label: sm.name,
                      value: sm.name
                    }))}
                    value={watchedItems[idx]?.name || ''}
                    onChange={async (selName) => {
                      setValue(`items.${idx}.name`, selName, { shouldValidate: true });
                      handleMaterialChange(idx, selName);
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
                    className={`w-full text-sm px-3 py-2 rounded-md border ${errors.items?.[idx]?.unit ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
                  />
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
            ))}
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
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">Lý do yêu cầu / Giải trình</label>
          <textarea
            placeholder="Nêu lý do hao hụt, hư hỏng hoặc giải trình bổ sung..."
            {...register('reason')}
            rows={2}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.reason ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
          />
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
