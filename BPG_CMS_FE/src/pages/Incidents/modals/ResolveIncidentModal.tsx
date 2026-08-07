import React, { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { incidentService } from '../../../services/incidentService';
import type { IncidentReport, ProjectMember, WBSPhase, WBSTask } from '../../../types/common';
import { Info, AlertCircle } from 'lucide-react';

const schema = z.object({
  handlingInstruction: z.string().min(1, 'Vui lòng nhập hướng dẫn xử lý/giải quyết'),
  resolutionAction: z.enum(['rework', 'reduce_progress']),
  reworkName: z.string().optional(),
  reworkDeadline: z.string().optional(),
  reworkAssigneeId: z.string().optional(),
  reduceProgressValue: z.number().min(0).max(100).optional(),
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

export const ResolveIncidentForm: React.FC<Omit<ResolveIncidentModalProps, 'isOpen'>> = ({
  onClose,
  incident,
  task,
  phase,
  members,
  onSuccess,
  onError
}) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control, setValue, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      resolutionAction: 'rework',
      handlingInstruction: '',
      reworkName: `[Rework] Khắc phục - ${incident.taskName}`,
      reworkDeadline: phase?.deadline || '',
      reworkAssigneeId: members.length > 0 ? members[0].userId : '',
      reduceProgressValue: 0
    }
  });

  const resolutionAction = useWatch({ control, name: 'resolutionAction' });
  const reworkDeadline = useWatch({ control, name: 'reworkDeadline' });
  const reduceProgressValue = useWatch({ control, name: 'reduceProgressValue' });

  useEffect(() => {
    reset({
      handlingInstruction: '',
      resolutionAction: 'rework',
      reworkName: `[Rework] Khắc phục - ${incident.taskName}`,
      reworkDeadline: phase?.deadline || '',
      reworkAssigneeId: members.length > 0 ? members[0].userId : '',
      reduceProgressValue: 0
    });
  }, [incident, phase, members, reset]);

  const isExceedingReserve = reworkDeadline && phase?.deadline
    ? new Date(reworkDeadline) > new Date(phase.deadline)
    : false;

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let createReworkTask = false;
      let reworkTaskName, reworkTaskStartDate, reworkTaskEndDate, decreaseProgressTo;

      if (data.resolutionAction === 'rework') {
        createReworkTask = true;
        reworkTaskName = data.reworkName!.trim();
        reworkTaskStartDate = new Date().toISOString();
        reworkTaskEndDate = data.reworkDeadline ? new Date(data.reworkDeadline).toISOString() : new Date().toISOString();
      } else {
        createReworkTask = false;
        decreaseProgressTo = (task?.progress || 0) - Number(data.reduceProgressValue);
      }

      await incidentService.confirmIncident(
        Number(incident.id || (incident as any).incidentId),
        {
          incidentId: Number(incident.id || (incident as any).incidentId),
          createReworkTask,
          reworkTaskName,
          reworkTaskStartDate,
          reworkTaskEndDate,
          reworkAssigneeId: data.reworkAssigneeId ? Number(data.reworkAssigneeId) : undefined,
          decreaseProgressTo,
          decreaseProgressReason: data.handlingInstruction,
          handlingInstruction: data.handlingInstruction
        }
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
    if (data.resolutionAction === 'rework' && data.reworkDeadline) {
      const selectedDate = new Date(data.reworkDeadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        setError('reworkDeadline', { type: 'manual', message: 'Hạn hoàn thành không được nằm trong quá khứ' });
        return;
      }
    }
    mutation.mutate(data);
  };

  const onInvalid = (errs: any) => {
    console.error('[ResolveIncidentModal] Validation errors:', errs);
    let msg = 'Vui lòng kiểm tra lại các thông tin bắt buộc.';
    if (errs.reduceProgressValue?.message) msg = errs.reduceProgressValue.message;
    else if (errs.reworkName?.message) msg = errs.reworkName.message;

    onError(msg);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div style={{ padding: '16px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', backgroundColor: 'hsl(var(--bg-card))' }}>
          <label htmlFor="handlingInstruction" style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>Hướng dẫn xử lý / Giải quyết <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
          <textarea
            id="handlingInstruction"
            rows={3}
            className="input"
            style={{ marginTop: '6px' }}
            placeholder="Nhập hướng giải quyết cho sự cố này..."
            {...register('handlingInstruction')}
          />
          {errors.handlingInstruction && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.handlingInstruction.message}</span>}
        </div>

        {/* Option Cards for Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
          <label
            style={{
              display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px',
              border: resolutionAction === 'rework' ? '2px solid hsl(var(--primary))' : '2px solid hsl(var(--border))',
              backgroundColor: resolutionAction === 'rework' ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-card))',
              borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: resolutionAction === 'rework' ? '0 4px 12px hsl(var(--primary)/0.1)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="radio"
                value="rework"
                {...register('resolutionAction')}
                style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--primary))' }}
              />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: resolutionAction === 'rework' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))' }}>Tạo công việc mới</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', paddingLeft: '28px', lineHeight: '1.4' }}>
              Lập công việc khắc phục mới để sửa lỗi, đồng thời khóa (Obsolete) công việc hiện tại.
            </span>
          </label>

          <label
            style={{
              display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px',
              border: resolutionAction === 'reduce_progress' ? '2px solid hsl(var(--primary))' : '2px solid hsl(var(--border))',
              backgroundColor: resolutionAction === 'reduce_progress' ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-card))',
              borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: resolutionAction === 'reduce_progress' ? '0 4px 12px hsl(var(--primary)/0.1)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="radio"
                value="reduce_progress"
                {...register('resolutionAction')}
                style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--primary))' }}
              />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: resolutionAction === 'reduce_progress' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))' }}>Giảm % Tiến độ</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', paddingLeft: '28px', lineHeight: '1.4' }}>
              Chấp nhận trừ trực tiếp vào % hoàn thành của công việc hiện tại để làm lại phần lỗi.
            </span>
          </label>
        </div>

        <div style={{ padding: '20px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', backgroundColor: 'hsl(var(--bg-main)/0.3)' }}>
          {resolutionAction === 'rework' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {phase && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'hsl(var(--primary-glow))', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary)/0.2)' }}>
                  <Info size={16} style={{ flexShrink: 0 }} />
                  <span>Hạn chót của Giai đoạn: <strong style={{ marginLeft: '4px' }}>{phase.deadline || 'Không xác định'}</strong></span>
                </div>
              )}

              <div>
                <label htmlFor="rework-name" style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>Tên Công việc mới <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                <input
                  id="rework-name"
                  type="text"
                  className="input"
                  style={{ marginTop: '6px' }}
                  {...register('reworkName')}
                />
                {errors.reworkName && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.reworkName.message}</span>}
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '6px' }}>
                  * Task cũ sẽ chuyển sang Khóa.Task mới sẽ làm lại từ 0%.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label htmlFor="rework-deadline" style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>Hạn hoàn thành <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <input
                    id="rework-deadline"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    className="input"
                    style={{ marginTop: '6px' }}
                    {...register('reworkDeadline')}
                  />
                  {errors.reworkDeadline && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.reworkDeadline.message}</span>}
                </div>
                <div>
                  <label htmlFor="rework-assignee" style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>Giao cho kỹ sư phụ trách <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <select id="rework-assignee" className="input" style={{ marginTop: '6px' }} {...register('reworkAssigneeId')}>
                    {members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.userName} </option>
                    ))}
                  </select>
                  {errors.reworkAssigneeId && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.reworkAssigneeId.message}</span>}
                </div>
              </div>

              {isExceedingReserve && (
                <div className="animate-fade-in" style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: 'hsl(var(--danger-glow))',
                  border: '1px solid hsl(var(--danger) / 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'hsl(var(--danger))',
                  fontSize: '0.85rem'
                }}>
                  <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>CẢNH BÁO: VỠ KẾ HOẠCH DỰ DỰ PHÒNG!</strong>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4', color: 'hsl(var(--danger)/0.9)' }}>
                      Hạn hoàn thành công việc Rework đã vượt quá hạn chót của Giai đoạn. Cảnh báo đỏ vỡ tiến độ sẽ lập tức được gửi lên Giám đốc để xử lý đàm phán!
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="target-progress" style={{ display: 'block', marginBottom: '10px', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                  Kéo thả để điều chỉnh Tiến độ thực tế <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'hsl(var(--bg-card))', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border))', boxShadow: '0 2px 8px hsl(var(--foreground)/0.02)' }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '80px', textAlign: 'center', fontSize: '2rem', fontWeight: 800, color: 'hsl(var(--primary))', lineHeight: '1' }}>
                      {(task?.progress || 0) - (reduceProgressValue || 0)}<span style={{ fontSize: '1.2rem', marginLeft: '2px' }}>%</span>
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
                      style={{ flex: 1, cursor: 'pointer', accentColor: 'hsl(var(--primary))', height: '6px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'hsl(var(--danger-glow))', borderRadius: 'var(--radius-sm)', border: '1px dashed hsl(var(--danger)/0.3)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--danger))' }}>Mức phạt tiến độ:</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--danger))' }}>
                      -{reduceProgressValue || 0}%
                    </span>
                  </div>
                </div>
                {errors.reduceProgressValue && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem', marginTop: '6px', display: 'block' }}>{errors.reduceProgressValue.message}</span>}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ backgroundColor: resolutionAction === 'rework' && isExceedingReserve ? 'hsl(var(--danger))' : 'hsl(var(--primary))' }}>
            {isSubmitting ? 'Đang duyệt...' : 'Xác nhận Phê duyệt'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const ResolveIncidentModal: React.FC<ResolveIncidentModalProps> = (props) => {
  if (!props.isOpen) return null;

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Phê duyệt Sự cố">
      <ResolveIncidentForm {...props} />
    </Modal>
  );
};

