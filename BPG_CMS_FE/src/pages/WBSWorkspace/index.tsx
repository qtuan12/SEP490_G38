import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { wbsService } from '../../services/wbsService';
import { incidentService } from '../../services/incidentService';
import type { WBSPhase, WBSTask, MaterialRequest } from '../../types/common';
import { WBSContext } from './components/WBSContext';
import { WBSTree } from './components/WBSTree';
import { WBSModalsContainer } from './components/WBSModalsContainer';
import { FileText, BarChart2 } from 'lucide-react';
import { ConfirmDialog, FullScreenLoading } from '../../components/ui';
import { useProjectAccess } from '../../hooks/useProjectAccess';
import { RoleGroup } from '../../auth/roles';
import toast from 'react-hot-toast';
import { isPhaseReadyForAcceptance as checkPhaseAcceptanceReadiness } from '../../utils/phaseAcceptance';


interface WBSWorkspaceProps {
  projectId: string;
}

type CloneTarget =
  | { type: 'phase'; id: string; name: string }
  | { type: 'task'; id: string; name: string };

export const WBSWorkspace: React.FC<WBSWorkspaceProps> = ({ projectId }) => {
  const { user, hasAnyRole } = useAuth();
  const { isProjectLeader, isProjectMember } = useProjectAccess(projectId);
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // The tree is the only blocking request for the WBS area. Supporting data is
  // fetched independently so a slow material-request or incident endpoint does
  // not keep the whole tree behind the loading state.
  const { data: wbsData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['wbsData', projectId],
    queryFn: () => wbsService.getWbsDataFlattened(projectId),
    staleTime: 30_000,
  });

  const { data: project = null } = useQuery({
    queryKey: ['wbsProject', projectId],
    queryFn: () => projectService.getProjectById(projectId),
    staleTime: 60_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['wbsMembers', projectId],
    queryFn: () => projectService.getMembers(projectId),
    staleTime: 60_000,
  });

  const { data: materialRequests = [] } = useQuery({
    queryKey: ['wbsMaterialRequests', projectId],
    queryFn: () => projectService.getMaterialRequests(projectId),
    staleTime: 30_000,
  });

  const { data: incidentsList = [] } = useQuery({
    queryKey: ['wbsIncidents', projectId],
    queryFn: () => incidentService.getIncidents(Number(projectId.replace('p-', ''))),
    staleTime: 30_000,
  });

  const allPhases = wbsData?.phases || [];
  const allTasks = wbsData?.tasks || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterWeight, setFilterWeight] = useState('');

  let phases = allPhases;
  let tasks = allTasks;

  if (searchTerm.trim() || filterAssignee || filterWeight) {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchingPhaseIds = new Set<string>();
    const matchingTaskIds = new Set<string>();

    allPhases.forEach(p => {
      if (!filterAssignee && !filterWeight && p.name.toLowerCase().includes(normalizedSearch)) matchingPhaseIds.add(p.id);
    });
    
    allTasks.forEach(t => {
      const matchesSearch = !normalizedSearch || t.name.toLowerCase().includes(normalizedSearch);
      const matchesAssignee = !filterAssignee || (t.assignedTo && t.assignedTo.toString() === filterAssignee.toString());
      const matchesWeight = !filterWeight || (t.weight?.toString() === filterWeight);
      if (matchesSearch && matchesAssignee && matchesWeight) matchingTaskIds.add(t.id);
    });

    let addedNew = true;
    while(addedNew) {
       addedNew = false;
       allTasks.forEach(t => {
         if (matchingTaskIds.has(t.id)) {
           if (t.parentTaskId && !matchingTaskIds.has(t.parentTaskId)) {
              matchingTaskIds.add(t.parentTaskId);
              addedNew = true;
           }
           if (!matchingPhaseIds.has(t.phaseId)) {
              matchingPhaseIds.add(t.phaseId);
           }
         }
       });
    }

    allPhases.forEach(p => {
      if (matchingPhaseIds.has(p.id)) {
         if (!filterAssignee && !filterWeight && p.name.toLowerCase().includes(normalizedSearch)) {
            allTasks.filter(t => t.phaseId === p.id).forEach(t => matchingTaskIds.add(t.id));
         }
      }
    });

    phases = allPhases.filter(p => matchingPhaseIds.has(p.id));
    tasks = allTasks.filter(t => matchingTaskIds.has(t.id));
  }
  const [error, setError] = useState<string | null>(null);
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
  const [cloneTarget, setCloneTarget] = useState<CloneTarget | null>(null);

  // ── IMPORT WBS state ──────────────────────────────────
  const [isImportWbsOpen, setIsImportWbsOpen] = useState(false);

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





  // Support opening task detail from URL
  useEffect(() => {
    const queryTaskId = searchParams.get('taskId');
    if (queryTaskId && allTasks.length > 0) {
      const cleanId = String(queryTaskId).replace('t-', '');
      const matched = allTasks.find(t => 
        t.id === queryTaskId || 
        t.id === `t-${cleanId}` || 
        t.id.replace('t-', '') === cleanId
      );
      if (matched) {
        setSelectedTaskId(matched.id);
        setIsDetailOpen(true);
        if (matched.phaseId) {
          setExpandedPhases(prev => ({ ...prev, [matched.phaseId]: true }));
        }
        searchParams.delete('taskId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, allTasks, setSearchParams]);

  const loadWBSData = async () => {
    await queryClient.invalidateQueries({ queryKey: ['wbsData', projectId] });
  };

  const togglePhase = (phaseId: string) =>
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));

  const handleSuccess = (msg: string) => {
    toast.success(msg);
    queryClient.invalidateQueries({ queryKey: ['wbsData', projectId] });
    queryClient.invalidateQueries({ queryKey: ['task-progress-history'] });
    // Refresh supporting information in the background without blocking the tree.
    queryClient.invalidateQueries({ queryKey: ['wbsProject', projectId] });
    queryClient.invalidateQueries({ queryKey: ['wbsMembers', projectId] });
    queryClient.invalidateQueries({ queryKey: ['wbsMaterialRequests', projectId] });
    queryClient.invalidateQueries({ queryKey: ['wbsIncidents', projectId] });
  };
  const handleError = (msg: string) => {
    toast.error(msg);
  };

  const cloneMutation = useMutation<number, Error, CloneTarget>({
    mutationFn: (target) => target.type === 'phase'
      ? wbsService.clonePhase(
          Number(projectId.replace(/^p-/, '')),
          Number(target.id.replace(/^ph-/, '')),
        )
      : wbsService.cloneTask(Number(target.id.replace(/^t-/, ''))),
    onSuccess: (_, target) => {
      setCloneTarget(null);
      handleSuccess(target.type === 'phase'
        ? `Đã nhân bản Giai đoạn "${target.name}" và toàn bộ Công việc bên trong.`
        : `Đã nhân bản Công việc "${target.name}" và toàn bộ Công việc con.`);
    },
    onError: (cloneError) => {
      setCloneTarget(null);
      handleError(cloneError.message || 'Không thể nhân bản dữ liệu WBS.');
    },
  });

  const handleClonePhase = (phaseId: string, phaseName: string) => {
    setCloneTarget({ type: 'phase', id: phaseId, name: phaseName });
  };

  const handleCloneTask = (taskId: string, taskName: string) => {
    setCloneTarget({ type: 'task', id: taskId, name: taskName });
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);


  const isTPKT = hasAnyRole(RoleGroup.Technical);
  const isPL = isProjectLeader;
  const isTPKTOrPL = isTPKT || isPL;

  const isPhaseReadyForAcceptance = (phaseId: string) => {
    return checkPhaseAcceptanceReadiness(tasks.filter(t => t.phaseId === phaseId));
  };

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
    projectId, project, phases, tasks, members, user, isTPKTOrPL, isPL, isProjectMember, isTPKT, canEdit, materialRequests,
    filterAssignee, setFilterAssignee, filterWeight, setFilterWeight,
    searchTerm, setSearchTerm,
    expandedPhases, togglePhase,
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
    isImportWbsOpen, setIsImportWbsOpen,
    isReportIncidentOpen, setIsReportIncidentOpen,
    handleApproveByLeader, handleApproveByTPKT,
    handleRejectMatReq, handleCancelMatReq, handleConfirmReceived,
    isPhaseReadyForAcceptance, loading, handleSuccess, handleError, handleReorderTask,
    handleDeleteTask, handleDeletePhase, handleCloneTask, handleClonePhase, navigate, loadWBSData
  };

  if (loading) {
    return <FullScreenLoading message="Đang tải dữ liệu WBS..." />;
  }

  return (
    <WBSContext.Provider value={contextValue}>
      <div className="flex flex-col gap-5">

        {error && (
          <div className="animate-fade-in py-2.5 px-3.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm text-[hsl(346_84%_35%)] text-[0.85rem]">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* Hàng trên: Tiêu đề và Các nút chức năng */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-[1.15rem] font-semibold m-0 whitespace-nowrap">Cấu trúc công việc</h3>
            </div>
            <div className="flex gap-2 flex-wrap items-center w-full sm:w-auto justify-start sm:justify-end">
              {isTPKTOrPL && canEdit && (
                <button
                  onClick={() => setIsImportWbsOpen(true)}
                  className="flex items-center gap-2 py-2 px-3 shrink-0 rounded-sm text-[0.85rem] font-semibold transition-all duration-150 cursor-pointer bg-white border border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)]"
                >
                  <FileText size={15} />
                  <span className="hidden sm:inline">Nhập từ Excel</span>
                </button>
              )}
              <button
                onClick={() => navigate(`/projects/${projectId}/drawing`)}
                className={`flex items-center gap-2 py-2 px-3 shrink-0 rounded-sm text-[0.85rem] font-semibold transition-all duration-150 cursor-pointer ${project?.drawingUrl
                  ? 'border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--border-light))]'
                  : 'border border-dashed border-[#d97706] bg-[#fef3c7] text-[#b45309] hover:bg-[#fde68a]'
                  }`}
              >
                <FileText size={15} />
                <span className="hidden sm:inline">Xem Bản vẽ </span>
              </button>
              <button
                onClick={() => navigate(`/projects/${projectId}/gantt`)}
                className="flex items-center gap-2 py-2 px-3 shrink-0 border border-[hsl(var(--primary)/0.4)] rounded-sm bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] cursor-pointer text-[0.85rem] font-semibold transition-all duration-150 hover:bg-[hsl(var(--primary))] hover:text-white"
              >
                <BarChart2 size={15} />
                <span className="hidden sm:inline">Xem Biểu đồ công việc</span>
              </button>
            </div>
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

        <ConfirmDialog
          isOpen={cloneTarget !== null}
          onClose={() => { if (!cloneMutation.isPending) setCloneTarget(null); }}
          onConfirm={() => {
            if (cloneTarget && !cloneMutation.isPending) cloneMutation.mutate(cloneTarget);
          }}
          title={cloneTarget?.type === 'phase' ? 'Nhân bản Giai đoạn' : 'Nhân bản Công việc'}
          message={cloneTarget?.type === 'phase'
            ? `Nhân bản Giai đoạn "${cloneTarget.name}" cùng toàn bộ Công việc bên trong?`
            : `Nhân bản Công việc "${cloneTarget?.name ?? ''}" cùng toàn bộ Công việc con?`}
          confirmText="Nhân bản"
          isDanger={false}
          isLoading={cloneMutation.isPending}
        />
      </div>
    </WBSContext.Provider>
  );
};
