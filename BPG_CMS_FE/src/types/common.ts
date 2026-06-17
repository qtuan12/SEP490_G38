export interface Project {
  id: string;
  name: string;
  address: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'inprogress' | 'paused' | 'done';
  drawingUrl?: string; // legacy single drawing
  drawingUrls?: string[]; // multiple drawings support
  attachments?: AttachmentDto[]; // real attachments metadata
  progress: number; // overall progress % (derived or stored)
  pauseReason?: string;
  pausedAt?: string;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  isLeader: boolean; // crown icon 👑 if true
}

export interface PhaseMaterialItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface AcceptanceRecord {
  id: string;
  date: string;
  isPassed: boolean;
  representativeA: string;
  roleA: string;
  representativeB: string;
  roleB: string;
  startTime: string;
  endTime: string;
  drawings: string;
  standards: string;
  results: string;
  quality: string;
  opinions: string;
  conclusion: string;
}

export interface WBSPhase {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  sortOrder: number; // display order within project
  status: 'active' | 'frozen'; // frozen after acceptance
  acceptanceComment?: string;
  acceptanceDate?: string;
  revocationComment?: string;
  revocationDate?: string;
  acceptanceRepresentativeA?: string;
  acceptanceRoleA?: string;
  acceptanceRepresentativeB?: string;
  acceptanceRoleB?: string;
  acceptanceStartTime?: string;
  acceptanceEndTime?: string;
  acceptanceDrawings?: string;
  acceptanceStandards?: string;
  acceptanceResults?: string;
  acceptanceQuality?: string;
  acceptanceOpinions?: string;
  acceptanceConclusion?: string;
  acceptanceHistory?: AcceptanceRecord[];
  deadline?: string; // Phase deadline for schedule reserve checks
  startDate?: string;
  endDate?: string;
  materials?: PhaseMaterialItem[];
}

export interface IncidentReport {
  id: string;
  projectId: string;
  taskId: string;
  taskName: string;
  reporterId: string;
  reporterName: string;
  reviewerId?: string;
  reviewerName?: string;
  incidentType: 'Construction' | 'InventoryLoss' | 'InventoryDamage' | 'Delay' | 'Safety' | 'Other';
  description: string;
  status: 'Reported' | 'Assessing' | 'WaitingReview' | 'Approved' | 'Rejected' | 'Closed';
  damageDescription?: string;
  estimatedMaterialLoss?: number;
  estimatedLaborDays?: number;
  estimatedDelayDays?: number;
  proposedAction?: string;
  reworkTaskId?: string;
  
  // Custom fields for frontend
  date: string;
  images: string[];
  comments?: DailyLogComment[];
  revisionComment?: string;
}

export interface MaterialRequestItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface MaterialRequest {
  id: string;
  projectId: string;
  taskId?: string;
  taskName?: string;
  phaseId?: string;
  phaseName?: string;
  requesterName: string;
  items: MaterialRequestItem[];
  status: 'pending_leader' | 'approved_by_leader' | 'pending_tpkt' | 'pending_accountant' | 'pending_director' | 'approved' | 'rejected' | 'pending_disbursement' | 'disbursed' | 'received';
  isOverBOQ: boolean;
  type: 'normal' | 'emergency'; // normal vs emergency (direct purchase)
  invoiceImage?: string;
  reason?: string;
  date: string;
  approvedBy?: string;
  rejectionReason?: string;
}



export interface TaskHistory {
  date: string;
  oldProgress: number;
  newProgress: number;
  reason: string;
  type?: 'progress_increase' | 'progress_decrease' | 'deadline_shift' | 'obsolete' | 'status_change' | 'created' | 'update';
  adjustedBy?: string;
  incidentCategory?: 'khach_quan' | 'chu_quan';
}

export interface WBSTask {
  id: string;
  phaseId: string;
  projectId: string;
  parentTaskId?: string;
  name: string;
  description?: string;
  sortOrder: number; // display order within phase
  assignedTo?: string; // userId of engineer
  assignedName?: string; // name of engineer
  startDate?: string;
  deadline: string;
  progress: number; // 0 - 100
  history: TaskHistory[];
  status?: 'active' | 'obsolete';
  isOverdue?: boolean;
  isAtRisk?: boolean;
  daysLeft?: number;
  estimatedMaterials?: PhaseMaterialItem[];
  isRework?: boolean;
}

export interface DailyLogComment {
  id: string;
  userId: string;
  userName: string;
  role: string;
  content: string;
  date: string;
}

export interface DailyLog {
  id: string;
  projectId: string;
  taskId: string;
  taskName: string;
  engineerId: string;
  engineerName: string;
  progressFrom: number;
  progressTo: number;
  date: string;
  content: string; // work detail description
  weather: string;
  images: string[]; // array of base64 or mock URLs
  comments: DailyLogComment[];
}

export interface TaskProgressLog {
  taskProgressLogId: number;
  taskId: number;
  oldProgress: number;
  newProgress: number;
  updateReason?: string;
  updatedAt: string; // ISO datetime string
}

export interface AcceptanceData {
  representativeA: string;
  roleA: string;
  representativeB: string;
  roleB: string;
  startTime: string;
  endTime: string;
  drawings: string;
  standards: string;
  results: string;
  quality: string;
  opinions: string;
  conclusion: string;
  acceptanceDate?: string;
}

export interface DashboardProjectProgressDto {
  projectId: number;
  projectName: string;
  address: string;
  progress: number;
  status: string;
}

export interface DashboardMetricsDto {
  totalProjects: number;
  draftProjects: number;
  activeProjects: number;
  pausedProjects: number;
  completedProjects: number;
  closedProjects: number;
  activeProjectsProgress: DashboardProjectProgressDto[];
}

export interface DashboardWarningDto {
  projectId: number;
  projectName: string;
  taskId: number;
  taskName: string;
  warningType: 'Red' | 'Yellow' | 'Critical';
  message: string;
}

export interface AttachmentDto {
  attachmentId?: number;
  attachmentType: string;
  fileName: string;
  fileUrl: string;
  contentType?: string;
  fileSizeBytes?: number;
}

export interface ProjectDto {
  projectId: number;
  name: string;
  address?: string;
  status: string;
  plannedStart: string;
  plannedEnd: string;
  createdAt: string;
  pauseReason?: string;
  pausedAt?: string;
}

export interface ProjectMemberDto {
  projectMemberId: number;
  projectId: number;
  userId: number;
  fullName: string;
  email: string;
  role: string;
  isLeader: boolean;
  joinedAt: string;
}

export interface ProjectDetailDto extends ProjectDto {
  members: ProjectMemberDto[];
  attachments: AttachmentDto[];
}

