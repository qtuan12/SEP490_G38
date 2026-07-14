import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { CheckCheck, Inbox, Bell } from 'lucide-react';
import { Button, Pagination } from '../components/ui';
import { formatDate } from '../utils/dateHelpers';

const PAGE_SIZE = 10;

const resolveNotificationUrl = (noti: any): string | null => {
  const referenceType = noti.referenceType;
  const referenceId = noti.referenceId;
  const titleOrContent = ((noti.title || '') + ' ' + (noti.content || '')).toLowerCase();
  
  if (!referenceType) return null;
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
    return referenceType;
  }
  return null;
};

export const NotificationsList: React.FC = () => {
  const { notifications, unreadCount, totalCount, markAsRead, markAllAsRead, isLoading, fetchNotifications } = useNotification();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications(page, PAGE_SIZE);
  }, [page, fetchNotifications]);

  const filtered = filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleItemClick = async (noti: any) => {
    if (!noti.isRead) {
      await markAsRead(noti.notificationId);
    }
    const url = resolveNotificationUrl(noti);
    if (url) {
      navigate(url);
    }
  };

  const tabs: { key: 'all' | 'unread'; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'unread', label: `Chưa đọc${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'hsl(var(--text-primary))' }}>Thông báo</h1>
          <p style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))', marginTop: '4px', margin: 0 }}>
            {totalCount > 0 ? `${totalCount} thông báo · ${unreadCount} chưa đọc` : 'Tất cả các cập nhật và thông báo từ hệ thống.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCheck size={15} /> Đánh dấu đọc tất cả ({unreadCount})
          </Button>
        )}
      </div>

      {/* Main Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 20px', borderBottom: '1px solid hsl(var(--border))' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setPage(1); }}
              style={{
                padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all var(--transition-fast)',
                background: filter === tab.key ? 'hsl(var(--primary))' : 'transparent',
                color: filter === tab.key ? '#fff' : 'hsl(var(--text-secondary))',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'hsl(var(--text-secondary))' }}>
            <span style={{ fontSize: '14px' }}>Đang tải...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'hsl(var(--text-muted))', gap: '10px' }}>
            <Inbox size={44} strokeWidth={1.2} />
            <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Không có thông báo</p>
            <p style={{ fontSize: '13px', margin: 0 }}>
              {filter === 'unread' ? 'Bạn đã đọc hết thông báo rồi!' : 'Bạn chưa có thông báo nào.'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map(noti => (
              <div
                key={noti.notificationId}
                onClick={() => handleItemClick(noti)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px 20px',
                  borderBottom: '1px solid hsl(var(--border))',
                  borderLeft: `3px solid ${noti.isRead ? 'transparent' : 'hsl(var(--primary))'}`,
                  background: noti.isRead ? 'transparent' : 'hsl(var(--primary-glow))',
                  cursor: resolveNotificationUrl(noti) ? 'pointer' : 'default',
                }}
              >
                {/* Icon */}
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bell size={16} style={{ color: 'hsl(var(--primary))' }} />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: noti.isRead ? 500 : 700, color: 'hsl(var(--text-primary))' }}>
                    {noti.title}
                  </p>
                  <p style={{ margin: '4px 0 6px', fontSize: '13px', color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                    {noti.content}
                  </p>
                  <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                    {formatDate(noti.createdAt)}
                  </span>
                </div>

                {/* Action */}
                {!noti.isRead && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(noti.notificationId);
                    }}
                    variant="secondary"
                    size="sm"
                    style={{ flexShrink: 0, fontSize: '12px' }}
                  >
                    Đánh dấu đã đọc
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => { setPage(p); setFilter('all'); }}
          />
        )}
      </div>
    </div>
  );
};
