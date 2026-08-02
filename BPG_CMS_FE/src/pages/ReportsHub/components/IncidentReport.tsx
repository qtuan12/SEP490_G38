import React, { useEffect, useState } from 'react';
import { Loader2, AlertOctagon, CheckCircle, AlertTriangle, Wrench, Construction, Search } from 'lucide-react';
import { reportService, type IncidentReportDto } from '../../../services/reportService';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  projectId: string | null;
  fromDate?: string;
  toDate?: string;
}

const STATUS_LABELS: Record<string, string> = {
  Reported: 'Đã báo cáo',
  UnderReview: 'Đang xem xét',
  AssessmentCompleted: 'Đã đánh giá',
  WaitingReview: 'Chờ duyệt',
  WaitingStopApproval: 'Chờ duyệt dừng thi công',
  WaitingRecoveryPlan: 'Chờ lập kế hoạch',
  WaitingDirectorApproval: 'Chờ Giám đốc duyệt',
  WaitingAccountant: 'Chờ kế toán',
  Approved: 'Đã phê duyệt',
  Resolved: 'Đã giải quyết',
  Closed: 'Đã đóng',
};

const TYPE_LABELS: Record<string, string> = {
  Construction: 'Thi công',
  Material: 'Vật tư kho',
  Safety: 'An toàn',
  InventoryDamage: 'Hư hỏng vật tư',
};

const getCleanDescription = (desc?: string): string => {
  if (!desc) return '—';
  const clean = desc.split(/\\n\*\*|\n\*\*|\*\*Ngày\/Giờ/)[0].trim();
  return clean || desc;
};

export const IncidentReport: React.FC<Props> = ({ projectId, fromDate, toDate }) => {
  const [data, setData] = useState<IncidentReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!projectId || projectId === 'all') { setData(null); return; }
    setLoading(true);
    reportService.getIncidentReport(Number(projectId), { fromDate, toDate })
      .then(setData)
      .catch(err => console.error('Error fetching incident report', err))
      .finally(() => setLoading(false));
  }, [projectId, fromDate, toDate]);

  if (projectId === 'all') {
    return <div className="p-10 text-center text-slate-400">Báo cáo sự cố chỉ xem được theo từng dự án cụ thể.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-3 text-slate-500">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
        <span>Đang tải Báo cáo Sự cố & Rework...</span>
      </div>
    );
  }

  if (!data) return null;

  const resolvedStatuses = ['Approved', 'Resolved', 'Closed', 'Completed'];

  const filteredIncidents = (data?.incidents || []).filter(i => {
    const status = i?.status || '';
    const description = getCleanDescription(i?.description);
    const reporterName = i?.reporterName || '';
    const isOpen = !resolvedStatuses.includes(status);
    if (filter === 'open' && !isOpen) return false;
    if (filter === 'resolved' && isOpen) return false;
    if (search && !description.toLowerCase().includes(search.toLowerCase()) &&
      !reporterName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Type distribution
  const typeDist = Object.entries(
    data.incidents.reduce((acc, i) => {
      acc[i.incidentType] = (acc[i.incidentType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, count]) => ({
    name: TYPE_LABELS[type] || type,
    value: count,
  }));

  const PIE_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981'];

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const getStatusBadge = (status: string) => {
    const isResolved = resolvedStatuses.includes(status);
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isResolved
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
        {STATUS_LABELS[status] || status}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl">
              <AlertOctagon size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng sự cố</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{data.totalIncidents}</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Đang mở</div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{data.openIncidents}</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Đã giải quyết</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{data.resolvedIncidents}</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Wrench size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Có Rework Task</div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{data.incidentsWithRework}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart + Search Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {typeDist.length > 0 && (
          <div className="md:col-span-5 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Phân loại Sự cố</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {typeDist.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`${value} sự cố`, 'Số lượng']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={`${typeDist.length > 0 ? 'md:col-span-7' : 'md:col-span-12'} bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm`}>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Bộ lọc sự cố</h4>
            <div className="flex gap-2 flex-wrap mb-3">
              {(['all', 'open', 'resolved'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === f
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
                >
                  {f === 'all' ? 'Tất cả' : f === 'open' ? 'Đang mở' : 'Đã xử lý'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm mô tả sự cố, người báo cáo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="text-xs text-slate-500">
            Hiển thị <strong>{filteredIncidents.length}</strong> / {data.totalIncidents} sự cố
          </div>
        </div>
      </div>

      {/* Incident Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">Mã phiếu</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Mô tả & Người báo cáo</th>
                <th className="px-4 py-3">Phase / Task</th>
                <th className="px-4 py-3">Thiệt hại ước tính</th>
                <th className="px-4 py-3">Rework Task</th>
                <th className="px-4 py-3">Ngày báo cáo</th>
                <th className="px-4 py-3 text-center">Trạng thái Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredIncidents.map(i => (
                <tr key={i.incidentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-500">#{i.incidentId}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      {TYPE_LABELS[i.incidentType] || i.incidentType}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="font-bold text-slate-900 dark:text-white truncate" title={getCleanDescription(i.description)}>{getCleanDescription(i.description)}</div>
                    <div className="text-[10px] text-slate-400">Báo bởi: {i.reporterName}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {i.phaseName && <div className="font-bold text-slate-800 dark:text-slate-200">{i.phaseName}</div>}
                    {i.taskName && <div className="text-[10px] text-slate-400">{i.taskName}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {i.estimatedMaterialLoss != null && (
                      <div className="font-bold text-slate-900 dark:text-white">{i.estimatedMaterialLoss.toLocaleString('vi-VN')} VNĐ</div>
                    )}
                    {i.estimatedDelayDays != null && (
                      <div className="text-amber-600 font-semibold">{i.estimatedDelayDays} ngày trễ</div>
                    )}
                    {i.estimatedMaterialLoss == null && i.estimatedDelayDays == null && '—'}
                  </td>
                  <td className="px-4 py-3">
                    {i.hasReworkTask ? (
                      <span className="text-indigo-600 font-bold text-xs flex items-center gap-1">
                        <Construction size={13} />
                        {i.reworkTaskName || 'Có rework task'}
                      </span>
                    ) : (
                      <span className="text-slate-400">Không</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(i.createdAt)}</td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(i.status)}</td>
                </tr>
              ))}
              {filteredIncidents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">Không có sự cố nào phù hợp với bộ lọc.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
