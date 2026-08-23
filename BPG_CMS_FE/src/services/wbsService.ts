import { apiClient } from './api';
import type { WbsTree, TaskDetails } from '../types/wbs';
import type { ApiResponse } from '../types/api';
import type { WBSPhase as CommonWBSPhase, WBSTask as CommonWBSTask } from '../types/common';

// Cache and request deduplication map to prevent double-fetching on page load
const wbsInFlightRequests = new Map<number, Promise<WbsTree>>();

export const wbsService = {
  // WBS Tree
  getWbsTree: async (projectId: number): Promise<WbsTree> => {
    if (wbsInFlightRequests.has(projectId)) {
      return wbsInFlightRequests.get(projectId)!;
    }

    const promise = (async () => {
      try {
        const res = await apiClient.get<ApiResponse<WbsTree>>(`/projects/${projectId}/wbs`);
        return res.data;
      } finally {
        wbsInFlightRequests.delete(projectId);
      }
    })();

    wbsInFlightRequests.set(projectId, promise);
    return promise;
  },

  // WBS Tree Flattened for Legacy UI Components
  getWbsDataFlattened: async (projectId: string): Promise<{ phases: CommonWBSPhase[], tasks: CommonWBSTask[] }> => {
    const pId = projectId.replace('p-', '');
    const tree = await wbsService.getWbsTree(Number(pId));
    
    const phases: CommonWBSPhase[] = [];
    const tasks: CommonWBSTask[] = [];

    tree.phases.forEach((phaseDto) => {
      phases.push({
        id: phaseDto.phaseId.toString(),
        projectId: projectId,
        name: phaseDto.name,
        description: phaseDto.description || undefined,
        sortOrder: phaseDto.orderIndex,
        status: phaseDto.status?.toLowerCase() === 'approved' ? 'frozen' : 'active',
        rawStatus: phaseDto.status,
        startDate: phaseDto.startDate || undefined,
        deadline: phaseDto.endDate || undefined,
        endDate: phaseDto.endDate || undefined,
        // @ts-ignore
        progress: phaseDto.progressPercent,
        materials: phaseDto.materials?.map((it: any) => ({
          materialId: it.materialId,
          name: it.name,
          quantity: it.quantity,
          unitId: it.unitId,
          unit: it.unit,
          conversionRate: it.conversionRate
        })) || []
      });

      const extractTasks = (taskList: any[]) => {
        taskList.forEach(taskDto => {
          tasks.push({
            id: taskDto.taskId.toString(),
            phaseId: taskDto.phaseId.toString(),
            phaseName: phaseDto.name,
            projectId: projectId,
            parentTaskId: taskDto.parentTaskId ? taskDto.parentTaskId.toString() : undefined,
            name: taskDto.name,
            description: taskDto.description || undefined,
            sortOrder: taskDto.orderIndex,
            progress: taskDto.progressPercent,
            history: [],
            status: taskDto.status?.toLowerCase() === 'obsolete' ? 'obsolete' : 'active',
            startDate: taskDto.startDate || undefined,
            deadline: taskDto.endDate || undefined,
            isOverdue: taskDto.isOverdue,
            isAtRisk: taskDto.isAtRisk,
            isLocked: taskDto.isLocked,
            daysLeft: taskDto.daysLeft,
            assignedTo: (taskDto as any).assignedTo || undefined,
            assignedName: (taskDto as any).assignedName || undefined,
            weight: taskDto.weight !== undefined ? taskDto.weight : undefined,
            predecessorTaskIds: taskDto.predecessorTaskIds || undefined,
            hasSubTasks: (taskDto.subTasks?.length ?? 0) > 0,
            isOutsourced: taskDto.isOutsourced || false,
            outsourcedTeamName: taskDto.outsourcedTeamName || undefined,
            outsourcedTeamContact: taskDto.outsourcedTeamContact || undefined,
            obsoleteReason: taskDto.obsoleteReason || undefined
          });

          if (taskDto.subTasks && taskDto.subTasks.length > 0) {
            extractTasks(taskDto.subTasks);
          }
        });
      };

      if (phaseDto.tasks && phaseDto.tasks.length > 0) {
        extractTasks(phaseDto.tasks);
      }
    });

    return { phases, tasks };
  },

  // Phases
  createPhase: async (projectId: number, data: any): Promise<number> => {
    const res = await apiClient.post<ApiResponse<number>>(`/projects/${projectId}/phases`, data);
    return res.data;
  },
  updatePhase: async (projectId: number, phaseId: number, data: any): Promise<void> => {
    await apiClient.put(`/projects/${projectId}/phases/${phaseId}`, data);
  },
  deletePhase: async (projectId: number, phaseId: number): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/phases/${phaseId}`);
  },
  clonePhase: async (projectId: number, phaseId: number): Promise<number> => {
    const res = await apiClient.post<ApiResponse<number>>(`/projects/${projectId}/phases/${phaseId}/clone`);
    return res.data;
  },

  // Tasks
  getTaskDetails: async (taskId: number): Promise<TaskDetails> => {
    const res = await apiClient.get<ApiResponse<TaskDetails>>(`/tasks/${taskId}`);
    return res.data;
  },
  createTask: async (phaseId: number, data: any): Promise<number> => {
    const res = await apiClient.post<any>(`/tasks/phases/${phaseId}`, data);
    const resultData = res.data !== undefined ? res.data : res;
    if (typeof resultData === 'object' && resultData !== null) {
      return resultData.taskId || resultData.id || resultData;
    }
    return resultData;
  },
  updateTask: async (taskId: number, data: any): Promise<void> => {
    await apiClient.put(`/tasks/${taskId}`, data);
  },
  deleteTask: async (taskId: number): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}`);
  },
  cloneTask: async (taskId: number): Promise<number> => {
    const res = await apiClient.post<ApiResponse<number>>(`/tasks/${taskId}/clone`);
    return res.data;
  },

  importWbs: async (projectId: number | string, file: File): Promise<{ phaseCount: number; taskCount: number; skippedCount: number; errors: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.postFormData<ApiResponse<{ phaseCount: number; taskCount: number; skippedCount: number; errors: string[] }>>(`/projects/${projectId}/wbs/import`, formData);
    return res.data;
  },

  downloadWbsTemplate: async (): Promise<void> => {
    const token = localStorage.getItem('bpg_token');
    const BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7111/api';
    const response = await fetch(`${BASE_URL}/projects/0/wbs/template`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Không thể tải file mẫu.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_cau_truc_wbs.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  },

  assignTask: async (taskId: number, data: { taskId: number, assigneeIds: number[] }): Promise<void> => {
    await apiClient.put(`/tasks/${taskId}/assignees`, data);
  },
  adjustTaskProgress: async (taskId: number, data: { taskId: number, newProgress: number, updateReason: string }): Promise<void> => {
    await apiClient.put(`/tasks/${taskId}/progress`, data);
  },
  markTaskObsolete: async (taskId: number, data: { taskId: number, obsoleteReason: string }): Promise<void> => {
    await apiClient.put(`/tasks/${taskId}/obsolete`, data);
  },
  restoreTask: async (taskId: number): Promise<{ message?: string }> => {
    const res = await apiClient.put<any>(`/tasks/${taskId}/restore`);
    return { message: res?.message || '' };
  },
  addTaskDependency: async (taskId: number, predecessorTaskId: number): Promise<void> => {
    await apiClient.request(`/tasks/${taskId}/dependencies/${predecessorTaskId}`, { method: 'POST' });
  },
  removeTaskDependency: async (taskId: number, predecessorTaskId: number): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}/dependencies/${predecessorTaskId}`);
  }
};
