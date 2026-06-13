import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { Badge } from '../ui';

export const HeaderNotification: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const handleNotificationClick = async (noti: any) => {
    if (!noti.isRead) {
      await markAsRead(noti.notificationId);
    }
    setIsOpen(false);
    navigate('/notifications');
  };

  const visibleNotifications = notifications.slice(0, 5);

  // Style objects (Vanilla CSS)
  const buttonStyle: React.CSSProperties = {
    position: 'relative',
    padding: '8px',
    borderRadius: '50%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    marginTop: '8px',
    width: '340px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    zIndex: 100,
    background: 'rgba(30, 41, 59, 0.95)',
    backdropFilter: 'blur(16px)',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
  };

  const itemStyle = (isRead: boolean): React.CSSProperties => ({
    display: 'flex',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    cursor: 'pointer',
    position: 'relative',
    background: isRead ? 'transparent' : 'rgba(var(--primary-glow-rgb, 99, 102, 241), 0.08)',
  });

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      {/* Nút Chuông báo */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={buttonStyle}
        className="nav-icon-btn"
        title="Thông báo"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <Badge
            variant="danger"
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              borderRadius: '9999px',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 0 2px var(--bg-card)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div style={dropdownStyle}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Thông báo mới</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--primary)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <CheckCheck size={14} />
                Đọc tất cả
              </button>
            )}
          </div>

          {/* List items */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {visibleNotifications.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', color: 'var(--text-muted)', gap: '8px' }}>
                <Inbox size={32} strokeWidth={1.5} />
                <span style={{ fontSize: '12px' }}>Không có thông báo mới</span>
              </div>
            ) : (
              visibleNotifications.map((noti) => (
                <div
                  key={noti.notificationId}
                  onClick={() => handleNotificationClick(noti)}
                  style={itemStyle(noti.isRead)}
                >
                  {!noti.isRead && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary)',
                      }}
                    />
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, paddingLeft: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {noti.title}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                      {noti.content}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {formatRelativeTime(noti.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              style={{
                width: '100%',
                padding: '10px 0',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--primary)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderTop: '1px solid var(--border)',
              }}
            >
              Xem tất cả thông báo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
