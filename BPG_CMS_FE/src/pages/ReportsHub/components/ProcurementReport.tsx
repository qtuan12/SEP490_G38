import React, { useEffect, useState } from 'react';
import { Loader2, ShoppingCart, AlertCircle, DollarSign, Package } from 'lucide-react';
import { reportService, type ProcurementReportDto } from '../../../services/reportService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  projectId: string | null;
}

const PO_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  Draft: { label: 'Nháp', color: 'hsl(var(--text-muted))' },
  Sent: { label: 'Đã gửi', color: 'hsl(var(--primary))' },
  PartiallyReceived: { label: 'Nhận 1 phần', color: 'hsl(var(--warning))' },
  FullyReceived: { label: 'Đã nhận đủ', color: 'hsl(var(--success))' },
  Closed: { label: 'Đã đóng', color: 'hsl(var(--text-muted))' },
  AutoClosed: { label: 'Tự động đóng', color: 'hsl(var(--success))' },
  Cancelled: { label: 'Đã hủy', color: 'hsl(var(--danger))' },
};

const DP_STATUS_LABELS: Record<string, string> = {
  Approved: 'Đã duyệt',
  Draft: 'Nháp',
  Pending: 'Chờ duyệt',
  Rejected: 'Từ chối',
};

export const ProcurementReport: React.FC<Props> = ({ projectId }) => {
  const [data, setData] = useState<ProcurementReportDto | null>(null);
  const [allProjectsData, setAllProjectsData] = useState<{ name: string; po: number; dp: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'po' | 'dp'>('po');

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    if (projectId === 'all') {
      import('../../../services/projectService').then(({ projectService }) => {
        projectService.getProjects().then(projects => {
          Promise.all(
            projects.filter(p => p.status !== 'draft').map(p =>
              reportService.getProcurementReport(Number(p.id)).catch(() => null)
            )
          ).then(reports => {
            const aggregated = projects
              .filter(p => p.status !== 'draft')
              .map((p, i) => ({
                name: p.name.length > 16 ? p.name.substring(0, 16) + '…' : p.name,
                po: reports[i]?.totalPoCost || 0,
                dp: reports[i]?.totalDirectPurchaseCost || 0,
              }))
              .filter(x => x.po > 0 || x.dp > 0);
            setAllProjectsData(aggregated);
          });
        }).finally(() => setLoading(false));
      });
    } else {
      reportService.getProcurementReport(Number(projectId))
        .then(setData)
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải Báo cáo Mua sắm...</span>
      </div>
    );
  }

  const formatCurrency = (v: number) => `${v.toLocaleString('vi-VN')} VNĐ`;
  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // All projects view
  if (projectId === 'all') {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="flex items-center gap-3 p-4 bg-[hsl(var(--warning-glow))] border border-[hsl(var(--warning)/0.3)] text-[hsl(var(--warning))] rounded-md text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span><strong>Lưu ý:</strong> Dữ liệu chi phí mang tính tham khảo. Hạch toán chính thức cần thực hiện trên phần mềm kế toán.</span>
        </div>
        <div className="card p-5 border border-[hsl(var(--border))]">
          <h4 className="text-md font-semibold mb-4">So sánh Chi phí giữa các Dự án</h4>
          {allProjectsData.length > 0 ? (
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allProjectsData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" />
                  <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}Tr`} />
                  <RechartsTooltip formatter={(value: number) => [formatCurrency(value), 'Giá trị']} cursor={{ fill: 'hsl(var(--bg-main))' }} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="po" name="PO Đã duyệt" stackId="a" fill="hsl(var(--primary))" maxBarSize={60} />
                  <Bar dataKey="dp" name="Mua trực tiếp (khẩn cấp)" stackId="a" fill="hsl(var(--danger))" maxBarSize={60} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-10 text-center text-[hsl(var(--text-muted))]">Chưa có dữ liệu chi phí.</div>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Warning Note */}
      <div className="flex items-center gap-3 p-4 bg-[hsl(var(--warning-glow))] border border-[hsl(var(--warning)/0.3)] text-[hsl(var(--warning))] rounded-md text-sm">
        <AlertCircle size={18} className="shrink-0" />
        <span><strong>Lưu ý:</strong> Đây là báo cáo chi phí tham khảo dựa trên giá trị PO và mua ngoài khẩn cấp. Hạch toán chính thức cần phần mềm kế toán riêng.</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-l-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] flex items-center gap-4">
          <div className="p-3 bg-[hsl(var(--primary-glow))] rounded-full text-[hsl(var(--primary))]">
            <ShoppingCart size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Tổng giá trị PO</div>
            <div className="text-xl font-black mt-1">{formatCurrency(data.totalPoCost)}</div>
            <div className="text-xs text-[hsl(var(--text-muted))]">{data.purchaseOrders.length} đơn hàng</div>
          </div>
        </div>
        <div className="card p-5 border-l-4 border-l-[hsl(var(--danger))] bg-[hsl(var(--bg-main))] flex items-center gap-4">
          <div className="p-3 bg-[hsl(var(--danger-glow))] rounded-full text-[hsl(var(--danger))]">
            <AlertCircle size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Mua trực tiếp (khẩn cấp)</div>
            <div className="text-xl font-black mt-1">{formatCurrency(data.totalDirectPurchaseCost)}</div>
            <div className="text-xs text-[hsl(var(--text-muted))]">{data.directPurchases.length} đơn</div>
          </div>
        </div>
        <div className="card p-5 border-l-4 border-l-[hsl(var(--success))] bg-[hsl(var(--bg-main))] flex items-center gap-4">
          <div className="p-3 bg-[hsl(var(--success-glow))] rounded-full text-[hsl(var(--success))]">
            <DollarSign size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Tổng chi phí vật tư</div>
            <div className="text-2xl font-black text-[hsl(var(--success))] mt-1">{formatCurrency(data.totalCost)}</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {(data.totalPoCost > 0 || data.totalDirectPurchaseCost > 0) && (
        <div className="card p-5 border border-[hsl(var(--border))]">
          <h4 className="text-md font-semibold mb-4">Biểu đồ Phân bổ Chi phí</h4>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'PO Đã duyệt (Hợp lệ)', value: data.totalPoCost, color: 'hsl(var(--primary))' },
                  { name: 'Mua trực tiếp (Khẩn cấp)', value: data.totalDirectPurchaseCost, color: 'hsl(var(--danger))' }
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}Tr`} />
                <RechartsTooltip formatter={(value: number) => [formatCurrency(value), 'Giá trị']} cursor={{ fill: 'hsl(var(--bg-main))' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={100}>
                  {[{ color: 'hsl(var(--primary))' }, { color: 'hsl(var(--danger))' }].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab switch */}
      <div className="flex border-b border-[hsl(var(--border))]">
        <button
          onClick={() => setActiveTab('po')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'po' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary-hover))]' : 'border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]'}`}
        >
          <Package size={14} /> Danh sách PO ({data.purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('dp')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'dp' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary-hover))]' : 'border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]'}`}
        >
          <AlertCircle size={14} /> Mua ngoài khẩn cấp ({data.directPurchases.length})
        </button>
      </div>

      {/* PO Table */}
      {activeTab === 'po' && (
        <div className="card p-0 overflow-hidden border border-[hsl(var(--border))]">
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
            <table className="w-full text-sm text-left relative">
              <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] sticky top-0 z-10 border-b border-[hsl(var(--border))] shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold">Số PO</th>
                  <th className="px-4 py-3 font-semibold">Nhà cung cấp</th>
                  <th className="px-4 py-3 font-semibold text-right">Giá trị</th>
                  <th className="px-4 py-3 font-semibold">Ngày đặt</th>
                  <th className="px-4 py-3 font-semibold">Giao hàng dự kiến</th>
                  <th className="px-4 py-3 font-semibold text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {data.purchaseOrders.map(po => {
                  const statusInfo = PO_STATUS_LABELS[po.status] || { label: po.status, color: 'hsl(var(--text-muted))' };
                  return (
                    <tr key={po.pOId} className="hover:bg-[hsl(var(--bg-main))] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold">{po.pONumber}</td>
                      <td className="px-4 py-3">{po.supplierName || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{po.totalAmount.toLocaleString('vi-VN')} VNĐ</td>
                      <td className="px-4 py-3">{formatDate(po.orderDate)}</td>
                      <td className="px-4 py-3">{formatDate(po.expectedDeliveryDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ color: statusInfo.color, backgroundColor: `${statusInfo.color}15` }}>
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {data.purchaseOrders.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">Chưa có PO nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Direct Purchase Table */}
      {activeTab === 'dp' && (
        <div className="card p-0 overflow-hidden border border-[hsl(var(--border))]">
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
            <table className="w-full text-sm text-left relative">
              <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] sticky top-0 z-10 border-b border-[hsl(var(--border))] shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Người yêu cầu</th>
                  <th className="px-4 py-3 font-semibold text-right">Giá trị</th>
                  <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                  <th className="px-4 py-3 font-semibold text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {data.directPurchases.map(dp => (
                  <tr key={dp.directPurchaseId} className="hover:bg-[hsl(var(--bg-main))] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--text-muted))]">#{dp.directPurchaseId}</td>
                    <td className="px-4 py-3 font-medium">{dp.requestedByName}</td>
                    <td className="px-4 py-3 text-right font-semibold">{dp.totalAmount.toLocaleString('vi-VN')} VNĐ</td>
                    <td className="px-4 py-3">{formatDate(dp.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-bold text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]">
                        {DP_STATUS_LABELS[dp.status] || dp.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.directPurchases.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">Chưa có mua ngoài nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
