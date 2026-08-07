import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ClipboardList, BookOpen, Bell, User } from 'lucide-react';
import { getActiveProjectId } from '../../utils/activeProject';
import { useNotification } from '../../context/NotificationContext';
import { usePWA } from '../../context/PWAContext';
import { triggerGlobalLoading } from '../../context/LoadingContext';

export const PWABottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount, hasEmergencyUnread } = useNotification();
  const { shouldBlock } = usePWA();

  const activeProjectId = getActiveProjectId(location.pathname);

  const handleNavClick = (path: string) => {
    if (location.pathname !== path) {
      triggerGlobalLoading('Đang tải trang...');
    }
    navigate(path);
  };

  const navItems: Array<{
    id: string;
    label: string;
    icon: React.ElementType;
    path: string;
    isActive: boolean;
    badge?: number;
    emergency?: boolean;
  }> = [
    {
      id: 'field',
      label: 'Việc tôi',
      icon: ClipboardList,
      path: '/field?standalone=true',
      isActive: location.pathname.startsWith('/field') || location.pathname.startsWith('/tasks/')
    },
    {
      id: 'logs',
      label: 'Nhật ký',
      icon: BookOpen,
      path: activeProjectId ? `/projects/${activeProjectId}/logs` : '/field',
      isActive: location.pathname.includes('/logs')
    },
    {
      id: 'notifications',
      label: 'Thông báo',
      icon: Bell,
      path: '/notifications',
      isActive: location.pathname === '/notifications',
      badge: unreadCount,
      emergency: hasEmergencyUnread
    },
    {
      id: 'profile',
      label: 'Cá nhân',
      icon: User,
      path: '/profile',
      isActive: location.pathname === '/profile'
    }
  ];

  // Chức vụ ngoài nhóm field chỉ còn trang Cá nhân — nơi hiển thị cảnh báo và các lựa chọn tiếp theo.
  const visibleItems = shouldBlock ? navItems.filter(item => item.id === 'profile') : navItems;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--bg-card))]/95 backdrop-blur-md border-t border-[hsl(var(--border))] shadow-lg px-2 pt-1.5 flex justify-around items-center md:hidden"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
    >
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = item.isActive;
        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.path)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all relative ${
              active
                ? 'text-[hsl(var(--primary))] font-semibold'
                : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
            }`}
          >
            <span className="relative flex items-center justify-center">
              <Icon
                size={20}
                className={
                  item.emergency
                    ? 'text-red-500'
                    : active
                      ? 'scale-110 transition-transform text-[hsl(var(--primary))]'
                      : 'text-[hsl(var(--text-muted))]'
                }
              />
              {!!item.badge && item.badge > 0 && (
                <span
                  className={`absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center ${
                    item.emergency ? 'bg-red-500 animate-pulse' : 'bg-red-500'
                  }`}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>
            <span className="text-[10px] mt-1 tracking-tight truncate w-full text-center">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
