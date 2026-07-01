import React, { useEffect, useState } from 'react';
import { Shield, Loader2, CheckCircle, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { reportService, type ExecutiveDashboardDto } from '../../../services/reportService';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  projectId: number | null;
}

export const ExecutiveDashboardReport: React.FC<Props> = ({ projectId }) => {
  const [execDashboard, setExecDashboard] = useState<ExecutiveDashboardDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      reportService.getExecutiveDashboard(projectId)
        .then(data => setExecDashboard(data))
        .catch(err => console.error('Error fetching exec dashboard', err))
        .finally(() => setLoading(false));
    } else {
      setExecDashboard(null);
    }
  }, [projectId]);

  if (!projectId) {
    return <div className="p-6 text-center text-[hsl(var(--text-muted))]">Vui lòng chọn một dự án để xem báo cáo.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải Báo cáo Tổng thể...</span>
      </div>
    );
  }

  if (!execDashboard) {
    return <div className="p-6 text-center text-[hsl(var(--text-muted))]">Không có dữ liệu báo cáo.</div>;
  }

  const pendingTasks = Math.max(0, execDashboard.totalTasks - execDashboard.completedTasks - execDashboard.delayedTasks - execDashboard.atRiskTasks);

  const taskStatusData = [
    { name: 'Hoàn thành', value: execDashboard.completedTasks, color: 'hsl(var(--success))' },
    { name: 'Đang làm / Chờ', value: pendingTasks, color: 'hsl(var(--primary))' },
    { name: 'Trễ hạn (Đỏ)', value: execDashboard.delayedTasks, color: 'hsl(var(--danger))' },
    { name: 'Nguy cơ (Vàng)', value: execDashboard.atRiskTasks, color: 'hsl(var(--warning))' },
  ].filter(d => d.value > 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="glass-panel p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6 border-b border-[hsl(var(--border))] pb-3">
          <h3 className="text-[1.2rem] font-bold flex items-center gap-2">
            <Shield className="text-[hsl(var(--primary))]" size={24} /> Tổng quan Chỉ số Dự án
          </h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-5 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(var(--primary))] shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase tracking-wider">Tiến độ Tasks</div>
              <CheckCircle size={20} className="text-[hsl(var(--primary))]" />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold">{execDashboard.completedTasks} <span className="text-lg text-[hsl(var(--text-muted))] font-normal">/ {execDashboard.totalTasks}</span></div>
              <div className="text-sm mt-1 font-medium text-[hsl(var(--success))]">
                {Math.round((execDashboard.completedTasks/Math.max(1, execDashboard.totalTasks))*100)}% Hoàn thành
              </div>
            </div>
          </div>

          <div className="card p-5 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(var(--danger))] shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase tracking-wider">Trễ hạn (Đỏ)</div>
              <AlertCircle size={20} className="text-[hsl(var(--danger))]" />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold text-[hsl(var(--danger))]">{execDashboard.delayedTasks}</div>
              <div className="text-sm mt-1 text-[hsl(var(--text-muted))]">Tasks cần xử lý gấp</div>
            </div>
          </div>

          <div className="card p-5 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(var(--warning))] shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase tracking-wider">Nguy cơ trễ (Vàng)</div>
              <Clock size={20} className="text-[hsl(var(--warning))]" />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold text-[hsl(var(--warning))]">{execDashboard.atRiskTasks}</div>
              <div className="text-sm mt-1 text-[hsl(var(--text-muted))]">Tasks chậm tiến độ</div>
            </div>
          </div>

          <div className="card p-5 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(346_84%_35%)] shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase tracking-wider">Vật tư vượt BOQ</div>
              <AlertTriangle size={20} className="text-[hsl(346_84%_35%)]" />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold text-[hsl(346_84%_35%)]">{execDashboard.materialsExceedingBOQ}</div>
              <div className="text-sm mt-1 text-[hsl(var(--text-muted))]">Yêu cầu vật tư (MRs)</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-5 border border-[hsl(var(--border))]">
            <h4 className="text-md font-semibold text-center mb-2 text-[hsl(var(--text-primary))]">Tỉ trọng Trạng thái Công việc (Tasks)</h4>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`${value} tasks`, 'Số lượng']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
             {/* Can add another chart or list here in the future, for now just a placeholder for visual balance */}
             <div className="card p-5 border border-[hsl(var(--border))] h-full flex flex-col justify-center items-center text-center bg-[hsl(var(--bg-main))]">
                <Shield size={48} className="text-[hsl(var(--border))] mb-4 opacity-50" />
                <h4 className="font-semibold text-[hsl(var(--text-secondary))] mb-2">Đánh giá Sức khỏe Dự án</h4>
                <p className="text-sm text-[hsl(var(--text-muted))] max-w-[300px]">
                  {execDashboard.delayedTasks > 0 
                    ? 'Dự án đang có rủi ro trễ hạn cao. Cần theo dõi sát sao các task màu đỏ.' 
                    : execDashboard.atRiskTasks > 0 
                      ? 'Dự án có một vài task chậm tiến độ. Cần đôn đốc nhân sự.'
                      : execDashboard.materialsExceedingBOQ > 0 
                        ? 'Tiến độ ổn định nhưng đang có rủi ro vượt chi phí vật tư.'
                        : 'Dự án đang diễn ra rất tốt. Các chỉ số đều nằm trong mức an toàn.'}
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
