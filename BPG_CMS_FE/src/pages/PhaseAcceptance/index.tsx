import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import type {WBSPhase, WBSTask, Project} from '../../types/common';
import { 
  ArrowLeft, 
  AlertTriangle, 
  Download
} from 'lucide-react';
import type {AcceptanceRecord} from '../../types/common';
import { AcceptanceDocument } from '../PhaseAcceptance/components/AcceptanceDocument';
import type { AcceptanceData } from '../../types/common';
import { AcceptanceForm } from '../PhaseAcceptance/components/AcceptanceForm';
import { AcceptanceHistoryModal } from '../PhaseAcceptance/components/AcceptanceHistoryModal';
import { AcceptanceTasksChecklist } from '../PhaseAcceptance/components/AcceptanceTasksChecklist';
import { AcceptanceHistoryList } from '../PhaseAcceptance/components/AcceptanceHistoryList';
import { exportAcceptancePDF } from '../../utils/exportAcceptancePDF';
import { Button } from '../../components/ui';

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
      <div className="flex justify-center items-center h-[300px]">
        <span className="text-[hsl(var(--text-muted))]">Đang tải thông tin nghiệm thu giai đoạn...</span>
      </div>
    );
  }

  if (!project || !phase) {
    return (
      <div className="card text-center p-10">
        <h3 className="text-lg font-semibold m-0">Không tìm thấy giai đoạn hoặc dự án</h3>
        <Button variant="secondary" onClick={() => navigate('/projects')} className="mt-4">
          Quay lại danh sách dự án
        </Button>
      </div>
    );
  }

  const allCompleted = tasks.length > 0 && tasks.every(t => t.progress === 100);

  return (
    <div className="flex flex-col gap-6 max-w-[780px] mx-auto animate-fade-in">
      
      {/* Navigation and Title */}
      <div className="flex flex-col gap-3">
        <button 
          onClick={() => navigate(`/projects/${projectId}`)} 
          className="inline-flex items-center gap-1.5 bg-transparent border-none text-[hsl(var(--text-secondary))] cursor-pointer text-[0.9rem] font-medium w-fit hover:text-[hsl(var(--primary))] transition-colors p-0"
        >
          <ArrowLeft size={16} />
          <span>Quay lại Không gian dự án</span>
        </button>
        <h1 className="text-[1.75rem] font-extrabold m-0">Nghiệm thu Giai đoạn</h1>
        <p className="text-[0.875rem] text-[hsl(var(--text-secondary))] m-0">
          Dự án: <strong className="font-semibold">{project.name}</strong> &rarr; Giai đoạn: <strong className="font-semibold">{phase.name}</strong>
        </p>
      </div>

      {/* Messages */}
      {success && (
        <div className="animate-fade-in py-3 px-4.5 bg-[hsl(var(--success-glow))] border border-[hsl(var(--success)/0.2)] rounded-sm text-[hsl(142_70%_30%)] text-[0.9rem] font-medium">
          {success}
        </div>
      )}

      {error && (
        <div className="animate-fade-in py-3 px-4.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm text-[hsl(346_84%_35%)] text-[0.9rem] font-medium">
          {error}
        </div>
      )}

      {/* Checklist Tasks Block */}
      <AcceptanceTasksChecklist tasks={tasks} allCompleted={allCompleted} />

      {/* Acceptance History */}
      <AcceptanceHistoryList history={phase.acceptanceHistory} onSelect={setSelectedHistory} />

      {/* Evaluation Form */}
      {isTPKT ? (
        <div className="card flex flex-col gap-5 bg-[hsl(var(--bg-card))]">
          
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
          <div className="flex gap-3 justify-end mt-2.5">
            {isSubmitted && (
              <div className="flex flex-col items-end gap-3 w-full">
                <Button
                  type="button"
                  onClick={handleDownloadPDF}
                  variant="secondary"
                  className="flex items-center gap-2 border-[hsl(var(--primary))] text-[hsl(var(--primary-hover))] bg-transparent hover:bg-[hsl(var(--primary-glow))]"
                >
                  <Download size={16} />
                  <span>Tải File Báo Cáo Nghiệm Thu</span>
                </Button>

                {!isRevoking ? (
                  <button 
                    type="button" 
                    onClick={() => setIsRevoking(true)}
                    className="flex items-center gap-1.5 py-2 px-4 rounded-sm font-semibold transition-all duration-200 cursor-pointer text-[0.85rem] bg-[hsl(var(--bg-main))] text-[hsl(var(--danger))] border border-[hsl(var(--danger)/0.3)] hover:bg-[hsl(var(--danger-glow))] hover:border-[hsl(var(--danger))]"
                  >
                    <AlertTriangle size={15} />
                    Yêu cầu Hủy Nghiệm Thu
                  </button>
                ) : (
                  <div className="w-full mt-3 p-4 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.3)] rounded-sm">
                    <label htmlFor="revoke-reason" className="text-[hsl(var(--danger))] font-semibold block mb-2">
                      Lý do hủy nghiệm thu (Tối thiểu 20 ký tự) <span className="text-[hsl(var(--danger))]">*</span>
                    </label>
                    <textarea
                      id="revoke-reason"
                      placeholder="Nêu rõ nguyên nhân hủy bỏ (VD: Phát hiện sai sót trong biên bản, thi công chưa đạt chuẩn sau kiểm tra...)"
                      value={revokeReason}
                      onChange={(e) => setRevokeReason(e.target.value)}
                      rows={3}
                      className="w-full mb-3 p-2.5 rounded-sm border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--bg-main))] text-[0.9rem] font-medium resize-y focus:outline-none focus:border-[hsl(var(--danger))]"
                    />
                    <div className="flex justify-between text-[0.8rem] text-[hsl(var(--danger))] mb-3">
                      <span>Lưu ý: Chỉ có thể hủy nghiệm thu trong vòng 7 ngày kể từ lúc đóng băng.</span>
                      <span className="font-semibold">{revokeReason.trim().length} / 20</span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" onClick={() => setIsRevoking(false)}>Hủy</Button>
                      <button 
                        type="button" 
                        className="py-2 px-4 rounded-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-[hsl(var(--danger))] text-white border-none hover:bg-[#b91c1c]" 
                        onClick={handleRevoke} 
                        disabled={revokeReason.trim().length < 20}
                      >
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
        <div className="card text-center text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-card))]">
          Bạn cần đăng nhập với vai trò <strong className="font-semibold text-[hsl(var(--text-primary))]">Trưởng phòng Kỹ Thuật (TPKT)</strong> để tiến hành nghiệm thu giai đoạn này.
        </div>
      )}

      <AcceptanceHistoryModal 
        selectedHistory={selectedHistory} 
        onClose={() => setSelectedHistory(null)} 
      />

    </div>
  );
};
