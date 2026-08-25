import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import type { WBSPhase, WBSTask, Project } from '../../types/common';
import { formatDate, formatDateOnly } from '../../utils/dateHelpers';
import {
  ArrowLeft,
  Download,
  AlertTriangle
} from 'lucide-react';
import { AcceptanceDocument } from '../PhaseAcceptance/components/AcceptanceDocument';
import { AcceptanceForm } from '../PhaseAcceptance/components/AcceptanceForm';
import { AcceptanceTasksChecklist } from '../PhaseAcceptance/components/AcceptanceTasksChecklist';
import { Button } from '../../components/ui';
import { phaseAcceptanceService } from '../../services/phaseAcceptanceService';
import html2pdf from 'html2pdf.js';
import { useSignalREvent } from '../../hooks/useSignalREvent';
import { toast } from 'react-hot-toast';
import { useProjectAccess } from '../../hooks/useProjectAccess';
import { useRealtimeDataRefresh } from '../../hooks/useRealtimeDataRefresh';
import { RealtimeEntities } from '../../constants/realtimeEntities';
import { isPhaseReadyForAcceptance } from '../../utils/phaseAcceptance';
import type { PhaseAcceptance as PhaseAcceptanceRecord } from '../../types/phaseAcceptance';

type AcceptanceSummary = Pick<
  PhaseAcceptanceRecord,
  'isCancelled' | 'acceptedByName' | 'acceptanceDate' | 'cancelledByName' | 'cancelledAt' | 'cancellationReason'
>;

export const PhaseAcceptance: React.FC = () => {
  const { projectId, phaseId } = useParams<{ projectId: string; phaseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canManageAcceptance } = useProjectAccess(projectId);

  const [project, setProject] = useState<Project | null>(null);
  const [phase, setPhase] = useState<WBSPhase | null>(null);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const historyId = searchParams.get('historyId');
  const [historicalAcceptance, setHistoricalAcceptance] = useState<PhaseAcceptanceRecord | null>(null);
  const [historicalDocData, setHistoricalDocData] = useState<string | null>(null);

  const isViewingHistory = !!historicalDocData;
  const isSubmitted = phase?.status === 'frozen';

  const [activeReportContent, setActiveReportContent] = useState<string>('');
  const [activeAcceptanceDate, setActiveAcceptanceDate] = useState<string>('');
  const [activeCreatorName, setActiveCreatorName] = useState<string>('');
  const [activeAcceptanceId, setActiveAcceptanceId] = useState<number | null>(null);

  const displayedAcceptance: AcceptanceSummary | null = isViewingHistory
    ? historicalAcceptance
    : isSubmitted && activeAcceptanceId
      ? {
          isCancelled: false,
          acceptedByName: activeCreatorName,
          acceptanceDate: activeAcceptanceDate,
        }
      : null;

  const canRevoke = isViewingHistory ? !historicalAcceptance?.isCancelled : isSubmitted;

  const loadData = React.useCallback(async (
    silent = false,
    requestedHistoryId: string | null = historyId,
  ) => {
    if (!projectId || !phaseId) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const proj = await projectService.getProjectById(projectId);
      setProject(proj);

      const allPhases = await projectService.getPhases(projectId);
      const targetPhase = allPhases.find(p => p.id === phaseId) || null;
      setPhase(targetPhase);

      const allTasks = await projectService.getTasks(projectId);
      const phaseTasks = allTasks.filter(t => t.phaseId === phaseId && t.status !== 'obsolete');
      setTasks(phaseTasks);

      if (targetPhase?.status === 'frozen') {
        const res = await phaseAcceptanceService.getPhaseAcceptances({
          pageIndex: 1,
          pageSize: 10,
          projectId: Number(projectId),
          phaseId: Number(phaseId),
        });
        const activeAcc = res.items.find(x => !x.isCancelled);
        if (activeAcc) {
          setActiveReportContent(activeAcc.reportContent || '');
          setActiveAcceptanceDate(activeAcc.acceptanceDate);
          setActiveCreatorName(activeAcc.acceptedByName || '');
          setActiveAcceptanceId(activeAcc.acceptanceId);
        }
      }

      if (requestedHistoryId) {
        const res = await phaseAcceptanceService.getPhaseAcceptances({
          pageIndex: 1,
          pageSize: 10,
          projectId: Number(projectId),
          phaseId: Number(phaseId),
        });
        const targetAcc = res.items.find(x => x.acceptanceId === Number(requestedHistoryId));
        if (targetAcc) {
          setHistoricalAcceptance(targetAcc);
          setHistoricalDocData(targetAcc.reportContent);
        }
      }
    } catch (err: any) {
      if (silent) console.error(err);
      else setError(err.message || 'Lỗi khi tải thông tin nghiệm thu.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId, phaseId, historyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const invalidateWbsCache = React.useCallback(async () => {
    if (!projectId) return;
    await queryClient.invalidateQueries({ queryKey: ['wbsData', projectId] });
  }, [projectId, queryClient]);

  const refreshAfterAcceptanceMutation = React.useCallback(async () => {
    await invalidateWbsCache();
    await loadData();
  }, [invalidateWbsCache, loadData]);

  // Realtime notification via SignalR
  useSignalREvent('ReceiveNotification', (noti: any) => {
    if (noti?.referenceType === 'PhaseAcceptance' || noti?.referenceType === 'Project' || noti?.referenceType?.includes('/acceptance') || noti?.referenceType?.includes('/phases')) {
      toast('Thông tin nghiệm thu giai đoạn vừa được cập nhật!', { icon: '📝' });
    }
  });

  useRealtimeDataRefresh(
    () => loadData(true),
    [...RealtimeEntities.projects, ...RealtimeEntities.phaseAcceptances],
  );

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseId || submitting) return;

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
          setRevokeError('Không thể hủy nghiệm thu. Đã quá 7 ngày kể từ ngày đóng băng.');
          return;
        }
      }
    }

    const targetId = isViewingHistory ? historicalAcceptance?.acceptanceId : activeAcceptanceId;
    if (!targetId) {
      setRevokeError('Không tìm thấy biên bản nghiệm thu cần hủy.');
      return;
    }

    setSubmitting(true);
    setRevokeError(null);
    try {
      const message = await phaseAcceptanceService.cancelAcceptance(targetId, { cancellationReason: revokeReason });
      setIsRevoking(false);
      setRevokeReason('');
      toast.success(message || 'Đã hủy nghiệm thu thành công.');

      await invalidateWbsCache();

      // Invalidate WBS data cache so WBSWorkspace reflects the updated phase status
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['wbsData', projectId] });
        queryClient.invalidateQueries({ queryKey: ['wbsData', `p-${projectId}`] });
      }

      // Navigate to the history view of the revoked acceptance
      navigate(`/projects/${projectId}/phases/${phaseId}/acceptance?historyId=${targetId}`, { replace: true });
      await loadData(true, String(targetId));
    } catch (err: any) {
      setRevokeError(err.message || 'Có lỗi xảy ra khi hủy nghiệm thu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('printable-acceptance-doc');
    if (!element) return;

    const opt = {
      margin: 10, // top, left, bottom, right
      filename: `Bien_Ban_Nghiem_Thu_${phase?.name || 'Giai_Doan'}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save();
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

  const allCompleted = isPhaseReadyForAcceptance(tasks);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto animate-fade-in">

      {/* Navigation and Title */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => historyId ? navigate(`/phase-acceptances?projectId=${projectId}&phaseId=${phaseId}`) : navigate(`/projects/${projectId}`)}
          className="inline-flex items-center gap-1.5 bg-transparent border-none text-[hsl(var(--text-secondary))] cursor-pointer text-[0.9rem] font-medium w-fit hover:text-[hsl(var(--primary))] transition-colors p-0"
        >
          <ArrowLeft size={16} />
          <span>{historyId ? 'Quay lại danh sách biên bản nghiệm thu' : 'Quay lại không gian dự án'}</span>
        </button>
        <h1 className="text-[1.75rem] font-extrabold m-0">Nghiệm thu giai đoạn</h1>
        <p className="text-[0.875rem] text-[hsl(var(--text-secondary))] m-0">
          Dự án: <strong className="font-semibold">{project.name}</strong> &rarr; Giai đoạn: <strong className="font-semibold">{phase.name}</strong>
        </p>
      </div>

      {error && (
        <div className="animate-fade-in py-3 px-4.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm text-[hsl(346_84%_35%)] text-[0.9rem] font-medium">
          {error}
        </div>
      )}

      {/* Checklist Tasks Block */}
      <AcceptanceTasksChecklist tasks={tasks} allCompleted={allCompleted} />

      {/* Evaluation Form or History Detail */}
      {(canManageAcceptance || isViewingHistory || isSubmitted) ? (
        <div className="card flex flex-col gap-5 bg-[hsl(var(--bg-card))]">

          {displayedAcceptance && (
            <div className={`p-4 rounded-xl border ${displayedAcceptance.isCancelled ? 'bg-[hsl(var(--danger-glow))] border-[hsl(var(--danger)/0.2)]' : 'bg-[hsl(var(--success-glow))] border-[hsl(var(--success)/0.2)]'}`}>
              <h3 className={`text-md font-semibold mb-2 flex items-center gap-2 ${displayedAcceptance.isCancelled ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--success))]'}`}>
                {displayedAcceptance.isCancelled ? 'Biên bản nghiệm thu này đã bị hủy' : 'Biên bản nghiệm thu hợp lệ'}
              </h3>
              <div className={`space-y-1 text-sm ${displayedAcceptance.isCancelled ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--success))]'}`}>
                <p><span className="font-medium">Người lập:</span> {displayedAcceptance.acceptedByName}</p>
                <p><span className="font-medium">Ngày lập:</span> {formatDate(displayedAcceptance.acceptanceDate)}</p>
                {displayedAcceptance.isCancelled && (
                  <>
                    <p><span className="font-medium">Người hủy:</span> {displayedAcceptance.cancelledByName}</p>
                    <p><span className="font-medium">Ngày hủy:</span> {displayedAcceptance.cancelledAt ? formatDate(displayedAcceptance.cancelledAt) : ''}</p>
                    <p><span className="font-medium">Lý do hủy:</span> {displayedAcceptance.cancellationReason}</p>
                  </>
                )}
              </div>
            </div>
          )}

          {isViewingHistory && historicalDocData !== null ? (
            <AcceptanceDocument project={project} phase={phase} reportContent={historicalDocData} creatorName={historicalAcceptance?.acceptedByName} acceptanceDate={historicalAcceptance ? formatDateOnly(historicalAcceptance.acceptanceDate) : undefined} />
          ) : isSubmitted ? (
            <AcceptanceDocument project={project} phase={phase} reportContent={activeReportContent || ''} creatorName={activeCreatorName} acceptanceDate={formatDateOnly(activeAcceptanceDate || new Date().toISOString())} />
          ) : (
            <AcceptanceForm
              phase={phase!}
              project={project}
              allCompleted={allCompleted}
              onSuccess={(msg) => toast.success(msg)}
              onError={(msg) => toast.error(msg)}
              onPhaseUpdated={refreshAfterAcceptanceMutation}
            />
          )}

          {/* Action buttons & Revocation */}
          <div className="flex gap-3 justify-end mt-2.5">
            {(isSubmitted || isViewingHistory) && (
              <div className="flex flex-col items-end gap-3 w-full">
                <Button
                  type="button"
                  onClick={handleDownloadPDF}
                  variant="secondary"
                  className="flex items-center gap-2 border-[hsl(var(--primary))] text-[hsl(var(--primary-hover))] bg-transparent hover:bg-[hsl(var(--primary-glow))]"
                >
                  <Download size={16} />
                  <span>Tải biên bản nghiệm thu</span>
                </Button>

                {canRevoke && !isRevoking && canManageAcceptance ? (
                  <Button
                    type="button"
                    onClick={() => { setIsRevoking(true); setRevokeError(null); }}
                    variant="outline"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                      color: 'hsl(var(--danger))', borderColor: 'hsl(var(--danger)/0.3)', backgroundColor: 'hsl(var(--bg-main))'
                    }}
                  >
                    <AlertTriangle size={15} />
                    Yêu cầu Hủy Nghiệm Thu
                  </Button>
                ) : canRevoke && isRevoking && canManageAcceptance ? (
                  <div className="w-full mt-3 p-4 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.3)] rounded-sm text-left">
                    <label htmlFor="revoke-reason" className="text-[hsl(var(--danger))] font-semibold block mb-2">
                      Lý do hủy nghiệm thu (Tối thiểu 20 ký tự) <span className="text-[hsl(var(--danger))]">*</span>
                    </label>
                    <textarea
                      id="revoke-reason"
                      placeholder=""
                      value={revokeReason}
                      onChange={(e) => {
                        setRevokeReason(e.target.value);
                        if (revokeError) setRevokeError(null);
                      }}
                      rows={3}
                      disabled={submitting}
                      className="w-full mb-3 p-2.5 rounded-sm border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--bg-main))] text-[0.9rem] font-medium resize-y focus:outline-none focus:border-[hsl(var(--danger))]"
                    />
                    {revokeError && (
                      <div className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded p-2.5 mb-3">
                        {revokeError}
                      </div>
                    )}
                    <div className="flex justify-between text-[0.8rem] text-[hsl(var(--danger))] mb-3">
                      <span></span>
                      <span className="font-semibold">{revokeReason.trim().length} / 20</span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        disabled={submitting}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '6px 16px', borderRadius: '4px',
                          backgroundColor: 'hsl(var(--bg-main))', color: 'hsl(var(--text-secondary))',
                          border: '1px solid hsl(var(--border))'
                        }}
                        onClick={() => { setIsRevoking(false); setRevokeReason(''); setRevokeError(null); }}
                      >
                        Hủy bỏ
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={handleRevoke}
                        disabled={revokeReason.trim().length < 20 || submitting}
                      >
                        {submitting ? 'Đang xử lý...' : 'Xác nhận Hủy Nghiệm Thu'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card text-center text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-card))]">
          Bạn cần đăng nhập với vai trò <strong className="font-semibold text-[hsl(var(--text-primary))]">Trưởng phòng Kỹ Thuật</strong> để tiến hành nghiệm thu giai đoạn này.
        </div>
      )}

    </div>
  );
};
