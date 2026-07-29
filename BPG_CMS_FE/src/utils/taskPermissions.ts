import type { WBSTask, ProjectMember } from '../types/common';

/**
 * TM luôn quản lý toàn hệ thống. Với các role khác, "Trưởng dự án" không phải role toàn cục cố định —
 * một Site Engineer vẫn có thể được gán làm Trưởng dự án cho MỘT dự án cụ thể qua cờ ProjectMember.isLeader.
 * Vì vậy phải check cả role lẫn membership của đúng dự án đang xem, không chỉ dựa vào role string.
 */
export const isLeaderOfProject = (
  user: { id: string; role: string } | null | undefined,
  members: ProjectMember[]
): boolean => {
  if (!user) return false;
  if (user.role === 'technicalmanager') return true;
  return members.some(m => String(m.userId) === String(user.id) && m.isLeader);
};

/** TM/Trưởng dự án (leader thật của dự án này) xem toàn bộ công việc; còn lại chỉ xem đúng việc được gán cho mình. */
export const isProjectWideView = (
  user: { id: string; role: string } | null | undefined,
  members: ProjectMember[]
): boolean => isLeaderOfProject(user, members);

const isAssignedTo = (task: WBSTask, userId?: string): boolean =>
  !!userId && (task.assignedTo?.split(',').map(s => s.trim()).includes(String(userId)) ?? false);

/**
 * Danh sách task hiển thị theo view của user:
 * - Không phải project-wide (Site Engineer thường): chỉ lấy task được gán cho mình.
 * - Project-wide (TM/leader): lấy toàn bộ task của dự án, nhưng ưu tiên đưa task được gán cho chính mình lên đầu
 *   (ví dụ leader vẫn có thể được gán trực tiếp 1 vài task cụ thể).
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

/** Backend chỉ cho TM / Trưởng dự án (leader) / người được gán vào đúng task đó tạo nhật ký (403 với người khác). */
export const canCreateDailyLog = (
  task: WBSTask,
  user: { id: string; role: string } | null | undefined,
  members: ProjectMember[]
): boolean => {
  if (isLeaderOfProject(user, members)) return true;
  if (!user) return false;
  return task.assignedTo?.split(',').map(s => s.trim()).includes(String(user.id)) ?? false;
};
