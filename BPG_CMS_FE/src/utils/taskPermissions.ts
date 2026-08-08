import type { WBSTask } from '../types/common';

/**
 * "Trưởng dự án" không phải role toàn cục (đã bỏ role `projectleader`) — một Site Engineer
 * vẫn có thể được gán làm leader cho MỘT dự án cụ thể qua ProjectMember.isLeader, lấy được
 * qua hook `useProjectAccess(projectId).isProjectLeader`. Admin/TechnicalManager quản lý toàn
 * hệ thống nên luôn coi như leader ở mọi dự án (khớp với backend: IsInAnyRole(Admin, TechnicalManager)).
 */
export const isManagerRole = (user: { role: string } | null | undefined): boolean => {
  const r = (user?.role || '').toLowerCase();
  return r === 'admin' || r === 'technicalmanager';
};

/** TM/Admin hoặc leader thật của dự án này xem toàn bộ công việc; còn lại chỉ xem đúng việc được gán cho mình. */
export const isProjectWideView = (
  user: { role: string } | null | undefined,
  isProjectLeader: boolean
): boolean => isManagerRole(user) || isProjectLeader;

const isAssignedTo = (task: WBSTask, userId?: string | number): boolean =>
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

/** Backend chỉ cho Admin / Trưởng dự án (leader) / Kỹ sư được gán vào đúng task đó tạo nhật ký. Technical Manager không được tạo nhật ký. */
export const canCreateDailyLog = (
  task: WBSTask | null | undefined,
  user: any,
  isProjectLeader: boolean
): boolean => {
  if (!task || task.status === 'obsolete') return false;
  if (!hasAssignee(task)) return false;
  if (!user) return false;

  const rawRoles: string[] = [];
  if (user.role) rawRoles.push(String(user.role));
  if (Array.isArray(user.roles)) user.roles.forEach((r: any) => rawRoles.push(String(r)));

  const roles = rawRoles.map(r => r.toLowerCase());
  const isTechnicalManager = roles.some(r => r === 'technicalmanager' || r === 'technical_manager' || r === 'tpkt');

  if (isTechnicalManager) return false;
  if (roles.includes('admin')) return true;
  if (isProjectLeader) return true;
  return roles.includes('siteengineer') && isAssignedTo(task, user.id);
};
