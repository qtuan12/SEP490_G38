import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, Clock, AlertTriangle, AlertCircle, TrendingUp, ChevronRight, ShieldAlert, Layers } from 'lucide-react';
import { reportService, type ExecutiveDashboardDto } from '../../../services/reportService';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface Props {
  projectId: number | null;
  fromDate?: string;
  toDate?: string;
}

export const ExecutiveDashboardReport: React.FC<Props> = ({ projectId, fromDate, toDate }) => {
  const [execDashboard, setExecDashboard] = useState<ExecutiveDashboardDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterWarning, setFilterWarning] = useState<'All' | 'Red' | 'Yellow'>('All');
  const [filterPhase, setFilterPhase] = useState<string>('All');
  const navigate = useNavigate();

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      reportService.getExecutiveDashboard(projectId, { fromDate, toDate })
        .then(data => setExecDashboard(data))
        .catch(err => console.error('Error fetching exec dashboard', err))
        .finally(() => setLoading(false));
    } else {
      setExecDashboard(null);
    }
  }, [projectId, fromDate, toDate]);

  if (!projectId) {
    return <div className="p-10 text-center text-[hsl(var(--text-muted))]">Vui lòng chọn một dự án để xem báo cáo.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin text-[hsl(var(--primary))]" />
        <span>Đang tải Báo cáo Tổng thể Executive...</span>
      </div>
    );
  }

  if (!execDashboard) {
    return <div className="p-10 text-center text-[hsl(var(--text-muted))]">Không có dữ liệu báo cáo.</div>;
  }

  const pendingTasks = Math.max(0, execDashboard.totalTasks - execDashboard.completedTasks - execDashboard.delayedTasks - execDashboard.atRiskTasks);

  const taskStatusData = [
    { name: 'Hoàn thành', value: execDashboard.completedTasks, color: '#10b981' },
    { name: 'Đang triển khai', value: pendingTasks, color: '#6366f1' },
    { name: 'Trễ hạn (Đỏ)', value: execDashboard.delayedTasks, color: '#ef4444' },
    { name: 'Nguy cơ (Vàng)', value: execDashboard.atRiskTasks, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const phaseChartData = (execDashboard.phaseBreakdown || []).map(p => ({
    name: p.phaseName.length > 16 ? p.phaseName.substring(0, 16) + '…' : p.phaseName,
    fullName: p.phaseName,
    progress: p.progressPercent,
    status: p.status
  }));

  const getPhaseColor = (status: string) => {
    switch (status) {
      case 'Approved': return '#10b981';
      case 'InProgress': return '#6366f1';
      default: return '#94a3b8';
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

  const completionRate = Math.round((execDashboard.completedTasks / Math.max(1, execDashboard.totalTasks)) * 100);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-indigo-50/50 dark:from-slate-900 dark:to-indigo-950/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-emerald-500" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tiến độ Tasks</span>
            <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {execDashboard.completedTasks} <span className="text-sm text-slate-400 font-semibold">/ {execDashboard.totalTasks}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <TrendingUp size={14} /> {completionRate}% Hoàn thành
              </span>
              <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-red-50/50 dark:from-slate-900 dark:to-red-950/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Trễ hạn (Đỏ)</span>
            <div className="p-2.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl">
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-red-600 dark:text-red-400">{execDashboard.delayedTasks}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">Cần xử lý & đẩy tiến độ ngay</div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-amber-50/50 dark:from-slate-900 dark:to-amber-950/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nguy cơ trễ (Vàng)</span>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400">{execDashboard.atRiskTasks}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">Chậm tiến độ so với kế hoạch</div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-rose-50/50 dark:from-slate-900 dark:to-rose-950/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-600" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Vật tư vượt BOQ</span>
            <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400">{execDashboard.materialsExceedingBOQ}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">Yêu cầu vật tư vượt định mức</div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Status Pie Chart */}
        <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 m-0">
              <Layers size={18} className="text-indigo-500" /> Tỉ trọng Trạng thái Công việc
            </h4>
          </div>
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
                <RechartsTooltip formatter={(value) => [`${value} công việc`, 'Số lượng']} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Phase Progress Bar Chart */}
        {phaseChartData.length > 0 && (
          <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 m-0">
                <TrendingUp size={18} className="text-indigo-500" /> Tiến độ Trọng số theo Phase (%)
              </h4>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phaseChartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fontWeight: 600 }} />
                  <RechartsTooltip
                    formatter={(value) => [`${value}%`, 'Tiến độ']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Bar dataKey="progress" radius={[0, 6, 6, 0]} barSize={22}>
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

      {/* Actionable Warning Tasks Table */}
      {(execDashboard.delayedTasksList || []).length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 m-0">
              <ShieldAlert size={18} className="text-red-500" /> Danh sách Task cần chú ý ({filteredTasks.length})
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={filterWarning}
                onChange={e => setFilterWarning(e.target.value as any)}
              >
                <option value="All">Tất cả mức độ</option>
                <option value="Red">🔴 Trễ hạn (Đỏ)</option>
                <option value="Yellow">🟡 Nguy cơ (Vàng)</option>
              </select>
              <select
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={filterPhase}
                onChange={e => setFilterPhase(e.target.value)}
              >
                <option value="All">Tất cả Phase</option>
                {uniquePhases.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="text-center py-10 text-slate-400">Không có công việc nào khớp với bộ lọc.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3">Mức độ</th>
                    <th className="px-4 py-3">Tên Task</th>
                    <th className="px-4 py-3">Phase</th>
                    <th className="px-4 py-3 text-right">Tiến độ</th>
                    <th className="px-4 py-3">Hạn chót</th>
                    <th className="px-4 py-3">Người phụ trách</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTasks.map(task => (
                    <tr
                      key={task.taskId}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${task.warningType === 'Red' ? 'bg-red-50/30 dark:bg-red-950/10' : 'bg-amber-50/30 dark:bg-amber-950/10'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${task.warningType === 'Red'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}>
                          {task.warningType === 'Red' ? '🔴 TRỄ HẠN' : '🟡 NGUY CƠ'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{task.taskName}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">{task.phaseName}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900 dark:text-white">{task.progressPercent}%</td>
                      <td className="px-4 py-3 text-red-600 font-semibold whitespace-nowrap">{formatDate(task.endDate)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{task.assigneeName || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => navigate(`/projects/${projectId}/tasks/${task.taskId}`)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:underline"
                        >
                          Chi tiết <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
