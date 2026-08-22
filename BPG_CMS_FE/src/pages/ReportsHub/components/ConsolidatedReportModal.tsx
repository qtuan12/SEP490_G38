import React, { useEffect, useState } from 'react';
import { reportService, type ConsolidatedExecutiveReportDto } from '../../../services/reportService';
import { X, Printer, FileText, TrendingUp, Layers } from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui';
import { formatNumber } from '../../../utils/formatNumber';

interface Props {
  projectId: number;
  fromDate?: string;
  toDate?: string;
  onClose: () => void;
}

export const ConsolidatedReportModal: React.FC<Props> = ({ projectId, fromDate, toDate, onClose }) => {
  const [data, setData] = useState<ConsolidatedExecutiveReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportService.getConsolidatedExecutiveReport(projectId, { fromDate, toDate })
      .then(res => setData(res))
      .catch(err => {
        console.error('Error loading consolidated report', err);
        setData(null);
        setError(err instanceof Error ? err.message : 'Không thể tải báo cáo tổng hợp.');
      })
      .finally(() => setLoading(false));
  }, [projectId, fromDate, toDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in print:bg-white print:p-0 print:static">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden print:shadow-none print:border-none print:max-h-none print:w-full print:rounded-none">
        {/* Modal Top Action Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 print:hidden">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
            <FileText size={18} />
            <span>Báo cáo Tổng hợp Quản trị (Executive Consolidated Report)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Printer size={16} /> In / Xuất PDF Báo cáo
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Report Printable Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6 print:overflow-visible print:p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="md" label="Đang tổng hợp số liệu phân tích quản trị..." />
            </div>
          ) : !data ? (
            <div className="text-center py-20 text-red-500 font-bold">{error || 'Không thể tải dữ liệu báo cáo tổng hợp.'}</div>
          ) : (
            <div className="space-y-6 print:space-y-4">
              {/* Document Header */}
              <div className="border-b border-slate-300 dark:border-slate-700 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight m-0">
                      BÁO CÁO TỔNG HỢP VÀ ĐÁNH GIÁ QUẢN TRỊ
                    </h1>
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 m-0 mt-1">
                      {data.projectName}
                    </p>
                  </div>
                  <div className="text-left md:text-right text-xs text-slate-500">
                    <div>Ngày lập báo cáo: <strong>{new Date(data.generatedAt).toLocaleDateString('vi-VN')}</strong></div>
                    {data.fromDate && data.toDate && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Kỳ báo cáo: {data.fromDate} đến {data.toDate}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Executive Insights Highlights */}
              {data.executiveInsights.length > 0 && (
                <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300 flex items-center gap-2 mb-3">
                    <TrendingUp size={16} /> ĐÁNH GIÁ & ĐIỂM TIN QUẢN TRỊ TỔNG HỢP (EXECUTIVE INSIGHTS)
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-800 dark:text-slate-200 font-medium m-0 pl-1 list-none">
                    {data.executiveInsights.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Top Consolidated KPI Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Tiến độ Hoàn thành</div>
                  <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                    {data.progressSummary.overallProgressPercent}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{data.progressSummary.doneTasks}/{data.progressSummary.totalTasks} công việc</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Chi phí Mua sắm</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {(data.procurementSummary.totalCost / 1000000).toFixed(1)}M đ
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Tổng PO & Chi trực tiếp</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Vật tư Vượt BOQ</div>
                  <div className={`text-xl font-black mt-1 ${data.boqSummary.exceedingItemsCount && data.boqSummary.exceedingItemsCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {data.boqSummary.exceedingItemsCount || 0} mã VT
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Vượt định mức cho phép</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Sự cố Công trình</div>
                  <div className={`text-xl font-black mt-1 ${data.incidentSummary.totalIncidents > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {data.incidentSummary.totalIncidents} vụ
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{data.incidentSummary.openIncidents} vụ chưa xử lý</div>
                </div>
              </div>

              {/* Cross-Project Matrix Table if overall project selection */}
              {data.crossProjectMatrix.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Layers size={14} className="text-indigo-500" />
                    <span>SO SÁNH BẢNG SỨC KHỎE DỰ ÁN TOÀN CÔNG TY (PORTFOLIO MATRIX)</span>
                  </div>
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-50 dark:bg-slate-850 font-bold text-slate-600 border-b">
                      <tr>
                        <th className="p-2.5">Sức khỏe</th>
                        <th className="p-2.5">Tên Dự án</th>
                        <th className="p-2.5 text-right">Tiến độ</th>
                        <th className="p-2.5 text-center">Trễ hạn</th>
                        <th className="p-2.5 text-center">Vượt BOQ</th>
                        <th className="p-2.5 text-center">Sự cố</th>
                        <th className="p-2.5 text-right">Thiệt hại</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {data.crossProjectMatrix.map(p => (
                        <tr key={p.projectId}>
                          <td className="p-2.5 font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${p.healthStatus === 'Red' ? 'bg-red-100 text-red-700' : p.healthStatus === 'Yellow' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                              {p.healthStatus === 'Red' ? 'BÁO ĐỘNG' : p.healthStatus === 'Yellow' ? 'CANH GIÁC' : 'AN TOÀN'}
                            </span>
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">{p.projectName}</td>
                          <td className="p-2.5 text-right font-extrabold text-indigo-600">{p.progressPercent}%</td>
                          <td className="p-2.5 text-center text-red-600 font-bold">{p.delayedTasks}</td>
                          <td className="p-2.5 text-center text-amber-600 font-bold">{p.overBoqCount}</td>
                          <td className="p-2.5 text-center text-rose-600 font-bold">{p.totalIncidents}</td>
                          <td className="p-2.5 text-right font-semibold">{p.estimatedLossVnd > 0 ? `${formatNumber(p.estimatedLossVnd)} đ` : '0 đ'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* BOQ Variance Analysis */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 m-0">
                  PHÂN TÍCH CHÊNH LỆCH ĐỊNH MỨC BOQ & VẬT TƯ
                </h4>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <span className="text-slate-500 block">Vật tư trong định mức</span>
                    <strong className="text-emerald-600 text-sm">{data.boqSummary.normalItemsCount || 0} mã</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <span className="text-slate-500 block">Vật tư tiết kiệm</span>
                    <strong className="text-indigo-600 text-sm">{data.boqSummary.savingItemsCount || 0} mã</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <span className="text-slate-500 block">Vật tư vượt BOQ</span>
                    <strong className="text-red-600 text-sm">{data.boqSummary.exceedingItemsCount || 0} mã</strong>
                  </div>
                </div>
              </div>

              {/* Signature Footer for Executive Submission */}
              <div className="pt-8 border-t border-slate-300 dark:border-slate-700 grid grid-cols-2 text-center text-xs text-slate-600 dark:text-slate-400">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white mb-12">NGƯỜI LẬP BÁO CÁO</div>
                  <div>(Ký và ghi rõ họ tên)</div>
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white mb-12">TRƯỞNG BAN QUẢN LÝ DỰ ÁN</div>
                  <div>(Ký và ghi rõ họ tên)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
