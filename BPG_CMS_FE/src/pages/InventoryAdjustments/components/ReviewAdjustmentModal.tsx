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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chi tiết Phiếu Kiểm Kê #${adjustmentData.adjustmentId}`} width="md">
      <div className="flex flex-col gap-4">
        
        <div className="bg-slate-50 p-4 rounded-xl border flex flex-col gap-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-[hsl(var(--text-secondary))]">Loại điều chỉnh:</span>
            <strong className={adjustmentData.adjustmentType === 'Increase' ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}>
              {adjustmentData.adjustmentType === 'Increase' ? 'Tăng tồn kho' : 'Giảm tồn kho'}
            </strong>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-[hsl(var(--text-secondary))]">Lý do:</span>
            <strong>{adjustmentData.reason}</strong>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-[hsl(var(--text-secondary))]">Trạng thái:</span>
            <strong>{adjustmentData.status}</strong>
          </div>
          {adjustmentData.incidentId && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-[hsl(var(--text-secondary))]">Sự cố liên quan (ID):</span>
              <strong>{adjustmentData.incidentId}</strong>
            </div>
          )}
          {adjustmentData.description && (
            <div className="flex flex-col gap-1 pb-2">
              <span className="text-[hsl(var(--text-secondary))]">Mô tả:</span>
              <p className="bg-white p-2 rounded border">{adjustmentData.description}</p>
            </div>
          )}
          {adjustmentData.rejectedReason && (
            <div className="flex flex-col gap-1 pb-2">
              <span className="text-[hsl(var(--danger))] font-semibold">Lý do từ chối:</span>
              <p className="bg-red-50 text-red-700 p-2 rounded border border-red-200">{adjustmentData.rejectedReason}</p>
            </div>
          )}
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-2">Danh sách vật tư điều chỉnh</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Mã</th>
                  <th className="px-3 py-2 text-left">Tên vật tư</th>
                  <th className="px-3 py-2 text-center">ĐVT</th>
                  <th className="px-3 py-2 text-right">Số lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {adjustmentData.items.map(it => (
                  <tr key={it.adjustmentItemId}>
                    <td className="px-3 py-2">{it.materialCode}</td>
                    <td className="px-3 py-2">{it.materialName}</td>
                    <td className="px-3 py-2 text-center">{it.unitName}</td>
                    <td className="px-3 py-2 text-right font-semibold">{it.quantity}</td>
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
