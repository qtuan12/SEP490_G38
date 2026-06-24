import React, { useEffect, useState } from 'react';
import { Modal, Button } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import type { MaterialIssuanceDetail, MaterialIssuanceItemDetail } from '../../../types/inventory';
import {
  Calendar,
  User,
  FileText,
  Briefcase,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface IssuanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  issuanceId: number | null;
}

export const IssuanceDetailModal: React.FC<IssuanceDetailModalProps> = ({
  isOpen,
  onClose,
  issuanceId
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<MaterialIssuanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && issuanceId) {
      fetchDetail();
    }
  }, [isOpen, issuanceId]);

  const fetchDetail = async () => {
    if (!issuanceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getMaterialIssuanceDetail(issuanceId);
      setDetail(data);
    } catch (err: any) {
      console.error('Error fetching material issuance detail:', err);
      setError(err.message || 'Không thể tải chi tiết phiếu xuất kho.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chi tiết Phiếu Xuất Kho: ${detail?.issuanceNo || (issuanceId ? `PXK-${String(issuanceId).padStart(5, '0')}` : '')}`}
      width="lg"
      footer={
        <div className="flex justify-end w-full">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Đóng
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center items-center py-12 gap-3">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span className="text-slate-500 text-sm">Đang tải thông tin chi tiết...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 text-sm border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : detail ? (
        <div className="flex flex-col gap-5 text-sm text-left">
          
          {/* Status Bar */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="text-slate-500 font-medium">Trạng thái phiếu:</span>
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
              Đã xuất dùng
            </span>
          </div>

          {/* Metadata Cards */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2 text-slate-600">
                <Briefcase size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium block text-xs text-slate-400">Mã phiếu xuất kho:</span>
                  <span className="text-blue-700 font-bold font-mono">{detail.issuanceNo}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <Briefcase size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium block text-xs text-slate-400">Công việc thi công:</span>
                  <span className="text-slate-900 font-semibold">{detail.taskName}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <FileText size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium block text-xs text-slate-400">Mục đích xuất dùng:</span>
                  <span className="text-slate-900 font-medium">{detail.purpose}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2 text-slate-600">
                <Calendar size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium block text-xs text-slate-400">Ngày xuất kho:</span>
                  <span className="text-slate-900 font-semibold">
                    {new Date(detail.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <User size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium block text-xs text-slate-400">Người lập phiếu:</span>
                  <span className="text-slate-900 font-medium">{detail.createdByName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div>
            <h4 className="font-semibold text-slate-700 mb-2">Danh sách vật tư xuất kho</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Mã vật tư</th>
                    <th className="px-4 py-2.5">Tên vật tư</th>
                    <th className="px-4 py-2.5 text-right">Số lượng xuất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {detail.items.map((item: MaterialIssuanceItemDetail) => (
                    <tr key={item.issuanceItemId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {item.materialCode}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.materialName}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-950">
                        {item.quantity} <span className="text-xs text-slate-500 font-normal">{item.unitName}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : null}
    </Modal>
  );
};
