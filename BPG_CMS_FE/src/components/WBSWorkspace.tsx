import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type { WBSPhase, WBSTask, Project, ProjectMember, MaterialRequest } from '../services/projectService';
import { AssignEngineerModal, CreatePhaseModal, EditPhaseModal, PhaseBOQModal, CreateTaskModal, EditTaskModal, AdjustDeadlineModal, LeaderApprovalModal } from './WBSModals';
import { CreateMaterialRequestModal, ResubmitMaterialRequestModal } from './MaterialRequestModals';
import { DailyLogFormModal } from './DailyLogFormModal';
import { Modal } from './Modal';
import {
  Folder,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Calendar,
  History,
  CheckCircle,
  UserPlus,
  TrendingUp,
  FileSignature,
  User,
  Trash2,
  AlertCircle,
  AlertTriangle,
  FolderPlus,
  FilePlus2,
  Pencil,
  MoreVertical,
  BarChart2,
  Box,
  CornerDownRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getAvatarColor = (userId: string) => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
  ];
  return colors[hash % colors.length];
};

interface WBSWorkspaceProps {
  projectId: string;
}

export const WBSWorkspace: React.FC<WBSWorkspaceProps> = ({ projectId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);

  // Tree collapse state
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  // Selected task state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modal triggers
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isCreateMatReqOpen, setIsCreateMatReqOpen] = useState(false);
  const [createMatReqType, setCreateMatReqType] = useState<'normal' | 'emergency'>('normal');

  // ── CREATE Phase popup modal ─────────────────────────
  const [isCreatePhaseOpen, setIsCreatePhaseOpen] = useState(false);
  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [selectedResubmitRequest, setSelectedResubmitRequest] = useState<MaterialRequest | null>(null);

  const [isEditPhaseOpen, setIsEditPhaseOpen] = useState(false);
  const [selectedPhaseForEdit, setSelectedPhaseForEdit] = useState<WBSPhase | null>(null);

  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<WBSTask | null>(null);



  // State for task allocations estimation
  // State for task allocations estimation
  const [isPhaseMatReqOpen, setIsPhaseMatReqOpen] = useState(false);
  const [isLeaderApprovalOpen, setIsLeaderApprovalOpen] = useState(false);
  const [selectedPhaseForMatReq, setSelectedPhaseForMatReq] = useState<WBSPhase | null>(null);
  const [isBOQOpen, setIsBOQOpen] = useState(false);
  const [selectedPhaseForBOQ, setSelectedPhaseForBOQ] = useState<WBSPhase | null>(null);

  // States for design drawing modal

  // ── CREATE Task modal state ───────────────────────────────
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedPhaseForTask, setSelectedPhaseForTask] = useState<string>('');
  const [parentTaskForNew, setParentTaskForNew] = useState<string | undefined>(undefined);
  const [parentDeadlineForNew, setParentDeadlineForNew] = useState<string | undefined>(undefined);

  // ── ADJUST Deadline modal state ───────────────────────────
  const [isAdjustDeadlineOpen, setIsAdjustDeadlineOpen] = useState(false);
  const [adjustingTask, setAdjustingTask] = useState<WBSTask | null>(null);



  // ── Hover state ──────────────────────────────────────
  const [hoveredPhaseId, setHoveredPhaseId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // ── Context-menu (3-dot) state ───────────────────────
  const [phaseMenuId, setPhaseMenuId] = useState<string | null>(null);
  const [taskMenuId, setTaskMenuId] = useState<string | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = () => { setPhaseMenuId(null); setTaskMenuId(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);



  const isTPKTOrPL = user?.role === 'technicalmanager' || user?.role === 'admin';


  const loadWBSData = async () => {
    setLoading(true);
    try {
      const pList = await projectService.getPhases(projectId);
      const tList = await projectService.getTasks(projectId);
      const allProjs = await projectService.getProjects();
      const memberList = await projectService.getMembers(projectId);
      const mr = await projectService.getAllMaterialRequests();
      setMaterialRequests(mr);

      setProject(allProjs.find(p => p.id === projectId) || null);
      setPhases(pList);
      setTasks(tList);
      setMembers(memberList);

      const expands: Record<string, boolean> = {};
      pList.forEach(p => { expands[p.id] = true; });
      setExpandedPhases(expands);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải cơ cấu WBS.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadWBSData(); }, [projectId]);

  const togglePhase = (phaseId: string) =>
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));

  const handleSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
    loadWBSData();
  };
  const handleError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const selectedTaskPhase = selectedTask ? phases.find(p => p.id === selectedTask.phaseId) : null;


  const currentMember = members.find(m => m.userId === user?.id);
  const isPL = (currentMember ? currentMember.isLeader : false) || user?.role === 'admin' || user?.role === 'technicalmanager';

  const isPhaseReadyForAcceptance = (phaseId: string) => {
    const phaseTasks = tasks.filter(t => t.phaseId === phaseId && t.status !== 'obsolete');
    if (phaseTasks.length === 0) return false;
    return phaseTasks.every(t => t.progress === 100);
  };

  const canEdit = isTPKTOrPL && project?.status !== 'paused' && project?.status !== 'done';

  // ── Material Request Actions ─────────────────────────
  const handleApproveByLeader = async (requestId: string) => {
    try {
      await projectService.approveMaterialRequestByLeader(requestId, user?.name || 'Leader');
      handleSuccess('Đã duyệt yêu cầu và gửi cho TPKT.');
    } catch (err: any) { handleError(err.message); }
  };

  const handleApproveByTPKT = async (requestId: string) => {
    try {
      await projectService.approveMaterialRequestByTPKT(requestId, user?.name || 'TPKT');
      handleSuccess('Đã duyệt yêu cầu và gửi cho Kế toán.');
    } catch (err: any) { handleError(err.message); }
  };

  const handleRejectMatReq = async (requestId: string) => {
    const reason = prompt('Nhập lý do từ chối:');
    if (!reason || reason.trim().length < 5) {
      handleError('Lý do từ chối phải từ 5 ký tự trở lên.');
      return;
    }
    try {
      await projectService.rejectMaterialRequest(requestId, reason);
      handleSuccess('Đã từ chối yêu cầu vật tư.');
    } catch (err: any) { handleError(err.message); }
  };

  const handleCancelMatReq = async (requestId: string) => {
    const reason = prompt('Bạn đang hủy phiếu yêu cầu vật tư này. Nhập lý do hủy:');
    if (!reason || reason.trim().length < 5) {
      handleError('Lý do hủy phải từ 5 ký tự trở lên.');
      return;
    }
    try {
      await projectService.cancelMaterialRequest(requestId, reason);
      handleSuccess('Đã hủy phiếu yêu cầu vật tư.');
    } catch (err: any) { handleError(err.message); }
  };

  const handleConfirmReceived = async (requestId: string) => {
    try {
      await projectService.confirmMaterialReceived(requestId, user?.name || 'Leader');
      handleSuccess('Đã xác nhận nhận đủ vật tư cho công việc này.');
    } catch (err: any) { handleError(err.message); }
  };

  // ── CRUD Handlers ─────────────────────────────────────



  const handleDeletePhase = async (phaseId: string, phaseName: string) => {
    const phaseTasks = tasks.filter(t => t.phaseId === phaseId);
    if (phaseTasks.some(t => t.progress > 0)) {
      handleError(`Không thể xóa Phase "${phaseName}" vì bên trong có Task đã ghi nhận tiến độ.`);
      return;
    }
    if (!window.confirm(`Xác nhận xóa Phase "${phaseName}" và toàn bộ Task chưa bắt đầu bên trong?`)) return;
    try {
      await projectService.deletePhase(phaseId);
      if (selectedTask && tasks.find(t => t.id === selectedTaskId)?.phaseId === phaseId) setSelectedTaskId(null);
      handleSuccess(`Đã xóa Phase "${phaseName}".`);
    } catch (err: any) { handleError(err.message || 'Lỗi khi xóa Phase.'); }
  };

  const handleReorderPhase = async (phaseId: string, direction: 'up' | 'down') => {
    try {
      await projectService.reorderPhase(projectId, phaseId, direction);
      loadWBSData();
    } catch (err: any) { handleError(err.message || 'Lỗi khi sắp xếp.'); }
  };



  const handleDeleteTask = async (taskId: string, taskName: string) => {
    if (!window.confirm(`Xác nhận xóa hẳn công việc "${taskName}"?`)) return;
    try {
      await projectService.deleteTask(taskId);
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      handleSuccess(`Đã xóa Task "${taskName}".`);
    } catch (err: any) { handleError(err.message || 'Lỗi khi xóa Task.'); }
  };

  const handleReorderTask = async (phaseId: string, taskId: string, direction: 'up' | 'down') => {
    try {
      await projectService.reorderTask(phaseId, taskId, direction);
      loadWBSData();
    } catch (err: any) { handleError(err.message || 'Lỗi khi sắp xếp.'); }
  };

  const handleObsolete = async () => {
    const reason = prompt('Nhập lý do hủy bỏ công việc này:');
    if (!reason || reason.trim().length < 5) { handleError('Lý do hủy bỏ không hợp lệ (ít nhất 5 ký tự).'); return; }
    try {
      await projectService.cancelTask(selectedTask!.id, reason, user?.name || 'User');
      handleSuccess('Đã đánh dấu hủy bỏ công việc.');
      setSelectedTaskId(null);
      setIsDetailOpen(false);
    } catch (err: any) { handleError(err.message); }
  };

  const handleActivateProject = async () => {
    if (!window.confirm('Kích hoạt dự án sẽ đưa vào vận hành thực tế. Bạn có chắc chắn WBS đã hoàn thiện chưa?')) return;
    try {
      await projectService.activateProject(projectId);
      handleSuccess('Dự án đã được Kích hoạt thành công!');
    } catch (err: any) { handleError(err.message); }
  };


  const menuItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '7px 12px', fontSize: '0.82rem', cursor: 'pointer',
    color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap',
    transition: 'background 0.1s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Alerts */}
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

      {/* Draft Status Banner */}
      {project?.status === 'draft' && (
        <div className="animate-fade-in" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', color: '#92400e'
        }}>
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              Dự án đang ở trạng thái BẢN NHÁP (DRAFT)
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Hãy thêm thành viên, tạo cấu trúc WBS và đảm bảo Hạn chót công việc phải lớn hơn hoặc bằng Ngày bắt đầu dự án ({project.startDate}), sau đó bấm Kích hoạt để bắt đầu thi công.
            </p>
          </div>
          {isTPKTOrPL && (
            <button
              onClick={handleActivateProject}
              className="btn btn-primary animate-pulse"
              style={{ fontWeight: 600, padding: '8px 20px' }}
            >
              🚀 Kích hoạt Dự án
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Cơ cấu phân rã công việc (WBS)</h3>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
            Số thứ tự được hiển thị trước tên · Nhấn ▲▼ để sắp xếp lại · Click <strong>⋮</strong> để đổi tên / xóa
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => navigate(`/projects/${projectId}/drawing`)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '8px 16px', flexShrink: 0,
              border: project?.drawingUrl ? '1px solid hsl(var(--border))' : '1px dashed #d97706',
              borderRadius: 'var(--radius-sm)',
              background: project?.drawingUrl ? 'hsl(var(--bg-card))' : '#fef3c7',
              color: project?.drawingUrl ? 'hsl(var(--text-primary))' : '#b45309',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget;
              b.style.background = project?.drawingUrl ? 'hsl(var(--border-light))' : '#fde68a';
            }}
            onMouseLeave={e => {
              const b = e.currentTarget;
              b.style.background = project?.drawingUrl ? 'hsl(var(--bg-card))' : '#fef3c7';
            }}
          >
            <FileText size={15} />
            <span>Xem Bản vẽ {project?.drawingUrl ? '' : '(Chưa có)'}</span>
          </button>
          <button
            onClick={() => navigate(`/projects/${projectId}/gantt`)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '8px 16px', flexShrink: 0,
              border: '1px solid hsl(var(--primary) / 0.4)',
              borderRadius: 'var(--radius-sm)',
              background: 'hsl(var(--primary-glow))',
              color: 'hsl(var(--primary))',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'hsl(var(--primary))'; b.style.color = '#fff'; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'hsl(var(--primary-glow))'; b.style.color = 'hsl(var(--primary))'; }}
          >
            <BarChart2 size={15} />
            <span>Xem Gantt Chart</span>
          </button>
        </div>
      </div>

      <div>

        {/* ─── Left: WBS Tree ─────────────────────────────── */}
        <div className="card" style={{ padding: '20px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
            Sơ đồ hình cây Phase → Task
          </h4>

          {loading ? (
            <div style={{ textAlign: 'center', margin: 'auto', color: 'hsl(var(--text-muted))' }}>Đang tải...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>

              {phases.length === 0 && !isCreatePhaseOpen && (
                <div style={{ textAlign: 'center', margin: 'auto', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
                  Chưa có dữ liệu WBS. Nhấn "+ Thêm Phase" để bắt đầu.
                </div>
              )}

              {/* ═══ PHASE ROWS ═════════════════════════════════ */}
              {phases.map((ph, phaseIndex) => {
                const topLevelTasks = tasks
                  .filter(t => t.phaseId === ph.id && !t.parentTaskId)
                  .map((t, i) => ({ ...t, sortOrder: t.sortOrder ?? (i + 1) }))
                  .sort((a, b) => a.sortOrder - b.sortOrder);

                const validTopLevelTasks = topLevelTasks.filter(t => t.status !== 'obsolete');
                const phaseProgress = validTopLevelTasks.length > 0
                  ? Math.round(validTopLevelTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / validTopLevelTasks.length)
                  : 0;

                const allPhaseTasks = tasks.filter(t => t.phaseId === ph.id);
                const phaseTasks: WBSTask[] = [];
                topLevelTasks.forEach(parent => {
                  phaseTasks.push(parent);
                  const children = allPhaseTasks
                    .filter(t => t.parentTaskId === parent.id)
                    .map((t, i) => ({ ...t, sortOrder: t.sortOrder ?? (i + 1) }))
                    .sort((a, b) => a.sortOrder - b.sortOrder);
                  phaseTasks.push(...children);
                });
                const isExpanded = expandedPhases[ph.id];
                const isFrozen = ph.status === 'frozen';
                const readyForAcceptance = isPhaseReadyForAcceptance(ph.id) && !isFrozen;
                const isHovered = hoveredPhaseId === ph.id;
                const showMenu = phaseMenuId === ph.id;
                const isFirstPhase = phaseIndex === 0;
                const isLastPhase = phaseIndex === phases.length - 1;

                return (
                  <div key={ph.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>

                    {/* Phase row */}
                    <div
                      onMouseEnter={() => setHoveredPhaseId(ph.id)}
                      onMouseLeave={() => setHoveredPhaseId(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '7px 8px',
                        backgroundColor: isFrozen ? 'hsl(var(--success-glow) / 0.08)' : isHovered ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-main) / 0.5)',
                        borderRadius: 'var(--radius-sm)',
                        border: isFrozen ? '1px solid hsl(var(--success) / 0.2)' : isHovered ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid hsl(var(--border))',
                        fontWeight: 600, fontSize: '0.9rem',
                        transition: 'all 0.13s ease',
                        position: 'relative',
                      }}
                    >
                      {/* Order number + ▲▼ buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '18px' }}>
                        {canEdit && (isHovered || isFirstPhase && isLastPhase) ? (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); handleReorderPhase(ph.id, 'up'); }}
                              disabled={isFirstPhase}
                              title="Di chuyển lên"
                              style={{ background: 'none', border: 'none', cursor: isFirstPhase ? 'not-allowed' : 'pointer', padding: 0, color: isFirstPhase ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                            >
                              <ChevronUp size={11} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleReorderPhase(ph.id, 'down'); }}
                              disabled={isLastPhase}
                              title="Di chuyển xuống"
                              style={{ background: 'none', border: 'none', cursor: isLastPhase ? 'not-allowed' : 'pointer', padding: 0, color: isLastPhase ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                            >
                              <ChevronDown size={11} />
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(var(--text-muted))', lineHeight: 1.2, textAlign: 'center' }}>
                            {phaseIndex + 1}
                          </span>
                        )}
                      </div>

                      {/* Collapse toggle */}
                      <button onClick={() => togglePhase(ph.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'hsl(var(--text-secondary))', flexShrink: 0 }}>
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>

                      <Folder size={15} style={{ color: isFrozen ? 'hsl(var(--success))' : 'hsl(var(--primary))', flexShrink: 0 }} />

                      {/* Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden', flexWrap: 'wrap' }}>
                        <span
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isFrozen ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))', textDecoration: isFrozen ? 'line-through' : 'none', cursor: canEdit && !isFrozen && phaseProgress === 0 ? 'pointer' : 'default' }}
                          title={canEdit && !isFrozen && phaseProgress === 0 ? "Double-click để chỉnh sửa" : ""}
                          onDoubleClick={() => { if (canEdit && !isFrozen && phaseProgress === 0) { setSelectedPhaseForEdit(ph); setIsEditPhaseOpen(true); setPhaseMenuId(null); } }}
                        >
                          {ph.name}
                        </span>

                        {ph.startDate && ph.endDate && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'hsl(var(--text-muted))',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              border: '1px solid hsl(var(--border))',
                              padding: '1px 5px',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            📅 {ph.startDate} - {ph.endDate}
                          </span>
                        )}

                        {ph.materials && ph.materials.length > 0 && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'hsl(var(--primary))',
                              backgroundColor: 'hsl(var(--primary-glow))',
                              padding: '1px 5px',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 'normal',
                              cursor: 'help',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid hsl(var(--primary) / 0.15)'
                            }}
                            title={ph.materials.map(m => `${m.name}: ${m.quantity} ${m.unit}`).join(', ')}
                          >
                            📦 {ph.materials.length} vật tư
                          </span>
                        )}

                        {materialRequests.filter(r => r.phaseId === ph.id && !r.taskId).map(r => (
                          <span
                            key={r.id}
                            className={`badge badge-${r.status === 'approved' || r.status === 'disbursed' || r.status === 'received' ? 'success' :
                              r.status === 'rejected' ? 'danger' : 'warning'
                              }`}
                            style={{ fontSize: '0.62rem', padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}
                          >
                            Yêu cầu vật tư: {
                              r.status === 'pending_leader' ? 'Chờ Leader' :
                                r.status === 'pending_tpkt' ? 'Chờ TPKT' :
                                  r.status === 'pending_accountant' ? 'Chờ KT' :
                                    r.status === 'pending_director' ? 'Chờ GĐ duyệt' :
                                      r.status === 'pending_disbursement' ? 'Chờ giải ngân' :
                                        r.status === 'disbursed' ? 'Đã giải ngân' :
                                          r.status === 'approved' ? 'Đã duyệt' :
                                            r.status === 'received' ? 'Đã nhận' : 'Bị từ chối'
                            }
                            {r.status === 'rejected' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedResubmitRequest(r);
                                  setIsResubmitOpen(true);
                                }}
                                style={{
                                  marginLeft: '4px',
                                  background: 'hsl(var(--primary))',
                                  border: 'none',
                                  borderRadius: 'var(--radius-sm)',
                                  color: '#fff',
                                  padding: '0px 4px',
                                  cursor: 'pointer',
                                  fontSize: '0.55rem',
                                  fontWeight: 'bold',
                                  lineHeight: 1.2
                                }}
                                title="Sửa & Gửi lại"
                              >
                                Sửa & Gửi lại
                              </button>
                            )}
                            {r.status === 'pending_accountant' && isPL && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelMatReq(r.id);
                                }}
                                style={{
                                  marginLeft: '4px',
                                  background: 'hsl(var(--danger))',
                                  border: 'none',
                                  borderRadius: 'var(--radius-sm)',
                                  color: '#fff',
                                  padding: '0px 4px',
                                  cursor: 'pointer',
                                  fontSize: '0.55rem',
                                  fontWeight: 'bold',
                                  lineHeight: 1.2
                                }}
                                title="Hủy phiếu"
                              >
                                Hủy phiếu
                              </button>
                            )}
                            {r.status === 'pending_accountant' && isPL && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelMatReq(r.id);
                                }}
                                style={{
                                  marginLeft: '4px',
                                  background: 'hsl(var(--danger))',
                                  border: 'none',
                                  borderRadius: 'var(--radius-sm)',
                                  color: '#fff',
                                  padding: '0px 4px',
                                  cursor: 'pointer',
                                  fontSize: '0.55rem',
                                  fontWeight: 'bold',
                                  lineHeight: 1.2
                                }}
                                title="Hủy phiếu"
                              >
                                Hủy phiếu
                              </button>
                            )}
                          </span>
                        ))}
                      </div>


                      {/* Badge */}
                      {isFrozen ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '1px 5px', cursor: 'pointer' }} onClick={() => navigate(`/projects/${projectId}/phases/${ph.id}/acceptance`)}>Đã nghiệm thu</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--success))', minWidth: '28px', textAlign: 'right' }}>100%</span>
                            <div style={{ width: '50px', height: '6px', backgroundColor: 'hsl(var(--border))', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: '100%', height: '100%', backgroundColor: 'hsl(var(--success))' }} />
                            </div>
                          </div>
                        </div>
                      ) : readyForAcceptance ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span className="badge badge-warning animate-fade-in" style={{ fontSize: '0.6rem', padding: '1px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                            onClick={() => { if (isTPKTOrPL) navigate(`/projects/${projectId}/phases/${ph.id}/acceptance`); }}>
                            <FileSignature size={9} /><span>Chờ nghiệm thu</span>
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--warning-text))', minWidth: '28px', textAlign: 'right' }}>{phaseProgress}%</span>
                            <div style={{ width: '50px', height: '6px', backgroundColor: 'hsl(var(--border))', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${phaseProgress}%`, height: '100%', backgroundColor: 'hsl(var(--warning-text))', transition: 'width 0.3s ease' }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>{phaseTasks.length} việc</span>
                          {phaseTasks.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: phaseProgress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-secondary))', minWidth: '28px', textAlign: 'right' }}>
                                {phaseProgress}%
                              </span>
                              <div style={{ width: '50px', height: '6px', backgroundColor: 'hsl(var(--border))', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${phaseProgress}%`, height: '100%', backgroundColor: phaseProgress === 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))', transition: 'width 0.3s ease' }} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons (hover) */}
                      {canEdit && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', opacity: isHovered || showMenu ? 1 : 0, transition: 'opacity 0.13s', flexShrink: 0 }}>
                          {/* + Task */}
                          {!isFrozen && (
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedPhases(prev => ({ ...prev, [ph.id]: true })); setSelectedPhaseForTask(ph.id); setParentTaskForNew(undefined); setParentDeadlineForNew(ph.deadline); setIsCreateTaskOpen(true); }}
                              title="Thêm Task"
                              style={{ background: 'hsl(var(--primary))', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0 }}
                            >
                              <FilePlus2 size={11} />
                            </button>
                          )}

                          {/* ⋮ menu */}
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={e => { e.stopPropagation(); setPhaseMenuId(showMenu ? null : ph.id); setTaskMenuId(null); }}
                              title="Tùy chọn"
                              style={{ background: 'transparent', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0 }}
                            >
                              <MoreVertical size={11} />
                            </button>

                            {showMenu && (
                              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '24px', zIndex: 200, backgroundColor: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: '160px', overflow: 'hidden' }}>
                                {!isFrozen && phaseProgress === 0 && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setSelectedPhaseForEdit(ph); setIsEditPhaseOpen(true); setPhaseMenuId(null); }}
                                  >
                                    <Pencil size={13} style={{ color: 'hsl(var(--primary))' }} />
                                    <span>Chỉnh sửa Phase</span>
                                  </div>
                                )}
                                {!isFrozen && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setPhaseMenuId(null); navigate(`/projects/${projectId}/phases/${ph.id}/material-requests`); }}
                                  >
                                    <FileText size={13} style={{ color: 'hsl(var(--primary))' }} />
                                    <span>Yêu cầu vật tư Phase</span>
                                  </div>
                                )}
                                {!isFrozen && isPL && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--warning-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setPhaseMenuId(null); setSelectedPhaseForMatReq(ph); setCreateMatReqType('emergency'); setIsPhaseMatReqOpen(true); }}
                                  >
                                    <AlertTriangle size={13} style={{ color: 'hsl(var(--warning))' }} />
                                    <span style={{ color: 'hsl(var(--warning-hover))' }}>Mua ngoài khẩn cấp Phase</span>
                                  </div>
                                )}
                                {!isFrozen && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setPhaseMenuId(null); setSelectedPhaseForBOQ(ph); setIsBOQOpen(true); }}
                                  >
                                    <Box size={13} style={{ color: 'hsl(var(--primary))' }} />
                                    <span>Cập nhật bảng BOQ</span>
                                  </div>
                                )}

                                {!isFrozen && materialRequests.some(r => r.phaseId === ph.id && r.status === 'pending_leader') && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => {
                                      setPhaseMenuId(null);
                                      // Mở modal duyệt đề xuất (Ta sẽ định nghĩa sau)
                                      setSelectedPhaseForMatReq(ph);
                                      setIsLeaderApprovalOpen(true);
                                    }}
                                  >
                                    <CheckCircle size={13} style={{ color: 'hsl(var(--warning))' }} />
                                    <span>Duyệt Yêu cầu từ SE</span>
                                  </div>
                                )}

                                {!isFrozen && (
                                  <div
                                    style={{ ...menuItemStyle, color: 'hsl(var(--danger))' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--danger-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setPhaseMenuId(null); handleDeletePhase(ph.id, ph.name); }}
                                  >
                                    <Trash2 size={13} />
                                    <span>Xóa Phase</span>
                                  </div>
                                )}
                                {isFrozen && (
                                  <div style={{ ...menuItemStyle, cursor: 'default', opacity: 0.5, fontSize: '0.78rem' }}>
                                    Phase đã nghiệm thu (khóa)
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Task children */}
                    {isExpanded && (
                      <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px dashed hsl(var(--border-light))', marginLeft: '18px', marginTop: '2px' }}>
                        {phaseTasks.map((t, taskIndex) => {
                          const isSelected = selectedTaskId === t.id;
                          const isHoveredTask = hoveredTaskId === t.id;

                          const showTaskMenu = taskMenuId === t.id;
                          // Task is locked for rename/delete once it has been worked on
                          const isWorkedOn = t.progress > 0 || t.history.length > 0;
                          const isFirstTask = taskIndex === 0;
                          const isLastTask = taskIndex === phaseTasks.length - 1;

                          return (
                            <div
                              key={t.id}
                              onMouseEnter={() => setHoveredTaskId(t.id)}
                              onMouseLeave={() => setHoveredTaskId(null)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '7px',
                                padding: '6px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: isSelected ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid transparent',
                                backgroundColor: isSelected ? 'hsl(var(--primary-glow))' : isHoveredTask ? 'hsl(var(--bg-main) / 0.6)' : 'transparent',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                transition: 'all var(--transition-fast)',
                                opacity: t.status === 'obsolete' ? 0.6 : 1,
                                position: 'relative',
                                marginLeft: t.parentTaskId ? '28px' : '0px',
                              }}
                              onClick={() => {
                                setSelectedTaskId(t.id);
                                setIsDetailOpen(true);
                              }}
                            >
                              {/* Task order number + ▲▼ */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '16px' }} onClick={e => e.stopPropagation()}>
                                {canEdit && !isFrozen && t.status !== 'obsolete' && isHoveredTask && !t.parentTaskId ? (
                                  <>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleReorderTask(ph.id, t.id, 'up'); }}
                                      disabled={isFirstTask}
                                      title="Di chuyển lên"
                                      style={{ background: 'none', border: 'none', cursor: isFirstTask ? 'not-allowed' : 'pointer', padding: 0, color: isFirstTask ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                                    >
                                      <ChevronUp size={10} />
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleReorderTask(ph.id, t.id, 'down'); }}
                                      disabled={isLastTask}
                                      title="Di chuyển xuống"
                                      style={{ background: 'none', border: 'none', cursor: isLastTask ? 'not-allowed' : 'pointer', padding: 0, color: isLastTask ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                                    >
                                      <ChevronDown size={10} />
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'hsl(var(--text-muted))', opacity: 0.7 }}>
                                    {taskIndex + 1}
                                  </span>
                                )}
                              </div>

                              {t.parentTaskId ? (
                                <CornerDownRight size={12} style={{ color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))', flexShrink: 0 }} />
                              ) : (
                                <FileText size={13} style={{ color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))', flexShrink: 0 }} />
                              )}

                              {/* Name */}
                              <span
                                style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 600 : 500, color: t.status === 'obsolete' ? 'hsl(var(--text-muted))' : isSelected ? 'hsl(var(--primary-hover))' : 'hsl(var(--text-secondary))', textDecoration: (isFrozen || t.status === 'obsolete') ? 'line-through' : 'none', cursor: canEdit && !isFrozen && t.status !== 'obsolete' && !isWorkedOn ? 'pointer' : 'default' }}
                                title={isWorkedOn && t.status !== 'obsolete' ? 'Task đã có tiến độ — không thể chỉnh sửa. Dùng "Hủy việc" và tạo lại.' : canEdit && !isFrozen && t.status !== 'obsolete' ? 'Double-click để chỉnh sửa' : ''}
                                onDoubleClick={e => { e.stopPropagation(); if (canEdit && !isFrozen && t.status !== 'obsolete' && !isWorkedOn) { setSelectedTaskForEdit(t); setIsEditTaskOpen(true); setTaskMenuId(null); } }}
                              >
                                {t.name}
                              </span>

                              {t.status !== 'obsolete' && t.progress < 100 && (() => {
                                const currentDate = new Date().toISOString().split('T')[0];
                                const taskDeadline = t.deadline ? new Date(t.deadline).toISOString().split('T')[0] : '9999-12-31';
                                const start = new Date(project?.startDate || Date.now());
                                const end = new Date(t.deadline || project?.endDate || Date.now());
                                const today = new Date();

                                const totalMs = end.getTime() - start.getTime();
                                const passedMs = today.getTime() - start.getTime();
                                const expected = totalMs > 0 ? Math.min(100, Math.max(0, (passedMs / totalMs) * 100)) : 0;

                                if (currentDate > taskDeadline) {
                                  return <span style={{ marginLeft: '8px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: 'hsl(var(--danger) / 0.15)', color: 'hsl(var(--danger))', borderRadius: '4px', border: '1px solid hsl(var(--danger) / 0.3)', whiteSpace: 'nowrap' }} title={`Đã trễ hạn so với ${taskDeadline}`}>🚨 Trễ hạn</span>;
                                } else if (t.progress < expected - 1) {
                                  return <span style={{ marginLeft: '8px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: 'hsl(var(--warning) / 0.15)', color: 'hsl(var(--warning))', borderRadius: '4px', border: '1px solid hsl(var(--warning) / 0.3)', whiteSpace: 'nowrap' }} title={`Kỳ vọng: ${Math.round(expected)}% - Hiện tại: ${t.progress}%`}>⚠️ Nguy cơ</span>;
                                }
                                return null;
                              })()}

                              {t.assignedTo && t.assignedName && (
                                <div style={{ display: 'flex', alignItems: 'center', marginRight: '8px', flexShrink: 0 }}>
                                  {t.assignedTo.split(',').map((id, index) => {
                                    const names = t.assignedName ? t.assignedName.split(', ') : [];
                                    const name = names[index] || 'Kỹ sư';
                                    const initials = getInitials(name);
                                    const bgColor = getAvatarColor(id);
                                    return (
                                      <div
                                        key={id}
                                        title={name}
                                        style={{
                                          width: '22px',
                                          height: '22px',
                                          borderRadius: '50%',
                                          backgroundColor: bgColor,
                                          color: '#fff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '0.65rem',
                                          fontWeight: 700,
                                          border: '2px solid hsl(var(--bg-card))',
                                          marginLeft: index > 0 ? '-6px' : '0',
                                          boxShadow: 'var(--shadow-sm)',
                                          cursor: 'help',
                                        }}
                                      >
                                        {initials}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {t.status === 'obsolete' && (
                                <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '1px 4px', flexShrink: 0 }}>Đã hủy</span>
                              )}



                              {/* Task context menu — only show ⋮ when task has NOT been worked on */}
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))', flexShrink: 0 }}>
                                {t.progress}%
                              </span>

                              {/* Task context menu */}
                              {canEdit && !isFrozen && t.status !== 'obsolete' && (
                                  <div style={{ position: 'relative', opacity: isHoveredTask || showTaskMenu ? 1 : 0, transition: 'opacity 0.13s', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={e => { e.stopPropagation(); setTaskMenuId(showTaskMenu ? null : t.id); setPhaseMenuId(null); }}
                                      title="Tùy chọn"
                                      style={{ background: 'transparent', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', padding: 0 }}
                                    >
                                      <MoreVertical size={10} />
                                    </button>

                                    {showTaskMenu && (
                                      <div style={{ position: 'absolute', right: 0, top: '22px', zIndex: 200, backgroundColor: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: '155px', overflow: 'hidden' }}>
                                        <div
                                          style={menuItemStyle}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { setSelectedTaskForEdit(t); setIsEditTaskOpen(true); setTaskMenuId(null); }}
                                        >
                                          <Pencil size={12} style={{ color: 'hsl(var(--primary))' }} /><span>Chỉnh sửa Task</span>
                                        </div>

                                        <div
                                          style={menuItemStyle}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--warning-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { setTaskMenuId(null); navigate(`/projects/${projectId}/tasks/${t.id}/incidents`); }}
                                        >
                                          <AlertTriangle size={12} style={{ color: 'hsl(var(--warning))' }} /><span>Báo cáo sự cố</span>
                                        </div>

                                        <div
                                          style={{ ...menuItemStyle, display: t.parentTaskId ? 'none' : 'flex' }}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { setTaskMenuId(null); setSelectedPhaseForTask(ph.id); setParentTaskForNew(t.id); setParentDeadlineForNew(t.deadline); setIsCreateTaskOpen(true); }}
                                        >
                                          <FilePlus2 size={12} style={{ color: 'hsl(var(--primary))' }} /><span>Thêm Task con</span>
                                        </div>

                                        <div
                                          style={{ ...menuItemStyle, color: 'hsl(var(--danger))' }}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--danger-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { setTaskMenuId(null); handleDeleteTask(t.id, t.name); }}
                                        >
                                          <Trash2 size={12} /><span>Xóa hẳn Task</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                              )}
                            </div>
                          );
                        })}

                        {phaseTasks.length === 0 && (
                          <div style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Chưa có task nào.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Add Phase button (Modal trigger) ─────────── */}
              {canEdit && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    onClick={() => setIsCreatePhaseOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '8px 12px', border: '1px dashed hsl(var(--border-light))', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer', color: 'hsl(var(--text-muted))', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.15s ease' }}
                    onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'hsl(var(--primary))'; b.style.color = 'hsl(var(--primary))'; b.style.background = 'hsl(var(--primary-glow))'; }}
                    onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'hsl(var(--border-light))'; b.style.color = 'hsl(var(--text-muted))'; b.style.background = 'transparent'; }}
                  >
                    <FolderPlus size={14} /><span>+ Thêm Phase mới</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ─── Task detail Popup Modal ───────────────────── */}
      {isDetailOpen && selectedTask && (
        <Modal isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setSelectedTaskId(null); }} title="Chi tiết Công việc đang chọn" maxWidth="700px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedTask.name}</h3>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                Giai đoạn: <strong>{selectedTaskPhase?.name || 'Không xác định'}</strong>
                {selectedTaskPhase?.status === 'frozen' && (
                  <span style={{ color: 'hsl(var(--danger))', marginLeft: '6px', fontWeight: 600 }}>[ĐÃ NGHIỆM THU - ĐÓNG BĂNG]</span>
                )}
              </p>
            </div>

            {/* Check subtasks */}
            {(() => {
              const hasChildren = tasks.some(t => t.parentTaskId === selectedTask.id && t.status !== 'obsolete');
              if (hasChildren) {
                return (
                  <div style={{ padding: '10px 14px', backgroundColor: 'hsl(var(--primary-glow))', border: '1px solid hsl(var(--primary) / 0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <strong style={{ color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={16} /> Công việc này có chứa công việc con
                    </strong>
                    <p style={{ margin: '4px 0 0 0', color: 'hsl(var(--text-secondary))' }}>Tiến độ của công việc này sẽ được tính trung bình tự động dựa trên mức độ hoàn thành của các công việc con bên trong nó.</p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Progress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Tiến độ hoàn thành:</span>
                <span style={{ color: 'hsl(var(--primary))' }}>{selectedTask.progress}%</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'hsl(var(--border))', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: `${selectedTask.progress}%`, height: '100%', backgroundColor: selectedTask.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Assignee + Start Date + Deadline */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
                  <User size={14} />KỸ SƯ PHỤ TRÁCH
                </span>
                {selectedTask.assignedTo && selectedTask.assignedName ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    {selectedTask.assignedTo.split(',').map((id, index) => {
                      const names = selectedTask.assignedName ? selectedTask.assignedName.split(', ') : [];
                      const name = names[index] || 'Kỹ sư';
                      const initials = getInitials(name);
                      const bgColor = getAvatarColor(id);
                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor: bgColor,
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                            }}
                          >
                            {initials}
                          </div>
                          <strong style={{ fontSize: '0.85rem', color: 'hsl(var(--text-primary))' }}>{name}</strong>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>Chưa phân công</strong>
                )}
              </div>
              <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
                  <Calendar size={14} />NGÀY BẮT ĐẦU
                </span>
                <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>{selectedTask.startDate || 'Chưa xác định'}</strong>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
                  <Calendar size={14} />HẠN HOÀN THÀNH
                </span>
                <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>{selectedTask.deadline}</strong>
              </div>
            </div>

            {/* Actions */}
            {project?.status === 'paused' || project?.status === 'done' ? (
              <div style={{ display: 'flex', gap: '8px', backgroundColor: 'hsl(var(--danger-glow))', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--danger) / 0.2)', fontSize: '0.85rem', color: 'hsl(var(--danger))' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>Dự án đang tạm dừng hoặc đã hoàn thành. Không thể thao tác.</span>
              </div>
            ) : selectedTaskPhase?.status !== 'frozen' && selectedTask.status !== 'obsolete' ? (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {isTPKTOrPL && (
                  <>
                    <button onClick={() => setIsAssignOpen(true)} className="btn btn-secondary" style={{ fontSize: '0.85rem', flex: 1, minWidth: '120px' }}>
                      <UserPlus size={16} /><span>Phân công</span>
                    </button>
                    <button onClick={handleObsolete} className="btn" style={{ fontSize: '0.85rem', flex: 1, minWidth: '120px', backgroundColor: 'hsl(var(--bg-main))', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.3)' }}>
                      <Trash2 size={16} /><span>Hủy việc</span>
                    </button>
                  </>
                )}
                {(user?.id === selectedTask.assignedTo || isTPKTOrPL) && !tasks.some(t => t.parentTaskId === selectedTask.id && t.status !== 'obsolete') && (
                  <button onClick={() => setIsLogOpen(true)} className="btn btn-primary" style={{ fontSize: '0.85rem', flex: 1, minWidth: '140px' }}>
                    <TrendingUp size={16} /><span>Cập nhật Nhật ký</span>
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'hsl(var(--success-glow))', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--success) / 0.2)', fontSize: '0.85rem', color: 'hsl(var(--success))' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <CheckCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{selectedTask.status === 'obsolete' ? 'Công việc đã bị hủy bỏ.' : 'Phase này đã được nghiệm thu và khóa tiến độ.'}</span>
                </div>
                {selectedTask.status !== 'obsolete' && (
                  <button onClick={() => navigate(`/projects/${projectId}/phases/${selectedTask.phaseId}/acceptance`)} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 8px', width: 'fit-content', marginTop: '4px', borderColor: 'hsl(var(--success))', color: 'hsl(var(--success))', backgroundColor: 'transparent' }}>
                    Xem chi tiết & Hủy nghiệm thu
                  </button>
                )}
              </div>
            )}

            {/* SE Đề xuất vật tư cho Leader */}
            <div style={{ backgroundColor: 'hsl(var(--primary-glow) / 0.3)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <Box size={16} style={{ color: 'hsl(var(--primary))' }} />
                  Đề xuất vật tư cho công việc
                </h4>
                {selectedTaskPhase?.status !== 'frozen' && selectedTask.status !== 'obsolete' && project?.status !== 'done' && (
                  <button
                    onClick={() => { setCreateMatReqType('normal'); setIsCreateMatReqOpen(true); }}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    + Đề xuất Vật tư
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {materialRequests.filter(r => r.taskId === selectedTask.id && !r.taskName?.includes('[Rework]')).length > 0 ? (
                  materialRequests.filter(r => r.taskId === selectedTask.id && !r.taskName?.includes('[Rework]')).map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '8px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{r.items.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}</span>
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{r.date} - {r.requesterName}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        {r.status === 'pending_leader' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ Leader duyệt</span>}
                        {r.status === 'approved_by_leader' && <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>Đã tổng hợp</span>}
                        {r.status === 'pending_tpkt' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ TPKT</span>}
                        {r.status === 'pending_accountant' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ Kế toán</span>}
                        {r.status === 'pending_director' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ Giám đốc</span>}
                        {r.status === 'approved' && <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>Đã duyệt</span>}
                        {r.status === 'rejected' && <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>Từ chối</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '10px' }}>
                    Chưa có đề xuất vật tư nào cho công việc này.
                  </div>
                )}
              </div>
            </div>

            {/* Step 5: Material Request for Rework */}
            {selectedTask.isRework && (
              <div style={{ backgroundColor: 'hsl(var(--danger-glow) / 0.5)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--danger) / 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--danger))', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                    <AlertTriangle size={16} />
                    YÊU CẦU VẬT TƯ BÙ ĐẮP SỰ CỐ (STEP 5)
                  </h4>
                  <button
                    onClick={() => { setCreateMatReqType('normal'); setIsCreateMatReqOpen(true); }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '4px 8px', borderColor: 'hsl(var(--danger))', color: 'hsl(var(--danger))' }}
                  >
                    + Tạo Yêu cầu Mới
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {materialRequests.filter(r => r.taskId === selectedTask.id).length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Chưa có yêu cầu vật tư bù đắp nào.</span>
                  ) : (
                    materialRequests.filter(r => r.taskId === selectedTask.id).map(r => {
                      return (
                        <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <strong style={{ fontSize: '0.85rem' }}>{r.items.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                                Lý do: {r.reason || 'Không có'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                              {r.status === 'pending_leader' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ Leader</span>}
                              {r.status === 'pending_tpkt' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ TPKT</span>}
                              {r.status === 'pending_accountant' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ KT</span>}
                              {r.status === 'pending_director' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ GĐ</span>}
                              {r.status === 'approved' && <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>Đã duyệt (Chờ giao)</span>}
                              {r.status === 'received' && <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>Đã nhận vật tư</span>}
                              {r.status === 'rejected' && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                  <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>Bị từ chối</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedResubmitRequest(r);
                                      setIsResubmitOpen(true);
                                    }}
                                    className="btn btn-secondary"
                                    style={{ padding: '1px 4px', fontSize: '0.65rem' }}
                                  >
                                    Sửa & Gửi lại
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            {isPL && r.status === 'pending_leader' && (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); handleApproveByLeader(r.id); }} className="btn btn-primary" style={{ padding: '2px 8px', fontSize: '0.65rem' }}>Duyệt gửi TPKT</button>
                                <button onClick={(e) => { e.stopPropagation(); handleRejectMatReq(r.id); }} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem' }}>Từ chối</button>
                              </>
                            )}
                            {isTPKTOrPL && user?.role !== 'siteengineer' && r.status === 'pending_tpkt' && (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); handleApproveByTPKT(r.id); }} className="btn btn-primary" style={{ padding: '2px 8px', fontSize: '0.65rem' }}>Duyệt gửi KT</button>
                                <button onClick={(e) => { e.stopPropagation(); handleRejectMatReq(r.id); }} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem' }}>Từ chối</button>
                              </>
                            )}
                            {isPL && r.status === 'pending_accountant' && (
                              <button onClick={(e) => { e.stopPropagation(); handleCancelMatReq(r.id); }} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem', color: 'hsl(var(--danger))', borderColor: 'hsl(var(--danger))' }}>Hủy phiếu</button>
                            )}
                            {isPL && r.status === 'approved' && (
                              <button onClick={(e) => { e.stopPropagation(); handleConfirmReceived(r.id); }} className="btn btn-primary" style={{ padding: '2px 8px', fontSize: '0.65rem', backgroundColor: 'hsl(var(--success))', borderColor: 'hsl(var(--success))' }}>Xác nhận đã nhận VT</button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* History logs */}
            <div onClick={() => navigate(`/projects/${projectId}/logs`)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', cursor: 'pointer' }} title="Nhấp để xem nhật ký thi công chi tiết">
              <h5 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                <History size={13} />
                <span>Nhật ký thi công chi tiết (Click để xem) ({selectedTask.history.length})</span>
              </h5>
              <div style={{ maxHeight: '160px', overflowY: 'auto', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', padding: '8px', pointerEvents: 'none' }}>
                {selectedTask.history.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', padding: '12px', display: 'block', textAlign: 'center' }}>Chưa có lịch sử thay đổi nào.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedTask.history.map((h, i) => (
                      <div key={i} style={{ fontSize: '0.75rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', paddingBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--text-muted))' }}>
                          <span>{h.date}</span><strong>{h.oldProgress}% → {h.newProgress}%</strong>
                        </div>
                        <p style={{ color: 'hsl(var(--text-primary))', marginTop: '2px', fontWeight: 500 }}>{h.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Modals ─────────────────────────────────────── */}
      {isAssignOpen && selectedTask && (
        <AssignEngineerModal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} taskId={selectedTask.id} taskName={selectedTask.name} projectId={projectId} onSuccess={handleSuccess} onError={handleError} />
      )}


      {isLogOpen && selectedTask && user && (
        <DailyLogFormModal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} task={selectedTask} engineerId={user.id} engineerName={user.name} onSuccess={handleSuccess} onError={handleError} />
      )}

      {isCreateMatReqOpen && selectedTask && (
        <CreateMaterialRequestModal
          isOpen={isCreateMatReqOpen}
          onClose={() => setIsCreateMatReqOpen(false)}
          task={selectedTask}
          phase={selectedTaskPhase || undefined}
          projectId={projectId}
          user={user}
          isLeader={isPL}
          allMaterialRequests={materialRequests}
          requestType={createMatReqType}
          onSuccess={(msg) => {
            handleSuccess(msg);
            projectService.getMaterialRequests(projectId).then(setMaterialRequests);
          }}
          onError={handleError}
        />
      )}

      {isCreatePhaseOpen && (
        <CreatePhaseModal
          isOpen={isCreatePhaseOpen}
          onClose={() => setIsCreatePhaseOpen(false)}
          projectId={projectId}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {isEditPhaseOpen && selectedPhaseForEdit && (
        <EditPhaseModal
          isOpen={isEditPhaseOpen}
          onClose={() => {
            setIsEditPhaseOpen(false);
            setSelectedPhaseForEdit(null);
          }}
          phase={selectedPhaseForEdit}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {isLeaderApprovalOpen && selectedPhaseForMatReq && (
        <LeaderApprovalModal
          isOpen={isLeaderApprovalOpen}
          onClose={() => {
            setIsLeaderApprovalOpen(false);
            setSelectedPhaseForMatReq(null);
          }}
          phase={selectedPhaseForMatReq}
          projectId={projectId}
          user={user}
          allMaterialRequests={materialRequests}
          onSuccess={(msg) => {
            handleSuccess(msg);
            projectService.getMaterialRequests(projectId).then(setMaterialRequests);
          }}
          onError={handleError}
        />
      )}



      {isResubmitOpen && selectedResubmitRequest && (
        <ResubmitMaterialRequestModal
          isOpen={isResubmitOpen}
          onClose={() => {
            setIsResubmitOpen(false);
            setSelectedResubmitRequest(null);
          }}
          request={selectedResubmitRequest}
          projectId={projectId}
          user={user}
          isLeader={isPL}
          onSuccess={(msg) => {
            handleSuccess(msg);
            projectService.getMaterialRequests(projectId).then(setMaterialRequests);
          }}
          onError={handleError}
        />
      )}
      {/* Create Phase Material Request Modal */}

      {/* Create Phase Material Request Modal */}
      {selectedPhaseForMatReq && (
        <CreateMaterialRequestModal
          isOpen={isPhaseMatReqOpen}
          onClose={() => { setIsPhaseMatReqOpen(false); setSelectedPhaseForMatReq(null); }}
          phase={selectedPhaseForMatReq}
          projectId={projectId}
          user={user}
          isLeader={isPL}
          allMaterialRequests={materialRequests}
          requestType={createMatReqType}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {/* Phase BOQ Modal */}
      {selectedPhaseForBOQ && (
        <PhaseBOQModal
          isOpen={isBOQOpen}
          onClose={() => { setIsBOQOpen(false); setSelectedPhaseForBOQ(null); }}
          phase={selectedPhaseForBOQ}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        projectId={projectId}
        phaseId={selectedPhaseForTask}
        parentTaskId={parentTaskForNew}
        parentDeadline={parentDeadlineForNew}
        members={members}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {/* Edit Task Modal */}
      {isEditTaskOpen && selectedTaskForEdit && (
        <EditTaskModal
          isOpen={isEditTaskOpen}
          onClose={() => {
            setIsEditTaskOpen(false);
            setSelectedTaskForEdit(null);
          }}
          task={selectedTaskForEdit}
          parentDeadline={selectedTaskForEdit.parentTaskId ? tasks.find(t => t.id === selectedTaskForEdit.parentTaskId)?.deadline : undefined}
          members={members}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {/* Adjust Deadline Modal */}
      {adjustingTask && (
        <AdjustDeadlineModal
          isOpen={isAdjustDeadlineOpen}
          onClose={() => { setIsAdjustDeadlineOpen(false); setAdjustingTask(null); }}
          taskId={adjustingTask.id}
          taskName={adjustingTask.name}
          currentDeadline={adjustingTask.deadline}
          user={user?.name || 'User'}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {/* Report Incident Modal */}

    </div>
  );
};

