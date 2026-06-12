import type { Project, ProjectMember, PhaseMaterialItem, AcceptanceRecord, WBSPhase, IncidentReport, MaterialRequestItem, MaterialRequest, TaskHistory, WBSTask, DailyLogComment, DailyLog } from '../types/common';
import { USE_MOCK_API } from './api';

export * from '../types/common';

// Default initial data for simulation
const DEFAULT_PROJECTS: Project[] = [
  { id: 'p-1', name: 'Dự án Chung cư BPG - Biên Hòa', address: '12 Đường số 4, KCN Biên Hòa, Đồng Nai', startDate: '2026-05-01', endDate: '2026-12-30', status: 'active', drawingUrl: 'ban_ve_chung_cu_bpg_bien_hoa.pdf', progress: 45 },
  { id: 'p-2', name: 'Dự án Cải tạo Văn phòng FPT', address: 'Lô E2a-7, Đường D1, KCNC, Quận 9, TP.HCM', startDate: '2026-05-10', endDate: '2026-08-15', status: 'active', drawingUrl: 'thiet_ke_cai_tao_fpt.png', progress: 20 },
  { id: 'p-3', name: 'Dự án Biệt thự Nam Sài Gòn', address: 'Khu biệt thự Chateau, Phú Mỹ Hưng, Quận 7, TP.HCM', startDate: '2026-06-15', endDate: '2027-02-28', status: 'draft', drawingUrl: 'ban_ve_biet_thu_nam_sai_gon.pdf', progress: 0 },
  { id: 'p-4', name: 'Dự án Cầu đường Nhơn Trạch', address: 'Huyện Nhơn Trạch, Tỉnh Đồng Nai', startDate: '2026-01-01', endDate: '2026-05-20', status: 'paused', drawingUrl: 'quy_hoach_cau_nhon_trach.jpg', progress: 90 },
];

const DEFAULT_MEMBERS: ProjectMember[] = [
  { projectId: 'p-1', userId: 'u-3', userName: 'Trần Văn Công', userEmail: 'engineer@bpg.com', userRole: 'kỹ sư', isLeader: true },
  { projectId: 'p-1', userId: 'u-6', userName: 'Nguyễn Văn Nam', userEmail: 'se1@bpg.com', userRole: 'kỹ sư', isLeader: false },
  { projectId: 'p-1', userId: 'u-7', userName: 'Phạm Minh Hải', userEmail: 'se2@bpg.com', userRole: 'kỹ sư', isLeader: false },
  { projectId: 'p-2', userId: 'u-3', userName: 'Trần Văn Công', userEmail: 'engineer@bpg.com', userRole: 'kỹ sư', isLeader: false },
];

const DEFAULT_PHASES: WBSPhase[] = [
  { id: 'ph-1', projectId: 'p-1', sortOrder: 1, name: 'Phase 1: Móng & Cột Trụ', status: 'frozen', acceptanceComment: 'Hoàn thành tốt, đạt yêu cầu kỹ thuật đổ bê tông móng cốt thép trục A-H.', acceptanceDate: '2026-05-28', deadline: '2026-05-30' },
  { id: 'ph-2', projectId: 'p-1', sortOrder: 2, name: 'Phase 2: Thân chung cư (Tầng 1 - Tầng 5)', status: 'active', deadline: '2026-06-30' },
  { id: 'ph-3', projectId: 'p-1', sortOrder: 3, name: 'Phase 3: Hoàn thiện & Điện nước', status: 'active', deadline: '2026-08-30' },
  { id: 'ph-4', projectId: 'p-2', sortOrder: 1, name: 'Phase 1: Tháo dỡ & Đi dây cáp ngầm', status: 'active', deadline: '2026-06-20' },
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

const DEFAULT_INCIDENTS: IncidentReport[] = [];

const DEFAULT_MATERIAL_REQUESTS: MaterialRequest[] = [
  {
    id: 'mat-req-1',
    projectId: 'p-1',
    taskId: 't-rework-mock-1',
    taskName: '[Rework] Khắc phục - Đổ bê tông cột tầng 1',
    requesterName: 'Trần Văn Công',
    items: [
      { name: 'Xi măng Hải Vân M300', quantity: 20, unit: 'bao' },
      { name: 'Thép Pomina Φ10', quantity: 5, unit: 'cây' }
    ],
    status: 'pending_accountant',
    isOverBOQ: true,
    type: 'normal',
    reason: 'Bổ sung vật tư khắc phục sự cố sạt lở cột tầng 1.',
    date: '2026-06-01 08:30'
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

  async syncParentTaskProgress(parentId: string): Promise<void> {
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const children = allTasks.filter(t => t.parentTaskId === parentId && t.status !== 'obsolete');
    if (children.length === 0) return;
    
    const sum = children.reduce((acc, t) => acc + t.progress, 0);
    const avg = Math.round(sum / children.length);

    const parentIdx = allTasks.findIndex(t => t.id === parentId);
    if (parentIdx !== -1) {
      if (allTasks[parentIdx].progress !== avg) {
        allTasks[parentIdx].progress = avg;
        setStorage('bpg_wbs_tasks', allTasks);
        await this.syncProjectProgress(allTasks[parentIdx].projectId);
        
        // Recursive if the parent itself has a parent
        if (allTasks[parentIdx].parentTaskId) {
          await this.syncParentTaskProgress(allTasks[parentIdx].parentTaskId!);
        }
      }
    }
  },

  // PROJECTS CRUD
  async getProjects(): Promise<Project[]> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const projects = getStorage<Project>('bpg_projects', DEFAULT_PROJECTS);
      let changed = false;
      // dynamically update progresses
      for (const p of projects) {
        const tasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS).filter(t => t.projectId === p.id && t.status !== 'obsolete');
        if (tasks.length > 0) {
          const sum = tasks.reduce((acc, t) => acc + t.progress, 0);
          const newProgress = Math.round(sum / tasks.length);
          if (p.progress !== newProgress) {
            p.progress = newProgress;
            changed = true;
          }
        }
        
        // backfill drawingUrl for default mock projects if not set
        if (!p.drawingUrl) {
          if (p.id === 'p-1') { p.drawingUrl = 'ban_ve_chung_cu_bpg_bien_hoa.pdf'; changed = true; }
          else if (p.id === 'p-2') { p.drawingUrl = 'thiet_ke_cai_tao_fpt.png'; changed = true; }
          else if (p.id === 'p-3') { p.drawingUrl = 'ban_ve_biet_thu_nam_sai_gon.pdf'; changed = true; }
          else if (p.id === 'p-4') { p.drawingUrl = 'quy_hoach_cau_nhon_trach.jpg'; changed = true; }
        }
      }
      if (changed) {
        setStorage('bpg_projects', projects);
      }
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

  async activateProject(projectId: string): Promise<Project> {
    const project = await this.getProjectById(projectId);
    if (!project) throw new Error('Không tìm thấy dự án.');
    if (project.status !== 'draft') throw new Error('Dự án không ở trạng thái bản nháp.');

    const tasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS).filter(t => t.projectId === projectId && t.status !== 'obsolete');
    
    if (tasks.length === 0) {
      throw new Error('Cơ cấu WBS phải có ít nhất 1 công việc trước khi Kích hoạt.');
    }

    const projectStartDate = new Date(project.startDate);
    const invalidTasks = tasks.filter(t => new Date(t.deadline) < projectStartDate);
    
    if (invalidTasks.length > 0) {
      throw new Error(`Có ${invalidTasks.length} công việc có Hạn chót nhỏ hơn Ngày bắt đầu dự án (${project.startDate}). Vui lòng điều chỉnh lại kế hoạch WBS.`);
    }

    return this.updateProject(projectId, { status: 'active' });
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

  async createPhase(
    projectId: string,
    name: string,
    startDate?: string,
    endDate?: string,
    materials?: PhaseMaterialItem[]
  ): Promise<WBSPhase> {
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    // Assign next sortOrder for this project
    const projectPhases = allPhases.filter(p => p.projectId === projectId);
    const maxOrder = projectPhases.reduce((m, p) => Math.max(m, p.sortOrder ?? 0), 0);
    const newPhase: WBSPhase = {
      id: `ph-${Date.now()}`,
      projectId,
      name,
      sortOrder: maxOrder + 1,
      status: 'active',
      startDate,
      endDate,
      deadline: endDate,
      materials
    };
    allPhases.push(newPhase);
    setStorage('bpg_wbs_phases', allPhases);

    // Auto-create Phase-level Material Request if materials exist
    if (materials && materials.length > 0) {
      const requestItems = materials.map(m => ({
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        price: 0
      }));

      const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
      const newRequest: MaterialRequest = {
        id: `mat-req-${Date.now()}`,
        projectId,
        phaseId: newPhase.id,
        phaseName: newPhase.name,
        requesterName: 'Leader (Tạo Phase)',
        items: requestItems,
        status: 'pending_accountant',
        isOverBOQ: false,
        type: 'normal',
        reason: `Yêu cầu cấp vật tư lập kế hoạch cho Giai đoạn: ${name}`,
        date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' ')
      };
      list.push(newRequest);
      setStorage('bpg_material_requests', list);
    }

    return newPhase;
  },

  async updatePhase(phaseId: string, updates: Partial<WBSPhase>): Promise<WBSPhase> {
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const idx = allPhases.findIndex(p => p.id === phaseId);
    if (idx === -1) throw new Error('Không tìm thấy giai đoạn.');
    if (allPhases[idx].status === 'frozen' && updates.name) {
      throw new Error('Giai đoạn đã nghiệm thu, không thể sửa tên.');
    }
    allPhases[idx] = { ...allPhases[idx], ...updates };
    setStorage('bpg_wbs_phases', allPhases);
    return allPhases[idx];
  },

  async updatePhaseMaterials(phaseId: string, materials: PhaseMaterialItem[]): Promise<WBSPhase> {
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const idx = allPhases.findIndex(p => p.id === phaseId);
    if (idx === -1) throw new Error('Không tìm thấy giai đoạn.');
    if (allPhases[idx].status === 'frozen') {
      throw new Error('Giai đoạn đã đóng băng nghiệm thu, không thể cập nhật BOQ.');
    }
    allPhases[idx] = { ...allPhases[idx], materials };
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
    // Also delete any subtasks of this task
    const filtered = allTasks.filter(t => t.id !== taskId && t.parentTaskId !== taskId);
    setStorage('bpg_wbs_tasks', filtered);
    await this.syncProjectProgress(task.projectId);
    if (task.parentTaskId) {
      await this.syncParentTaskProgress(task.parentTaskId);
    }
  },

  async cancelTask(taskId: string, reason: string, user: string): Promise<void> {
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const idx = allTasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('Không tìm thấy công việc.');
    
    allTasks[idx].status = 'obsolete';
    allTasks[idx].history.unshift({
      date: new Date().toISOString(),
      oldProgress: allTasks[idx].progress,
      newProgress: allTasks[idx].progress,
      reason: `Hủy công việc: ${reason}`,
      type: 'status_change',
      adjustedBy: user
    });
    setStorage('bpg_wbs_tasks', allTasks);
    await this.syncProjectProgress(allTasks[idx].projectId);
    if (allTasks[idx].parentTaskId) {
      await this.syncParentTaskProgress(allTasks[idx].parentTaskId!);
    }
  },

  async adjustTaskDeadline(taskId: string, newDeadline: string, reason: string, user: string): Promise<void> {
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const idx = allTasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('Không tìm thấy công việc.');
    
    allTasks[idx].deadline = newDeadline;
    allTasks[idx].history.unshift({
      date: new Date().toISOString(),
      oldProgress: allTasks[idx].progress,
      newProgress: allTasks[idx].progress,
      reason: `Dời hạn hoàn thành (hạn mới: ${newDeadline}): ${reason}`,
      type: 'deadline_shift',
      adjustedBy: user
    });
    setStorage('bpg_wbs_tasks', allTasks);
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

    // Validate deadline against Phase deadline
    if (parentPhase && parentPhase.deadline && task.deadline) {
      if (new Date(task.deadline) > new Date(parentPhase.deadline)) {
        throw new Error(`Hạn chót của công việc (${task.deadline}) không được vượt quá hạn chót của Giai đoạn (${parentPhase.deadline}).`);
      }
    }

    // Validate deadline against Parent Task deadline (if it is a subtask)
    if (task.parentTaskId) {
      const parentTask = allTasks.find(t => t.id === task.parentTaskId);
      if (parentTask && parentTask.deadline && task.deadline) {
        if (new Date(task.deadline) > new Date(parentTask.deadline)) {
          throw new Error(`Hạn chót của công việc con (${task.deadline}) không được vượt quá hạn chót của Công việc cha (${parentTask.deadline}).`);
        }
      }
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
    if (task.parentTaskId) {
      await this.syncParentTaskProgress(task.parentTaskId);
    }
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

    // Kiểm tra xem task có subtask không. Nếu có thì không cho phép cập nhật tiến độ thủ công.
    const children = allTasks.filter(t => t.parentTaskId === task.id && t.status !== 'obsolete');
    if (children.length > 0) {
      throw new Error('Công việc này có các công việc con. Tiến độ sẽ được tự động tính toán từ các công việc con.');
    }
    
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

    // 4. Update project overall progress and parent task progress
    await this.syncProjectProgress(logData.projectId);
    if (task.parentTaskId) {
      await this.syncParentTaskProgress(task.parentTaskId);
    }

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
    const isPassed = details ? !details.conclusion.includes('Không chấp nhận') : true;

    const newRecord: AcceptanceRecord = {
      id: `acc-${Date.now()}`,
      date: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN'),
      isPassed,
      representativeA: details?.representativeA || '',
      roleA: details?.roleA || '',
      representativeB: details?.representativeB || '',
      roleB: details?.roleB || '',
      startTime: details?.startTime || '',
      endTime: details?.endTime || '',
      drawings: details?.drawings || '',
      standards: details?.standards || '',
      results: details?.results || '',
      quality: details?.quality || '',
      opinions: details?.opinions || '',
      conclusion: details?.conclusion || ''
    };

    phases[phaseIdx] = {
      ...phases[phaseIdx],
      status: isPassed ? 'frozen' : 'active',
      acceptanceComment: isPassed ? comment : phases[phaseIdx].acceptanceComment,
      acceptanceDate: isPassed ? new Date().toLocaleDateString('vi-VN') : phases[phaseIdx].acceptanceDate,
      ...(details && isPassed ? {
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
      } : {}),
      acceptanceHistory: isPassed ? phases[phaseIdx].acceptanceHistory : [...(phases[phaseIdx].acceptanceHistory || []), newRecord]
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

    const currentPhase = phases[phaseIdx];

    // Ghi nhận lại biên bản thành công trước đó thành một lịch sử thất bại (do bị huỷ)
    const revokedRecord: AcceptanceRecord = {
      id: `rev-${Date.now()}`,
      date: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN'),
      isPassed: false,
      representativeA: currentPhase.acceptanceRepresentativeA || '',
      roleA: currentPhase.acceptanceRoleA || '',
      representativeB: currentPhase.acceptanceRepresentativeB || '',
      roleB: currentPhase.acceptanceRoleB || '',
      startTime: currentPhase.acceptanceStartTime || '',
      endTime: currentPhase.acceptanceEndTime || '',
      drawings: currentPhase.acceptanceDrawings || '',
      standards: currentPhase.acceptanceStandards || '',
      results: currentPhase.acceptanceResults || '',
      quality: currentPhase.acceptanceQuality || '',
      opinions: currentPhase.acceptanceOpinions || '',
      conclusion: `[ĐÃ BỊ HỦY NGHIỆM THU] Lý do: ${reason}`
    };

    phases[phaseIdx] = {
      ...currentPhase,
      status: 'active',
      revocationComment: reason,
      revocationDate: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' '),
      acceptanceHistory: [...(currentPhase.acceptanceHistory || []), revokedRecord]
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
  },

  // INCIDENTS & REWORK APIs
  async getIncidents(projectId: string): Promise<IncidentReport[]> {
    const list = getStorage<IncidentReport>('bpg_incidents', DEFAULT_INCIDENTS);
    return list.filter(i => i.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date));
  },

  async createIncident(incident: Omit<IncidentReport, 'id' | 'date' | 'status'>): Promise<IncidentReport> {
    const list = getStorage<IncidentReport>('bpg_incidents', DEFAULT_INCIDENTS);
    const newIncident: IncidentReport = {
      ...incident,
      id: `inc-${Date.now()}`,
      date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' '),
      status: 'WaitingReview'
    };
    list.push(newIncident);
    setStorage('bpg_incidents', list);
    return newIncident;
  },

  async resolveIncident(
    incidentId: string, 
    resolutionType: 'rework' | 'reduce_progress',
    resolutionData: any, 
    tpkt: { id: string, name: string }
  ): Promise<IncidentReport> {
    const list = getStorage<IncidentReport>('bpg_incidents', DEFAULT_INCIDENTS);
    const idx = list.findIndex(i => i.id === incidentId);
    if (idx === -1) throw new Error('Không tìm thấy báo cáo sự cố.');
    
    const incident = list[idx];

    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const originalTaskIdx = allTasks.findIndex(t => t.id === incident.taskId);
    if (originalTaskIdx === -1) throw new Error('Không tìm thấy công việc gốc bị sự cố.');

    const oldTask = allTasks[originalTaskIdx];

    if (resolutionType === 'rework') {
      // 1. Mark the original task as obsolete
      const reworkTaskData = resolutionData as { name: string, deadline: string, assignedTo: string, assignedName: string };
      const oldHistoryEntry: TaskHistory = {
        date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' '),
        oldProgress: oldTask.progress,
        newProgress: oldTask.progress,
        reason: `Đánh dấu Obsolete do sự cố: ${incident.description}. Giải quyết bởi TPKT ${tpkt.name}. Rework: ${reworkTaskData.name}`,
        type: 'obsolete',
        adjustedBy: tpkt.name
      };

      allTasks[originalTaskIdx] = {
        ...oldTask,
        status: 'obsolete',
        history: [oldHistoryEntry, ...oldTask.history]
      };

      // 2. Create the Rework task
      const nextOrder = allTasks.filter(t => t.phaseId === oldTask.phaseId).reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0) + 1;
      const reworkTask: WBSTask = {
        id: `t-rework-${Date.now()}`,
        phaseId: oldTask.phaseId,
        projectId: oldTask.projectId,
        name: reworkTaskData.name,
        sortOrder: nextOrder,
        assignedTo: reworkTaskData.assignedTo,
        assignedName: reworkTaskData.assignedName,
        deadline: reworkTaskData.deadline,
        progress: 0,
        history: [{
          date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' '),
          oldProgress: 0,
          newProgress: 0,
          reason: 'Khởi tạo công việc khắc phục (Rework) từ sự cố: ' + incident.description,
          type: 'created',
          adjustedBy: tpkt.name
        }],
        status: 'active',
        isRework: true
      };

      allTasks.push(reworkTask);
      list[idx].reworkTaskId = reworkTask.id;
    } else if (resolutionType === 'reduce_progress') {
      const reduceData = resolutionData as { reduction: number, reason: string };
      const newProgress = Math.max(0, oldTask.progress - reduceData.reduction);
      
      const historyEntry: TaskHistory = {
        date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' '),
        oldProgress: oldTask.progress,
        newProgress: newProgress,
        reason: `Trừ ${reduceData.reduction}% tiến độ do sự cố: ${reduceData.reason}. Giải quyết bởi TPKT ${tpkt.name}.`,
        type: 'update',
        adjustedBy: tpkt.name
      };

      allTasks[originalTaskIdx] = {
        ...oldTask,
        progress: newProgress,
        history: [historyEntry, ...oldTask.history]
      };
    }

    setStorage('bpg_wbs_tasks', allTasks);
    await this.syncProjectProgress(oldTask.projectId);

    // Update Incident status
    list[idx].status = 'Approved';
    list[idx].reviewerId = tpkt.id;
    list[idx].reviewerName = tpkt.name;

    setStorage('bpg_incidents', list);
    return list[idx];
  },

  // MATERIAL REQUESTS FOR REWORK & COMPENSATION (Section 1.7)
  async getMaterialRequests(projectId: string): Promise<MaterialRequest[]> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    return list.filter(r => r.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date));
  },

  async getAllMaterialRequests(): Promise<MaterialRequest[]> {
    return getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS).sort((a, b) => b.date.localeCompare(a.date));
  },

  async createMaterialRequest(
    request: Omit<MaterialRequest, 'id' | 'status' | 'date'> & { isOverBOQ?: boolean },
    userRole?: string,
    isLeader?: boolean
  ): Promise<MaterialRequest> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    
    const isRework = request.taskName ? (request.taskName.startsWith('[Rework]') || request.taskName.toLowerCase().includes('rework') || request.taskName.toLowerCase().includes('khắc phục')) : false;
    
    const isEmergency = request.type === 'emergency';
    
    if (isEmergency && !request.invoiceImage) {
      throw new Error('Yêu cầu mua ngoài khẩn cấp bắt buộc phải tải ảnh hóa đơn.');
    }

    const defaultIsOverBOQ = request.isOverBOQ !== undefined ? request.isOverBOQ : isRework;

    let initialStatus: MaterialRequest['status'] = 'pending_accountant';
    
    if (isEmergency) {
      initialStatus = 'pending_disbursement';
    } else if (userRole === 'kỹ sư' && !isLeader) {
      initialStatus = 'pending_leader';
    }

    const newRequest: MaterialRequest = {
      ...request,
      id: `mat-req-${Date.now()}`,
      status: initialStatus,
      approvedBy: isEmergency ? 'Hệ thống (Tự động PO & Nhập kho)' : undefined,
      isOverBOQ: defaultIsOverBOQ,
      date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' ')
    };
    
    list.push(newRequest);
    setStorage('bpg_material_requests', list);
    return newRequest;
  },

  async aggregateSERequests(
    requestIds: string[],
    phaseId: string,
    phaseName: string,
    leaderName: string,
    isOverBOQ: boolean,
    reason?: string
  ): Promise<MaterialRequest> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    
    const selectedReqs = list.filter(r => requestIds.includes(r.id) && r.status === 'pending_leader');
    if (selectedReqs.length === 0) throw new Error('Không có yêu cầu hợp lệ nào để tổng hợp.');

    const mergedItems: Record<string, MaterialRequestItem> = {};
    selectedReqs.forEach(req => {
      req.items.forEach(item => {
        if (mergedItems[item.name]) {
          mergedItems[item.name].quantity += item.quantity;
        } else {
          mergedItems[item.name] = { ...item };
        }
      });
      // Update SE request status
      const idx = list.findIndex(r => r.id === req.id);
      if (idx !== -1) {
        list[idx].status = 'approved_by_leader';
        list[idx].approvedBy = leaderName;
      }
    });

    const finalItems = Object.values(mergedItems);

    const aggregatedReq: MaterialRequest = {
      id: `mat-req-${Date.now()}`,
      projectId: selectedReqs[0].projectId,
      phaseId,
      phaseName,
      requesterName: leaderName,
      items: finalItems,
      status: isOverBOQ ? 'pending_director' : 'pending_accountant',
      isOverBOQ,
      reason: reason || `Tổng hợp từ ${selectedReqs.length} yêu cầu của Kỹ sư hiện trường.`,
      type: 'normal',
      date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' ')
    };

    list.push(aggregatedReq);
    setStorage('bpg_material_requests', list);
    return aggregatedReq;
  },

  async getMaterialUsage(phaseId: string, materialName: string): Promise<number> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    let total = 0;
    list.forEach(req => {
      // Chỉ tính các yêu cầu thuộc phase này và KHÔNG BỊ TỪ CHỐI
      if (req.phaseId === phaseId && req.status !== 'rejected') {
        const item = req.items.find(i => i.name === materialName);
        if (item) {
          total += item.quantity;
        }
      }
    });
    return total;
  },

  async cancelMaterialRequest(requestId: string, reason: string): Promise<void> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Không tìm thấy yêu cầu vật tư.');
    
    if (list[idx].status !== 'pending_accountant') {
      throw new Error('Chỉ có thể hủy yêu cầu khi đang chờ Kế toán duyệt.');
    }
    
    list[idx].status = 'rejected';
    list[idx].rejectionReason = `Người tạo tự hủy: ${reason}`;
    setStorage('bpg_material_requests', list);
  },

  async processMaterialRequestByAccountant(requestId: string): Promise<MaterialRequest> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Không tìm thấy yêu cầu vật tư.');
    
    const request = list[idx];
    if (request.isOverBOQ) {
      request.status = 'pending_director'; // Trình Giám đốc duyệt
    } else {
      request.status = 'approved'; // Duyệt luôn cấp PO
      request.approvedBy = 'Kế toán (Duyệt trong định mức)';
      
      // Auto-add to Phase BOQ if it's a Phase request
      if (!request.taskId && request.phaseId) {
        const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', []);
        const phaseIdx = allPhases.findIndex(p => p.id === request.phaseId);
        if (phaseIdx !== -1) {
          const currentMaterials = allPhases[phaseIdx].materials || [];
          request.items.forEach(reqItem => {
            const exist = currentMaterials.find(m => m.name === reqItem.name);
            if (exist) {
              exist.quantity += reqItem.quantity;
            } else {
              currentMaterials.push({ name: reqItem.name, quantity: reqItem.quantity, unit: reqItem.unit });
            }
          });
          allPhases[phaseIdx].materials = currentMaterials;
          setStorage('bpg_wbs_phases', allPhases);
        }
      }
    }

    setStorage('bpg_material_requests', list);
    return list[idx];
  },

  async disburseEmergencyRequest(requestId: string): Promise<MaterialRequest> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Không tìm thấy yêu cầu vật tư.');
    
    list[idx] = {
      ...list[idx],
      status: 'disbursed',
      approvedBy: 'Kế toán (Đã giải ngân chi phí)'
    };
    setStorage('bpg_material_requests', list);
    return list[idx];
  },

  async approveMaterialRequestByDirector(requestId: string, approvedBy: string): Promise<MaterialRequest> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Không tìm thấy yêu cầu vật tư.');
    
    list[idx] = {
      ...list[idx],
      status: 'approved',
      approvedBy
    };

    // Auto-add to Phase BOQ if it's a Phase request
    const request = list[idx];
    if (!request.taskId && request.phaseId) {
      const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', []);
      const phaseIdx = allPhases.findIndex(p => p.id === request.phaseId);
      if (phaseIdx !== -1) {
        const currentMaterials = allPhases[phaseIdx].materials || [];
        request.items.forEach(reqItem => {
          const exist = currentMaterials.find(m => m.name === reqItem.name);
          if (exist) {
            exist.quantity += reqItem.quantity;
          } else {
            currentMaterials.push({ name: reqItem.name, quantity: reqItem.quantity, unit: reqItem.unit });
          }
        });
        allPhases[phaseIdx].materials = currentMaterials;
        setStorage('bpg_wbs_phases', allPhases);
      }
    }

    setStorage('bpg_material_requests', list);
    return list[idx];
  },

  async rejectMaterialRequest(requestId: string, reason: string): Promise<MaterialRequest> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Không tìm thấy yêu cầu vật tư.');
    
    list[idx] = {
      ...list[idx],
      status: 'rejected',
      rejectionReason: reason
    };
    setStorage('bpg_material_requests', list);
    return list[idx];
  },

  async approveMaterialRequestByLeader(requestId: string, leaderName: string): Promise<MaterialRequest> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Không tìm thấy yêu cầu vật tư.');
    
    const request = list[idx];
    if (request.status !== 'pending_leader') throw new Error('Yêu cầu không ở trạng thái chờ Leader duyệt.');

    const tasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const task = tasks.find(t => t.id === request.taskId);
    if (task && task.estimatedMaterials) {
      for (const reqItem of request.items) {
        const estItem = task.estimatedMaterials.find(m => m.name === reqItem.name);
        const estQty = estItem ? estItem.quantity : 0;
        
        const existingRequests = list.filter(r => r.taskId === task.id && r.id !== request.id && r.status !== 'rejected');
        const existingQty = existingRequests.reduce((sum, r) => {
          const matched = r.items.find(i => i.name === reqItem.name);
          return sum + (matched ? matched.quantity : 0);
        }, 0);

        if (existingQty + reqItem.quantity > estQty) {
          throw new Error(`Số lượng ${reqItem.name} yêu cầu (${existingQty + reqItem.quantity}) vượt quá mức định mức của Task (${estQty}).`);
        }
      }
    }

    list[idx] = {
      ...request,
      status: 'pending_tpkt',
      approvedBy: leaderName
    };
    
    setStorage('bpg_material_requests', list);
    return list[idx];
  },

  async approveMaterialRequestByTPKT(requestId: string, tpktName: string): Promise<MaterialRequest> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Không tìm thấy yêu cầu vật tư.');
    
    const request = list[idx];
    if (request.status !== 'pending_tpkt') throw new Error('Yêu cầu không ở trạng thái chờ TPKT duyệt.');

    list[idx] = {
      ...request,
      status: 'pending_accountant',
      approvedBy: tpktName
    };
    
    setStorage('bpg_material_requests', list);
    return list[idx];
  },

  async confirmMaterialReceived(requestId: string, leaderName: string): Promise<MaterialRequest> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Không tìm thấy yêu cầu vật tư.');
    
    const request = list[idx];
    if (request.status !== 'approved' && request.status !== 'disbursed') {
      throw new Error('Chỉ có thể nhận vật tư đã được kế toán duyệt/giải ngân.');
    }

    list[idx] = {
      ...request,
      status: 'received',
      approvedBy: `${request.approvedBy || ''} - Nhận bởi: ${leaderName}`
    };
    
    setStorage('bpg_material_requests', list);
    return list[idx];
  },

  async resubmitMaterialRequest(
    requestId: string,
    updates: Partial<Pick<MaterialRequest, 'items' | 'reason' | 'invoiceImage' | 'type' | 'isOverBOQ'>>,
    userRole?: string,
    isLeader?: boolean
  ): Promise<MaterialRequest> {
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Không tìm thấy yêu cầu vật tư.');
    
    const request = list[idx];
    if (request.status !== 'rejected') {
      throw new Error('Chỉ có thể gửi lại yêu cầu đã bị từ chối.');
    }

    const type = updates.type ?? request.type;
    const isEmergency = type === 'emergency';

    let newStatus: MaterialRequest['status'] = 'pending_accountant';
    if (isEmergency) {
      newStatus = 'pending_disbursement';
    } else if (request.taskId) {
      if (userRole === 'kỹ sư' && !isLeader) {
        newStatus = 'pending_leader';
      } else if (userRole === 'kỹ sư' && isLeader) {
        newStatus = 'pending_tpkt';
      }
    }

    list[idx] = {
      ...request,
      ...updates,
      status: newStatus,
      approvedBy: isEmergency ? 'Hệ thống (Tự động PO & Nhập kho)' : undefined,
      rejectionReason: undefined,
      date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' ')
    };

    setStorage('bpg_material_requests', list);
    return list[idx];
  },

  async addIncidentComment(incidentId: string, user: { name: string; role: string; id: string }, content: string): Promise<DailyLogComment> {
    const list = getStorage<IncidentReport>('bpg_incidents', DEFAULT_INCIDENTS);
    const idx = list.findIndex(i => i.id === incidentId);
    if (idx === -1) throw new Error('Không tìm thấy báo cáo sự cố.');

    const newComment: DailyLogComment = {
      id: `c-inc-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      role: user.role,
      content,
      date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' ')
    };

    if (!list[idx].comments) {
      list[idx].comments = [];
    }
    list[idx].comments!.push(newComment);
    setStorage('bpg_incidents', list);
    return newComment;
  }
};
