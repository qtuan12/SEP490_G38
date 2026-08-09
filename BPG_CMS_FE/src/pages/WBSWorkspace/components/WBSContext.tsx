import { createContext, useContext } from 'react';
import type {WBSPhase, WBSTask, Project, ProjectMember, MaterialRequest} from '../../../types/common';

export interface WBSContextType {
  projectId: string;
  project: Project | null;
  phases: WBSPhase[];
  tasks: WBSTask[];
  members: ProjectMember[];
  materialRequests: MaterialRequest[];
  user: any;
  isTPKTOrPL: boolean;
  isPL: boolean;
  isTPKT: boolean;
  canEdit: boolean;
  filterAssignee: string;

  expandedPhases: Record<string, boolean>;
  togglePhase: (phaseId: string) => void;
  setExpandedPhases: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  hoveredPhaseId: string | null;
  setHoveredPhaseId: (id: string | null) => void;
  hoveredTaskId: string | null;
  setHoveredTaskId: (id: string | null) => void;

  phaseMenuId: string | null;
  setPhaseMenuId: (id: string | null) => void;
  taskMenuId: string | null;
  setTaskMenuId: (id: string | null) => void;

  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  
  isDetailOpen: boolean;
  setIsDetailOpen: (open: boolean) => void;
  
  isReportIncidentOpen: boolean;
  setIsReportIncidentOpen: (open: boolean) => void;
  
  isAssignOpen: boolean;
  setIsAssignOpen: (open: boolean) => void;
  
  isLogOpen: boolean;
  setIsLogOpen: (open: boolean) => void;
  
  isCreateMatReqOpen: boolean;
  setIsCreateMatReqOpen: (open: boolean) => void;
  
  createMatReqType: 'normal' | 'emergency';
  setCreateMatReqType: (type: 'normal' | 'emergency') => void;
  
  isCreatePhaseOpen: boolean;
  setIsCreatePhaseOpen: (open: boolean) => void;
  
  isResubmitOpen: boolean;
  setIsResubmitOpen: (open: boolean) => void;
  
  selectedResubmitRequest: MaterialRequest | null;
  setSelectedResubmitRequest: (req: MaterialRequest | null) => void;
  
  isEditPhaseOpen: boolean;
  setIsEditPhaseOpen: (open: boolean) => void;
  
  selectedPhaseForEdit: WBSPhase | null;
  setSelectedPhaseForEdit: (phase: WBSPhase | null) => void;
  
  isEditTaskOpen: boolean;
  setIsEditTaskOpen: (open: boolean) => void;
  
  selectedTaskForEdit: WBSTask | null;
  setSelectedTaskForEdit: (task: WBSTask | null) => void;
  
  isObsoleteOpen: boolean;
  setIsObsoleteOpen: (open: boolean) => void;
  
  isPhaseMatReqOpen: boolean;
  setIsPhaseMatReqOpen: (open: boolean) => void;
  
  isLeaderApprovalOpen: boolean;
  setIsLeaderApprovalOpen: (open: boolean) => void;
  
  selectedPhaseForMatReq: WBSPhase | null;
  setSelectedPhaseForMatReq: (phase: WBSPhase | null) => void;
  
  isBOQOpen: boolean;
  setIsBOQOpen: (open: boolean) => void;
  
  selectedPhaseForBOQ: WBSPhase | null;
  setSelectedPhaseForBOQ: (phase: WBSPhase | null) => void;
  
  isCreateTaskOpen: boolean;
  setIsCreateTaskOpen: (open: boolean) => void;
  
  selectedPhaseForTask: string;
  setSelectedPhaseForTask: (phaseId: string) => void;
  
  parentTaskForNew: string | undefined;
  setParentTaskForNew: (taskId: string | undefined) => void;
  
  parentDeadlineForNew: string | undefined;
  setParentDeadlineForNew: (deadline: string | undefined) => void;
  
  isAdjustDeadlineOpen: boolean;
  setIsAdjustDeadlineOpen: (open: boolean) => void;
  
  adjustingTask: WBSTask | null;
  setAdjustingTask: (task: WBSTask | null) => void;

  isAdjustProgressOpen: boolean;
  setIsAdjustProgressOpen: (open: boolean) => void;

  isReportInventoryIncidentOpen: boolean;
  setIsReportInventoryIncidentOpen: (open: boolean) => void;
  selectedPhaseForInventoryIncident: WBSPhase | null;
  setSelectedPhaseForInventoryIncident: (phase: WBSPhase | null) => void;

  handleApproveByLeader: (id: string) => void;
  handleApproveByTPKT: (id: string) => void;
  handleRejectMatReq: (id: string) => void;
  handleCancelMatReq: (id: string) => void;
  handleConfirmReceived: (id: string) => void;
  
  navigate: (path: string) => void;
  isPhaseReadyForAcceptance: (phaseId: string) => boolean;
  loading: boolean;
  handleSuccess: (msg: string) => void;
  handleError: (msg: string) => void;
  handleReorderTask: (phaseId: string, taskId: string, direction: 'up' | 'down') => void;
  handleDeleteTask: (taskId: string, taskName: string) => void;
  handleDeletePhase: (phaseId: string, phaseName: string) => void;
  loadWBSData: () => void;
}

export const WBSContext = createContext<WBSContextType | null>(null);

export const useWBS = () => {
  const context = useContext(WBSContext);
  if (!context) {
    throw new Error('useWBS must be used within a WBSProvider');
  }
  return context;
};
