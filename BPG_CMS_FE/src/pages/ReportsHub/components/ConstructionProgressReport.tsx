import React, { useEffect, useState } from 'react';
import { Loader2, HardHat, CheckCircle, Clock, AlertTriangle, Circle, XCircle, Search, X } from 'lucide-react';
import { reportService, type ConstructionProgressReportDto } from '../../../services/reportService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  projectId: string | null;
}

export const ConstructionProgressReport: React.FC<Props> = ({ projectId }) => {
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
    reportService.getConstructionProgress(Number(projectId))
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
  }, [projectId]);

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
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải Báo cáo Tiến độ...</span>
      </div>
    );
  }

  if (!data) return null;

  const phaseChartData = data.phases.map(p => ({
    name: p.phaseName.length > 14 ? p.phaseName.substring(0, 14) + '…' : p.phaseName,
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
    if (taskStatusFilter === 'completed') return task.status === 'Approved';
    if (taskStatusFilter === 'inprogress') return task.status !== 'Approved' && !task.isDelayed;
    return true;
  }) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved': return <CheckCircle size={14} className="text-[hsl(var(--success))]" />;
      case 'InProgress': return <Clock size={14} className="text-[hsl(var(--primary))]" />;
      default: return <Circle size={14} className="text-[hsl(var(--text-muted))]" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Approved': return 'Đã nghiệm thu';
      case 'InProgress': return 'Đang thi công';
      case 'Draft': return 'Chưa bắt đầu';
      default: return status;
    }
  };

  const getPhaseBarColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'hsl(var(--success))';
      case 'InProgress': return 'hsl(var(--primary))';
      default: return 'hsl(var(--border))';
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(var(--primary))]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[hsl(var(--primary-glow))] rounded-full text-[hsl(var(--primary))]">
              <HardHat size={18} />
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Tổng tiến độ</div>
              <div className="text-2xl font-black text-[hsl(var(--primary))]">{data.overallProgressPercent}%</div>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(var(--success))]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[hsl(var(--success-glow))] rounded-full text-[hsl(var(--success))]">
              <CheckCircle size={18} />
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Hoàn thành</div>
              <div className="text-2xl font-black text-[hsl(var(--success))]">{data.doneTasks}<span className="text-sm font-normal text-[hsl(var(--text-muted))]"> / {data.totalTasks}</span></div>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(var(--warning))]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[hsl(var(--warning-glow))] rounded-full text-[hsl(var(--warning))]">
              <Clock size={18} />
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Đang thi công</div>
              <div className="text-2xl font-black text-[hsl(var(--warning))]">{data.inProgressTasks + data.assignedTasks}</div>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-[hsl(var(--bg-main))] border-l-4 border-l-[hsl(var(--danger))]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[hsl(var(--danger-glow))] rounded-full text-[hsl(var(--danger))]">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Task trễ</div>
              <div className="text-2xl font-black text-[hsl(var(--danger))]">
                {data.phases.reduce((sum, p) => sum + p.delayedTasks.length, 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phase Progress Chart */}
      {phaseChartData.length > 0 && (
        <div className="card p-5 border border-[hsl(var(--border))]">
          <h4 className="text-md font-semibold mb-4 text-[hsl(var(--text-primary))]">Tiến độ hoàn thành theo Phase</h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={phaseChartData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  formatter={(value) => [`${value}%`, 'Tiến độ']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  cursor={{ fill: 'hsl(var(--bg-main))' }}
                />
                <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', formatter: (v: any) => `${v}%`, fontSize: 11 }}>
                  {phaseChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getPhaseBarColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Phase Detail Accordion - Redesigned as Horizontal Timeline + Detail Card */}
      <div className="flex flex-col gap-4">
        <h4 className="text-md font-semibold text-[hsl(var(--text-primary))]">Chi tiết theo Phase</h4>
        
        {/* Horizontal Timeline */}
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 snap-x scroll-smooth custom-scrollbar">
          {data.phases.map((phase) => {
            const isActive = activePhaseId === phase.phaseId;
            const hasDelay = phase.delayedTasks.length > 0;
            return (
              <button
                key={phase.phaseId}
                onClick={() => setActivePhaseId(phase.phaseId)}
                className={`flex flex-col justify-between p-4 rounded-xl border transition-all text-left min-w-[220px] md:min-w-[240px] shrink-0 cursor-pointer snap-start select-none
                  ${isActive 
                    ? 'border-[hsl(var(--primary))] bg-white shadow-md ring-2 ring-[hsl(var(--primary)/0.15)] scale-[1.01]' 
                    : 'border-[hsl(var(--border))] bg-white hover:border-[hsl(var(--border-light))] hover:shadow-sm'
                  }
                `}
              >
                <div className="flex items-center justify-between w-full mb-3 gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0
                    ${phase.status === 'Approved' 
                      ? 'bg-[hsl(var(--success-glow))] text-[hsl(var(--success))]' 
                      : phase.status === 'InProgress'
                        ? 'bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))]'
                        : 'bg-[hsl(var(--bg-main))] text-[hsl(var(--text-muted))]'
                    }`}
                  >
                    {getStatusLabel(phase.status)}
                  </span>
                  {hasDelay && (
                    <span className="px-1.5 py-0.5 bg-[hsl(var(--danger)/0.15)] text-[hsl(var(--danger))] text-[10px] font-bold rounded animate-pulse">
                      {phase.delayedTasks.length} trễ
                    </span>
                  )}
                </div>
                <div className="font-semibold text-sm mb-2 text-[hsl(var(--text-primary))] truncate w-full" title={phase.phaseName}>
                  {phase.phaseName}
                </div>
                <div className="mt-auto w-full">
                  <div className="flex justify-between items-center text-xs mb-1 text-[hsl(var(--text-secondary))]">
                    <span>{phase.completedTasks}/{phase.totalTasks} tasks</span>
                    <span>{phase.progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[hsl(var(--border))] rounded-full overflow-hidden">
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

        {/* Active Phase Details Card */}
        {activePhase && (
          <div className="card p-5 border border-[hsl(var(--border))] flex flex-col gap-5 bg-white">
            {/* Active Phase Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[hsl(var(--border))]">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">{activePhase.phaseName}</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold
                    ${activePhase.status === 'Approved' 
                      ? 'bg-[hsl(var(--success-glow))] text-[hsl(var(--success))]' 
                      : activePhase.status === 'InProgress'
                        ? 'bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))]'
                        : 'bg-[hsl(var(--bg-main))] text-[hsl(var(--text-muted))]'
                    }`}
                  >
                    {getStatusIcon(activePhase.status)}
                    {getStatusLabel(activePhase.status)}
                  </span>
                  {activePhase.delayedTasks.length > 0 && (
                    <span className="px-2 py-0.5 bg-[hsl(var(--danger)/0.15)] text-[hsl(var(--danger))] text-xs font-bold rounded">
                      Có {activePhase.delayedTasks.length} công việc trễ
                    </span>
                  )}
                </div>
                <p className="text-xs text-[hsl(var(--text-muted))]">Xem thông tin chi tiết và danh sách công việc của giai đoạn này.</p>
              </div>
              
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-left md:text-right">
                  <div className="text-sm font-bold text-[hsl(var(--text-primary))]">{activePhase.completedTasks}/{activePhase.totalTasks} công việc hoàn thành</div>
                  <div className="text-xs text-[hsl(var(--text-muted))]">{activePhase.progressPercent}% tổng tiến độ Phase</div>
                </div>
                <div className="w-24 h-2.5 bg-[hsl(var(--border))] rounded-full overflow-hidden">
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

            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'inprogress', 'delayed', 'completed'] as const).map(filter => {
                  const label = filter === 'all' ? 'Tất cả' : filter === 'delayed' ? 'Trễ hạn' : filter === 'inprogress' ? 'Đang làm' : 'Hoàn thành';
                  const count = filter === 'all' 
                    ? activePhase.allTasks?.length || 0 
                    : filter === 'delayed'
                      ? activePhase.allTasks?.filter(t => t.isDelayed).length || 0
                      : filter === 'completed'
                        ? activePhase.allTasks?.filter(t => t.status === 'Approved').length || 0
                        : activePhase.allTasks?.filter(t => t.status !== 'Approved' && !t.isDelayed).length || 0;
                  
                  return (
                    <button
                      key={filter}
                      onClick={() => setTaskStatusFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
                        ${taskStatusFilter === filter 
                          ? 'bg-[hsl(var(--text-primary))] text-white' 
                          : 'bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--border))]'
                        }
                      `}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-60">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Tìm kiếm công việc..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))] rounded-lg text-xs focus:outline-none focus:border-[hsl(var(--border-light))] text-[hsl(var(--text-primary))]"
                />
                {taskSearchQuery && (
                  <button 
                    onClick={() => setTaskSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] p-0.5 rounded-full hover:bg-[hsl(var(--border))]"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Tasks List */}
            <div>
              {filteredTasks.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredTasks.map(task => (
                    <div 
                      key={task.taskId} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-lg border transition-all gap-2
                        ${task.isDelayed 
                          ? 'border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.01)] hover:bg-[hsl(var(--danger)/0.03)]' 
                          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--border-light))] hover:shadow-sm'
                        }
                      `}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">
                          {task.isDelayed ? (
                            <XCircle size={16} className="text-[hsl(var(--danger))]" />
                          ) : task.status === 'Approved' ? (
                            <CheckCircle size={16} className="text-[hsl(var(--success))]" />
                          ) : (
                            <Circle size={16} className="text-[hsl(var(--text-muted))]" />
                          )}
                        </div>
                        <div>
                          <div className={`text-sm font-semibold ${task.isDelayed ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--text-primary))]'}`}>
                            {task.taskName}
                          </div>
                          {task.assigneeName && (
                            <div className="text-[11px] text-[hsl(var(--text-muted))] mt-0.5">
                              Phụ trách: <span className="font-medium text-[hsl(var(--text-secondary))]">{task.assigneeName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-4 text-xs mt-1 sm:mt-0 pt-2 sm:pt-0 border-t border-[hsl(var(--border))] sm:border-t-0 shrink-0">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="text-[11px] text-[hsl(var(--text-muted))]">Tiến độ</div>
                          <div className="font-bold text-[hsl(var(--text-primary))]">{task.progressPercent}%</div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="text-[11px] text-[hsl(var(--text-muted))]">Hạn hoàn thành</div>
                          <div className={`font-semibold ${task.isDelayed ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--text-secondary))]'}`}>
                            {formatDate(task.endDate)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[hsl(var(--text-muted))] border border-dashed border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--bg-main))]">
                  Không tìm thấy công việc nào phù hợp với bộ lọc hiện tại.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Phase Acceptances */}
      {data.acceptances.length > 0 && (
        <div className="card p-0 overflow-hidden border border-[hsl(var(--border))]">
          <div className="p-5 border-b border-[hsl(var(--border))]">
            <h4 className="text-md font-semibold text-[hsl(var(--text-primary))]">Lịch sử Nghiệm thu Phase</h4>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar">
            <table className="w-full text-sm text-left relative">
              <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] sticky top-0 z-10 border-b border-[hsl(var(--border))] shadow-sm">
                <tr>
                  <th className="px-3 py-2 font-semibold">Phase</th>
                  <th className="px-3 py-2 font-semibold">Ngày nghiệm thu</th>
                  <th className="px-3 py-2 font-semibold">Người duyệt</th>
                  <th className="px-3 py-2 font-semibold text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {data.acceptances.map(acc => (
                  <tr key={acc.acceptanceId} className="hover:bg-[hsl(var(--bg-main))]">
                    <td className="px-3 py-2 font-medium">{acc.phaseName}</td>
                    <td className="px-3 py-2">{formatDate(acc.acceptanceDate)}</td>
                    <td className="px-3 py-2">{acc.acceptorName}</td>
                    <td className="px-3 py-2 text-center">
                      {acc.isCancelled ? (
                        <span className="text-[hsl(var(--danger))] text-xs font-bold">Đã hủy</span>
                      ) : (
                        <span className="text-[hsl(var(--success))] text-xs font-bold">Đã nghiệm thu</span>
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
