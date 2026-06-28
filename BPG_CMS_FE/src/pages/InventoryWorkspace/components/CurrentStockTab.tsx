import React, { useState } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import type { CurrentInventory } from '../../../types/inventory';

interface CurrentStockTabProps {
  inventoryList: CurrentInventory[];
}

export const CurrentStockTab: React.FC<CurrentStockTabProps> = ({ inventoryList }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Lọc vật tư theo từ khóa tìm kiếm (Client-side)
  const filteredInventory = inventoryList.filter(
    item =>
      item.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.materialCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Thanh tìm kiếm */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm kiếm vật tư theo tên hoặc mã..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Bảng danh sách tồn kho */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Mã vật tư</th>
              <th className="px-4 py-3">Tên vật tư</th>
              <th className="px-4 py-3">Quy cách</th>
              <th className="px-4 py-3 text-right">Tồn thực tế</th>
              <th className="px-4 py-3 text-right">Đang đóng băng</th>
              <th className="px-4 py-3 text-right">Khả dụng</th>
              <th className="px-4 py-3 text-center">Trạng thái kho</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Không tìm thấy vật tư nào trong kho dự án.
                </td>
              </tr>
            ) : (
              filteredInventory.map(item => {
                const isUnderThreshold = item.availableQuantity < item.safetyThreshold;
                return (
                  <tr
                    key={item.inventoryId}
                    className={`hover:bg-slate-50 transition-colors ${
                      isUnderThreshold ? 'bg-amber-50/40 hover:bg-amber-50/70' : ''
                    }`}
                  >
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                      {item.materialCode}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {item.materialName}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {item.specification || 'N/A'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                      {item.quantity} <span className="text-xs text-slate-400 font-normal">{item.unitName}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-500">
                      {item.reservedQuantity > 0 ? (
                        <span className="text-rose-600 font-medium">-{item.reservedQuantity}</span>
                      ) : (
                        '0'
                      )}{' '}
                      <span className="text-xs text-slate-400 font-normal">{item.unitName}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                      {item.availableQuantity} <span className="text-xs text-slate-400 font-normal">{item.unitName}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {isUnderThreshold ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle size={12} />
                          <span>Dưới hạn an toàn ({item.safetyThreshold})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          An toàn
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
