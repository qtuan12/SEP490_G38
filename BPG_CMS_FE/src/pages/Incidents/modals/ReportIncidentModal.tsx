import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { incidentService } from '../../../services/incidentService';
import { projectService } from '../../../services/projectService';
import { UploadCloud, X, HardHat, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LazyImage } from '../../../utils/imageOptimizer';
import { compressAndUploadFile } from '../../../utils/uploadHelper';
import type { UploadedFileState } from '../../../utils/uploadHelper';

const getLocalISOString = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
};

// ─── Nhánh 1: Sự cố thi công ───────────────────────────────────────────────
const schema = z.object({
  incidentType: z.literal('Construction'),
  description: z.string().min(5, 'Mô tả phải có ít nhất 5 ký tự'),
  incidentDate: z.string()
    .min(1, 'Vui lòng chọn ngày phát hiện')
    .refine((val) => {
      const selected = new Date(val);
      const now = new Date();
      return selected <= now;
    }, 'Ngày/Giờ xảy ra không được vượt quá thời gian hiện tại'),
  responsibleParty: z.string().optional(),
  canceledVolume: z.string().optional(),
  estimatedDamage: z.string().optional(),
  damageNote: z.string().optional(),
  estimatedLaborDays: z.coerce.number({ message: 'Vui lòng nhập số' }).min(0, 'Số ngày không được âm'),
  estimatedDelayDays: z.coerce.number({ message: 'Vui lòng nhập số' }).min(0, 'Số ngày không được âm'),
  proposedAction: z.enum(['Tạo Rework Task', 'Giảm tiến độ task'], {
    message: 'Vui lòng chọn đề xuất xử lý'
  }),
  isEmergency: z.boolean().optional(),
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

const BRANCH_LABELS = {
  construction: {
    icon: HardHat,
    title: 'Sự cố Thi công',
    subtitle: 'Hỏng việc(do Trưởng dự án báo cáo sau khi xuống hiện trường)',
    color: 'hsl(28, 90%, 50%)',
    bg: 'hsl(28, 100%, 97%)',
    border: 'hsl(28, 80%, 75%)',
  },
  inventory: {
    icon: null as any,
    title: 'Nhánh 2 — Sự cố Vật tư Kho',
    subtitle: 'Mất mát, hư hỏng khi chưa xuất dùng',
    color: 'hsl(210, 70%, 45%)',
    bg: 'hsl(210, 100%, 97%)',
    border: 'hsl(210, 70%, 75%)',
  },
};

export const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({
  isOpen,
  onClose,
  projectId,
  taskId,
  onSuccess,
  onError,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [dragging, setDragging] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: !!projectId && isOpen,
  });
  const { register, handleSubmit, formState: { errors }, reset } = useForm<any>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      incidentType: 'Construction',
      description: '',
      incidentDate: getLocalISOString(),
      responsibleParty: '',
      canceledVolume: '',
      estimatedDamage: '',
      damageNote: '',
      estimatedLaborDays: 0,
      estimatedDelayDays: 0,
      proposedAction: 'Tạo Rework Task',
      isEmergency: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let finalDesc = data.description.trim();

      const cData = data as any;
      const d = new Date(cData.incidentDate);
      const dateStr = `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${d.toLocaleDateString('vi-VN')}`;
      finalDesc += `\n**Ngày/Giờ xảy ra:** ${dateStr}`;
      if (cData.responsibleParty) {
        finalDesc += `\n**Người chịu trách nhiệm:** ${cData.responsibleParty}`;
      }

      // Collect successfully uploaded URLs
      const successfulUrls = uploadedFiles
        .filter(f => f.status === 'success' && f.url)
        .map(f => f.url!);

      if (successfulUrls.length > 0) {
        finalDesc += '\n\n**Hình ảnh đính kèm:**\n' + successfulUrls.map((url, i) => `![Ảnh ${i + 1}](${url})`).join('\n');
      }

      let finalDamageDesc = '';
      if (cData.canceledVolume) {
        finalDamageDesc += `**Khối lượng công việc bị hủy:** ${cData.canceledVolume}\n\n`;
      }
      if (cData.estimatedDamage) {
        finalDamageDesc += `**Ước tính thiệt hại:** ${cData.estimatedDamage}\n\n`;
      }
      if (cData.damageNote) {
        finalDamageDesc += `**Ghi chú thiệt hại bổ sung:** ${cData.damageNote}\n\n`;
      }

      await incidentService.createAndAssessIncident({
        projectId: Number(projectId),
        taskId: Number(taskId),
        incidentType: data.incidentType,
        description: finalDesc,
        damageDescription: finalDamageDesc,
        estimatedMaterialLoss: 0,
        estimatedLaborDays: data.estimatedLaborDays ?? 0,
        estimatedDelayDays: data.estimatedDelayDays ?? 0,
        proposedAction: data.proposedAction,
        isEmergency: data.isEmergency ?? false,
      });
    },
    onSuccess: () => {
      onSuccess('Báo cáo sự cố thi công đã được lưu và chuyển lên Trưởng phòng kĩ thuật thẩm định.');
      reset();
      setUploadedFiles([]);
      onClose();
    },
    onError: (err: any) => {
      onError(err.message || 'Lỗi khi báo cáo sự cố.');
    },
  });

  const onSubmit = (data: FormData) => {
    if (uploadedFiles.some(f => f.status === 'uploading')) {
      toast.error('Vui lòng chờ hình ảnh tải lên hoàn tất.');
      return;
    }
    if (uploadedFiles.some(f => f.status === 'error')) {
      toast.error('Có hình ảnh tải lên bị lỗi. Vui lòng xóa ảnh lỗi và thử lại.');
      return;
    }
    mutation.mutate(data);
  };

  const onInvalid = (errors: any) => {
    console.error('[ReportIncidentModal] Validation errors:', errors);
    const firstError = Object.values(errors)[0] as any;
    const msg = firstError?.message || 'Vui lòng kiểm tra lại các trường bắt buộc.';
    toast.error(msg);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addImages(Array.from(e.dataTransfer.files));
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addImages(Array.from(e.target.files));
    e.target.value = '';
  };
  const addImages = (files: File[]) => {
    const remaining = 5 - uploadedFiles.length;
    if (remaining <= 0) { toast.error('Đã đạt giới hạn tối đa 5 ảnh.'); return; }
    const MAX = 10 * 1024 * 1024;
    if (files.some(f => f.size > MAX)) { toast.error('Hình ảnh không được vượt quá 10MB.'); return; }
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, remaining);
    if (!valid.length) return;

    valid.forEach(file => {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);

      const newFileState: UploadedFileState = {
        id: tempId,
        name: file.name,
        url: localUrl,
        status: 'uploading',
        file,
      };

      setUploadedFiles(prev => [...prev, newFileState]);

      compressAndUploadFile(
        file,
        'incidents',
        (uploadedUrl) => {
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'success', url: uploadedUrl } : f)
          );
        },
        () => {
          toast.error(`Không thể tải ảnh ${file.name} lên.`);
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'error' } : f)
          );
        }
      );
    });
  };

  const retryUpload = (id: string) => {
    const target = uploadedFiles.find(f => f.id === id);
    if (!target || !target.file) return;

    setUploadedFiles(prev =>
      prev.map(f => f.id === id ? { ...f, status: 'uploading' } : f)
    );

    compressAndUploadFile(
      target.file,
      'incidents',
      (uploadedUrl) => {
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: 'success', url: uploadedUrl } : f)
        );
      },
      () => {
        toast.error(`Không thể tải ảnh ${target.name} lên.`);
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: 'error' } : f)
        );
      }
    );
  };

  const removeImage = (id: string) => {
    setUploadedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target && target.url && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  if (!isOpen) return null;

  const branchCfg = BRANCH_LABELS.construction;
  const Icon = branchCfg.icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lập Báo cáo Sự cố Thi công" width="full" maxWidth="1080px">

      {/* ── Banner phân loại ────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: '8px',
        background: branchCfg.bg,
        border: `1px solid ${branchCfg.border}`,
        marginBottom: '16px',
      }}>
        <Icon size={18} color={branchCfg.color} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: branchCfg.color }}>{branchCfg.title}</div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>{branchCfg.subtitle}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── PHẦN 1: THÔNG TIN SỰ CỐ ──────────────────────────── */}
          <div className="flex flex-col gap-3">
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Phần 1: Thông tin Sự cố
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Nhánh 1 — Loại sự cố cố định */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Loại sự cố
                </label>
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'hsl(var(--bg-card))',
                  border: '1px solid hsl(var(--border))',
                  fontSize: '0.9rem',
                  color: BRANCH_LABELS.construction.color,
                  fontWeight: 600,
                }}>
                  🏗 Sự cố Thi công
                </div>
                <input type="hidden" {...register('incidentType')} value="Construction" />
              </div>



              {/* Mô tả sự cố */}
              <div>
                <label htmlFor="report-desc" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Mô tả nguyên nhân và diễn biến sự cố
                  {' '}<span style={{ color: 'hsl(var(--danger))' }}>*</span>
                </label>
                <textarea
                  id="report-desc"
                  className="input"
                  placeholder="Nêu rõ diễn biến sự cố, phần kết cấu bị ảnh hưởng, nguyên nhân sơ bộ..."
                  {...register('description')}
                  rows={3}
                />
                {(errors as any).description && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{String((errors as any).description?.message)}</span>}
              </div>



              {/* Ngày/Giờ & Đối tượng liên quan */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                    Ngày/Giờ xảy ra <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    max={getLocalISOString()}
                    {...register('incidentDate')}
                  />
                  {(errors as any).incidentDate && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{String((errors as any).incidentDate?.message)}</span>}
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                    Người chịu trách nhiệm
                  </label>
                  <select
                    className="input"
                    {...register('responsibleParty')}
                    style={{ padding: '8px', cursor: 'pointer' }}
                  >
                    <option value="">Chọn Người</option>
                    {members.map(m => (
                      <option key={m.userId} value={m.userName}>
                        {m.userName} {m.userRole === 'subcontractor' ? '(Thầu phụ)' : m.userRole === 'engineer' ? '(Kỹ sư)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload ảnh / biên bản */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Hình ảnh hiện trường (Tối đa 5 ảnh)
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => { if (uploadedFiles.length < 5) document.getElementById('incident-img-input')?.click(); }}
                  className={`mt-1 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${dragging
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/80'
                    } ${uploadedFiles.length >= 5 ? 'cursor-not-allowed opacity-90' : ''}`}
                  style={{ padding: uploadedFiles.length > 0 ? '16px' : '24px' }}
                >
                  <input id="incident-img-input" type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} disabled={uploadedFiles.length >= 5} />

                  {uploadedFiles.length > 0 ? (
                    <div>
                      <div
                        className="flex flex-wrap items-center justify-center gap-3 my-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.id}
                            className={`relative w-16 h-16 rounded shadow-sm border overflow-hidden group ${file.status === 'error' ? 'border-red-500' : file.status === 'success' ? 'border-green-500' : 'border-slate-200'
                              }`}
                          >
                            <LazyImage src={file.url} alt={file.name} widthOption={200} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                            {file.status === 'uploading' && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Loader2 size={14} className="animate-spin text-white" />
                              </div>
                            )}

                            {file.status === 'error' && (
                              <>
                                <span className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[8px] text-center py-0.5 font-bold">Lỗi</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    retryUpload(file.id);
                                  }}
                                  className="absolute top-1 left-1 bg-blue-600 text-white rounded-full p-0.5 opacity-90 hover:opacity-100 transition-opacity z-10"
                                  title="Thử lại upload"
                                >
                                  <RotateCcw size={10} />
                                </button>
                              </>
                            )}

                            {file.status === 'success' && (
                              <span className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-[8px] text-center py-0.5 font-bold">Mới</span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(file.id);
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-90 hover:opacity-100 transition-opacity z-10"
                              title="Xóa ảnh"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {uploadedFiles.length < 5 ? (
                        <div className="mt-3 text-xs text-blue-600 font-semibold">
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => document.getElementById('incident-img-input')?.click()}
                          >
                            + Thêm ảnh khác (Đã chọn {uploadedFiles.length}/5 ảnh)
                          </span>
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-slate-500 font-medium">
                          Đã đạt tối đa 5/5 ảnh
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <UploadCloud size={32} className="text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-600 mb-0.5">
                        Kéo thả hình ảnh vào đây hoặc click để chọn ảnh
                      </p>
                      <span className="text-xs text-slate-400">
                        Hỗ trợ tối đa 5 ảnh, dung lượng tối đa 10MB/ảnh
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── PHẦN 2: ĐÁNH GIÁ THIỆT HẠI ────────────────────── */}
          <div className="flex flex-col gap-3">
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Phần 2: Đánh giá Thiệt hại & Đề xuất
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Đánh giá thiệt hại & Đề xuất (Nhánh 1) */}
              <>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                    Khối lượng công việc bị hủy (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Vd: Hủy 20% khối lượng trát tường"
                    {...register('canceledVolume')}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                    Ước tính thiệt hại (Tùy chọn)
                  </label>
                  <textarea
                    className="input"
                    placeholder="Vd: 5.000.000 VNĐ tiền vật tư"
                    {...register('estimatedDamage')}
                    rows={3}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                    Số ngày nhân công khắc phục <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                  </label>
                  <input type="number" className="input" placeholder="0" min={0} {...register('estimatedLaborDays', { valueAsNumber: true })} />
                  {(errors as any).estimatedLaborDays && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{String((errors as any).estimatedLaborDays?.message)}</span>}
                </div>

              </>



              {/* Tiến độ + Đề xuất — chỉ Nhánh 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                    Số ngày dự kiến trễ tiến độ <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                  </label>
                  <input type="number" className="input" placeholder="0" min={0} {...register('estimatedDelayDays', { valueAsNumber: true })} />
                  {(errors as any).estimatedDelayDays && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{String((errors as any).estimatedDelayDays?.message)}</span>}
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                    Đề xuất xử lý <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                  </label>
                  <select className="input" {...register('proposedAction')}>
                    <option value="Tạo Rework Task">Tạo công việc mới</option>
                    <option value="Giảm tiến độ task">Giảm % tiến độ công việc</option>
                  </select>
                  {(errors as any).proposedAction && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{String((errors as any).proposedAction?.message)}</span>}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Hành động ─────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-[hsl(var(--border))]">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={mutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {mutation.isPending && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {mutation.isPending
              ? 'Đang lưu...'
              : 'Gửi báo cáo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
