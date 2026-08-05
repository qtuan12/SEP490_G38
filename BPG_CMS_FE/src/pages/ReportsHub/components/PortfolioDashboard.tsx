import React, { useEffect, useState } from 'react';
import { projectService } from '../../../services/projectService';
import type { DashboardMetricsDto, DashboardWarningDto } from '../../../types/common';
import { Loader2, AlertTriangle, Briefcase, TrendingUp } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { useNavigate } from 'react-router-dom';

export const PortfolioDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetricsDto | null>(null);
  const [warnings, setWarnings] = useState<DashboardWarningDto[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      projectService.getDashboardMetrics(),
      projectService.getDashboardWarnings()
    ])
      .then(([metricsData, warningsData]) => {
        setMetrics(metricsData);
        setWarnings(warningsData);
      })
      .catch(err => console.error('Error loading portfolio data:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải Dữ liệu Portfolio...</span>
      </div>
    );
  }

  if (!metrics) return null;

  // Data for Project Status Pie Chart
  const statusData = [
    { name: 'Đang chạy', value: metrics.activeProjects, color: 'hsl(var(--primary))' },
    { name: 'Tạm dừng', value: metrics.pausedProjects, color: 'hsl(var(--warning))' },
    { name: 'Hoàn thành', value: metrics.completedProjects, color: 'hsl(var(--success))' },
    { name: 'Đóng', value: metrics.closedProjects, color: 'hsl(var(--text-muted))' },
    { name: 'Bản nháp', value: metrics.draftProjects, color: 'hsl(var(--border))' },
  ].filter(d => d.value > 0);

  // Data for Active Projects Progress Bar Chart
  const progressData = [...(metrics.activeProjectsProgress || [])]
    .sort((a, b) => b.progress - a.progress)
    .map(p => ({
      name: p.projectName,
      progress: p.progress,
      projectId: p.projectId
    }));

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] pb-4">
        <Briefcase className="text-[hsl(var(--primary))]" size={28} />
        <div>
          <h2 className="text-xl font-bold">Tổng quan Toàn bộ Dự án </h2>
          <p className="text-sm text-[hsl(var(--text-secondary))]">Bức tranh toàn cảnh về sức khỏe của tất cả các dự án trong hệ thống.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Pie Chart */}
        <div className="card p-5 bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] shadow-sm">
          <h3 className="text-[1.05rem] font-semibold mb-4 text-[hsl(var(--text-primary))]">Tỉ trọng Trạng thái Dự án</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => [`${value} dự án`, 'Số lượng']} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2 text-sm text-[hsl(var(--text-muted))]">
            Tổng cộng: <strong>{metrics.totalProjects}</strong> dự án trên hệ thống
          </div>
        </div>

        {/* Active Projects Progress Bar Chart */}
        <div className="card p-5 bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] shadow-sm">
          <h3 className="text-[1.05rem] font-semibold mb-4 text-[hsl(var(--text-primary))] flex items-center gap-2">
            <TrendingUp size={18} className="text-[hsl(var(--success))]" /> Xếp hạng Tiến độ Dự án đang chạy
          </h3>
          {progressData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={progressData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                  <RechartsTooltip formatter={(value) => [`${value}%`, 'Tiến độ']} cursor={{ fill: 'hsl(var(--bg-main))' }} />
                  <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20}>
                    {progressData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.progress >= 80 ? 'hsl(var(--success))' : entry.progress >= 40 ? 'hsl(var(--primary))' : 'hsl(var(--warning))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-[hsl(var(--text-muted))]">
              Không có dự án nào đang chạy.
            </div>
          )}
        </div>
      </div>

      {/* Global Warnings */}
      <div className="card p-5 bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] shadow-sm mt-2">
        <h3 className="text-[1.05rem] font-semibold mb-4 text-[hsl(var(--text-primary))] flex items-center gap-2">
          <AlertTriangle size={18} className="text-[hsl(var(--danger))]" /> Cảnh báo rủi ro toàn hệ thống ({warnings.length})
        </h3>
        {warnings.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--success))] font-medium">
            Tuyệt vời! Không có cảnh báo đỏ hoặc vàng nào trên toàn bộ các dự án.
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {warnings.map((w, idx) => (
              <div
                key={idx}
                className={`flex items-start justify-between gap-3 p-4 border rounded-md cursor-pointer hover:shadow-md transition-shadow ${w.warningType === 'Critical' ? 'bg-[hsl(var(--danger)/0.1)] border-[hsl(var(--danger)/0.4)] text-[hsl(var(--danger))]' :
                  w.warningType === 'Red' ? 'bg-red-50 border-red-200 text-red-700' :
                    'bg-yellow-50 border-yellow-200 text-yellow-700'
                  }`}
                onClick={() => navigate(`/projects/${w.projectId}?tab=wbs${w.taskId ? `&taskId=${w.taskId}` : ''}`)}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[0.95rem] block mb-1">
                      {w.projectName}
                    </strong>
                    <div className="text-sm font-medium mb-1">Task: {w.taskName}</div>
                    <span className="text-[0.85rem] opacity-90">{w.message}</span>
                  </div>
                </div>
                <div className="text-xs font-bold px-2 py-1 bg-white/50 rounded border border-black/10">
                  {w.warningType === 'Critical' ? 'KHẨN CẤP' : w.warningType === 'Red' ? 'TRỄ HẠN' : 'NGUY CƠ'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
