import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { 
  CheckCheck, 
  Inbox, 
  MessageSquare, 
  FileText, 
  Boxes, 
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui';

export const NotificationsList: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading, fetchNotifications } = useNotification();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchNotifications(page, pageSize);
  }, [page, fetchNotifications]);

  const handleMarkAsRead = async (id: number) => {
    await markAsRead(id);
  };

  const filteredNotis = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'Comment':
        return <MessageSquare size={18} style={{ color: '#60a5fa' }} />;
      case 'DailyLog':
        return <FileText size={18} style={{ color: '#4ade80' }} />;
      case 'MaterialRequest':
        return <Boxes size={18} style={{ color: '#fbbf24' }} />;
      default:
        return <AlertCircle size={18} style={{ color: '#94a3b8' }} />;
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Thông báo</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Quản lý và xem tất cả các cập nhật hệ thống của bạn.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button 
            onClick={markAllAsRead} 
            variant="secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
          >
            <CheckCheck size={16} />
            Đánh dấu đọc tất cả ({unreadCount})
          </Button>
        )}
      </div>

      {/* Main Container */}
      <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '400px', padding: 0 }}>
        {/* Filters */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '10px 24px', gap: '8px' }}>
          {(['all', 'unread', 'read'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => { setFilter(opt); setPage(1); }}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: filter === opt ? 'var(--primary)' : 'transparent',
                color: filter === opt ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {opt === 'all' ? 'Tất cả' : opt === 'unread' ? `Chưa đọc (${unreadCount})` : 'Đã đọc'}
            </button>
          ))}
        </div>

        {/* List Content */}
        <div style={{ flex: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Đang tải thông báo...</span>
            </div>
          ) : filteredNotis.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--text-muted)', gap: '12px' }}>
              <Inbox size={48} strokeWidth={1.2} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Hộp thư trống</p>
                <p style={{ fontSize: '12px', marginTop: '4px', margin: 0 }}>Bạn không có thông báo nào ở trạng thái này.</p>
              </div>
            </div>
          ) : (
            <div>
              {filteredNotis.map((noti) => (
                <div
                  key={noti.notificationId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '18px 24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    position: 'relative',
                    background: noti.isRead ? 'transparent' : 'rgba(var(--primary-glow-rgb, 99, 102, 241), 0.04)',
                    borderLeft: noti.isRead ? '3px solid transparent' : '3px solid var(--primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 }}>
                    {/* Icon container */}
                    <div 
                      style={{ 
                        padding: '10px', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        flexShrink: 0,
                        background: 'rgba(255, 255, 255, 0.03)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)' 
                      }}
                    >
                      {getIcon(noti.notificationType)}
                    </div>
                    {/* Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {noti.title}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {noti.content}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {formatDate(noti.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {!noti.isRead && (
                    <Button
                      onClick={() => handleMarkAsRead(noti.notificationId)}
                      variant="secondary"
                      size="sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, padding: '6px 12px', fontSize: '12px' }}
                      title="Đánh dấu đã đọc"
                    >
                      <Eye size={14} />
                      Đọc
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {!isLoading && filteredNotis.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', padding: '16px 24px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Trang <strong style={{ color: 'var(--text-primary)' }}>{page}</strong>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(prev => prev + 1)}
                disabled={filteredNotis.length < pageSize}
                style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
