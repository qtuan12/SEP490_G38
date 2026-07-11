import React from 'react';
import { Bell, Wrench, Package, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui';
import type { Notification } from '../../../types/notification';
import { formatRelativeTime } from '../../../utils/dateHelpers';

interface RecentActivitiesProps {
  activities: Notification[];
  loading?: boolean;
}

const getIconForNotification = (referenceType?: string) => {
  switch (referenceType) {
    case 'Task':
      return { icon: <Wrench size={13} />, bg: 'bg-[hsl(var(--primary-glow))]', text: 'text-[hsl(var(--primary))]' };
    case 'InventoryAdjustment':
    case 'Material':
      return { icon: <Package size={13} />, bg: 'bg-[hsl(38_92%_95%)]', text: 'text-[hsl(38_90%_40%)]' };
    case 'Incident':
      return { icon: <AlertTriangle size={13} />, bg: 'bg-[hsl(var(--danger-glow))]', text: 'text-[hsl(var(--danger))]' };
    default:
      return { icon: <Bell size={13} />, bg: 'bg-[hsl(var(--bg-main))]', text: 'text-[hsl(var(--text-secondary))]' };
  }
};

export const RecentActivities: React.FC<RecentActivitiesProps> = ({ activities, loading }) => {
  const navigate = useNavigate();

  return (
    <div className="card flex flex-col gap-5 h-full">
      <div className="flex justify-between items-center flex-wrap gap-3 shrink-0">
        <h3 className="text-[1.15rem] font-semibold">Hoạt động & Nhật ký mới nhận</h3>
        <Button 
          variant="secondary" 
          className="py-1.5 px-3 text-sm h-auto" 
          onClick={() => navigate('/notifications')}
        >
          Xem toàn bộ
        </Button>
      </div>
      
      <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-w-0 custom-scrollbar pr-2">
        {loading ? (
          <div className="text-center py-8 text-[hsl(var(--text-muted))] text-xs">Đang tải hoạt động...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--text-muted))] text-xs border border-dashed border-[hsl(var(--border))] rounded">
            Chưa có hoạt động nào được ghi nhận.
          </div>
        ) : (
          activities.map((act) => {
            const iconStyle = getIconForNotification(act.referenceType);
            return (
              <div 
                key={act.notificationId} 
                className={`p-3 border border-[hsl(var(--border))] rounded flex gap-3 transition-all duration-200 hover:border-[hsl(var(--primary)/0.3)] ${
                  act.isRead 
                    ? 'bg-[hsl(var(--bg-main)/0.1)] opacity-75' 
                    : 'bg-[hsl(var(--primary-glow)/0.2)] hover:bg-[hsl(var(--primary-glow)/0.4)]'
                }`}
              >
                <div className={`flex items-center justify-center rounded-full w-7 h-7 shrink-0 ${iconStyle.bg} ${iconStyle.text}`}>
                  {iconStyle.icon}
                </div>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <div className="flex justify-between gap-1 items-center">
                    <span className={`text-xs truncate text-[hsl(var(--text-primary))] ${!act.isRead ? 'font-bold' : 'font-semibold'}`}>
                      {act.title}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--text-muted))] flex items-center gap-1 shrink-0">
                      {formatRelativeTime(act.createdAt)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[hsl(var(--text-secondary))] leading-snug break-words">
                    {act.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

