import { formatNumber } from '../../../utils/formatNumber';
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { projectService } from '../../../services/projectService';
import { inventoryService } from '../../../services/inventoryService';
import type { MaterialRequest, MaterialRequestProcurementDecision, WBSPhase } from '../../../types/common';
import { MaterialRequestDetailModal } from '../modals/MaterialRequestDetailModal';
import { Badge, Button, Pagination, TableLoader } from '../../../components/ui';
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
import { ResubmitMaterialRequestModal } from '../modals/ResubmitMaterialRequestModal';
import toast from 'react-hot-toast';
import { formatDate } from '../../../utils/dateHelpers';
import { useSignalREvent } from '../../../hooks/useSignalREvent';
import { Modal } from '../../../components/ui/Modal';
import { useProjectAccess } from '../../../hooks/useProjectAccess';
import { useRealtimeDataRefresh } from '../../../hooks/useRealtimeDataRefresh';
import {
  REALTIME_DATA_CHANGED_AGGREGATION_MS,
  RealtimeEntities,
} from '../../../constants/realtimeEntities';
import {
  canResubmitProjectMaterialRequest,
  canProcessMaterialRequestByAccountant,
  getMaterialRequestHandlingPlanLabel,
  getProjectMaterialRequestBusinessStatus,
  getProjectMaterialRequestBusinessStatusVariant,
  matchesProjectMaterialRequestStatusFilter,
  type ProjectMaterialRequestStatusFilter,
} from '../materialRequestDecision';

const MATERIAL_REQUEST_REALTIME_ENTITIES = [
  ...RealtimeEntities.materialRequests,
  ...RealtimeEntities.procurement,
  ...RealtimeEntities.projects.filter(entity => entity === 'Phase'),
] as const;

interface ProjectMaterialRequestsTabProps {
  projectId: number;
}

export const ProjectMaterialRequestsTab: React.FC<ProjectMaterialRequestsTabProps> = ({ projectId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canManageTechnical, canManageAccounting, canApprove } = useProjectAccess(projectId);
  const [searchParams] = useSearchParams();
  const urlPhaseId = searchParams.get('phaseId');
  const urlRequestId = searchParams.get('requestId');
  /** Id đơn hàng đã dẫn sang đây — đóng modal chi tiết thì quay lại đúng đơn hàng đó. */
  const fromPO = searchParams.get('fromPO');

  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeRefreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRequestIdRef = React.useRef(0);

  // Create Request State
  const [isCreatePromptOpen, setIsCreatePromptOpen] = useState(false);
  const [promptPhaseId, setPromptPhaseId] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actualPhaseForCreate, setActualPhaseForCreate] = useState<WBSPhase | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectMaterialRequestStatusFilter>('');

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
        toast.error('Yêu cầu này không còn ở trạng thái có thể tạo đơn mua hàng (có thể đã bị thay đổi hoặc hủy).');
        return;
      }
      const hasRemaining = target.items.some((it) => it.remainingQuantity > 0);
      if (!hasRemaining) {
        toast.error('Yêu cầu này đã được đặt đủ số lượng qua các đơn hàng trước, không còn vật tư nào để tạo đơn hàng mới.');
        return;
      }
      navigate(`/purchase-orders/new?projectId=${projectId}&requestId=${numericId}`);
    } catch (err: any) {
      toast.error(err.message || 'Không thể kiểm tra điều kiện tạo đơn mua hàng.');
    } finally {
      setCheckingPORequestId(null);
    }
  };

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Resubmit state
  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [selectedResubmitRequest, setSelectedResubmitRequest] = useState<MaterialRequest | null>(null);

  // Custom action modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'disburse' | 'approve' | 'reject' | 'cancel' | null>(null);
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionNoteError, setActionNoteError] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const currentRoles = user?.roles?.length ? user.roles : user ? [user.role] : undefined;
  const isAccountant = canManageAccounting && canProcessMaterialRequestByAccountant(currentRoles);
  const isDirector = canApprove;
  const canCreateRequest = canManageTechnical;

  const fetchData = async (showLoading = true) => {
    const requestId = ++fetchRequestIdRef.current;
    if (showLoading) setLoading(true);
    try {
      const [reqs, pList] = await Promise.all([
        projectService.getMaterialRequests(projectId.toString()),
        projectService.getPhases(projectId.toString())
      ]);
      if (requestId !== fetchRequestIdRef.current) return;
      setRequests(reqs);
      setPhases(pList);
      // Do not close an open form/detail while its backing row is refreshed.
      setSelectedRequest(current => current
        ? reqs.find(request => request.id === current.id) ?? current
        : current);
    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      console.error('Error fetching material requests tab data:', err);
      if (showLoading) toast.error('Lỗi khi tải dữ liệu yêu cầu vật tư.');
    } finally {
      if (requestId === fetchRequestIdRef.current) setLoading(false);
    }
  };

  const scheduleRealtimeRefresh = () => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void fetchData(false);
    }, REALTIME_DATA_CHANGED_AGGREGATION_MS);
  };

  useEffect(() => () => {
    fetchRequestIdRef.current += 1;
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
  }, [projectId]);

  useRealtimeDataRefresh(
    scheduleRealtimeRefresh,
    MATERIAL_REQUEST_REALTIME_ENTITIES,
    0,
  );

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
    if (!isAccountant) return;
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
  }, [requests, projectId, isAccountant]);

  // Realtime update via SignalR
  useSignalREvent('ReceiveNotification', (noti: any) => {
    if (noti?.referenceType === 'MaterialRequest' || noti?.referenceType?.includes('/materialrequests')) {
      scheduleRealtimeRefresh();
      toast('Yêu cầu vật tư đã được cập nhật!', { icon: '📋' });
    }
  });

  // Action handlers
  const handleVerifyRequestByAccountant = async (
    reqId: string,
    decision: MaterialRequestProcurementDecision,
    note: string,
  ): Promise<boolean> => {
    try {
      const updated = await projectService.processMaterialRequestByAccountant(reqId, decision, note);
      toast.success(updated.__message || 'Đã lưu kết quả thẩm định yêu cầu vật tư.');
      scheduleRealtimeRefresh();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Không thể soát xét yêu cầu vật tư.');
      return false;
    }
  };

  const handleDisburseRequestByAccountant = async (reqId: string, note?: string) => {
    try {
      const updated = await projectService.disburseEmergencyRequest(reqId, note);
      console.log((updated as any).__message || 'Đã phê duyệt giải ngân chi phí mua ngoài khẩn cấp.');
      scheduleRealtimeRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Không thể phê duyệt giải ngân.');
    }
  };

  const handleApproveRequestByDirector = async (reqId: string, note?: string) => {
    try {
      const updated = await projectService.approveMaterialRequestByDirector(reqId, user?.name || 'director', note);
      const totalCost = updated.items.reduce((sum, item) => sum + (item.quantity * ((item as any).price || 0)), 0);
      console.log((updated as any).__message || `Đã phê duyệt khoản chi phí khắc phục sự cố trị giá ${formatNumber(totalCost)} VND.`);
      scheduleRealtimeRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Không thể phê duyệt yêu cầu vật tư.');
    }
  };

  const handleRejectRequest = async (reqId: string, reason: string) => {
    try {
      const updated = await projectService.rejectMaterialRequest(reqId, reason.trim());
      console.log((updated as any).__message || 'Đã từ chối yêu cầu vật tư.');
      scheduleRealtimeRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Không thể từ chối yêu cầu vật tư.');
    }
  };

  const handleCancelRequest = async (reqId: string, reason: string) => {
    try {
      const message = await projectService.cancelMaterialRequest(reqId, reason.trim());
      console.log(message || 'Đã hủy yêu cầu vật tư.');
      scheduleRealtimeRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Không thể hủy yêu cầu vật tư.');
    }
  };

  const openActionModal = (type: 'disburse' | 'approve' | 'reject' | 'cancel', reqId: string) => {
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
      if (actionType === 'disburse') {
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
      const matchesStatus = matchesProjectMaterialRequestStatusFilter(req, statusFilter);

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

  const getStatusBadge = (request: MaterialRequest) => {
    switch (request.status) {
      case 'pending_leader':
        return <Badge variant="warning"><Clock size={12} className="mr-1" /> Chờ Leader</Badge>;
      case 'approved_by_leader':
        return <Badge variant="info"><CheckCircle size={12} className="mr-1" /> Đã tổng hợp</Badge>;
      case 'pending_accountant':
        return <Badge variant="warning"><Clock size={12} className="mr-1" /> {getProjectMaterialRequestBusinessStatus(request)}</Badge>;
      case 'pending_disbursement':
        return <Badge variant="warning" className="bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)]"><Clock size={12} className="mr-1" /> Chờ tạm ứng</Badge>;
      case 'pending_director':
        return <Badge variant="warning" className="bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)]"><Clock size={12} className="mr-1" /> {getProjectMaterialRequestBusinessStatus(request)}</Badge>;
      case 'approved':
        return <Badge variant="success"><CheckCircle size={12} className="mr-1" /> {getProjectMaterialRequestBusinessStatus(request)}</Badge>;
      case 'rejected':
        return (
          <Badge variant={request.procurementDecision === 'WaitSupply' ? 'info' : getProjectMaterialRequestBusinessStatusVariant(request)}>
            {canResubmitProjectMaterialRequest(request)
              ? <XCircle size={12} className="mr-1" />
              : <Clock size={12} className="mr-1" />}
            {getProjectMaterialRequestBusinessStatus(request)}
          </Badge>
        );
      case 'cancelled':
        return <Badge variant="default"><XCircle size={12} className="mr-1" /> Đã hủy</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getProcessingResult = (request: MaterialRequest) => {
    const handlingPlan = getMaterialRequestHandlingPlanLabel(request.procurementDecision);

    return (
      <div className="flex flex-col items-start gap-1">
        {getStatusBadge(request)}
        {handlingPlan && (
          <span className="text-[0.7rem] leading-tight text-[hsl(var(--text-muted))]">
            <strong className="font-semibold text-[hsl(var(--text-secondary))]">{handlingPlan}</strong>
          </span>
        )}
      </div>
    );
  };

  const getClassificationBadge = (req: MaterialRequest) => {
    if (req.type === 'emergency') {
      return <Badge variant="warning" className="text-[0.68rem] bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)] py-0.5 px-2 normal-case">Khẩn cấp (Mua ngoài)</Badge>;
    } else if (req.isOverBOQ) {
      return <Badge variant="danger" className="text-[0.68rem] py-0.5 px-2 normal-case">Vượt dự toán</Badge>;
    } else {
      return <Badge variant="default" className="text-[0.68rem] py-0.5 px-2 normal-case">Trong dự toán</Badge>;
    }
  };



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
            <span className="text-xs text-[hsl(var(--text-secondary))] font-bold uppercase tracking-wider">Kết quả xử lý:</span>
            <select
              className="text-xs text-slate-700 bg-white border border-[hsl(var(--border))] rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none cursor-pointer shadow-sm"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as ProjectMaterialRequestStatusFilter)}
            >
              <option value="">Tất cả kết quả</option>
              <option value="pending_accountant">Chờ phê duyệt</option>
              <option value="pending_director">Chờ phê duyệt vượt dự toán</option>
              <option value="approved">Đã phê duyệt</option>
              <option value="rejected:InternalTransfer">Đề nghị điều chuyển nội bộ</option>
              <option value="rejected:WaitSupply">Chờ cung ứng</option>
              <option value="rejected">Từ chối</option>
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
        {loading && requests.length === 0 ? (
          <TableLoader isTable={false} message="Đang tải dữ liệu yêu cầu vật tư..." />
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-[hsl(var(--text-muted))] text-sm">
            Không tìm thấy phiếu yêu cầu vật tư nào phù hợp.
          </div>
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-[hsl(var(--bg-main)/0.5)] border-b border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase">
                <th className="px-4 py-3 text-center w-12">STT</th>
                <th className="px-4 py-3">Số yêu cầu</th>
                <th className="px-4 py-3">Ngày yêu cầu</th>
                <th className="px-4 py-3">Giai đoạn / Công việc</th>
                <th className="px-4 py-3">Người yêu cầu</th>
                <th className="px-4 py-3">Phân loại</th>
                <th className="px-4 py-3">Kết quả xử lý</th>
                <th className="px-2.5 py-3 text-center w-[148px] min-w-[148px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border-light))]">
              {paginatedRequests.map((req, index) => (
                <tr key={req.id} className="hover:bg-[hsl(var(--bg-main)/0.3)] transition-colors">
                  <td className="px-4 py-3.5 whitespace-nowrap text-center text-[hsl(var(--text-muted))] text-sm font-medium tabular-nums">
                    {(currentPage - 1) * 10 + index + 1}
                  </td>
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
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {getClassificationBadge(req)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {getProcessingResult(req)}
                  </td>
                  <td className="px-2.5 py-3.5 text-center whitespace-nowrap w-[148px] min-w-[148px]">
                    <div className="inline-flex flex-nowrap items-center justify-center gap-1.5 whitespace-nowrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsDetailOpen(true);
                        }}
                        className="p-1.5 h-auto inline-flex shrink-0 items-center justify-center border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
                        title="Xem chi tiết & đối chiếu dự toán"
                        aria-label="Xem chi tiết yêu cầu vật tư"
                      >
                        <Eye size={14} />
                      </Button>

                      {canManageTechnical && req.createdBy === Number(user?.id) && canResubmitProjectMaterialRequest(req) && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedResubmitRequest(req);
                            setIsResubmitOpen(true);
                          }}
                          className="py-1 px-2 h-auto text-[0.78rem] font-medium inline-flex shrink-0 items-center whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-white border-none"
                          title="Chỉnh sửa và gửi lại yêu cầu bị từ chối"
                        >
                          <span>Gửi lại</span>
                        </Button>
                      )}

                      {/* Tạo PO: chỉ hiển thị cho Kế toán (không tính Admin) với các yêu cầu đã Approved.
                          Yêu cầu không còn đủ điều kiện (đã đặt đủ vật tư qua PO khác...) vẫn hiện nút
                          nhưng tô màu xám — bấm vào sẽ báo lý do không thể tạo thay vì bị ẩn mất. */}
                      {isAccountant && req.status === 'approved' && (() => {
                        const numericId = req.id.replace('mat-req-', '');
                        const canCreatePO = poEligibility[numericId] !== false;
                        if (!canCreatePO) return null;
                        return (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={checkingPORequestId === req.id}
                            onClick={() => handleCreatePOClick(req)}
                            className="py-1 px-2.5 h-auto text-[0.78rem] font-medium flex items-center gap-1 bg-[hsl(var(--primary))] text-white border-none hover:bg-[hsl(var(--primary-hover))]"
                            title="Tạo đơn mua hàng cho yêu cầu này"
                          >
                            <ShoppingCart size={13} />
                            <span>{checkingPORequestId === req.id ? 'Đang kiểm tra...' : 'Đơn Hàng'}</span>
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
      {totalPages >= 1 && (
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
            // Đến từ chi tiết đơn hàng thì trả người dùng về đúng chỗ họ vừa rời đi.
            // Ưu tiên lùi lịch sử: giữ nguyên mọi tham số của trang đơn hàng (vd fromProject)
            // và không đẻ thêm entry khiến nút quay lại ở đó lại đưa ngược về đây.
            if (fromPO) {
              const canGoBack = (window.history.state as { idx?: number } | null)?.idx;
              if (canGoBack) navigate(-1);
              else navigate(`/purchase-orders/${fromPO}`, { replace: true });
            }
          }}
          request={selectedRequest}
          isAccountant={isAccountant}
          isDirector={isDirector}
          canManageTechnical={canManageTechnical}
          handleVerifyRequestByAccountant={handleVerifyRequestByAccountant}
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
            actionType === 'disburse' ? 'Xác nhận Giải ngân Tạm ứng' :
                actionType === 'approve' ? 'Xác nhận Phê duyệt Vượt dự toán' :
                  actionType === 'cancel' ? 'Hủy yêu cầu vật tư' :
                    'Từ chối Yêu cầu Vật tư'
          }
          width="sm"
        >
          <div className="flex flex-col gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                {actionType === 'reject' ? 'Lý do từ chối' : actionType === 'cancel' ? 'Lý do hủy yêu cầu' : 'Ghi chú'}
                {(actionType === 'reject' || actionType === 'cancel') && <span style={{ color: 'hsl(var(--danger))' }}> *</span>}
              </label>
              <textarea
                placeholder={
                  actionType === 'reject'
                    ? 'Nhập lý do từ chối (tối thiểu 5 ký tự)...'
                    : actionType === 'cancel'
                      ? 'Nhập lý do hủy yêu cầu (tối thiểu 5 ký tự)...'
                      : ''
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
            scheduleRealtimeRefresh();
          }}
          projectId={projectId.toString()}
          phase={actualPhaseForCreate}
          user={user}
          allMaterialRequests={requests}
          requestType="normal"
        />
      )}

      {isResubmitOpen && selectedResubmitRequest && (
        <ResubmitMaterialRequestModal
          isOpen={isResubmitOpen}
          onClose={() => {
            setIsResubmitOpen(false);
            setSelectedResubmitRequest(null);
          }}
          onSuccess={(msg) => {
            setIsResubmitOpen(false);
            setSelectedResubmitRequest(null);
            console.log(msg);
            scheduleRealtimeRefresh();
          }}
          projectId={projectId.toString()}
          request={selectedResubmitRequest}
          user={user}
          allMaterialRequests={requests}
          phases={phases}
        />
      )}
    </div>
  );
};
