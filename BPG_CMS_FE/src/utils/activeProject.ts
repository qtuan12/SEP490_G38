const LAST_PROJECT_KEY = 'field_workbench_last_project';

/** Lấy projectId từ URL hiện tại (/projects/:id/...) nếu có, hoặc fallback về dự án dùng gần nhất trong "Việc của tôi". */
export const getActiveProjectId = (pathname: string): string | null => {
  const match = pathname.match(/\/projects\/([^/]+)/);
  if (match) return match[1];
  return localStorage.getItem(LAST_PROJECT_KEY);
};
