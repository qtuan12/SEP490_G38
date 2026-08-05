import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import {projectService} from '../../../../src/services/projectService';
import type {WBSPhase, MaterialRequest} from '../../../types/common';
import { Modal } from '../../../../src/components/ui/Modal';

interface LeaderApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  phase: WBSPhase;
  projectId: string;
  user: any;
  allMaterialRequests: MaterialRequest[];
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
}

export const LeaderApprovalModal: React.FC<LeaderApprovalModalProps> = ({
  isOpen,
  onClose,
  phase,
  user,
  allMaterialRequests,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  
  const pendingRequests = allMaterialRequests.filter(r => r.phaseId === phase.id && r.status === 'pending_leader');

  useEffect(() => {
    if (isOpen) {
      setSelectedReqIds(pendingRequests.map(r => r.id));
      setReason('');
    }
  }, [isOpen, pendingRequests.length]);

  const toggleSelect = (id: string) => {
    setSelectedReqIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const mergedItems: Record<string, { quantity: number, unit: string }> = {};
  pendingRequests.filter(r => selectedReqIds.includes(r.id)).forEach(req => {
    req.items.forEach(item => {
      if (mergedItems[item.name]) {
        mergedItems[item.name].quantity += item.quantity;
      } else {
        mergedItems[item.name] = { quantity: item.quantity, unit: item.unit };
      }
    });
  });

  let isOverBOQ = false;
  const overBOQWarnings: string[] = [];
  
  if (phase.materials && phase.materials.length > 0) {
    Object.keys(mergedItems).forEach(matName => {
      const requestedQty = mergedItems[matName].quantity;
      const boqItem = phase.materials!.find(m => m.name === matName);
      
      const usedQty = allMaterialRequests
        .filter(r => r.phaseId === phase.id && r.status !== 'rejected' && r.status !== 'pending_leader')
        .reduce((sum, r) => {
          const item = r.items.find(i => i.name === matName);
          return sum + (item ? item.quantity : 0);
        }, 0);
        
      const totalRequested = usedQty + requestedQty;

      if (!boqItem) {
        isOverBOQ = true;
        overBOQWarnings.push(`Vật tư "${matName}" không có trong định mức giai đoạn.`);
      } else if (totalRequested > boqItem.quantity) {
        isOverBOQ = true;
        overBOQWarnings.push(`Vật tư "${matName}" vượt định mức. Yêu cầu đợt này + Đã xuất: ${totalRequested} > Định mức: ${boqItem.quantity}.`);
      }
    });
  } else if (Object.keys(mergedItems).length > 0) {
    isOverBOQ = true;
    overBOQWarnings.push('Giai đoạn này chưa thiết lập bảng định mức vật tư. Yêu cầu sẽ bị tính là vượt định mức.');
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (selectedReqIds.length === 0) {
        throw new Error('Vui lòng chọn ít nhất một yêu cầu để tổng hợp.');
      }
      return projectService.aggregateSERequests(
        selectedReqIds,
        phase.id,
        phase.name,
        user.name,
        isOverBOQ,
        reason
      );
    },
    onSuccess: () => {
      const msg = 'Tổng hợp đề xuất vật tư thành công và đã gửi Kế toán!';
      console.log(msg);
      onSuccess(msg);
      queryClient.invalidateQueries({ queryKey: ['materialRequests'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi tổng hợp.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tổng hợp Yêu cầu Vật tư từ Kỹ sư">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="text-sm text-slate-600">
          Giai đoạn: <strong className="text-slate-900">{phase.name}</strong>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="p-5 text-center text-slate-500 bg-slate-50 rounded-md border border-slate-200">
            Không có yêu cầu vật tư nào đang chờ duyệt.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              <div className="font-semibold text-sm">Danh sách Đề xuất (SE)</div>
              {pendingRequests.map(r => (
                <div key={r.id} className="flex items-start gap-3 p-3 bg-white rounded-md border border-slate-200 shadow-sm">
                  <input 
                    type="checkbox" 
                    checked={selectedReqIds.includes(r.id)} 
                    onChange={() => toggleSelect(r.id)} 
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <strong className="text-sm text-slate-900">{r.requesterName}</strong>
                      <span className="text-xs text-slate-500">{r.date}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      <strong>Task:</strong> {r.taskName || 'Không xác định'}
                    </div>
                    <div className="text-xs mt-1 text-slate-700">
                      <strong>Vật tư:</strong> {r.items.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50/50 p-3 rounded-md border border-blue-100">
              <div className="font-semibold text-sm mb-2 text-slate-800">Tổng số lượng (Dự kiến)</div>
              {Object.keys(mergedItems).length === 0 ? (
                <span className="text-sm text-slate-500">Chưa chọn yêu cầu nào.</span>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(mergedItems).map(([name, data]) => (
                    <div key={name} className="text-sm flex justify-between p-1.5 px-2 bg-white border border-slate-100 rounded shadow-sm">
                      <span className="text-slate-700">{name}</span>
                      <strong className="text-blue-600">{data.quantity} {data.unit}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isOverBOQ && (
              <div className="text-sm bg-red-50 p-3 rounded-md border border-red-200">
                <span className="text-red-600 font-semibold flex items-center gap-1">
                  ⚠️ Cảnh báo Vượt Định mức
                </span>
                <ul className="mt-1 pl-5 text-red-600 list-disc">
                  {overBOQWarnings.map((w, idx) => <li key={idx}>{w}</li>)}
                </ul>
                <div className="mt-1.5 italic text-red-500 text-xs">
                  *Phiếu này sẽ được gửi lên Giám đốc phê duyệt thay vì Kế toán.
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">Ghi chú / Giải trình (Nếu có)</label>
              <textarea 
                placeholder="Ví dụ: Xin duyệt tổng hợp vật tư cho tuần 1..." 
                value={reason} 
                onChange={(e) => setReason(e.target.value)} 
                rows={2} 
                className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={mutation.isPending || selectedReqIds.length === 0}>
                {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Gửi Yêu cầu Tổng hợp'}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
