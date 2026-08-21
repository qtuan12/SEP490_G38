import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, AlertCircle, DollarSign, Package, TrendingUp, ExternalLink } from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui';
import { reportService, type ProcurementReportDto } from '../../../services/reportService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDateOnly, formatPlainDate } from '../../../utils/dateHelpers';
import { getPOSupplierDisplayName } from '../../../utils/purchaseOrderHelpers';
import { getNearestAvailableYear } from '../../../utils/reportYearHelpers';
import { formatNumber } from '../../../utils/formatNumber';

interface Props {
  projectId: string | null;
  fromDate?: string;
  toDate?: string;
}

const PO_STATUS_LABELS: Record<string, { label: string; colorClass: string }> = {
  Draft: { label: 'Nháp', colorClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  PendingApproval: { label: 'Chờ GĐ duyệt', colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  Rejected: { label: 'Bị từ chối', colorClass: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  Sent: { label: 'Đã gửi NCC', colorClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  PartiallyReceived: { label: 'Nhận 1 phần', colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  FullyReceived: { label: 'Đã nhận đủ', colorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  Closed: { label: 'Đã đóng', colorClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  AutoClosed: { label: 'Tự động đóng', colorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  Cancelled: { label: 'Đã hủy', colorClass: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
};

const DP_STATUS_LABELS: Record<string, string> = {
  Approved: 'Đã duyệt',
  Draft: 'Nháp',
  Pending: 'Chờ duyệt',
  Rejected: 'Từ chối',
};

export const ProcurementReport: React.FC<Props> = ({ projectId, fromDate, toDate }) => {
  const requestIdentity = useMemo(
    () => ({ projectId, fromDate, toDate }),
    [projectId, fromDate, toDate],
  );
  const [loadState, setLoadState] = useState<{
    requestIdentity: object;
    data: ProcurementReportDto | null;
    allProjectsData: { name: string; po: number; dp: number }[];
    error: string | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'po' | 'dp'>('po');
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const requestIdRef = useRef(0);
  const isCurrentResult = loadState?.requestIdentity === requestIdentity;
  const data = isCurrentResult ? loadState.data : null;
  const allProjectsData = isCurrentResult ? loadState.allProjectsData : [];
  const error = isCurrentResult ? loadState.error : null;
  const loading = Boolean(projectId && !isCurrentResult);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const requestedProjectId = requestIdentity.projectId;

    if (!requestedProjectId) {
      return () => {
        if (requestIdRef.current === requestId) requestIdRef.current += 1;
      };
    }

    const loadReport = async () => {
      try {
        if (requestedProjectId === 'all') {
          const { projectService } = await import('../../../services/projectService');
          const projects = await projectService.getProjects();
          const activeProjects = projects.filter(project => project.status !== 'draft');
          const reports = await Promise.all(
            activeProjects.map(project =>
              reportService.getProcurementReport(Number(project.id), {
                fromDate: requestIdentity.fromDate,
                toDate: requestIdentity.toDate,
              }).catch(() => null)
            )
          );

          if (requestId !== requestIdRef.current) return;
          const aggregatedData = activeProjects
              .map((project, index) => ({
                name: project.name.length > 16 ? project.name.substring(0, 16) + '…' : project.name,
                po: reports[index]?.totalPoCost || 0,
                dp: reports[index]?.totalDirectPurchaseCost || 0,
              }))
              .filter(item => item.po > 0 || item.dp > 0);
          setLoadState({ requestIdentity, data: null, allProjectsData: aggregatedData, error: null });
          return;
        }

        const report = await reportService.getProcurementReport(Number(requestedProjectId), {
          fromDate: requestIdentity.fromDate,
          toDate: requestIdentity.toDate,
        });
        if (requestId !== requestIdRef.current) return;
        setLoadState({ requestIdentity, data: report, allProjectsData: [], error: null });
        setSelectedYear(year => getNearestAvailableYear(
          year,
          (report.monthlyTrends || []).map(trend => trend.year),
        ) ?? year);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error('Error fetching procurement report', err);
        setLoadState({
          requestIdentity,
          data: null,
          allProjectsData: [],
          error: err instanceof Error ? err.message : 'Không thể tải báo cáo mua sắm.',
        });
      }
    };

    void loadReport();

    return () => {
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
    };
  }, [requestIdentity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <LoadingSpinner size="md" label="Đang tải Báo cáo Mua sắm & Chi phí..." />
      </div>
    );
  }

  if (error) {
    return <div className="p-10 text-center text-red-500 font-semibold">{error}</div>;
  }

  const formatCurrency = (v: number) => `${formatNumber(v)} VNĐ`;
  /** Ngày thuần (ngày đặt hàng, ngày giao dự kiến) — không quy đổi múi giờ. */
  const formatOrderDate = (d?: string) => formatPlainDate(d) || '—';
  /** Mốc thời gian UTC từ backend (thời điểm tạo phiếu). */
  const formatTimestamp = (d?: string) => (d ? formatDateOnly(d) : '—');

  if (projectId === 'all') {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 rounded-2xl text-xs font-semibold">
          <AlertCircle size={18} className="shrink-0 text-amber-600" />
          <span><strong>Lưu ý:</strong> Dữ liệu chi phí dựa trên tổng giá trị PO và mua trực tiếp khẩn cấp. Hạch toán chính thức theo kỳ cần phần mềm kế toán riêng.</span>
        </div>
        <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">So sánh Chi phí Mua sắm giữa các Dự án</h4>
          {allProjectsData.length > 0 ? (
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allProjectsData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }} 
                    interval={0} 
                    angle={-30} 
                    textAnchor="end" 
                    height={70}
                    tickFormatter={(v: string) => (v && v.length > 22 ? `${v.slice(0, 20)}...` : v)}
                  />
                  <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}Tr`} />
                  <RechartsTooltip formatter={(value) => [formatCurrency(Number(value || 0)), 'Giá trị']} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="po" name="PO Đã duyệt" stackId="a" fill="#6366f1" maxBarSize={50} />
                  <Bar dataKey="dp" name="Mua ngoài khẩn cấp" stackId="a" fill="#ef4444" maxBarSize={50} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-10 text-center text-slate-400 text-xs font-semibold">Chưa có dữ liệu chi phí mua sắm.</div>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Notice Banner */}
      <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 rounded-2xl text-xs font-semibold">
        <AlertCircle size={18} className="shrink-0 text-amber-600" />
        <span><strong>Lưu ý:</strong> Báo cáo chi phí dựa trên tổng giá trị PO đã duyệt và các phiếu mua trực tiếp khẩn cấp.</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
            <ShoppingCart size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">PO Mua sắm (Nhập kho)</div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{formatCurrency(data.totalPoCost)}</div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{data.purchaseOrders.length} đơn hàng</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-purple-200 dark:border-purple-900/50 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Thi công Thực tế (Xuất kho)</div>
            <div className="text-lg font-black text-purple-700 dark:text-purple-300 mt-0.5">{formatCurrency(data.totalMaterialIssuanceValue || 0)}</div>
            <div className="text-[10px] font-semibold text-purple-600 mt-0.5">Giá trị vật tư đã xuất dùng</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl shrink-0">
            <AlertCircle size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mua ngoài khẩn cấp</div>
            <div className="text-lg font-black text-red-600 dark:text-red-400 mt-0.5">{formatCurrency(data.totalDirectPurchaseCost)}</div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{data.directPurchases.length} đơn khẩn cấp</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng Mua sắm (Dòng tiền)</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(data.totalCost)}</div>
          </div>
        </div>
      </div>

      {/* Monthly Procurement & Expense Trend Chart */}
      {(data.monthlyTrends || []).length > 0 && (() => {
        const availableYears = Array.from(new Set((data.monthlyTrends || []).map(t => t.year))).sort((a, b) => b - a);
        const filteredTrends = (data.monthlyTrends || []).filter(t => t.year === selectedYear);

        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 m-0">
                  <TrendingUp size={16} className="text-indigo-500" /> Biểu đồ Chi phí Mua sắm 12 Tháng Theo Năm
                </h4>
                <p className="text-xs text-slate-500 m-0 mt-0.5">So sánh chi phí đơn PO vs Mua ngoài khẩn cấp hàng tháng</p>
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

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredTrends} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fontWeight: 600 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}Tr`} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(value) => [formatCurrency(Number(value || 0)), 'Giá trị']} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="poCostVnd" name="Đơn PO" stackId="month" fill="#6366f1" maxBarSize={36} />
                  <Bar dataKey="directPurchaseCostVnd" name="Mua khẩn cấp" stackId="month" fill="#ef4444" maxBarSize={36} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('po')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 ${activeTab === 'po' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <Package size={14} /> Danh sách PO ({data.purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('dp')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 ${activeTab === 'dp' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <AlertCircle size={14} /> Mua ngoài khẩn cấp ({data.directPurchases.length})
        </button>
      </div>

      {/* PO Table */}
      {activeTab === 'po' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="max-h-[420px] overflow-y-auto overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs text-left relative">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-center w-12">STT</th>
                  <th className="px-4 py-3">Số PO</th>
                  <th className="px-4 py-3">Nhà cung cấp</th>
                  <th className="px-4 py-3 text-right">Tổng giá trị</th>
                  <th className="px-4 py-3">Ngày đặt</th>
                  <th className="px-4 py-3">Giao hàng dự kiến</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.purchaseOrders.map((po, index) => {
                  const statusInfo = PO_STATUS_LABELS[po.status] || { label: po.status, colorClass: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={po.poId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-center font-medium text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/purchase-orders/${po.poId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                          title="Xem chi tiết đơn hàng PO"
                        >
                          {po.poNumber}
                          <ExternalLink size={11} className="opacity-70 hover:opacity-100" />
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{getPOSupplierDisplayName(po.supplierName, po.poNumber) || '—'}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900 dark:text-white">{formatNumber(po.totalAmount)} VNĐ</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatOrderDate(po.orderDate)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatOrderDate(po.expectedDeliveryDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.colorClass}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {data.purchaseOrders.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Chưa có PO nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Direct Purchase Table */}
      {activeTab === 'dp' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="max-h-[420px] overflow-y-auto overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs text-left relative">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-center w-12">STT</th>
                  <th className="px-4 py-3">Mã phiếu</th>
                  <th className="px-4 py-3">Người yêu cầu</th>
                  <th className="px-4 py-3 text-right">Tổng giá trị</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.directPurchases.map((dp, index) => (
                  <tr key={dp.directPurchaseId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-center font-medium text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        to={`/direct-purchases?directPurchaseId=${dp.directPurchaseId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                        title="Xem mua ngoài khẩn cấp"
                      >
                        #{dp.directPurchaseId}
                        <ExternalLink size={11} className="opacity-70 hover:opacity-100" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{dp.requestedByName}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-900 dark:text-white">{formatNumber(dp.totalAmount)} VNĐ</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatTimestamp(dp.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {DP_STATUS_LABELS[dp.status] || dp.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.directPurchases.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Chưa có mua ngoài khẩn cấp nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
