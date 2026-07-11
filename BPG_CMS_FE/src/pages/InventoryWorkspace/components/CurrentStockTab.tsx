import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, AlertCircle, CheckCircle2, Info, ChevronDown, ChevronRight, Download } from 'lucide-react';
import type { CurrentInventory } from '../../../types/inventory';
import { Pagination } from '../../../components/ui';

interface CurrentStockTabProps {
  inventoryList: CurrentInventory[];
}

export const CurrentStockTab: React.FC<CurrentStockTabProps> = ({ inventoryList }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'over_boq' | 'approaching' | 'low_stock' | 'stable'>('all');
  const [expandedItemIds, setExpandedItemIds] = useState<Record<number, boolean>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);


  // Định dạng số lượng theo chuẩn tiếng Việt
  const formatQty = (num: number): string => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
  };

  // Định dạng đơn giá và thành tiền tiền tệ Việt Nam
  const formatPrice = (num: number): string => {
    if (num === undefined || num === null || num === 0) return '0 ₫';
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  // Xác định trạng thái cảnh báo của từng vật tư
  const getItemStatus = (item: CurrentInventory): 'over_boq' | 'approaching' | 'low_stock' | 'stable' => {
    const available = item.availableQuantity;
    const safety = item.safetyThreshold;
    const boq = item.boqQuantity || 0;
    const used = item.usedQuantity || 0;

    if ((boq > 0 && used >= boq) || (boq === 0 && used > 0)) {
      return 'over_boq';
    }
    if (boq > 0 && used >= 0.8 * boq && used < boq) {
      return 'approaching';
    }
    if (available <= safety) {
      return 'low_stock';
    }
    return 'stable';
  };

  // Lọc vật tư theo từ khóa tìm kiếm và trạng thái cảnh báo
  const filteredInventory = inventoryList.filter(item => {
    const matchesSearch =
      item.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.materialCode.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return getItemStatus(item) === statusFilter;
  });

  const toggleExpand = (itemId: number) => {
    setExpandedItemIds(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Xuất báo cáo CSV Tiếng Việt có hỗ trợ BOM để Excel đọc chuẩn font chữ
  const exportToCSV = () => {
    const headers = [
      'Mã vật tư', 
      'Tên vật tư', 
      'Thông số kỹ thuật', 
      'Nhà cung cấp gần nhất', 
      'Tồn kho thực tế', 
      'Tạm khóa (Reserved)', 
      'Tồn khả dụng', 
      'Đơn vị tính', 
      'Đơn giá mua trung bình', 
      'Tổng giá trị tồn kho', 
      'Cập nhật cuối', 
      'Cảnh báo'
    ];

    const rows = filteredInventory.map(item => {
      let statusLabel = 'Bình thường';
      const status = getItemStatus(item);
      if (status === 'over_boq') statusLabel = 'Đã vượt định mức';
      else if (status === 'approaching') statusLabel = 'Sắp vượt định mức';
      else if (status === 'low_stock') statusLabel = 'Tồn kho thấp';

      return [
        `"${item.materialCode}"`,
        `"${item.materialName}"`,
        `"${item.specification || 'Chưa cập nhật'}"`,
        `"${item.supplierName}"`,
        item.quantity,
        item.reservedQuantity,
        item.availableQuantity,
        `"${item.unitName}"`,
        item.avgUnitPrice || 0,
        item.stockValue || 0,
        item.lastUpdated ? new Date(item.lastUpdated).toLocaleString('vi-VN') : 'Chưa cập nhật',
        `"${statusLabel}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bao_cao_ton_kho_du_an.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (item: CurrentInventory) => {
    const available = item.availableQuantity;
    const safety = item.safetyThreshold;
    const boq = item.boqQuantity || 0;
    const used = item.usedQuantity || 0;
    const percent = boq > 0 ? Math.min(Math.round((used / boq) * 100), 100) : 0;

    if ((boq > 0 && used >= boq) || (boq === 0 && used > 0)) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span 
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200" 
            title="Đã dùng vượt mức kế hoạch dự án. Mọi yêu cầu cấp phát mới cần Giám đốc duyệt."
          >
            <AlertCircle size={12} />
            <span>Đã vượt định mức</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Đã dùng: {formatQty(used)} / Định mức: {formatQty(boq)}
          </span>
          {boq > 0 && (
            <div className="w-24 bg-rose-100 h-1 rounded-full overflow-hidden mt-1" title={`Đã dùng ${Math.round((used / boq) * 100)}% định mức`}>
              <div className="bg-rose-500 h-full rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
          )}
        </div>
      );
    }

    if (boq > 0 && used >= 0.8 * boq && used < boq) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span 
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200" 
            title="Lượng sử dụng sắp đạt giới hạn trần. Cần kiểm soát xuất kho chặt chẽ."
          >
            <Info size={12} />
            <span>Sắp vượt định mức ({percent}%)</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Đã dùng: {formatQty(used)} / Định mức: {formatQty(boq)}
          </span>
          <div className="w-24 bg-orange-100 h-1 rounded-full overflow-hidden mt-1" title={`Đã dùng ${percent}% định mức`}>
            <div className="bg-orange-500 h-full rounded-full" style={{ width: `${percent}%` }}></div>
          </div>
        </div>
      );
    }

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
            Khả dụng &le; Ngưỡng an toàn ({formatQty(safety)})
          </span>
          {boq > 0 && (
            <div className="w-24 bg-slate-100 h-1 rounded-full overflow-hidden mt-1" title={`Đã dùng ${percent}% định mức`}>
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percent}%` }}></div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} />
          <span>Bình thường</span>
        </span>
        <span className="text-[10px] text-slate-400 font-medium">
          Tồn kho & sử dụng an toàn
        </span>
        {boq > 0 && (
          <div className="w-24 bg-slate-100 h-1 rounded-full overflow-hidden mt-1" title={`Đã dùng ${percent}% định mức`}>
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percent}%` }}></div>
          </div>
        )}
      </div>
    );
  };

  const getRowBgClass = (item: CurrentInventory) => {
    const status = getItemStatus(item);
    if (status === 'over_boq') return 'bg-rose-50/10 hover:bg-rose-50/20';
    if (status === 'approaching') return 'bg-orange-50/10 hover:bg-orange-50/20';
    if (status === 'low_stock') return 'bg-amber-50/20 hover:bg-amber-50/40';
    return 'hover:bg-slate-50';
  };

  const totalPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);
  const paginatedInventory = filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4">
      {/* Tìm kiếm & Bộ lọc trạng thái & Xuất Excel */}
      <div className="flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm vật tư theo tên hoặc mã..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bộ lọc Dropdown Trạng thái & Nút Xuất Excel */}
        <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 justify-end flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cảnh báo:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="text-xs text-slate-700 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
            >
              <option value="all">Tất cả ({inventoryList.length})</option>
              <option value="over_boq">Đã vượt định mức ({inventoryList.filter(i => getItemStatus(i) === 'over_boq').length})</option>
              <option value="approaching">Sắp vượt định mức ({inventoryList.filter(i => getItemStatus(i) === 'approaching').length})</option>
              <option value="low_stock">Tồn kho thấp ({inventoryList.filter(i => getItemStatus(i) === 'low_stock').length})</option>
              <option value="stable">Bình thường ({inventoryList.filter(i => getItemStatus(i) === 'stable').length})</option>
            </select>
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
            title="Xuất file Excel báo cáo tồn kho hiện tại"
          >
            <Download size={14} />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Bảng danh sách tồn kho */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
            <tr>
              <th className="w-10 px-3"></th>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Tên vật tư</th>
              <th className="px-4 py-3">Thông số / Nhà cung cấp</th>
              <th className="px-4 py-3 text-right">Tồn thực tế</th>
              <th className="px-4 py-3 text-right">Tạm khóa</th>
              <th className="px-4 py-3 text-right">Khả dụng</th>
              <th className="px-4 py-3 text-right" title="Giá trị tồn kho tính theo phương pháp bình quân gia quyền di động (Moving Weighted Average) từ các đơn mua hàng thực tế">Giá trị tồn (Ước tính)</th>
              <th className="px-4 py-3 text-center">Cập nhật cuối</th>
              <th className="px-4 py-3 text-center">Cảnh báo tồn kho</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  Không tìm thấy vật tư nào phù hợp với bộ lọc trong kho dự án.
                </td>
              </tr>
            ) : (
              paginatedInventory.map(item => {
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
                      <td className="px-4 py-3.5 text-slate-600 text-xs">
                        <div className="font-semibold text-slate-700">{item.specification || 'Không có'}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Nhà cung cấp: {item.supplierName}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                        {formatQty(item.quantity)} <span className="text-xs text-slate-400 font-normal">{item.unitName}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-500">
                        {item.reservedQuantity > 0 ? (
                          <span className="text-rose-600 font-medium">-{formatQty(item.reservedQuantity)}</span>
                        ) : (
                          '0'
                        )}{' '}
                        <span className="text-xs text-slate-400 font-normal">{item.unitName}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                        {formatQty(item.availableQuantity)} <span className="text-xs text-slate-400 font-normal">{item.unitName}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs">
                        {item.stockValue > 0 ? (
                          <>
                            <div className="font-bold text-blue-600">{formatPrice(item.stockValue)}</div>
                            <div className="text-[9px] text-slate-400" title="Đơn giá bình quân gia quyền di động">Giá BQGQ: {formatPrice(item.avgUnitPrice)}</div>
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">Chưa có giá nhập</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center text-xs text-slate-500">
                        {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'Chưa cập nhật'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {getStatusBadge(item)}
                      </td>
                    </tr>

                    {/* Hàng con hiển thị báo cáo chênh lệch các phase khi nhấn expand */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={10} className="px-8 py-3.5 border-b border-slate-200">
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
                                      <th className="px-3 py-2.5 text-right">Định mức</th>
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
                                            {formatQty(phase.boqQuantity)} <span className="text-[10px] text-slate-400">{item.unitName}</span>
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-slate-900">
                                            {formatQty(phase.usedQuantity)} <span className="text-[10px] text-slate-400">{item.unitName}</span>
                                          </td>
                                          <td className="px-3 py-2 text-right text-slate-500 font-mono">
                                            {phase.boqQuantity > 0 ? `${percent}%` : '-'}
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

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
