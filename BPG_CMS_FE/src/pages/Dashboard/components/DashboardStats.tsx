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
    <div className="grid grid-cols-[repeat(auto-fit,_minmax(240px,_1fr))] gap-6">
      {stats.map((stat, i) => (
        <div key={i} className="card flex justify-between items-start transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:border-[hsl(var(--primary)/0.5)] hover:shadow-md">
          <div>
            <span className="text-[0.85rem] text-[hsl(var(--text-secondary))] font-medium">
              {stat.title}
            </span>
            <h3 className="text-3xl font-bold my-2">
              {stat.value}
            </h3>
            <div className="flex items-center gap-1.5 text-xs">
              {stat.isPositive ? (
                <TrendingUp size={14} className="text-[hsl(var(--success))]" />
              ) : (
                <TrendingDown size={14} className="text-[hsl(var(--danger))]" />
              )}
              <span className={`font-semibold ${stat.isPositive ? 'text-[hsl(142_70%_60%)]' : 'text-[hsl(346_84%_65%)]'}`}>
                {stat.change}
              </span>
            </div>
          </div>
          <div 
            className="bg-[hsl(var(--bg-main))] p-3 rounded-sm border border-[hsl(var(--border))] flex items-center justify-center shrink-0"
            style={{ color: stat.color }}
          >
            {stat.icon}
          </div>
        </div>
      ))}
    </div>
  );
};
