import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { wbsService } from '../../services/wbsService';
import { incidentService } from '../../services/incidentService';
import { useNotification } from '../../context/NotificationContext';
import type { WBSPhase, WBSTask, MaterialRequest } from '../../types/common';
import { WBSContext } from './components/WBSContext';
import { WBSTree } from './components/WBSTree';
import { WBSModalsContainer } from './components/WBSModalsContainer';
import { FileText, BarChart2 } from 'lucide-react';
import { ConfirmDialog } from '../../components/ui';


interface WBSWorkspaceProps {
  projectId: string;
}

export const WBSWorkspace: React.FC<WBSWorkspaceProps> = ({ projectId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { connection } = useNotification();

  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: wbsDataAll, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['wbsDataAll', projectId],
    queryFn: async () => {
      const [wbsData, allProjs, memberList, mr, incidentsList] = await Promise.all([
        wbsService.getWbsDataFlattened(projectId),
        projectService.getProjects(),
        projectService.getMembers(projectId),
        projectService.getMaterialRequests(projectId),
        incidentService.getIncidents(Number(projectId.replace('p-', '')))
      ]);
      return {
        wbsData,
        project: allProjs.find(p => p.id === projectId) || null,
        memberList,
        materialRequests: mr,
        incidentsList
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
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDanger: false,
  });

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

  // ── INVENTORY INCIDENT modal state ────────────────────────
  const [isReportInventoryIncidentOpen, setIsReportInventoryIncidentOpen] = useState(false);
  const [selectedPhaseForInventoryIncident, setSelectedPhaseForInventoryIncident] = useState<WBSPhase | null>(null);

  // ── INCIDENT modal state ────────────────────────
  const [isReportIncidentOpen, setIsReportIncidentOpen] = useState(false);

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

  // Support opening task detail from URL
  useEffect(() => {
    const queryTaskId = searchParams.get('taskId');
    if (queryTaskId && tasks.length > 0) {
      const taskExists = tasks.some(t => t.id === queryTaskId);
      if (taskExists) {
        setSelectedTaskId(queryTaskId);
        setIsDetailOpen(true);
        searchParams.delete('taskId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, tasks, setSearchParams]);

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
  const isPL = (currentMember ? currentMember.isLeader : false) || user?.role === 'projectleader' || user?.role === 'admin' || user?.role === 'technicalmanager';
  const isTPKTOrPL = isPL;

  const isPhaseReadyForAcceptance = (phaseId: string) => {
    const phaseTasks = tasks.filter(t => t.phaseId === phaseId && t.status !== 'obsolete');
    if (phaseTasks.length === 0) return false;
    return phaseTasks.every(t => t.progress === 100);
  };

  const isTPKT = user?.role === 'technicalmanager' || user?.role === 'admin';
  const incidentsList = wbsDataAll?.incidentsList || [];
  const hasApprovedEmergencyIncident = incidentsList.some(i => i.isEmergency && i.status === 'Approved');

  const canEdit = isTPKTOrPL && (
    project?.status !== 'paused' ||
    (isTPKT && hasApprovedEmergencyIncident)
  ) && project?.status !== 'done';

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
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa Giai đoạn',
      message: `Xác nhận xóa Giai đoạn "${phaseName}" và toàn bộ Công việc chưa bắt đầu bên trong?`,
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await wbsService.deletePhase(parseInt(projectId.replace('p-', '')), parseInt(phaseId.replace('ph-', '')));
          if (selectedTask && tasks.find(t => t.id === selectedTaskId)?.phaseId === phaseId) setSelectedTaskId(null);
          handleSuccess(`Đã xóa Giai đoạn "${phaseName}".`);
        } catch (err: any) { handleError(err.message || 'Lỗi khi xóa Phase.'); }
      }
    });
  };




  const handleDeleteTask = async (taskId: string, taskName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa Công việc',
      message: `Xác nhận xóa hẳn công việc "${taskName}"?`,
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await wbsService.deleteTask(parseInt(taskId.replace('t-', '')));
          if (selectedTaskId === taskId) setSelectedTaskId(null);
          handleSuccess(`Đã xóa Công việc "${taskName}".`);
        } catch (err: any) { handleError(err.message || 'Lỗi khi xóa Task.'); }
      }
    });
  };

  const handleReorderTask = async (phaseId: string, taskId: string, direction: 'up' | 'down') => {
    try {
      await projectService.reorderTask(phaseId, taskId, direction);
      loadWBSData();
    } catch (err: any) { handleError(err.message || 'Lỗi khi sắp xếp.'); }
  };




  const contextValue = {
    projectId, project, phases, tasks, members, user, isTPKTOrPL, isPL, isTPKT, canEdit, materialRequests,
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
    isReportInventoryIncidentOpen, setIsReportInventoryIncidentOpen,
    selectedPhaseForInventoryIncident, setSelectedPhaseForInventoryIncident,
    isReportIncidentOpen, setIsReportIncidentOpen,

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

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-[1.15rem] font-semibold m-0">Cơ cấu phân rã công việc (WBS)</h3>

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
              <span>Xem Biểu đồ công việc</span>
            </button>

          </div>
        </div>

        <div>
          <WBSTree />
        </div>



        <WBSModalsContainer />

        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          isDanger={confirmDialog.isDanger}
        />
      </div>
    </WBSContext.Provider>
  );
};
