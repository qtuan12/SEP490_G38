import React from 'react';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui';

interface Activity {
  id: number;
  user: string;
  role: string;
  action: string;
  time: string;
  detail: string;
}

interface RecentActivitiesProps {
  activities: Activity[];
}

export const RecentActivities: React.FC<RecentActivitiesProps> = ({ activities }) => {
  const navigate = useNavigate();

  return (
    <div className="card flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-[1.15rem] font-semibold">Hoạt động & Nhật ký mới nhận</h3>
        <Button 
          variant="secondary" 
          className="py-1.5 px-3 text-sm h-auto" 
          onClick={() => navigate('/projects')}
        >
          Xem toàn bộ
        </Button>
      </div>
      
      <div className="flex flex-col gap-4">
        {activities.map((act) => (
          <div key={act.id} className="p-4 border border-[hsl(var(--border))] rounded-sm bg-[hsl(var(--bg-main)/0.4)] flex gap-4 transition-all duration-200 hover:border-[hsl(var(--primary)/0.3)] hover:bg-[hsl(var(--primary-glow)/0.5)]">
            <div className="flex items-center justify-center bg-[hsl(var(--border))] rounded-full w-9 h-9 text-[hsl(var(--text-secondary))] shrink-0 text-sm font-semibold">
              {act.user.charAt(0)}
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <div className="flex justify-between flex-wrap gap-2 items-center">
                <span className="text-[0.9rem] font-semibold">
                  {act.user} <span className="text-xs font-medium text-[hsl(var(--text-muted))]">({act.role})</span>
                </span>
                <span className="text-xs text-[hsl(var(--text-muted))] flex items-center gap-1">
                  <Clock size={12} />
                  {act.time}
                </span>
              </div>
              <div className="text-[0.875rem] text-[hsl(var(--text-primary))] font-medium mt-0.5">
                {act.action}
              </div>
              <div className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed mt-0.5">
                {act.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
