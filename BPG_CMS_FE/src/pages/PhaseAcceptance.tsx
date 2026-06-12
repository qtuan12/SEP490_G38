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
  Lock,
  Clock
} from 'lucide-react';
import { Modal } from '../components/Modal';
import type { AcceptanceRecord } from '../services/projectService';

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
  const [_comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<AcceptanceRecord | null>(null);

  // Structured acceptance states
  const [representativeA, setRepresentativeA] = useState('');
  const [roleA, setRoleA] = useState('Trưởng phòng Kỹ thuật');
  const [representativeB, setRepresentativeB] = useState('Trần Văn Công');
  const [roleB, setRoleB] = useState('Kỹ thuật thi công trực tiếp');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [drawings, setDrawings] = useState('');
  const [standards, setStandards] = useState('TCVN 4453:1995 - Kết cấu bê tông cốt thép toàn khối - Quy chuẩn thi công và nghiệm thu');
  const [results, setResults] = useState('Các kết quả kiểm tra kích thước hình học, cốt thép dầm sàn đạt yêu cầu; chứng nhận xuất xưởng vật liệu đầy đủ.');
  const [quality, setQuality] = useState('Đạt yêu cầu kỹ thuật theo thiết kế bản vẽ và tiêu chuẩn áp dụng. Đủ điều kiện nghiệm thu.');
  const [opinions, setOpinions] = useState('Nhà thầu cần tiếp tục dọn dẹp vệ sinh sạch sẽ mặt bằng sau khi hoàn thành.');
  const [conclusion, setConclusion] = useState('Chấp nhận nghiệm thu và đồng ý cho triển khai các công việc tiếp theo.');

  const isTPKT = user?.role === 'technicalmanager' || user?.role === 'admin';

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
        setRepresentativeA(targetPhase.acceptanceRepresentativeA || '');
        setRoleA(targetPhase.acceptanceRoleA || 'Trưởng phòng Kỹ thuật');
        setRepresentativeB(targetPhase.acceptanceRepresentativeB || 'Trần Văn Công');
        setRoleB(targetPhase.acceptanceRoleB || 'Kỹ thuật thi công trực tiếp');
        setStartTime(targetPhase.acceptanceStartTime || '');
        setEndTime(targetPhase.acceptanceEndTime || '');
        setDrawings(targetPhase.acceptanceDrawings || '');
        setStandards(targetPhase.acceptanceStandards || '');
        setResults(targetPhase.acceptanceResults || '');
        setQuality(targetPhase.acceptanceQuality || '');
        setOpinions(targetPhase.acceptanceOpinions || '');
        setConclusion(targetPhase.acceptanceConclusion || 'Chấp nhận nghiệm thu và đồng ý cho triển khai các công việc tiếp theo.');
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

  useEffect(() => {
    if (project && phase && phase.status !== 'frozen') {
      setRepresentativeA(user?.name || 'Nguyễn Văn Kỹ');
      setRoleA('Trưởng phòng Kỹ thuật');
      setRepresentativeB('Trần Văn Công');
      setRoleB('Kỹ thuật thi công trực tiếp');
      
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
      setStartTime(formatDateTime(twoHoursAgo));
      setEndTime(formatDateTime(now));
      
      setDrawings(`Bản vẽ thiết kế thi công ${phase.name} số BV-01/${phase.id.slice(0, 4).toUpperCase()}`);
    }
  }, [project, phase, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseId) return;

    if (!representativeA || !representativeB || !startTime || !endTime || !drawings || !standards || !results || !quality || !conclusion) {
      setError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    try {
      const mainComment = `${conclusion} Nhận xét chất lượng: ${quality}`;
      await projectService.acceptPhase(phaseId, mainComment, {
        representativeA,
        roleA,
        representativeB,
        roleB,
        startTime,
        endTime,
        drawings,
        standards,
        results,
        quality,
        opinions,
        conclusion
      });
      const isPassed = !conclusion.includes('Không chấp nhận');
      
      if (isPassed) {
        setIsSubmitted(true);
        setSuccess('Đã nghiệm thu giai đoạn và đóng băng Phase thành công!');
      } else {
        setSuccess('Đã ghi nhận biên bản đánh giá KHÔNG ĐẠT. Vui lòng yêu cầu nhà thầu khắc phục.');
        // Reset some form fields to allow another submission later
        setConclusion('Chấp nhận nghiệm thu và đồng ý cho triển khai các công việc tiếp theo.');
      }
      
      setTimeout(() => setSuccess(null), 4000);
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

    if (phase?.acceptanceDate) {
      let acceptDateObj: Date | null = null;
      if (phase.acceptanceDate.includes('/')) {
        const parts = phase.acceptanceDate.split('/');
        if (parts.length === 3) {
          const [dd, mm, yyyy] = parts;
          const pad = (s: string) => s.padStart(2, '0');
          acceptDateObj = new Date(`${yyyy}-${pad(mm)}-${pad(dd)}`);
        }
      } else if (phase.acceptanceDate.includes('-')) {
        acceptDateObj = new Date(phase.acceptanceDate);
      }

      if (acceptDateObj && !isNaN(acceptDateObj.getTime())) {
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

    const formatTimeVi = (dateTimeStr: string) => {
      if (!dateTimeStr) return '.............................';
      try {
        const d = new Date(dateTimeStr);
        if (isNaN(d.getTime())) return dateTimeStr;
        return `${d.getHours()} giờ ${d.getMinutes()} phút ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
      } catch {
        return dateTimeStr;
      }
    };

    const docTitle = `BIEN_BAN_NGHIEM_THU_${phase.name.toUpperCase().replace(/\s+/g, '_')}.txt`;
    const docContent = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập – Tự do – Hạnh phúc
-----------------------
BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG
SỐ: BB-NT-${phase.id.toUpperCase()}

Công trình: ${project.name}
Địa điểm: ${project.address}
Hạng mục: ${phase.name}

1. Đối tượng nghiệm thu: ${phase.name} (Tất cả công việc hoàn thành 100%)

2. Thành phần trực tiếp nghiệm thu:
● Đại diện Ban quản lý Dự án (hoặc nhà thầu Tư vấn giám sát)
- Ông: ${representativeA || '.............................................'} Chức vụ: ${roleA || '........................................................'}
● Đại diện Nhà thầu thi công:
- Ông: ${representativeB || '..........................................'} Chức vụ: ${roleB || '............................................................'}

3. Thời gian nghiệm thu:
Bắt đầu: ${formatTimeVi(startTime)}
Kết thúc: ${formatTimeVi(endTime)}
Tại công trình: ${project.address}

4. Đánh giá công việc xây dựng đã thực hiện:
a. Về tài liệu làm căn cứ nghiệm thu:
- Phiếu yêu cầu nghiệm thu của nhà thầu thi công xây dựng
- Hồ sơ thiết kế bản vẽ thi công và những thay đổi thiết kế được phê duyệt: Bản vẽ số: ${drawings}
- Tiêu chuẩn, qui phạm xây dựng được áp dụng: ${standards}
- Các kết quả kiểm tra, thí nghiệm chất lượng vật liệu, thiết bị được đưa vào sử dụng: ${results}
- Nhật ký thi công, giám sát và các văn bản khác có liên quan.

b. Về chất lượng công việc xây dựng:
${quality}

c. Các ý kiến khác nếu có:
${opinions || 'Không có ý kiến khác.'}

5. Kết luận:
${conclusion}

CÁN BỘ GIÁM SÁT THI CÔNG                 KỸ THUẬT THI CÔNG TRỰC TIẾP
(Ký, ghi rõ họ tên)                      (Ký, ghi rõ họ tên)
(Đã ký số điện tử)                       (Đã ký số điện tử)

Ông: ${representativeA}                   Ông: ${representativeB}
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

      {/* Acceptance History */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
          Lịch sử Nghiệm thu Giai đoạn
        </h3>
        {phase.acceptanceHistory && phase.acceptanceHistory.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {phase.acceptanceHistory.map((record) => (
              <div 
                key={record.id}
                onClick={() => setSelectedHistory(record)}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '12px 16px',
                  backgroundColor: 'hsl(var(--bg-main) / 0.4)',
                  border: `1px solid ${record.isPassed ? 'hsl(var(--success) / 0.5)' : 'hsl(var(--danger) / 0.5)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--bg-muted))'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--bg-main) / 0.4)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={18} style={{ color: 'hsl(var(--text-muted))' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Nghiệm thu lúc {record.date}</span>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Người đại diện: {record.representativeB} (Bên B)</span>
                  </div>
                </div>
                <span className={`badge ${record.isPassed ? 'badge-success' : 'badge-danger'}`}>
                  {record.isPassed ? 'ĐẠT (ĐÓNG BĂNG)' : 'KHÔNG ĐẠT'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '20px 0' }}>
            Chưa có biên bản nghiệm thu nào được ghi nhận.
          </p>
        )}
      </div>

      {/* Evaluation Form */}
      {isTPKT ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {isSubmitted ? (
            /* Premium Paper-like Document Preview */
            <div style={{
              backgroundColor: '#ffffff',
              color: '#1a202c',
              padding: '32px',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid hsl(var(--border))',
              lineHeight: '1.6',
              fontSize: '0.95rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxWidth: '100%',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', textTransform: 'uppercase', color: '#1a202c' }}>
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </h4>
                <h5 style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '0.9rem', color: '#2d3748' }}>
                  Độc lập – Tự do – Hạnh phúc
                </h5>
                <div style={{ width: '120px', height: '1.5px', backgroundColor: '#2d3748', margin: '8px auto' }} />
              </div>

              <div style={{ textAlign: 'center', margin: '10px 0' }}>
                <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem', color: '#111827' }}>
                  BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', fontStyle: 'italic', color: '#4b5563' }}>
                  Số: BB-NT-{phase.id.toUpperCase()}
                </p>
              </div>

              {/* General project info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px dashed #e5e7eb', paddingBottom: '12px' }}>
                <p style={{ margin: 0 }}><strong>Công trình:</strong> {project.name}</p>
                <p style={{ margin: 0 }}><strong>Địa điểm:</strong> {project.address}</p>
                <p style={{ margin: 0 }}><strong>Hạng mục:</strong> {phase.name}</p>
              </div>

              {/* Sections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem', color: '#111827', marginBottom: '2px' }}>1. Đối tượng nghiệm thu:</strong>
                  <span style={{ paddingLeft: '16px', display: 'block' }}>{phase.name} (Tất cả công việc con đã hoàn thành 100%)</span>
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem', color: '#111827', marginBottom: '2px' }}>2. Thành phần trực tiếp nghiệm thu:</strong>
                  <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{ margin: 0 }}><strong>Đại diện Ban quản lý Dự án (Tư vấn giám sát):</strong></p>
                    <p style={{ margin: '0 0 0 16px', color: '#374151' }}>Ông/Bà: {representativeA} &nbsp;&mdash;&nbsp; Chức vụ: {roleA}</p>
                    <p style={{ margin: 0 }}><strong>Đại diện Nhà thầu thi công:</strong></p>
                    <p style={{ margin: '0 0 0 16px', color: '#374151' }}>Ông/Bà: {representativeB} &nbsp;&mdash;&nbsp; Chức vụ: {roleB}</p>
                  </div>
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem', color: '#111827', marginBottom: '2px' }}>3. Thời gian nghiệm thu:</strong>
                  <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <p style={{ margin: 0 }}><strong>Bắt đầu:</strong> {startTime ? new Date(startTime).toLocaleString('vi-VN') : '...'}</p>
                    <p style={{ margin: 0 }}><strong>Kết thúc:</strong> {endTime ? new Date(endTime).toLocaleString('vi-VN') : '...'}</p>
                    <p style={{ margin: 0 }}><strong>Tại công trình:</strong> {project.address}</p>
                  </div>
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem', color: '#111827', marginBottom: '2px' }}>4. Đánh giá công việc xây dựng đã thực hiện:</strong>
                  <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ margin: 0 }}><strong>a) Căn cứ nghiệm thu:</strong></p>
                    <ul style={{ margin: '2px 0 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px', color: '#374151' }}>
                      <li>Phiếu yêu cầu nghiệm thu của nhà thầu thi công xây dựng.</li>
                      <li>Hồ sơ thiết kế bản vẽ thi công và những thay đổi thiết kế được duyệt: <strong>Bản vẽ số {drawings}</strong>.</li>
                      <li>Tiêu chuẩn, qui phạm xây dựng áp dụng: <strong>{standards}</strong>.</li>
                      <li>Kết quả kiểm tra thí nghiệm chất lượng vật liệu, thiết bị: <strong>{results}</strong>.</li>
                      <li>Nhật ký thi công, giám sát và các văn bản liên quan.</li>
                    </ul>
                    <p style={{ margin: '4px 0 0 0' }}><strong>b) Về chất lượng công việc:</strong> {quality}</p>
                    {opinions && <p style={{ margin: 0 }}><strong>c) Ý kiến khác:</strong> {opinions}</p>}
                  </div>
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem', color: '#111827', marginBottom: '2px' }}>5. Kết luận:</strong>
                  <div style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#f0fdf4', 
                    borderLeft: '4px solid #16a34a', 
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    color: '#15803d'
                  }}>
                    {conclusion}
                  </div>
                </div>
              </div>

              {/* Signatures block */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '24px', borderTop: '1px dashed #d1d5db', paddingTop: '16px', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <strong style={{ fontSize: '0.85rem', display: 'block', textTransform: 'uppercase', color: '#374151' }}>CÁN BỘ GIÁM SÁT THI CÔNG</strong>
                  <span style={{ fontSize: '0.75rem', fontStyle: 'italic', display: 'block', color: 'hsl(var(--success))', marginTop: '4px', fontWeight: 600 }}>
                    [Đã ký số điện tử]
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginTop: '1px' }}>Ngày ký: {phase.acceptanceDate}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, display: 'block', marginTop: '20px', color: '#111827' }}>{representativeA}</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <strong style={{ fontSize: '0.85rem', display: 'block', textTransform: 'uppercase', color: '#374151' }}>KỸ THUẬT THI CÔNG TRỰC TIẾP</strong>
                  <span style={{ fontSize: '0.75rem', fontStyle: 'italic', display: 'block', color: 'hsl(var(--success))', marginTop: '4px', fontWeight: 600 }}>
                    [Đã ký số điện tử]
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginTop: '1px' }}>Ngày ký: {phase.acceptanceDate}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, display: 'block', marginTop: '20px', color: '#111827' }}>{representativeB}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Editable Form representing Nghiem-thu.md */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px', margin: 0 }}>
                Nghiệm thu & Đóng băng Giai đoạn (Theo mẫu quy chuẩn)
              </h3>

              {/* 1. Members */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--primary))', margin: 0 }}>1. Thành phần trực tiếp nghiệm thu</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="rep-a" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Cán bộ giám sát (Bên A) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <input
                      id="rep-a"
                      type="text"
                      value={representativeA}
                      onChange={(e) => setRepresentativeA(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="role-a" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Chức vụ <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <input
                      id="role-a"
                      type="text"
                      value={roleA}
                      onChange={(e) => setRoleA(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="rep-b" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Kỹ thuật thi công (Bên B) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <input
                      id="rep-b"
                      type="text"
                      value={representativeB}
                      onChange={(e) => setRepresentativeB(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="role-b" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Chức vụ <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <input
                      id="role-b"
                      type="text"
                      value={roleB}
                      onChange={(e) => setRoleB(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 2. Time */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--primary))', margin: 0 }}>2. Thời gian nghiệm thu</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="start-time" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Thời gian bắt đầu <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <input
                      id="start-time"
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      style={{ padding: '8px 12px', width: '100%', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="end-time" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Thời gian kết thúc <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <input
                      id="end-time"
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      style={{ padding: '8px 12px', width: '100%', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 3. Evidences & standards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--primary))', margin: 0 }}>3. Tài liệu căn cứ nghiệm thu & Kết quả thí nghiệm</h4>
                
                <div>
                  <label htmlFor="drawings-input" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Bản vẽ thiết kế thi công áp dụng (Số hiệu bản vẽ) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <input
                    id="drawings-input"
                    type="text"
                    value={drawings}
                    onChange={(e) => setDrawings(e.target.value)}
                    placeholder="Ví dụ: Bản vẽ số BV-01/MONG"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="standards-input" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tiêu chuẩn, quy phạm xây dựng áp dụng <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <input
                    id="standards-input"
                    type="text"
                    value={standards}
                    onChange={(e) => setStandards(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="results-input" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Các kết quả kiểm tra, thí nghiệm chất lượng vật liệu <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <textarea
                    id="results-input"
                    value={results}
                    onChange={(e) => setResults(e.target.value)}
                    rows={2}
                    required
                  />
                </div>
              </div>

              {/* 4. Evaluation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--primary))', margin: 0 }}>4. Đánh giá chất lượng & Kết luận</h4>
                
                <div>
                  <label htmlFor="quality-input" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Đánh giá chất lượng công việc đã thực hiện <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <textarea
                    id="quality-input"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    rows={2}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="opinions-input" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Ý kiến khác (nếu có)</label>
                  <input
                    id="opinions-input"
                    type="text"
                    value={opinions}
                    onChange={(e) => setOpinions(e.target.value)}
                    placeholder="Không có ý kiến khác"
                  />
                </div>

                <div>
                  <label htmlFor="conclusion-input" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Kết luận <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <select
                    id="conclusion-input"
                    value={conclusion}
                    onChange={(e) => setConclusion(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                    required
                  >
                    <option value="Chấp nhận nghiệm thu và đồng ý cho triển khai các công việc tiếp theo.">Chấp nhận nghiệm thu và đồng ý cho triển khai các công việc tiếp theo</option>
                    <option value="Không chấp nhận nghiệm thu. Yêu cầu sửa chữa các sai sót trước khi nghiệm thu lại.">Không chấp nhận nghiệm thu, yêu cầu khắc phục sửa chữa</option>
                  </select>
                </div>
              </div>
            </form>
          )}

          {/* Action buttons & Revocation */}
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
                type="button"
                onClick={handleSubmit}
                className="btn btn-primary"
                disabled={!allCompleted}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Lock size={16} />
                <span>Xác nhận & Đóng băng Phase</span>
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', width: '100%' }}>
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
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          Bạn cần đăng nhập với vai trò <strong>Trưởng phòng Kỹ Thuật (TPKT)</strong> để tiến hành nghiệm thu giai đoạn này.
        </div>
      )}

      {/* History Detail Modal */}
      {selectedHistory && (
        <Modal 
          isOpen={!!selectedHistory} 
          onClose={() => setSelectedHistory(null)} 
          title={`Chi tiết Biên bản Nghiệm thu - ${selectedHistory.date}`}
        >
          <div style={{
            backgroundColor: '#ffffff',
            color: '#1a202c',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid hsl(var(--border))',
            lineHeight: '1.5',
            fontSize: '0.9rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '75vh',
            overflowY: 'auto'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
              <h5 style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '0.85rem' }}>Độc lập – Tự do – Hạnh phúc</h5>
            </div>
            
            <div style={{ textAlign: 'center', margin: '10px 0' }}>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem' }}>BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG</h2>
              <span className={`badge ${selectedHistory.isPassed ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: '8px' }}>
                {selectedHistory.isPassed ? 'KẾT QUẢ ĐẠT' : 'KẾT QUẢ KHÔNG ĐẠT'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div><strong>Thành phần nghiệm thu:</strong></div>
              <div>- Bên A: {selectedHistory.representativeA} ({selectedHistory.roleA})</div>
              <div>- Bên B: {selectedHistory.representativeB} ({selectedHistory.roleB})</div>
            </div>

            <div>
              <strong>Thời gian:</strong> Từ {new Date(selectedHistory.startTime).toLocaleString('vi-VN')} đến {new Date(selectedHistory.endTime).toLocaleString('vi-VN')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <strong>Đánh giá chất lượng:</strong>
              <p style={{ margin: 0, paddingLeft: '8px', borderLeft: '3px solid #e2e8f0' }}>{selectedHistory.quality}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <strong>Kết luận của TPKT:</strong>
              <div style={{ 
                padding: '8px 12px', 
                backgroundColor: selectedHistory.isPassed ? '#f0fdf4' : '#fef2f2', 
                borderLeft: `4px solid ${selectedHistory.isPassed ? '#16a34a' : '#dc2626'}`, 
                fontWeight: 600,
                color: selectedHistory.isPassed ? '#15803d' : '#b91c1c'
              }}>
                {selectedHistory.conclusion}
              </div>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

