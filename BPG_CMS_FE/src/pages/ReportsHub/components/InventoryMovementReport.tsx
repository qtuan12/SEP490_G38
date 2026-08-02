import React, { useState, useEffect } from 'react';
import { reportService, type InventoryMovementReportDto } from '../../../services/reportService';
import { Loader2, ArrowUpRight, ArrowDownLeft, RefreshCw, Layers } from 'lucide-react';

interface Props {
  projectId: string;
  fromDate?: string;
  toDate?: string;
}

export const InventoryMovementReport: React.FC<Props> = ({ projectId, fromDate, toDate }) => {
  const [data, setData] = useState<InventoryMovementReportDto | null>(null);
  const [loading, setLoading] = useState(true);

  const numProjectId = projectId === 'all' ? 0 : Number(projectId);

  useEffect(() => {
    setLoading(true);
    reportService.getInventoryMovement(numProjectId, { fromDate, toDate })
      .then(res => setData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [numProjectId, fromDate, toDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] gap-2 text-[hsl(var(--text-muted))]">
        <Loader2 className="animate-spin" size={20} />
        <span>Đang tải báo cáo biến động tồn kho...</span>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="p-10 text-center text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))] rounded-xl m-4">
        Không có dữ liệu biến động tồn kho trong kỳ.
      </div>
    );
  }

  const totalOpening = data.items.reduce((sum, item) => sum + item.openingBalance, 0);
  const totalReceived = data.items.reduce((sum, item) => sum + item.totalReceived, 0);
  const totalIssued = data.items.reduce((sum, item) => sum + item.totalIssued, 0);
  const totalClosing = data.items.reduce((sum, item) => sum + item.closingBalance, 0);

  return (
    <div className="p-4 flex flex-col gap-6 animate-fade-in">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1.5">
            <Layers size={14} /> Tồn đầu kỳ
          </span>
          <span className="text-xl font-bold text-slate-800">{totalOpening.toLocaleString()}</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider font-semibold text-emerald-600 flex items-center gap-1.5">
            <ArrowDownLeft size={14} /> Tổng nhập trong kỳ
          </span>
          <span className="text-xl font-bold text-emerald-700">+{totalReceived.toLocaleString()}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider font-semibold text-amber-600 flex items-center gap-1.5">
            <ArrowUpRight size={14} /> Tổng xuất trong kỳ
          </span>
          <span className="text-xl font-bold text-amber-700">-{totalIssued.toLocaleString()}</span>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider font-semibold text-blue-600 flex items-center gap-1.5">
            <RefreshCw size={14} /> Tồn cuối kỳ
          </span>
          <span className="text-xl font-bold text-blue-800">{totalClosing.toLocaleString()}</span>
        </div>
      </div>

      {/* Movement Table */}
      <div className="bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[hsl(var(--border))] font-semibold text-sm">
          Bảng biến động và đối soát tồn kho theo vật tư ({data.totalMaterials} chủng loại)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--border))]">
              <tr>
                <th className="px-4 py-3 font-medium">Mã VT</th>
                <th className="px-4 py-3 font-medium">Tên vật tư</th>
                <th className="px-4 py-3 font-medium text-center">ĐVT</th>
                <th className="px-4 py-3 font-medium text-right">Tồn đầu kỳ</th>
                <th className="px-4 py-3 font-medium text-right text-emerald-600">Nhập</th>
                <th className="px-4 py-3 font-medium text-right text-amber-600">Xuất</th>
                <th className="px-4 py-3 font-medium text-right">Trả lại</th>
                <th className="px-4 py-3 font-medium text-right">ĐC / Điều chuyển</th>
                <th className="px-4 py-3 font-medium text-right font-bold">Tồn cuối kỳ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {data.items.map(item => (
                <tr key={item.materialId} className="hover:bg-[hsl(var(--bg-main))]/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{item.materialCode}</td>
                  <td className="px-4 py-3 font-medium text-[hsl(var(--primary-hover))]">{item.materialName}</td>
                  <td className="px-4 py-3 text-center text-[hsl(var(--text-muted))]">{item.unitName}</td>
                  <td className="px-4 py-3 text-right">{item.openingBalance.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">+{item.totalReceived.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-amber-600 font-medium">-{item.totalIssued.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{item.totalReturned > 0 ? `+${item.totalReturned.toLocaleString()}` : '0'}</td>
                  <td className="px-4 py-3 text-right">
                    {(item.totalTransferredIn - item.totalTransferredOut + item.totalAdjustments).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{item.closingBalance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
