import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, CheckCircle, AlertTriangle, Wrench, Construction, Search, TrendingUp, ExternalLink, PieChart as PieChartIcon } from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui';
import { reportService, type IncidentReportDto } from '../../../services/reportService';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { parseDateSafe } from '../../../utils/dateHelpers';
import { getPreferredReportYear } from '../../../utils/reportYearHelpers';

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
  UnderResolution: 'Đang xử lý tổn thất',
  Approved: 'Đã phê duyệt',
  Resolved: 'Đã giải quyết',
  Closed: 'Đã đóng',
  Rejected: 'Bị từ chối',
};

const TYPE_LABELS: Record<string, string> = {
  Construction: 'Thi công',
  Material: 'Vật tư kho',
  Safety: 'An toàn',
  InventoryDamage: 'Hư hỏng vật tư',
  InventoryLoss: 'Thất thoát vật tư',
};

const getCleanDescription = (desc?: string): { title: string; subText?: string } => {
  if (!desc) return { title: '—' };
  const trimmed = desc.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const title = parsed.moTaChiTiet || parsed.moTa || parsed.tieuDe || parsed.soBienBan || desc;
      const subText = parsed.soBienBan ? `Biên bản: ${parsed.soBienBan}` : undefined;
      return { title, subText };
    } catch {
      // fallback
    }
  }
  const clean = desc.split(/\\n\*\*|\n\*\*|\*\*Ngày\/Giờ/)[0].trim();
  return { title: clean || desc };
};

export const IncidentReport: React.FC<Props> = ({ projectId, fromDate, toDate }) => {
  const requestIdentity = useMemo(
    () => ({ projectId, fromDate, toDate }),
    [projectId, fromDate, toDate],
  );
  const [loadState, setLoadState] = useState<{
    requestIdentity: object;
    data: IncidentReportDto | null;
    error: string | null;
  } | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [search, setSearch] = useState('');
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const requestIdRef = useRef(0);
  const isCurrentResult = loadState?.requestIdentity === requestIdentity;
  const data = isCurrentResult ? loadState.data : null;
  const error = isCurrentResult ? loadState.error : null;
  const loading = Boolean(projectId && projectId !== 'all' && !isCurrentResult);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const requestedProjectId = requestIdentity.projectId;

    if (!requestedProjectId || requestedProjectId === 'all') {
      return () => {
        if (requestIdRef.current === requestId) requestIdRef.current += 1;
      };
    }

    reportService.getIncidentReport(Number(requestedProjectId), {
      fromDate: requestIdentity.fromDate,
      toDate: requestIdentity.toDate,
    })
      .then(report => {
        if (requestId !== requestIdRef.current) return;
        setLoadState({ requestIdentity, data: report, error: null });
        setSelectedYear(getPreferredReportYear(
          report.monthlyTrends || [],
          trend => (trend.totalIncidentsCount || 0) > 0,
        ));
      })
      .catch(err => {
        if (requestId !== requestIdRef.current) return;
        console.error('Error fetching incident report', err);
        setLoadState({
          requestIdentity,
          data: null,
          error: err instanceof Error ? err.message : 'Không thể tải báo cáo sự cố.',
        });
      });

    return () => {
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
    };
  }, [requestIdentity]);

  if (projectId === 'all') {
    return <div className="p-10 text-center text-slate-400">Báo cáo sự cố chỉ xem được theo từng dự án cụ thể.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <LoadingSpinner size="md" label="Đang tải Báo cáo Sự cố & Rework..." />
      </div>
    );
  }

  if (error) {
    return <div className="p-10 text-center text-red-500 font-semibold">{error}</div>;
  }

  if (!data) return null;

  const resolvedStatuses = ['Approved', 'Resolved', 'Closed', 'Completed'];
  const terminalStatuses = [...resolvedStatuses, 'Rejected'];

  const filteredIncidents = (data?.incidents || []).filter(i => {
    const status = i?.status || '';
    const descInfo = getCleanDescription(i?.description);
    const reporterName = i?.reporterName || '';
    const isClosed = terminalStatuses.includes(status);
    const isOpen = !terminalStatuses.includes(status);
    if (filter === 'open' && !isOpen) return false;
    if (filter === 'resolved' && !isClosed) return false;
    if (search) {
      const s = search.toLowerCase();
      const matchDesc = descInfo.title.toLowerCase().includes(s) || (descInfo.subText && descInfo.subText.toLowerCase().includes(s));
      const matchReporter = reporterName.toLowerCase().includes(s);
      const matchId = String(i.incidentId).includes(s);
      if (!matchDesc && !matchReporter && !matchId) return false;
    }
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
    parseDateSafe(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const getStatusBadge = (status: string) => {
    const isResolved = resolvedStatuses.includes(status);
    const isRejected = status === 'Rejected';
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isRejected
        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        : isResolved
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
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Đã đóng / xử lý</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{Math.max(0, data.totalIncidents - data.openIncidents)}</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Wrench size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Có việc khắc phục</div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{data.incidentsWithRework}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {typeDist.length > 0 && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <PieChartIcon size={16} className="text-indigo-500" /> Phân loại Sự cố
            </h4>
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeDist} cx="50%" cy="50%" innerRadius={48} outerRadius={75} paddingAngle={4} dataKey="value">
                    {typeDist.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`${value} sự cố`, 'Số lượng']} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {(data.monthlyTrends || []).length > 0 && (() => {
          const hasAnyDataYear = (data.monthlyTrends || []).some(t => (t.totalIncidentsCount || 0) > 0);
          const availableYears = Array.from(new Set((data.monthlyTrends || []).map(t => t.year)))
            .filter(y => !hasAnyDataYear || (data.monthlyTrends || []).some(t => t.year === y && (t.totalIncidentsCount || 0) > 0))
            .sort((a, b) => b - a);
          const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] ?? selectedYear);
          const filteredTrends = (data.monthlyTrends || []).filter(t => t.year === activeYear);

          return (
            <div className={`${typeDist.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 m-0">
                    <TrendingUp size={16} className="text-indigo-500" /> Biểu đồ Xu hướng Sự cố 12 Tháng
                  </h4>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">Số lượng hồ sơ sự cố được lập theo từng tháng</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y}>Năm {y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip formatter={(value, name) => [`${value} sự cố`, String(name || '')]} />
                    <Bar dataKey="totalIncidentsCount" name="Sự cố phát sinh" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Incident Data Table with Integrated Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Integrated Filter Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white m-0">
              Bảng Danh sách Sự cố Thi công
            </h4>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-extrabold">
              {filteredIncidents.length} / {data.totalIncidents} sự cố
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Filter Buttons */}
            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl">
              {(['all', 'open', 'resolved'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${filter === f
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  {f === 'all' ? 'Tất cả' : f === 'open' ? 'Chưa xử lý' : 'Đã đóng / xử lý'}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm mô tả, người báo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="max-h-[440px] overflow-y-auto overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left relative">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-center w-12">STT</th>
                <th className="px-4 py-3 w-48">Sự cố & Ngày lập</th>
                <th className="px-4 py-3">Nội dung sự cố & Người báo cáo</th>
                <th className="px-4 py-3 w-56">Hạng mục / Công việc</th>
                <th className="px-4 py-3 text-center w-36">Trạng thái xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredIncidents.map((i, index) => {
                const descInfo = getCleanDescription(i.description);
                const targetProjectId = i.projectId || (projectId !== 'all' ? projectId : null);
                const incidentUrl = targetProjectId
                  ? `/projects/${targetProjectId}?tab=incidents&incidentId=${i.incidentId}`
                  : `/projects?incidentId=${i.incidentId}`;
                return (
                  <tr key={i.incidentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5 text-center font-medium text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={incidentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                          title="Chuyển đến chi tiết sự cố"
                        >
                          #{i.incidentId}
                          <ExternalLink size={11} className="opacity-70 hover:opacity-100" />
                        </Link>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          {TYPE_LABELS[i.incidentType] || i.incidentType}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {formatDate(i.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        to={incidentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline inline-flex items-center gap-1.5"
                        title="Xem chi tiết sự cố"
                      >
                        <span>{descInfo.title}</span>
                      </Link>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>Báo bởi: <strong>{i.reporterName}</strong></span>
                        {descInfo.subText && (
                          <span className="font-mono text-slate-400">({descInfo.subText})</span>
                        )}
                        {i.hasReworkTask && (
                          i.reworkTaskId ? (
                            <Link
                              to={`/tasks/${i.reworkTaskId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold text-[10px] hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                              title="Chuyển đến công việc sửa chữa (Rework Task)"
                            >
                              <Construction size={11} />
                              Khắc phục: {i.reworkTaskName || 'Xem nhiệm vụ sửa chữa'}
                              <ExternalLink size={10} />
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold text-[10px]">
                              <Construction size={11} />
                              Khắc phục: {i.reworkTaskName || 'Có việc cần khắc phục'}
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {i.phaseName ? (
                        <div className="font-bold text-slate-800 dark:text-slate-200">{i.phaseName}</div>
                      ) : (
                        <div className="text-slate-400">—</div>
                      )}
                      {i.taskName && (
                        i.taskId ? (
                          <Link
                            to={`/tasks/${i.taskId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 inline-flex items-center gap-1"
                            title="Chuyển đến công việc thi công"
                          >
                            <span>{i.taskName}</span>
                            <ExternalLink size={10} className="opacity-70" />
                          </Link>
                        ) : (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{i.taskName}</div>
                        )
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {getStatusBadge(i.status)}
                    </td>
                  </tr>
                );
              })}
              {filteredIncidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">Không có sự cố nào phù hợp với bộ lọc.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
