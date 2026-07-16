import React, { useState } from 'react';
import { Modal, Button } from '../../../components/ui';
import { inventoryAdjustmentService, type InventoryAdjustmentDto } from '../../../services/inventoryAdjustmentService';
import { useAuth } from '../../../context/AuthContext';
import { incidentService } from '../../../services/incidentService';
import { inventoryService } from '../../../services/inventoryService';
import type { CurrentInventory } from '../../../types/inventory';

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
  const [incidentImages, setIncidentImages] = useState<string[]>([]);
  const [inventory, setInventory] = useState<CurrentInventory[]>([]);

  React.useEffect(() => {
    if (isOpen && adjustmentData) {
      // Fetch current inventory
      inventoryService.getCurrentInventory(adjustmentData.projectId)
        .then(res => setInventory(res))
        .catch(console.error);

      const parsedDesc = adjustmentData.description || '';
      const incidentLinkMatch = parsedDesc.match(/\[System\] Liên kết sự cố #(\d+)/);
      if (incidentLinkMatch) {
        const incidentIdStr = incidentLinkMatch[1];
        incidentService.getIncidents(adjustmentData.projectId)
          .then(list => {
            const found = list.find(inc => inc.incidentId.toString() === incidentIdStr);
            if (found) {
              const desc = found.description || '';
              const imgRegex = /!\[.*?\]\((.*?)\)/g;
              const urls: string[] = [];
              let match;
              while ((match = imgRegex.exec(desc)) !== null) {
                urls.push(match[1]);
              }
              setIncidentImages(urls);
            }
          })
          .catch(console.error);
      }
    }
  }, [isOpen, adjustmentData]);

  const canReview = user?.role === 'director' || user?.role === 'admin';
  const isPending = adjustmentData?.status === 'Pending';

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending':    return 'Chờ duyệt';
      case 'Approved':   return 'Đã duyệt';
      case 'Rejected':   return 'Đã từ chối';
      default:           return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Approved': return 'text-[hsl(var(--success))]';
      case 'Rejected': return 'text-[hsl(var(--danger))]';
      default:         return 'text-amber-600';
    }
  };

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
  const images: string[] = [];
  let incidentTime = '';
  let witness = '';
  let location = '';

  let accountantNote = '';
  let incidentDesc = '';

  if (parsedDesc) {
    const imgRegex = /!\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = imgRegex.exec(parsedDesc)) !== null) {
      images.push(match[1]);
    }

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
      incidentDesc = incidentDesc.replace(/!\[.*?\]\((.*?)\)/g, '');
      incidentDesc = incidentDesc.replace(/\[System\] Liên kết sự cố #\d+/g, '');
      incidentDesc = incidentDesc.replace(/\*\*Hình ảnh đính kèm:\*\*/g, '');
      incidentDesc = incidentDesc.trim();
    }

    accountantNote = accountantNote.replace(/\*\*Ngày\/Giờ phát hiện:\*\*([^\r\n]+)/g, '');
    accountantNote = accountantNote.replace(/\*\*Người làm chứng\/Liên đới:\*\*([^\r\n]+)/g, '');
    accountantNote = accountantNote.replace(/\*\*Vị trí kho\/Lô hàng:\*\*([^\r\n]+)/g, '');
    accountantNote = accountantNote.replace(/!\[.*?\]\((.*?)\)/g, '');
    accountantNote = accountantNote.replace(/\[System\] Liên kết sự cố #\d+/g, '');
    accountantNote = accountantNote.replace(/\*\*Hình ảnh đính kèm:\*\*/g, '');
    accountantNote = accountantNote.trim();
  }

  const allImages = [...images, ...incidentImages].filter((value, index, self) => self.indexOf(value) === index);

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
              <strong className={getStatusClass(adjustmentData.status)}>{getStatusLabel(adjustmentData.status)}</strong>
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
            
            <div style={{ display: 'grid', gridTemplateColumns: allImages.length > 0 ? '1.8fr 1fr' : '1fr', gap: '20px' }}>
              <div className="flex flex-col gap-3">
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
                </div>

                {incidentDesc && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Mô tả sự cố</span>
                    <div className="bg-white p-3 rounded-xl border border-gray-300 text-gray-800 whitespace-pre-wrap leading-relaxed text-sm">
                      {incidentDesc}
                    </div>
                  </div>
                )}
              </div>

              {allImages.length > 0 && (
                <div className="border-l border-gray-300 pl-5 flex flex-col gap-2">
                  <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Hình ảnh đính kèm</span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {allImages.map((img, idx) => (
                      <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-gray-300 hover:border-blue-500 transition-all">
                        <img src={img} alt={`Ảnh đính kèm ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Mã VT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Tên vật tư</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    {adjustmentData.adjustmentType === 'Increase' ? 'Tồn kho trước tăng' : 'Tồn kho trước giảm'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    {adjustmentData.adjustmentType === 'Increase' ? 'S.lượng tăng' : 'S.lượng giảm'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    {adjustmentData.adjustmentType === 'Increase' ? 'Tồn kho sau tăng' : 'Tồn kho sau giảm'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {adjustmentData.items.map(it => {
                  const invItem = inventory.find(inv => inv.materialId === it.materialId);
                  const hasInv = !!invItem;

                  let stockBeforeStr = '-';
                  let stockAfterStr = '-';
                  let changeSign = adjustmentData.adjustmentType === 'Increase' ? '+' : '-';
                  let changeColor = adjustmentData.adjustmentType === 'Increase' ? 'text-[hsl(var(--success))]' : 'text-red-600';

                  if (hasInv) {
                    let stockBeforeVal = invItem.quantity;
                    let stockAfterVal = invItem.quantity;

                    if (adjustmentData.status === 'Approved') {
                      if (adjustmentData.adjustmentType === 'Increase') {
                        stockBeforeVal = invItem.quantity - it.quantity;
                        stockAfterVal = invItem.quantity;
                      } else {
                        stockBeforeVal = invItem.quantity + it.quantity;
                        stockAfterVal = invItem.quantity;
                      }
                    } else {
                      if (adjustmentData.adjustmentType === 'Increase') {
                        stockBeforeVal = invItem.quantity;
                        stockAfterVal = invItem.quantity + it.quantity;
                      } else {
                        stockBeforeVal = invItem.quantity;
                        stockAfterVal = invItem.quantity - it.quantity;
                      }
                    }

                    stockBeforeStr = `${stockBeforeVal} ${it.unitName}`;
                    stockAfterStr = `${stockAfterVal} ${it.unitName}`;
                  }

                  return (
                    <tr key={it.adjustmentItemId}>
                      <td className="px-4 py-3 text-gray-900">{it.materialCode}</td>
                      <td className="px-4 py-3 text-gray-900">{it.materialName}</td>
                      <td className="px-4 py-3 text-center text-gray-900">{stockBeforeStr}</td>
                      <td className={`px-4 py-3 text-center font-semibold ${changeColor}`}>
                        {changeSign}{it.quantity} {it.unitName}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{stockAfterStr}</td>
                    </tr>
                  );
                })}
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
