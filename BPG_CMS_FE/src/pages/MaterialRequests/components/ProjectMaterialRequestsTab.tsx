import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { projectService } from '../../../services/projectService';
import { inventoryService } from '../../../services/inventoryService';
import type { MaterialRequest, WBSPhase } from '../../../types/common';
import { MaterialRequestDetailModal } from '../modals/MaterialRequestDetailModal';
import { Badge, Button, Pagination } from '../../../components/ui';
import {
  Search,
  Eye,
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  Plus
} from 'lucide-react';
import { CreateMaterialRequestModal } from '../modals/CreateMaterialRequestModal';
import toast from 'react-hot-toast';
import { formatDate } from '../../../utils/dateHelpers';
import { useSignalREvent } from '../../../hooks/useSignalREvent';
import { Modal } from '../../../components/ui/Modal';

interface ProjectMaterialRequestsTabProps {
  projectId: number;
}

export const ProjectMaterialRequestsTab: React.FC<ProjectMaterialRequestsTabProps> = ({ projectId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const urlPhaseId = searchParams.get('phaseId');
  const urlRequestId = searchParams.get('requestId');

  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);

  // Create Request State
  const [isCreatePromptOpen, setIsCreatePromptOpen] = useState(false);
  const [promptPhaseId, setPromptPhaseId] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actualPhaseForCreate, setActualPhaseForCreate] = useState<WBSPhase | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Auto-apply phase filter from URL query param if present
  useEffect(() => {
    if (urlPhaseId) {
      setPhaseFilter(urlPhaseId);
    }
  }, [urlPhaseId]);

  // Auto-mở modal chi tiết khi được điều hướng đến từ nơi khác (VD: link liên kết trong PO) kèm requestId
  // MaterialRequest.id có định dạng "mat-req-{requestId}" nên không so sánh trực tiếp với id số trên URL
  useEffect(() => {
    if (urlRequestId && requests.length > 0) {
      const req = requests.find((r) => r.id === `mat-req-${urlRequestId}`);
      if (req) {
        setSelectedRequest(req);
        setIsDetailOpen(true);
      }
    }
  }, [urlRequestId, requests]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Kiểm tra điều kiện trước khi điều hướng sang trang tạo PO cho một yêu cầu vật tư
  const [checkingPORequestId, setCheckingPORequestId] = useState<string | null>(null);

  // Map requestId (dạng số, string) -> có thể tạo PO hay không, dùng để tô màu nút "Tạo PO"
  // trước khi người dùng bấm. undefined = chưa xác định (coi như có thể, tránh nháy màu khi đang tải).
  const [poEligibility, setPoEligibility] = useState<Record<string, boolean>>({});

  const handleCreatePOClick = async (req: MaterialRequest) => {
    const numericId = req.id.replace('mat-req-', '');
    setCheckingPORequestId(req.id);
    try {
      const approvedRequests = await inventoryService.getApprovedRequestsForPO(projectId);
      const target = approvedRequests.find((r) => r.requestId === Number(numericId));

      if (!target) {
        toast.error('Yêu cầu này không còn ở trạng thái có thể tạo đơn mua hàng (có thể đã bị thay đổi hoặc hủy).', { position: 'top-center' });
        return;
      }
      const hasRemaining = target.items.some((it) => it.remainingQuantity > 0);
      if (!hasRemaining) {
        toast.error('Yêu cầu này đã được đặt đủ số lượng qua các đơn hàng trước, không còn vật tư nào để tạo đơn hàng mới.', { position: 'top-center' });
        return;
      }
      navigate(`/purchase-orders/new?projectId=${projectId}&requestId=${numericId}`);
    } catch (err: any) {
      toast.error(err.message || 'Không thể kiểm tra điều kiện tạo đơn mua hàng.', { position: 'top-center' });
    } finally {
      setCheckingPORequestId(null);
    }
  };

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Custom action modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'verify' | 'disburse' | 'approve' | 'reject' | 'cancel' | null>(null);
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionNoteError, setActionNoteError] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const isAccountant = user?.role === 'accountant' || user?.role === 'admin';
  const isDirector = user?.role === 'director' || user?.role === 'admin';
  const canCreateRequest = isLeader || user?.role === 'admin' || user?.role === 'projectleader';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqs, pList, members] = await Promise.all([
        projectService.getMaterialRequests(projectId.toString()),
        projectService.getPhases(projectId.toString()),
        projectService.getMembers(projectId.toString())
      ]);
      setRequests(reqs);
      setPhases(pList);

      const currentMember = members.find(m => m.userId === user?.id);
      setIsLeader(
        (currentMember ? currentMember.isLeader : false) ||
        user?.role === 'projectleader' ||
        user?.role === 'admin'
      );
    } catch (err) {
      console.error('Error fetching material requests tab data:', err);
      toast.error('Lỗi khi tải dữ liệu yêu cầu vật tư.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateRequest = () => {
    if (phaseFilter) {
      const ph = phases.find(p => p.id === phaseFilter);
      if (ph) {
        setActualPhaseForCreate(ph);
        setIsCreateOpen(true);
        return;
      }
    }
    if (phases.length > 0) {
      setPromptPhaseId(phases[0].id);
      setIsCreatePromptOpen(true);
    } else {
      toast.error('Dự án chưa có giai đoạn nào để yêu cầu vật tư.');
    }
  };

  const handlePromptContinue = () => {
    const ph = phases.find(p => p.id === promptPhaseId);
    if (!ph) {
      toast.error('Giai đoạn không hợp lệ.');
      return;
    }
    setActualPhaseForCreate(ph);
    setIsCreatePromptOpen(false);
    setIsCreateOpen(true);
  };

  useEffect(() => {
    fetchData();
  }, [projectId, user]);

  // Kế toán mới cần biết trước yêu cầu nào còn tạo được PO, để tô màu nút phù hợp
  useEffect(() => {
    if (user?.role !== 'accountant') return;
    const approvedRequests = requests.filter(r => r.status === 'approved');
    if (approvedRequests.length === 0) return;

    let cancelled = false;
    inventoryService.getApprovedRequestsForPO(projectId)
      .then(eligible => {
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        approvedRequests.forEach(req => {
          const numericId = req.id.replace('mat-req-', '');
          const target = eligible.find(r => r.requestId === Number(numericId));
          map[numericId] = !!target && target.items.some(it => it.remainingQuantity > 0);
        });
        setPoEligibility(map);
      })
      .catch(() => {
        // Không chặn giao diện nếu việc tra cứu trước thất bại — nút vẫn giữ màu mặc định,
        // việc kiểm tra chính xác sẽ diễn ra khi người dùng bấm "Tạo PO".
      });

    return () => { cancelled = true; };
  }, [requests, projectId, user]);

  // Realtime update via SignalR
  useSignalREvent('ReceiveNotification', (noti: any) => {
    if (noti?.referenceType === 'MaterialRequest' || noti?.referenceType?.includes('/materialrequests')) {
      fetchData();
      toast('Yêu cầu vật tư đã được cập nhật!', { icon: '📋' });
    }
  });

  // Action handlers
  const handleVerifyRequestByAccountant = async (reqId: string, note?: string) => {
    try {
      const req = requests.find(r => r.id === reqId);
      await projectService.processMaterialRequestByAccountant(reqId, note);
      if (req?.isOverBOQ) {
        toast.success('Yêu cầu vượt định mức. Đã chuyển trình Giám đốc phê duyệt.');
      } else {
        toast.success('Yêu cầu trong định mức hợp lệ. Đã duyệt thành công.');
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi soát xét.');
    }
  };

  const handleDisburseRequestByAccountant = async (reqId: string, note?: string) => {
    try {
      await projectService.disburseEmergencyRequest(reqId, note);
      toast.success('Đã phê duyệt giải ngân chi phí mua ngoài khẩn cấp thành công.');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi giải ngân.');
    }
  };

  const handleApproveRequestByDirector = async (reqId: string, note?: string) => {
    try {
      const updated = await projectService.approveMaterialRequestByDirector(reqId, user?.name || 'director', note);
      const totalCost = updated.items.reduce((sum, item) => sum + (item.quantity * ((item as any).price || 0)), 0);
      toast.success(`Phê duyệt thành công! Khoản chi phí khắc phục sự cố trị giá ${totalCost.toLocaleString('vi-VN')} VND đã được ghi nhận.`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi phê duyệt.');
    }
  };

  const handleRejectRequest = async (reqId: string, reason: string) => {
    try {
      await projectService.rejectMaterialRequest(reqId, reason.trim());
      toast.success('Đã từ chối yêu cầu vật tư.');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi từ chối.');
    }
  };

  const handleCancelRequest = async (reqId: string, reason: string) => {
    try {
      await projectService.cancelMaterialRequest(reqId, reason.trim());
      toast.success('Đã hủy yêu cầu vật tư.');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi hủy yêu cầu.');
    }
  };

  const openActionModal = (type: 'verify' | 'disburse' | 'approve' | 'reject' | 'cancel', reqId: string) => {
    setActionType(type);
    setActionRequestId(reqId);
    setActionNote('');
    setActionNoteError('');
    setActionModalOpen(true);
  };

  const handleSubmitAction = async () => {
    if ((actionType === 'reject' || actionType === 'cancel') && (!actionNote || actionNote.trim().length < 5)) {
      setActionNoteError(actionType === 'reject' ? 'Lý do từ chối phải từ 5 ký tự trở lên.' : 'Lý do hủy yêu cầu phải từ 5 ký tự trở lên.');
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
      } else if (actionType === 'cancel') {
        await handleCancelRequest(actionRequestId, actionNote);
      }
      setActionModalOpen(false);
    } catch (err) {
      // Handled in sub-functions
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Filters & Search
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch =
        (req.requesterName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.taskName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.phaseName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.items.some(it => it.name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesPhase = phaseFilter === '' || req.phaseId === phaseFilter;
      const matchesStatus = statusFilter === '' || req.status === statusFilter;

      return matchesSearch && matchesPhase && matchesStatus;
    });
  }, [requests, searchTerm, phaseFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, phaseFilter, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_leader':
        return <Badge variant="warning"><Clock size={12} className="mr-1" /> Chờ Leader</Badge>;
      case 'approved_by_leader':
        return <Badge variant="info"><CheckCircle size={12} className="mr-1" /> Đã tổng hợp</Badge>;
      case 'pending_accountant':
        return <Badge variant="warning"><Clock size={12} className="mr-1" /> Chờ phê duyệt</Badge>;
      case 'pending_disbursement':
        return <Badge variant="warning" className="bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)]"><Clock size={12} className="mr-1" /> Chờ tạm ứng</Badge>;
      case 'pending_director':
        return <Badge variant="warning" className="bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)]"><Clock size={12} className="mr-1" /> Chờ duyệt vượt định mức</Badge>;
      case 'approved':
        return <Badge variant="success"><CheckCircle size={12} className="mr-1" /> Đã phê duyệt</Badge>;
      case 'rejected':
        return <Badge variant="danger"><XCircle size={12} className="mr-1" /> Bị từ chối</Badge>;
      case 'cancelled':
        return <Badge variant="default"><XCircle size={12} className="mr-1" /> Đã hủy</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getClassificationBadge = (req: MaterialRequest) => {
    if (req.type === 'emergency') {
      return <Badge variant="warning" className="text-[0.68rem] bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)] py-0.5 px-2 normal-case">Khẩn cấp (Mua ngoài)</Badge>;
    } else if (req.isOverBOQ) {
      return <Badge variant="danger" className="text-[0.68rem] py-0.5 px-2 normal-case">Vượt định mức</Badge>;
    } else {
      return <Badge variant="default" className="text-[0.68rem] py-0.5 px-2 normal-case">Trong định mức</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl p-8 text-center text-[hsl(var(--text-muted))]">
        Đang tải dữ liệu yêu cầu vật tư...
      </div>
    );
  }

  return (
    <div className="bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden flex flex-col animate-fade-in">

      {/* FILTER BAR */}
      <div className="p-4 border-b border-[hsl(var(--border))] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Left Side: Search input */}
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" size={16} />
          <input
            type="text"
            placeholder="Tìm theo người yêu cầu, vật tư..."
            className="pl-9 pr-3 py-2 border border-[hsl(var(--border))] rounded-lg text-sm bg-transparent w-full"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Right Side: Select dropdowns pushed to the right */}
        <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 justify-end flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[hsl(var(--text-secondary))] font-bold uppercase tracking-wider">Giai đoạn:</span>
            <select
              className="text-xs text-slate-700 bg-white border border-[hsl(var(--border))] rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none cursor-pointer shadow-sm"
              value={phaseFilter}
              onChange={e => setPhaseFilter(e.target.value)}
            >
              <option value="">Tất cả Giai đoạn</option>
              {phases.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[hsl(var(--text-secondary))] font-bold uppercase tracking-wider">Trạng thái:</span>
            <select
              className="text-xs text-slate-700 bg-white border border-[hsl(var(--border))] rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none cursor-pointer shadow-sm"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả Trạng thái</option>
              <option value="pending_accountant">Chờ phê duyệt</option>
              <option value="pending_director">Chờ duyệt vượt định mức</option>
              <option value="approved">Đã phê duyệt</option>
              <option value="rejected">Bị từ chối</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          {canCreateRequest && (
            <Button
              onClick={handleOpenCreateRequest}
              className="flex items-center gap-1.5 py-1.5 px-3.5 text-xs bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-semibold"
            >
              <Plus size={14} /> Yêu cầu vật tư
            </Button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="table-container w-full overflow-x-auto">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-[hsl(var(--text-muted))] text-sm">
            Không tìm thấy phiếu yêu cầu vật tư nào phù hợp.
          </div>
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-[hsl(var(--bg-main)/0.5)] border-b border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase">
                <th className="px-4 py-3">Số yêu cầu</th>
                <th className="px-4 py-3">Ngày yêu cầu</th>
                <th className="px-4 py-3">Giai đoạn / Công việc</th>
                <th className="px-4 py-3">Người yêu cầu</th>
                <th className="px-4 py-3">Vật tư yêu cầu</th>
                <th className="px-4 py-3">Phân loại</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border-light))]">
              {paginatedRequests.map(req => (
                <tr key={req.id} className="hover:bg-[hsl(var(--bg-main)/0.3)] transition-colors">
                  <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-[hsl(var(--primary))]">
                    YCVT-{req.id.replace('mat-req-', '')}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-[hsl(var(--text-secondary))]">
                    {formatDate(req.date)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-[hsl(var(--text-primary))]">
                      {req.phaseName || 'N/A'}
                    </div>
                    {req.taskName && (
                      <div className="text-[0.78rem] text-[hsl(var(--text-muted))] mt-0.5">
                        Công việc: {req.taskName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap font-medium text-[hsl(var(--text-primary))]">
                    {req.requesterName}
                  </td>
                  <td className="px-4 py-3.5 max-w-[280px]">
                    <div className="text-[0.8rem] flex flex-col gap-0.5">
                      {req.items.slice(0, 2).map((it, idx) => (
                        <span key={idx} className="text-[hsl(var(--text-secondary))]">
                          - {it.name}: <strong>{it.quantity}</strong> {it.unit}
                        </span>
                      ))}
                      {req.items.length > 2 && (
                        <span className="text-[0.72rem] text-[hsl(var(--text-muted))] italic ml-2">
                          và {req.items.length - 2} vật tư khác...
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {getClassificationBadge(req)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {getStatusBadge(req.status)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsDetailOpen(true);
                        }}
                        className="py-1 px-2.5 h-auto text-[0.78rem] font-medium flex items-center gap-1 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
                        title="Xem chi tiết & đối chiếu định mức"
                      >
                        <Eye size={13} />
                        <span>Chi tiết</span>
                      </Button>

                      {/* Tạo PO: chỉ hiển thị cho Kế toán (không tính Admin) với các yêu cầu đã Approved.
                          Yêu cầu không còn đủ điều kiện (đã đặt đủ vật tư qua PO khác...) vẫn hiện nút
                          nhưng tô màu xám — bấm vào sẽ báo lý do không thể tạo thay vì bị ẩn mất. */}
                      {user?.role === 'accountant' && req.status === 'approved' && (() => {
                        const numericId = req.id.replace('mat-req-', '');
                        const canCreatePO = poEligibility[numericId] !== false;
                        return (
                          <Button
                            variant={canCreatePO ? 'primary' : 'secondary'}
                            size="sm"
                            disabled={checkingPORequestId === req.id}
                            onClick={() => handleCreatePOClick(req)}
                            className={
                              canCreatePO
                                ? 'py-1 px-2.5 h-auto text-[0.78rem] font-medium flex items-center gap-1 bg-[hsl(var(--primary))] text-white border-none hover:bg-[hsl(var(--primary-hover))]'
                                : 'py-1 px-2.5 h-auto text-[0.78rem] font-medium flex items-center gap-1 bg-[hsl(var(--bg-main))] text-[hsl(var(--text-muted))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--border-light))]'
                            }
                            title={canCreatePO ? 'Tạo đơn mua hàng cho yêu cầu này' : 'Yêu cầu này hiện không thể tạo đơn mua hàng'}
                          >
                            <ShoppingCart size={13} />
                            <span>{checkingPORequestId === req.id ? 'Đang kiểm tra...' : 'Tạo PO'}</span>
                          </Button>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-[hsl(var(--border))] flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailOpen && selectedRequest && (
        <MaterialRequestDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          isAccountant={isAccountant}
          isDirector={isDirector}
          user={user}
          isLeader={isLeader}
          handleVerifyRequestByAccountant={(id) => openActionModal('verify', id)}
          handleDisburseRequestByAccountant={(id) => openActionModal('disburse', id)}
          handleApproveRequestByDirector={(id) => openActionModal('approve', id)}
          handleRejectRequest={(id) => openActionModal('reject', id)}
          handleCancelRequest={(id) => openActionModal('cancel', id)}
        />
      )}

      {/* ACTION NOTE MODAL */}
      {actionModalOpen && actionType && (
        <Modal
          isOpen={actionModalOpen}
          onClose={() => !isSubmittingAction && setActionModalOpen(false)}
          title={
            actionType === 'verify' ? 'Xác nhận Soát xét Yêu cầu' :
              actionType === 'disburse' ? 'Xác nhận Giải ngân Tạm ứng' :
                actionType === 'approve' ? 'Xác nhận Phê duyệt Vượt định mức' :
                  actionType === 'cancel' ? 'Hủy yêu cầu vật tư' :
                    'Từ chối Yêu cầu Vật tư'
          }
          width="sm"
        >
          <div className="flex flex-col gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                {actionType === 'reject' ? 'Lý do từ chối' : actionType === 'cancel' ? 'Lý do hủy yêu cầu' : 'Ý kiến xử lý'}
                {(actionType === 'reject' || actionType === 'cancel') && <span style={{ color: 'hsl(var(--danger))' }}> *</span>}
              </label>
              <textarea
                placeholder={
                  actionType === 'reject'
                    ? 'Nhập lý do từ chối (tối thiểu 5 ký tự)...'
                    : actionType === 'cancel'
                      ? 'Nhập lý do hủy yêu cầu (tối thiểu 5 ký tự)...'
                      : 'Nhập ý kiến xử lý (tùy chọn)...'
                }
                value={actionNote}
                onChange={(e) => {
                  setActionNote(e.target.value);
                  if ((actionType !== 'reject' && actionType !== 'cancel') || e.target.value.trim().length >= 5) {
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
                className={actionType === 'reject' || actionType === 'cancel' ? 'btn btn-danger py-1.5 px-4 text-sm' : 'btn btn-primary py-1.5 px-4 text-sm'}
                onClick={handleSubmitAction}
                disabled={isSubmittingAction}
              >
                {isSubmittingAction ? 'Đang xử lý...' :
                  actionType === 'verify' ? 'Xác nhận' :
                    actionType === 'disburse' ? 'Xác nhận giải ngân' :
                      actionType === 'approve' ? 'Xác nhận duyệt' :
                        actionType === 'cancel' ? 'Xác nhận Hủy' :
                          'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isCreatePromptOpen && (
        <Modal
          isOpen={isCreatePromptOpen}
          onClose={() => setIsCreatePromptOpen(false)}
          title="Tạo Yêu Cầu Vật Tư"
          width="sm"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Chọn Giai đoạn (*)</label>
              <select
                className="w-full px-3 py-2 border border-[hsl(var(--border))] rounded-lg text-sm bg-white"
                value={promptPhaseId}
                onChange={e => setPromptPhaseId(e.target.value)}
              >
                {phases.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <Button variant="secondary" onClick={() => setIsCreatePromptOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" onClick={handlePromptContinue}>
                Tiếp tục
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isCreateOpen && actualPhaseForCreate && (
        <CreateMaterialRequestModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={(msg) => {
            setIsCreateOpen(false);
            toast.success(msg);
            fetchData();
          }}
          projectId={projectId.toString()}
          phase={actualPhaseForCreate}
          user={user}
          isLeader={isLeader}
          allMaterialRequests={requests}
          requestType="normal"
        />
      )}
    </div>
  );
};
