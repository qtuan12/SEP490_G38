import React from 'react';
import { Package, AlertTriangle, ArrowDownToLine } from 'lucide-react';

interface InventoryOverviewCardsProps {
  totalMaterials: number;
  lowStockCount: number;
  inStockCount: number;
}

export const InventoryOverviewCards: React.FC<InventoryOverviewCardsProps> = ({
  totalMaterials,
  lowStockCount,
  inStockCount
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1: Tổng số loại vật tư */}
      <div className="glass-panel p-4 flex items-center justify-between border border-slate-100 bg-white shadow-sm rounded-xl text-left">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tổng số loại vật tư</span>
          <strong className="text-2xl font-extrabold text-slate-900 mt-1">{totalMaterials}</strong>
        </div>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
          <Package size={22} />
        </div>
      </div>

      {/* Card 2: Vật tư sắp hết kho */}
      <div className="glass-panel p-4 flex items-center justify-between border border-slate-100 bg-white shadow-sm rounded-xl text-left">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Vật tư sắp hết kho</span>
          <strong className={`text-2xl font-extrabold mt-1 ${lowStockCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-900'}`}>
            {lowStockCount}
          </strong>
        </div>
        <div className={`p-3 rounded-xl ${lowStockCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
          <AlertTriangle size={22} />
        </div>
      </div>

      {/* Card 3: Mặt hàng đang có sẵn tồn kho */}
      <div className="glass-panel p-4 flex items-center justify-between border border-slate-100 bg-white shadow-sm rounded-xl text-left">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Mặt hàng tồn kho</span>
          <strong className="text-2xl font-extrabold text-slate-900 mt-1">{inStockCount}</strong>
        </div>
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
          <ArrowDownToLine size={22} />
        </div>
      </div>
    </div>
  );
};
