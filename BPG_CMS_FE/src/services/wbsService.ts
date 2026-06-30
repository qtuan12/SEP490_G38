import { apiClient } from './api';
import type { WbsTree, TaskDetails } from '../types/wbs';
import type { ApiResponse } from '../types/api';
import type { WBSPhase as CommonWBSPhase, WBSTask as CommonWBSTask } from '../types/common';

export const wbsService = {
  // WBS Tree
  getWbsTree: async (projectId: number): Promise<WbsTree> => {
    const res = await apiClient.get<ApiResponse<WbsTree>>(`/projects/${projectId}/wbs`);
    return res.data;
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
        startDate: phaseDto.startDate || undefined,
        deadline: phaseDto.endDate || undefined,
        endDate: phaseDto.endDate || undefined,
        // @ts-ignore
        progress: phaseDto.progressPercent
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
            predecessorTaskIds: taskDto.predecessorTaskIds || undefined
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

  // Tasks
  getTaskDetails: async (taskId: number): Promise<TaskDetails> => {
    const res = await apiClient.get<ApiResponse<TaskDetails>>(`/tasks/${taskId}`);
    return res.data;
  },
  createTask: async (phaseId: number, data: any): Promise<number> => {
    const res = await apiClient.post<ApiResponse<number>>(`/tasks/phases/${phaseId}`, data);
    return res.data;
  },
  updateTask: async (taskId: number, data: any): Promise<void> => {
    await apiClient.put(`/tasks/${taskId}`, data);
  },
  deleteTask: async (taskId: number): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}`);
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
  addTaskDependency: async (taskId: number, predecessorTaskId: number): Promise<void> => {
    await apiClient.post(`/tasks/${taskId}/dependencies/${predecessorTaskId}`, {});
  },
  removeTaskDependency: async (taskId: number, predecessorTaskId: number): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}/dependencies/${predecessorTaskId}`);
  }
};
