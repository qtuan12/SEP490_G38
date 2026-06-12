import React, { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/Modal';
import { projectService } from '../../../services/projectService';
import type {IncidentReport, ProjectMember, WBSPhase, WBSTask} from '../../../types/common';
import { Info, AlertCircle } from 'lucide-react';

const schema = z.object({
  resolutionAction: z.enum(['rework', 'reduce_progress']),
  reworkName: z.string().optional(),
  reworkDeadline: z.string().optional(),
  reworkAssigneeId: z.string().optional(),
  reduceProgressValue: z.number().min(0).max(100).optional(),
  reduceProgressReason: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.resolutionAction === 'rework') {
    if (!data.reworkName || data.reworkName.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập tên công việc Rework', path: ['reworkName'] });
    }
    if (!data.reworkDeadline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng chọn hạn hoàn thành', path: ['reworkDeadline'] });
    }
    if (!data.reworkAssigneeId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng chọn kỹ sư', path: ['reworkAssigneeId'] });
    }
  } else {
    if (data.reduceProgressValue === undefined || data.reduceProgressValue <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phần trăm giảm phải lớn hơn 0', path: ['reduceProgressValue'] });
    }
    if (!data.reduceProgressReason || data.reduceProgressReason.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập lý do', path: ['reduceProgressReason'] });
    }
  }
});

type FormData = z.infer<typeof schema>;

interface ResolveIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentReport;
  task: WBSTask;
  phase: WBSPhase | null;
  members: ProjectMember[];
  user: { id: string; name: string } | null;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const ResolveIncidentModal: React.FC<ResolveIncidentModalProps> = ({
  isOpen,
  onClose,
  incident,
  task,
  phase,
  members,
  user,
  onSuccess,
  onError
}) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      resolutionAction: 'rework',
      reworkName: `[Rework] Khắc phục - ${incident.taskName}`,
      reworkDeadline: phase?.deadline || '',
      reworkAssigneeId: members.length > 0 ? members[0].userId : '',
      reduceProgressValue: 0,
      reduceProgressReason: ''
    }
  });

  const resolutionAction = useWatch({ control, name: 'resolutionAction' });
  const reworkDeadline = useWatch({ control, name: 'reworkDeadline' });
  const reduceProgressValue = useWatch({ control, name: 'reduceProgressValue' });

  useEffect(() => {
    if (isOpen) {
      reset({
        resolutionAction: 'rework',
        reworkName: `[Rework] Khắc phục - ${incident.taskName}`,
        reworkDeadline: phase?.deadline || '',
        reworkAssigneeId: members.length > 0 ? members[0].userId : '',
        reduceProgressValue: 0,
        reduceProgressReason: ''
      });
    }
  }, [isOpen, incident, phase, members, reset]);

  const isExceedingReserve = reworkDeadline && phase?.deadline
    ? new Date(reworkDeadline) > new Date(phase.deadline)
    : false;

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let resolutionData: any = {};
      
      if (data.resolutionAction === 'rework') {
        const selectedAssignee = members.find(m => m.userId === data.reworkAssigneeId);
        if (!selectedAssignee) throw new Error('Không tìm thấy kỹ sư đã chọn.');

        resolutionData = {
          name: data.reworkName!.trim(),
          deadline: data.reworkDeadline,
          assignedTo: data.reworkAssigneeId,
          assignedName: selectedAssignee.userName
        };
      } else {
        resolutionData = {
          reduction: Number(data.reduceProgressValue),
          reason: data.reduceProgressReason!.trim()
        };
      }

      await projectService.resolveIncident(
        incident.id, 
        data.resolutionAction,
        resolutionData,
        { id: user?.id || 'u-admin', name: user?.name || 'TPKT' }
      );
      
      return data;
    },
    onSuccess: (data) => {
      const msg = data.resolutionAction === 'rework' 
        ? `Đã duyệt sự cố và tạo công việc khắc phục: "${data.reworkName?.trim()}"`
        : `Đã duyệt sự cố và giảm ${data.reduceProgressValue}% tiến độ công việc gốc.`;
      
      onSuccess(msg);
      onClose();
    },
    onError: (err: any) => {
      onError(err.message || 'Lỗi khi duyệt sự cố.');
    }
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Phê duyệt Sự cố">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', gap: '20px', padding: '10px', backgroundColor: 'hsl(var(--bg-muted))', borderRadius: 'var(--radius-sm)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input 
              type="radio" 
              value="rework" 
              {...register('resolutionAction')}
            />
            Tạo Rework Task mới
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input 
              type="radio" 
              value="reduce_progress" 
              {...register('resolutionAction')}
            />
            Giảm % tiến độ Task
          </label>
        </div>

        {resolutionAction === 'rework' ? (
          <>
            {phase && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: 'hsl(var(--primary-glow))', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'hsl(var(--primary))' }}>
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>Hạn chót của Giai đoạn (Phase Deadline): <strong>{phase.deadline || 'Không xác định'}</strong></span>
              </div>
            )}

            <div>
              <label htmlFor="rework-name">Tên Công việc Rework mới <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <input
                id="rework-name"
                type="text"
                {...register('reworkName')}
              />
              {errors.reworkName && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.reworkName.message}</span>}
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '4px' }}>
                * Task cũ sẽ chuyển sang Obsolete (Khóa). Rework task mới sẽ làm lại từ 0%.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="rework-deadline">Hạn hoàn thành (Deadline) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                <input
                  id="rework-deadline"
                  type="date"
                  {...register('reworkDeadline')}
                />
                {errors.reworkDeadline && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.reworkDeadline.message}</span>}
              </div>
              <div>
                <label htmlFor="rework-assignee">Giao cho kỹ sư phụ trách <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                <select id="rework-assignee" {...register('reworkAssigneeId')}>
                  {members.map(m => (
                    <option key={m.userId} value={m.userId}>{m.userName} ({m.userRole})</option>
                  ))}
                </select>
                {errors.reworkAssigneeId && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.reworkAssigneeId.message}</span>}
              </div>
            </div>

            {isExceedingReserve && (
              <div className="animate-fade-in" style={{
                display: 'flex',
                gap: '8px',
                padding: '12px',
                backgroundColor: 'hsl(var(--danger) / 0.1)',
                border: '1px solid hsl(var(--danger) / 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: 'hsl(var(--danger))',
                fontSize: '0.85rem'
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>CẢNH BÁO: VỠ KẾ HOẠCH DỰ DỰ PHÒNG!</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', lineHeight: '1.3' }}>
                    Hạn hoàn thành công việc Rework đã vượt quá hạn chót của Giai đoạn.
                    Cảnh báo đỏ vỡ tiến độ sẽ lập tức được gửi lên Giám đốc để xử lý đàm phán!
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="target-progress" style={{ display: 'block', marginBottom: '8px' }}>
                Kéo thả để điều chỉnh Tiến độ thực tế <span style={{ color: 'hsl(var(--danger))' }}>*</span>
              </label>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'hsl(var(--bg-card))', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                <div style={{ width: '60px', textAlign: 'right', fontSize: '1.4rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                  {(task?.progress || 0) - (reduceProgressValue || 0)}%
                </div>
                
                <input
                  id="target-progress"
                  type="range"
                  min="0"
                  max={task?.progress || 100}
                  value={(task?.progress || 0) - (reduceProgressValue || 0)}
                  onChange={(e) => {
                    const newTarget = Number(e.target.value);
                    setValue('reduceProgressValue', (task?.progress || 0) - newTarget);
                  }}
                  style={{ flex: 1, cursor: 'pointer', accentColor: 'hsl(var(--primary))' }}
                />
                
                <div style={{ minWidth: '90px', fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                  (Bị trừ <strong style={{ color: 'hsl(var(--danger))' }}>{reduceProgressValue || 0}%</strong>)
                </div>
              </div>
              {errors.reduceProgressValue && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.reduceProgressValue.message}</span>}
            </div>
            <div>
              <label htmlFor="reduce-progress-reason">Lý do/Ghi chú <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <textarea
                id="reduce-progress-reason"
                rows={2}
                placeholder="Lý do trừ tiến độ..."
                {...register('reduceProgressReason')}
              />
              {errors.reduceProgressReason && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.reduceProgressReason.message}</span>}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ backgroundColor: resolutionAction === 'rework' && isExceedingReserve ? 'hsl(var(--danger))' : 'hsl(var(--primary))' }}>
            {isSubmitting ? 'Đang duyệt...' : 'Xác nhận Phê duyệt'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
