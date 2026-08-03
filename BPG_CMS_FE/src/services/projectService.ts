import type { Project, ProjectAccess, ProjectMember, PhaseMaterialItem, AcceptanceRecord, WBSPhase, IncidentReport, MaterialRequestItem, MaterialRequest, TaskHistory, WBSTask, DailyLogComment, DailyLog, TaskProgressLog } from '../types/common';
import { apiClient, USE_MOCK_API } from './api';
import { userService } from './userService';
import type { UserProfile } from './authService';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export * from '../types/common';

// Default initial data for simulation
const DEFAULT_PROJECTS: Project[] = [];
const DEFAULT_MEMBERS: ProjectMember[] = [];
const DEFAULT_PHASES: WBSPhase[] = [];
const DEFAULT_TASKS: WBSTask[] = [];
const DEFAULT_LOGS: DailyLog[] = [];
const DEFAULT_INCIDENTS: IncidentReport[] = [];
const DEFAULT_MATERIAL_REQUESTS: MaterialRequest[] = [];

// Helper functions for localStorage
const getStorage = <T>(key: string, defaults: T[]): T[] => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(data);
};

const formatToLocalTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const normalized = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : (dateStr.includes('T') ? dateStr + 'Z' : dateStr.replace(' ', 'T') + 'Z');
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return dateStr;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return dateStr.replace('T', ' ').slice(0, 16);
  }
};

const setStorage = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const projectDetailRequests = new Map<string, Promise<any>>();
const projectDetailCache = new Map<string, { data: any, timestamp: number }>();

async function getRawProjectDetail(projectId: string, forceRefresh = false): Promise<any> {
  const parsedId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
  
  if (forceRefresh) {
    projectDetailCache.delete(parsedId);
  }
  
  if (!forceRefresh && projectDetailRequests.has(parsedId)) {
    return projectDetailRequests.get(parsedId)!;
  }
  
  const cached = projectDetailCache.get(parsedId);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < 5000) {
    return cached.data;
  }
  
  const promise = (async () => {
    try {
      const res = await apiClient.get<ApiResponse<any>>(`/projects/${parsedId}`);
      if (res.success && res.data) {
        projectDetailCache.set(parsedId, { data: res.data, timestamp: Date.now() });
      }
      return res.data;
    } catch (err) {
      return null;
    } finally {
      projectDetailRequests.delete(parsedId);
    }
  })();
  
  projectDetailRequests.set(parsedId, promise);
  return promise;
}

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
  async getDashboardMetrics(): Promise<import('../types/common').DashboardMetricsDto> {
    if (!USE_MOCK_API) {
      const res = await apiClient.get<ApiResponse<import('../types/common').DashboardMetricsDto>>('/projects/metrics');
      if (res.success && res.data) return res.data;
    }
    const projects = await this.getProjects();
    const activeProjects = projects.filter(p => p.status === 'inprogress' || p.status === 'paused');
    return {
      totalProjects: projects.length,
      draftProjects: projects.filter(p => p.status === 'draft').length,
      activeProjects: projects.filter(p => p.status === 'inprogress').length,
      pausedProjects: projects.filter(p => p.status === 'paused').length,
      completedProjects: projects.filter(p => p.status === 'done').length,
      closedProjects: 0,
      activeProjectsProgress: activeProjects.map(p => ({
        projectId: parseInt(p.id.replace('p-', '')) || 0,
        projectName: p.name,
        address: p.address,
        progress: p.progress,
        status: p.status
      }))
    };
  },

  async getDashboardWarnings(): Promise<import('../types/common').DashboardWarningDto[]> {
    if (!USE_MOCK_API) {
      const res = await apiClient.get<ApiResponse<import('../types/common').DashboardWarningDto[]>>('/projects/dashboard/warnings');
      if (res.success && res.data) return res.data;
    }
    return [];
  },

  async getProjects(): Promise<Project[]> {
    if (!USE_MOCK_API) {
      const res = await apiClient.get<ApiResponse<{ items: import('../types/common').ProjectDto[], totalCount: number }>>('/projects?pageSize=100');
      if (!res.success) throw new Error(res.message || 'Lỗi lấy danh sách dự án');
      
      const mapped = res.data.items.map(p => ({
        id: p.projectId.toString(),
        name: p.name,
        address: p.address || '',
        startDate: p.plannedStart,
        endDate: p.plannedEnd,
        status: p.status.toLowerCase() as any,
        progress: p.progress || 0,
        pauseReason: p.pauseReason,
        pausedAt: p.pausedAt
      }));

      // Remove local storage logic for progress
      return mapped;
    }
    // MOCK API
    await new Promise(resolve => setTimeout(resolve, 300));
    const projects = getStorage<Project>('bpg_projects', DEFAULT_PROJECTS);
    let changed = false;
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
      if (!p.drawingUrl) {
        if (p.id === 'p-1') { p.drawingUrl = 'ban_ve_chung_cu_bpg_bien_hoa.pdf'; changed = true; }
        else if (p.id === 'p-2') { p.drawingUrl = 'thiet_ke_cai_tao_fpt.png'; changed = true; }
        else if (p.id === 'p-3') { p.drawingUrl = 'ban_ve_biet_thu_nam_sai_gon.pdf'; changed = true; }
        else if (p.id === 'p-4') { p.drawingUrl = 'quy_hoach_cau_nhon_trach.jpg'; changed = true; }
      }
    }
    if (changed) setStorage('bpg_projects', projects);
    return projects;
  },

  clearProjectDetailCache(projectId?: string): void {
    if (projectId) {
      const parsedId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
      projectDetailCache.delete(parsedId);
    } else {
      projectDetailCache.clear();
    }
  },

  async getProjectById(id: string, forceRefresh = false): Promise<Project | null> {
    if (!USE_MOCK_API) {
      try {
        const p = await getRawProjectDetail(id, forceRefresh);
        if (!p) return null;
        const designAttachments = p.attachments?.filter((a: any) => a.attachmentType === 'Design') || [];
        const drawingAttachment = designAttachments.length > 0 ? designAttachments[0] : null;
        
        const project: Project = {
          id: p.projectId.toString(),
          name: p.name,
          address: p.address || '',
          startDate: p.plannedStart,
          endDate: p.plannedEnd,
          status: p.status.toLowerCase() as any,
          drawingUrl: drawingAttachment?.fileUrl || '',
          drawingUrls: designAttachments.map((a: any) => a.fileUrl).filter(Boolean),
          attachments: p.attachments,
          progress: p.progress || 0,
          pauseReason: p.pauseReason,
          pausedAt: p.pausedAt
        };
        // Removed local storage override
        return project;
      } catch (err) {
        return null;
      }
    }
    const normalizedId = id.match(/^\d+$/) ? `p-${id}` : id;
    const projects = await this.getProjects();
    return projects.find(p => p.id === normalizedId || p.id === id) || null;
  },

  async createProject(project: Omit<Project, 'id' | 'progress'>): Promise<Project & { __message?: string }> {
    if (!USE_MOCK_API) {
      let attachments = [];
      
      if (project.attachments && project.attachments.length > 0) {
        attachments = project.attachments.map(a => ({
            attachmentType: 'Design',
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            contentType: a.contentType || 'application/pdf',
            fileSizeBytes: a.fileSizeBytes || 1024
        })) as any[];
      } else {
        if (project.drawingUrl) {
          attachments.push({
            attachmentType: 'Design',
            fileName: project.drawingUrl,
            fileUrl: '/mock/url',
            contentType: 'application/pdf',
            fileSizeBytes: 1024
          });
        }
        if (project.drawingUrls && project.drawingUrls.length > 0) {
          project.drawingUrls.forEach(url => {
            attachments.push({
              attachmentType: 'Design',
              fileName: url,
              fileUrl: '/mock/url',
              contentType: 'application/pdf',
              fileSizeBytes: 1024
            });
          });
        }
      }

      const payload = {
        name: project.name,
        address: project.address,
        plannedStart: project.startDate,
        plannedEnd: project.endDate,
        attachments: attachments
      };
      const res = await apiClient.post<ApiResponse<import('../types/common').ProjectDto>>('/projects', payload);
      if (!res.success) throw new Error(res.message || 'Không thể khởi tạo dự án.');
      return {
        id: res.data.projectId.toString(),
        name: res.data.name,
        address: res.data.address || '',
        startDate: res.data.plannedStart,
        endDate: res.data.plannedEnd,
        status: res.data.status.toLowerCase() as any,
        drawingUrl: project.drawingUrl || (project.drawingUrls?.[0]),
        drawingUrls: project.drawingUrls,
        progress: 0,
        __message: res.message || ''
      };
    }
    const projects = getStorage<Project>('bpg_projects', DEFAULT_PROJECTS);
    const newProj: Project = {
      ...project,
      id: `p-${Date.now()}`,
      drawingUrl: project.drawingUrl || (project.drawingUrls?.[0]),
      progress: 0
    };
    projects.push(newProj);
    setStorage('bpg_projects', projects);
    return newProj;
  },

  async deleteProject(projectId: string): Promise<string> {
    if (!USE_MOCK_API) {
      const parsedId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
      const res = await apiClient.delete<ApiResponse<any>>(`/projects/${parsedId}`);
      if (!res.success) throw new Error(res.message || 'Không thể xóa dự án.');
      return res.message || '';
    }
    const projects = getStorage<Project>('bpg_projects', DEFAULT_PROJECTS);
    const updated = projects.filter(p => p.id !== projectId);
    if (updated.length === projects.length) throw new Error('Không tìm thấy dự án để xóa');
    setStorage('bpg_projects', updated);
    return '';
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    if (!USE_MOCK_API) {
      const parsedId = id.startsWith('p-') ? parseInt(id.substring(2)) : parseInt(id);
      const payload = {
        projectId: parsedId,
        name: updates.name,
        address: updates.address,
        plannedStart: updates.startDate,
        plannedEnd: updates.endDate,
        attachments: updates.attachments
      };
      const res = await apiClient.put<ApiResponse<import('../types/common').ProjectDto>>(`/projects/${parsedId}`, payload);
      if (!res.success) throw new Error(res.message || 'Không thể cập nhật dự án.');
      return this.getProjectById(id) as unknown as Project;
    }
    const projects = getStorage<Project>('bpg_projects', DEFAULT_PROJECTS);
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Không tìm thấy dự án.');
    projects[idx] = { ...projects[idx], ...updates };
    setStorage('bpg_projects', projects);
    return projects[idx];
  },

  async activateProject(projectId: string): Promise<Project> {
    if (!USE_MOCK_API) {
      const parsedId = projectId.startsWith('p-') ? parseInt(projectId.substring(2)) : parseInt(projectId);
      const res = await apiClient.put<ApiResponse<any>>(`/projects/${parsedId}/activate`);
      if (!res.success) throw new Error(res.message || 'Không thể kích hoạt dự án.');
      return this.getProjectById(projectId) as unknown as Project;
    }
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

    return this.updateProject(projectId, { status: 'inprogress' });
  },

  async pauseProject(projectId: string, reason: string): Promise<Project> {
    if (!USE_MOCK_API) {
      const parsedId = projectId.startsWith('p-') ? parseInt(projectId.substring(2)) : parseInt(projectId);
      const res = await apiClient.put<ApiResponse<any>>(`/projects/${parsedId}/pause`, {
        projectId: parsedId,
        pauseReason: reason
      });
      if (!res.success) throw new Error(res.message || 'Không thể tạm dừng dự án.');
      return this.getProjectById(projectId) as unknown as Project;
    }
    return this.updateProject(projectId, { status: 'paused' });
  },

  async resumeProject(projectId: string): Promise<Project> {
    if (!USE_MOCK_API) {
      const parsedId = projectId.startsWith('p-') ? parseInt(projectId.substring(2)) : parseInt(projectId);
      const res = await apiClient.put<ApiResponse<any>>(`/projects/${parsedId}/resume`);
      if (!res.success) throw new Error(res.message || 'Không thể tiếp tục dự án.');
      return this.getProjectById(projectId) as unknown as Project;
    }
    return this.updateProject(projectId, { status: 'inprogress' });
  },

  // MEMBERS MANAGEMENT
  async getMembers(projectId: string, bustCache = false): Promise<ProjectMember[]> {
    if (!USE_MOCK_API) {
      const parsedId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
      if (bustCache) {
        projectDetailCache.delete(parsedId);
      }
      const p = await getRawProjectDetail(projectId);
      if (!p) return [];
      return (p.members || []).map((m: any) => ({
        projectId,
        userId: m.userId.toString(),
        userName: m.fullName || (m as any).userName || '',
        userEmail: m.email || (m as any).userEmail || '',
        userPhone: m.phoneNumber || (m as any).userPhone || '',
        userRole: m.role || '',
        isLeader: m.isLeader
      }));
    }
    const normalizedProjectId = projectId.match(/^\d+$/) ? `p-${projectId}` : projectId;
    const allMembers = getStorage<ProjectMember>('bpg_project_members', DEFAULT_MEMBERS);
    return allMembers.filter(m => m.projectId === normalizedProjectId || m.projectId === projectId);
  },

  async getMyAccess(projectId: string): Promise<ProjectAccess> {
    const parsedId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
    if (!USE_MOCK_API) {
      const response = await apiClient.get<ApiResponse<ProjectAccess>>(
        `/projects/${parsedId}/access`,
      );
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không thể tải quyền dự án.');
      }
      return response.data;
    }

    const storedUser = localStorage.getItem('bpg_user');
    if (!storedUser) throw new Error('Chưa đăng nhập.');
    const user = JSON.parse(storedUser) as {
      id: string;
      role: string;
      roles?: string[];
    };
    const members = await this.getMembers(projectId);
    const member = members.find((item) => item.userId === user.id);
    return {
      projectId: Number(parsedId),
      isMember: Boolean(member),
      isLeader: member?.isLeader ?? false,
    };
  },

  async getAvailableMembers(projectId: string): Promise<UserProfile[]> {
    const parsedId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
    if (!USE_MOCK_API) {
      const response = await apiClient.get<ApiResponse<UserProfile[]>>(
        `/projects/${parsedId}/available-members`,
      );
      if (!response.success) {
        throw new Error(response.message || 'Không thể tải danh sách kỹ sư có thể thêm.');
      }
      return response.data;
    }

    const [usersResponse, members] = await Promise.all([
      userService.getUsers({ pageSize: 1000, role: 'siteengineer' }),
      this.getMembers(projectId),
    ]);
    return usersResponse.items.filter(user =>
      user.status === 'active' && !members.some(member => member.userId === user.id));
  },

  async addMember(projectId: string, user: { id: string; name: string; email: string; role: string }): Promise<ProjectMember & { __message?: string }> {
    if (!USE_MOCK_API) {
      const parsedId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
      const res = await apiClient.post<ApiResponse<any>>(`/projects/${parsedId}/members`, { 
        projectId: parseInt(parsedId), 
        userId: parseInt(user.id) 
      });
      if (!res.success) throw new Error(res.message || 'Không thể thêm thành viên.');
      projectDetailCache.delete(parsedId);
      return {
        projectId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        isLeader: false,
        __message: res.message || ''
      };
    }
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

  async removeMember(projectId: string, userId: string): Promise<string> {
    if (!USE_MOCK_API) {
      const parsedId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
      const res = await apiClient.delete<ApiResponse<any>>(`/projects/${parsedId}/members/${userId}`);
      if (!res.success) throw new Error(res.message || 'Không thể xóa thành viên.');
      projectDetailCache.delete(parsedId);
      return res.message || '';
    }
    const allMembers = getStorage<ProjectMember>('bpg_project_members', DEFAULT_MEMBERS);
    const filtered = allMembers.filter(m => !(m.projectId === projectId && m.userId === userId));
    setStorage('bpg_project_members', filtered);
    return '';
  },

  async toggleLeader(projectId: string, userId: string): Promise<ProjectMember[] & { __message?: string }> {
    if (!USE_MOCK_API) {
      const parsedId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
      const res = await apiClient.put<ApiResponse<any>>(`/projects/${parsedId}/members/${userId}/leader`);
      if (!res.success) throw new Error(res.message || 'Không thể thay đổi quyền nhóm trưởng.');
      projectDetailCache.delete(parsedId);
      const members = await this.getMembers(projectId) as ProjectMember[] & { __message?: string };
      members.__message = res.message || '';
      return members;
    }
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
    if (!USE_MOCK_API) {
      const { wbsService } = await import('./wbsService');
      const data = await wbsService.getWbsDataFlattened(projectId);
      return data.phases;
    }
    const normalizedProjectId = projectId.match(/^\d+$/) ? `p-${projectId}` : projectId;
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    return allPhases
      .filter(ph => ph.projectId === normalizedProjectId || ph.projectId === projectId)
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

  async updatePhaseMaterials(projectId: string, phaseId: string, materials: { materialId: number; quantity: number; unitId: number }[]): Promise<any> {
    if (!USE_MOCK_API) {
      const parsedProjectId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
      const parsedPhaseId = phaseId.startsWith('ph-') ? phaseId.substring(2) : phaseId;
      const res = await apiClient.put<ApiResponse<any>>(`/projects/${parsedProjectId}/phases/${parsedPhaseId}/boq`, {
        items: materials
      });
      if (!res.success) throw new Error(res.message || 'Không thể cập nhật BOQ.');
      return res.data;
    }
    const allPhases = getStorage<WBSPhase>('bpg_wbs_phases', DEFAULT_PHASES);
    const idx = allPhases.findIndex(p => p.id === phaseId);
    if (idx === -1) throw new Error('Không tìm thấy giai đoạn.');
    if (allPhases[idx].status === 'frozen') {
      throw new Error('Giai đoạn đã nghiệm thu, không thể cập nhật định mức vật tư.');
    }
    const mockMaterials: PhaseMaterialItem[] = materials.map(m => ({
      materialId: m.materialId,
      name: `Vật tư ID ${m.materialId}`,
      quantity: m.quantity,
      unitId: m.unitId,
      unit: 'Cái'
    }));
    allPhases[idx] = { ...allPhases[idx], materials: mockMaterials };
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
    if (!USE_MOCK_API) {
      const { wbsService } = await import('./wbsService');
      const data = await wbsService.getWbsDataFlattened(projectId);
      return data.tasks;
    }
    const normalizedProjectId = projectId.match(/^\d+$/) ? `p-${projectId}` : projectId;
    return getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS)
      .filter(t => t.projectId === normalizedProjectId || t.projectId === projectId)
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

  async adjustTaskProgressDirectly(taskId: string, newProgress: number, reason: string): Promise<WBSTask> {
    if (!USE_MOCK_API) {
      const parsedTaskId = taskId.startsWith('t-') ? parseInt(taskId.substring(2)) : parseInt(taskId);
      const payload = {
        taskId: parsedTaskId,
        newProgress: newProgress,
        updateReason: reason
      };
      const res = await apiClient.put<ApiResponse<any>>(`/tasks/${parsedTaskId}/progress`, payload);
      if (!res.success) throw new Error(res.message || 'Không thể cập nhật tiến độ.');
      
      return {} as WBSTask;
    }

    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const idx = allTasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('Không tìm thấy công việc.');

    const task = allTasks[idx];
    
    if (task.status === 'obsolete') {
      throw new Error('Không thể điều chỉnh tiến độ cho công việc đã báo lỗi thời.');
    }

    const historyEntry: TaskHistory = {
      date: new Date().toISOString(),
      oldProgress: task.progress,
      newProgress: newProgress,
      reason: `TPKT điều chỉnh tiến độ: ${reason}`,
      type: newProgress > task.progress ? 'progress_increase' : 'progress_decrease',
      adjustedBy: 'Technical Manager'
    };

    allTasks[idx] = {
      ...task,
      progress: newProgress,
      history: [historyEntry, ...task.history]
    };

    setStorage('bpg_wbs_tasks', allTasks);
    await this.syncProjectProgress(task.projectId);
    if (task.parentTaskId) {
      await this.syncParentTaskProgress(task.parentTaskId);
    }
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

  /**
   * Fetch a single page of daily logs.
   * Returns items + hasNextPage so the caller can implement "load more" without
   * re-fetching previously loaded data.
   */
  async getDailyLogsPage(
    projectId: string,
    page: number,
    pageSize: number,
    taskId?: string,
    logId?: string
  ): Promise<{ items: DailyLog[]; hasNextPage: boolean; totalCount: number }> {
    if (!USE_MOCK_API) {
      const parsedProjectId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
      const params: Record<string, string> = {
        projectId: parsedProjectId,
        pageNumber: String(page),
        pageSize: String(pageSize)
      };
      if (taskId) {
        const parsedTaskId = taskId.startsWith('t-') ? taskId.substring(2) : taskId;
        params.taskId = parsedTaskId;
      }
      if (logId) {
        params.logId = logId;
      }

      const res = await apiClient.get<ApiResponse<{
        items: any[];
        hasNextPage: boolean;
        totalCount: number;
      }>>(`/dailylogs`, { params });

      if (!res.success) throw new Error(res.message || 'Không thể tải danh sách nhật ký.');

      const mapComment = (c: any): DailyLogComment => ({
        id: c.commentId.toString(),
        userId: c.authorId.toString(),
        userName: c.authorName,
        role: c.authorRole,
        content: c.content,
        date: c.createdAt ? formatToLocalTime(c.createdAt) : ''
      });

      const items = (res.data?.items || []).map((l: any) => ({
        id: l.logId.toString(),
        projectId,
        taskId: l.taskId.toString(),
        taskName: l.taskName,
        engineerId: l.createdBy.toString(),
        engineerName: l.creatorName,
        progressFrom: l.oldProgressPercent,
        progressTo: l.newProgressPercent,
        date: l.createdAt ? formatToLocalTime(l.createdAt) : l.logDate,
        content: l.description,
        weather: '',
        images: l.images || [],
        comments: (l.comments || []).map(mapComment),
        canEdit: l.canEdit,
        editWindowHours: l.editWindowHours,
        isEdited: l.isEdited,
        lastEditedAt: l.lastEditedAt
      }));

      return {
        items,
        hasNextPage: res.data?.hasNextPage ?? false,
        totalCount: res.data?.totalCount ?? items.length
      };
    }

    // Mock fallback: slice the local storage array to simulate pagination
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const taskIdsToFilter = new Set<string>();
    if (taskId) {
      taskIdsToFilter.add(taskId);
      const queue = [taskId];
      while (queue.length > 0) {
        const parentId = queue.shift();
        const children = allTasks.filter(t => t.parentTaskId === parentId && t.status !== 'obsolete');
        for (const child of children) {
          if (!taskIdsToFilter.has(child.id)) {
            taskIdsToFilter.add(child.id);
            queue.push(child.id);
          }
        }
      }
    }

    const allLogs = getStorage<DailyLog>('bpg_daily_logs', DEFAULT_LOGS)
      .filter(l => l.projectId === projectId && (!taskId || taskIdsToFilter.has(l.taskId)))
      .sort((a, b) => b.date.localeCompare(a.date));

    const start = (page - 1) * pageSize;
    const items = allLogs.slice(start, start + pageSize);

    return {
      items,
      hasNextPage: start + pageSize < allLogs.length,
      totalCount: allLogs.length
    };
  },

  /** @deprecated Use getDailyLogsPage for paginated loading. Kept for backward compatibility. */
  async getDailyLogs(projectId: string, taskId?: string): Promise<DailyLog[]> {
    const result = await this.getDailyLogsPage(projectId, 1, 100, taskId);
    return result.items;
  },

  async createDailyLog(
    logData: Omit<DailyLog, 'id' | 'date' | 'comments'>,
    engineerName: string,
    canDecreaseProgress: boolean = false,
    incidentCategory?: 'khach_quan' | 'chu_quan'
  ): Promise<DailyLog> {
    if (!USE_MOCK_API) {
      const parsedTaskId = logData.taskId.startsWith('t-') ? parseInt(logData.taskId.substring(2)) : parseInt(logData.taskId);
      const payload = {
        taskId: parsedTaskId,
        newProgressPercent: logData.progressTo,
        description: logData.content,
        images: logData.images || []
      };

      const res = await apiClient.post<ApiResponse<any>>(`/dailylogs`, payload);
      if (!res.success) throw new Error(res.message || 'Không thể tạo nhật ký thi công.');

      const l = res.data;
      const mapComment = (c: any): DailyLogComment => ({
        id: c.commentId.toString(),
        userId: c.authorId.toString(),
        userName: c.authorName,
        role: c.authorRole,
        content: c.content,
        date: c.createdAt ? formatToLocalTime(c.createdAt) : ''
      });

      // Synchronize task progress in localStorage WBS so frontend stays in sync
      const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
      const taskIdx = allTasks.findIndex(t => String(t.id).replace(/^t-/, '') === String(logData.taskId).replace(/^t-/, ''));
      if (taskIdx !== -1) {
        const task = allTasks[taskIdx];
        const type = logData.progressTo < task.progress ? 'progress_decrease' : 'progress_increase';
        const historyEntry: TaskHistory = {
          date: l.createdAt ? formatToLocalTime(l.createdAt) : l.logDate,
          oldProgress: task.progress,
          newProgress: logData.progressTo,
          reason: `Cập nhật tiến độ (API): ${logData.content}`,
          type,
          adjustedBy: engineerName,
        };
        allTasks[taskIdx] = {
          ...task,
          progress: logData.progressTo,
          history: [historyEntry, ...task.history]
        };
        setStorage('bpg_wbs_tasks', allTasks);
        await this.syncProjectProgress(logData.projectId);
        if (task.parentTaskId) {
          await this.syncParentTaskProgress(task.parentTaskId);
        }
      }

      return {
        id: l.logId.toString(),
        projectId: logData.projectId,
        taskId: logData.taskId,
        taskName: l.taskName,
        engineerId: l.createdBy.toString(),
        engineerName: l.creatorName,
        progressFrom: l.oldProgressPercent,
        progressTo: l.newProgressPercent,
        date: l.createdAt ? formatToLocalTime(l.createdAt) : l.logDate,
        content: l.description,
        weather: '',
        images: l.images || [],
        comments: (l.comments || []).map(mapComment),
        isEdited: l.isEdited,
        lastEditedAt: l.lastEditedAt
      };
    }

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
      if (!canDecreaseProgress) {
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

  async updateDailyLog(
    logId: string,
    description: string,
    images: string[]
  ): Promise<DailyLog> {
    if (!USE_MOCK_API) {
      const parsedLogId = logId.startsWith('l-') ? parseInt(logId.substring(2)) : parseInt(logId);
      const payload = {
        description,
        images
      };
      const res = await apiClient.put<ApiResponse<any>>(`/dailylogs/${parsedLogId}`, payload);
      if (!res.success) throw new Error(res.message || 'Không thể cập nhật nhật ký.');

      const l = res.data;
      const mapComment = (c: any): DailyLogComment => ({
        id: c.commentId.toString(),
        userId: c.authorId.toString(),
        userName: c.authorName,
        role: c.authorRole,
        content: c.content,
        date: c.createdAt ? formatToLocalTime(c.createdAt) : ''
      });

      return {
        id: l.logId.toString(),
        projectId: '',
        taskId: l.taskId.toString(),
        taskName: l.taskName,
        engineerId: l.createdBy.toString(),
        engineerName: l.creatorName,
        progressFrom: l.oldProgressPercent,
        progressTo: l.newProgressPercent,
        date: l.createdAt ? formatToLocalTime(l.createdAt) : l.logDate,
        content: l.description,
        weather: '',
        images: l.images || [],
        comments: (l.comments || []).map(mapComment),
        isEdited: l.isEdited,
        lastEditedAt: l.lastEditedAt
      };
    }

    const logs = getStorage<DailyLog>('bpg_daily_logs', DEFAULT_LOGS);
    const logIdx = logs.findIndex(l => l.id === logId);
    if (logIdx !== -1) {
      logs[logIdx].content = description;
      logs[logIdx].images = images;
      setStorage('bpg_daily_logs', logs);
      return logs[logIdx];
    }
    throw new Error('Không tìm thấy nhật ký thi công.');
  },

  async addLogComment(logId: string, user: { name: string; role: string; id: string }, content: string): Promise<DailyLogComment> {
    if (!USE_MOCK_API) {
      const parsedLogId = logId.startsWith('l-') ? parseInt(logId.substring(2)) : parseInt(logId);
      const res = await apiClient.post<ApiResponse<any>>(`/dailylogs/${parsedLogId}/comments`, { content });
      if (!res.success) throw new Error(res.message || 'Không thể thêm bình luận.');

      const c = res.data;
      return {
        id: c.commentId.toString(),
        userId: c.authorId.toString(),
        userName: c.authorName,
        role: c.authorRole,
        content: c.content,
        date: c.createdAt ? c.createdAt.slice(0, 16).replace('T', ' ') : ''
      };
    }

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

  async updateLogComment(commentId: string, content: string): Promise<DailyLogComment> {
    if (!USE_MOCK_API) {
      const parsedCommentId = commentId.startsWith('c-') ? parseInt(commentId.substring(2)) : parseInt(commentId);
      const res = await apiClient.put<ApiResponse<any>>(`/dailylogs/comments/${parsedCommentId}`, { content });
      if (!res.success) throw new Error(res.message || 'Không thể cập nhật bình luận.');

      const c = res.data;
      return {
        id: c.commentId.toString(),
        userId: c.authorId.toString(),
        userName: c.authorName,
        role: c.authorRole,
        content: c.content,
        date: c.createdAt ? c.createdAt.slice(0, 16).replace('T', ' ') : ''
      };
    }

    const logs = getStorage<DailyLog>('bpg_daily_logs', DEFAULT_LOGS);
    for (const log of logs) {
      const cIdx = log.comments.findIndex(c => c.id === commentId);
      if (cIdx !== -1) {
        log.comments[cIdx].content = content;
        setStorage('bpg_daily_logs', logs);
        return log.comments[cIdx];
      }
    }
    throw new Error('Không tìm thấy bình luận.');
  },

  async deleteLogComment(commentId: string): Promise<boolean> {
    if (!USE_MOCK_API) {
      const parsedCommentId = commentId.startsWith('c-') ? parseInt(commentId.substring(2)) : parseInt(commentId);
      const res = await apiClient.delete<ApiResponse<boolean>>(`/dailylogs/comments/${parsedCommentId}`);
      return res.success;
    }

    const logs = getStorage<DailyLog>('bpg_daily_logs', DEFAULT_LOGS);
    let deleted = false;
    for (const log of logs) {
      const cIdx = log.comments.findIndex(c => c.id === commentId);
      if (cIdx !== -1) {
        log.comments.splice(cIdx, 1);
        deleted = true;
        break;
      }
    }
    if (deleted) {
      setStorage('bpg_daily_logs', logs);
      return true;
    }
    throw new Error('Không tìm thấy bình luận.');
  },

  async getTaskProgressHistory(taskId: string): Promise<TaskProgressLog[]> {
    if (!USE_MOCK_API) {
      const parsedTaskId = taskId.startsWith('t-') ? parseInt(taskId.substring(2)) : parseInt(taskId);
      const res = await apiClient.get<ApiResponse<TaskProgressLog[]>>(`/dailylogs/tasks/${parsedTaskId}/progress-history`);
      if (!res.success) throw new Error(res.message || 'Không thể tải lịch sử tiến độ.');
      return res.data ?? [];
    }

    // Mock fallback: convert WBSTask history to TaskProgressLog shape
    const allTasks = getStorage<WBSTask>('bpg_wbs_tasks', DEFAULT_TASKS);
    const task = allTasks.find(t => t.id === taskId);
    return (task?.history || []).map((h, idx) => ({
      taskProgressLogId: idx + 1,
      taskId: 0,
      oldProgress: h.oldProgress,
      newProgress: h.newProgress,
      updateReason: h.reason,
      updatedAt: h.date
    }));
  },

  async uploadFiles(files: File[], folder: string = 'dailylogs'): Promise<string[]> {
    if (USE_MOCK_API) {
      return files.map(file => URL.createObjectURL(file));
    }
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('folder', folder);

    const res = await apiClient.request<ApiResponse<any[]>>('/files/upload-multiple', {
      method: 'POST',
      body: formData
    });
    if (!res.success) throw new Error(res.message || 'Không thể tải ảnh lên.');
    return (res.data || []).map(item => item.fileUrl);
  },

  async deleteFile(fileUrl: string): Promise<boolean> {
    if (USE_MOCK_API) return true;
    const res = await apiClient.delete<ApiResponse<boolean>>('/files/delete', {
      params: { fileUrl }
    });
    return res.success;
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
  // Helper to map DTOs
  mapRequestDtoToCommon(item: any): MaterialRequest {
    return {
      id: `mat-req-${item.requestId}`,
      projectId: item.projectId ? item.projectId.toString() : '',
      phaseId: item.phaseId ? item.phaseId.toString() : '',
      phaseName: item.phaseName,
      requesterName: item.createdByName || 'PL',
      reason: item.reason,
      date: item.createdAt ? formatToLocalTime(item.createdAt) : '',
      isOverBOQ: item.boqCheckStatus === 'OverBOQ',
      type: 'normal',
      createdBy: item.createdBy,
      rejectionReason: item.accountantNote || item.approvalNote || '',
      status: this.mapBackendStatusToFrontend(item.status),
      items: (item.items || []).map((it: any) => ({
        name: it.materialName,
        quantity: it.quantity,
        unit: it.unitName
      }))
    };
  },

  mapBackendStatusToFrontend(status: string): MaterialRequest['status'] {
    switch (status) {
      case 'Pending': return 'pending_accountant';
      case 'WaitingApproval': return 'pending_director';
      case 'Approved': return 'approved';
      case 'Rejected': return 'rejected';
      case 'Cancelled': return 'cancelled'; // Người tạo tự hủy – KHÁC với Rejected
      default: return 'pending_accountant';
    }
  },

  // MATERIAL REQUESTS FOR REWORK & COMPENSATION (Section 1.7)
  async getMaterialRequests(projectId: string): Promise<MaterialRequest[]> {
    if (!USE_MOCK_API) {
      const parsedProjectId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
      const res = await apiClient.get<ApiResponse<any>>(`/projects/${parsedProjectId}/material-requests`);
      if (!res.success) throw new Error(res.message || 'Không thể tải danh sách yêu cầu.');
      return (res.data?.items || []).map((item: any) => this.mapRequestDtoToCommon(item));
    }
    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    return list.filter(r => r.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date));
  },

  async getAllMaterialRequests(): Promise<MaterialRequest[]> {
    if (!USE_MOCK_API) {
      const res = await apiClient.get<ApiResponse<any>>('/materialrequests');
      if (!res.success) throw new Error(res.message || 'Không thể tải danh sách yêu cầu.');
      return (res.data?.items || []).map((item: any) => this.mapRequestDtoToCommon(item));
    }
    return getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS).sort((a, b) => b.date.localeCompare(a.date));
  },

  async createMaterialRequest(
    request: Omit<MaterialRequest, 'id' | 'status' | 'date'> & { isOverBOQ?: boolean }
  ): Promise<MaterialRequest> {
    if (!USE_MOCK_API) {
      const parsedProjectId = request.projectId.startsWith('p-') ? request.projectId.substring(2) : request.projectId;
      const parsedPhaseId = request.phaseId?.startsWith('ph-') ? request.phaseId.substring(3) : request.phaseId;
      
      const payload = {
        projectId: parseInt(parsedProjectId),
        phaseId: parseInt(parsedPhaseId || '0'),
        reason: request.reason || '',
        type: request.type || 'normal',
        invoiceImage: request.invoiceImage || null,
        items: request.items.map(it => ({
          name: it.name,
          quantity: it.quantity,
          unit: it.unit
        }))
      };
      
      const res = await apiClient.post<ApiResponse<any>>(`/projects/${parsedProjectId}/material-requests`, payload);
      if (!res.success) throw new Error(res.message || 'Không thể tạo yêu cầu.');
      
      // Lấy chi tiết yêu cầu vừa tạo để trả về đầy đủ DTO
      const detailRes = await apiClient.get<ApiResponse<any>>(`/materialrequests/${res.data}`);
      if (!detailRes.success) throw new Error(detailRes.message || 'Không thể tải thông tin yêu cầu vừa tạo.');
      return this.mapRequestDtoToCommon(detailRes.data);
    }

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
      reason: reason || `Tổng hợp từ ${selectedReqs.length} yêu cầu của Nhân viên kỹ thuật.`,
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

  async cancelMaterialRequest(requestId: string, reason: string): Promise<string> {
    if (!USE_MOCK_API) {
      const parsedRequestId = requestId.startsWith('mat-req-') ? requestId.substring(8) : requestId;
      const res = await apiClient.post<ApiResponse<any>>(`/materialrequests/${parsedRequestId}/cancel`, {
        requestId: parseInt(parsedRequestId),
        reason: reason
      });
      if (!res.success) throw new Error(res.message || '\u004b\u0068\u00f4\u006e\u0067 \u0074\u0068\u1ec3 \u0068\u1ee7\u0079 \u0079\u00eau \u0063\u1ea7\u0075.');
      return res.message || '';
    }

    const list = getStorage<MaterialRequest>('bpg_material_requests', DEFAULT_MATERIAL_REQUESTS);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx === -1) throw new Error('Không tìm thấy yêu cầu vật tư.');

    if (list[idx].status !== 'pending_accountant') {
      throw new Error('Chỉ có thể hủy yêu cầu khi đang chờ Kế toán duyệt.');
    }

    list[idx].status = 'rejected';
    list[idx].rejectionReason = `Người tạo tự hủy: ${reason}`;
    setStorage('bpg_material_requests', list);
    return '';
  },

  async processMaterialRequestByAccountant(requestId: string, note?: string): Promise<MaterialRequest> {
    if (!USE_MOCK_API) {
      const parsedRequestId = requestId.startsWith('mat-req-') ? requestId.substring(8) : requestId;
      const res = await apiClient.post<ApiResponse<any>>(`/materialrequests/${parsedRequestId}/accountant-process`, {
        requestId: parseInt(parsedRequestId),
        note: note || 'Kế toán xử lý'
      });
      if (!res.success) throw new Error(res.message || 'Kế toán không thể xử lý yêu cầu.');
      
      const detailRes = await apiClient.get<ApiResponse<any>>(`/materialrequests/${parsedRequestId}`);
      if (!detailRes.success) throw new Error(detailRes.message || '\u004b\u0068\u00f4\u006e\u0067 \u0074\u0068\u1ec3 \u0074\u1ea3\u0069 \u0074\u0068\u00f4\u006e\u0067 \u0074\u0069\u006e \u0079\u00eau \u0063\u1ea7\u0075.');
      return { ...this.mapRequestDtoToCommon(detailRes.data), __message: res.message || '' } as MaterialRequest & { __message?: string };
    }

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
              currentMaterials.push({ materialId: 0, unitId: 0, name: reqItem.name, quantity: reqItem.quantity, unit: reqItem.unit });
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

  async disburseEmergencyRequest(requestId: string, note?: string): Promise<MaterialRequest> {
    // Phiếu khẩn cấp/mua ngoài tự giải ngân
    if (!USE_MOCK_API) {
      const parsedRequestId = requestId.startsWith('mat-req-') ? requestId.substring(8) : requestId;
      const res = await apiClient.post<ApiResponse<any>>(`/materialrequests/${parsedRequestId}/accountant-process`, {
        requestId: parseInt(parsedRequestId),
        note: note || 'Đã giải ngân chi phí mua ngoài khẩn cấp'
      });
      if (!res.success) throw new Error(res.message || 'Không thể giải ngân.');
      
      const detailRes = await apiClient.get<ApiResponse<any>>(`/materialrequests/${parsedRequestId}`);
      if (!detailRes.success) throw new Error(detailRes.message || '\u004b\u0068\u00f4\u006e\u0067 \u0074\u0068\u1ec3 \u0074\u1ea3\u0069 \u0074\u0068\u00f4\u006e\u0067 \u0074\u0069\u006e \u0079\u00eau \u0063\u1ea7\u0075.');
      return { ...this.mapRequestDtoToCommon(detailRes.data), __message: res.message || '' } as MaterialRequest & { __message?: string };
    }

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

  async approveMaterialRequestByDirector(requestId: string, approvedBy: string, note?: string): Promise<MaterialRequest> {
    if (!USE_MOCK_API) {
      const parsedRequestId = requestId.startsWith('mat-req-') ? requestId.substring(8) : requestId;
      const res = await apiClient.post<ApiResponse<any>>(`/materialrequests/${parsedRequestId}/director-approve`, {
        requestId: parseInt(parsedRequestId),
        note: note || `Giám đốc duyệt (${approvedBy})`
      });
      if (!res.success) throw new Error(res.message || 'Giám đốc không thể phê duyệt yêu cầu.');
      
      const detailRes = await apiClient.get<ApiResponse<any>>(`/materialrequests/${parsedRequestId}`);
      if (!detailRes.success) throw new Error(detailRes.message || '\u004b\u0068\u00f4\u006e\u0067 \u0074\u0068\u1ec3 \u0074\u1ea3\u0069 \u0074\u0068\u00f4\u006e\u0067 \u0074\u0069\u006e \u0079\u00eau \u0063\u1ea7\u0075.');
      return { ...this.mapRequestDtoToCommon(detailRes.data), __message: res.message || '' } as MaterialRequest & { __message?: string };
    }

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
            currentMaterials.push({ materialId: 0, unitId: 0, name: reqItem.name, quantity: reqItem.quantity, unit: reqItem.unit });
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
    if (!USE_MOCK_API) {
      const parsedRequestId = requestId.startsWith('mat-req-') ? requestId.substring(8) : requestId;
      const res = await apiClient.post<ApiResponse<any>>(`/materialrequests/${parsedRequestId}/reject`, {
        requestId: parseInt(parsedRequestId),
        reason: reason
      });
      if (!res.success) throw new Error(res.message || 'Không thể từ chối yêu cầu.');
      
      const detailRes = await apiClient.get<ApiResponse<any>>(`/materialrequests/${parsedRequestId}`);
      if (!detailRes.success) throw new Error(detailRes.message || '\u004b\u0068\u00f4\u006e\u0067 \u0074\u0068\u1ec3 \u0074\u1ea3\u0069 \u0074\u0068\u00f4\u006e\u0067 \u0074\u0069\u006e \u0079\u00eau \u0063\u1ea7\u0075.');
      return { ...this.mapRequestDtoToCommon(detailRes.data), __message: res.message || '' } as MaterialRequest & { __message?: string };
    }

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
    updates: Partial<Pick<MaterialRequest, 'items' | 'reason' | 'invoiceImage' | 'type' | 'isOverBOQ'>>
  ): Promise<MaterialRequest> {
    if (!USE_MOCK_API) {
      const parsedRequestId = requestId.startsWith('mat-req-') ? requestId.substring(8) : requestId;
      const res = await apiClient.post<ApiResponse<any>>(`/materialrequests/${parsedRequestId}/resubmit`, {
        reason: updates.reason?.trim() || '',
        items: (updates.items || []).map(it => ({
          name: it.name.trim(),
          quantity: it.quantity,
          unit: it.unit.trim()
        }))
      });
      if (!res.success) throw new Error(res.message || 'Không thể gửi lại yêu cầu.');

      // Lấy lại chi tiết phiếu sau khi resubmit
      const detailRes = await apiClient.get<ApiResponse<any>>(`/materialrequests/${parsedRequestId}`);
      if (!detailRes.success) throw new Error(detailRes.message || '\u004b\u0068\u00f4\u006e\u0067 \u0074\u0068\u1ec3 \u0074\u1ea3\u0069 \u0074\u0068\u00f4\u006e\u0067 \u0074\u0069\u006e \u0079\u00eau \u0063\u1ea7\u0075.');
      return { ...this.mapRequestDtoToCommon(detailRes.data), __message: res.message || '' } as MaterialRequest & { __message?: string };
    }

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

