import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  LogOut, 
  Hammer, 
  Boxes, 
  Menu, ChevronLeft, ChevronRight, 
  FileText,
  User
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'tpkt', 'kỹ sư', 'giám đốc', 'kế toán'] },
    { name: 'Quản lý Thành viên', path: '/users', icon: <Users size={20} />, roles: ['admin'] },
    { name: 'Dự án (WBS)', path: '/projects', icon: <Hammer size={20} />, roles: ['admin', 'tpkt', 'kỹ sư', 'giám đốc'] },
    { name: 'Kiểm soát Vật tư', path: '#materials', icon: <Boxes size={20} />, roles: ['admin', 'tpkt', 'kỹ sư', 'giám đốc', 'kế toán'], disabled: true },
    { name: 'Báo cáo', path: '#reports', icon: <FileText size={20} />, roles: ['admin', 'tpkt', 'giám đốc', 'kế toán'], disabled: true },
  ];

  const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'tpkt': return 'TP Kỹ Thuật';
      case 'kỹ sư': return 'Kỹ Sư Hiện Trường';
      case 'giám đốc': return 'Giám Đốc';
      case 'kế toán': return 'Kế Toán';
      default: return role;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'badge-danger';
      case 'tpkt': return 'badge-primary';
      case 'kỹ sư': return 'badge-success';
      case 'giám đốc': return 'badge-warning';
      case 'kế toán': return 'badge-primary';
      default: return 'badge-secondary';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--bg-main))]">
      {/* Sidebar */}
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        ${isCollapsed ? 'w-[80px]' : 'w-[260px]'} 
        bg-[hsl(var(--bg-card))] border-r border-[hsl(var(--border))]
        flex flex-col shrink-0
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Section */}
        <div style={{ 
          padding: isCollapsed ? '20px 0' : '20px 24px', 
          borderBottom: '1px solid hsl(var(--border))', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: '12px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
            {!isCollapsed && (
              <img 
                src="/logo.png" 
                alt="BPG Logo" 
                style={{ 
                  height: '40px', 
                  width: '40px', 
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-sm)'
                }} 
              />
            )}
            {!isCollapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.05em' }}>BPG CMS</h1>
              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 600 }}>Construction MVP</span>
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

        {/* Navigation */}
        <nav style={{ padding: '24px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => { if(!item.disabled) { navigate(item.path); setIsSidebarOpen(false); } }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: isActive ? 'hsl(var(--primary-glow))' : 'transparent',
                  color: isActive ? 'hsl(var(--primary-hover))' : item.disabled ? 'hsl(var(--text-muted))' : 'hsl(var(--text-secondary))',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.95rem',
                  textAlign: 'left',
                  transition: 'all var(--transition-fast)'
                }}
                disabled={item.disabled}
              >
                {item.icon}
                {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                {item.disabled && !isCollapsed && (
                  <span style={{ 
                    fontSize: '0.65rem', 
                    marginLeft: 'auto', 
                    padding: '2px 6px', 
                    backgroundColor: 'hsl(var(--border))', 
                    borderRadius: 'var(--radius-sm)',
                    color: 'hsl(var(--text-muted))'
                  }}>Sắp có</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Footer Profile */}
        {user && (
          <div style={{
            padding: '20px 16px',
            borderTop: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)' }} 
              onClick={() => navigate('/profile')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--bg-main))'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Xem trang cá nhân"
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'hsl(var(--border))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'hsl(var(--text-primary))'
              }}>
                <User size={20} />
              </div>
              {!isCollapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.name}
                </div>
                <span className={`badge ${getRoleBadgeClass(user.role)}`} style={{ fontSize: '0.65rem', marginTop: '2px' }}>
                  {getRoleLabel(user.role)}
                </span>
              </div>
              )}
            </div>
            
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px' }}
            >
              <LogOut size={16} />
              {!isCollapsed && <span>Đăng xuất</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Top Header */}
        <header className="h-[70px] bg-[hsl(var(--bg-card))] border-b border-[hsl(var(--border))] flex items-center sticky top-0 z-30" style={{ padding: window.innerWidth >= 1024 ? '0 48px' : '0 24px' }}>
          <div className="max-w-[1400px] mx-auto w-full flex items-center justify-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Menu 
                size={24} 
                className="text-[hsl(var(--text-secondary))] cursor-pointer lg:hidden" 
                onClick={() => setIsSidebarOpen(true)} 
              />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {location.pathname === '/dashboard' ? 'Bảng điều khiển' : 
                 location.pathname === '/users' ? 'Quản lý Thành viên' : 
                 location.pathname === '/projects' ? 'Danh sách Dự án WBS' : 
                 location.pathname.startsWith('/projects/') ? 'Không gian làm việc Dự án' :
                 location.pathname === '/profile' ? 'Hồ sơ cá nhân' : 'Hệ thống'}
              </h2>
            </div>
            <div style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', display: 'flex', gap: '4px' }} className="hidden md:flex">
              Dự án: <strong style={{ color: 'hsl(var(--text-primary))' }}>BPG Construction (MVP)</strong>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto" style={{ padding: window.innerWidth >= 1024 ? '48px' : '24px' }}>
          <div className="max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
