import type { WBSTask } from '../types/common';

/**
 * "Trưởng dự án" không phải role toàn cục (đã bỏ role `projectleader`) — một Site Engineer
 * vẫn có thể được gán làm leader cho MỘT dự án cụ thể qua ProjectMember.isLeader, lấy được
 * qua hook `useProjectAccess(projectId).isProjectLeader`. Admin/TechnicalManager quản lý toàn
 * hệ thống nên luôn coi như leader ở mọi dự án (khớp với backend: IsInAnyRole(Admin, TechnicalManager)).
 */
export const isManagerRole = (user: { role: string } | null | undefined): boolean =>
  user?.role === 'admin' || user?.role === 'technicalmanager';

/** TM/Admin hoặc leader thật của dự án này xem toàn bộ công việc; còn lại chỉ xem đúng việc được gán cho mình. */
export const isProjectWideView = (
  user: { role: string } | null | undefined,
  isProjectLeader: boolean
): boolean => isManagerRole(user) || isProjectLeader;

const isAssignedTo = (task: WBSTask, userId?: string): boolean =>
  !!userId && (task.assignedTo?.split(',').map(s => s.trim()).includes(String(userId)) ?? false);

const hasAssignee = (task: WBSTask): boolean =>
  task.assignedTo?.split(',').some(id => id.trim().length > 0) ?? false;

/**
 * Danh sách task hiển thị theo view của user:
 * - Không phải project-wide (Site Engineer thường): chỉ lấy task được gán cho mình.
 * - Project-wide (TM/Admin/leader): lấy toàn bộ task của dự án, nhưng ưu tiên đưa task được gán cho
 *   chính mình lên đầu (ví dụ leader vẫn có thể được gán trực tiếp 1 vài task cụ thể).
 */
export const getVisibleTasksForUser = (
  tasks: WBSTask[],
  user: { id: string; role: string } | null | undefined,
  isProjectWide: boolean
): WBSTask[] => {
  if (!user) return [];
  if (!isProjectWide) return tasks.filter(t => isAssignedTo(t, user.id));
  return [...tasks].sort((a, b) => Number(isAssignedTo(b, user.id)) - Number(isAssignedTo(a, user.id)));
};

/** Backend chỉ cho TM/Admin / Trưởng dự án (leader) / người được gán vào đúng task đó tạo nhật ký (403 với người khác). */
export const canCreateDailyLog = (
  task: WBSTask,
  user: { id: string; role: string } | null | undefined,
  isProjectLeader: boolean
): boolean => {
  if (!hasAssignee(task)) return false;
  if (isProjectLeader) return true;
  if (!user) return false;
  return user.role === 'siteengineer' && isAssignedTo(task, user.id);
};
