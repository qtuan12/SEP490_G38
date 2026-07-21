import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useNavigate, useLocation } from 'react-router-dom';
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
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react';
import { Button, Avatar, Badge } from '../ui';
import { getRoleLabel, getRoleBadgeVariant as getRoleVariant } from '../../utils/roleHelpers';
import { HeaderNotification } from './HeaderNotification';


export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { companyName, companyLogoUrl } = useCompany();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems: Array<{ name: string; path: string; icon: React.ReactNode; roles: string[]; disabled?: boolean }> = [
    { name: 'Tổng quan', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['technicalmanager', 'projectleader', 'siteengineer', 'director', 'accountant'] },
    { name: 'Quản lý Thành viên', path: '/users', icon: <Users size={20} />, roles: ['admin'] },
    { name: 'Dự án thi công', path: '/projects', icon: <Hammer size={20} />, roles: ['technicalmanager', 'projectleader', 'siteengineer', 'director', 'accountant'] },
    { name: 'Danh sách đơn hàng', path: '/purchase-orders', icon: <ShoppingCart size={20} />, roles: [] },
    { name: 'Quản lý Nhà cung cấp', path: '/suppliers', icon: <Truck size={20} />, roles: ['admin', 'accountant'] },
    { name: 'Quản lý Đơn vị', path: '/units', icon: <Ruler size={20} />, roles: ['admin'] },
    { name: 'Danh mục Vật tư', path: '/categories', icon: <Tags size={20} />, roles: ['admin'] },
    { name: 'Kho Vật tư', path: '/materials', icon: <Package size={20} />, roles: ['admin'] },
    { name: 'Báo cáo & Thống kê', path: '/reports', icon: <FileText size={20} />, roles: ['director', 'accountant', 'technicalmanager'] },
    { name: 'Cấu hình hệ thống', path: '/system-config', icon: <SlidersHorizontal size={20} />, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (!user || !user.role) return false;
    const userRole = user.role.toLowerCase();
    return item.roles.map(r => r.toLowerCase()).includes(userRole);
  });



  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--bg-main))]">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        ${isCollapsed ? 'w-[80px]' : 'w-[260px]'} 
        bg-[hsl(var(--bg-card))] border-r border-[hsl(var(--border))]
        flex flex-col shrink-0
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className={`flex items-center gap-3 border-b border-[hsl(var(--border))] ${isCollapsed ? 'py-5 justify-center' : 'px-6 py-5 justify-between'}`}>
          <div className="flex items-center gap-3 justify-center">
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
                <span className="text-[11px] text-[hsl(var(--text-muted))] uppercase font-semibold">Construction MVP</span>
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
                onClick={() => { if (!item.disabled) { navigate(item.path); setIsSidebarOpen(false); } }}
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
                {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                {item.disabled && !isCollapsed && (
                  <span className="text-[10px] ml-auto px-2 py-0.5 bg-[hsl(var(--border))] rounded-sm text-[hsl(var(--text-muted))]">
                    Sắp có
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {user && (
          <div className="p-5 border-t border-[hsl(var(--border))] flex flex-col gap-3">
            <div
              className="flex items-center gap-2.5 cursor-pointer p-1 rounded-sm transition-colors hover:bg-[hsl(var(--bg-main))]"
              onClick={() => navigate('/profile')}
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

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="h-[70px] bg-[hsl(var(--bg-card))] border-b border-[hsl(var(--border))] flex items-center sticky top-0 z-30 lg:px-12 px-6">
          <div className="max-w-[1400px] mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Menu
                size={24}
                className="text-[hsl(var(--text-secondary))] cursor-pointer lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
              />
              <h2 className="text-xl font-semibold">
                {location.pathname === '/dashboard' ? 'Bảng điều khiển' :
                  location.pathname === '/users' ? 'Quản lý Thành viên' :
                    location.pathname === '/suppliers' ? 'Quản lý Nhà cung cấp' :
                      location.pathname === '/units' ? 'Quản lý Đơn vị tính' :
                        location.pathname === '/categories' ? 'Danh mục Vật tư' :
                          location.pathname === '/materials' ? 'Kho Vật tư' :
                            location.pathname === '/projects' ? 'Danh sách Dự án' :
                              location.pathname.startsWith('/projects/') ? 'Không gian làm việc Dự án' :
                                location.pathname === '/system-config' ? 'Cấu hình Hệ thống' :
                                  location.pathname === '/profile' ? 'Hồ sơ cá nhân' : 'Hệ thống'}
              </h2>
            </div>
            <div className="flex items-center gap-4">

              <HeaderNotification />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto lg:p-12 p-6">
          <div className="max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
