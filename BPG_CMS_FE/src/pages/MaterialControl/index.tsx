import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import type { MaterialRequest } from '../../types/common';
import { MaterialRequestTable } from '../Dashboard/components/MaterialRequestTable';
import { Modal } from '../../components/ui/Modal';
import { Pagination, Input, Select } from '../../components/ui';
import toast from 'react-hot-toast';
import { Boxes, Search } from 'lucide-react';
import { useSignalREvent } from '../../hooks/useSignalREvent';

export const MaterialControl: React.FC = () => {
  const { user } = useAuth();
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const [isAccountant, setIsAccountant] = useState(false);
  const [isDirector, setIsDirector] = useState(false);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    setIsAccountant(user?.role === 'accountant' || user?.role === 'admin');
    setIsDirector(user?.role === 'director' || user?.role === 'admin');
  }, [user]);

  // States for custom request processing modal
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'verify' | 'disburse' | 'approve' | 'reject' | null>(null);
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionNoteError, setActionNoteError] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const fetchMaterialRequests = async () => {
    setLoadingRequests(true);
    try {
      const list = await projectService.getAllMaterialRequests();
      setMaterialRequests(list);
    } catch (err) {
      console.error('Error loading material requests:', err);
      toast.error('Lỗi khi tải danh sách yêu cầu vật tư.');
    } finally {
      setLoadingRequests(false);
    }
  };

  // ─── SignalR: tự động reload khi có notification liên quan đến yêu cầu vật tư ───
  useSignalREvent('ReceiveNotification', (noti: any) => {
    if (noti?.referenceType === 'MaterialRequest' || noti?.referenceType?.includes('/materialrequests')) {
      fetchMaterialRequests();
      toast('Danh sách yêu cầu vật tư vừa được cập nhật!', { icon: '📋' });
    }
  });

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchMaterialRequests();
      try {
        const pList = await projectService.getProjects();
        setProjects(pList.map(p => ({ id: p.id, name: p.name })));
      } catch (err) {
        console.error('Error loading projects list:', err);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, projectFilter]);

  const openActionModal = (type: 'verify' | 'disburse' | 'approve' | 'reject', reqId: string) => {
    setActionType(type);
    setActionRequestId(reqId);
    setActionNote('');
    setActionNoteError('');
    setActionModalOpen(true);
  };

  const handleVerifyRequestByAccountant = async (reqId: string, note?: string) => {
    try {
      const req = materialRequests.find(r => r.id === reqId);
      await projectService.processMaterialRequestByAccountant(reqId, note);
      if (req?.isOverBOQ) {
        toast.success('Yêu cầu vượt định mức. Đã chuyển trình Giám đốc phê duyệt.');
      } else {
        toast.success('Yêu cầu trong định mức hợp lệ. Đã duyệt thành công.');
      }
      fetchMaterialRequests();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi soát xét.');
    }
  };

  const handleDisburseRequestByAccountant = async (reqId: string, note?: string) => {
    try {
      await projectService.disburseEmergencyRequest(reqId, note);
      toast.success('Đã phê duyệt giải ngân chi phí mua ngoài khẩn cấp thành công.');
      fetchMaterialRequests();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi giải ngân.');
    }
  };

  const handleApproveRequestByDirector = async (reqId: string, note?: string) => {
    try {
      const updated = await projectService.approveMaterialRequestByDirector(reqId, user?.name || 'director', note);
      const totalCost = updated.items.reduce((sum, item) => sum + (item.quantity * ((item as any).price || 0)), 0);
      toast.success(`Phê duyệt thành công! Khoản chi phí khắc phục sự cố trị giá ${totalCost.toLocaleString('vi-VN')} VND đã được ghi nhận.`);
      fetchMaterialRequests();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi phê duyệt.');
    }
  };

  const handleRejectRequest = async (reqId: string, reason: string) => {
    try {
      await projectService.rejectMaterialRequest(reqId, reason.trim());
      toast.success('Đã từ chối yêu cầu vật tư.');
      fetchMaterialRequests();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi từ chối.');
    }
  };

  const handleSubmitAction = async () => {
    if (actionType === 'reject' && (!actionNote || actionNote.trim().length < 5)) {
      setActionNoteError('Lý do từ chối phải từ 5 ký tự trở lên.');
      return;
    }
    if (!actionRequestId || !actionType) return;

    setIsSubmittingAction(true);
    try {
      if (actionType === 'verify') {
        await handleVerifyRequestByAccountant(actionRequestId, actionNote);
      } else if (actionType === 'disburse') {
        await handleDisburseRequestByAccountant(actionRequestId, actionNote);
      } else if (actionType === 'approve') {
        await handleApproveRequestByDirector(actionRequestId, actionNote);
      } else if (actionType === 'reject') {
        await handleRejectRequest(actionRequestId, actionNote);
      }
      setActionModalOpen(false);
    } catch (err: any) {
      // errors are handled via toast inside handlers
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Filter material requests
  const filteredRequests = materialRequests.filter(req => {
    const matchesSearch =
      (req.taskName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.phaseName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.requesterName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.items.some(it => it.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === '' || req.status === statusFilter;
    const matchesProject = projectFilter === '' || req.projectId === projectFilter;

    return matchesSearch && matchesStatus && matchesProject;
  });

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col gap-6 animate-fade-in" style={{ padding: '24px', backgroundColor: 'hsl(var(--bg-main))', minHeight: '100%' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'hsl(var(--bg-card))', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border))' }}>
        <div style={{ padding: '8px', backgroundColor: 'hsl(var(--primary-glow))', borderRadius: 'var(--radius-sm)', color: 'hsl(var(--primary))' }}>
          <Boxes size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'hsl(var(--text-primary))' }}>Kiểm soát & Phê duyệt Vật tư</h2>
          <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', marginTop: '4px' }}>
            Không gian soát xét đề xuất vật tư của Kế toán & Phê duyệt vượt định mức của Giám đốc
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="glass-panel p-5 flex justify-between items-center flex-wrap gap-4" style={{ backgroundColor: 'hsl(var(--bg-card))' }}>
        <div className="flex gap-3 flex-1 min-w-[280px] flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" style={{ pointerEvents: 'none' }} />
            <Input
              type="text"
              placeholder="Tìm kiếm theo công việc, vật tư, người yêu cầu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <Select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-48 h-10"
            options={[
              { label: 'Tất cả Dự án', value: '' },
              ...projects.map(p => ({ label: p.name, value: p.id }))
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48 h-10"
            options={[
              { label: 'Tất cả Trạng thái', value: '' },
              { label: 'Chờ phê duyệt', value: 'pending_accountant' },
              { label: 'Chờ duyệt vượt định mức', value: 'pending_director' },
              { label: 'Đã phê duyệt', value: 'approved' },
              { label: 'Bị từ chối', value: 'rejected' },
            ]}
          />
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex flex-col gap-4">
        <MaterialRequestTable
          materialRequests={paginatedRequests}
          loadingRequests={loadingRequests}
          isAccountant={isAccountant}
          isDirector={isDirector}
          handleVerifyRequestByAccountant={(id) => openActionModal('verify', id)}
          handleDisburseRequestByAccountant={(id) => openActionModal('disburse', id)}
          handleApproveRequestByDirector={(id) => openActionModal('approve', id)}
          handleRejectRequest={(id) => openActionModal('reject', id)}
        />

        {/* Pagination Controls */}
        {!loadingRequests && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* CUSTOM ACTION MODAL */}
      {actionModalOpen && actionType && (
        <Modal
          isOpen={actionModalOpen}
          onClose={() => setActionModalOpen(false)}
          title={
            actionType === 'verify' ? 'Kiểm tra yêu cầu vật tư' :
              actionType === 'disburse' ? 'Giải ngân yêu cầu vật tư khẩn cấp' :
                actionType === 'approve' ? 'Phê duyệt yêu cầu vượt định mức' :
                  'Từ chối yêu cầu vật tư'
          }
          width="sm"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', margin: 0 }}>
              {actionType === 'verify' ? 'Xác nhận yêu cầu vật tư này. Nếu vật tư vượt định mức, hệ thống sẽ tự động trình lên Giám đốc.' :
                actionType === 'disburse' ? 'Xác nhận giải ngân chi phí mua ngoài khẩn cấp cho dự án.' :
                  actionType === 'approve' ? 'Phê duyệt yêu cầu vật tư vượt định mức.' :
                    'Vui lòng nhập lý do từ chối yêu cầu vật tư này.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ margin: 0, fontWeight: 500, fontSize: '0.85rem' }}>
                {actionType === 'reject' ? 'Lý do từ chối' : 'Ghi chú / Ý kiến xử lý'}
                {actionType === 'reject' && <span style={{ color: 'hsl(var(--danger))' }}> *</span>}
              </label>
              <textarea
                placeholder={
                  actionType === 'reject'
                    ? 'Nhập lý do từ chối (tối thiểu 5 ký tự)...'
                    : 'Nhập ý kiến xử lý (tùy chọn)...'
                }
                value={actionNote}
                onChange={(e) => {
                  setActionNote(e.target.value);
                  if (actionType !== 'reject' || e.target.value.trim().length >= 5) {
                    setActionNoteError('');
                  }
                }}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${actionNoteError ? 'hsl(var(--danger))' : 'hsl(var(--border))'}`,
                  fontSize: '0.9rem',
                  outline: 'none',
                  backgroundColor: 'hsl(var(--bg-main))'
                }}
              />
              {actionNoteError && (
                <p style={{ color: 'hsl(var(--danger))', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                  {actionNoteError}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'end', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary py-1.5 px-4 text-sm"
                onClick={() => setActionModalOpen(false)}
                disabled={isSubmittingAction}
              >
                Hủy
              </button>
              <button
                type="button"
                className={actionType === 'reject' ? 'btn btn-danger py-1.5 px-4 text-sm' : 'btn btn-primary py-1.5 px-4 text-sm'}
                onClick={handleSubmitAction}
                disabled={isSubmittingAction}
              >
                {isSubmittingAction ? 'Đang xử lý...' :
                  actionType === 'verify' ? 'Xác nhận' :
                    actionType === 'disburse' ? 'Xác nhận giải ngân' :
                      actionType === 'approve' ? 'Xác nhận duyệt' :
                        'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
