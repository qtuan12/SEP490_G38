import React, { useEffect, useState } from 'react';
import { Loader2, HardHat, CheckCircle, Clock, AlertTriangle, Circle, XCircle, Search, X } from 'lucide-react';
import { reportService, type ConstructionProgressReportDto } from '../../../services/reportService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

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
      <div className="flex items-center justify-center min-h-[40vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin text-[hsl(var(--primary))]" />
        <span>Đang tải Báo cáo Tiến độ Thi công...</span>
      </div>
    );
  }

  if (!data) return null;

  const phaseChartData = data.phases.map(p => ({
    name: p.phaseName.length > 16 ? p.phaseName.substring(0, 16) + '…' : p.phaseName,
    fullName: p.phaseName,
    progress: p.progressPercent,
    status: p.status
  }));

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed': return <CheckCircle size={14} className="text-emerald-500" />;
      case 'InProgress': return <Clock size={14} className="text-indigo-500" />;
      default: return <Circle size={14} className="text-slate-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed': return 'Đã nghiệm thu';
      case 'InProgress': return 'Đang thi công';
      case 'Draft': return 'Chưa bắt đầu';
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

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <HardHat size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng tiến độ</div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{data.overallProgressPercent}%</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Hoàn thành</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {data.doneTasks}<span className="text-xs font-semibold text-slate-400"> / {data.totalTasks}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Đang thi công</div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{data.inProgressTasks + data.assignedTasks}</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Task trễ hạn</div>
              <div className="text-2xl font-black text-red-600 dark:text-red-400">
                {data.phases.reduce((sum, p) => sum + p.delayedTasks.length, 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phase Progress Chart */}
      {phaseChartData.length > 0 && (
        <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">Tiến độ hoàn thành theo từng Phase (%)</h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={phaseChartData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fontWeight: 600 }} />
                <RechartsTooltip formatter={(value) => [`${value}%`, 'Tiến độ']} />
                <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={20}>
                  {phaseChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getPhaseBarColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Phase Detail Section */}
      <div className="flex flex-col gap-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider m-0">Chi tiết theo Phase</h4>

        {/* Phase Carousel / Stepper */}
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar">
          {data.phases.map((phase) => {
            const isActive = activePhaseId === phase.phaseId;
            const hasDelay = phase.delayedTasks.length > 0;
            return (
              <button
                key={phase.phaseId}
                onClick={() => setActivePhaseId(phase.phaseId)}
                className={`flex flex-col justify-between p-4 rounded-2xl border transition-all text-left min-w-[240px] shrink-0 cursor-pointer select-none
                  ${isActive
                    ? 'border-indigo-500 bg-white dark:bg-slate-900 shadow-md ring-2 ring-indigo-500/20 scale-[1.01]'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:bg-white'
                  }
                `}
              >
                <div className="flex items-center justify-between w-full mb-3 gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0
                    ${phase.status === 'Approved' || phase.status === 'Completed'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : phase.status === 'InProgress'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {getStatusLabel(phase.status)}
                  </span>
                  {hasDelay && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px] font-bold rounded-full">
                      {phase.delayedTasks.length} trễ
                    </span>
                  )}
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full mb-3" title={phase.phaseName}>
                  {phase.phaseName}
                </div>
                <div className="mt-auto w-full">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                    <span>{phase.completedTasks}/{phase.totalTasks} tasks</span>
                    <span>{phase.progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${phase.progressPercent}%`,
                        backgroundColor: getPhaseBarColor(phase.status)
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Phase Tasks Drawer Card */}
        {activePhase && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">{activePhase.phaseName}</h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {getStatusIcon(activePhase.status)}
                    {getStatusLabel(activePhase.status)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 m-0">Chi tiết công việc thuộc phase {activePhase.phaseName}</p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{activePhase.completedTasks}/{activePhase.totalTasks} hoàn thành</div>
                  <div className="text-[10px] text-slate-400">{activePhase.progressPercent}% tiến độ</div>
                </div>
                <div className="w-24 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
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
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${taskStatusFilter === filter
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
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm công việc hoặc người phụ trách..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                />
                {taskSearchQuery && (
                  <button onClick={() => setTaskSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Task Items List */}
            <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {filteredTasks.length > 0 ? (
                filteredTasks.map(task => (
                  <div
                    key={task.taskId}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all gap-2 ${task.isDelayed
                      ? 'border-red-200 bg-red-50/20 dark:border-red-900/50 dark:bg-red-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {task.isDelayed ? (
                          <XCircle size={16} className="text-red-500" />
                        ) : task.status === 'Approved' || task.status === 'Completed' ? (
                          <CheckCircle size={16} className="text-emerald-500" />
                        ) : (
                          <Circle size={16} className="text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${task.isDelayed ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                          {task.taskName}
                        </div>
                        {task.assigneeName && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Người phụ trách: <span className="font-semibold text-slate-700 dark:text-slate-300">{task.assigneeName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 text-xs shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Tiến độ</div>
                        <div className="font-extrabold text-slate-900 dark:text-white">{task.progressPercent}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Hạn chót</div>
                        <div className={`font-semibold ${task.isDelayed ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                          {formatDate(task.endDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  Không tìm thấy công việc nào phù hợp với bộ lọc.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Phase Acceptances Table */}
      {data.acceptances.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 font-bold text-xs text-slate-900 dark:text-white">
            Lịch sử Nghiệm thu Phase
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3">Phase</th>
                  <th className="px-4 py-3">Ngày nghiệm thu</th>
                  <th className="px-4 py-3">Người duyệt</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.acceptances.map(acc => (
                  <tr key={acc.acceptanceId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{acc.phaseName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(acc.acceptanceDate)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{acc.acceptorName}</td>
                    <td className="px-4 py-3 text-center">
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
      )}
    </div>
  );
};
