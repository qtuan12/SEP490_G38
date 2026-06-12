import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Stat {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ReactNode;
  color: string;
}

interface DashboardStatsProps {
  stats: Stat[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '24px'
    }}>
      {stats.map((stat, i) => (
        <div key={i} className="card" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'hsl(var(--border))';
        }}
        >
          <div>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
              {stat.title}
            </span>
            <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>
              {stat.value}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
              {stat.isPositive ? (
                <TrendingUp size={14} style={{ color: 'hsl(var(--success))' }} />
              ) : (
                <TrendingDown size={14} style={{ color: 'hsl(var(--danger))' }} />
              )}
              <span style={{ color: stat.isPositive ? 'hsl(142 70% 60%)' : 'hsl(346 84% 65%)', fontWeight: 600 }}>
                {stat.change}
              </span>
            </div>
          </div>
          <div style={{
            backgroundColor: 'hsl(var(--bg-main))',
            color: stat.color,
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {stat.icon}
          </div>
        </div>
      ))}
    </div>
  );
};
