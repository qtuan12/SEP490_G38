import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { triggerGlobalLoading, triggerGlobalHideLoading } from '../../context/LoadingContext';
import {
  LayoutDashboard,
  Users,
  LogOut,
  Hammer,
  Menu,
  FileText,
  Truck,
  Ruler,
  Tags,
  Package,
  SlidersHorizontal,
} from 'lucide-react';
import { Button, Avatar, Badge } from '../ui';
import { getRoleLabel, getRoleBadgeVariant as getRoleVariant } from '../../utils/roleHelpers';
import { HeaderNotification } from './HeaderNotification';
import { PWABottomNav } from './PWABottomNav';
import { OfflineBanner } from './OfflineBanner';
import { RoleGroup } from '../../auth/roles';
import { isPWAMode } from '../../utils/pwaHelpers';
import { usePWA } from '../../context/PWAContext';
import { PWAUnsupportedScreenNotice } from '../PWARestrictedNotice';

// Màn hình duy nhất mà chức vụ ngoài nhóm field vẫn xem được ở chế độ PWA.
const PWA_ALLOWED_WHEN_BLOCKED = ['/profile'];

// Thanh điều hướng PWA chỉ hiện trong phạm vi "Việc của tôi" (field workflow) —
// ẩn đi khi người dùng thoát ra các tab chung (dashboard, WBS hub, quản trị...).
const isFieldScopedRoute = (pathname: string): boolean => {
  if (pathname.startsWith('/field')) return true;
  if (pathname.startsWith('/tasks/')) return true;
  if (pathname.startsWith('/incidents')) return true;
  if (pathname === '/notifications') return true;
  if (pathname === '/profile') return true;
  if (pathname === '/projects') return true;
  if (pathname.startsWith('/projects/') && pathname.includes('/logs')) return true;
  return false;
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasAnyRole } = useAuth();
  const { companyName, companyLogoUrl } = useCompany();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  // Chức vụ ngoài nhóm field: khoá lại ở trang Cá nhân, mọi màn hình khác đều bị đưa về đó.
  // Nhân viên kỹ thuật: chặn tại chỗ những màn hình chưa tối ưu cho di động (mở từ link thông báo).
  const { shouldBlock, isUnsupportedScreen } = usePWA();

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerGlobalHideLoading();
    }, 250);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (shouldBlock && !PWA_ALLOWED_WHEN_BLOCKED.includes(location.pathname)) {
    return <Navigate to="/profile" replace />;
  }

  const handleNavClick = (path: string, disabled?: boolean) => {
    if (disabled) return;
    if (location.pathname !== path) {
      triggerGlobalLoading('Đang tải trang...');
    }
    navigate(path);
    setIsSidebarOpen(false);
  };

  const handleLogout = () => {
    triggerGlobalLoading('Đang đăng xuất...');
    logout();
    navigate('/login');
    setTimeout(() => {
      triggerGlobalHideLoading();
    }, 300);
  };

  const navItems: Array<{
    name: string;
    path: string;
    icon: React.ReactNode;
    allowedRoles?: readonly string[];
    disabled?: boolean;
  }> = [
    { name: 'Tổng quan', path: '/dashboard', icon: <LayoutDashboard size={20} />, allowedRoles: RoleGroup.ProjectViewers },
    { name: 'Quản lý Thành viên', path: '/users', icon: <Users size={20} />, allowedRoles: RoleGroup.AdminOnly },
    { name: 'Dự án thi công', path: '/projects', icon: <Hammer size={20} />, allowedRoles: RoleGroup.ProjectViewers },
    { name: 'Quản lý Nhà cung cấp', path: '/suppliers', icon: <Truck size={20} />, allowedRoles: RoleGroup.SupplierViewers },
    { name: 'Quản lý Đơn vị', path: '/units', icon: <Ruler size={20} />, allowedRoles: RoleGroup.ProjectViewers },
    { name: 'Loại Vật tư', path: '/categories', icon: <Tags size={20} />, allowedRoles: RoleGroup.ProjectViewers },
    { name: 'Danh sách Vật tư', path: '/materials', icon: <Package size={20} />, allowedRoles: RoleGroup.ProjectViewers },
    { name: 'Báo cáo & Thống kê', path: '/reports', icon: <FileText size={20} />, allowedRoles: RoleGroup.Reports },
    { name: 'Cấu hình hệ thống', path: '/system-config', icon: <SlidersHorizontal size={20} />, allowedRoles: RoleGroup.AdminOnly },
  ];

  const filteredNavItems = navItems.filter(
    (item) => !item.allowedRoles || hasAnyRole(item.allowedRoles),
  );

  // Ở chế độ PWA, điều hướng hoàn toàn bằng bottom nav — ẩn hẳn sidebar và nút mở sidebar.
  const pwa = isPWAMode();
  const showBottomNav = isFieldScopedRoute(location.pathname) || shouldBlock || isUnsupportedScreen;

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--bg-main))]">
      {!pwa && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {!pwa && (
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        ${isCollapsed ? 'w-[80px]' : 'w-[260px]'} 
        bg-[hsl(var(--bg-card))] border-r border-[hsl(var(--border))]
        flex flex-col shrink-0
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className={`flex items-center gap-3 border-b border-[hsl(var(--border))] ${isCollapsed ? 'py-5 justify-center' : 'px-6 py-5 justify-between'}`}>
          <div
            className="flex items-center gap-3 justify-center cursor-pointer"
            onClick={() => handleNavClick('/dashboard')}
          >
            {!isCollapsed && (
              <img
                src={companyLogoUrl}
                alt={`${companyName} Logo`}
                className="h-10 w-10 object-contain rounded-sm"
              />
            )}
            {!isCollapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="text-xl font-bold tracking-wider">{companyName}</h1>
                <span className="text-[11px] text-[hsl(var(--text-muted))] uppercase font-semibold">BPG CMS</span>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors"
            title="Thu gọn/Mở rộng Sidebar"
          >
            <Menu size={24} />
          </button>
        </div>

        <nav className="flex-1 flex flex-col gap-2 py-6 px-4 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => handleNavClick(item.path, item.disabled)}
                className={`flex items-center gap-3 w-full p-3 rounded-md transition-all text-sm font-medium border-none outline-none
                  ${isCollapsed ? 'justify-center' : 'justify-start'}
                  ${isActive
                    ? 'bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary-hover))] font-semibold'
                    : item.disabled
                      ? 'text-[hsl(var(--text-muted))] cursor-not-allowed'
                      : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] cursor-pointer'
                  }
                `}
                disabled={item.disabled}
              >
                {item.icon}
                {!isCollapsed && <span>{item.name}</span>}
              </button>
            );
          })}
        </nav>

        {user && (
          <div className="p-4 border-t border-[hsl(var(--border))] flex flex-col gap-3">
            <div
              className={`flex items-center gap-3 cursor-pointer p-1 -m-1 rounded-sm transition-colors hover:bg-[hsl(var(--bg-main))] ${isCollapsed ? 'justify-center' : ''}`}
              onClick={() => handleNavClick('/profile')}
              title="Xem trang cá nhân"
            >
              <Avatar name={user.name} src={user.avatarUrl} size="md" />
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <div className="font-semibold text-sm truncate">{user.name}</div>
                  <Badge variant={getRoleVariant(user.role)} className="mt-0.5 text-[10px]">
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>
              )}
            </div>

            <Button variant="secondary" className="w-full text-sm py-2 px-3" onClick={handleLogout}>
              <LogOut size={16} />
              {!isCollapsed && <span>Đăng xuất</span>}
            </Button>
          </div>
        )}
      </aside>
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <OfflineBanner />
        <header className="h-[60px] md:h-[70px] bg-[hsl(var(--bg-card))] border-b border-[hsl(var(--border))] flex items-center sticky top-0 z-30 lg:px-12 px-4 md:px-6">
          <div className="max-w-[1400px] mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!pwa && (
                <Menu
                  size={24}
                  className="text-[hsl(var(--text-secondary))] cursor-pointer lg:hidden"
                  onClick={() => setIsSidebarOpen(true)}
                />
              )}
              <h2 className="text-base sm:text-xl font-semibold truncate">
                {location.pathname === '/dashboard' ? 'Bảng điều khiển' :
                  location.pathname === '/users' ? 'Quản lý Thành viên' :
                    location.pathname === '/suppliers' ? 'Quản lý Nhà cung cấp' :
                      location.pathname === '/units' ? 'Quản lý Đơn vị tính' :
                        location.pathname === '/categories' ? 'Danh mục Vật tư' :
                          location.pathname === '/materials' ? 'Kho Vật tư' :
                            location.pathname === '/projects' ? 'Danh sách Dự án' :
                              location.pathname === '/field' ? 'Việc của tôi' :
                              location.pathname.startsWith('/projects/') ? 'Dự án' :
                                location.pathname === '/system-config' ? 'Cấu hình Hệ thống' :
                                  location.pathname === '/profile' ? 'Hồ sơ cá nhân' : 'Hệ thống'}
              </h2>
            </div>
            {/* Chuông thông báo: ẩn khi đã có tab Thông báo dưới bottom nav, và ẩn hẳn với chức vụ bị hạn chế */}
            {!shouldBlock && (
              <div className={`items-center gap-4 ${showBottomNav ? 'hidden md:flex' : 'flex'}`}>
                <HeaderNotification />
              </div>
            )}
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto lg:p-12 p-4 md:p-6 md:pb-6"
          style={showBottomNav ? { paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' } : undefined}
        >
          <div className="max-w-[1400px] mx-auto w-full">
            {isUnsupportedScreen ? <PWAUnsupportedScreenNotice /> : children}
          </div>
        </main>
      </div>

      {/* PWA Mobile Bottom Navigation Bar — chỉ hiện trong phạm vi "Việc của tôi" */}
      {showBottomNav && <PWABottomNav />}
    </div>
  );
};
