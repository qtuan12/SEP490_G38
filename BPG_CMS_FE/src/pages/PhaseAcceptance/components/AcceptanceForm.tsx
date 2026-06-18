import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { phaseAcceptanceService } from '../../../services/phaseAcceptanceService';
import type {WBSPhase} from '../../../types/common';
import { Lock } from 'lucide-react';

const acceptanceSchema = z.object({
  representativeA: z.string().min(1, 'Vui lòng nhập tên người đại diện bên A'),
  roleA: z.string().min(1, 'Vui lòng nhập chức vụ bên A'),
  representativeB: z.string().min(1, 'Vui lòng nhập tên người đại diện bên B'),
  roleB: z.string().min(1, 'Vui lòng nhập chức vụ bên B'),
  startTime: z.string().min(1, 'Vui lòng chọn thời gian bắt đầu'),
  endTime: z.string().min(1, 'Vui lòng chọn thời gian kết thúc'),
  drawings: z.string().min(1, 'Vui lòng nhập số hiệu bản vẽ'),
  standards: z.string().min(1, 'Vui lòng nhập tiêu chuẩn áp dụng'),
  results: z.string().min(1, 'Vui lòng nhập kết quả kiểm tra'),
  quality: z.string().min(1, 'Vui lòng đánh giá chất lượng'),
  opinions: z.string().optional(),
  conclusion: z.string().min(1, 'Vui lòng chọn kết luận')
});

type AcceptanceFormData = z.infer<typeof acceptanceSchema>;

interface AcceptanceFormProps {
  phase: WBSPhase;
  user: { name: string; role: string; id: string } | null;
  allCompleted: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onPhaseUpdated: () => void;
}

export const AcceptanceForm: React.FC<AcceptanceFormProps> = ({
  phase,
  user,
  allCompleted,
  onSuccess,
  onError,
  onPhaseUpdated
}) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AcceptanceFormData>({
    resolver: zodResolver(acceptanceSchema),
    defaultValues: {
      representativeA: user?.name || 'Nguyễn Văn Kỹ',
      roleA: 'Trưởng phòng Kỹ thuật',
      representativeB: 'Trần Văn Công',
      roleB: 'Kỹ thuật thi công trực tiếp',
      standards: 'TCVN 4453:1995 - Kết cấu bê tông cốt thép toàn khối - Quy chuẩn thi công và nghiệm thu',
      results: 'Các kết quả kiểm tra kích thước hình học, cốt thép dầm sàn đạt yêu cầu; chứng nhận xuất xưởng vật liệu đầy đủ.',
      quality: 'Đạt yêu cầu kỹ thuật theo thiết kế bản vẽ và tiêu chuẩn áp dụng. Đủ điều kiện nghiệm thu.',
      opinions: 'Nhà thầu cần tiếp tục dọn dẹp vệ sinh sạch sẽ mặt bằng sau khi hoàn thành.',
      conclusion: 'Chấp nhận nghiệm thu và đồng ý cho triển khai các công việc tiếp theo.'
    }
  });

  useEffect(() => {
    const now = new Date();
    const formatDateTime = (date: Date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    };
    
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    reset((prev) => ({
      ...prev,
      startTime: formatDateTime(twoHoursAgo),
      endTime: formatDateTime(now),
      drawings: `Bản vẽ thiết kế thi công ${phase.name} số BV-01/${phase.id.slice(0, 4).toUpperCase()}`
    }));
  }, [phase.id, phase.name, reset]);

  const acceptMutation = useMutation({
    mutationFn: async (data: AcceptanceFormData) => {
      const mainComment = `${data.conclusion}\nNhận xét chất lượng: ${data.quality}\nKết quả: ${data.results}`;
      // Lưu file JSON báo cáo hoặc string chi tiết vào reportContent
      const reportContent = JSON.stringify({
        ...data,
        mainComment
      });

      await phaseAcceptanceService.acceptPhase({
        phaseId: Number(phase.id),
        reportContent: reportContent
      });
      return data;
    },
    onSuccess: (data) => {
      const isPassed = !data.conclusion.includes('Không chấp nhận');
      if (isPassed) {
        onSuccess('Đã nghiệm thu giai đoạn và đóng băng Phase thành công!');
      } else {
        onSuccess('Đã ghi nhận biên bản đánh giá KHÔNG ĐẠT. Vui lòng yêu cầu nhà thầu khắc phục.');
        // If not passed, we can reset conclusion so they can try again later
        reset((prev) => ({
          ...prev,
          conclusion: 'Chấp nhận nghiệm thu và đồng ý cho triển khai các công việc tiếp theo.'
        }));
      }
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
    <>
      <form onSubmit={handleSubmit(onSubmitForm)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px', margin: 0 }}>
          Nghiệm thu & Đóng băng Giai đoạn (Theo mẫu quy chuẩn)
        </h3>

        {/* 1. Members */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--primary))', margin: 0 }}>1. Thành phần trực tiếp nghiệm thu</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor="representativeA" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Cán bộ giám sát (Bên A) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <input
                id="representativeA"
                type="text"
                {...register('representativeA')}
              />
              {errors.representativeA && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.representativeA.message}</span>}
            </div>
            <div>
              <label htmlFor="roleA" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Chức vụ <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <input
                id="roleA"
                type="text"
                {...register('roleA')}
              />
              {errors.roleA && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.roleA.message}</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor="representativeB" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Kỹ thuật thi công (Bên B) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <input
                id="representativeB"
                type="text"
                {...register('representativeB')}
              />
              {errors.representativeB && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.representativeB.message}</span>}
            </div>
            <div>
              <label htmlFor="roleB" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Chức vụ <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <input
                id="roleB"
                type="text"
                {...register('roleB')}
              />
              {errors.roleB && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.roleB.message}</span>}
            </div>
          </div>
        </div>

        {/* 2. Time */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--primary))', margin: 0 }}>2. Thời gian nghiệm thu</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor="startTime" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Thời gian bắt đầu <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <input
                id="startTime"
                type="datetime-local"
                {...register('startTime')}
                style={{ padding: '8px 12px', width: '100%', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
              />
              {errors.startTime && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.startTime.message}</span>}
            </div>
            <div>
              <label htmlFor="endTime" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Thời gian kết thúc <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <input
                id="endTime"
                type="datetime-local"
                {...register('endTime')}
                style={{ padding: '8px 12px', width: '100%', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
              />
              {errors.endTime && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.endTime.message}</span>}
            </div>
          </div>
        </div>

        {/* 3. Evidences & standards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--primary))', margin: 0 }}>3. Tài liệu căn cứ nghiệm thu & Kết quả thí nghiệm</h4>
          
          <div>
            <label htmlFor="drawings" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Bản vẽ thiết kế thi công áp dụng (Số hiệu bản vẽ) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input
              id="drawings"
              type="text"
              {...register('drawings')}
              placeholder="Ví dụ: Bản vẽ số BV-01/MONG"
            />
            {errors.drawings && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.drawings.message}</span>}
          </div>

          <div>
            <label htmlFor="standards" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tiêu chuẩn, quy phạm xây dựng áp dụng <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input
              id="standards"
              type="text"
              {...register('standards')}
            />
            {errors.standards && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.standards.message}</span>}
          </div>

          <div>
            <label htmlFor="results" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Các kết quả kiểm tra, thí nghiệm chất lượng vật liệu <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <textarea
              id="results"
              {...register('results')}
              rows={2}
            />
            {errors.results && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.results.message}</span>}
          </div>
        </div>

        {/* 4. Evaluation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--primary))', margin: 0 }}>4. Đánh giá chất lượng & Kết luận</h4>
          
          <div>
            <label htmlFor="quality" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Đánh giá chất lượng công việc đã thực hiện <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <textarea
              id="quality"
              {...register('quality')}
              rows={2}
            />
            {errors.quality && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.quality.message}</span>}
          </div>

          <div>
            <label htmlFor="opinions" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Ý kiến khác (nếu có)</label>
            <input
              id="opinions"
              type="text"
              {...register('opinions')}
              placeholder="Không có ý kiến khác"
            />
          </div>

          <div>
            <label htmlFor="conclusion" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Kết luận <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <select
              id="conclusion"
              {...register('conclusion')}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
            >
              <option value="Chấp nhận nghiệm thu và đồng ý cho triển khai các công việc tiếp theo.">Chấp nhận nghiệm thu và đồng ý cho triển khai các công việc tiếp theo</option>
              <option value="Không chấp nhận nghiệm thu. Yêu cầu sửa chữa các sai sót trước khi nghiệm thu lại.">Không chấp nhận nghiệm thu, yêu cầu khắc phục sửa chữa</option>
            </select>
            {errors.conclusion && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{errors.conclusion.message}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!allCompleted || isSubmitting}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Lock size={16} />
            <span>{isSubmitting ? 'Đang xử lý...' : 'Xác nhận & Đóng băng Phase'}</span>
          </button>
        </div>
      </form>
    </>
  );
};
