import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { Badge } from '../ui';
import { formatRelativeTime } from '../../utils/dateHelpers';

const resolveNotificationUrl = (noti: any): string | null => {
  const referenceType = noti.referenceType;
  const referenceId = noti.referenceId;
  const titleOrContent = ((noti.title || '') + ' ' + (noti.content || '')).toLowerCase();
  
  if (!referenceType) return null;
  if (referenceType === 'Project' && referenceId) {
    return `/projects/${referenceId}`;
  }
  if (referenceType === 'Task' && referenceId) {
    return `/tasks/${referenceId}`;
  }
  if (referenceType.startsWith('/')) {
    const projectWorkspaceRegex = /^\/projects\/(\d+)\/workspace\/([a-zA-Z0-9_-]+)/i;
    const match = referenceType.match(projectWorkspaceRegex);
    if (match) {
      const projectId = match[1];
      let tab = match[2].toLowerCase();
      
      // If it's incidents workspace link, check if it's a material/inventory incident
      if (tab === 'incidents' && (titleOrContent.includes('vật tư') || titleOrContent.includes('tồn kho') || titleOrContent.includes('thất thoát') || titleOrContent.includes('hàng hóa'))) {
        tab = 'inventoryincidents';
      }
      
      if (projectId === '0') {
        if (tab === 'inventoryadjustments') return '/inventory-adjustments';
        if (tab === 'inventoryincidents') return '/materials-control';
      }

      return `/projects/${projectId}?tab=${tab}`;
    }
    if (referenceType.includes('/acceptance') && referenceId) {
      return `${referenceType}?historyId=${referenceId}`;
    }
    return referenceType;
  }
  return null;
};

export const HeaderNotification: React.FC = () => {
  const { notifications, unreadCount, hasEmergencyUnread, markAsRead, markAllAsRead } = useNotification();
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
    
    const url = resolveNotificationUrl(noti);
    if (url) {
      navigate(url);
    } else {
      navigate('/notifications');
    }
  };

  const visible = notifications.slice(0, 5);
  const isEmergency = (noti: any) => noti.notificationType === 'EmergencyStop';

  return (
    <>
      {/* CSS animation cho chuông khẩn cấp */}
      <style>{`
        @keyframes bell-emergency-pulse {
          0%   { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 0px #ef4444); }
          15%  { transform: scale(1.15) rotate(-8deg); filter: drop-shadow(0 0 6px #ef4444); }
          30%  { transform: scale(1.15) rotate(8deg); filter: drop-shadow(0 0 8px #ef4444); }
          45%  { transform: scale(1.1) rotate(-5deg); filter: drop-shadow(0 0 6px #ef4444); }
          60%  { transform: scale(1.1) rotate(5deg); filter: drop-shadow(0 0 4px #ef4444); }
          75%  { transform: scale(1.05) rotate(0deg); filter: drop-shadow(0 0 2px #ef4444); }
          100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 0px #ef4444); }
        }
        @keyframes emergency-badge-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .bell-emergency { animation: bell-emergency-pulse 1.4s ease-in-out infinite; color: #ef4444 !important; }
        .badge-emergency { animation: emergency-badge-blink 0.8s ease-in-out infinite; background: #ef4444 !important; }
        .notif-item-emergency {
          background: linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.05) 100%) !important;
          border-left: 3px solid #ef4444;
        }
        .notif-item-emergency:hover { background: rgba(239,68,68,0.2) !important; }
      `}</style>

      <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="nav-icon-btn"
          title="Thông báo"
          style={{ position: 'relative', padding: '8px', borderRadius: '50%', border: 'none', background: 'transparent', color: hasEmergencyUnread ? '#ef4444' : 'hsl(var(--text-secondary))', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Bell size={20} className={hasEmergencyUnread ? 'bell-emergency' : ''} />
          {unreadCount > 0 && (
            <Badge
              variant="danger"
              className={hasEmergencyUnread ? 'badge-emergency' : ''}
              style={{ position: 'absolute', top: '-2px', right: '-2px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, boxShadow: '0 0 0 2px hsl(var(--bg-card))' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </button>

        {isOpen && (
          <div className="animate-slide-up" style={{ position: 'absolute', right: 0, marginTop: '8px', width: 'min(360px, calc(100vw - 48px))', maxWidth: 'calc(100vw - 48px)', zIndex: 100, borderRadius: '12px', border: hasEmergencyUnread ? '1px solid rgba(239,68,68,0.5)' : '1px solid hsl(var(--border))', overflow: 'hidden', background: 'hsl(var(--bg-card))', boxShadow: hasEmergencyUnread ? '0 0 0 3px rgba(239,68,68,0.15), var(--shadow-lg)' : 'var(--shadow-lg)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid hsl(var(--border))', background: hasEmergencyUnread ? 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, transparent 100%)' : 'transparent' }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {hasEmergencyUnread && <span style={{ fontSize: '14px' }}>🚨</span>}
                Thông báo {unreadCount > 0 && <span style={{ color: hasEmergencyUnread ? '#ef4444' : 'hsl(var(--primary))', marginLeft: '4px' }}>({unreadCount} mới)</span>}
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
                visible.map((noti) => {
                  const emergency = isEmergency(noti) && !noti.isRead;
                  return (
                    <div
                      key={noti.notificationId}
                      className={emergency ? 'notif-item-emergency' : ''}
                      style={{
                        display: 'flex', gap: '10px', padding: '12px 16px',
                        borderBottom: '1px solid hsl(var(--border))',
                        background: emergency ? undefined : (noti.isRead ? 'transparent' : 'hsl(var(--primary-glow))'),
                        transition: 'background var(--transition-fast)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => !emergency && (e.currentTarget.style.background = 'hsl(var(--bg-main))')}
                      onMouseLeave={e => !emergency && (e.currentTarget.style.background = noti.isRead ? 'transparent' : 'hsl(var(--primary-glow))')}
                    >
                      {/* Dot / Emergency icon */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: emergency ? '2px' : '5px', flexShrink: 0 }}>
                        {emergency
                          ? <span style={{ fontSize: '16px', lineHeight: 1 }}>🚨</span>
                          : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: noti.isRead ? 'hsl(var(--border))' : 'hsl(var(--primary))', flexShrink: 0, marginTop: '3px' }} />
                        }
                      </div>

                      {/* Content */}
                      <div
                        onClick={() => handleItemClick(noti)}
                        style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: noti.isRead ? 500 : 700, color: emergency ? '#ef4444' : 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {noti.title}
                          </span>
                          {emergency && (
                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', background: '#ef4444', color: '#fff', letterSpacing: '0.5px', flexShrink: 0 }}>
                              KHẨN
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                          {noti.content}
                        </span>
                        <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                          {formatRelativeTime(noti.createdAt)}
                        </span>
                      </div>

                      {/* Mark as read button */}
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
                  );
                })
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
    </>
  );
};

