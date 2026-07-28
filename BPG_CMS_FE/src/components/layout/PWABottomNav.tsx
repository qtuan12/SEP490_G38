import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ClipboardList, BookOpen, Package, AlertTriangle, Bell } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

export const PWABottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotification();

  const navItems = [
    {
      id: 'field',
      label: 'Việc tôi',
      icon: ClipboardList,
      path: '/field',
      isActive: location.pathname === '/field' || location.pathname.startsWith('/tasks/')
    },
    {
      id: 'logs',
      label: 'Nhật ký',
      icon: BookOpen,
      path: '/field', // Navigates to Field Workbench or recent logs
      isActive: location.pathname.includes('/logs')
    },
    {
      id: 'inventory',
      label: 'Kho vật tư',
      icon: Package,
      path: '/purchase-orders',
      isActive: location.pathname.startsWith('/purchase-orders') || location.pathname.startsWith('/direct-purchases')
    },
    {
      id: 'incidents',
      label: 'Sự cố',
      icon: AlertTriangle,
      path: '/incidents',
      isActive: location.pathname.startsWith('/incidents')
    },
    {
      id: 'notifications',
      label: 'Thông báo',
      icon: Bell,
      path: '/notifications',
      isActive: location.pathname === '/notifications',
      badge: unreadCount > 0 ? unreadCount : undefined
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 py-1.5 flex justify-around items-center md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.isActive;
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all relative ${
              active
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Icon size={20} className={active ? 'scale-110 transition-transform text-blue-600' : 'text-slate-500'} />
              {item.badge !== undefined && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center border border-white animate-pulse">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight truncate w-full text-center">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
