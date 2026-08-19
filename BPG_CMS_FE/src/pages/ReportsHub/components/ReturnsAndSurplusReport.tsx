import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCcw, DollarSign, ArrowLeftRight, Clock,
  Search, CheckCircle2, Eye, X, ExternalLink
} from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui';
import {
  reportService,
  type MaterialReturnsAndSurplusReportDto,
  type MaterialReturnReportItemDto
} from '../../../services/reportService';
import {
import { formatNumber } from '../../../utils/formatNumber';
  ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, BarChart
} from 'recharts';

interface Props {
  projectId: string | null;
  fromDate?: string;
  toDate?: string;
}

const PIE_COLORS = ['#10b981', '#6366f1', '#a855f7', '#f59e0b'];

export const ReturnsAndSurplusReport: React.FC<Props> = ({ projectId, fromDate, toDate }) => {
  const [data, setData] = useState<MaterialReturnsAndSurplusReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'returns' | 'surplus-items' | 'actions'>('returns');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturnDetail, setSelectedReturnDetail] = useState<MaterialReturnReportItemDto | null>(null);

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    setError(null);
    reportService.getReturnsAndSurplusReport(projectId, { fromDate, toDate })
      .then(res => setData(res))
      .catch(err => {
        console.error('Error fetching returns & surplus report:', err);
        setError(err?.message || 'Không thể tải báo cáo hoàn trả và xử lý vật tư thừa.');
      })
      .finally(() => setLoading(false));
  }, [projectId, fromDate, toDate]);

  // Filter lists based on search term
  const filteredReturns = useMemo(() => {
    if (!data?.materialReturns) return [];
    if (!searchTerm.trim()) return data.materialReturns;
    const term = searchTerm.toLowerCase();
    return data.materialReturns.filter(r =>
      r.returnNo.toLowerCase().includes(term) ||
      r.taskName.toLowerCase().includes(term) ||
      r.reason.toLowerCase().includes(term) ||
      r.createdByName.toLowerCase().includes(term) ||
      r.projectName.toLowerCase().includes(term) ||
      r.items.some(it => it.materialCode.toLowerCase().includes(term) || it.materialName.toLowerCase().includes(term))
    );
  }, [data?.materialReturns, searchTerm]);

  const filteredSurplusItems = useMemo(() => {
    if (!data?.surplusRequests) return [];
    if (!searchTerm.trim()) return data.surplusRequests;
    const term = searchTerm.toLowerCase();
    return data.surplusRequests.filter(s =>
      s.materialCode.toLowerCase().includes(term) ||
      s.materialName.toLowerCase().includes(term) ||
      s.projectName.toLowerCase().includes(term) ||
      s.status.toLowerCase().includes(term) ||
      (s.reason && s.reason.toLowerCase().includes(term))
    );
  }, [data?.surplusRequests, searchTerm]);

  const filteredActions = useMemo(() => {
    if (!data?.surplusActions) return [];
    if (!searchTerm.trim()) return data.surplusActions;
    const term = searchTerm.toLowerCase();
    return data.surplusActions.filter(a =>
      a.materialCode.toLowerCase().includes(term) ||
      a.materialName.toLowerCase().includes(term) ||
      a.partnerOrDestination.toLowerCase().includes(term) ||
      a.actionType.toLowerCase().includes(term) ||
      a.status.toLowerCase().includes(term) ||
      (a.note && a.note.toLowerCase().includes(term))
    );
  }, [data?.surplusActions, searchTerm]);

  // Pie chart data for Surplus handling methods (by number of action logs / items)
  const surplusPieData = useMemo(() => {
    if (!data?.surplusMethodBreakdown) return [];
    const b = data.surplusMethodBreakdown;
    return [
      { name: 'Trả lại NCC', value: b.returnSupplierActionsCount ?? (b.returnSupplierQuantity > 0 ? 1 : 0), amount: b.returnSupplierValueVnd, color: '#10b981' },
      { name: 'Điều chuyển dự án', value: b.transferActionsCount ?? (b.transferQuantity > 0 ? 1 : 0), amount: 0, color: '#6366f1' },
      { name: 'Bán thanh lý', value: b.liquidationActionsCount ?? (b.liquidationQuantity > 0 ? 1 : 0), amount: b.liquidationValueVnd, color: '#a855f7' },
      { name: 'Chờ xử lý (Tồn)', value: b.pendingRemainingItemsCount ?? 0, amount: 0, color: '#f59e0b' },
    ].filter(x => x.value > 0);
  }, [data?.surplusMethodBreakdown]);

  if (loading) {
    return <LoadingSpinner size="md" label="Đang tổng hợp số liệu hoàn trả & xử lý thừa..." className="py-20" />;
  }

  if (error || !data) {
    return (
      <div className="p-10 text-center text-red-500 font-semibold bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/50">
        {error || 'Không có dữ liệu báo cáo.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-indigo-100 dark:border-indigo-950/60 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm shadow-indigo-200 dark:shadow-none">
            <RotateCcw size={22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white m-0 flex items-center gap-2">
              Báo Cáo Tổng Hợp Hoàn Trả & Xử Lý Vật Tư Thừa
            </h2>
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 m-0 mt-0.5">
              {data.projectName} • Cập nhật lúc {new Date(data.generatedAt).toLocaleTimeString('vi-VN')} {new Date(data.generatedAt).toLocaleDateString('vi-VN')}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Premium KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Material Returns */}
        <div className="bg-gradient-to-br from-indigo-50/60 to-white dark:from-slate-900 dark:to-slate-800/80 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Hoàn Trả Công Trường</span>
            <RotateCcw size={18} className="text-indigo-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {formatNumber(data.totalReturnSlips)} <span className="text-xs font-medium text-slate-500">phiếu</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>{data.totalReturnDistinctMaterialsCount ?? data.totalReturnItemsCount} loại vật tư</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">~{(data.totalReturnEstimatedValue / 1_000_000).toFixed(1)}M đ</span>
            </div>
          </div>
        </div>

        {/* Card 2: Financial Recovery */}
        <div className="bg-gradient-to-br from-emerald-50/60 to-white dark:from-slate-900 dark:to-slate-800/80 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Thu Hồi Tài Chính</span>
            <DollarSign size={18} className="text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatNumber(data.totalFinancialRecoveryAmount)} <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">VNĐ</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>NCC: {data.totalSupplierRefundAmount > 0 ? `${(data.totalSupplierRefundAmount / 1_000_000).toFixed(1)}M` : '0 đ'}</span>
              <span>Thanh lý: {data.totalLiquidationAmount > 0 ? `${(data.totalLiquidationAmount / 1_000_000).toFixed(1)}M` : '0 đ'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Inter-project Transfers */}
        <div className="bg-gradient-to-br from-purple-50/60 to-white dark:from-slate-900 dark:to-slate-800/80 border border-purple-200/80 dark:border-purple-900/50 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Điều Chuyển Nội Bộ</span>
            <ArrowLeftRight size={18} className="text-purple-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
              {formatNumber(data.totalTransferredActionsCount)} <span className="text-xs font-medium text-slate-500">lượt điều chuyển</span>
            </div>
            <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-1">
              Điều chuyển liên dự án ({data.totalTransferredMaterialsCount ?? data.totalTransferredItemsCount ?? 1} loại vật tư)
            </div>
          </div>
        </div>

        {/* Card 4: Surplus Pending / Resolution Rate */}
        <div className="bg-gradient-to-br from-amber-50/60 to-white dark:from-slate-900 dark:to-slate-800/80 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Tồn Đọng & Tiến Độ Xử Lý</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {data.surplusResolutionRatePercent}% <span className="text-xs font-medium text-slate-500">giải phóng</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span className="text-emerald-600 dark:text-emerald-400">Đã xong: {data.totalSurplusResolvedItemsCount ?? (data.totalSurplusItems - (data.totalSurplusPendingItemsCount ?? 0))} mục</span>
              <span className="text-amber-600 dark:text-amber-400">Còn tồn: {data.totalSurplusPendingItemsCount ?? 0} mục</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Donut Chart: Surplus Handling Methods */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white m-0">Cơ Cấu Phương Thức Xử Lý Thừa</h4>
            <p className="text-xs text-slate-500 m-0 mt-0.5">Phân bổ theo số lượt và mặt hàng xử lý</p>
          </div>

          <div className="h-60 w-full flex items-center justify-center my-2">
            {surplusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={surplusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {surplusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value, name) => [`${formatNumber(Number(value || 0))} lượt / mặt hàng`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs font-semibold text-slate-400 text-center">Chưa có dữ liệu xử lý vật tư thừa</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-slate-500">Hoàn tiền NCC: <strong className="text-emerald-600 font-bold">{formatNumber(data.totalSupplierRefundAmount)} đ</strong></div>
            <div className="text-slate-500">Thu thanh lý: <strong className="text-purple-600 font-bold">{formatNumber(data.totalLiquidationAmount)} đ</strong></div>
          </div>
        </div>

        {/* 12-Month Trends Chart */}
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between ${projectId === 'all' ? 'lg:col-span-2' : 'lg:col-span-2'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white m-0">Xu Hướng Hoàn Trả & Thu Hồi Tài Chính 12 Tháng</h4>
              <p className="text-xs text-slate-500 m-0 mt-0.5">Biến động số lượng phiếu hoàn trả công trường và giá trị thu hồi qua từng tháng</p>
            </div>
          </div>

          <div className="h-60 w-full mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthlyTrends} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fontWeight: 600 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}Tr`} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} label={{ value: 'Số phiếu hoàn trả', angle: -90, position: 'insideRight', style: { fontSize: 10 } }} />
                <RechartsTooltip
                  formatter={(value, name) => [
                    name === 'Giá trị thu hồi (VNĐ)' || name === 'Giá trị hoàn trả (VNĐ)'
                      ? `${formatNumber(Number(value || 0))} VNĐ`
                      : `${formatNumber(Number(value || 0))} phiếu`,
                    String(name || '')
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="financialRecoveryAmountVnd" name="Giá trị thu hồi (VNĐ)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line yAxisId="right" type="monotone" dataKey="returnSlipCount" name="Số phiếu hoàn trả (Phiếu)" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span>Tổng số phiếu hoàn trả: <strong>{formatNumber(data.totalReturnSlips)} phiếu</strong> ({data.totalReturnDistinctMaterialsCount ?? data.totalReturnItemsCount} loại vật tư)</span>
            <span>Tổng tài chính thu hồi: <strong className="text-emerald-600">{formatNumber(data.totalFinancialRecoveryAmount)} đ</strong></span>
          </div>
        </div>
      </div>

      {/* Cross-Project Comparison (When viewing 'all') */}
      {projectId === 'all' && data.crossProjectMatrix.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">So Sánh Hoàn Trả & Xử Lý Thừa Theo Từng Dự Án</h4>
          <p className="text-xs text-slate-500 mb-4">So sánh số lượng mặt hàng thừa phát sinh và mặt hàng đã giải phóng giữa các công trình</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.crossProjectMatrix} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="projectName" tick={{ fontSize: 10, fontWeight: 600 }} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  formatter={(value, name) => [`${formatNumber(Number(value || 0))} mặt hàng`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="surplusItemCount" name="Tổng mặt hàng thừa" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="surplusResolvedItemCount" name="Mặt hàng đã giải phóng" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Segmented Sub-tabs & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-2xl self-start">
            <button
              onClick={() => setActiveSubTab('returns')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'returns'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
            >
              Phiếu Hoàn Trả Công Trường ({data.materialReturns.length})
            </button>
            <button
              onClick={() => setActiveSubTab('surplus-items')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'surplus-items'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
            >
              Danh Mục Vật Tư Thừa ({data.surplusRequests.length})
            </button>
            <button
              onClick={() => setActiveSubTab('actions')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'actions'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
            >
              Nhật Ký Xử Lý Thừa ({data.surplusActions.length})
            </button>
          </div>

          <div className="relative w-full md:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm nhanh..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Tab 1 Content: Material Returns Table */}
        {activeSubTab === 'returns' && (
          <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-center w-12">STT</th>
                  <th className="px-4 py-3 w-52">Phiếu hoàn trả & Người lập</th>
                  <th className="px-4 py-3">Lý do & Công việc thi công</th>
                  <th className="px-4 py-3 text-right w-48">Quy mô & Giá trị</th>
                  <th className="px-4 py-3 text-center w-16">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReturns.map((r, index) => (
                  <tr key={r.materialReturnId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5 text-center font-medium text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/projects/${r.projectId || projectId}?tab=inventory&subTab=returns&returnId=${r.materialReturnId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                          title="Mở kho dự án xem phiếu hoàn trả"
                        >
                          {r.returnNo}
                          <ExternalLink size={11} className="opacity-70 hover:opacity-100" />
                        </Link>
                        {projectId === 'all' && (
                          <Link
                            to={`/projects/${r.projectId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold hover:text-indigo-600 hover:underline"
                            title="Xem chi tiết dự án"
                          >
                            {r.projectName}
                          </Link>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                        <span>{new Date(r.returnDate).toLocaleDateString('vi-VN')}</span>
                        <span>•</span>
                        <span>{r.createdByName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 dark:text-white" title={r.reason}>
                        {r.reason || '—'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {r.taskName && (
                          r.taskId ? (
                            <Link
                              to={`/tasks/${r.taskId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-indigo-600 hover:underline inline-flex items-center gap-1"
                              title="Chuyển đến công việc thi công"
                            >
                              <span>Công việc: <strong>{r.taskName}</strong></span>
                              <ExternalLink size={10} className="opacity-60" />
                            </Link>
                          ) : (
                            <span>Công việc: <strong>{r.taskName}</strong></span>
                          )
                        )}
                        {r.originalIssuanceNo && (
                          r.originalIssuanceId ? (
                            <Link
                              to={`/projects/${r.projectId || projectId}?tab=inventory&subTab=issuances&issuanceId=${r.originalIssuanceId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                              title="Xem phiếu xuất kho gốc"
                            >
                              (PXK gốc: {r.originalIssuanceNo})
                              <ExternalLink size={9} className="opacity-70" />
                            </Link>
                          ) : (
                            <span className="font-mono text-slate-400">
                              (PXK gốc: {r.originalIssuanceNo})
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        {r.totalEstimatedValueVnd > 0 ? `${formatNumber(r.totalEstimatedValueVnd)} đ` : '—'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {r.totalItems} chủng loại vật tư
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => setSelectedReturnDetail(r)}
                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Xem chi tiết vật tư hoàn trả"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredReturns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      Không tìm thấy phiếu hoàn trả vật tư nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2 Content: Surplus Request Items Table */}
        {activeSubTab === 'surplus-items' && (
          <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-center w-12">STT</th>
                  <th className="px-4 py-3">Vật tư dư thừa</th>
                  <th className="px-4 py-3 w-48">Đợt đề xuất & Dự án</th>
                  <th className="px-4 py-3 text-right w-56">Khối lượng xử lý</th>
                  <th className="px-4 py-3 text-center w-48">Tiến độ & Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSurplusItems.map((s, index) => (
                  <tr key={s.surplusRequestItemId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5 text-center font-medium text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{s.materialCode}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{s.materialName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Đơn vị tính: <strong>{s.unitName}</strong></div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Link
                        to={`/projects/${s.projectId || projectId}?tab=inventory`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                        title="Xem kho dự án"
                      >
                        Đợt #{s.surplusRequestId}
                        <ExternalLink size={10} className="opacity-70" />
                      </Link>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        {projectId === 'all' && (
                          <Link
                            to={`/projects/${s.projectId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline hover:text-indigo-600 font-semibold"
                          >
                            {s.projectName} •
                          </Link>
                        )}
                        <span>{new Date(s.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white">
                        Tổng thừa: {formatNumber(s.surplusQuantity)} {s.unitName}
                      </div>
                      <div className="text-[11px] mt-0.5 flex items-center justify-end gap-1.5 font-semibold">
                        <span className="text-emerald-600">Đã xong: +{formatNumber(s.processedQuantity)}</span>
                        <span>•</span>
                        <span className="text-amber-600">Còn: {formatNumber(s.remainingQuantity)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${s.resolutionPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                            style={{ width: `${Math.min(100, s.resolutionPercent)}%` }}
                          />
                        </div>
                        <span className="font-bold text-[11px] w-8 text-right">{s.resolutionPercent}%</span>
                      </div>
                      <div className="text-center mt-1">
                        {s.remainingQuantity === 0 ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <CheckCircle2 size={10} /> Đã hoàn tất
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Đang xử lý
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSurplusItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      Không tìm thấy danh mục vật tư thừa nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3 Content: Surplus Action Log Table */}
        {activeSubTab === 'actions' && (
          <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-center w-12">STT</th>
                  <th className="px-4 py-3 w-44">Phương thức & Ngày</th>
                  <th className="px-4 py-3">Vật tư & Ghi chú</th>
                  <th className="px-4 py-3 text-right w-44">Khối lượng & Thu hồi</th>
                  <th className="px-4 py-3 w-52">Đối tác / Đích đến</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredActions.map((a, index) => {
                  const isReturn = a.actionType === 'ReturnSupplier';
                  const isTransfer = a.actionType === 'Transfer';
                  const isLiq = a.actionType === 'Liquidation';

                  return (
                    <tr key={`${a.actionType}-${a.actionId}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3.5 text-center font-medium text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div>
                          {isReturn && (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                              <RotateCcw size={10} /> Trả lại NCC
                            </span>
                          )}
                          {isTransfer && (
                            <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                              <ArrowLeftRight size={10} /> Điều chuyển
                            </span>
                          )}
                          {isLiq && (
                            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                              <DollarSign size={10} /> Bán thanh lý
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {new Date(a.actionDate).toLocaleDateString('vi-VN')}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{a.materialCode}</span>
                          <span className="font-bold text-slate-900 dark:text-white">{a.materialName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {projectId === 'all' ? `Dự án: ${a.projectName}` : a.note || 'Xử lý hoàn tất'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatNumber(a.quantity)} {a.unitName}
                        </div>
                        <div className="text-[11px] mt-0.5 font-bold">
                          {a.financialValueVnd ? (
                            <span className="text-emerald-600">+{formatNumber(a.financialValueVnd)} đ</span>
                          ) : (
                            <span className="text-slate-400">Điều chuyển nội bộ</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={a.partnerOrDestination}>
                          {a.partnerOrDestination}
                        </div>
                        <div className="mt-1">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                            {a.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredActions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      Chưa có nhật ký hành động xử lý thừa nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail for Material Return Items */}
      {selectedReturnDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                  Chi Tiết Vật Tư Phiếu Hoàn Trả: <span className="font-mono text-indigo-600">{selectedReturnDetail.returnNo}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedReturnDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              <div><span className="text-slate-500">Dự án:</span> <div className="font-bold">{selectedReturnDetail.projectName}</div></div>
              <div><span className="text-slate-500">Phiếu xuất gốc:</span> <div className="font-mono font-bold text-indigo-600">{selectedReturnDetail.originalIssuanceNo || '—'}</div></div>
              <div><span className="text-slate-500">Công việc:</span> <div className="font-bold">{selectedReturnDetail.taskName || '—'}</div></div>
              <div><span className="text-slate-500">Người lập:</span> <div className="font-bold">{selectedReturnDetail.createdByName}</div></div>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 p-4">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-center w-10">STT</th>
                    <th className="px-3 py-2">Mã VT</th>
                    <th className="px-3 py-2">Tên Vật Tư</th>
                    <th className="px-3 py-2 text-center">ĐVT</th>
                    <th className="px-3 py-2 text-right">Số Lượng Trả</th>
                    <th className="px-3 py-2 text-right">Đơn Giá Ước Tính</th>
                    <th className="px-3 py-2 text-right font-bold text-emerald-600">Thành Tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedReturnDetail.items.map((item, idx) => (
                    <tr key={item.returnItemId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">{item.materialCode}</td>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{item.materialName}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{item.unitName}</td>
                      <td className="px-3 py-2 text-right font-black text-indigo-600 dark:text-indigo-400">{formatNumber(item.quantity)}</td>
                      <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                        {item.unitPrice > 0 ? `${formatNumber(item.unitPrice)} đ` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-600">
                        {item.estimatedValueVnd > 0 ? `${formatNumber(item.estimatedValueVnd)} đ` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850 text-xs">
              <span className="text-slate-500">Lý do: <em>{selectedReturnDetail.reason || '—'}</em></span>
              <button
                onClick={() => setSelectedReturnDetail(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
