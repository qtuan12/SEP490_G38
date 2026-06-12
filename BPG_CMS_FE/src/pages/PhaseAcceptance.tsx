import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type {WBSPhase, WBSTask, Project} from '../types/common';
import { 
  ArrowLeft, 
  AlertTriangle, 
  Download
} from 'lucide-react';
import type {AcceptanceRecord} from '../types/common';
import { AcceptanceDocument } from './PhaseAcceptance/components/AcceptanceDocument';
import type { AcceptanceData } from '../types/common';
import { AcceptanceForm } from './PhaseAcceptance/components/AcceptanceForm';
import { AcceptanceHistoryModal } from './PhaseAcceptance/components/AcceptanceHistoryModal';
import { AcceptanceTasksChecklist } from './PhaseAcceptance/components/AcceptanceTasksChecklist';
import { AcceptanceHistoryList } from './PhaseAcceptance/components/AcceptanceHistoryList';
import { exportAcceptancePDF } from '../utils/exportAcceptancePDF';

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

  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<AcceptanceRecord | null>(null);

  const isSubmitted = phase?.status === 'frozen';

  const documentData: AcceptanceData | null = phase && phase.status === 'frozen' ? {
    representativeA: phase.acceptanceRepresentativeA || '',
    roleA: phase.acceptanceRoleA || '',
    representativeB: phase.acceptanceRepresentativeB || '',
    roleB: phase.acceptanceRoleB || '',
    startTime: phase.acceptanceStartTime || '',
    endTime: phase.acceptanceEndTime || '',
    drawings: phase.acceptanceDrawings || '',
    standards: phase.acceptanceStandards || '',
    results: phase.acceptanceResults || '',
    quality: phase.acceptanceQuality || '',
    opinions: phase.acceptanceOpinions || '',
    conclusion: phase.acceptanceConclusion || '',
    acceptanceDate: phase.acceptanceDate || ''
  } : null;

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
        // Data is now derived from targetPhase directly in documentData
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
    if (!project || !phase || !documentData) return;
    exportAcceptancePDF(project, phase, documentData);
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
      <AcceptanceTasksChecklist tasks={tasks} allCompleted={allCompleted} />

      {/* Acceptance History */}
      <AcceptanceHistoryList history={phase.acceptanceHistory} onSelect={setSelectedHistory} />

      {/* Evaluation Form */}
      {isTPKT ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {isSubmitted && documentData ? (
            <AcceptanceDocument project={project} phase={phase} data={documentData} />
          ) : (
            <AcceptanceForm 
              phase={phase!} 
              user={user ? { name: user.name, role: user.role, id: user.id } : null} 
              allCompleted={allCompleted} 
              onSuccess={(msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); }} 
              onError={(msg) => setError(msg)} 
              onPhaseUpdated={loadData} 
            />
          )}

          {/* Action buttons & Revocation */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
            {isSubmitted && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', width: '100%' }}>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-hover))' }}
                >
                  <Download size={16} />
                  <span>Tải File Báo Cáo Nghiệm Thu</span>
                </button>

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

      <AcceptanceHistoryModal 
        selectedHistory={selectedHistory} 
        onClose={() => setSelectedHistory(null)} 
      />

    </div>
  );
};
