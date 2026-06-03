import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type { WBSPhase, WBSTask, Project } from '../services/projectService';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Download,
  Lock
} from 'lucide-react';

export const PhaseAcceptance: React.FC = () => {
  const { projectId, phaseId } = useParams<{ projectId: string; phaseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [phase, setPhase] = useState<WBSPhase | null>(null);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  const isTPKT = user?.role === 'tpkt' || user?.role === 'admin';

  const loadData = async () => {
    if (!projectId || !phaseId) return;
    setLoading(true);
    setError(null);
    try {
      const proj = await projectService.getProjectById(projectId);
      setProject(proj);

      const allPhases = await projectService.getPhases(projectId);
      const targetPhase = allPhases.find(p => p.id === phaseId) || null;
      setPhase(targetPhase);

      const allTasks = await projectService.getTasks(projectId);
      const phaseTasks = allTasks.filter(t => t.phaseId === phaseId);
      setTasks(phaseTasks);

      if (targetPhase?.status === 'frozen') {
        setIsSubmitted(true);
        setComment(targetPhase.acceptanceComment || '');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải thông tin nghiệm thu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, phaseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseId) return;

    if (comment.trim().length < 50) {
      setError('Văn bản nhận xét nghiệm thu phải từ 50 ký tự trở lên.');
      return;
    }

    try {
      await projectService.acceptPhase(phaseId, comment);
      setIsSubmitted(true);
      setSuccess('Đã nghiệm thu giai đoạn và đóng băng Phase thành công!');
      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi nghiệm thu.');
    }
  };

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseId) return;

    if (revokeReason.trim().length < 20) {
      setError('Lý do hủy nghiệm thu phải từ 20 ký tự trở lên.');
      return;
    }

    if (phase?.acceptanceDate && phase.acceptanceDate.includes('/')) {
      const parts = phase.acceptanceDate.split('/');
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const acceptDateObj = new Date(`${yyyy}-${mm}-${dd}`);
        const now = new Date();
        const diffTime = now.getTime() - acceptDateObj.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24); 
        
        if (diffDays > 7) {
          setError('Không thể hủy nghiệm thu. Đã quá 7 ngày kể từ ngày đóng băng.');
          return;
        }
      }
    }

    try {
      await projectService.revokePhase(phaseId, revokeReason);
      setIsSubmitted(false);
      setIsRevoking(false);
      setRevokeReason('');
      setSuccess('Đã hủy nghiệm thu giai đoạn thành công!');
      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi hủy nghiệm thu.');
    }
  };

  const handleDownloadPDF = () => {
    if (!project || !phase) return;

    // Create a beautifully formatted formal text content representing PDF
    const docTitle = `BIEN_BAN_NGHIEM_THU_${phase.name.toUpperCase().replace(/\s+/g, '_')}.txt`;
    const docContent = `
========================================================================
           CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                 Độc lập - Tự do - Hạnh phúc
           --------------------------------------

                  BIÊN BẢN NGHIỆM THU GIAI ĐOẠN
                 (Hệ thống BPG Construction CMS)

Hôm nay, ngày ${new Date().toLocaleDateString('vi-VN')}, chúng tôi tiến hành nghiệm thu:
- Dự án: ${project.name}
- Địa chỉ: ${project.address}
- Giai đoạn nghiệm thu: ${phase.name}

THÀNH PHẦN NGHIỆM THU:
1. Trưởng phòng Kỹ thuật (Đại diện giám sát): ${user?.name || 'Nguyễn Văn Kỹ'}
2. Đơn vị thi công: Đội ngũ kỹ sư hiện trường BPG Construction

DANH SÁCH HẠNG MỤC CÔNG VIỆC HOÀN THÀNH:
${tasks.map((t, idx) => `${idx + 1}. Hạng mục: ${t.name} - Tiến độ: ${t.progress}% - Người phụ trách: ${t.assignedName || 'Chưa gán'}`).join('\n')}

ĐÁNH GIÁ CHẤT LƯỢNG KỸ THUẬT:
"${comment}"

KẾT LUẬN:
- Hồ sơ nghiệm thu hoàn toàn hợp lệ, các công việc đạt 100% tiến độ và đạt tiêu chuẩn thi công.
- Xác nhận CHÍNH THỨC ĐÓNG BĂNG giai đoạn này. Các kỹ sư không thể thay đổi tiến độ.

            ĐẠI DIỆN TRƯỞNG PHÒNG KỸ THUẬT
                     (Đã ký số)
========================================================================
`;

    // Download file
    const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = docTitle;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <span>Đang tải thông tin nghiệm thu giai đoạn...</span>
      </div>
    );
  }

  if (!project || !phase) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <h3>Không tìm thấy giai đoạn hoặc dự án</h3>
        <button onClick={() => navigate('/projects')} className="btn btn-secondary" style={{ marginTop: '16px' }}>
          Quay lại danh sách dự án
        </button>
      </div>
    );
  }

  const allCompleted = tasks.length > 0 && tasks.every(t => t.progress === 100);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '780px', margin: '0 auto' }}>
      
      {/* Navigation and Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button 
          onClick={() => navigate(`/projects/${projectId}`)} 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            background: 'none', 
            border: 'none', 
            color: 'hsl(var(--text-secondary))', 
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            width: 'fit-content'
          }}
        >
          <ArrowLeft size={16} />
          <span>Quay lại Không gian dự án</span>
        </button>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Nghiệm thu Giai đoạn</h1>
        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))' }}>
          Dự án: <strong>{project.name}</strong> &rarr; Giai đoạn: <strong>{phase.name}</strong>
        </p>
      </div>

      {/* Messages */}
      {success && (
        <div className="animate-fade-in" style={{
          padding: '12px 18px',
          backgroundColor: 'hsl(var(--success-glow))',
          border: '1px solid hsl(var(--success) / 0.2)',
          borderRadius: 'var(--radius-sm)',
          color: 'hsl(142 70% 30%)',
          fontSize: '0.9rem',
          fontWeight: 500
        }}>
          {success}
        </div>
      )}

      {error && (
        <div className="animate-fade-in" style={{
          padding: '12px 18px',
          backgroundColor: 'hsl(var(--danger-glow))',
          border: '1px solid hsl(var(--danger) / 0.2)',
          borderRadius: 'var(--radius-sm)',
          color: 'hsl(346 84% 35%)',
          fontSize: '0.9rem',
          fontWeight: 500
        }}>
          {error}
        </div>
      )}

      {/* Checklist Tasks Block */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
          Kiểm soát Tiến độ các Hạng mục trong Giai đoạn
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tasks.map((t) => (
            <div 
              key={t.id} 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 16px',
                backgroundColor: 'hsl(var(--bg-main) / 0.4)',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={18} style={{ color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))' }} />
                <span style={{ fontWeight: 500 }}>{t.name}</span>
              </div>
              <span className={`badge ${t.progress === 100 ? 'badge-success' : 'badge-danger'}`}>
                {t.progress}% Hoàn thành
              </span>
            </div>
          ))}

          {tasks.length === 0 && (
            <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '20px 0' }}>
              Không tìm thấy công việc nào để soát trong giai đoạn này.
            </p>
          )}
        </div>

        {/* Readiness Warnings */}
        {!allCompleted && (
          <div style={{
            marginTop: '16px',
            display: 'flex',
            gap: '10px',
            backgroundColor: 'hsl(var(--danger-glow))',
            border: '1px solid hsl(var(--danger) / 0.2)',
            padding: '14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            color: 'hsl(346 84% 35%)',
            alignItems: 'center'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Chưa đủ điều kiện nghiệm thu:</strong> Tất cả công việc con phải đạt 100% tiến độ trước khi tiến hành nghiệm thu và đóng băng giai đoạn.
            </span>
          </div>
        )}
      </div>

      {/* Evaluation Form */}
      {isTPKT ? (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
            Nghiệm thu & Đóng băng Giai đoạn
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label htmlFor="acceptance-comment">Nhận xét chất lượng & Đánh giá thi công (Tối thiểu 50 ký tự) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <textarea
                id="acceptance-comment"
                placeholder="Ví dụ: Giai đoạn 1 đã được giám sát nghiêm ngặt, bê tông cốt thép đạt tiêu chuẩn độ bền móng M250, cốt thép bố trí đúng thiết kế bản vẽ và kết quả thử mẫu đạt chỉ tiêu..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
                disabled={isSubmitted || !allCompleted}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                <span>Độ dài ký tự: <strong>{comment.trim().length}</strong> / tối thiểu 50 ký tự</span>
                {comment.trim().length < 50 && (
                  <span style={{ color: 'hsl(var(--danger))' }}>Chưa đạt độ dài tối thiểu</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              {isSubmitted && (
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-hover))' }}
                >
                  <Download size={16} />
                  <span>Tải File Báo Cáo Nghiệm Thu</span>
                </button>
              )}

              {!isSubmitted ? (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!allCompleted || comment.trim().length < 50}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Lock size={16} />
                  <span>Xác nhận & Đóng băng Phase</span>
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', width: '100%' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'hsl(var(--success))',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}>
                    <CheckCircle2 size={18} />
                    <span>Đã Đóng Băng Nghiệm Thu ({phase.acceptanceDate})</span>
                  </div>

                  {!isRevoking ? (
                    <button 
                      type="button" 
                      onClick={() => setIsRevoking(true)}
                      className="btn"
                      style={{ 
                        fontSize: '0.85rem', 
                        backgroundColor: 'hsl(var(--bg-main))', 
                        color: 'hsl(var(--danger))', 
                        border: '1px solid hsl(var(--danger) / 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <AlertTriangle size={15} />
                      Yêu cầu Hủy Nghiệm Thu
                    </button>
                  ) : (
                    <div style={{ 
                      width: '100%', 
                      marginTop: '12px', 
                      padding: '16px', 
                      backgroundColor: 'hsl(var(--danger-glow))', 
                      border: '1px solid hsl(var(--danger) / 0.3)',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      <label htmlFor="revoke-reason" style={{ color: 'hsl(var(--danger))', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                        Lý do hủy nghiệm thu (Tối thiểu 20 ký tự) <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                      </label>
                      <textarea
                        id="revoke-reason"
                        placeholder="Nêu rõ nguyên nhân hủy bỏ (VD: Phát hiện sai sót trong biên bản, thi công chưa đạt chuẩn sau kiểm tra...)"
                        value={revokeReason}
                        onChange={(e) => setRevokeReason(e.target.value)}
                        rows={3}
                        style={{ width: '100%', marginBottom: '12px', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--danger) / 0.3)' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'hsl(var(--danger))', marginBottom: '12px' }}>
                        <span>Lưu ý: Chỉ có thể hủy nghiệm thu trong vòng 7 ngày kể từ lúc đóng băng.</span>
                        <span>{revokeReason.trim().length} / 20</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setIsRevoking(false)}>Hủy</button>
                        <button type="button" className="btn" style={{ backgroundColor: 'hsl(var(--danger))', color: 'white' }} onClick={handleRevoke} disabled={revokeReason.trim().length < 20}>
                          Xác nhận Hủy Nghiệm Thu
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          Bạn cần đăng nhập với vai trò <strong>Trưởng phòng Kỹ Thuật (TPKT)</strong> để tiến hành nghiệm thu giai đoạn này.
        </div>
      )}

    </div>
  );
};
