import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import type {IncidentReport, WBSTask, WBSPhase, ProjectMember} from '../../types/common';
import { ReportIncidentModal } from '../Incidents/modals/ReportIncidentModal';
import { ResolveIncidentModal } from '../Incidents/modals/ResolveIncidentModal';
import { IncidentDetailModal } from '../Incidents/modals/IncidentDetailModal';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus
} from 'lucide-react';
import { Badge, Button } from '../../components/ui';

export const TaskIncidents: React.FC = () => {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [isResolveOpen, setIsResolveOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentMember = members.find(m => m.userId === user?.id);
  const isPL = currentMember ? currentMember.isLeader : false;
  const isTPKT = user?.role === 'technicalmanager' || user?.role === 'admin';
  const canApproveOrRequestRevision = isTPKT; // Only TPKT/Admin can approve/request revision
  const canReportIncident = isPL || isTPKT; // Only PL or TPKT/Admin

  const loadData = async () => {
    setLoading(true);
    try {
      const incList = await projectService.getIncidents(projectId!);
      const taskList = await projectService.getTasks(projectId!);
      const phaseList = await projectService.getPhases(projectId!);
      const memberList = await projectService.getMembers(projectId!);

      setIncidents(incList.filter(i => i.taskId === taskId));
      setTasks(taskList.filter(t => t.status !== 'obsolete'));
      setPhases(phaseList);
      setMembers(memberList);

    } catch (err: any) {
      console.error(err);
      setError('Lỗi khi tải dữ liệu sự cố.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
    loadData();
  };

  const handleError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };



  // 1. Submit Incident & Damage Report (PL) - Handled in ReportIncidentModal

  // Help functions for UI
  const getStatusBadge = (status: IncidentReport['status']) => {
    switch (status) {
      case 'Reported':
        return <Badge variant="warning" className="normal-case">Báo cáo mới</Badge>;
      case 'Assessing':
        return <Badge variant="danger" className="normal-case">Yêu cầu bổ sung</Badge>;
      case 'WaitingReview':
        return <Badge variant="info" className="normal-case">Chờ TPKT duyệt</Badge>;
      case 'Approved':
        return <Badge variant="success" className="normal-case">Đã phê duyệt</Badge>;
      case 'Rejected':
        return <Badge variant="danger" className="normal-case">Từ chối</Badge>;
      case 'Closed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-[hsl(210_20%_90%)] text-[hsl(var(--text-secondary))] text-[0.75rem] normal-case">Đã đóng</span>;
      default:
        return null;
    }
  };

  // Check deadline reserves
  const selectedTask = selectedIncident ? tasks.find(t => t.id === selectedIncident.taskId) : null;
  const selectedTaskPhase = selectedTask ? phases.find(p => p.id === selectedTask.phaseId) || null : null;

  return (
    <div className="flex flex-col gap-5">
      
      {/* Notifications */}
      {success && (
        <div className="animate-fade-in py-2.5 px-3.5 bg-[hsl(var(--success-glow))] border border-[hsl(var(--success)/0.2)] rounded-sm text-[hsl(142_70%_30%)] text-[0.85rem]">
          {success}
        </div>
      )}
      {error && (
        <div className="animate-fade-in py-2.5 px-3.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm text-[hsl(346_84%_35%)] text-[0.85rem]">
          {error}
        </div>
      )}

      {/* Header and Statistics */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <Button 
            variant="secondary"
            className="mb-2.5 text-[0.8rem] h-auto py-1.5 px-3"
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            Quay lại WBS
          </Button>
          <h3 className="text-[1.15rem] font-semibold m-0">Quản lý Sự cố của Task</h3>
          <p className="text-[0.8rem] text-[hsl(var(--text-muted))] mt-1 mb-0">
            Quản lý báo cáo sự cố hư hỏng tại công trường và quy trình tái thi công (Rework)
          </p>
        </div>
        {canReportIncident && (
          <div className="flex gap-2.5">
            <Button 
              variant="primary" 
              onClick={() => setIsCreateOpen(true)} 
              className="flex items-center gap-2"
            >
              <Plus size={16} /> Lập Báo cáo Sự cố &amp; Thiệt hại
            </Button>
          </div>
        )}
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(200px,_1fr))] gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">TỔNG SỐ SỰ CỐ</span>
            <strong className="text-[1.4rem] font-bold">{incidents.length}</strong>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-[hsl(var(--warning-glow))] text-[hsl(var(--warning))] shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">CHỜ XỬ LÝ / PHẢN HỒI</span>
            <strong className="text-[1.4rem] font-bold">
              {incidents.filter(i => !['Approved', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-[hsl(var(--success-glow))] text-[hsl(var(--success))] shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">ĐÃ KHẮC PHỤC (REWORKED)</span>
            <strong className="text-[1.4rem] font-bold">
              {incidents.filter(i => ['Approved', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Incidents Table */}
      <div className="card p-5">
        <h4 className="text-[0.95rem] font-semibold text-[hsl(var(--text-secondary))] mb-3.5 pb-2 border-b border-[hsl(var(--border))]">
          Danh sách Báo cáo sự cố cho Công việc này
        </h4>

        {loading ? (
          <div className="text-center py-8 text-[hsl(var(--text-muted))]">Đang tải báo cáo sự cố...</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-10 text-[hsl(var(--text-muted))] text-[0.9rem] border border-dashed border-[hsl(var(--border))] rounded-md">
            Chưa ghi nhận sự cố thi công nào tại dự án này.
          </div>
        ) : (
          <div className="table-container">
            <div className="overflow-x-auto w-full">
            <table>
              <thead>
                <tr>
                  <th>Ngày báo cáo</th>
                  <th>Công việc bị sự cố</th>
                  <th>Phân loại</th>
                  <th>Người báo cáo</th>
                  <th>Mô tả sự cố</th>
                  <th>Trạng thái</th>
                  <th className="text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id} className="cursor-pointer hover:bg-[hsl(var(--bg-main)/0.5)] transition-colors" onClick={() => { setSelectedIncident(inc); setIsDetailOpen(true); }}>
                    <td className="whitespace-nowrap text-sm">{inc.date}</td>
                    <td><strong className="text-[0.88rem]">{inc.taskName}</strong></td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-[hsl(210_20%_90%)] text-[hsl(var(--text-secondary))] text-[0.75rem] whitespace-nowrap">{inc.incidentType}</span>
                    </td>
                    <td className="text-sm">{inc.reporterName}</td>
                    <td className="max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                      {inc.description}
                    </td>
                    <td className="whitespace-nowrap">{getStatusBadge(inc.status)}</td>
                    <td className="text-center">
                      <Button variant="secondary" className="py-1 px-2 text-[0.75rem] h-auto">Xem</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>

      {/* ─── MODAL 1: DETAILED INCIDENT & WORKFLOW VIEW ─── */}
      <IncidentDetailModal
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedIncident(null); }}
        incident={selectedIncident!}
        phase={selectedTaskPhase}
        user={user ? { id: user.id, name: user.name, role: user.role } : null}
        canApproveOrRequestRevision={canApproveOrRequestRevision}
        onResolveClick={() => setIsResolveOpen(true)}
        onSuccess={handleSuccess}
        onError={handleError}
        onIncidentUpdated={(updatedIncident) => {
          setSelectedIncident(updatedIncident);
          setIncidents(prev => prev.map(inc => inc.id === updatedIncident.id ? updatedIncident : inc));
        }}
        projectId={projectId!}
      />

      {/* ─── MODAL 2: REPORT NEW INCIDENT & DAMAGE (PL) ─── */}
      {isCreateOpen && (
        <ReportIncidentModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          projectId={projectId!}
          taskId={taskId!}
          taskName={tasks.find(t => t.id === taskId)?.name || 'Unknown'}
          user={user ? { id: user.id, name: user.name } : null}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}


      {/* ─── MODAL 5: APPROVE & RESOLVE REWORK TASK (TPKT) ─── */}
      {isResolveOpen && selectedIncident && selectedTask && (
        <ResolveIncidentModal
          isOpen={isResolveOpen}
          onClose={() => setIsResolveOpen(false)}
          incident={selectedIncident}
          task={selectedTask}
          phase={selectedTaskPhase}
          members={members}
          user={user ? { id: user.id, name: user.name } : null}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

    </div>
  );
};
