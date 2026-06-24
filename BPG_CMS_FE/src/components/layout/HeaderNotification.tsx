import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { Badge } from '../ui';
import { formatRelativeTime } from '../../utils/dateHelpers';

export const HeaderNotification: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = async (noti: any) => {
    if (!noti.isRead) await markAsRead(noti.notificationId);
    setIsOpen(false);
    if (noti.referenceType === 'Task' && noti.referenceId) {
      navigate(`/tasks/${noti.referenceId}`);
    } else {
      navigate('/notifications');
    }
  };

  const visible = notifications.slice(0, 5);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="nav-icon-btn"
        title="Thông báo"
        style={{ position: 'relative', padding: '8px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'hsl(var(--text-secondary))', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <Badge
            variant="danger"
            style={{ position: 'absolute', top: '-2px', right: '-2px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, boxShadow: '0 0 0 2px hsl(var(--bg-card))' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </button>

      {isOpen && (
        <div className="animate-slide-up" style={{ position: 'absolute', right: 0, marginTop: '8px', width: '360px', zIndex: 100, borderRadius: '12px', border: '1px solid hsl(var(--border))', overflow: 'hidden', background: 'hsl(var(--bg-card))', boxShadow: 'var(--shadow-lg)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid hsl(var(--border))' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'hsl(var(--text-primary))' }}>
              Thông báo {unreadCount > 0 && <span style={{ color: 'hsl(var(--primary))', marginLeft: '4px' }}>({unreadCount} mới)</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'hsl(var(--primary))', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 500, padding: '4px 8px', borderRadius: '6px' }}
              >
                <CheckCheck size={14} /> Đọc tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {visible.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', color: 'hsl(var(--text-muted))', gap: '8px' }}>
                <Inbox size={32} strokeWidth={1.5} />
                <span style={{ fontSize: '13px' }}>Không có thông báo nào</span>
              </div>
            ) : (
              visible.map((noti) => (
                <div
                  key={noti.notificationId}
                  style={{
                    display: 'flex', gap: '10px', padding: '12px 16px',
                    borderBottom: '1px solid hsl(var(--border))',
                    background: noti.isRead ? 'transparent' : 'hsl(var(--primary-glow))',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-main))')}
                  onMouseLeave={e => (e.currentTarget.style.background = noti.isRead ? 'transparent' : 'hsl(var(--primary-glow))')}
                >
                  {/* Dot indicator */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '5px', flexShrink: 0 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: noti.isRead ? 'hsl(var(--border))' : 'hsl(var(--primary))', flexShrink: 0 }} />
                  </div>

                  {/* Content — click to navigate */}
                  <div
                    onClick={() => handleItemClick(noti)}
                    style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: noti.isRead ? 500 : 600, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {noti.title}
                    </span>
                    <span style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                      {noti.content}
                    </span>
                    <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                      {formatRelativeTime(noti.createdAt)}
                    </span>
                  </div>

                  {/* Mark as read button — chỉ hiện với thông báo chưa đọc */}
                  {!noti.isRead && (
                    <button
                      onClick={e => { e.stopPropagation(); markAsRead(noti.notificationId); }}
                      title="Đánh dấu đã đọc"
                      style={{
                        flexShrink: 0, alignSelf: 'center',
                        padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                        border: '1px solid hsl(var(--border))', background: 'hsl(var(--bg-card))',
                        color: 'hsl(var(--text-secondary))', cursor: 'pointer', whiteSpace: 'nowrap',
                        transition: 'all var(--transition-fast)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'hsl(var(--primary))'; e.currentTarget.style.color = 'hsl(var(--primary))'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border))'; e.currentTarget.style.color = 'hsl(var(--text-secondary))'; }}
                    >
                      Đọc
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid hsl(var(--border))' }}>
            <button
              onClick={() => { setIsOpen(false); navigate('/notifications'); }}
              style={{ width: '100%', padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--primary))', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Xem tất cả thông báo →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
