import React, { useEffect, useState } from 'react';
import { Loader2, HardHat, CheckCircle, Clock, AlertTriangle, Circle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { reportService, type ConstructionProgressReportDto } from '../../../services/reportService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  projectId: string | null;
}

export const ConstructionProgressReport: React.FC<Props> = ({ projectId }) => {
  const [data, setData] = useState<ConstructionProgressReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId || projectId === 'all') { setData(null); return; }
    setLoading(true);
    reportService.getConstructionProgress(Number(projectId))
      .then(setData)
      .catch(err => console.error('Error fetching construction progress', err))
      .finally(() => setLoading(false));
  }, [projectId]);

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

      {/* Phase Detail Accordion */}
      <div className="flex flex-col gap-3">
        <h4 className="text-md font-semibold text-[hsl(var(--text-primary))]">Chi tiết theo Phase</h4>
        {data.phases.map(phase => (
          <div key={phase.phaseId} className="card border border-[hsl(var(--border))] overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-[hsl(var(--bg-main))] transition-colors text-left"
              onClick={() => setExpandedPhase(expandedPhase === phase.phaseId ? null : phase.phaseId)}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(phase.status)}
                <div>
                  <span className="font-semibold">{phase.phaseName}</span>
                  <span className="ml-2 text-xs text-[hsl(var(--text-muted))]">{getStatusLabel(phase.status)}</span>
                  {phase.delayedTasks.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-[hsl(var(--danger)/0.15)] text-[hsl(var(--danger))] text-xs font-bold rounded">
                      {phase.delayedTasks.length} trễ
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-bold">{phase.completedTasks}/{phase.totalTasks} tasks</div>
                  <div className="text-xs text-[hsl(var(--text-muted))]">{phase.progressPercent}% hoàn thành</div>
                </div>
                <div className="w-20 h-2 bg-[hsl(var(--border))] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${phase.progressPercent}%`, backgroundColor: getPhaseBarColor(phase.status) }} />
                </div>
                {expandedPhase === phase.phaseId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {expandedPhase === phase.phaseId && phase.allTasks && phase.allTasks.length > 0 && (
              <div className="border-t border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-main))]">
                <div className="text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase mb-2">Danh sách công việc:</div>
                <div className="flex flex-col gap-2">
                  {phase.allTasks.map(task => (
                    <div key={task.taskId} className={`flex items-center justify-between p-2 bg-white rounded border ${task.isDelayed ? 'border-[hsl(var(--danger))]' : 'border-[hsl(var(--border))]'}`}>
                      <div className="flex items-center gap-2">
                        {task.isDelayed ? (
                           <XCircle size={14} className="text-[hsl(var(--danger))] shrink-0" />
                        ) : task.status === 'Approved' ? (
                           <CheckCircle size={14} className="text-[hsl(var(--success))] shrink-0" />
                        ) : (
                           <Circle size={14} className="text-[hsl(var(--text-muted))] shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${task.isDelayed ? 'text-[hsl(var(--danger))]' : ''}`}>{task.taskName}</span>
                      </div>
                      <div className={`flex items-center gap-3 text-xs ${task.isDelayed ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--text-muted))]'}`}>
                        <span>{task.progressPercent}%</span>
                        <span>DL: {formatDate(task.endDate)}</span>
                        <span>{task.assigneeName || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
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
