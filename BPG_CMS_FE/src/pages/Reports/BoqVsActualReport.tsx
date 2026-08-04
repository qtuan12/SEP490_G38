import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportService, type BoqVsActualItemDto, type MonthlyBoqConsumptionTrendDto } from '../../services/reportService';
import { projectService } from '../../services/projectService';
import type { Project } from '../../types/common';
import { ArrowLeft, Loader2, AlertTriangle, PackageCheck, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';

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
          setProject(projs.find(p => p.id === projectId) || null);
          setItems(report.items || []);
          setMonthlyTrends(report.monthlyTrends || []);
        }
      } catch (err: any) {
        setError(err.message || 'Lỗi tải báo cáo đối chiếu định mức');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, fromDate, toDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin text-[hsl(var(--primary))]" />
        <span>Đang tải Báo cáo Định mức BOQ...</span>
      </div>
    );
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
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Dự án có vật tư vượt Định mức (Toàn công ty)</h4>
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
                  <RechartsTooltip formatter={(value: any) => [`${value} mã vật tư`, 'Vượt định mức']} />
                  <Bar dataKey="exceedCount" name="Mã vật tư vượt BOQ" fill="#ef4444" radius={[0, 6, 6, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-10 text-center text-emerald-600 font-bold text-sm">
              ✨ Không có dự án nào có vật tư vượt định mức BOQ.
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
              <div className="text-xs font-semibold text-emerald-600 mt-1">Tiêu thụ ít hơn BOQ limit</div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Vượt Định mức BOQ</span>
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div className="text-xl font-black text-red-600 dark:text-red-400 mt-2">{exceedingItemsCount} Chủng loại</div>
              <div className="text-xs font-semibold text-red-600 mt-1">Cần phê duyệt xuất vượt BOQ</div>
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
            const availableYears = Array.from(new Set((monthlyTrends || []).map(t => t.year))).sort((a, b) => b - a);
            const filteredTrends = (monthlyTrends || []).filter(t => t.year === selectedYear);

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
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Số Phiếu MR', angle: -90, position: 'insideRight', style: { fontSize: 10 } }} />
                      <RechartsTooltip
                        formatter={(value: any, name: any) => [
                          name === 'Chi phí tiêu thụ (VNĐ)'
                            ? `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 font-bold text-xs text-slate-900 dark:text-white flex justify-between items-center">
              <span>Bảng kiểm soát đối chiếu BOQ ({items.length} chủng loại)</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs text-left relative">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 shadow-sm">
                  <tr>
                    <th className="px-4 py-3">Mã VT</th>
                    <th className="px-4 py-3">Tên vật tư</th>
                    <th className="px-4 py-3 text-center">ĐVT</th>
                    <th className="px-4 py-3 text-right">BOQ Tổng (100%)</th>
                    <th className="px-4 py-3 text-right text-amber-600 font-bold">BOQ Nghiệm thu</th>
                    <th className="px-4 py-3 text-right">Đã xuất</th>
                    <th className="px-4 py-3 text-right">Trả lại</th>
                    <th className="px-4 py-3 text-right text-indigo-600 font-bold">Tiêu thụ ròng</th>
                    <th className="px-4 py-3 text-right">Tồn kho</th>
                    <th className="px-4 py-3 text-right">Vượt mức</th>
                    <th className="px-4 py-3 text-center">Trạng thái BOQ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(items || []).map(item => {
                    const isExceeding = !!item?.isExceeding;
                    const isEarnedExceeding = !!item?.isEarnedExceeding;
                    const totalReturned = item?.totalReturned || 0;
                    const netConsumption = item?.netConsumption ?? Math.max(0, (item?.totalIssued || 0) - totalReturned);
                    return (
                      <tr
                        key={item?.materialId || Math.random()}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isExceeding ? 'bg-red-50/30 dark:bg-red-950/10' : isEarnedExceeding ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">{item?.materialCode || '—'}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{item?.materialName || '—'}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{item?.unitName || '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{(item?.boqLimit || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400">{(item?.earnedBoqLimit || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{(item?.totalIssued || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-blue-600">{totalReturned > 0 ? `+${totalReturned.toLocaleString()}` : '0'}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-indigo-600 dark:text-indigo-400">{netConsumption.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{(item?.stockRemaining || 0).toLocaleString()}</td>
                        <td className={`px-4 py-3 text-right font-extrabold ${isExceeding ? 'text-red-600 dark:text-red-400' : isEarnedExceeding ? 'text-amber-600' : 'text-slate-400'}`}>
                          {isExceeding ? `+${(item?.exceededAmount || 0).toLocaleString()}` : isEarnedExceeding ? `+${(item?.earnedExceededAmount || 0).toLocaleString()}` : '0'}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {isExceeding ? (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                              <AlertTriangle size={12} /> VƯỢT TỔNG BOQ
                            </span>
                          ) : isEarnedExceeding ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                              <AlertTriangle size={12} /> CẢNH BÁO TIẾN ĐỘ
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              AN TOÀN
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        Chưa có dữ liệu định mức BOQ cho dự án này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
