import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/Modal';
import { projectService } from '../../../services/projectService';

const schema = z.object({
  incidentType: z.enum(['Construction', 'InventoryLoss', 'InventoryDamage', 'Delay', 'Safety', 'Other']),
  description: z.string().min(5, 'Mô tả sự cố phải có ít nhất 5 ký tự'),
  images: z.string().optional(),
  damageDescription: z.string().min(5, 'Mô tả thiệt hại phải có ít nhất 5 ký tự'),
  estimatedMaterialLoss: z.coerce.number().min(0),
  estimatedLaborDays: z.coerce.number().min(0, 'Số ngày không hợp lệ'),
  estimatedDelayDays: z.coerce.number().min(0, 'Số ngày không hợp lệ'),
  proposedAction: z.string().min(1, 'Vui lòng chọn đề xuất xử lý')
});

type FormData = z.infer<typeof schema>;

interface ReportIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskId: string;
  taskName: string;
  user: { id: string; name: string } | null;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({
  isOpen,
  onClose,
  projectId,
  taskId,
  taskName,
  user,
  onSuccess,
  onError
}) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      incidentType: 'Construction',
      estimatedMaterialLoss: 0,
      estimatedLaborDays: 1,
      estimatedDelayDays: 0,
      proposedAction: 'Tạo Rework Task'
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const imgUrls = data.images ? data.images.split('\n').map(url => url.trim()).filter(Boolean) : [];

      await projectService.createIncident({
        projectId,
        taskId,
        taskName,
        reporterId: user?.id || 'u-unknown',
        reporterName: user?.name || 'PL',
        incidentType: data.incidentType,
        description: data.description.trim(),
        images: imgUrls.length > 0 ? imgUrls : ['https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=600&q=80'],
        damageDescription: data.damageDescription.trim(),
        estimatedMaterialLoss: data.estimatedMaterialLoss,
        estimatedLaborDays: data.estimatedLaborDays,
        estimatedDelayDays: data.estimatedDelayDays,
        proposedAction: data.proposedAction
      });
    },
    onSuccess: () => {
      onSuccess('Đã báo cáo sự cố & thiệt hại thành công và chuyển lên TPKT.');
      reset();
      onClose();
    },
    onError: (err: any) => {
      onError(err.message || 'Lỗi khi báo cáo sự cố.');
    }
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lập Báo cáo Sự cố &amp; Thiệt hại">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ paddingBottom: '12px', borderBottom: '1px solid hsl(var(--border))' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'hsl(var(--primary))' }}>PHẦN 1: THÔNG TIN SỰ CỐ</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label>Phân loại nguồn gốc sự cố</label>
              <select {...register('incidentType')}>
                <option value="Construction">Sự cố Thi công (Construction)</option>
                <option value="InventoryLoss">Thất thoát vật tư (Inventory Loss)</option>
                <option value="InventoryDamage">Hư hại vật tư (Inventory Damage)</option>
                <option value="Delay">Chậm tiến độ (Delay)</option>
                <option value="Safety">An toàn lao động (Safety)</option>
                <option value="Other">Khác (Other)</option>
              </select>
              {errors.incidentType && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.incidentType.message}</span>}
            </div>

            <div>
              <label htmlFor="create-desc">Mô tả chi tiết sự cố hiện trường <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <textarea
                id="create-desc"
                placeholder="Nêu rõ diễn biến sự cố, phần kết cấu bị ảnh hưởng, thời điểm phát hiện..."
                {...register('description')}
                rows={2}
              />
              {errors.description && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.description.message}</span>}
            </div>

            <div>
              <label htmlFor="create-imgs">Hình ảnh hiện trường (Nhập url ảnh, mỗi url 1 dòng)</label>
              <textarea
                id="create-imgs"
                placeholder="https://example.com/photo1.jpg"
                {...register('images')}
                rows={1}
              />
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'hsl(var(--primary))' }}>PHẦN 2: ĐÁNH GIÁ THIỆT HẠI &amp; ĐỀ XUẤT</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label htmlFor="damage-description">Mô tả đánh giá chi tiết <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <textarea
                id="damage-description"
                placeholder="Đánh giá khối lượng thiệt hại, mức độ ảnh hưởng kết cấu..."
                {...register('damageDescription')}
                rows={2}
              />
              {errors.damageDescription && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.damageDescription.message}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="damage-loss">Ước tính vật tư hao phí (VNĐ)</label>
                <input
                  id="damage-loss"
                  type="number"
                  placeholder="0"
                  {...register('estimatedMaterialLoss', { valueAsNumber: true })}
                />
                {errors.estimatedMaterialLoss && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.estimatedMaterialLoss.message}</span>}
              </div>
              <div>
                <label htmlFor="damage-days">Số ngày nhân công khắc phục <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                <input
                  id="damage-days"
                  type="number"
                  min={0}
                  {...register('estimatedLaborDays', { valueAsNumber: true })}
                />
                {errors.estimatedLaborDays && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.estimatedLaborDays.message}</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="damage-delay">Số ngày dự kiến trễ tiến độ <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                <input
                  id="damage-delay"
                  type="number"
                  min={0}
                  {...register('estimatedDelayDays', { valueAsNumber: true })}
                />
                {errors.estimatedDelayDays && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.estimatedDelayDays.message}</span>}
              </div>
              <div>
                <label htmlFor="proposed-action">Đề xuất xử lý <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                <select id="proposed-action" {...register('proposedAction')}>
                  <option value="Tạo Rework Task">Tạo Rework Task</option>
                  <option value="Giảm tiến độ task">Giảm tiến độ task</option>
                  <option value="Khác">Khác</option>
                </select>
                {errors.proposedAction && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.proposedAction.message}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu Báo cáo & Trình TPKT'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
