import React, { useEffect, useState } from 'react';
import { HardHat, CheckCircle, Clock, AlertTriangle, Circle, XCircle, Search, X, TrendingUp } from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui';
import { reportService, type ConstructionProgressReportDto } from '../../../services/reportService';
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { formatDateOnly, formatPlainDate } from '../../../utils/dateHelpers';

interface Props {
  projectId: string | null;
  fromDate?: string;
  toDate?: string;
}

export const ConstructionProgressReport: React.FC<Props> = ({ projectId, fromDate, toDate }) => {
  const [data, setData] = useState<ConstructionProgressReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState<number | null>(null);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'delayed' | 'inprogress' | 'completed'>('all');
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  useEffect(() => {
    if (!projectId || projectId === 'all') {
      setData(null);
      setActivePhaseId(null);
      return;
    }
    setLoading(true);
    reportService.getConstructionProgress(Number(projectId), { fromDate, toDate })
      .then(res => {
        setData(res);
        if (res && res.phases && res.phases.length > 0) {
          const currentPhase = res.phases.find(p => p.status === 'InProgress') || res.phases[0];
          setActivePhaseId(currentPhase.phaseId);
        } else {
          setActivePhaseId(null);
        }
      })
      .catch(err => console.error('Error fetching construction progress', err))
      .finally(() => setLoading(false));
  }, [projectId, fromDate, toDate]);

  useEffect(() => {
    setTaskSearchQuery('');
    setTaskStatusFilter('all');
  }, [activePhaseId]);

  if (projectId === 'all') {
    return <div className="p-10 text-center text-[hsl(var(--text-muted))]">Báo cáo tiến độ thi công chỉ xem được theo từng dự án. Vui lòng chọn một dự án cụ thể.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <LoadingSpinner size="md" label="Đang tải Báo cáo Tiến độ Thi công..." />
      </div>
    );
  }

  if (!data) return null;

  const activePhase = data.phases.find(p => p.phaseId === activePhaseId) || data.phases[0];

  const filteredTasks = activePhase?.allTasks?.filter(task => {
    if (taskSearchQuery.trim() !== '') {
      const query = taskSearchQuery.toLowerCase();
      const matchName = task.taskName.toLowerCase().includes(query);
      const matchAssignee = task.assigneeName?.toLowerCase().includes(query);
      if (!matchName && !matchAssignee) return false;
    }
    if (taskStatusFilter === 'delayed') return task.isDelayed;
    if (taskStatusFilter === 'completed') return task.status === 'Approved' || task.status === 'Completed';
    if (taskStatusFilter === 'inprogress') return task.status !== 'Approved' && task.status !== 'Completed' && !task.isDelayed;
    return true;
  }) || [];



  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Approved': return 'Đã nghiệm thu';
      case 'Completed': return 'Hoàn thành (Chờ nghiệm thu)';
      case 'InProgress': return 'Đang thi công';
      case 'Draft': return 'Chưa bắt đầu';
      case 'Obsolete': return 'Đã hủy (Khóa)';
      default: return status;
    }
  };

  const getPhaseBarColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed': return '#10b981';
      case 'InProgress': return '#6366f1';
      default: return '#cbd5e1';
    }
  };

  /** Mốc thời gian UTC từ backend (ngày nghiệm thu). */
  const formatTimestamp = (d?: string) => (d ? formatDateOnly(d) : '—');
  /** Ngày thuần (hạn công việc) — không quy đổi múi giờ. */
  const formatTaskDate = (d?: string) => formatPlainDate(d) || '—';
  const phaseComparisonChartData = data.phases.map(p => ({
    name: p.phaseName.length > 14 ? p.phaseName.substring(0, 14) + '…' : p.phaseName,
    fullName: p.phaseName,
    actual: p.progressPercent,
    expected: p.expectedProgressPercent || 0,
    status: p.status
  }));

  const variancePercent = (data.overallProgressPercent || 0) - (data.expectedProgressPercent || 0);

  // Ngưỡng cảnh báo trễ tiến độ do quản trị viên cấu hình (ExpectedDelayPercent).
  // Đúng/vượt kế hoạch → xanh; chậm nhưng còn trong ngưỡng → vàng; chậm quá ngưỡng → đỏ.
  const delayThreshold = data.delayWarningThresholdPercent ?? 10;
  const varianceTone =
    variancePercent >= 0 ? 'ok'
      : Math.abs(variancePercent) <= delayThreshold ? 'warn'
        : 'bad';
  const varianceBadgeClass =
    varianceTone === 'ok' ? 'bg-emerald-100 text-emerald-700'
      : varianceTone === 'warn' ? 'bg-amber-100 text-amber-700'
        : 'bg-rose-100 text-rose-700';

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top Stat Analytics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Actual vs Expected Progress */}
        <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tiến độ Thực tế vs Kế hoạch</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
              <HardHat size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{data.overallProgressPercent}%</div>
            <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${varianceBadgeClass}`}>
              {variancePercent >= 0 ? `+${variancePercent.toFixed(1)}%` : `${variancePercent.toFixed(1)}%`} vs Baseline
            </span>
          </div>
          <div className="text-xs font-medium text-slate-500 mt-1">
            Kế hoạch kỳ vọng: <strong>{data.expectedProgressPercent || 0}%</strong>
            {varianceTone !== 'ok' && (
              <> · ngưỡng cảnh báo <strong>{delayThreshold}%</strong></>
            )}
          </div>
        </div>

        {/* Metric 2: Schedule Variance in Days */}
        <div className="bg-gradient-to-br from-red-50 to-white dark:from-slate-900 dark:to-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Độ lệch Tiến độ (Variance)</span>
            <div className="p-2 bg-red-500/10 text-red-600 rounded-xl">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className={`text-3xl font-black ${(data.scheduleVarianceDays || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {(data.scheduleVarianceDays || 0) > 0 ? `-${data.scheduleVarianceDays}` : '0'} <span className="text-sm font-semibold">ngày</span>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${(data.scheduleVarianceDays || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {(data.scheduleVarianceDays || 0) > 0 ? 'Trễ hạn' : 'Đúng tiến độ'}
            </span>
          </div>
          <div className="text-xs font-medium text-slate-500 mt-1">Tính theo thời gian Baseline Phase</div>
        </div>

        {/* Metric 3: Forecasted Completion Date */}
        <div className="bg-gradient-to-br from-purple-50 to-white dark:from-slate-900 dark:to-purple-950/30 border border-purple-200 dark:border-purple-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Dự báo Ngày Bàn giao</span>
            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-purple-700 dark:text-purple-300">
              {data.forecastedEndDate || 'Đang cập nhật'}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-2">Tính theo vận tốc thi công ròng</div>
          </div>
        </div>

        {/* Metric 4: Tasks Progress & Delayed Count */}
        <div className="bg-gradient-to-br from-amber-50 to-white dark:from-slate-900 dark:to-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Công việc Hoàn thành</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {data.doneTasks} <span className="text-sm text-slate-400 font-semibold">/ {data.totalTasks}</span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {data.phases.reduce((sum, p) => sum + p.delayedTasks.length, 0)} trễ
            </span>
          </div>
          <div className="text-xs font-medium text-slate-500 mt-1">Đã nghiệm thu / Đang thi công</div>
        </div>
      </div>



      {/* Grouped Bar Chart: Baseline Expected vs Actual Progress per Phase */}
      {phaseComparisonChartData.length > 0 && (
        <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 m-0">So sánh Tiến độ Kế hoạch Baseline vs Thực tế từng Phase (%)</h4>
              <p className="text-xs text-slate-500 m-0 mt-0.5">Đối chiếu giữa mục tiêu kế hoạch ban đầu và tỷ lệ hoàn thành thực tế.</p>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={phaseComparisonChartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <RechartsTooltip formatter={(value) => [`${value}%`, 'Tiến độ']} labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} />
                <Bar dataKey="expected" name="Kế hoạch Baseline (%)" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="actual" name="Thực tế Đạt được (%)" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {phaseComparisonChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.actual < entry.expected ? '#ef4444' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly Progress Trend & Comparison Analytics Chart */}
      {(data.monthlyTrends || []).length > 0 && (() => {
        const availableYears = Array.from(new Set((data.monthlyTrends || []).map(t => t.year))).sort((a, b) => b - a);
        const filteredTrends = (data.monthlyTrends || []).filter(t => t.year === selectedYear);

        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 m-0">
                  <TrendingUp size={16} className="text-indigo-500" /> Biểu đồ Tiến độ Thi công 12 Tháng Theo Năm
                </h4>
                <p className="text-xs text-slate-500 m-0 mt-0.5">So sánh tiến độ Kế hoạch vs Thực tế hàng tháng</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Year Selector Dropdown */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>Năm {y} {y === currentYear ? '' : ''}</option>
                  ))}
                </select>


              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredTrends} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fontWeight: 600 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(value: any, name: any) => [`${value}%`, String(name || '')]} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="plannedMonthlyVolume" name="SL Kế hoạch" fill="#f59e0b" maxBarSize={22} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actualMonthlyVolume" name="SL Thực tế" fill="#06b6d4" maxBarSize={22} radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="plannedProgressPercent" name="Kế hoạch lũy kế" stroke="#2563eb" strokeDasharray="5 5" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="actualProgressPercent" name="Thực tế lũy kế" stroke="#10b981" strokeWidth={3.5} dot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* Assignee / Subcontractor Performance Matrix */}
      {(data.assigneePerformance || []).length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 m-0">
              <CheckCircle size={16} className="text-indigo-500" /> Bảng Phân tích Hiệu suất Kỹ sư / Nhân sự Phụ trách Thi công
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Người Phụ trách</th>
                  <th className="px-4 py-3 text-center">Tổng Task</th>
                  <th className="px-4 py-3 text-center">Đã Hoàn thành</th>
                  <th className="px-4 py-3 text-center">Task Trễ</th>
                  <th className="px-4 py-3 text-right">Tỷ lệ Đúng hạn (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.assigneePerformance?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{item.assigneeName}</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{item.totalTasks}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-600">{item.completedTasks}</td>
                    <td className={`px-4 py-3 text-center font-bold ${item.delayedTasks > 0 ? 'text-red-600' : 'text-slate-400'}`}>{item.delayedTasks}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-extrabold ${item.onTimeRatePercent >= 80 ? 'text-emerald-600' : item.onTimeRatePercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {item.onTimeRatePercent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unified Compact Phase & Task Workspace Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider m-0 flex items-center gap-2">
            <HardHat size={16} className="text-indigo-500" /> Chi tiết Tiến độ Phase & Công việc Thi công
          </h4>
          <span className="text-[11px] font-semibold text-slate-500">
            {data.phases.length} Phase • {data.acceptances.length} Nghiệm thu
          </span>
        </div>

        {/* Split Grid Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Left Sidebar: Compact Phase List Selector & Acceptances Tab (4 cols) */}
          <div className="lg:col-span-4 p-3 bg-slate-50/30 dark:bg-slate-900/30 flex flex-col gap-1.5 max-h-[380px] overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">Chọn Phase xem chi tiết</div>
            {data.phases.map((phase) => {
              const isActive = activePhaseId === phase.phaseId;
              const hasDelay = phase.delayedTasks.length > 0;
              return (
                <button
                  key={phase.phaseId}
                  onClick={() => setActivePhaseId(phase.phaseId)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${isActive
                    ? 'border-indigo-500 bg-white dark:bg-slate-800 shadow-sm ring-1 ring-indigo-500/30'
                    : 'border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${phase.status === 'Approved' || phase.status === 'Completed'
                      ? 'bg-emerald-500'
                      : phase.status === 'InProgress'
                        ? 'bg-indigo-500'
                        : 'bg-slate-400'
                      }`} />
                    <div className="truncate">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{phase.phaseName}</div>
                      <div className="text-[10px] text-slate-500">{phase.completedTasks}/{phase.totalTasks} tasks</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasDelay && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px] font-bold rounded-md">
                        {phase.delayedTasks.length} trễ
                      </span>
                    )}
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{phase.progressPercent}%</span>
                  </div>
                </button>
              );
            })}

            {/* Special Tab: Phase Acceptance History */}
            {data.acceptances.length > 0 && (
              <button
                onClick={() => setActivePhaseId(-1)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer mt-2 ${activePhaseId === -1
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm ring-1 ring-emerald-500/30'
                  : 'border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span className="font-bold text-xs text-slate-900 dark:text-white">Lịch sử Nghiệm thu Phase</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-extrabold rounded-full">
                  {data.acceptances.length} biên bản
                </span>
              </button>
            )}
          </div>

          {/* Right Panel: Compact Tasks List or Acceptances Table (8 cols) */}
          <div className="lg:col-span-8 p-4 flex flex-col gap-3 min-h-[340px]">
            {activePhaseId === -1 ? (
              /* Acceptances History Mode */
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white m-0 flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-500" /> Lịch sử Nghiệm thu các Phase
                  </h5>
                  <span className="text-[10px] text-slate-500">Tổng cộng {data.acceptances.length} đợt nghiệm thu</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Phase</th>
                        <th className="px-3 py-2">Ngày nghiệm thu</th>
                        <th className="px-3 py-2">Người duyệt</th>
                        <th className="px-3 py-2 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.acceptances.map(acc => (
                        <tr key={acc.acceptanceId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{acc.phaseName}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{formatTimestamp(acc.acceptanceDate)}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{acc.acceptorName}</td>
                          <td className="px-3 py-2 text-center">
                            {acc.isCancelled ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                Đã hủy
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                Đã nghiệm thu
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activePhase ? (
              /* Phase Tasks Mode */
              <>
                {/* Active Phase Header Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white m-0">{activePhase.phaseName}</h5>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {getStatusLabel(activePhase.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {activePhase.completedTasks}/{activePhase.totalTasks} hoàn thành ({activePhase.progressPercent}%)
                    </span>
                    <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${activePhase.progressPercent}%`,
                          backgroundColor: getPhaseBarColor(activePhase.status)
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Task Filter Toolbar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex flex-wrap gap-1">
                    {(['all', 'inprogress', 'delayed', 'completed'] as const).map(filter => {
                      const label = filter === 'all' ? 'Tất cả' : filter === 'delayed' ? 'Trễ hạn' : filter === 'inprogress' ? 'Đang làm' : 'Hoàn thành';
                      const count = filter === 'all'
                        ? activePhase.allTasks?.length || 0
                        : filter === 'delayed'
                          ? activePhase.allTasks?.filter(t => t.isDelayed).length || 0
                          : filter === 'completed'
                            ? activePhase.allTasks?.filter(t => t.status === 'Approved' || t.status === 'Completed').length || 0
                            : activePhase.allTasks?.filter(t => t.status !== 'Approved' && t.status !== 'Completed' && !t.isDelayed).length || 0;

                      return (
                        <button
                          key={filter}
                          onClick={() => setTaskStatusFilter(filter)}
                          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${taskStatusFilter === filter
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                        >
                          {label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Box */}
                  <div className="relative w-full sm:w-52">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm công việc..."
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                    />
                    {taskSearchQuery && (
                      <button onClick={() => setTaskSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Compact Tasks List */}
                <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map(task => (
                      <div
                        key={task.taskId}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all gap-2 ${task.isDelayed
                          ? 'border-red-200 bg-red-50/20 dark:border-red-900/50 dark:bg-red-950/20'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="shrink-0">
                            {task.isDelayed ? (
                              <XCircle size={14} className="text-red-500" />
                            ) : task.status === 'Approved' || task.status === 'Completed' ? (
                              <CheckCircle size={14} className="text-emerald-500" />
                            ) : (
                              <Circle size={14} className="text-slate-400" />
                            )}
                          </div>
                          <div className="truncate">
                            <span className={`font-semibold ${task.isDelayed ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                              {task.taskName}
                            </span>
                            {task.assigneeName && (
                              <span className="text-[10px] text-slate-400 ml-2">
                                ({task.assigneeName})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 text-[11px]">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{task.progressPercent}%</span>
                          <span className={`font-medium ${task.isDelayed ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                            {formatTaskDate(task.endDate)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                      Không tìm thấy công việc phù hợp.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
