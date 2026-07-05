import React, { useState } from 'react';
import { Modal, Button } from '../../../components/ui';
import { inventoryAdjustmentService, type InventoryAdjustmentDto } from '../../../services/inventoryAdjustmentService';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (msg: string) => void;
  adjustmentId: number;
  adjustmentData?: InventoryAdjustmentDto;
}

export const ReviewAdjustmentModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, onError, adjustmentId, adjustmentData }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [mode, setMode] = useState<'view' | 'reject' | 'confirmApprove'>('view');

  const canReview = user?.role === 'director' || user?.role === 'admin';
  const isPending = adjustmentData?.status === 'Pending';

  const handleApproveClick = () => {
    setMode('confirmApprove');
  };

  const handleConfirmApprove = async () => {
    setLoading(true);
    try {
      await inventoryAdjustmentService.approveDecrease(adjustmentData!.projectId, adjustmentId, {
        isApproved: true
      });
      onSuccess();
    } catch (err: any) {
      if (onError) onError(err.message || 'Lỗi khi duyệt phiếu.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason) {
      if (onError) onError('Vui lòng nhập lý do từ chối.');
      return;
    }

    setLoading(true);
    try {
      await inventoryAdjustmentService.approveDecrease(adjustmentData!.projectId, adjustmentId, {
        isApproved: false,
        rejectedReason: rejectReason
      });
      onSuccess();
    } catch (err: any) {
      if (onError) onError(err.message || 'Lỗi khi từ chối phiếu.');
    } finally {
      setLoading(false);
    }
  };

  if (!adjustmentData) return null;

  let parsedDesc = adjustmentData.description || '';
  let incidentTime = '';
  let witness = '';
  let location = '';

  let accountantNote = '';
  let incidentDesc = '';

  if (parsedDesc) {
    const timeMatch = parsedDesc.match(/\*\*Ngày\/Giờ phát hiện:\*\*([^\r\n]+)/);
    if (timeMatch) incidentTime = timeMatch[1].trim();

    const witnessMatch = parsedDesc.match(/\*\*Người làm chứng\/Liên đới:\*\*([^\r\n]+)/);
    if (witnessMatch) witness = witnessMatch[1].trim();

    const locMatch = parsedDesc.match(/\*\*Vị trí kho\/Lô hàng:\*\*([^\r\n]+)/);
    if (locMatch) location = locMatch[1].trim();

    if (parsedDesc.includes('--- Thông tin sự cố gốc ---')) {
      const parts = parsedDesc.split('--- Thông tin sự cố gốc ---');
      accountantNote = parts[0].trim();
      incidentDesc = parts.length > 1 ? parts[1] : '';
    } else {
      accountantNote = parsedDesc;
    }

    if (incidentDesc) {
      incidentDesc = incidentDesc.replace(/\*\*Ngày\/Giờ phát hiện:\*\*([^\r\n]+)/g, '');
      incidentDesc = incidentDesc.replace(/\*\*Người làm chứng\/Liên đới:\*\*([^\r\n]+)/g, '');
      incidentDesc = incidentDesc.replace(/\*\*Vị trí kho\/Lô hàng:\*\*([^\r\n]+)/g, '');
      incidentDesc = incidentDesc.replace(/\[System\] Liên kết sự cố #\d+/g, '');
      incidentDesc = incidentDesc.trim();
    }

    accountantNote = accountantNote.replace(/\*\*Ngày\/Giờ phát hiện:\*\*([^\r\n]+)/g, '');
    accountantNote = accountantNote.replace(/\*\*Người làm chứng\/Liên đới:\*\*([^\r\n]+)/g, '');
    accountantNote = accountantNote.replace(/\*\*Vị trí kho\/Lô hàng:\*\*([^\r\n]+)/g, '');
    accountantNote = accountantNote.replace(/\[System\] Liên kết sự cố #\d+/g, '');
    accountantNote = accountantNote.trim();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chi tiết Phiếu Kiểm Kê #${adjustmentData.adjustmentId}`} width="lg">
      <div className="flex flex-col gap-4">
        
        <div className="border border-gray-800 rounded-2xl p-5 bg-white flex flex-col gap-4 text-sm">
          <h4 className="font-semibold text-sm text-gray-900 border-b border-gray-300 pb-3">
            Thông tin chung
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Loại điều chỉnh</span>
              <strong className={adjustmentData.adjustmentType === 'Increase' ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}>
                {adjustmentData.adjustmentType === 'Increase' ? 'Tăng tồn kho' : 'Giảm tồn kho'}
              </strong>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Trạng thái</span>
              <strong className="text-gray-900">{adjustmentData.status}</strong>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Dự án</span>
              <strong className="text-gray-900">{adjustmentData.projectName || `Dự án ID: ${adjustmentData.projectId}`}</strong>
            </div>
            {adjustmentData.phaseId && (
              <div className="flex flex-col gap-1">
                <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Giai đoạn liên quan</span>
                <strong className="text-gray-900">{adjustmentData.phaseName || `Giai đoạn ID: ${adjustmentData.phaseId}`}</strong>
              </div>
            )}
            <div className="col-span-2 flex flex-col gap-1">
              <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Lý do điều chỉnh</span>
              <strong className="text-gray-900">{adjustmentData.reason}</strong>
            </div>
            
            {accountantNote && (
              <div className="col-span-2 flex flex-col gap-1 mt-2">
                <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Ghi chú của kế toán</span>
                <div className="bg-slate-50 p-3 rounded-xl border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed mt-1">
                  {accountantNote}
                </div>
              </div>
            )}
            
            {adjustmentData.rejectedReason && (
              <div className="col-span-2 flex flex-col gap-1 mt-2">
                <span className="text-red-500 text-xs uppercase tracking-wider font-semibold">Lý do từ chối</span>
                <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-red-700 whitespace-pre-wrap leading-relaxed mt-1">
                  {adjustmentData.rejectedReason}
                </div>
              </div>
            )}
          </div>
        </div>

        {(incidentDesc || incidentTime || location || witness) && (
          <div className="border border-gray-800 rounded-2xl p-5 bg-slate-50 flex flex-col gap-4 text-sm">
            <h4 className="font-semibold text-sm text-gray-900 border-b border-gray-300 pb-3">
              Thông tin sự cố đính kèm
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              {incidentTime && (
                <div className="flex flex-col gap-1">
                  <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Thời gian phát hiện</span>
                  <strong className="text-gray-900">{incidentTime}</strong>
                </div>
              )}
              {location && (
                <div className="flex flex-col gap-1">
                  <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Vị trí / Lô hàng</span>
                  <strong className="text-gray-900">{location}</strong>
                </div>
              )}
              {witness && (
                <div className="flex flex-col gap-1 col-span-2">
                  <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Người làm chứng / Liên đới</span>
                  <strong className="text-gray-900">{witness}</strong>
                </div>
              )}
              
              {incidentDesc && (
                <div className="col-span-2 flex flex-col gap-1 mt-1">
                  <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Mô tả sự cố</span>
                  <div className="bg-white p-3 rounded-xl border border-gray-300 text-gray-800 whitespace-pre-wrap leading-relaxed mt-1">
                    {incidentDesc}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border border-gray-800 rounded-2xl p-5 bg-white flex flex-col gap-3">
          <h4 className="font-semibold text-sm text-gray-900">Danh sách vật tư điều chỉnh</h4>
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Mã</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Tên vật tư</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">ĐVT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Số lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {adjustmentData.items.map(it => (
                  <tr key={it.adjustmentItemId}>
                    <td className="px-4 py-3 text-gray-900">{it.materialCode}</td>
                    <td className="px-4 py-3 text-gray-900">{it.materialName}</td>
                    <td className="px-4 py-3 text-center text-gray-900">{it.unitName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{it.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isPending && canReview && (
          <div className="mt-4 pt-4 border-t">
            {mode === 'view' ? (
              <div className="flex justify-end gap-2">
                <Button variant="danger" onClick={() => setMode('reject')}>Từ chối</Button>
                <Button variant="primary" onClick={handleApproveClick} isLoading={loading}>Phê duyệt</Button>
              </div>
            ) : mode === 'confirmApprove' ? (
              <div className="flex flex-col gap-3">
                <div className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200">
                  <strong className="block mb-1">Xác nhận phê duyệt</strong>
                  Bạn có chắc chắn muốn duyệt phiếu kiểm kê này? Tồn kho sẽ bị thay đổi ngay lập tức theo nội dung phiếu.
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setMode('view')}>Hủy</Button>
                  <Button variant="primary" onClick={handleConfirmApprove} isLoading={loading}>Xác nhận Phê duyệt</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-[hsl(var(--danger))]">Nhập lý do từ chối:</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Vật tư không hợp lệ..."
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setMode('view')}>Quay lại</Button>
                  <Button variant="danger" onClick={handleReject} isLoading={loading}>Xác nhận Từ chối</Button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Modal>
  );
};
