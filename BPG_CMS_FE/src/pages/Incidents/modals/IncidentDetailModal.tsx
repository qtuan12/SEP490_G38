import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { projectService } from '../../../services/projectService';
import type {IncidentReport, WBSPhase} from '../../../types/common';
import { ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

const commentSchema = z.object({
  commentText: z.string().min(1, 'Vui lòng nhập ý kiến')
});

type CommentFormData = z.infer<typeof commentSchema>;

interface IncidentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentReport;
  phase: WBSPhase | null;
  user: { id: string; name: string; role: string } | null;
  canApproveOrRequestRevision: boolean;
  onResolveClick: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onIncidentUpdated: (updatedIncident: IncidentReport) => void;
  projectId: string;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  isOpen,
  onClose,
  incident,
  phase,
  user,
  canApproveOrRequestRevision,
  onResolveClick,
  onSuccess,
  onError,
  onIncidentUpdated
}) => {
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema)
  });

  const commentMutation = useMutation({
    mutationFn: async (data: CommentFormData) => {
      if (!user) throw new Error('Chưa đăng nhập');
      return projectService.addIncidentComment(
        incident.id, 
        { name: user.name, role: user.role, id: user.id }, 
        data.commentText.trim()
      );
    },
    onSuccess: (newComment) => {
      onIncidentUpdated({
        ...incident,
        comments: [...(incident.comments || []), newComment]
      });
      reset();
      onSuccess('Đã gửi ý kiến thành công.');
    },
    onError: (err: any) => {
      onError(err.message || 'Lỗi khi gửi ý kiến.');
    }
  });

  const onCommentSubmit = (data: CommentFormData) => {
    commentMutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết xử lý Sự cố thi công">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
        
        {/* Phase info warning reserve check */}
        {phase && (
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', backgroundColor: 'hsl(var(--bg-main))', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
            Phase hiện tại: <strong>{phase.name}</strong> · Hạn chót giai đoạn (Phase Deadline): <strong style={{ color: 'hsl(var(--primary))' }}>{phase.deadline || 'Không có'}</strong>
          </div>
        )}

        {/* Steps Visual Tracker */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'hsl(var(--bg-main) / 0.5)', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'hsl(var(--success))', color: '#fff', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, justifyContent: 'center' }}>1</div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Sự cố</span>
          </div>
          <ArrowRight size={14} style={{ color: 'hsl(var(--text-muted))' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: incident.damageDescription ? 'hsl(var(--success))' : 'hsl(var(--border))', color: incident.damageDescription ? '#fff' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, justifyContent: 'center' }}>2</div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Thiệt hại</span>
          </div>
          <ArrowRight size={14} style={{ color: 'hsl(var(--text-muted))' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: incident.status === 'Approved' ? 'hsl(var(--success))' : 'hsl(var(--border))', color: incident.status === 'Approved' ? '#fff' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, justifyContent: 'center' }}>3</div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Phê duyệt</span>
          </div>
        </div>

        {/* Revision Requested Notice */}
        {incident.status === 'Assessing' && (
          <div style={{ padding: '12px', backgroundColor: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: '8px', color: 'hsl(var(--danger))' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '0.85rem' }}>Yêu cầu bổ sung từ TPKT:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{incident.revisionComment}</p>
            </div>
          </div>
        )}

        {/* Step 1: Incident details */}
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.1)' }}>
          <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', fontWeight: 700 }}>BƯỚC 1: BÁO CÁO SỰ CỐ GỐC</span>
          <h4 style={{ margin: '6px 0 8px 0', fontSize: '1rem', fontWeight: 700 }}>{incident.taskName}</h4>
          <p style={{ fontSize: '0.85rem', margin: '0 0 10px 0', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
            {incident.description}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {incident.images.map((img, idx) => (
              <img key={idx} src={img} alt="Sự cố" style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid hsl(var(--border))' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
            <span>Bởi: <strong>{incident.reporterName}</strong></span>
            <span>Ngày: {incident.date}</span>
          </div>
        </div>

        {/* Step 2: Damage Report */}
        {incident.damageDescription && (
          <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.1)' }}>
            <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', fontWeight: 700 }}>BƯỚC 2: BÁO CÁO THIỆT HẠI CHI TIẾT (PROJECT LEADER)</span>
            <p style={{ fontSize: '0.85rem', margin: '6px 0 10px 0', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
              {incident.damageDescription}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', fontSize: '0.8rem' }}>
              <div style={{ padding: '8px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'hsl(var(--text-muted))', display: 'block', fontSize: '0.7rem' }}>VẬT TƯ THẤT THOÁT</span>
                <strong>{incident.estimatedMaterialLoss?.toLocaleString('vi-VN')} VNĐ</strong>
              </div>
              <div style={{ padding: '8px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'hsl(var(--text-muted))', display: 'block', fontSize: '0.7rem' }}>THỜI GIAN KHẮC PHỤC DỰ KIẾN</span>
                <strong>{incident.estimatedLaborDays} ngày công</strong>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', fontSize: '0.8rem' }}>
              <div style={{ padding: '8px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'hsl(var(--text-muted))', display: 'block', fontSize: '0.7rem' }}>SỐ NGÀY TRỄ TIẾN ĐỘ</span>
                <strong>{incident.estimatedDelayDays} ngày</strong>
              </div>
              <div style={{ padding: '8px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'hsl(var(--text-muted))', display: 'block', fontSize: '0.7rem' }}>ĐỀ XUẤT XỬ LÝ</span>
                <strong>{incident.proposedAction}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: TPKT Decision details */}
        {incident.status === 'Approved' && (
          <div style={{ border: '1px solid hsl(var(--success) / 0.3)', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'hsl(var(--success-glow))', display: 'flex', gap: '12px' }}>
            <CheckCircle size={20} style={{ color: 'hsl(var(--success))', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span style={{ fontSize: '0.72rem', color: 'hsl(var(--success))', fontWeight: 700 }}>BƯỚC 3: ĐÃ DUYỆT BỞI {incident.reviewerName?.toUpperCase()}</span>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'hsl(var(--text-primary))' }}>
                Sự cố đã được duyệt thành công. Tiến độ công việc hoặc Rework đã được khởi tạo theo quyết định của TPKT.
              </p>
            </div>
          </div>
        )}

        {/* Consultation Comments Section (Step 2) */}
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.1)', marginTop: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>
            Ý KIẾN THAM KHẢO &amp; TRAO ĐỔI (CONSULTATION)
          </span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', maxHeight: '160px', overflowY: 'auto' }}>
            {!incident.comments || incident.comments.length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', padding: '4px 0' }}>Chưa có ý kiến trao đổi nào.</span>
            ) : (
              incident.comments.map((c) => (
                <div key={c.id} style={{ padding: '6px 10px', backgroundColor: 'hsl(var(--bg-main) / 0.4)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '2px', color: 'hsl(var(--text-primary))' }}>
                    <span>{c.userName} ({c.role.toUpperCase()})</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 'normal', color: 'hsl(var(--text-muted))' }}>{c.date}</span>
                  </div>
                  <p style={{ margin: 0, color: 'hsl(var(--text-secondary))' }}>{c.content}</p>
                </div>
              ))
            )}
          </div>

          {user && (
            <form 
              onSubmit={handleSubmit(onCommentSubmit)}
              style={{ display: 'flex', gap: '8px', marginTop: '12px' }}
            >
              <input 
                type="text" 
                placeholder="Nhập ý kiến tư vấn trao đổi..." 
                {...register('commentText')}
                style={{ flex: 1, fontSize: '0.8rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
              />
              <button type="submit" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} disabled={isSubmitting}>
                {isSubmitting ? 'Đang gửi...' : 'Gửi ý kiến'}
              </button>
            </form>
          )}
        </div>

        {/* Decision Buttons (TPKT/Admin only, only if Damage Report is submitted) */}
        {incident.status === 'WaitingReview' && canApproveOrRequestRevision && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={onResolveClick}
              className="btn btn-primary"
              style={{ flex: 1, fontSize: '0.85rem' }}
            >
              Phê duyệt xử lý
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
