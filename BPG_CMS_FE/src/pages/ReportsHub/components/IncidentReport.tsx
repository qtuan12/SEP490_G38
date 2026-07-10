import React, { useEffect, useState } from 'react';
import { Loader2, AlertOctagon, CheckCircle, AlertTriangle, Wrench, Construction } from 'lucide-react';
import { reportService, type IncidentReportDto } from '../../../services/reportService';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  projectId: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  Reported: 'Đã báo cáo',
  UnderReview: 'Đang xem xét',
  AssessmentCompleted: 'Đã đánh giá',
  WaitingReview: 'Chờ duyệt',
  WaitingAccountant: 'Chờ kế toán',
  Resolved: 'Đã giải quyết',
  Closed: 'Đã đóng',
};

const TYPE_LABELS: Record<string, string> = {
  Construction: 'Thi công',
  Material: 'Vật tư kho',
  Safety: 'An toàn',
  InventoryDamage: 'Hư hỏng vật tư',
};

export const IncidentReport: React.FC<Props> = ({ projectId }) => {
  const [data, setData] = useState<IncidentReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!projectId || projectId === 'all') { setData(null); return; }
    setLoading(true);
    reportService.getIncidentReport(Number(projectId))
      .then(setData)
      .catch(err => console.error('Error fetching incident report', err))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (projectId === 'all') {
    return <div className="p-10 text-center text-[hsl(var(--text-muted))]">Báo cáo sự cố chỉ xem được theo từng dự án cụ thể.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải Báo cáo Sự cố...</span>
      </div>
    );
  }

  if (!data) return null;

  const resolvedStatuses = ['Resolved', 'Closed'];

  const filteredIncidents = data.incidents.filter(i => {
    const isOpen = !resolvedStatuses.includes(i.status);
    if (filter === 'open' && !isOpen) return false;
    if (filter === 'resolved' && isOpen) return false;
    if (search && !i.description.toLowerCase().includes(search.toLowerCase()) &&
      !i.reporterName.toLowerCase().includes(search.toLowerCase())) return false;
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

  const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--danger))', 'hsl(var(--warning))'];

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const getStatusBadge = (status: string) => {
    const isResolved = resolvedStatuses.includes(status);
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${isResolved
        ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]'
        : 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]'}`}>
        {STATUS_LABELS[status] || status}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-l-[hsl(var(--danger))] bg-[hsl(var(--bg-main))]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[hsl(var(--danger-glow))] rounded-full text-[hsl(var(--danger))]">
              <AlertOctagon size={18} />
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Tổng sự cố</div>
              <div className="text-2xl font-black">{data.totalIncidents}</div>
            </div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-[hsl(var(--warning))] bg-[hsl(var(--bg-main))]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[hsl(var(--warning-glow))] rounded-full text-[hsl(var(--warning))]">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Đang mở</div>
              <div className="text-2xl font-black text-[hsl(var(--warning))]">{data.openIncidents}</div>
            </div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-[hsl(var(--success))] bg-[hsl(var(--bg-main))]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[hsl(var(--success-glow))] rounded-full text-[hsl(var(--success))]">
              <CheckCircle size={18} />
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Đã giải quyết</div>
              <div className="text-2xl font-black text-[hsl(var(--success))]">{data.resolvedIncidents}</div>
            </div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-[hsl(var(--primary))] bg-[hsl(var(--bg-main))]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[hsl(var(--primary-glow))] rounded-full text-[hsl(var(--primary))]">
              <Wrench size={18} />
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Có Rework Task</div>
              <div className="text-2xl font-black text-[hsl(var(--primary))]">{data.incidentsWithRework}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart + Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-5">
        {/* Pie Chart */}
        {typeDist.length > 0 && (
          <div className="card p-5 border border-[hsl(var(--border))]">
            <h4 className="text-sm font-semibold mb-3 text-[hsl(var(--text-primary))]">Phân loại Sự cố</h4>
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

        {/* Filters */}
        <div className="card p-5 border border-[hsl(var(--border))] flex flex-col gap-4">
          <h4 className="text-sm font-semibold text-[hsl(var(--text-primary))]">Bộ lọc</h4>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'open', 'resolved'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-sm font-semibold border transition-colors ${filter === f
                  ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
                  : 'bg-transparent border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-main))]'}`}
              >
                {f === 'all' ? 'Tất cả' : f === 'open' ? 'Đang mở' : 'Đã xử lý'}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm theo mô tả, người báo cáo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-[hsl(var(--border))] rounded text-sm bg-[hsl(var(--bg-main))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
          />
          <div className="text-xs text-[hsl(var(--text-muted))]">
            Hiển thị <strong>{filteredIncidents.length}</strong> / {data.totalIncidents} sự cố
          </div>
        </div>
      </div>

      {/* Incident Table */}
      <div className="card p-0 overflow-hidden border border-[hsl(var(--border))]">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-sm text-left relative">
            <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] sticky top-0 z-10 border-b border-[hsl(var(--border))] shadow-sm">
              <tr>
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Loại</th>
                <th className="px-4 py-3 font-semibold">Mô tả</th>
                <th className="px-4 py-3 font-semibold">Phase / Task</th>
                <th className="px-4 py-3 font-semibold">Thiệt hại ước tính</th>
                <th className="px-4 py-3 font-semibold">Rework</th>
                <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                <th className="px-4 py-3 font-semibold text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {filteredIncidents.map(i => (
                <tr key={i.incidentId} className="hover:bg-[hsl(var(--bg-main))] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--text-muted))]">#{i.incidentId}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-[hsl(var(--bg-main))] text-xs font-semibold border border-[hsl(var(--border))]">
                      {TYPE_LABELS[i.incidentType] || i.incidentType}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <div className="truncate" title={i.description}>{i.description}</div>
                    <div className="text-xs text-[hsl(var(--text-muted))]">{i.reporterName}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {i.phaseName && <div className="font-medium">{i.phaseName}</div>}
                    {i.taskName && <div className="text-[hsl(var(--text-muted))]">{i.taskName}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {i.estimatedMaterialLoss != null && (
                      <div>{i.estimatedMaterialLoss.toLocaleString('vi-VN')} VNĐ</div>
                    )}
                    {i.estimatedDelayDays != null && (
                      <div className="text-[hsl(var(--warning))]">{i.estimatedDelayDays} ngày trễ</div>
                    )}
                    {i.estimatedMaterialLoss == null && i.estimatedDelayDays == null && '—'}
                  </td>
                  <td className="px-4 py-3">
                    {i.hasReworkTask ? (
                      <span className="text-[hsl(var(--primary))] text-xs font-semibold flex items-center gap-1">
                        <Construction size={12} />
                        {i.reworkTaskName || 'Có'}
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--text-muted))] text-xs">Không</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDate(i.createdAt)}</td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(i.status)}</td>
                </tr>
              ))}
              {filteredIncidents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">Không có sự cố nào phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
