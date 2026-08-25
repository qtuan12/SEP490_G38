import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../services/projectService';
import { incidentService } from '../services/incidentService';
import type { Project } from '../types/common';
import { ProjectMembers } from '../components/ProjectMembers';
import { WBSWorkspace } from './WBSWorkspace';
import { DailyLogFeed } from './ProjectDailyLogs/components/DailyLogFeed';
import { EditProjectModal } from './ProjectList/modals/EditProjectModal';
import { Modal } from '../components/ui/Modal';
import { Button, Input, FormItem, FullScreenLoading } from '../components/ui';

import {
  ArrowLeft,
  Users,
  FolderGit2,
  MapPin,
  Calendar,
  Pause,
  CheckCircle,
  Clock,
  Edit3,
  AlertCircle,
  Play,
  Package,
  PackageMinus,
  ShoppingCart,
  ShoppingBag,
  Truck,
  FileSignature,
  ClipboardList,
  History,
  ShieldAlert,
} from 'lucide-react';
import { InventoryWorkspace } from './InventoryWorkspace/InventoryWorkspace';
import { SurplusWorkspace } from './SurplusWorkspace/SurplusWorkspace';
import { ProjectIncidents } from './ProjectIncidents';
import { ProjectPOTab } from './ProjectLayoutHub/ProjectPOTab';
import { ProjectDirectPurchaseTab } from './ProjectLayoutHub/ProjectDirectPurchaseTab';
import { ProjectRelatedSuppliersTab } from './ProjectLayoutHub/ProjectRelatedSuppliersTab';
import { AdjustmentList } from './InventoryAdjustments/components/AdjustmentList';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useSignalREvent } from '../hooks/useSignalREvent';
import { hasApprovedEmergencyForCurrentPause } from '../utils/emergencyWbsAccess';
import { useRealtimeDataRefresh } from '../hooks/useRealtimeDataRefresh';
import { ProjectMaterialRequestsTab } from './MaterialRequests/components/ProjectMaterialRequestsTab';
import { GlobalInventoryIncidents } from './InventoryAdjustments/components/GlobalInventoryIncidents';
import { isPWAMode } from '../utils/pwaHelpers';
import { useProjectAccess } from '../hooks/useProjectAccess';
import { RoleGroup } from '../auth/roles';
import toast from 'react-hot-toast';

const cleanPauseReason = (reason: string): string => {
  if (!reason) return "";

  // If it's a JSON array representation of history, get the last pause entry's reason
  if (reason.trim().startsWith('[')) {
    try {
      const history = parseStatusHistory(reason);
      const lastPause = [...history].reverse().find(h => h.type === 'pause');
      reason = lastPause?.reason || "Tạm dừng dự án";
    } catch {
      // Fallback
    }
  }

  // Remove repetitive prefix if present
  const redundantPrefix = "Tạm dừng thi công do sự cố đặc biệt nghiêm trọng:";
  if (reason.startsWith(redundantPrefix)) {
    reason = reason.substring(redundantPrefix.length).trim();
  }

  // Parse JSON if embedded in reason to only show a clean summary
  if (reason.includes('{') && reason.includes('}')) {
    const startIndex = reason.indexOf('{');
    const endIndex = reason.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      try {
        const jsonStr = reason.substring(startIndex, endIndex + 1);
        const parsed = JSON.parse(jsonStr);
        const loaiSuCo = parsed.loaiSuCo || parsed.incidentType || "";
        const moTaSuCo = parsed.moTaSuCo || parsed.description || "";

        if (moTaSuCo) {
          reason = moTaSuCo;
        } else if (loaiSuCo) {
          reason = loaiSuCo;
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  return reason
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\*\*Hình ảnh đính kèm:?\*\*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

interface StatusHistoryItem {
  type: 'pause' | 'resume' | 'activate' | 'start' | 'complete' | 'close';
  reason?: string;
  timestamp: string;
  user: string;
}

const parseStatusHistory = (rawReason: string | null | undefined, proj?: Project | null): StatusHistoryItem[] => {
  let list: StatusHistoryItem[] = [];
  const trimmed = rawReason?.trim() || '';

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        list = parsed.map((item: any) => ({
          type: String(item.type || item.Type || 'pause').toLowerCase() as any,
          reason: item.reason || item.Reason,
          timestamp: item.timestamp || item.Timestamp,
          user: item.user || item.User
        }));
      }
    } catch {
      // Fallback
    }
  } else if (trimmed) {
    list = [{
      type: 'pause',
      reason: rawReason || undefined,
      timestamp: proj?.pausedAt || '',
      user: 'Hệ thống'
    }];
  }

  // Fallback / Synthesize initial activation entry if project is not draft and no activate entry exists
  if (proj && proj.status !== 'draft') {
    const hasActivate = list.some(i => i.type === 'activate' || i.type === 'start');
    if (!hasActivate) {
      const earliestTimestamp = list.length > 0 && list[0].timestamp
        ? new Date(new Date(list[0].timestamp).getTime() - 1000).toISOString()
        : (proj.startDate ? new Date(proj.startDate).toISOString() : '');

      list.unshift({
        type: 'activate',
        reason: 'Kích hoạt bắt đầu thi công dự án',
        timestamp: earliestTimestamp,
        user: 'Ban quản lý dự án'
      });
    }

    if (proj.status === 'done') {
      const hasComplete = list.some(i => i.type === 'complete' || i.type === 'close');
      if (!hasComplete) {
        list.push({
          type: 'complete',
          reason: 'Hoàn thành dự án',
          timestamp: proj.endDate ? new Date(proj.endDate).toISOString() : '',
          user: 'Ban quản lý dự án'
        });
      }
    }
  }

  return list;
};

export const ProjectLayoutHub: React.FC = () => {
  const queryClient = useQueryClient();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const realtimeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectFetchRequestId = useRef(0);

  const { data: incidents } = useQuery({
    queryKey: ['projectIncidents', projectId],
    queryFn: () => incidentService.getIncidents(Number(projectId?.replace('p-', ''))),
    enabled: !!projectId
  });
  const hasApprovedEmergencyIncident = hasApprovedEmergencyForCurrentPause(
    project?.pauseReason,
    incidents,
  );
  const hasUnapprovedEmergencyIncident = incidents?.some(
    i => i.isEmergency && (i.status === 'WaitingStopApproval' || i.status === 'WaitingRecoveryPlan' || i.status === 'WaitingDirectorApproval')
  ) ?? false;

  const { hasAnyRole } = useAuth();
  const { canViewProject, isLoading: isAccessLoading, canManageExecution, canManageAccounting, canViewReports, canApprove } = useProjectAccess(projectId);
  const { connection } = useNotification();
  // isTPKT dùng để check role identity (có phải trưởng phòng KT không),
  // không dùng canManageTechnical vì cái đó = false khi project paused
  // → sẽ không bao giờ unlock WBS khi có sự cố khẩn cấp được duyệt.
  const isTPKT = hasAnyRole(RoleGroup.Technical);
  const canEditProject = hasAnyRole(RoleGroup.ProjectManagers);
  const canChangeProjectStatus = hasAnyRole(RoleGroup.ProjectManagers) || hasAnyRole(RoleGroup.Approval);
  // Giám đốc phải thấy tab này để duyệt chi phiếu mua khẩn cấp - mọi phiếu đều qua bước này.
  const canManageDirectPurchase = canManageExecution || canManageAccounting || canApprove;

  type TabKey = 'members' | 'wbs' | 'logs' | 'inventory' | 'inventoryadjustments' | 'incidents' | 'inventoryincidents' | 'surplus' | 'purchaseorders' | 'suppliers' | 'directpurchases' | 'materialrequests';
  const TAB_KEYS: TabKey[] = ['members', 'wbs', 'logs', 'inventory', 'inventoryadjustments', 'incidents', 'inventoryincidents', 'surplus', 'purchaseorders', 'suppliers', 'directpurchases', 'materialrequests'];

  const [activeTab, setActiveTab] = useState<TabKey>(
    (() => {
      const tab = searchParams.get('tab') as string;
      if (tab === 'inventoryincidents') return 'incidents';
      if (tab === 'dailylogs') return 'logs';
      const defaultTab = isPWAMode() ? 'logs' : 'wbs';
      return (TAB_KEYS as string[]).includes(tab) ? (tab as TabKey) : defaultTab;
    })()
  );

  useEffect(() => {
    let tab = searchParams.get('tab');
    if (tab === 'inventoryincidents') {
      tab = 'incidents';
    } else if (tab === 'dailylogs') {
      tab = 'logs';
    } else if (tab === 'drawings' && projectId) {
      navigate(`/projects/${projectId}/drawing`, { replace: true });
      return;
    }
    if (tab && (TAB_KEYS as string[]).includes(tab)) {
      setActiveTab(tab as TabKey);
    }
  }, [searchParams, projectId, navigate]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    navigate(`/projects/${projectId}?tab=${tab}`);
  };

  const [statusError, setStatusError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [isPausing, setIsPausing] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const fetchProjectDetails = async (isInitial = true, forceRefresh = false) => {
    if (!projectId) return;
    const requestId = ++projectFetchRequestId.current;
    if (isInitial) setLoading(true);
    setProjectError(null);
    try {
      queryClient.invalidateQueries({ queryKey: ['projectIncidents', projectId] });
      const data = await projectService.getProjectById(projectId, forceRefresh);
      if (requestId !== projectFetchRequestId.current) return;
      setProject(data);
    } catch (err: any) {
      console.error('Error loading project details:', err);
      if (requestId === projectFetchRequestId.current) {
        if (err?.status === 403 || err?.status === 404 || err?.message?.includes('quyền')) {
          setProjectError(err?.response?.data?.message || err?.message || 'Bạn không có quyền truy cập vào dự án này.');
          setProject(null);
        } else {
          // Do not clear the project for transient errors like 500 or 429
          console.warn('Transient error loading project details, keeping old data', err);
        }
      }
    } finally {
      if (requestId === projectFetchRequestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails(true, true);
  }, [projectId]);

  useEffect(() => () => {
    if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
    realtimeRefreshTimer.current = null;
    projectFetchRequestId.current += 1;
  }, [projectId]);

  const refreshProjectFromRealtime = () => {
    if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
    realtimeRefreshTimer.current = setTimeout(() => {
      realtimeRefreshTimer.current = null;
      projectService.clearProjectDetailCache(projectId);
      fetchProjectDetails(false, true);
      queryClient.invalidateQueries({ queryKey: ['wbsData', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-access', String(projectId)] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // Refresh incidents để hasApprovedEmergencyIncident được tính lại ngay
      // khi giám đốc duyệt kế hoạch sự cố khẩn cấp (không cần reload trang)
      queryClient.invalidateQueries({ queryKey: ['projectIncidents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['wbsIncidents', projectId] });
    }, 120);
  };

  useRealtimeDataRefresh(refreshProjectFromRealtime, ['Project', 'ProjectTask', 'Phase', 'DailyLog', 'TaskProgressLog']);

  useEffect(() => {
    if (!connection || !projectId) return;

    const numericProjectId = Number(projectId.replace('p-', ''));
    if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) return;

    let active = true;

    const joinGroup = () => {
      if (active && connection.state === 'Connected') {
        connection.invoke('JoinProjectGroup', numericProjectId)
          .catch(err => console.error('SignalR JoinProjectGroup error in ProjectLayoutHub:', err));
      }
    };

    if (connection.state === 'Connected') {
      joinGroup();
    }

    connection.onreconnected(joinGroup);

    return () => {
      active = false;
      if (connection.state === 'Connected') {
        connection.invoke('LeaveProjectGroup', numericProjectId)
          .catch(err => console.error('SignalR LeaveProjectGroup error in ProjectLayoutHub:', err));
      }
    };
  }, [connection, projectId]);

  // Một số workspace con cũng dùng chung project group và sẽ Leave khi đổi tab.
  // Join lại sau mỗi lần đổi tab để màn hình cha luôn tiếp tục nhận realtime.
  useEffect(() => {
    if (!connection || connection.state !== 'Connected' || !projectId) return;
    const numericProjectId = Number(projectId.replace('p-', ''));
    if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) return;
    connection.invoke('JoinProjectGroup', numericProjectId)
      .catch(err => console.error('SignalR rejoin after tab change failed:', err));
  }, [connection, projectId, activeTab]);

  useSignalREvent('WbsTreeUpdated', refreshProjectFromRealtime);
  useSignalREvent('ReceiveDailyLogCreated', refreshProjectFromRealtime);
  useSignalREvent('ReceiveDailyLogUpdated', refreshProjectFromRealtime);
  useSignalREvent('ReceiveDailyLogDeleted', refreshProjectFromRealtime);
  useSignalREvent('ReceiveTaskProgressUpdated', refreshProjectFromRealtime);
  useSignalREvent('TaskProgressUpdated', refreshProjectFromRealtime);
  useSignalREvent('TaskUpdated', refreshProjectFromRealtime);
  useSignalREvent('ProjectMemberAdded', refreshProjectFromRealtime);
  useSignalREvent('ProjectMemberRemoved', refreshProjectFromRealtime);
  useSignalREvent('ProjectLeaderUpdated', refreshProjectFromRealtime);
  useSignalREvent('IncidentUpdated', refreshProjectFromRealtime);
  useSignalREvent('ProjectUpdated', refreshProjectFromRealtime);
  useSignalREvent('IncidentCreated', refreshProjectFromRealtime);

  const handleStatusChange = async (newStatus: 'inprogress' | 'paused' | 'done') => {
    if (!project) return;
    setStatusError(null);
    const prevStatus = project.status;

    try {
      if (newStatus === 'inprogress') {
        // Optimistic update UI real-time
        setProject(prev => prev ? { ...prev, status: 'inprogress' } : null);

        const result = prevStatus === 'paused'
          ? await projectService.resumeProject(project.id)
          : await projectService.activateProject(project.id);
        toast.success(
          result.__message
          || (prevStatus === 'paused'
            ? 'Tiếp tục dự án thành công.'
            : 'Kích hoạt dự án thành công.'),
        );
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        fetchProjectDetails(false);
      } else if (newStatus === 'paused') {
        setPauseReason("");
        setIsPauseModalOpen(true);
      } else if (newStatus === 'done') {
        // Optimistic update UI real-time
        setProject(prev => prev ? { ...prev, status: 'done' } : null);
        await projectService.completeProject(project.id);
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        fetchProjectDetails(false);
      }
    } catch (err: any) {
      // Revert if error occurs
      setProject(prev => prev ? { ...prev, status: prevStatus } : null);
      setStatusError(err.message || 'Có lỗi xảy ra khi đổi trạng thái');
    }
  };

  const handleConfirmPause = async () => {
    if (!project) return;
    const prevStatus = project.status;
    setIsPausing(true);
    setStatusError(null);

    // Optimistic update UI real-time immediately
    setProject(prev => prev ? { ...prev, status: 'paused' } : null);
    setIsPauseModalOpen(false);

    try {
      await projectService.pauseProject(project.id, pauseReason || "Tạm dừng dự án");
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      await fetchProjectDetails(false);
    } catch (err: any) {
      // Revert UI if API failed
      setProject(prev => prev ? { ...prev, status: prevStatus } : null);
      setStatusError(err.message || 'Có lỗi xảy ra khi tạm dừng dự án');
      setIsPauseModalOpen(true);
    } finally {
      setIsPausing(false);
    }
  };

  if (loading || isAccessLoading) {
    return <FullScreenLoading message="Đang tải thông tin không gian làm việc..." />;
  }

  if (!canViewProject || projectError || !project) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-2">
          Truy cập bị từ chối
        </h2>
        <p className="text-sm text-[hsl(var(--text-muted))] max-w-md mb-6">
          {projectError || 'Bạn không có quyền truy cập vào dự án này. Chỉ các thành viên thuộc dự án hoặc người có thẩm quyền mới có thể xem thông tin dự án.'}
        </p>
        <button
          onClick={() => navigate('/projects')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow transition-colors cursor-pointer"
        >
          Quay lại danh sách dự án
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Back button and Info header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={() => navigate('/projects')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: 'hsl(var(--text-secondary))',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            width: 'fit-content'
          }}
        >
          <ArrowLeft size={16} />
          <span>Quay lại danh sách dự án</span>
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{project.name}</h1>
              {project.status === 'draft' && <span className="badge" style={{ backgroundColor: 'hsl(var(--text-muted))', color: 'white' }}>Bản nháp </span>}
              {project.status === 'inprogress' && <span className="badge badge-success">Đang chạy</span>}
              {project.status === 'paused' && <span className="badge badge-warning">Tạm dừng </span>}
              {project.status === 'done' && <span className="badge badge-success">Hoàn thành </span>}
              {(project.pauseReason || project.status !== 'draft') && (
                <button
                  onClick={() => setIsHistoryModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'hsl(var(--secondary) / 0.15)',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '0.8rem',
                    color: 'hsl(var(--primary))',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  title="Xem lịch sử trạng thái & hoạt động dự án"
                >
                  <History size={13} />
                  Lịch sử hoạt động
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={14} style={{ color: 'hsl(var(--text-muted))' }} />
                {project.address}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} style={{ color: 'hsl(var(--text-muted))' }} />
                Hạn: {project.startDate?.split('-').reverse().join('-')} → {project.endDate?.split('-').reverse().join('-')}
              </span>
            </div>

            {project.status === 'paused' && project.pauseReason && (() => {
              const history = parseStatusHistory(project.pauseReason, project);
              const lastPause = [...history].reverse().find(h => h.type === 'pause');
              const pauseUser = lastPause?.user || "Hệ thống";
              const pauseTime = lastPause?.timestamp
                ? new Date(lastPause.timestamp).toLocaleString('vi-VN')
                : (project.pausedAt ? new Date(project.pausedAt).toLocaleString('vi-VN') : null);

              return (
                <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: 'hsl(var(--warning) / 0.1)', borderLeft: '4px solid hsl(var(--warning))', color: 'hsl(var(--warning))', fontSize: '0.9rem', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div>
                      <strong>Lý do tạm dừng:</strong> {cleanPauseReason(project.pauseReason)}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '0.82rem', color: 'hsl(var(--warning))', opacity: 0.95, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {pauseTime && <span>🕒 Thời gian: {pauseTime}</span>}
                      <span>👤 Thực hiện bởi: <strong>{pauseUser}</strong></span>
                    </div>
                    {hasUnapprovedEmergencyIncident && (
                      <div style={{ marginTop: '6px', fontSize: '0.82rem', color: 'hsl(346 84% 35%)', fontWeight: 600 }}>
                        🔒 Đang chờ Giám đốc phê duyệt phương án khắc phục sự cố khẩn cấp.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {canViewReports && (
              <>
                <button onClick={() => navigate(`/projects/${projectId}/reports/boq`)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={16} /> Báo cáo BOQ
                </button>
                <button onClick={() => navigate(`/reports?projectId=${projectId}&tab=procurement`)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} /> Mua sắm & Chi phí
                </button>
              </>
            )}

            {/* Nút Sửa chỉ dành cho TPKT */}
            {canEditProject && project.status !== 'done' && project.status !== 'paused' && (
              <button onClick={() => setIsEditOpen(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit3 size={16} /> Sửa
              </button>
            )}

            {/* Project Status Actions cho PL và TPKT */}
            {canChangeProjectStatus && (
              <>
                {project.status === 'draft' && (
                  <button onClick={() => handleStatusChange('inprogress')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Play size={16} /> Kích hoạt Dự án
                  </button>
                )}
                {project.status === 'inprogress' && (
                  <>
                    <button onClick={() => handleStatusChange('paused')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'hsl(var(--warning))', color: 'hsl(var(--warning))' }}>
                      <Pause size={16} /> Tạm dừng
                    </button>
                    <button
                      onClick={() => handleStatusChange('done')}
                      disabled={project.progress < 100}
                      className="btn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: project.progress < 100 ? 'hsl(var(--text-muted))' : 'hsl(var(--success))',
                        color: 'white',
                        cursor: project.progress < 100 ? 'not-allowed' : 'pointer',
                        opacity: project.progress < 100 ? 0.7 : 1
                      }}
                      title={project.progress < 100 ? "Tiến độ dự án chưa đạt 100%" : "Hoàn thành dự án"}
                    >
                      <CheckCircle size={16} /> Hoàn thành
                    </button>
                  </>
                )}
                {project.status === 'paused' && !hasUnapprovedEmergencyIncident && (
                  <button onClick={() => handleStatusChange('inprogress')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Play size={16} /> Tiếp tục Dự án
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {statusError && (
          <div className="animate-fade-in" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px',
            backgroundColor: 'hsl(var(--danger-glow))',
            border: '1px solid hsl(var(--danger) / 0.2)',
            borderRadius: 'var(--radius-sm)',
            color: 'hsl(346 84% 35%)',
            fontSize: '0.85rem'
          }}>
            <AlertCircle size={16} />
            <span>{statusError}</span>
          </div>
        )}
      </div>

      {/* Progress display */}
      <div className="glass-panel" style={{
        padding: '24px 32px',
        background: 'linear-gradient(135deg, hsl(var(--bg-card-glass)) 0%, hsl(var(--primary-glow) / 0.1) 100%)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
            TIẾN ĐỘ THI CÔNG DỰ ÁN
          </span>
          <strong style={{ fontSize: '2.2rem', fontWeight: 900, color: 'hsl(var(--primary))', letterSpacing: '-0.02em' }}>
            {project.progress}%
          </strong>
        </div>

        {/* Large Progress bar */}
        <div style={{
          height: '20px',
          backgroundColor: 'hsl(var(--border))',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
        }}>
          <div style={{
            width: `${project.progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, hsl(var(--primary-hover)) 0%, hsl(var(--primary)) 100%)',
            boxShadow: '0 0 10px hsl(var(--primary) / 0.5)',
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>
      </div>

      {/* Navigation Tabs Header */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid hsl(var(--border))',
        gap: '8px',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => handleTabChange('wbs')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'wbs' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'wbs' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'wbs' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <FolderGit2 size={18} />
          <span>Kế hoạch thi công</span>
        </button>

        <button
          onClick={() => handleTabChange('members')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'members' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'members' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'members' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Users size={18} />
          <span>Thành viên dự án</span>
        </button>

        <button
          onClick={() => handleTabChange('materialrequests')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'materialrequests' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'materialrequests' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'materialrequests' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <ClipboardList size={18} />
          <span>Yêu cầu vật tư</span>
        </button>

        <button
          onClick={() => handleTabChange('purchaseorders')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'purchaseorders' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'purchaseorders' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'purchaseorders' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <ShoppingCart size={18} />
          <span>Đơn hàng</span>
        </button>

        <button
          onClick={() => handleTabChange('inventory')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'inventory' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'inventory' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'inventory' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Package size={18} />
          <span>Quản lý kho</span>
        </button>

        <button
          onClick={() => handleTabChange('logs')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'logs' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'logs' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'logs' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Clock size={18} />
          <span>Nhật ký thi công</span>
        </button>

        <button
          onClick={() => handleTabChange('incidents')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'incidents' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'incidents' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'incidents' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <AlertCircle size={18} />
          <span>Sự cố</span>
        </button>

        <button
          onClick={() => handleTabChange('inventoryadjustments')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'inventoryadjustments' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'inventoryadjustments' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'inventoryadjustments' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <FileSignature size={18} />
          <span>Kiểm kê vật tư</span>
        </button>

        {canManageDirectPurchase && (
          <button
            onClick={() => handleTabChange('directpurchases')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'directpurchases' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
              color: activeTab === 'directpurchases' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
              fontWeight: activeTab === 'directpurchases' ? 600 : 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-fast)'
            }}
          >
            <ShoppingBag size={18} />
            <span>Mua khẩn cấp</span>
          </button>
        )}

        <button
          onClick={() => handleTabChange('surplus')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'surplus' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'surplus' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'surplus' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <PackageMinus size={18} />
          <span>Xử lý Vật tư thừa</span>
        </button>

        <button
          onClick={() => handleTabChange('suppliers')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'suppliers' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'suppliers' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'suppliers' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Truck size={18} />
          <span>{'NCC đã giao dịch'}</span>
        </button>

      </div>

      {/* Tab Contents */}
      {project.status === 'paused' && activeTab !== 'incidents' && !(activeTab === 'wbs' && isTPKT && hasApprovedEmergencyIncident) && (
        <div style={{
          padding: '12px 16px',
          background: 'hsl(var(--warning-glow))',
          border: '1px solid hsl(var(--warning)/0.3)',
          borderRadius: '8px',
          color: 'hsl(var(--warning))',
          marginTop: '16px',
          marginBottom: '6px',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>Dự án đang tạm dừng thi công.</strong> Tất cả thao tác tạo lập, chỉnh sửa và phê duyệt trên phân hệ này đã bị khóa (chỉ được xem). Vui lòng chuyển sang <strong>Sự cố thi công</strong> để lập báo cáo hoặc xử lý sự cố.
          </span>
        </div>
      )}

      {project.status === 'paused' && activeTab === 'wbs' && isTPKT && hasApprovedEmergencyIncident && (
        <div style={{
          padding: '12px 16px',
          background: 'hsl(var(--success-glow))',
          border: '1px solid hsl(var(--success)/0.3)',
          borderRadius: '8px',
          color: 'hsl(var(--success))',
          marginTop: '16px',
          marginBottom: '6px',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={16} style={{ flexShrink: 0, color: 'hsl(var(--success))' }} />
          <span>
            <strong>Báo cáo khắc phục sự cố đã được phê duyệt.</strong> Phân hệ Kế hoạch thi công đã được mở khóa riêng cho Trưởng phòng Kỹ thuật để tạo các Giai đoạn (Phase) hoặc Công việc (Task) khắc phục mới. Sau khi lập xong kế hoạch, vui lòng nhấn nút <strong>"Tiếp tục Dự án"</strong> ở góc trên bên phải để kích hoạt dự án thi công lại.
          </span>
        </div>
      )}

      {(project.status || '').toLowerCase() === 'paused' && (
        <style>{`
          .paused-project-readonly-container form:not(.search-form):not(.filter-form) {
            pointer-events: none !important;
            opacity: 0.7 !important;
          }
          .paused-project-readonly-container input:not([placeholder*="Tìm"]):not([placeholder*="search"]):not([type="search"]),
          .paused-project-readonly-container textarea,
          .paused-project-readonly-container select:not(.filter-select):not(.limit-select) {
            pointer-events: none !important;
            opacity: 0.65 !important;
            background-color: rgba(0, 0, 0, 0.05) !important;
          }
          .paused-project-readonly-container button.btn-primary,
          .paused-project-readonly-container button[variant="primary"],
          .paused-project-readonly-container button:has(.lucide-plus),
          .paused-project-readonly-container button:has(.lucide-trash2),
          .paused-project-readonly-container button:has(.lucide-edit),
          .paused-project-readonly-container button:has(.lucide-edit2),
          .paused-project-readonly-container button:has(.lucide-upload-cloud),
          .paused-project-readonly-container button:has(svg[class*="lucide-plus"]),
          .paused-project-readonly-container button:has(svg[class*="lucide-trash"]),
          .paused-project-readonly-container button:has(svg[class*="lucide-edit"]),
          .paused-project-readonly-container a.btn-primary,
          .paused-project-readonly-container .btn-primary {
            pointer-events: none !important;
            opacity: 0.4 !important;
            cursor: not-allowed !important;
          }
        `}</style>
      )}

      <div
        className={`animate-fade-in ${(project.status || '').toLowerCase() === 'paused' && activeTab !== 'incidents' && !(activeTab === 'wbs' && isTPKT && hasApprovedEmergencyIncident) ? 'paused-project-readonly-container' : ''}`}
        style={{ marginTop: '10px' }}
      >
        {activeTab === 'members' && <ProjectMembers projectId={project.id} />}
        {activeTab === 'wbs' && <WBSWorkspace projectId={project.id} />}
        {activeTab === 'logs' && <DailyLogFeed projectId={project.id} />}
        {activeTab === 'materialrequests' && <ProjectMaterialRequestsTab projectId={Number(project.id)} />}
        {activeTab === 'inventory' && <InventoryWorkspace projectId={Number(project.id)} projectStatus={project.status} />}
        {activeTab === 'inventoryadjustments' && <AdjustmentList projectId={Number(project.id)} />}
        {activeTab === 'surplus' && <SurplusWorkspace projectId={Number(project.id)} projectName={project.name} />}
        {activeTab === 'incidents' && <ProjectIncidents projectId={project.id} projectName={project.name} />}
        {activeTab === 'inventoryincidents' && <GlobalInventoryIncidents projectId={Number(project.id)} />}
        {activeTab === 'purchaseorders' && <ProjectPOTab projectId={Number(project.id)} />}
        {activeTab === 'suppliers' && <ProjectRelatedSuppliersTab projectId={Number(project.id)} />}
        {activeTab === 'directpurchases' && <ProjectDirectPurchaseTab projectId={Number(project.id)} />}
      </div>

      {isEditOpen && project && (
        <EditProjectModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSuccess={fetchProjectDetails}
          project={project}
        />
      )}

      {isPauseModalOpen && project && (
        <Modal
          isOpen={isPauseModalOpen}
          onClose={() => !isPausing && setIsPauseModalOpen(false)}
          title="Tạm dừng dự án"
          width="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setIsPauseModalOpen(false)} disabled={isPausing} className="mr-3">
                Hủy bỏ
              </Button>
              <Button variant="danger" onClick={handleConfirmPause} isLoading={isPausing}>
                Xác nhận Tạm dừng
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              Bạn đang yêu cầu tạm dừng dự án <strong>{project.name}</strong>. Vui lòng cung cấp lý do tạm dừng (không bắt buộc nhưng khuyến nghị).
            </p>
            <FormItem label="Lý do tạm dừng">
              <Input
                placeholder="Nhập lý do tạm dừng dự án..."
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                disabled={isPausing}
                autoFocus
              />
            </FormItem>
          </div>
        </Modal>
      )}

      {isHistoryModalOpen && project && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title="Lịch sử trạng thái dự án"
          width="lg"
          footer={
            <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>
              Đóng
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
              Nhật ký ghi nhận lịch sử các mốc kích hoạt dự án, tạm dừng thi công, tiếp tục thi công và hoàn thành dự án.
            </p>

            <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid hsl(var(--border))', marginLeft: '12px', display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '10px' }}>
              {parseStatusHistory(project.pauseReason, project).map((item, index) => {
                const isPause = item.type === 'pause';
                const isActivate = item.type === 'activate' || item.type === 'start';
                const isComplete = item.type === 'complete' || item.type === 'close';
                const formattedDate = item.timestamp ? new Date(item.timestamp).toLocaleString('vi-VN') : 'Không rõ thời gian';

                let dotBg = 'hsl(var(--success-glow))';
                let dotBorder = 'hsl(var(--success))';
                let dotColor = 'hsl(var(--success))';
                let title = '⚡ Tiếp tục thi công';

                if (isPause) {
                  dotBg = 'hsl(var(--danger-glow))';
                  dotBorder = 'hsl(var(--danger))';
                  dotColor = 'hsl(var(--danger))';
                  title = '🛑 Tạm dừng dự án';
                } else if (isActivate) {
                  dotBg = 'hsl(var(--primary-glow))';
                  dotBorder = 'hsl(var(--primary))';
                  dotColor = 'hsl(var(--primary))';
                  title = '🚀 Kích hoạt dự án';
                } else if (isComplete) {
                  dotBg = 'rgba(139, 92, 246, 0.15)';
                  dotBorder = '#8b5cf6';
                  dotColor = '#8b5cf6';
                  title = '🎉 Hoàn thành dự án';
                }

                return (
                  <div key={index} style={{ position: 'relative' }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute',
                      left: '-34px',
                      top: '2px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: dotBg,
                      border: `2px solid ${dotBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: dotColor,
                      zIndex: 1
                    }}>
                      {isPause ? (
                        <Pause size={10} style={{ color: 'inherit' }} />
                      ) : isComplete ? (
                        <CheckCircle size={10} style={{ color: 'inherit' }} />
                      ) : (
                        <Play size={10} style={{ color: 'inherit' }} />
                      )}
                    </div>

                    {/* Timeline Content card */}
                    <div style={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: dotColor
                        }}>
                          {title}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {formattedDate}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))' }}>
                        Thực hiện bởi: <strong>{item.user || 'Hệ thống'}</strong>
                      </div>

                      {item.reason && (
                        <div style={{
                          backgroundColor: isPause ? 'hsl(var(--muted)/0.3)' : 'hsl(var(--bg-main))',
                          borderLeft: `3px solid ${dotBorder}`,
                          padding: '8px 12px',
                          borderRadius: '4px',
                          fontSize: '0.88rem',
                          color: 'hsl(var(--text-primary))',
                          marginTop: '4px',
                          whiteSpace: 'pre-wrap'
                        }}>
                          <strong>{isPause ? 'Lý do dừng:' : isActivate ? 'Nội dung:' : isComplete ? 'Nội dung:' : 'Ghi chú:'}</strong> {isPause ? cleanPauseReason(item.reason) : item.reason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
