import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportService, type BoqVsActualItemDto, type MonthlyBoqConsumptionTrendDto } from '../../services/reportService';
import { projectService } from '../../services/projectService';
import type { Project } from '../../types/common';
import { ArrowLeft, AlertTriangle, PackageCheck, TrendingUp, Search, X } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { getPreferredReportYear } from '../../utils/reportYearHelpers';
import { formatNumber } from '../../utils/formatNumber';

interface Props {
  embeddedProjectId?: string;
  fromDate?: string;
  toDate?: string;
}

export const BoqVsActualReport: React.FC<Props> = ({ embeddedProjectId, fromDate, toDate }) => {
  const params = useParams<{ projectId: string }>();
  const projectId = embeddedProjectId || params.projectId;
  const navigate = useNavigate();

  const [items, setItems] = useState<BoqVsActualItemDto[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyBoqConsumptionTrendDto[]>([]);
  const [allProjectsData, setAllProjectsData] = useState<{ name: string; exceedCount: number }[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'safe' | 'earnedExceeding' | 'exceeding'>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'consumed' | 'inStock' | 'hasReturned'>('all');

  useEffect(() => {
    if (!projectId) return;

    (async () => {
      try {
        setLoading(true);
        if (projectId === 'all') {
          const projs = await projectService.getProjects();
          const activeProjs = projs.filter(p => p.status !== 'draft');
          const reports = await Promise.all(activeProjs.map(p => reportService.getBoqVsActual(Number(p.id), { fromDate, toDate }).catch(() => null)));

          const aggregated = activeProjs.map((p, idx) => {
            const r = reports[idx];
            return {
              name: p.name,
              exceedCount: r ? r.items.filter(i => i.isExceeding).length : 0
            };
          }).filter(x => x.exceedCount > 0);

          setAllProjectsData(aggregated.sort((a, b) => b.exceedCount - a.exceedCount));
          setProject(null);
        } else {
          const [projs, report] = await Promise.all([
            projectService.getProjects(),
            reportService.getBoqVsActual(Number(projectId), { fromDate, toDate })
          ]);
          const trends = report.monthlyTrends || [];
          setProject(projs.find(p => p.id === projectId) || null);
          setItems(report.items || []);
          setMonthlyTrends(trends);
          setSelectedYear(getPreferredReportYear(trends, (t: MonthlyBoqConsumptionTrendDto) => (t.consumedValueVnd || 0) > 0 || (t.materialRequestCount || 0) > 0));
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Lỗi tải báo cáo đối chiếu dự toán');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, fromDate, toDate]);

  if (loading) {
    return <LoadingSpinner size="md" label="Đang tải Báo cáo Dự toán vật tư..." className="py-20" />;
  }

  if (error) {
    return <div className="p-10 text-center text-red-500 font-semibold">{error}</div>;
  }

  const exceedingItemsCount = items.filter(i => i.isExceeding).length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      {!embeddedProjectId && (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={14} /> Quay lại Dự án
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white m-0">Báo cáo Đối chiếu BOQ vs Thực tế</h2>
              {project && <p className="text-xs text-slate-500 m-0 mt-0.5">Dự án: {project.name}</p>}
            </div>
          </div>
        </div>
      )}

      {projectId === 'all' ? (
        <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Dự án có vật tư vượt Dự toán (Toàn công ty)</h4>
          {allProjectsData.length > 0 ? (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={allProjectsData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fontWeight: 600 }} />
                  <RechartsTooltip formatter={(value) => [`${value} mã vật tư`, 'Vượt dự toán']} />
                  <Bar dataKey="exceedCount" name="Mã vật tư vượt dự toán" fill="#ef4444" radius={[0, 6, 6, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-10 text-center text-emerald-600 font-bold text-sm">
              ✨ Không có dự án nào có vật tư vượt dự toán vật tư.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Financial & Volume Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Dự toán BOQ</span>
                <PackageCheck size={18} className="text-indigo-500" />
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-2">{items.length} Chủng loại</div>
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                {items.reduce((acc, i) => acc + (i.boqTotalValue || 0), 0) > 0
                  ? `~${(items.reduce((acc, i) => acc + (i.boqTotalValue || 0), 0) / 1000000).toFixed(1)} triệu VNĐ`
                  : 'Chưa cập nhật giá'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Vật tư Tiết kiệm</span>
                <PackageCheck size={18} className="text-emerald-500" />
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {items.filter(i => i.netConsumption < i.boqLimit && i.netConsumption > 0).length} Chủng loại
              </div>
              <div className="text-xs font-semibold text-emerald-600 mt-1">Tiêu thụ ít hơn dự toán vật tư</div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Vượt Dự toán vật tư</span>
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div className="text-xl font-black text-red-600 dark:text-red-400 mt-2">{exceedingItemsCount} Chủng loại</div>
              <div className="text-xs font-semibold text-red-600 mt-1">Cần phê duyệt xuất vượt dự toán</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-purple-200 dark:border-purple-900/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Giá trị Tiêu thụ</span>
                <PackageCheck size={18} className="text-purple-500" />
              </div>
              <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-2">
                {items.reduce((acc, i) => acc + (i.consumptionValue || 0), 0) > 0
                  ? `${(items.reduce((acc, i) => acc + (i.consumptionValue || 0), 0) / 1000000).toFixed(1)}M đ`
                  : `${items.reduce((acc, i) => acc + i.netConsumption, 0).toLocaleString()} Đơn vị`}
              </div>
              <div className="text-xs font-semibold text-purple-600 mt-1">Tổng xuất kho ròng thực tế</div>
            </div>
          </div>

          {/* Monthly BOQ Consumption Trend Chart */}
          {(monthlyTrends || []).length > 0 && (() => {
            const hasAnyDataYear = (monthlyTrends || []).some(t => (t.consumedValueVnd || 0) > 0 || (t.materialRequestCount || 0) > 0);
            const availableYears = Array.from(new Set((monthlyTrends || []).map(t => t.year)))
              .filter(y => !hasAnyDataYear || (monthlyTrends || []).some(t => t.year === y && ((t.consumedValueVnd || 0) > 0 || (t.materialRequestCount || 0) > 0)))
              .sort((a, b) => b - a);
            const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] ?? selectedYear);
            const filteredTrends = (monthlyTrends || []).filter(t => t.year === activeYear);

            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 m-0">
                      <TrendingUp size={16} className="text-indigo-500" /> Biểu đồ Xu hướng Tiêu thụ BOQ 12 Tháng Theo Năm
                    </h4>
                    <p className="text-xs text-slate-500 m-0 mt-0.5">So sánh chi phí tiêu thụ vật tư & số lượng phiếu xuất hàng tháng</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
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

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredTrends} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fontWeight: 600 }} />
                      <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}Tr`} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Số phiếu yêu cầu (MR)', angle: -90, position: 'insideRight', style: { fontSize: 10 } }} />
                      <RechartsTooltip
                        formatter={(value, name) => [
                          name === 'Chi phí tiêu thụ (VNĐ)'
                            ? `${formatNumber(Number(value || 0))} VNĐ`
                            : value,
                          String(name || '')
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar yAxisId="left" dataKey="consumedValueVnd" name="Chi phí tiêu thụ (VNĐ)" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Line yAxisId="right" type="monotone" dataKey="materialRequestCount" name="Số phiếu yêu cầu" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* Data Table */}
          {(() => {
            const filteredItems = items.filter(item => {
              if (searchTerm.trim()) {
                const query = searchTerm.toLowerCase().trim();
                const matchCode = (item.materialCode || '').toLowerCase().includes(query);
                const matchName = (item.materialName || '').toLowerCase().includes(query);
                const matchUnit = (item.unitName || '').toLowerCase().includes(query);
                if (!matchCode && !matchName && !matchUnit) return false;
              }

              if (statusFilter === 'exceeding' && !item.isExceeding) return false;
              if (statusFilter === 'earnedExceeding' && (!item.isEarnedExceeding || item.isExceeding)) return false;
              if (statusFilter === 'safe' && (item.isExceeding || item.isEarnedExceeding)) return false;

              const totalReturned = item.totalReturned || 0;
              const netConsumption = item.netConsumption ?? Math.max(0, (item.totalIssued || 0) - totalReturned);
              if (usageFilter === 'consumed' && netConsumption <= 0) return false;
              if (usageFilter === 'inStock' && (item.stockRemaining || 0) <= 0) return false;
              if (usageFilter === 'hasReturned' && totalReturned <= 0) return false;

              return true;
            });

            const isFiltering = !!searchTerm || statusFilter !== 'all' || usageFilter !== 'all';

            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Bảng kiểm soát đối chiếu BOQ
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Hiển thị {filteredItems.length} / {items.length} chủng loại
                    </span>
                  </div>

                  {/* Filter / Search Toolbar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative min-w-[200px] max-w-[280px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm mã VT, tên vật tư..."
                        className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="safe">✅ An toàn</option>
                        <option value="earnedExceeding">⚠️ Cảnh báo tiến độ</option>
                        <option value="exceeding">🚨 Vượt tổng BOQ</option>
                      </select>
                    </div>

                    {/* Usage Filter */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={usageFilter}
                        onChange={(e) => setUsageFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="all">Tất cả vật tư</option>
                        <option value="consumed">Có tiêu thụ ròng</option>
                        <option value="inStock">Còn tồn kho</option>
                        <option value="hasReturned">Có hoàn trả</option>
                      </select>
                    </div>

                    {/* Reset Filters */}
                    {isFiltering && (
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('all');
                          setUsageFilter('all');
                        }}
                        className="px-2.5 py-1.5 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition-colors flex items-center gap-1"
                        title="Xóa bộ lọc"
                      >
                        <X size={12} /> Đặt lại
                      </button>
                    )}
                  </div>
                </div>

                <div className="min-h-[440px] max-h-[440px] overflow-y-auto overflow-x-hidden custom-scrollbar">
                  <table className="w-full text-xs text-left relative table-fixed">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 shadow-sm text-[10.5px]">
                      <tr>
                        <th className="w-[36px] px-1 py-2.5 text-center shrink-0">STT</th>
                        <th className="w-[12%] px-1.5 py-2.5 truncate">Mã VT</th>
                        <th className="w-[23%] px-2 py-2.5">Tên vật tư</th>
                        <th className="w-[45px] px-1 py-2.5 text-center shrink-0">ĐVT</th>
                        <th className="w-[8%] px-1.5 py-2.5 text-right">BOQ Tổng</th>
                        <th className="w-[8.5%] px-1.5 py-2.5 text-right text-amber-600 font-bold">BOQ N.Thu</th>
                        <th className="w-[7%] px-1.5 py-2.5 text-right">Đã xuất</th>
                        <th className="w-[6%] px-1.5 py-2.5 text-right">Trả lại</th>
                        <th className="w-[8%] px-1.5 py-2.5 text-right text-indigo-600 font-bold">Tiêu thụ</th>
                        <th className="w-[6%] px-1.5 py-2.5 text-right">Tồn kho</th>
                        <th className="w-[6%] px-1.5 py-2.5 text-right">Vượt mức</th>
                        <th className="w-[14%] px-1.5 py-2.5 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px]">
                      {filteredItems.map((item, index) => {
                        const isExceeding = !!item?.isExceeding;
                        const isEarnedExceeding = !!item?.isEarnedExceeding;
                        const totalReturned = item?.totalReturned || 0;
                        const netConsumption = item?.netConsumption ?? Math.max(0, (item?.totalIssued || 0) - totalReturned);
                        return (
                          <tr
                            key={item.materialId}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isExceeding ? 'bg-red-50/30 dark:bg-red-950/10' : isEarnedExceeding ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''}`}
                          >
                            <td className="px-1 py-2.5 text-center font-medium text-slate-500">{index + 1}</td>
                            <td className="px-1.5 py-2.5 font-mono font-bold text-slate-700 dark:text-slate-300 truncate" title={item?.materialCode}>{item?.materialCode || '—'}</td>
                            <td className="px-2 py-2.5 font-bold text-slate-900 dark:text-white leading-tight">
                              <span className="line-clamp-2" title={item?.materialName}>{item?.materialName || '—'}</span>
                            </td>
                            <td className="px-1 py-2.5 text-center text-slate-500 truncate" title={item?.unitName}>{item?.unitName || '—'}</td>
                            <td className="px-1.5 py-2.5 text-right font-bold text-slate-900 dark:text-white truncate">{(item?.boqLimit || 0).toLocaleString()}</td>
                            <td className="px-1.5 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400 truncate">{(item?.earnedBoqLimit || 0).toLocaleString()}</td>
                            <td className="px-1.5 py-2.5 text-right text-slate-700 dark:text-slate-300 truncate">{(item?.totalIssued || 0).toLocaleString()}</td>
                            <td className="px-1.5 py-2.5 text-right text-blue-600 truncate">{totalReturned > 0 ? `+${totalReturned.toLocaleString()}` : '0'}</td>
                            <td className="px-1.5 py-2.5 text-right font-extrabold text-indigo-600 dark:text-indigo-400 truncate">{netConsumption.toLocaleString()}</td>
                            <td className="px-1.5 py-2.5 text-right text-slate-600 dark:text-slate-400 truncate">{(item?.stockRemaining || 0).toLocaleString()}</td>
                            <td className={`px-1.5 py-2.5 text-right font-extrabold truncate ${isExceeding ? 'text-red-600 dark:text-red-400' : isEarnedExceeding ? 'text-amber-600' : 'text-slate-400'}`}>
                              {isExceeding ? `+${(item?.exceededAmount || 0).toLocaleString()}` : isEarnedExceeding ? `+${(item?.earnedExceededAmount || 0).toLocaleString()}` : '0'}
                            </td>
                            <td className="px-1.5 py-2.5 text-center whitespace-nowrap">
                              {isExceeding ? (
                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-1.5 py-0.5 rounded-full text-[9.5px] font-extrabold whitespace-nowrap">
                                  <AlertTriangle size={10} /> VƯỢT DỰ TOÁN
                                </span>
                              ) : isEarnedExceeding ? (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded-full text-[9.5px] font-extrabold whitespace-nowrap">
                                  <AlertTriangle size={10} /> CẢNH BÁO TIẾN ĐỘ
                                </span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[9.5px] font-bold whitespace-nowrap">
                                  AN TOÀN
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={12} className="px-4 py-28 text-center text-slate-400">
                            {isFiltering ? (
                              <div className="flex flex-col items-center justify-center gap-2">
                                <span className="font-medium">Không tìm thấy vật tư nào phù hợp với từ khóa hoặc bộ lọc.</span>
                                <button
                                  onClick={() => {
                                    setSearchTerm('');
                                    setStatusFilter('all');
                                    setUsageFilter('all');
                                  }}
                                  className="text-xs text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer"
                                >
                                  Xóa bộ lọc để xem tất cả ({items.length} chủng loại)
                                </button>
                              </div>
                            ) : (
                              'Chưa có dữ liệu dự toán vật tư cho dự án này.'
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
};
