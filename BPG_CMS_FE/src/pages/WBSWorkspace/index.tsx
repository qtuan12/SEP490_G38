import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { wbsService } from '../../services/wbsService';
import { useNotification } from '../../context/NotificationContext';
import type { WBSPhase, WBSTask, MaterialRequest } from '../../types/common';
import { WBSContext } from './components/WBSContext';
import { WBSTree } from './components/WBSTree';
import { WBSModalsContainer } from './components/WBSModalsContainer';
import { AlertTriangle, FileText, BarChart2, History } from 'lucide-react';
import { Button } from '../../components/ui';


interface WBSWorkspaceProps {
  projectId: string;
}

export const WBSWorkspace: React.FC<WBSWorkspaceProps> = ({ projectId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { connection } = useNotification();

  const queryClient = useQueryClient();

  const { data: wbsDataAll, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['wbsDataAll', projectId],
    queryFn: async () => {
      const [wbsData, allProjs, memberList, mr] = await Promise.all([
        wbsService.getWbsDataFlattened(projectId),
        projectService.getProjects(),
        projectService.getMembers(projectId),
        projectService.getAllMaterialRequests()
      ]);
      return {
        wbsData,
        project: allProjs.find(p => p.id === projectId) || null,
        memberList,
        materialRequests: mr
      };
    }
  });

  const phases = wbsDataAll?.wbsData.phases || [];
  const tasks = wbsDataAll?.wbsData.tasks || [];
  const project = wbsDataAll?.project || null;
  const members = wbsDataAll?.memberList || [];
  const materialRequests = wbsDataAll?.materialRequests || [];
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // When queryError changes, update the error state
  useEffect(() => {
    if (queryError) {
      setError((queryError as any).message || 'Lỗi khi tải cơ cấu WBS.');
    }
  }, [queryError]);

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

  const [isObsoleteOpen, setIsObsoleteOpen] = useState(false);

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

  // ── ADJUST Progress modal state ───────────────────────────
  const [isAdjustProgressOpen, setIsAdjustProgressOpen] = useState(false);



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


  useEffect(() => {
    if (wbsDataAll?.wbsData.phases) {
      setExpandedPhases(prev => {
        if (Object.keys(prev).length === 0) {
          const expands: Record<string, boolean> = {};
          wbsDataAll.wbsData.phases.forEach(p => { expands[p.id] = true; });
          return expands;
        }
        return prev;
      });
    }
  }, [wbsDataAll?.wbsData.phases]);

  useEffect(() => {
    if (!connection) return;

    const numericProjectId = Number(projectId);
    connection.invoke('JoinProjectGroup', numericProjectId)
      .then(() => console.log(`Joined SignalR project group: Project_${numericProjectId}`))
      .catch(err => console.error('SignalR JoinProjectGroup error:', err));

  const handleWbsUpdated = (payload: any) => {
    console.log('SignalR: WbsTreeUpdated', payload);
    queryClient.invalidateQueries({ queryKey: ['wbsDataAll', projectId] });
  };

  connection.on('WbsTreeUpdated', handleWbsUpdated);

    return () => {
      connection.off('WbsTreeUpdated', handleWbsUpdated);
      connection.invoke('LeaveProjectGroup', numericProjectId)
        .then(() => console.log(`Left SignalR project group: Project_${numericProjectId}`))
        .catch(err => console.error('SignalR LeaveProjectGroup error:', err));
    };
  }, [connection, projectId]);

  const loadWBSData = async () => {
    await queryClient.invalidateQueries({ queryKey: ['wbsDataAll', projectId] });
  };

  const togglePhase = (phaseId: string) =>
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));

  const handleSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
    queryClient.invalidateQueries({ queryKey: ['wbsDataAll', projectId] });
  };
  const handleError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);


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
      await projectService.approveMaterialRequestByTPKT(requestId, user?.name || 'technicalmanager');
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
      handleError(`Không thể xóa Giai đoạn "${phaseName}" vì bên trong có Công việc đã ghi nhận tiến độ.`);
      return;
    }
    if (!window.confirm(`Xác nhận xóa Giai đoạn "${phaseName}" và toàn bộ Công việc chưa bắt đầu bên trong?`)) return;
    try {
      await wbsService.deletePhase(parseInt(projectId.replace('p-', '')), parseInt(phaseId.replace('ph-', '')));
      if (selectedTask && tasks.find(t => t.id === selectedTaskId)?.phaseId === phaseId) setSelectedTaskId(null);
      handleSuccess(`Đã xóa Giai đoạn "${phaseName}".`);
    } catch (err: any) { handleError(err.message || 'Lỗi khi xóa Phase.'); }
  };




  const handleDeleteTask = async (taskId: string, taskName: string) => {
    if (!window.confirm(`Xác nhận xóa hẳn công việc "${taskName}"?`)) return;
    try {
      await wbsService.deleteTask(parseInt(taskId.replace('t-', '')));
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      handleSuccess(`Đã xóa Công việc "${taskName}".`);
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
    isEditPhaseOpen, setIsEditPhaseOpen, selectedPhaseForEdit, setSelectedPhaseForEdit,
    isEditTaskOpen, setIsEditTaskOpen, selectedTaskForEdit, setSelectedTaskForEdit,
    isObsoleteOpen, setIsObsoleteOpen,
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
    isAdjustProgressOpen, setIsAdjustProgressOpen,

    handleApproveByLeader, handleApproveByTPKT,
    handleRejectMatReq, handleCancelMatReq, handleConfirmReceived,
    isPhaseReadyForAcceptance, loading, handleSuccess, handleError, handleReorderTask, handleDeleteTask, handleDeletePhase, navigate, loadWBSData
  };

  return (
    <WBSContext.Provider value={contextValue}>
      <div className="flex flex-col gap-5">

        {/* Alerts */}
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

        {/* Draft Status Banner */}
        {project?.status === 'draft' && (
          <div className="animate-fade-in flex items-center justify-between py-3.5 px-5 bg-[#fef3c7] border border-[#fde68a] rounded-sm text-[#92400e]">
            <div>
              <h4 className="m-0 mb-1 text-base flex items-center gap-2">
                <AlertTriangle size={18} />
                Dự án đang ở trạng thái BẢN NHÁP (DRAFT)
              </h4>
              <p className="m-0 text-[0.85rem]">
                Hãy thêm thành viên, tạo cấu trúc WBS và đảm bảo Hạn chót công việc phải lớn hơn hoặc bằng Ngày bắt đầu dự án ({project.startDate}), sau đó bấm Kích hoạt để bắt đầu thi công.
              </p>
            </div>
            {isTPKTOrPL && (
              <Button
                onClick={handleActivateProject}
                variant="primary"
                className="animate-pulse font-semibold py-2 px-5 ml-4 shrink-0"
              >
                🚀 Kích hoạt Dự án
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-[1.15rem] font-semibold m-0">Cơ cấu phân rã công việc (WBS)</h3>
            <p className="text-[0.8rem] text-[hsl(var(--text-muted))] mt-1 mb-0">
              Số thứ tự được hiển thị trước tên · Nhấn ▲▼ để sắp xếp lại · Click <strong className="font-bold">⋮</strong> để đổi tên / xóa
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate(`/projects/${projectId}/drawing`)}
              className={`flex items-center gap-2 py-2 px-4 shrink-0 rounded-sm text-[0.85rem] font-semibold transition-all duration-150 cursor-pointer ${project?.drawingUrl
                  ? 'border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--border-light))]'
                  : 'border border-dashed border-[#d97706] bg-[#fef3c7] text-[#b45309] hover:bg-[#fde68a]'
                }`}
            >
              <FileText size={15} />
              <span>Xem Bản vẽ </span>
            </button>
            <button
              onClick={() => navigate(`/projects/${projectId}/gantt`)}
              className="flex items-center gap-2 py-2 px-4 shrink-0 border border-[hsl(var(--primary)/0.4)] rounded-sm bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] cursor-pointer text-[0.85rem] font-semibold transition-all duration-150 hover:bg-[hsl(var(--primary))] hover:text-white"
            >
              <BarChart2 size={15} />
              <span>Xem Gantt Chart</span>
            </button>
            <button
              onClick={() => navigate(`/projects/${projectId}/logs`)}
              className="flex items-center gap-2 py-2 px-4 shrink-0 border border-[hsl(var(--primary)/0.4)] rounded-sm bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] cursor-pointer text-[0.85rem] font-semibold transition-all duration-150 hover:bg-[hsl(var(--primary))] hover:text-white"
            >
              <History size={15} />
              <span>Xem Nhật ký thi công</span>
            </button>
          </div>
        </div>

        <div>
          <WBSTree />
        </div>



        <WBSModalsContainer />
      </div>
    </WBSContext.Provider>
  );
};
