import React, { useEffect, useState } from 'react';
import { Shield, Loader2, CheckCircle, Clock, AlertTriangle, AlertCircle, TrendingUp, ChevronRight } from 'lucide-react';
import { reportService, type ExecutiveDashboardDto } from '../../../services/reportService';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface Props {
  projectId: number | null;
}

export const ExecutiveDashboardReport: React.FC<Props> = ({ projectId }) => {
  const [execDashboard, setExecDashboard] = useState<ExecutiveDashboardDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterWarning, setFilterWarning] = useState<'All' | 'Red' | 'Yellow'>('All');
  const [filterPhase, setFilterPhase] = useState<string>('All');
  const navigate = useNavigate();

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
    { name: 'Đang làm', value: pendingTasks, color: 'hsl(var(--primary))' },
    { name: 'Trễ hạn (Đỏ)', value: execDashboard.delayedTasks, color: 'hsl(var(--danger))' },
    { name: 'Nguy cơ (Vàng)', value: execDashboard.atRiskTasks, color: 'hsl(var(--warning))' },
  ].filter(d => d.value > 0);

  const phaseChartData = (execDashboard.phaseBreakdown || []).map(p => ({
    name: p.phaseName.length > 14 ? p.phaseName.substring(0, 14) + '…' : p.phaseName,
    fullName: p.phaseName,
    progress: p.progressPercent,
    status: p.status
  }));

  const getPhaseColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'hsl(var(--success))';
      case 'InProgress': return 'hsl(var(--primary))';
      default: return 'hsl(var(--border))';
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const uniquePhases = Array.from(new Set((execDashboard.delayedTasksList || []).map(t => t.phaseName)));
  const filteredTasks = (execDashboard.delayedTasksList || []).filter(t => {
    if (filterWarning !== 'All' && t.warningType !== filterWarning) return false;
    if (filterPhase !== 'All' && t.phaseName !== filterPhase) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in p-1">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="card p-5 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(var(--primary))] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase tracking-wider">Tiến độ Tasks</div>
            <CheckCircle size={20} className="text-[hsl(var(--primary))]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black">{execDashboard.completedTasks} <span className="text-lg text-[hsl(var(--text-muted))] font-normal">/ {execDashboard.totalTasks}</span></div>
            <div className="text-sm mt-1 font-medium text-[hsl(var(--success))] flex items-center gap-1">
              <TrendingUp size={14} />
              {Math.round((execDashboard.completedTasks / Math.max(1, execDashboard.totalTasks)) * 100)}% Hoàn thành
            </div>
          </div>
        </div>

        <div className="card p-5 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(var(--danger))] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase tracking-wider">Trễ hạn (Đỏ)</div>
            <AlertCircle size={20} className="text-[hsl(var(--danger))]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-[hsl(var(--danger))]">{execDashboard.delayedTasks}</div>
            <div className="text-sm mt-1 text-[hsl(var(--text-muted))]">Tasks cần xử lý gấp</div>
          </div>
        </div>

        <div className="card p-5 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(var(--warning))] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase tracking-wider">Nguy cơ trễ (Vàng)</div>
            <Clock size={20} className="text-[hsl(var(--warning))]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-[hsl(var(--warning))]">{execDashboard.atRiskTasks}</div>
            <div className="text-sm mt-1 text-[hsl(var(--text-muted))]">Tasks chậm tiến độ</div>
          </div>
        </div>

        <div className="card p-5 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(346_84%_35%)] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase tracking-wider">Vật tư vượt BOQ</div>
            <AlertTriangle size={20} className="text-[hsl(346_84%_35%)]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-[hsl(346_84%_35%)]">{execDashboard.materialsExceedingBOQ}</div>
            <div className="text-sm mt-1 text-[hsl(var(--text-muted))]">Yêu cầu vượt định mức</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Task Status Pie */}
        <div className="card p-6 border border-[hsl(var(--border))]">
          <h4 className="text-md font-bold text-center mb-4 text-[hsl(var(--text-primary))]">Tỉ trọng Trạng thái Công việc</h4>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={taskStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {taskStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => [`${value} tasks`, 'Số lượng']} />
                <Legend verticalAlign="bottom" height={40} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Phase Breakdown Bar Chart */}
        {phaseChartData.length > 0 && (
          <div className="card p-6 border border-[hsl(var(--border))]">
            <h4 className="text-md font-bold mb-5 flex items-center gap-2 text-[hsl(var(--text-primary))]">
              <TrendingUp size={18} className="text-[hsl(var(--primary))]" />
              Tiến độ theo Phase
            </h4>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phaseChartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fontWeight: 500 }} />
                  <RechartsTooltip
                    formatter={(value) => [`${value}%`, 'Tiến độ']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                    cursor={{ fill: 'hsl(var(--bg-main))' }}
                  />
                  <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={22}>
                    {phaseChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getPhaseColor(entry.status)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Delayed & At-Risk Tasks List */}
      {(execDashboard.delayedTasksList || []).length > 0 && (
        <div className="card p-6 border border-[hsl(var(--border))]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h4 className="text-md font-bold flex items-center gap-2 text-[hsl(var(--text-primary))]">
              <AlertTriangle size={18} className="text-[hsl(var(--danger))]" />
              Danh sách Task cần chú ý ({filteredTasks.length})
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <select 
                className="px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--bg-main))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                value={filterWarning} 
                onChange={e => setFilterWarning(e.target.value as any)}
              >
                <option value="All">Tất cả mức độ</option>
                <option value="Red">🔴 Trễ hạn (Đỏ)</option>
                <option value="Yellow">🟡 Nguy cơ (Vàng)</option>
              </select>
              <select 
                className="px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--bg-main))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                value={filterPhase} 
                onChange={e => setFilterPhase(e.target.value)}
              >
                <option value="All">Tất cả Phase</option>
                {uniquePhases.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-[hsl(var(--text-muted))]">Không có công việc nào khớp với bộ lọc.</div>
          ) : (
            <div className="overflow-hidden border border-[hsl(var(--border))] rounded-lg">
              <div className="overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar">
                <table className="w-full text-sm text-left relative">
                  <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap border-b border-[hsl(var(--border))]">Trạng thái</th>
                      <th className="px-4 py-3 font-semibold border-b border-[hsl(var(--border))]">Tên Task</th>
                      <th className="px-4 py-3 font-semibold border-b border-[hsl(var(--border))]">Phase</th>
                      <th className="px-4 py-3 font-semibold text-right whitespace-nowrap border-b border-[hsl(var(--border))]">Tiến độ</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap border-b border-[hsl(var(--border))]">Deadline</th>
                      <th className="px-4 py-3 font-semibold border-b border-[hsl(var(--border))]">Người phụ trách</th>
                      <th className="px-4 py-3 font-semibold border-b border-[hsl(var(--border))]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--border))]">
                    {filteredTasks.map(task => (
                      <tr
                        key={task.taskId}
                        className={`hover:bg-[hsl(var(--bg-main))] transition-colors ${task.warningType === 'Red' ? 'bg-[hsl(var(--danger)/0.03)]' : 'bg-[hsl(var(--warning)/0.03)]'}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${task.warningType === 'Red'
                            ? 'bg-[hsl(var(--danger)/0.1)] text-[hsl(var(--danger))]'
                            : 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]'
                            }`}>
                            {task.warningType === 'Red' ? '🔴 TRỄ HẠN' : '🟡 NGUY CƠ'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[hsl(var(--text-primary))]">{task.taskName}</td>
                        <td className="px-4 py-3 text-[hsl(var(--text-secondary))]">{task.phaseName}</td>
                        <td className="px-4 py-3 text-right font-bold">{task.progressPercent}%</td>
                        <td className="px-4 py-3 text-[hsl(var(--danger))] font-medium whitespace-nowrap">{formatDate(task.endDate)}</td>
                        <td className="px-4 py-3 text-[hsl(var(--text-secondary))]">{task.assigneeName || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button
                            onClick={() => navigate(`/projects/${projectId}/tasks/${task.taskId}`)}
                            className="text-[hsl(var(--primary))] hover:underline flex items-center justify-end gap-1 text-xs font-semibold"
                          >
                            Chi tiết <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
