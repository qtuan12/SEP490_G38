import React from 'react';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Hoạt động & Nhật ký mới nhận</h3>
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => navigate('/projects')}>
          Xem toàn bộ
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activities.map((act) => (
          <div key={act.id} style={{
            padding: '16px',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'hsl(var(--bg-main) / 0.4)',
            display: 'flex',
            gap: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'hsl(var(--border))',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: 'hsl(var(--text-secondary))',
              flexShrink: 0,
              fontSize: '0.8rem',
              fontWeight: 600
            }}>
              {act.user.charAt(0)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  {act.user} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'hsl(var(--text-muted))' }}>({act.role})</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} />
                  {act.time}
                </span>
              </div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--text-primary))', fontWeight: 500 }}>
                {act.action}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.4 }}>
                {act.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
