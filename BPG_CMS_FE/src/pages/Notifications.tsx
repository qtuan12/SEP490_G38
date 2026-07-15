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
    if (referenceType.includes('/acceptance') && referenceId) {
      return `${referenceType}?historyId=${referenceId}`;
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
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))] m-0">Thông báo</h1>
          <p className="text-xs text-[hsl(var(--text-secondary))] mt-1 m-0">
            {totalCount > 0 ? `${totalCount} thông báo · ${unreadCount} chưa đọc` : 'Tất cả các cập nhật và thông báo từ hệ thống.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="secondary" className="flex items-center gap-2">
            <CheckCheck size={15} /> Đánh dấu đọc tất cả ({unreadCount})
          </Button>
        )}
      </div>

      {/* Main Card */}
      <div className="card p-0 overflow-hidden bg-[hsl(var(--bg-card))]">
        {/* Tabs */}
        <div className="flex gap-1 px-5 py-3 border-b border-[hsl(var(--border))]">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border-none ${
                filter === tab.key
                  ? 'bg-[hsl(var(--primary))] text-white'
                  : 'bg-transparent text-[hsl(var(--text-secondary))] hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-[hsl(var(--text-secondary))]">
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[hsl(var(--text-muted))] gap-2.5">
            <Inbox size={44} strokeWidth={1.2} />
            <p className="text-sm font-semibold m-0">Không có thông báo</p>
            <p className="text-xs m-0">
              {filter === 'unread' ? 'Bạn đã đọc hết thông báo rồi!' : 'Bạn chưa có thông báo nào.'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map(noti => (
              <div
                key={noti.notificationId}
                onClick={() => handleItemClick(noti)}
                className={`flex items-start gap-4 px-5 py-4 border-b border-[hsl(var(--border))] border-l-[3px] transition-colors ${
                  noti.referenceType === 'Task' ? 'cursor-pointer' : 'cursor-default'
                } ${
                  noti.isRead
                    ? 'border-l-transparent bg-transparent'
                    : 'border-l-[hsl(var(--primary))] bg-[hsl(var(--primary-glow))]'
                }`}
              >
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))] flex items-center justify-center shrink-0">
                  <Bell size={16} className="text-[hsl(var(--primary))]" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`m-0 text-sm text-[hsl(var(--text-primary))] ${noti.isRead ? 'font-medium' : 'font-bold'}`}>
                    {noti.title}
                  </p>
                  <p className="mt-1 mb-1.5 text-xs text-[hsl(var(--text-secondary))] leading-normal">
                    {noti.content}
                  </p>
                  <span className="text-[11px] text-[hsl(var(--text-muted))]">
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
                    className="shrink-0 text-xs"
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
