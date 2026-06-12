import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type {IncidentReport, WBSTask, WBSPhase, ProjectMember} from '../types/common';
import { ReportIncidentModal } from './Incidents/modals/ReportIncidentModal';
import { ResolveIncidentModal } from './Incidents/modals/ResolveIncidentModal';
import { IncidentDetailModal } from './Incidents/modals/IncidentDetailModal';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus
} from 'lucide-react';

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
  const isTPKT = user?.role === 'tpkt' || user?.role === 'admin';
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
        return <span className="badge badge-warning">Báo cáo mới</span>;
      case 'Assessing':
        return <span className="badge badge-danger">Yêu cầu bổ sung</span>;
      case 'WaitingReview':
        return <span className="badge badge-primary">Chờ TPKT duyệt</span>;
      case 'Approved':
        return <span className="badge badge-success">Đã phê duyệt</span>;
      case 'Rejected':
        return <span className="badge badge-danger">Từ chối</span>;
      case 'Closed':
        return <span className="badge badge-secondary">Đã đóng</span>;
      default:
        return null;
    }
  };

  // Check deadline reserves
  const selectedTask = selectedIncident ? tasks.find(t => t.id === selectedIncident.taskId) : null;
  const selectedTaskPhase = selectedTask ? phases.find(p => p.id === selectedTask.phaseId) || null : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Notifications */}
      {success && (
        <div className="animate-fade-in" style={{ padding: '10px 14px', backgroundColor: 'hsl(var(--success-glow))', border: '1px solid hsl(var(--success) / 0.2)', borderRadius: 'var(--radius-sm)', color: 'hsl(142 70% 30%)', fontSize: '0.85rem' }}>
          {success}
        </div>
      )}
      {error && (
        <div className="animate-fade-in" style={{ padding: '10px 14px', backgroundColor: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.2)', borderRadius: 'var(--radius-sm)', color: 'hsl(346 84% 35%)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Header and Statistics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button 
            className="btn btn-secondary" 
            style={{ marginBottom: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            Quay lại WBS
          </button>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Quản lý Sự cố của Task</h3>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
            Quản lý báo cáo sự cố hư hỏng tại công trường và quy trình tái thi công (Rework)
          </p>
        </div>
        {canReportIncident && (
          <div style={{ display: 'flex', gap: '10px' }}>
          {canReportIncident && (
            <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} /> Lập Báo cáo Sự cố &amp; Thiệt hại
            </button>
          )}
        </div>
        )}
      </div>

      {/* Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '50%', backgroundColor: 'hsl(var(--primary-glow))', color: 'hsl(var(--primary))' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>TỔNG SỐ SỰ CỐ</span>
            <strong style={{ fontSize: '1.4rem' }}>{incidents.length}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '50%', backgroundColor: 'hsl(var(--warning-glow))', color: 'hsl(var(--warning))' }}>
            <Clock size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>CHỜ XỬ LÝ / PHẢN HỒI</span>
            <strong style={{ fontSize: '1.4rem' }}>
              {incidents.filter(i => !['Approved', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '50%', backgroundColor: 'hsl(var(--success-glow))', color: 'hsl(var(--success))' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>ĐÃ KHẮC PHỤC (REWORKED)</span>
            <strong style={{ fontSize: '1.4rem' }}>
              {incidents.filter(i => ['Approved', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Incidents Table */}
      <div className="card" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
          Danh sách Báo cáo sự cố cho Công việc này
        </h4>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))' }}>Đang tải báo cáo sự cố...</div>
        ) : incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
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
                  <th style={{ textAlign: 'center' }}>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedIncident(inc); setIsDetailOpen(true); }}>
                    <td>{inc.date}</td>
                    <td><strong style={{ fontSize: '0.88rem' }}>{inc.taskName}</strong></td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'hsl(210 20% 90%)', color: 'hsl(var(--text-secondary))' }}>{inc.incidentType}</span>
                    </td>
                    <td>{inc.reporterName}</td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inc.description}
                    </td>
                    <td>{getStatusBadge(inc.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Xem</button>
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
