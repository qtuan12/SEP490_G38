import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, AlertCircle, DollarSign, Package, TrendingUp, ExternalLink, Search, X } from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui';
import { reportService, type ProcurementReportDto } from '../../../services/reportService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDateOnly, formatPlainDate } from '../../../utils/dateHelpers';
import { getPOSupplierDisplayName } from '../../../utils/purchaseOrderHelpers';
import { formatNumber } from '../../../utils/formatNumber';
import { getPreferredReportYear } from '../../../utils/reportYearHelpers';

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

  // Search & Filter State
  const [poSearchTerm, setPoSearchTerm] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState('all');
  const [dpSearchTerm, setDpSearchTerm] = useState('');
  const [dpStatusFilter, setDpStatusFilter] = useState('all');

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
        setLoadState({ requestIdentity, data: report, allProjectsData: [], error: null });
        setSelectedYear(getPreferredReportYear(
          report.monthlyTrends || [],
          trend => (trend.poCostVnd || 0) > 0 || (trend.directPurchaseCostVnd || 0) > 0,
        ));
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

  const formatCurrency = (v: number) => `${formatNumber(Math.round(v || 0))} VNĐ`;
  /** Ngày thuần (ngày đặt hàng, ngày giao dự kiến) — không quy đổi múi giờ. */
  const formatOrderDate = (d?: string) => formatPlainDate(d) || '—';
  /** Mốc thời gian UTC từ backend (thời điểm tạo phiếu). */
  const formatTimestamp = (d?: string) => (d ? formatDateOnly(d) : '—');

  if (projectId === 'all') {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 rounded-2xl text-xs font-semibold">
          <AlertCircle size={18} className="shrink-0 text-amber-600" />
          <span><strong>Lưu ý:</strong> Dữ liệu chi phí dựa trên tổng giá trị đơn hàng và mua trực tiếp khẩn cấp. Hạch toán chính thức theo kỳ cần phần mềm kế toán riêng.</span>
        </div>
        <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">So sánh Giá trị Mua sắm giữa các Dự án</h4>
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
                  <Bar dataKey="po" name="PO hợp lệ" stackId="a" fill="#6366f1" maxBarSize={50} />
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
        <span><strong>Lưu ý:</strong> Đây là giá trị mua sắm đã cam kết theo PO hợp lệ và phiếu mua trực tiếp đã duyệt, không phải số tiền đã thanh toán.</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
            <ShoppingCart size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Giá trị vật tư theo dự toán</div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{formatCurrency(data.totalPoCost)}</div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{data.purchaseOrders.length} đơn hàng</div>
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
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng giá trị</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(data.totalCost)}</div>
          </div>
        </div>
      </div>

      {/* Monthly Procurement & Expense Trend Chart */}
      {(data.monthlyTrends || []).length > 0 && (() => {
        const hasAnyDataYear = (data.monthlyTrends || []).some(t => (t.poCostVnd || 0) > 0 || (t.directPurchaseCostVnd || 0) > 0);
        const availableYears = Array.from(new Set((data.monthlyTrends || []).map(t => t.year)))
          .filter(y => !hasAnyDataYear || (data.monthlyTrends || []).some(t => t.year === y && ((t.poCostVnd || 0) > 0 || (t.directPurchaseCostVnd || 0) > 0)))
          .sort((a, b) => b - a);
        const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] ?? selectedYear);
        const filteredTrends = (data.monthlyTrends || []).filter(t => t.year === activeYear);

        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 m-0">
                  <TrendingUp size={16} className="text-indigo-500" /> Giá trị Mua sắm Theo Tháng
                </h4>
                <p className="text-xs text-slate-500 m-0 mt-0.5">Theo ngày đặt PO và ngày mua trực tiếp đã được duyệt</p>
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
                  <Bar dataKey="poCostVnd" name="PO hợp lệ" stackId="month" fill="#6366f1" maxBarSize={36} />
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
          <Package size={14} /> Danh sách đơn hàng ({data.purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('dp')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 ${activeTab === 'dp' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <AlertCircle size={14} /> Mua ngoài khẩn cấp ({data.directPurchases.length})
        </button>
      </div>

      {/* PO Table */}
      {activeTab === 'po' && (() => {
        const filteredPOs = data.purchaseOrders.filter(po => {
          if (poSearchTerm.trim()) {
            const q = poSearchTerm.toLowerCase().trim();
            const matchNumber = (po.poNumber || '').toLowerCase().includes(q);
            const matchSupplier = (getPOSupplierDisplayName(po.supplierName, po.poNumber) || '').toLowerCase().includes(q);
            if (!matchNumber && !matchSupplier) return false;
          }
          if (poStatusFilter !== 'all') {
            if (poStatusFilter === 'FullyReceived') {
              if (po.status !== 'FullyReceived' && po.status !== 'Closed' && po.status !== 'AutoClosed') return false;
            } else if (poStatusFilter === 'Rejected') {
              if (po.status !== 'Rejected' && po.status !== 'Cancelled') return false;
            } else if (po.status !== poStatusFilter) {
              return false;
            }
          }
          return true;
        });

        const isPoFiltering = !!poSearchTerm || poStatusFilter !== 'all';

        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  Danh sách đơn hàng
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Hiển thị {filteredPOs.length} / {data.purchaseOrders.length} đơn hàng
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search PO */}
                <div className="relative min-w-[200px] max-w-[280px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={poSearchTerm}
                    onChange={(e) => setPoSearchTerm(e.target.value)}
                    placeholder="Tìm theo số đơn hàng, nhà cung cấp..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {poSearchTerm && (
                    <button
                      onClick={() => setPoSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={poStatusFilter}
                    onChange={(e) => setPoStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Sent">Đã gửi NCC</option>
                    <option value="PartiallyReceived">Nhận 1 phần</option>
                    <option value="FullyReceived">Đã nhận đủ</option>
                    <option value="PendingApproval">Chờ GĐ duyệt</option>
                    <option value="Rejected">Bị từ chối / Đã hủy</option>
                  </select>
                </div>

                {/* Reset */}
                {isPoFiltering && (
                  <button
                    onClick={() => {
                      setPoSearchTerm('');
                      setPoStatusFilter('all');
                    }}
                    className="px-2.5 py-1.5 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition-colors flex items-center gap-1"
                    title="Xóa bộ lọc"
                  >
                    <X size={12} /> Đặt lại
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-[440px] max-h-[440px] overflow-y-auto overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs text-left relative">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-center w-12 shrink-0">STT</th>
                    <th className="px-4 py-3 w-40 min-w-[140px] whitespace-nowrap">Mã Đơn Hàng</th>
                    <th className="px-4 py-3 min-w-[180px]">Nhà cung cấp</th>
                    <th className="px-4 py-3 text-right w-44 min-w-[150px] whitespace-nowrap">Tổng giá trị</th>
                    <th className="px-4 py-3 w-32 min-w-[100px] whitespace-nowrap">Ngày đặt</th>
                    <th className="px-4 py-3 w-36 min-w-[120px] whitespace-nowrap">Giao hàng dự kiến</th>
                    <th className="px-4 py-3 text-center w-36 min-w-[130px] whitespace-nowrap">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPOs.map((po, index) => {
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
                            title="Xem chi tiết đơn hàng"
                          >
                            {po.poNumber}
                            <ExternalLink size={11} className="opacity-70 hover:opacity-100" />
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{getPOSupplierDisplayName(po.supplierName, po.poNumber) || '—'}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{formatNumber(po.totalAmount)} VNĐ</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatOrderDate(po.orderDate)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatOrderDate(po.expectedDeliveryDate)}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.colorClass}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPOs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-28 text-center text-slate-400">
                        {isPoFiltering ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="font-medium">Không tìm thấy đơn hàng nào phù hợp với bộ lọc.</span>
                            <button
                              onClick={() => {
                                setPoSearchTerm('');
                                setPoStatusFilter('all');
                              }}
                              className="text-xs text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer"
                            >
                              Xóa bộ lọc để xem tất cả ({data.purchaseOrders.length} đơn hàng)
                            </button>
                          </div>
                        ) : (
                          'Chưa có đơn hàng nào.'
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

      {/* Direct Purchase Table */}
      {activeTab === 'dp' && (() => {
        const filteredDPs = data.directPurchases.filter(dp => {
          if (dpSearchTerm.trim()) {
            const q = dpSearchTerm.toLowerCase().trim();
            const matchId = String(dp.directPurchaseId).includes(q) || `#${dp.directPurchaseId}`.includes(q);
            const matchName = (dp.requestedByName || '').toLowerCase().includes(q);
            if (!matchId && !matchName) return false;
          }
          if (dpStatusFilter !== 'all' && dp.status !== dpStatusFilter) {
            return false;
          }
          return true;
        });

        const isDpFiltering = !!dpSearchTerm || dpStatusFilter !== 'all';

        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  Danh sách mua ngoài khẩn cấp
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Hiển thị {filteredDPs.length} / {data.directPurchases.length} phiếu
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search DP */}
                <div className="relative min-w-[200px] max-w-[280px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={dpSearchTerm}
                    onChange={(e) => setDpSearchTerm(e.target.value)}
                    placeholder="Tìm theo mã phiếu, người yêu cầu..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {dpSearchTerm && (
                    <button
                      onClick={() => setDpSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={dpStatusFilter}
                    onChange={(e) => setDpStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Approved">Đã duyệt</option>
                    <option value="Pending">Chờ duyệt</option>
                    <option value="Rejected">Từ chối</option>
                  </select>
                </div>

                {/* Reset */}
                {isDpFiltering && (
                  <button
                    onClick={() => {
                      setDpSearchTerm('');
                      setDpStatusFilter('all');
                    }}
                    className="px-2.5 py-1.5 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition-colors flex items-center gap-1"
                    title="Xóa bộ lọc"
                  >
                    <X size={12} /> Đặt lại
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-[440px] max-h-[440px] overflow-y-auto overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs text-left relative">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-center w-12 shrink-0">STT</th>
                    <th className="px-4 py-3 w-36 min-w-[130px] whitespace-nowrap">Mã phiếu</th>
                    <th className="px-4 py-3 min-w-[180px]">Người yêu cầu</th>
                    <th className="px-4 py-3 text-right w-44 min-w-[150px] whitespace-nowrap">Tổng giá trị</th>
                    <th className="px-4 py-3 w-36 min-w-[120px] whitespace-nowrap">Ngày tạo</th>
                    <th className="px-4 py-3 text-center w-36 min-w-[130px] whitespace-nowrap">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDPs.map((dp, index) => (
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
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{formatNumber(dp.totalAmount)} VNĐ</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatTimestamp(dp.createdAt)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {DP_STATUS_LABELS[dp.status] || dp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredDPs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-28 text-center text-slate-400">
                        {isDpFiltering ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="font-medium">Không tìm thấy phiếu mua ngoài nào phù hợp với bộ lọc.</span>
                            <button
                              onClick={() => {
                                setDpSearchTerm('');
                                setDpStatusFilter('all');
                              }}
                              className="text-xs text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer"
                            >
                              Xóa bộ lọc để xem tất cả ({data.directPurchases.length} phiếu)
                            </button>
                          </div>
                        ) : (
                          'Chưa có mua ngoài khẩn cấp nào.'
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
    </div>
  );
};
