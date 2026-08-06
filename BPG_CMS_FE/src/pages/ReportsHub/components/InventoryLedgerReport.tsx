import React, { useEffect, useState } from 'react';
import { Warehouse, TrendingDown, TrendingUp, Filter } from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui';
import { reportService, type InventoryLedgerReportDto, type InventoryTransactionSummaryDto } from '../../../services/reportService';
import { parseDateSafe } from '../../../utils/dateHelpers';

interface Props {
  projectId: string | null;
}

const TRANSACTION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  GoodsReceipt: { label: '📥 Nhập kho (GR)', color: 'hsl(var(--success))' },
  MaterialIssuance: { label: '📤 Xuất kho', color: 'hsl(var(--danger))' },
  Adjustment: { label: '⚙️ Điều chỉnh', color: 'hsl(var(--warning))' },
  Transfer: { label: '🔄 Chuyển kho', color: 'hsl(var(--primary))' },
  GoodsReceiptReversal: { label: '↩️ Hoàn nhập', color: 'hsl(var(--text-muted))' },
  DirectPurchase: { label: '🛒 Mua trực tiếp', color: 'hsl(var(--primary-hover))' },
  SurplusReturn: { label: '↩️ Hoàn trả', color: 'hsl(var(--text-muted))' },
  SurplusLiquidation: { label: '🗑️ Thanh lý', color: 'hsl(var(--danger))' },
};

export const InventoryLedgerReport: React.FC<Props> = ({ projectId }) => {
  const [data, setData] = useState<InventoryLedgerReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'ledger'>('stock');
  const [materialFilter, setMaterialFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!projectId || projectId === 'all') { setData(null); return; }
    setLoading(true);
    reportService.getInventoryLedger(Number(projectId))
      .then(setData)
      .catch(err => console.error('Error fetching inventory ledger', err))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (projectId === 'all') {
    return <div className="p-10 text-center text-[hsl(var(--text-muted))]">Báo cáo kho chỉ xem được theo từng dự án cụ thể.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <LoadingSpinner size="md" label="Đang tải Sổ cái Kho..." />
      </div>
    );
  }

  if (!data) return null;

  const filteredStock = data.currentStock.filter(s =>
    !materialFilter || s.materialName.toLowerCase().includes(materialFilter.toLowerCase()) ||
    s.materialCode.toLowerCase().includes(materialFilter.toLowerCase())
  );

  const uniqueTypes = [...new Set(data.transactions.map(t => t.referenceType))];
  const filteredTransactions: InventoryTransactionSummaryDto[] = data.transactions.filter(t => {
    if (typeFilter !== 'all' && t.referenceType !== typeFilter) return false;
    if (materialFilter && !t.materialName.toLowerCase().includes(materialFilter.toLowerCase()) &&
      !t.materialCode.toLowerCase().includes(materialFilter.toLowerCase())) return false;
    return true;
  });

  const formatDate = (d: string) =>
    parseDateSafe(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getTypeInfo = (type: string) =>
    TRANSACTION_TYPE_LABELS[type] || { label: type, color: 'hsl(var(--text-muted))' };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 border-l-4 border-l-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] flex items-center gap-3">
          <div className="p-2 bg-[hsl(var(--primary-glow))] rounded-full text-[hsl(var(--primary))]">
            <Warehouse size={18} />
          </div>
          <div>
            <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Tổng loại VT</div>
            <div className="text-2xl font-black">{data.totalMaterialTypes}</div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-[hsl(var(--success))] bg-[hsl(var(--bg-main))] flex items-center gap-3">
          <div className="p-2 bg-[hsl(var(--success-glow))] rounded-full text-[hsl(var(--success))]">
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Có tồn kho</div>
            <div className="text-2xl font-black text-[hsl(var(--success))]">{data.totalMaterialTypes - data.zeroStockCount}</div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-l-[hsl(var(--danger))] bg-[hsl(var(--bg-main))] flex items-center gap-3">
          <div className="p-2 bg-[hsl(var(--danger-glow))] rounded-full text-[hsl(var(--danger))]">
            <TrendingDown size={18} />
          </div>
          <div>
            <div className="text-xs text-[hsl(var(--text-muted))] font-semibold uppercase">Tồn kho</div>
            <div className="text-2xl font-black text-[hsl(var(--danger))]">{data.zeroStockCount}</div>
          </div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Tìm theo mã VT, tên VT..."
          value={materialFilter}
          onChange={e => setMaterialFilter(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-[hsl(var(--border))] rounded text-sm bg-[hsl(var(--bg-main))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
        />
        {activeTab === 'ledger' && (
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[hsl(var(--text-muted))]" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-[hsl(var(--border))] rounded text-sm bg-[hsl(var(--bg-main))] focus:outline-none"
            >
              <option value="all">Tất cả loại GD</option>
              {uniqueTypes.map(t => (
                <option key={t} value={t}>{getTypeInfo(t).label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab Switch */}
      <div className="flex border-b border-[hsl(var(--border))]">
        {(['stock', 'ledger'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab
              ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary-hover))]'
              : 'border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]'}`}
          >
            {tab === 'stock' ? `📦 Tồn kho hiện tại (${filteredStock.length})` : `📋 Sổ cái giao dịch (${filteredTransactions.length})`}
          </button>
        ))}
      </div>

      {/* Current Stock Tab */}
      {activeTab === 'stock' && (
        <div className="card p-0 overflow-hidden border border-[hsl(var(--border))]">
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
            <table className="w-full text-sm text-left relative">
              <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] sticky top-0 z-10 border-b border-[hsl(var(--border))] shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mã VT</th>
                  <th className="px-4 py-3 font-semibold">Tên vật tư</th>
                  <th className="px-4 py-3 font-semibold">ĐVT</th>
                  <th className="px-4 py-3 font-semibold text-right">Tồn kho hiện tại</th>
                  <th className="px-4 py-3 font-semibold text-center">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {filteredStock.map(item => (
                  <tr key={item.materialId} className={`hover:bg-[hsl(var(--bg-main))] transition-colors ${item.currentQuantity === 0 ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--text-muted))]">{item.materialCode}</td>
                    <td className="px-4 py-3 font-medium">{item.materialName}</td>
                    <td className="px-4 py-3">{item.unitName}</td>
                    <td className="px-4 py-3 text-right font-bold text-lg">{item.currentQuantity.toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3 text-center">
                      {item.currentQuantity > 0
                        ? <span className="text-[hsl(var(--success))] text-xs font-bold">CÒN HÀNG</span>
                        : <span className="text-[hsl(var(--text-muted))] text-xs font-bold">HẾT HÀNG</span>
                      }
                    </td>
                  </tr>
                ))}
                {filteredStock.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">Không có dữ liệu.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ledger Tab */}
      {activeTab === 'ledger' && (
        <div className="card p-0 overflow-hidden border border-[hsl(var(--border))]">
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
            <table className="w-full text-sm text-left relative">
              <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] sticky top-0 z-10 border-b border-[hsl(var(--border))] shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold">Ngày GD</th>
                  <th className="px-4 py-3 font-semibold">Vật tư</th>
                  <th className="px-4 py-3 font-semibold text-right">Số lượng</th>
                  <th className="px-4 py-3 font-semibold text-right">Tồn sau GD</th>
                  <th className="px-4 py-3 font-semibold">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {filteredTransactions.map(tx => {
                  const isPositive = tx.quantityChange > 0;
                  return (
                    <tr key={tx.transactionId} className="hover:bg-[hsl(var(--bg-main))] transition-colors">
                      <td className="px-4 py-3 text-xs text-[hsl(var(--text-muted))]">{formatDate(tx.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{tx.materialName}</div>
                        <div className="text-xs text-[hsl(var(--text-muted))]">{tx.materialCode}</div>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${isPositive ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}`}>
                        {isPositive ? '+' : ''}{tx.quantityChange.toLocaleString('vi-VN')} {tx.unitName}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{tx.balanceAfter.toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-xs">{tx.createdByName || '—'}</td>
                    </tr>
                  );
                })}
                {filteredTransactions.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">Không có giao dịch nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
