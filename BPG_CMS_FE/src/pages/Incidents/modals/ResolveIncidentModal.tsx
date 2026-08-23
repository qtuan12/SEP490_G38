import React, { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { incidentService } from '../../../services/incidentService';
import type { IncidentReport, ProjectMember, WBSPhase, WBSTask } from '../../../types/common';
import { AlertCircle, CalendarDays } from 'lucide-react';

const schema = z.object({
  handlingInstruction: z.string().min(1, 'Vui lòng nhập hướng dẫn xử lý/giải quyết'),
  resolutionAction: z.enum(['rework', 'reduce_progress']),
  reworkName: z.string().optional(),
  reworkDescription: z.string().optional(),
  reworkStartDate: z.string().optional(),
  reworkDeadline: z.string().optional(),
  reworkWeight: z.any().optional(),
  reworkAssigneeId: z.string().optional(),
  reduceProgressValue: z.number().min(0).max(100).optional(),
}).superRefine((data, ctx) => {
  if (data.resolutionAction === 'rework') {
    if (!data.reworkName || data.reworkName.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập tên công việc.', path: ['reworkName'] });
    }
    if (!data.reworkStartDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng chọn ngày bắt đầu.', path: ['reworkStartDate'] });
    }
    if (!data.reworkDeadline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng chọn ngày kết thúc.', path: ['reworkDeadline'] });
    }
    if (data.reworkStartDate && data.reworkDeadline) {
      if (new Date(data.reworkStartDate) > new Date(data.reworkDeadline)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ngày bắt đầu không được lớn hơn ngày kết thúc.', path: ['reworkStartDate'] });
      }
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

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

const getDefaultEndDate = (task: WBSTask | null | undefined, phase: WBSPhase | null | undefined) => {
  if (task?.deadline) {
    try {
      return new Date(task.deadline).toISOString().split('T')[0];
    } catch {}
  }
  if ((task as any)?.endDate) {
    try {
      return new Date((task as any).endDate).toISOString().split('T')[0];
    } catch {}
  }
  if (phase?.deadline) {
    try {
      return new Date(phase.deadline).toISOString().split('T')[0];
    } catch {}
  }
  if (phase?.endDate) {
    try {
      return new Date(phase.endDate).toISOString().split('T')[0];
    } catch {}
  }
  return getTodayDateStr();
};

const getDefaultStartDate = (task: WBSTask | null | undefined) => {
  if (task?.startDate) {
    try {
      return new Date(task.startDate).toISOString().split('T')[0];
    } catch {}
  }
  return getTodayDateStr();
};

export const ResolveIncidentForm: React.FC<Omit<ResolveIncidentModalProps, 'isOpen'>> = ({
  onClose,
  incident,
  task,
  phase,
  members,
  onSuccess,
  onError
}) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      resolutionAction: 'rework',
      handlingInstruction: '',
      reworkName: `[ Khắc phục ] - ${incident.taskName}`,
      reworkDescription: '',
      reworkStartDate: getDefaultStartDate(task),
      reworkDeadline: getDefaultEndDate(task, phase),
      reworkWeight: '1',
      reworkAssigneeId: '',
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
      reworkName: `[ Khắc phục ] - ${incident.taskName}`,
      reworkDescription: '',
      reworkStartDate: getDefaultStartDate(task),
      reworkDeadline: getDefaultEndDate(task, phase),
      reworkWeight: '1',
      reworkAssigneeId: '',
      reduceProgressValue: 0
    });
  }, [incident, phase, task, members, reset]);

  const phaseEndDate = phase?.deadline || phase?.endDate;
  const isExceedingReserve = reworkDeadline && phaseEndDate
    ? new Date(reworkDeadline) > new Date(phaseEndDate)
    : false;

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let createReworkTask = false;
      let reworkTaskName, reworkTaskStartDate, reworkTaskEndDate, decreaseProgressTo;

      if (data.resolutionAction === 'rework') {
        createReworkTask = true;
        reworkTaskName = data.reworkName!.trim();
        reworkTaskStartDate = new Date(data.reworkStartDate!).toISOString();
        reworkTaskEndDate = new Date(data.reworkDeadline!).toISOString();
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
          reworkTaskDescription: data.reworkDescription || undefined,
          reworkTaskWeight: data.reworkWeight ? Number(data.reworkWeight) : 1,
          isOutsourced: false,
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
    mutation.mutate(data);
  };

  const onInvalid = (errs: any) => {
    console.error('[ResolveIncidentModal] Validation errors:', errs);
    let msg = 'Vui lòng kiểm tra lại các thông tin bắt buộc.';
    if (errs.reduceProgressValue?.message) msg = errs.reduceProgressValue.message;
    else if (errs.reworkName?.message) msg = errs.reworkName.message;
    else if (errs.reworkStartDate?.message) msg = errs.reworkStartDate.message;
    else if (errs.reworkDeadline?.message) msg = errs.reworkDeadline.message;
    else if (errs.handlingInstruction?.message) msg = errs.handlingInstruction.message;

    onError(msg);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Option Cards for Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              Lập công việc khắc phục mới để sửa lỗi, đồng thời khóa công việc hiện tại.
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

        {/* Hướng dẫn xử lý */}
        <div style={{ padding: '16px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', backgroundColor: 'hsl(var(--bg-card))' }}>
          <label htmlFor="handlingInstruction" style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>Hướng dẫn xử lý / Giải quyết <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
          <textarea
            id="handlingInstruction"
            rows={2}
            className="input"
            style={{ marginTop: '6px' }}
            placeholder="Nhập hướng giải quyết cho sự cố này..."
            {...register('handlingInstruction')}
          />
          {errors.handlingInstruction && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{errors.handlingInstruction.message}</span>}
        </div>

        {/* Dynamic section: Rework task details OR reduce progress */}
        <div style={{ padding: '20px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', backgroundColor: 'hsl(var(--bg-main)/0.3)' }}>
          {resolutionAction === 'rework' ? (
            <div className="flex flex-col gap-4">
              {/* THỜI GIAN GIAI ĐOẠN */}
              {phase && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 rounded-xl border border-emerald-100/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-start gap-3 transition-all">
                  <div className="bg-white/80 p-2 rounded-lg text-emerald-600 shadow-sm border border-emerald-50">
                    <CalendarDays size={18} className="stroke-[1.75]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 mb-1">Thời gian Giai đoạn</p>
                    <p className="text-[13px] font-semibold text-slate-700 truncate">
                      {phase.startDate ? new Date(phase.startDate).toLocaleDateString('vi-VN') : '---'} - {phase.endDate ? new Date(phase.endDate).toLocaleDateString('vi-VN') : (phase.deadline ? new Date(phase.deadline).toLocaleDateString('vi-VN') : '---')}
                    </p>
                  </div>
                </div>
              )}

              {/* Tên công việc */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">
                  Tên công việc <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đổ bê tông móng..."
                  {...register('reworkName')}
                  className={`w-full text-sm px-3.5 py-2.5 rounded-md border ${errors.reworkName ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                />
                {errors.reworkName && <p className="text-red-500 text-xs mt-1">{errors.reworkName.message}</p>}
              </div>

              {/* Mô tả chi tiết */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">Mô tả chi tiết</label>
                <textarea
                  placeholder="Mô tả các yêu cầu kỹ thuật, vị trí..."
                  {...register('reworkDescription')}
                  rows={3}
                  className="w-full text-sm px-3.5 py-2.5 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                />
              </div>

              {/* Ngày bắt đầu & Ngày kết thúc - Hàng 2 cột rộng rãi không bị che lấp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">
                    Ngày bắt đầu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    {...register('reworkStartDate')}
                    className={`w-full text-sm px-3.5 py-2.5 rounded-md border ${errors.reworkStartDate ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                  />
                  {errors.reworkStartDate && <p className="text-red-500 text-xs mt-1">{errors.reworkStartDate.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">
                    Ngày kết thúc <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    {...register('reworkDeadline')}
                    className={`w-full text-sm px-3.5 py-2.5 rounded-md border ${errors.reworkDeadline ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600`}
                  />
                  {errors.reworkDeadline && <p className="text-red-500 text-xs mt-1">{errors.reworkDeadline.message}</p>}
                </div>
              </div>

              {/* Mức độ quan trọng & Người phụ trách */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">Mức độ quan trọng</label>
                  <select
                    {...register('reworkWeight')}
                    className="w-full text-sm px-3.5 py-2.5 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="1">1 - Bình thường (Mặc định)</option>
                    <option value="2">2 - Cao</option>
                    <option value="3">3 - Quan trọng</option>
                    <option value="4">4 - Rất quan trọng</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1.5">Mức độ càng cao, % hoàn thành của công việc này càng đóng góp nhiều vào tiến độ chung.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">Người phụ trách (Kỹ sư)</label>
                  <select
                    {...register('reworkAssigneeId')}
                    className="w-full text-sm px-3.5 py-2.5 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">-- Chưa phân công --</option>
                    {members.map(e => {
                      let displayRole = e.userRole;
                      if (e.isLeader) displayRole = 'Trưởng dự án';
                      else if (e.userRole === 'TechnicalManager' || e.userRole === 'Technical Manager') displayRole = 'Trưởng phòng kỹ thuật';
                      else if (e.userRole === 'SiteEngineer' || e.userRole === 'Site Engineer' || e.userRole?.toLowerCase() === 'siteengineer') displayRole = 'Nhân viên kỹ thuật';

                      return (
                        <option key={e.userId} value={e.userId}>
                          {e.userName} {displayRole ? `- ${displayRole}` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1.5">Chọn kỹ sư trong dự án phụ trách giám sát công việc khắc phục này.</p>
                </div>
              </div>

              {isExceedingReserve && (
                <div className="animate-fade-in flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  <AlertCircle size={20} className="shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <strong className="block text-sm font-semibold mb-1 text-red-800">CẢNH BÁO: VỠ KẾ HOẠCH TIẾN ĐỘ!</strong>
                    <p className="m-0 leading-relaxed text-red-700">
                      Hạn hoàn thành công việc mới đã vượt quá hạn chót của Giai đoạn ({phase?.deadline || phase?.endDate}). Vui lòng cân nhắc điều chỉnh thời gian.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 italic mt-1">
                * Ghi chú: Khi tạo công việc khắc phục mới, công việc cũ bị sự cố sẽ tự động chuyển sang trạng thái Khóa.
              </p>
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
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Phê duyệt Sự cố" width="xl" maxWidth="850px">
      <ResolveIncidentForm {...props} />
    </Modal>
  );
};
