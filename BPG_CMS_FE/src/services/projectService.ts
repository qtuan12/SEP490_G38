import { USE_MOCK_API } from './api';

export interface Project {
  id: string;
  name: string;
  address: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'paused' | 'done';
  drawingUrl?: string; // name or dummy data url of drawing design
  progress: number; // overall progress % (derived or stored)
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  isLeader: boolean; // crown icon 👑 if true
}

export interface WBSPhase {
  id: string;
  projectId: string;
  name: string;
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
}

export interface TaskHistory {
  date: string;
  oldProgress: number;
  newProgress: number;
  reason: string;
  type?: 'progress_increase' | 'progress_decrease' | 'deadline_shift' | 'obsolete' | 'status_change';
  adjustedBy?: string;
  incidentCategory?: 'khach_quan' | 'chu_quan';
}

export interface WBSTask {
  id: string;
  phaseId: string;
  projectId: string;
  name: string;
  sortOrder: number; // display order within phase
  assignedTo?: string; // userId of engineer
  assignedName?: string; // name of engineer
  deadline: string;
  progress: number; // 0 - 100
  history: TaskHistory[];
  status?: 'active' | 'obsolete';
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

// Default initial data for simulation
const DEFAULT_PROJECTS: Project[] = [
  { id: 'p-1', name: 'Dự án Chung cư BPG - Biên Hòa', address: '12 Đường số 4, KCN Biên Hòa, Đồng Nai', startDate: '2026-05-01', endDate: '2026-12-30', status: 'active', progress: 45 },
  { id: 'p-2', name: 'Dự án Cải tạo Văn phòng FPT', address: 'Lô E2a-7, Đường D1, KCNC, Quận 9, TP.HCM', startDate: '2026-05-10', endDate: '2026-08-15', status: 'active', progress: 20 },
  { id: 'p-3', name: 'Dự án Biệt thự Nam Sài Gòn', address: 'Khu biệt thự Chateau, Phú Mỹ Hưng, Quận 7, TP.HCM', startDate: '2026-06-15', endDate: '2027-02-28', status: 'draft', progress: 0 },
  { id: 'p-4', name: 'Dự án Cầu đường Nhơn Trạch', address: 'Huyện Nhơn Trạch, Tỉnh Đồng Nai', startDate: '2026-01-01', endDate: '2026-05-20', status: 'paused', progress: 90 },
];

const DEFAULT_MEMBERS: ProjectMember[] = [
  { projectId: 'p-1', userId: 'u-3', userName: 'Trần Văn Công', userEmail: 'engineer@bpg.com', userRole: 'kỹ sư', isLeader: true },
  { projectId: 'p-1', userId: 'u-6', userName: 'Nguyễn Văn Nam', userEmail: 'se1@bpg.com', userRole: 'kỹ sư', isLeader: false },
  { projectId: 'p-1', userId: 'u-7', userName: 'Phạm Minh Hải', userEmail: 'se2@bpg.com', userRole: 'kỹ sư', isLeader: false },
  { projectId: 'p-2', userId: 'u-3', userName: 'Trần Văn Công', userEmail: 'engineer@bpg.com', userRole: 'kỹ sư', isLeader: false },
];

const DEFAULT_PHASES: WBSPhase[] = [
  { id: 'ph-1', projectId: 'p-1', sortOrder: 1, name: 'Phase 1: Móng & Cột Trụ', status: 'frozen', acceptanceComment: 'Hoàn thành tốt, đạt yêu cầu kỹ thuật đổ bê tông móng cốt thép trục A-H.', acceptanceDate: '2026-05-28' },
  { id: 'ph-2', projectId: 'p-1', sortOrder: 2, name: 'Phase 2: Thân chung cư (Tầng 1 - Tầng 5)', status: 'active' },
  { id: 'ph-3', projectId: 'p-1', sortOrder: 3, name: 'Phase 3: Hoàn thiện & Điện nước', status: 'active' },
  { id: 'ph-4', projectId: 'p-2', sortOrder: 1, name: 'Phase 1: Tháo dỡ & Đi dây cáp ngầm', status: 'active' },
];

const DEFAULT_TASKS: WBSTask[] = [
  // Phase 1 (p-1) - all 100%
  { id: 't-1', phaseId: 'ph-1', projectId: 'p-1', sortOrder: 1, name: 'Đào đất móng sâu 3m', assignedTo: 'u-3', assignedName: 'Trần Văn Công', deadline: '2026-05-15', progress: 100, history: [] },
  { id: 't-2', phaseId: 'ph-1', projectId: 'p-1', sortOrder: 2, name: 'Gia công cốt thép móng vây', assignedTo: 'u-6', assignedName: 'Nguyễn Văn Nam', deadline: '2026-05-20', progress: 100, history: [] },
  { id: 't-3', phaseId: 'ph-1', projectId: 'p-1', sortOrder: 3, name: 'Đổ bê tông lót móng M250', assignedTo: 'u-7', assignedName: 'Phạm Minh Hải', deadline: '2026-05-25', progress: 100, history: [] },
  // Phase 2 (p-1)
  { id: 't-4', phaseId: 'ph-2', projectId: 'p-1', sortOrder: 1, name: 'Lắp dựng cốp pha cột tầng 1', assignedTo: 'u-3', assignedName: 'Trần Văn Công', deadline: '2026-06-10', progress: 80, history: [] },
  { id: 't-5', phaseId: 'ph-2', projectId: 'p-1', sortOrder: 2, name: 'Đổ bê tông cột tầng 1', assignedTo: 'u-6', assignedName: 'Nguyễn Văn Nam', deadline: '2026-06-15', progress: 40, history: [] },
  { id: 't-6', phaseId: 'ph-2', projectId: 'p-1', sortOrder: 3, name: 'Lắp đặt cốt thép dầm sàn tầng 1', assignedTo: 'u-7', assignedName: 'Phạm Minh Hải', deadline: '2026-06-25', progress: 0, history: [] },
  // Phase 3 (p-1)
  { id: 't-7', phaseId: 'ph-3', projectId: 'p-1', sortOrder: 1, name: 'Xây tường bao quanh căn hộ', assignedTo: 'u-3', assignedName: 'Trần Văn Công', deadline: '2026-07-20', progress: 0, history: [] },
  { id: 't-8', phaseId: 'ph-3', projectId: 'p-1', sortOrder: 2, name: 'Đi đường ống điện âm tường', assignedTo: 'u-6', assignedName: 'Nguyễn Văn Nam', deadline: '2026-07-30', progress: 0, history: [] },
  // Phase 1 (p-2)
  { id: 't-9', phaseId: 'ph-4', projectId: 'p-2', sortOrder: 1, name: 'Tháo dỡ vách thạch cao cũ', assignedTo: 'u-3', assignedName: 'Trần Văn Công', deadline: '2026-05-25', progress: 100, history: [] },
  { id: 't-10', phaseId: 'ph-4', projectId: 'p-2', sortOrder: 2, name: 'Đi dây cáp mạng CAT6 âm trần', assignedTo: 'u-3', assignedName: 'Trần Văn Công', deadline: '2026-06-15', progress: 20, history: [] },
];

const DEFAULT_LOGS: DailyLog[] = [
  {
    id: 'l-1',
    projectId: 'p-1',
    taskId: 't-4',
    taskName: 'Lắp dựng cốp pha cột tầng 1',
    engineerId: 'u-3',
    engineerName: 'Trần Văn Công',
    progressFrom: 60,
    progressTo: 80,
    date: '2026-06-01 16:30',
    content: 'Đã hoàn thành lắp cốp pha trục A-B ổn định. Đang căn chỉnh vách trục C-D. Thời tiết nắng nóng 37 độ C, công nhân mất nhiều sức nhưng vẫn cố gắng bám tiến độ.',
    weather: 'Nắng nóng gay gắt',
    images: [
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=600&q=80'
    ],
    comments: [
      { id: 'c-1', userId: 'u-2', userName: 'Nguyễn Văn Kỹ', role: 'tpkt', content: 'Gia cố kỹ chân cốp pha trục C nhé Công, tránh để phình bụng bê tông khi đổ vào ngày mai.', date: '2026-06-01 17:15' }
    ]
  },
  {
    id: 'l-2',
    projectId: 'p-1',
    taskId: 't-5',
    taskName: 'Đổ bê tông cột tầng 1',
    engineerId: 'u-6',
    engineerName: 'Nguyễn Văn Nam',
    progressFrom: 20,
    progressTo: 40,
    date: '2026-05-31 15:45',
    content: 'Đã đổ xong bê tông 4 cột trục E. Chiều nay có giông lớn kèm mưa to từ 14h, phải phủ bạt che chắn bề mặt bê tông cột mới đổ kịp thời.',
    weather: 'Mưa dông lớn',
    images: [
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80'
    ],
    comments: []
  }
];

// Helper functions for localStorage
const getStorage = <T>(key: string, defaults: T[]): T[] => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(data);
};

const setStorage = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const projectService = {
  // Sync overall progress of projects based on task progress average
  async syncProjectProgress(projectId: string): Promise<number> {
    const tasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS).filter(t => t.projectId === projectId && t.status !== 'obsolete');
    if (tasks.length === 0) return 0;
    const sum = tasks.reduce((acc, t) => acc + t.progress, 0);
    const avg = Math.round(sum / tasks.length);

    const projects = getStorage<Project>('bpg_projects', DEFAULT_PROJECTS);
    const projIdx = projects.findIndex(p => p.id === projectId);
    if (projIdx !== -1) {
      projects[projIdx].progress = avg;
      setStorage('bpg_projects', projects);
    }
    return avg;
  },

  // PROJECTS CRUD
  async getProjects(): Promise<Project[]> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const projects = getStorage<Project>('bpg_projects', DEFAULT_PROJECTS);
      // dynamically update progresses
      for (const p of projects) {
        const tasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS).filter(t => t.projectId === p.id && t.status !== 'obsolete');
        if (tasks.length > 0) {
          const sum = tasks.reduce((acc, t) => acc + t.progress, 0);
          p.progress = Math.round(sum / tasks.length);
        }
      }
      setStorage('bpg_projects', projects);
      return projects;
    }
    // real API call placeholder
    return [];
  },

  async getProjectById(id: string): Promise<Project | null> {
    const projects = await this.getProjects();
    return projects.find(p => p.id === id) || null;
  },

  async createProject(project: Omit<Project, 'id' | 'progress'>): Promise<Project> {
    const projects = getStorage<Project>('bpg_projects', DEFAULT_PROJECTS);
    const newProj: Project = {
      ...project,
      id: `p-${Date.now()}`,
      progress: 0
    };
    projects.push(newProj);
    setStorage('bpg_projects', projects);
    return newProj;
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const projects = getStorage<Project>('bpg_projects', DEFAULT_PROJECTS);
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Không tìm thấy dự án.');
    projects[idx] = { ...projects[idx], ...updates };
    setStorage('bpg_projects', projects);
    return projects[idx];
  },

  // MEMBERS MANAGEMENT
  async getMembers(projectId: string): Promise<ProjectMember[]> {
    const allMembers = getStorage<ProjectMember>('bpg_project_members', DEFAULT_MEMBERS);
    return allMembers.filter(m => m.projectId === projectId);
  },

  async addMember(projectId: string, user: { id: string; name: string; email: string; role: string }): Promise<ProjectMember> {
    const allMembers = getStorage<ProjectMember>('bpg_project_members', DEFAULT_MEMBERS);
    
    if (allMembers.some(m => m.projectId === projectId && m.userId === user.id)) {
      throw new Error('Thành viên này đã tham gia dự án.');
    }

    const newMember: ProjectMember = {
      projectId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      isLeader: false
    };

    allMembers.push(newMember);
    setStorage('bpg_project_members', allMembers);
    return newMember;
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    const allMembers = getStorage<ProjectMember>('bpg_project_members', DEFAULT_MEMBERS);
    const filtered = allMembers.filter(m => !(m.projectId === projectId && m.userId === userId));
    setStorage('bpg_project_members', filtered);
  },

  async toggleLeader(projectId: string, userId: string): Promise<ProjectMember[]> {
    const allMembers = getStorage<ProjectMember>('bpg_project_members', DEFAULT_MEMBERS);
    const updated = allMembers.map(m => {
      if (m.projectId === projectId && m.userId === userId) {
        return { ...m, isLeader: !m.isLeader };
      }
      return m;
    });
    setStorage('bpg_project_members', updated);
    return updated.filter(m => m.projectId === projectId);
  },

  // WBS PHASES & TASKS
  async getPhases(projectId: string): Promise<WBSPhase[]> {
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    return allPhases
      .filter(ph => ph.projectId === projectId)
      .map((ph, i) => ({ ...ph, sortOrder: ph.sortOrder ?? (i + 1) })) // backfill if missing
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async createPhase(projectId: string, name: string): Promise<WBSPhase> {
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    // Assign next sortOrder for this project
    const projectPhases = allPhases.filter(p => p.projectId === projectId);
    const maxOrder = projectPhases.reduce((m, p) => Math.max(m, p.sortOrder ?? 0), 0);
    const newPhase: WBSPhase = {
      id: `ph-${Date.now()}`,
      projectId,
      name,
      sortOrder: maxOrder + 1,
      status: 'active'
    };
    allPhases.push(newPhase);
    setStorage('bpg_wbs_phases', allPhases);
    return newPhase;
  },

  async updatePhase(phaseId: string, updates: Partial<Pick<WBSPhase, 'name'>>): Promise<WBSPhase> {
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const idx = allPhases.findIndex(p => p.id === phaseId);
    if (idx === -1) throw new Error('Không tìm thấy giai đoạn.');
    if (allPhases[idx].status === 'frozen') throw new Error('Giai đoạn đã nghiệm thu, không thể sửa tên.');
    allPhases[idx] = { ...allPhases[idx], ...updates };
    setStorage('bpg_wbs_phases', allPhases);
    return allPhases[idx];
  },

  async deletePhase(phaseId: string): Promise<void> {
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const phase = allPhases.find(p => p.id === phaseId);
    if (!phase) throw new Error('Không tìm thấy giai đoạn.');
    if (phase.status === 'frozen') throw new Error('Giai đoạn đã nghiệm thu, không thể xóa.');
    // Also remove all tasks belonging to this phase
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const filteredTasks = allTasks.filter(t => t.phaseId !== phaseId);
    setStorage('bpg_wbs_tasks', filteredTasks);
    const filteredPhases = allPhases.filter(p => p.id !== phaseId);
    setStorage('bpg_wbs_phases', filteredPhases);
  },

  async deleteTask(taskId: string): Promise<void> {
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const task = allTasks.find(t => t.id === taskId);
    if (!task) throw new Error('Không tìm thấy công việc.');
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const parentPhase = allPhases.find(p => p.id === task.phaseId);
    if (parentPhase && parentPhase.status === 'frozen') throw new Error('Giai đoạn đã đóng băng, không thể xóa việc.');
    if (task.progress > 0 || task.history.length > 0) {
      throw new Error('Công việc đã được cập nhật tiến độ. Vui lòng dùng chức năng "Hủy việc" thay vì xóa.');
    }
    const filtered = allTasks.filter(t => t.id !== taskId);
    setStorage('bpg_wbs_tasks', filtered);
    await this.syncProjectProgress(task.projectId);
  },

  async renameTask(taskId: string, newName: string): Promise<WBSTask> {
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const idx = allTasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('Không tìm thấy công việc.');
    const task = allTasks[idx];
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const parentPhase = allPhases.find(p => p.id === task.phaseId);
    if (parentPhase && parentPhase.status === 'frozen') throw new Error('Giai đoạn đã đóng băng, không thể đổi tên.');
    if (task.progress > 0 || task.history.length > 0) {
      throw new Error('Công việc đã được cập nhật tiến độ. Không thể đổi tên. Hãy hủy việc và tạo lại.');
    }
    allTasks[idx] = { ...task, name: newName };
    setStorage('bpg_wbs_tasks', allTasks);
    return allTasks[idx];
  },

  async reorderPhase(projectId: string, phaseId: string, direction: 'up' | 'down'): Promise<void> {
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const projectPhases = allPhases
      .filter(p => p.projectId === projectId)
      .map((p, i) => ({ ...p, sortOrder: p.sortOrder ?? (i + 1) }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = projectPhases.findIndex(p => p.id === phaseId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= projectPhases.length) return;
    // Swap sortOrders
    const tmpOrder = projectPhases[idx].sortOrder;
    projectPhases[idx].sortOrder = projectPhases[swapIdx].sortOrder;
    projectPhases[swapIdx].sortOrder = tmpOrder;
    // Write back updated sortOrders
    const updated = allPhases.map(p => {
      const match = projectPhases.find(pp => pp.id === p.id);
      return match ? { ...p, sortOrder: match.sortOrder } : p;
    });
    setStorage('bpg_wbs_phases', updated);
  },

  async getTasks(projectId: string): Promise<WBSTask[]> {
    return getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS)
      .filter(t => t.projectId === projectId)
      .map((t, i) => ({ ...t, sortOrder: t.sortOrder ?? (i + 1) })); // backfill if missing
    // Note: tasks are sorted per-phase in the component using sortOrder
  },

  async createTask(task: Omit<WBSTask, 'id' | 'progress' | 'history'>): Promise<WBSTask> {
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    
    // Check if phase is frozen
    const phases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const parentPhase = phases.find(p => p.id === task.phaseId);
    if (parentPhase && parentPhase.status === 'frozen') {
      throw new Error('Giai đoạn này đã bị đóng băng nghiệm thu. Không thể thêm công việc.');
    }

    const newTask: WBSTask = {
      ...task,
      id: `t-${Date.now()}`,
      progress: 0,
      history: [],
      sortOrder: (() => {
        // Assign next sortOrder within this phase
        const phaseTasks = allTasks.filter(t => t.phaseId === task.phaseId);
        return phaseTasks.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0) + 1;
      })()
    };
    allTasks.push(newTask);
    setStorage('bpg_wbs_tasks', allTasks);
    await this.syncProjectProgress(task.projectId);
    return newTask;
  },

  async reorderTask(phaseId: string, taskId: string, direction: 'up' | 'down'): Promise<void> {
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const phaseTasks = allTasks
      .filter(t => t.phaseId === phaseId)
      .map((t, i) => ({ ...t, sortOrder: t.sortOrder ?? (i + 1) }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = phaseTasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= phaseTasks.length) return;
    const tmpOrder = phaseTasks[idx].sortOrder;
    phaseTasks[idx].sortOrder = phaseTasks[swapIdx].sortOrder;
    phaseTasks[swapIdx].sortOrder = tmpOrder;
    const updated = allTasks.map(t => {
      const match = phaseTasks.find(pt => pt.id === t.id);
      return match ? { ...t, sortOrder: match.sortOrder } : t;
    });
    setStorage('bpg_wbs_tasks', updated);
  },

  async updateTask(id: string, updates: Partial<WBSTask>): Promise<WBSTask> {
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const idx = allTasks.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Không tìm thấy công việc.');

    const task = allTasks[idx];
    
    // Check phase status
    const phases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const parentPhase = phases.find(p => p.id === task.phaseId);
    if (parentPhase && parentPhase.status === 'frozen') {
      throw new Error('Giai đoạn này đã bị đóng băng nghiệm thu. Không thể chỉnh sửa.');
    }

    allTasks[idx] = { ...task, ...updates };
    setStorage('bpg_wbs_tasks', allTasks);
    await this.syncProjectProgress(task.projectId);
    return allTasks[idx];
  },

  async shiftDeadline(id: string, newDeadline: string, reason: string): Promise<WBSTask> {
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const idx = allTasks.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Không tìm thấy công việc.');

    const task = allTasks[idx];
    
    // Check phase status
    const phases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const parentPhase = phases.find(p => p.id === task.phaseId);
    if (parentPhase && parentPhase.status === 'frozen') {
      throw new Error('Giai đoạn này đã nghiệm thu đóng băng. Không thể dời hạn.');
    }

    const historyEntry: TaskHistory = {
      date: new Date().toLocaleString(),
      oldProgress: task.progress,
      newProgress: task.progress,
      reason: `Dời hạn từ ${task.deadline} đến ${newDeadline}. Lý do: ${reason}`
    };

    allTasks[idx] = {
      ...task,
      deadline: newDeadline,
      history: [historyEntry, ...task.history]
    };
    
    setStorage('bpg_wbs_tasks', allTasks);
    return allTasks[idx];
  },

  // DAILY LOGS & PROGRESS UPDATES
  async getDailyLogs(projectId: string): Promise<DailyLog[]> {
    const logs = getStorage<DailyLog>('bpg_daily_logs', DEFAULT_LOGS);
    return logs.filter(l => l.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date));
  },

  async createDailyLog(
    logData: Omit<DailyLog, 'id' | 'date' | 'comments'>,
    engineerName: string,
    userRole: string = 'kỹ sư',
    incidentCategory?: 'khach_quan' | 'chu_quan'
  ): Promise<DailyLog> {
    // Check if project is paused or done
    const projects = getStorage<Project>('bpg_projects', DEFAULT_PROJECTS);
    const project = projects.find(p => p.id === logData.projectId);
    if (project && (project.status === 'paused' || project.status === 'done')) {
      throw new Error('Dự án đang tạm dừng hoặc đã hoàn thành. Không thể cập nhật tiến độ.');
    }

    // 1. Validate progress - cannot go backwards
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const taskIdx = allTasks.findIndex(t => t.id === logData.taskId);
    if (taskIdx === -1) throw new Error('Không tìm thấy công việc.');
    
    const task = allTasks[taskIdx];
    
    // Validate decrease
    if (logData.progressTo < task.progress) {
      if (userRole !== 'tpkt' && userRole !== 'admin') {
        throw new Error(`Tiến độ báo cáo (${logData.progressTo}%) không thể nhỏ hơn tiến độ hiện tại (${task.progress}%). Vui lòng báo cáo TPKT để xử lý sự cố.`);
      }
    }

    // 2. Create the daily log
    const logs = getStorage<DailyLog>('bpg_daily_logs', DEFAULT_LOGS);
    const newLog: DailyLog = {
      ...logData,
      id: `l-${Date.now()}`,
      engineerName,
      date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' '), // "YYYY-MM-DD HH:MM"
      comments: []
    };
    logs.push(newLog);
    setStorage('bpg_daily_logs', logs);

    // 3. Update task progress & add to task history
    const type: TaskHistory['type'] = logData.progressTo < task.progress ? 'progress_decrease' : 'progress_increase';
    const historyEntry: TaskHistory = {
      date: newLog.date,
      oldProgress: task.progress,
      newProgress: logData.progressTo,
      reason: `Cập nhật tiến độ: ${logData.content}${logData.weather ? ` (Thời tiết: ${logData.weather})` : ''}`,
      type,
      adjustedBy: engineerName,
      incidentCategory: logData.progressTo < task.progress ? incidentCategory : undefined
    };

    allTasks[taskIdx] = {
      ...task,
      progress: logData.progressTo,
      history: [historyEntry, ...task.history]
    };
    setStorage('bpg_wbs_tasks', allTasks);

    // 4. Update project overall progress
    await this.syncProjectProgress(logData.projectId);

    return newLog;
  },

  async addLogComment(logId: string, user: { name: string; role: string; id: string }, content: string): Promise<DailyLogComment> {
    const logs = getStorage<DailyLog>('bpg_daily_logs', DEFAULT_LOGS);
    const logIdx = logs.findIndex(l => l.id === logId);
    if (logIdx === -1) throw new Error('Không tìm thấy bài nhật ký.');

    const newComment: DailyLogComment = {
      id: `c-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      role: user.role,
      content,
      date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' ')
    };

    logs[logIdx].comments.push(newComment);
    setStorage('bpg_daily_logs', logs);
    return newComment;
  },

  // PHASE ACCEPTANCE (FREEZE PHASE)
  async acceptPhase(
    phaseId: string,
    comment: string,
    details?: {
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
  ): Promise<WBSPhase> {
    const phases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const phaseIdx = phases.findIndex(p => p.id === phaseId);
    if (phaseIdx === -1) throw new Error('Không tìm thấy giai đoạn.');

    // Validate all tasks of this phase must be 100%
    const tasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS).filter(t => t.phaseId === phaseId && t.status !== 'obsolete');
    if (tasks.length === 0) {
      throw new Error('Giai đoạn này chưa có công việc nào hợp lệ.');
    }
    const uncompletedTasks = tasks.filter(t => t.progress < 100);
    if (uncompletedTasks.length > 0) {
      throw new Error(`Không thể nghiệm thu. Giai đoạn còn ${uncompletedTasks.length} công việc chưa đạt 100%.`);
    }

    if (!details && comment.trim().length < 50) {
      throw new Error('Văn bản nhận xét nghiệm thu phải từ 50 ký tự trở lên.');
    }

    phases[phaseIdx] = {
      ...phases[phaseIdx],
      status: 'frozen',
      acceptanceComment: comment,
      acceptanceDate: new Date().toLocaleDateString('vi-VN'),
      ...(details ? {
        acceptanceRepresentativeA: details.representativeA,
        acceptanceRoleA: details.roleA,
        acceptanceRepresentativeB: details.representativeB,
        acceptanceRoleB: details.roleB,
        acceptanceStartTime: details.startTime,
        acceptanceEndTime: details.endTime,
        acceptanceDrawings: details.drawings,
        acceptanceStandards: details.standards,
        acceptanceResults: details.results,
        acceptanceQuality: details.quality,
        acceptanceOpinions: details.opinions,
        acceptanceConclusion: details.conclusion,
      } : {})
    };

    setStorage('bpg_wbs_phases', phases);
    return phases[phaseIdx];
  },

  async revokePhase(phaseId: string, reason: string): Promise<WBSPhase> {
    const phases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const phaseIdx = phases.findIndex(p => p.id === phaseId);
    if (phaseIdx === -1) throw new Error('Không tìm thấy giai đoạn.');

    if (reason.trim().length < 20) {
      throw new Error('Lý do hủy nghiệm thu phải từ 20 ký tự trở lên.');
    }

    phases[phaseIdx] = {
      ...phases[phaseIdx],
      status: 'active',
      revocationComment: reason,
      revocationDate: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' ')
    };

    setStorage('bpg_wbs_phases', phases);
    return phases[phaseIdx];
  },

  async markTaskObsolete(taskId: string, reason: string, user: { name: string; role: string }): Promise<WBSTask> {
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const idx = allTasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('Không tìm thấy công việc.');

    const task = allTasks[idx];

    // Check phase status
    const phases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const parentPhase = phases.find(p => p.id === task.phaseId);
    if (parentPhase && parentPhase.status === 'frozen') {
      throw new Error('Giai đoạn này đã bị đóng băng nghiệm thu. Không thể hủy việc.');
    }

    const historyEntry: TaskHistory = {
      date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' '),
      oldProgress: task.progress,
      newProgress: task.progress,
      reason: `Đánh dấu hủy bỏ (Obsolete). Lý do: ${reason}`,
      type: 'obsolete',
      adjustedBy: user.name
    };

    allTasks[idx] = {
      ...task,
      status: 'obsolete',
      history: [historyEntry, ...task.history]
    };

    setStorage('bpg_wbs_tasks', allTasks);
    await this.syncProjectProgress(task.projectId);
    return allTasks[idx];
  }
};
