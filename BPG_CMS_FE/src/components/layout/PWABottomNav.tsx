import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ClipboardList, BookOpen, AlertTriangle, ListChecks, User } from 'lucide-react';
import { getActiveProjectId } from '../../utils/activeProject';

export const PWABottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeProjectId = getActiveProjectId(location.pathname);

  const navItems = [
    {
      id: 'field',
      label: 'Việc tôi',
      icon: ClipboardList,
      path: '/field?standalone=true',
      isActive: location.pathname === '/field' || location.pathname.startsWith('/tasks/')
    },
    {
      id: 'logs',
      label: 'Nhật ký',
      icon: BookOpen,
      path: activeProjectId ? `/projects/${activeProjectId}/logs` : '/field',
      isActive: location.pathname.includes('/logs')
    },
    {
      id: 'incidents',
      label: 'Sự cố',
      icon: AlertTriangle,
      path: activeProjectId ? `/incidents?projectId=${activeProjectId}` : '/incidents',
      isActive: location.pathname.startsWith('/incidents')
    },
    {
      id: 'tasks',
      label: 'Công việc',
      icon: ListChecks,
      path: activeProjectId ? `/field/tasks?projectId=${activeProjectId}` : '/field/tasks',
      isActive: location.pathname === '/field/tasks'
    },
    {
      id: 'profile',
      label: 'Cá nhân',
      icon: User,
      path: '/profile',
      isActive: location.pathname === '/profile'
    }
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 pt-1.5 flex justify-around items-center md:hidden"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
    >
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
            <Icon size={20} className={active ? 'scale-110 transition-transform text-blue-600' : 'text-slate-500'} />
            <span className="text-[10px] mt-1 tracking-tight truncate w-full text-center">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
