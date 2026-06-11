import React, { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type { WBSPhase, WBSTask, Project, ProjectMember, MaterialRequest } from '../types/common';
import { WBSContext } from './WBSWorkspace/WBSContext';
import { WBSTree } from './WBSWorkspace/WBSTree';
import { WBSModalsContainer } from './WBSWorkspace/WBSModalsContainer';
import { AlertTriangle, FileText, BarChart2 } from 'lucide-react';


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



  const isTPKTOrPL = user?.role === 'tpkt' || user?.role === 'admin';


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
  

  const currentMember = members.find(m => m.userId === user?.id);
  const isPL = (currentMember ? currentMember.isLeader : false) || user?.role === 'admin' || user?.role === 'tpkt';

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

  
  const handleActivateProject = async () => {
    if (!window.confirm('Kích hoạt dự án sẽ đưa vào vận hành thực tế. Bạn có chắc chắn WBS đã hoàn thiện chưa?')) return;
    try {
      await projectService.activateProject(projectId);
      handleSuccess('Dự án đã được Kích hoạt thành công!');
    } catch (err: any) { handleError(err.message); }
  };


  
  
    const contextValue = {
    projectId, project, phases, tasks, members, user, isTPKTOrPL, isPL, canEdit, materialRequests,
    expandedPhases, togglePhase, setExpandedPhases,
    hoveredPhaseId, setHoveredPhaseId, hoveredTaskId, setHoveredTaskId,
    phaseMenuId, setPhaseMenuId, taskMenuId, setTaskMenuId,
    
    selectedTaskId, setSelectedTaskId,
    isDetailOpen, setIsDetailOpen,
    isAssignOpen, setIsAssignOpen,
    isLogOpen, setIsLogOpen,
    isCreateMatReqOpen, setIsCreateMatReqOpen,
    createMatReqType, setCreateMatReqType,
    isCreatePhaseOpen, setIsCreatePhaseOpen,
    isResubmitOpen, setIsResubmitOpen,
    selectedResubmitRequest, setSelectedResubmitRequest,
    isEditPhaseOpen, setIsEditPhaseOpen,
    selectedPhaseForEdit, setSelectedPhaseForEdit,
    isEditTaskOpen, setIsEditTaskOpen,
    selectedTaskForEdit, setSelectedTaskForEdit,
    isPhaseMatReqOpen, setIsPhaseMatReqOpen,
    isLeaderApprovalOpen, setIsLeaderApprovalOpen,
    selectedPhaseForMatReq, setSelectedPhaseForMatReq,
    isBOQOpen, setIsBOQOpen,
    selectedPhaseForBOQ, setSelectedPhaseForBOQ,
    isCreateTaskOpen, setIsCreateTaskOpen,
    selectedPhaseForTask, setSelectedPhaseForTask,
    parentTaskForNew, setParentTaskForNew,
    parentDeadlineForNew, setParentDeadlineForNew,
    isAdjustDeadlineOpen, setIsAdjustDeadlineOpen,
    adjustingTask, setAdjustingTask,

    handleApproveByLeader, handleApproveByTPKT,
    handleRejectMatReq, handleCancelMatReq, handleConfirmReceived,
    isPhaseReadyForAcceptance, loading, handleSuccess, handleError, handleReorderTask, handleDeleteTask, handleDeletePhase, navigate
  };

  return (
    <WBSContext.Provider value={contextValue}>
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

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Cơ cấu phân rã công việc (WBS)</h3>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
            Số thứ tự được hiển thị trước tên · Nhấn ▲▼ để sắp xếp lại · Click <strong>⋮</strong> để đổi tên / xóa
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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

      <div className="w-full overflow-x-auto pb-4">
        <div style={{ minWidth: '700px' }}>
          <WBSTree />
        </div>
      </div>



            <WBSModalsContainer />
    </div>
    </WBSContext.Provider>
  );
};
