export interface WbsTask {
  taskId: number;
  phaseId: number;
  parentTaskId: number | null;
  name: string;
  description: string | null;
  orderIndex: number;
  startDate: string;
  endDate: string;
  status: string;
  progressPercent: number;
  isLocked: boolean;
  isOverdue?: boolean;
  isAtRisk?: boolean;
  daysLeft?: number;
  assignedTo?: string;
  subTasks: WbsTask[];
}

export interface WbsPhase {
  phaseId: number;
  projectId: number;
  name: string;
  description: string | null;
  orderIndex: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  progressPercent: number;
  tasks: WbsTask[];
}

export interface WbsTree {
  projectId: number;
  phases: WbsPhase[];
}

export interface TaskAssignee {
  userId: number;
  fullName: string;
  email: string;
}

export interface TaskDailyLog {
  dailyLogId: number;
  logDate: string;
  content: string;
  progressPercentAdded: number;
  imageUrls: string[];
}

export interface TaskProgressLog {
  logId: number;
  oldProgress: number;
  newProgress: number;
  updateReason: string | null;
  updatedAt: string;
}

export interface TaskDetails {
  taskId: number;
  phaseId: number;
  parentTaskId: number | null;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: string;
  progressPercent: number;
  obsoleteReason: string | null;
  assignees: TaskAssignee[];
  dailyLogs: TaskDailyLog[];
  progressLogs: TaskProgressLog[];
}
