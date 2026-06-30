import React, { useState } from 'react';
import { Search, AlertTriangle, AlertCircle, CheckCircle2, Info, ChevronDown, ChevronRight } from 'lucide-react';
import type { CurrentInventory } from '../../../types/inventory';

interface CurrentStockTabProps {
  inventoryList: CurrentInventory[];
}

export const CurrentStockTab: React.FC<CurrentStockTabProps> = ({ inventoryList }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItemIds, setExpandedItemIds] = useState<Record<number, boolean>>({});

  // Lọc vật tư theo từ khóa tìm kiếm (Client-side)
  const filteredInventory = inventoryList.filter(
    item =>
      item.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.materialCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleExpand = (itemId: number) => {
    setExpandedItemIds(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const getStatusBadge = (item: CurrentInventory) => {
    const available = item.availableQuantity;
    const safety = item.safetyThreshold;
    const boq = item.boqQuantity || 0;
    const used = item.usedQuantity || 0;

    // Rule 4: Over BOQ (Đỏ) - Ưu tiên hàng đầu
    if ((boq > 0 && used >= boq) || (boq === 0 && used > 0)) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span 
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200" 
            title="Đã dùng vượt mức kế hoạch dự án. Mọi yêu cầu cấp phát mới cần Giám đốc duyệt."
          >
            <AlertCircle size={12} />
            <span>Đã vượt định mức (BOQ)</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Đã dùng: {used} / BOQ: {boq}
          </span>
        </div>
      );
    }

    // Rule 3: Approaching Limit (Cam)
    if (boq > 0 && used >= 0.8 * boq && used < boq) {
      const percent = Math.round((used / boq) * 100);
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span 
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200" 
            title="Lượng sử dụng sắp đạt giới hạn trần. Cần kiểm soát xuất kho chặt chẽ."
          >
            <Info size={12} />
            <span>Sắp vượt BOQ ({percent}%)</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Đã dùng: {used} / BOQ: {boq}
          </span>
        </div>
      );
    }

    // Rule 2: Low Stock (Vàng)
    if (available <= safety) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span 
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200" 
            title="Số lượng khả dụng chạm ngưỡng an toàn. Cần đề xuất nhập kho bổ sung."
          >
            <AlertTriangle size={12} />
            <span>Tồn kho thấp</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Khả dụng &le; Ngưỡng an toàn ({safety})
          </span>
        </div>
      );
    }

    // Rule 1: Stable (Xanh lá)
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} />
          <span>Bình thường</span>
        </span>
        <span className="text-[10px] text-slate-400 font-medium">
          Tồn kho & sử dụng an toàn
        </span>
      </div>
    );
  };

  const getRowBgClass = (item: CurrentInventory) => {
    const available = item.availableQuantity;
    const safety = item.safetyThreshold;
    const boq = item.boqQuantity || 0;
    const used = item.usedQuantity || 0;

    if ((boq > 0 && used >= boq) || (boq === 0 && used > 0)) {
      return 'bg-rose-50/10 hover:bg-rose-50/20';
    }
    if (boq > 0 && used >= 0.8 * boq && used < boq) {
      return 'bg-orange-50/10 hover:bg-orange-50/20';
    }
    if (available <= safety) {
      return 'bg-amber-50/20 hover:bg-amber-50/40';
    }
    return 'hover:bg-slate-50';
  };

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
              <th className="w-10 px-3"></th>
              <th className="px-4 py-3">Mã vật tư</th>
              <th className="px-4 py-3">Tên vật tư</th>
              <th className="px-4 py-3">Thông số</th>
              <th className="px-4 py-3 text-right">Tồn thực tế</th>
              <th className="px-4 py-3 text-right">Tạm khóa</th>
              <th className="px-4 py-3 text-right">Khả dụng</th>
              <th className="px-4 py-3 text-center">Cảnh báo tồn kho</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Không tìm thấy vật tư nào trong kho dự án.
                </td>
              </tr>
            ) : (
              filteredInventory.map(item => {
                const rowBg = getRowBgClass(item);
                const isExpanded = !!expandedItemIds[item.inventoryId];
                return (
                  <React.Fragment key={item.inventoryId}>
                    <tr className={`transition-colors ${rowBg}`}>
                      <td className="px-3 py-3.5 text-center">
                        <button
                          onClick={() => toggleExpand(item.inventoryId)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Xem chi tiết sử dụng theo Phase"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
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
                        {getStatusBadge(item)}
                      </td>
                    </tr>

                    {/* Hàng con hiển thị báo cáo chênh lệch các phase khi nhấn expand */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={8} className="px-8 py-3.5 border-b border-slate-200">
                          <div className="flex flex-col gap-2.5">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Info size={14} className="text-blue-500" />
                              <span>Chi tiết sử dụng vật tư theo từng Giai đoạn (Phases)</span>
                            </div>

                            {!item.phaseUsages || item.phaseUsages.length === 0 ? (
                              <span className="text-xs text-slate-400 italic">
                                Vật tư này chưa được lập định mức hoặc xuất dùng ở giai đoạn nào.
                              </span>
                            ) : (
                              <div className="overflow-hidden border border-slate-200 rounded-lg bg-white max-w-3xl shadow-sm">
                                <table className="min-w-full divide-y divide-slate-150 text-left text-xs">
                                  <thead className="bg-slate-50 font-semibold text-slate-600 uppercase text-[10px] tracking-wider">
                                    <tr>
                                      <th className="px-3 py-2.5">Tên giai đoạn</th>
                                      <th className="px-3 py-2.5 text-right">Định mức (BOQ)</th>
                                      <th className="px-3 py-2.5 text-right">Đã xuất dùng</th>
                                      <th className="px-3 py-2.5 text-right">Tỷ lệ</th>
                                      <th className="px-3 py-2.5 text-center">Trạng thái</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {item.phaseUsages.map(phase => {
                                      const ratio = phase.boqQuantity > 0 ? (phase.usedQuantity / phase.boqQuantity) : 0;
                                      const percent = phase.boqQuantity > 0 ? Math.round(ratio * 100) : 0;

                                      let statusBadge = (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          An toàn
                                        </span>
                                      );

                                      if ((phase.boqQuantity > 0 && phase.usedQuantity >= phase.boqQuantity) || (phase.boqQuantity === 0 && phase.usedQuantity > 0)) {
                                        statusBadge = (
                                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                            Vượt định mức
                                          </span>
                                        );
                                      } else if (phase.boqQuantity > 0 && ratio >= 0.8) {
                                        statusBadge = (
                                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                                            Sắp vượt ({percent}%)
                                          </span>
                                        );
                                      }

                                      return (
                                        <tr key={phase.phaseId} className="hover:bg-slate-50/50">
                                          <td className="px-3 py-2 font-semibold text-slate-800">
                                            {phase.phaseName}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {phase.boqQuantity} <span className="text-[10px] text-slate-400">{item.unitName}</span>
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-slate-900">
                                            {phase.usedQuantity} <span className="text-[10px] text-slate-400">{item.unitName}</span>
                                          </td>
                                          <td className="px-3 py-2 text-right text-slate-500 font-mono">
                                            {phase.boqQuantity > 0 ? `${percent}%` : 'N/A'}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            {statusBadge}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
