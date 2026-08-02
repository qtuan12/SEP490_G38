export const isPWAMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isUrlParam = new URLSearchParams(window.location.search).get('standalone') === 'true' ||
                     new URLSearchParams(window.location.search).get('pwa') === 'true';
  return isStandaloneMode || isIOSStandalone || isUrlParam;
};

/** Strict check: app is actually running as an installed/standalone PWA (ignores the internal ?standalone=true navigation param). */
export const isRunningStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
};

/**
 * Các chức vụ mà giao diện PWA (bàn làm việc công trường) được thiết kế cho.
 * Project leader là Nhân viên kỹ thuật được gán cờ isLeader ở từng dự án nên đã nằm trong nhóm này.
 * Lưu ý: khác với FIELD_ROLES ở App.tsx — đó là quyền truy cập route /field (kể cả trên desktop).
 */
export const PWA_OPTIMIZED_ROLES: readonly string[] = ['siteengineer'];

export const isPWAOptimizedRole = (role?: string | null): boolean =>
  !!role && PWA_OPTIMIZED_ROLES.includes(role.toLowerCase());

/**
 * Các màn hình đã được tối ưu cho chế độ PWA của Nhân viên kỹ thuật:
 * bàn làm việc công trường, chi tiết công việc, nhật ký thi công, danh sách dự án, thông báo và trang cá nhân.
 * Mọi màn hình khác (phiếu nhập/xuất, đơn mua hàng, nghiệm thu, báo cáo, sự cố...) cần màn hình lớn.
 */
const PWA_ALLOWED_EXACT_PATHS = ['/field', '/field/tasks', '/projects', '/profile', '/notifications'];

const PWA_ALLOWED_PATH_PATTERNS = [
  /^\/tasks\/[^/]+$/,                          // chi tiết công việc
  /^\/projects\/[^/]+\/logs$/,                 // nhật ký của dự án
  /^\/projects\/[^/]+\/tasks\/[^/]+\/logs$/,   // nhật ký của một công việc
];

/** Workspace dự án chỉ mở được ở tab nhật ký — các tab khác (kho, BOQ, sự cố...) là màn hình desktop. */
const PROJECT_WORKSPACE_PATTERN = /^\/projects\/[^/]+$/;

export const isPWAAllowedFieldRoute = (pathname: string, search = ''): boolean => {
  if (PWA_ALLOWED_EXACT_PATHS.includes(pathname)) return true;
  if (PWA_ALLOWED_PATH_PATTERNS.some(pattern => pattern.test(pathname))) return true;

  if (PROJECT_WORKSPACE_PATTERN.test(pathname)) {
    const tab = new URLSearchParams(search).get('tab');
    return !tab || tab.toLowerCase() === 'logs';
  }

  return false;
};

/** iPhone/iPad running Safari — includes iPadOS which reports as "MacIntel" but has touch support. */
export const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
};
