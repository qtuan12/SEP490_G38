import React, { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import MDEditor from '@uiw/react-md-editor';
import rehypeSanitize from 'rehype-sanitize';
import { phaseAcceptanceService } from '../../../services/phaseAcceptanceService';
import type { WBSPhase, Project } from '../../../types/common';
import { Lock } from 'lucide-react';
import { formatDateOnly } from '../../../utils/dateHelpers';

const acceptanceSchema = z.object({
  reportContent: z.string().min(20, 'Vui lòng nhập nội dung báo cáo chi tiết (ít nhất 20 ký tự)')
});

type AcceptanceFormData = z.infer<typeof acceptanceSchema>;

interface AcceptanceFormProps {
  phase: WBSPhase;
  project: Project;
  allCompleted: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onPhaseUpdated: () => void;
}

export const AcceptanceForm: React.FC<AcceptanceFormProps> = ({
  phase,
  project,
  allCompleted,
  onSuccess,
  onError,
  onPhaseUpdated
}) => {
  const queryClient = useQueryClient();
  const [repAName, setRepAName] = useState('');
  const [repARole, setRepARole] = useState('');
  const [repBName, setRepBName] = useState('');
  const [repBRole, setRepBRole] = useState('');
  const [endTime, setEndTime] = useState('');
  const [conclusion1, setConclusion1] = useState('');
  const [conclusion2, setConclusion2] = useState('');

  const defaultReportContent = useMemo(() => {
    return `- **Tài liệu căn cứ nghiệm thu:**
  * Bản vẽ thiết kế thi công đã duyệt.
  * Nhật ký thi công công trình.
  * Các kết quả thí nghiệm, kiểm định chất lượng vật liệu (nếu có).

- **Đánh giá về chất lượng:** Các hạng mục thuộc giai đoạn **${phase.name}** đã được thi công đạt yêu cầu kỹ thuật theo đúng hồ sơ thiết kế và các tiêu chuẩn hiện hành.
- **Đánh giá về khối lượng:** Hoàn thành toàn bộ khối lượng công việc theo đúng thiết kế của giai đoạn.
- **Ý kiến khác:** Không.`;
  }, [phase.name]);

  const { control, handleSubmit, formState: { errors } } = useForm<AcceptanceFormData>({
    resolver: zodResolver(acceptanceSchema),
    defaultValues: {
      reportContent: defaultReportContent
    }
  });

  const acceptMutation = useMutation({
    mutationFn: async (data: AcceptanceFormData) => {
      // Xây dựng nội dung báo cáo hoàn chỉnh kết hợp các thông tin đã điền trong form
      const fullReport = `### 2. Thành phần trực tiếp nghiệm thu:
* **Đại diện Ban quản lý Dự án (hoặc nhà thầu Tư vấn giám sát):**
  - Ông/Bà: ${repAName || '........................'}  Chức vụ: ${repARole || '........................'}
* **Đại diện Nhà thầu thi công:**
  - Ông/Bà: ${repBName || '........................'}  Chức vụ: ${repBRole || '........................'}

### 3. Thời gian nghiệm thu:
* Bắt đầu: ${formatDateOnly(new Date().toISOString())}
* Kết thúc: ${endTime || '........................'}
* Tại công trình: ${project.address || ''}

### 4. Đánh giá công việc xây dựng đã thực hiện:
${data.reportContent}

### 5. Kết luận:
- ${conclusion1 || '................................................................................'}
${conclusion2 ? `- ${conclusion2}` : ''}`;

      return phaseAcceptanceService.acceptPhase({
        phaseId: Number(phase.id),
        reportContent: fullReport
      });
    },
    onSuccess: (result) => {
      // Invalidate WBS data cache so WBSWorkspace reflects the updated phase status (frozen)
      const projectKey = `p-${project.id}`;
      queryClient.invalidateQueries({ queryKey: ['wbsData', projectKey] });
      queryClient.invalidateQueries({ queryKey: ['wbsData', String(project.id)] });
      onSuccess(result.message || 'Đã nghiệm thu giai đoạn.');
      onPhaseUpdated();
    },
    onError: (err: any) => {
      onError(err.message || 'Có lỗi xảy ra khi nghiệm thu.');
    }
  });

  const onSubmitForm = (data: AcceptanceFormData) => {
    acceptMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)} className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-bold border-b border-[hsl(var(--border))] pb-2 m-0 text-[hsl(var(--text-primary))] mb-4">
          Lập biên bản nghiệm thu giai đoạn
        </h3>
      </div>

      <div
        style={{
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '40px 50px',
          lineHeight: '1.6',
          fontSize: '14pt',
          fontFamily: '"Times New Roman", Times, serif',
          maxWidth: '850px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          border: '1px solid hsl(var(--border))',
          boxShadow: 'var(--shadow-sm)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: '14pt', textTransform: 'uppercase' }}>
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </h4>
          <h5 style={{ margin: '5px 0 0 0', fontWeight: 'bold', fontSize: '14pt' }}>
            Độc lập – Tự do – Hạnh phúc
          </h5>
          <div style={{ width: '150px', height: '1.5px', backgroundColor: '#000000', margin: '10px auto' }} />
        </div>

        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <h2 style={{ margin: 0, fontWeight: 'bold', fontSize: '16pt', textTransform: 'uppercase' }}>
            BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG
          </h2>
          <p style={{ margin: '5px 0 0 0', fontStyle: 'italic' }}>
            Số: BB-NT-{phase.id.toUpperCase()}
          </p>
        </div>

        {/* General project info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <p style={{ margin: 0 }}><strong>1. Công trình:</strong> {project.name}</p>
          <p style={{ margin: 0 }}><strong>- Hạng mục:</strong> {phase.name}</p>
          <p style={{ margin: 0 }}><strong>- Địa điểm xây dựng:</strong> {project.address}</p>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <p style={{ margin: '0 0 5px 0' }}><strong>2. Thành phần trực tiếp nghiệm thu:</strong></p>
            <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <p style={{ margin: 0 }}><strong>● Đại diện Ban quản lý Dự án (hoặc nhà thầu Tư vấn giám sát):</strong></p>
              <p style={{ margin: '0 0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>- Ông/Bà:</span>
                <input
                  type="text"
                  value={repAName}
                  onChange={(e) => setRepAName(e.target.value)}
                  placeholder=""
                  style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1.5, fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
                />
                <span>Chức vụ:</span>
                <input
                  type="text"
                  value={repARole}
                  onChange={(e) => setRepARole(e.target.value)}
                  placeholder=""
                  style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1, fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
                />
              </p>
              <p style={{ margin: '10px 0 0 0' }}><strong>● Đại diện Nhà thầu thi công:</strong></p>
              <p style={{ margin: '0 0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>- Ông/Bà:</span>
                <input
                  type="text"
                  value={repBName}
                  onChange={(e) => setRepBName(e.target.value)}
                  placeholder=""
                  style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1.5, fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
                />
                <span>Chức vụ:</span>
                <input
                  type="text"
                  value={repBRole}
                  onChange={(e) => setRepBRole(e.target.value)}
                  placeholder=""
                  style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1, fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
                />
              </p>
            </div>
          </div>

          <div>
            <p style={{ margin: '0 0 5px 0' }}><strong>3. Thời gian nghiệm thu:</strong></p>
            <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <p style={{ margin: 0 }}>Bắt đầu: {formatDateOnly(new Date().toISOString())}</p>
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Kết thúc:</span>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder=""
                  style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1, maxWidth: '400px', fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
                />
              </p>
              <p style={{ margin: 0 }}>Tại công trình: {project.address}</p>
            </div>
          </div>

          <div>
            <p style={{ margin: '0 0 10px 0' }}><strong>4. Đánh giá công việc xây dựng đã thực hiện:</strong></p>
            <div className="bg-white rounded-md border border-[hsl(var(--border))]" data-color-mode="light" style={{ marginLeft: '20px', display: 'block' }}>
              <Controller
                name="reportContent"
                control={control}
                render={({ field }) => (
                  <MDEditor
                    value={field.value}
                    onChange={(val: any) => field.onChange(val || '')}
                    previewOptions={{
                      rehypePlugins: [[rehypeSanitize]],
                    }}
                    height={250}
                    className="w-full"
                  />
                )}
              />
              {errors.reportContent && (
                <span className="text-[hsl(var(--danger))] text-sm px-3 block mt-2">
                  {errors.reportContent.message}
                </span>
              )}
            </div>
          </div>

          <div>
            <p style={{ margin: '0 0 10px 0' }}><strong>5. Kết luận:</strong></p>
            <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>-</span>
                <input
                  type="text"
                  value={conclusion1}
                  onChange={(e) => setConclusion1(e.target.value)}
                  placeholder=""
                  style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1, fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>-</span>
                <input
                  type="text"
                  value={conclusion2}
                  onChange={(e) => setConclusion2(e.target.value)}
                  placeholder=""
                  style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1, fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Signatures block */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <strong style={{ display: 'block', textTransform: 'uppercase' }}>ĐẠI DIỆN BAN QUẢN LÝ DỰ ÁN</strong>
            <span style={{ fontStyle: 'italic', display: 'block', marginTop: '5px' }}>
              (Ký, ghi rõ họ tên)
            </span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <strong style={{ display: 'block', textTransform: 'uppercase' }}>ĐẠI DIỆN NHÀ THẦU THI CÔNG</strong>
            <span style={{ fontStyle: 'italic', display: 'block', marginTop: '5px' }}>
              (Ký, đóng dấu, ghi rõ họ tên)
            </span>
          </div>
          <br></br>
          <br></br>
          <br></br>
          <br></br>
          <br></br>
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-4">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!allCompleted || acceptMutation.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Lock size={16} />
          <span>{acceptMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}</span>
        </button>
      </div>
    </form>
  );
};
