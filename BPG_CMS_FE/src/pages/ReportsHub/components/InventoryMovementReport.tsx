import React, { useState, useEffect, useMemo, useRef } from 'react';
import { reportService, type InventoryMovementReportDto } from '../../../services/reportService';
import { Layers } from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui';

interface Props {
  projectId: string;
  fromDate?: string;
  toDate?: string;
}

export const InventoryMovementReport: React.FC<Props> = ({ projectId, fromDate, toDate }) => {
  const numProjectId = projectId === 'all' ? 0 : Number(projectId);
  const requestIdentity = useMemo(
    () => ({ numProjectId, fromDate, toDate }),
    [numProjectId, fromDate, toDate],
  );
  const [loadState, setLoadState] = useState<{
    requestIdentity: object;
    data: InventoryMovementReportDto | null;
    error: string | null;
  } | null>(null);
  const requestIdRef = useRef(0);

  const isCurrentResult = loadState?.requestIdentity === requestIdentity;
  const data = isCurrentResult ? loadState.data : null;
  const error = isCurrentResult ? loadState.error : null;
  const loading = !isCurrentResult;

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    reportService.getInventoryMovement(requestIdentity.numProjectId, {
      fromDate: requestIdentity.fromDate,
      toDate: requestIdentity.toDate,
    })
      .then(report => {
        if (requestId === requestIdRef.current) {
          setLoadState({ requestIdentity, data: report, error: null });
        }
      })
      .catch(err => {
        if (requestId !== requestIdRef.current) return;
        console.error('Error fetching inventory movement report', err);
        setLoadState({
          requestIdentity,
          data: null,
          error: err instanceof Error ? err.message : 'Không thể tải báo cáo biến động tồn kho.',
        });
      });

    return () => {
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
    };
  }, [requestIdentity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="md" label="Đang tải báo cáo biến động tồn kho..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 text-center text-red-500 font-semibold bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))] rounded-xl m-4">
        {error}
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

  return (
    <div className="p-4 flex flex-col gap-6 animate-fade-in">
      {/* Quantities with different units must not be added together. */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1.5">
            <Layers size={14} /> Tổng chủng loại trong báo cáo
          </span>
          <span className="text-xl font-bold text-slate-800">{data.totalMaterials.toLocaleString('vi-VN')}</span>
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
