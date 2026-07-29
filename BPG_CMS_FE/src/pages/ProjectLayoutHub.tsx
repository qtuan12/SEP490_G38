import React, { useEffect, useState } from 'react';
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
import { Button, Input, FormItem } from '../components/ui';

import {
  ArrowLeft,
  Users,
  FolderGit2,
  MapPin,
  Calendar,
  Loader2,
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
  FileSignature,
  ClipboardList,
  History,
} from 'lucide-react';
import { InventoryWorkspace } from './InventoryWorkspace/InventoryWorkspace';
import { SurplusWorkspace } from './SurplusWorkspace/SurplusWorkspace';
import { ProjectIncidents } from './ProjectIncidents';
import { ProjectPOTab } from './ProjectLayoutHub/ProjectPOTab';
import { ProjectDirectPurchaseTab } from './ProjectLayoutHub/ProjectDirectPurchaseTab';
import { AdjustmentList } from './InventoryAdjustments/components/AdjustmentList';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useSignalREvent } from '../hooks/useSignalREvent';
import { ProjectMaterialRequestsTab } from './MaterialRequests/components/ProjectMaterialRequestsTab';
import { GlobalInventoryIncidents } from './InventoryAdjustments/components/GlobalInventoryIncidents';
import { isPWAMode } from '../utils/pwaHelpers';
import { useProjectAccess } from '../hooks/useProjectAccess';
import { ProjectPermission, SystemPermission } from '../auth/permissions';

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
  type: 'pause' | 'resume';
  reason?: string;
  timestamp: string;
  user: string;
}

const parseStatusHistory = (rawReason: string | null | undefined): StatusHistoryItem[] => {
  if (!rawReason) return [];
  const trimmed = rawReason.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          type: String(item.type || item.Type || 'pause').toLowerCase() as 'pause' | 'resume',
          reason: item.reason || item.Reason,
          timestamp: item.timestamp || item.Timestamp,
          user: item.user || item.User
        }));
      }
    } catch {
      // Fallback
    }
  }
  return [{
    type: 'pause',
    reason: rawReason,
    timestamp: '',
    user: 'Hệ thống'
  }];
};

export const ProjectLayoutHub: React.FC = () => {
  const queryClient = useQueryClient();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: incidents } = useQuery({
    queryKey: ['projectIncidents', projectId],
    queryFn: () => incidentService.getIncidents(Number(projectId?.replace('p-', ''))),
    enabled: !!projectId
  });
  const hasApprovedEmergencyIncident = incidents?.some(i => i.isEmergency && i.status === 'Approved') ?? false;

  const { hasSystemPermission } = useAuth();
  const { hasProjectPermission } = useProjectAccess(projectId);
  const { connection } = useNotification();
  const isTPKT = hasProjectPermission(ProjectPermission.TechnicalManage);
  const canManageExecution = hasProjectPermission(ProjectPermission.ExecutionManage);
  const canManageAccounting = hasProjectPermission(ProjectPermission.AccountingManage);
  const canViewReports = hasProjectPermission(ProjectPermission.ReportsView);
  const canEditProject = hasSystemPermission(SystemPermission.ProjectsUpdate);
  const canChangeProjectStatus = hasSystemPermission(
    SystemPermission.ProjectsChangeStatus,
  );
  const canManageDirectPurchase = canManageExecution || canManageAccounting;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  type TabKey = 'members' | 'wbs' | 'logs' | 'inventory' | 'inventoryadjustments' | 'incidents' | 'inventoryincidents' | 'surplus' | 'purchaseorders' | 'directpurchases' | 'materialrequests';
  const TAB_KEYS: TabKey[] = ['members', 'wbs', 'logs', 'inventory', 'inventoryadjustments', 'incidents', 'inventoryincidents', 'surplus', 'purchaseorders', 'directpurchases', 'materialrequests'];

  const [activeTab, setActiveTab] = useState<TabKey>(
    (() => {
      const tab = searchParams.get('tab') as TabKey;
      if (tab === 'inventoryincidents') return 'incidents';
      const defaultTab = isPWAMode() ? 'logs' : 'wbs';
      return tab || defaultTab;
    })()
  );

  useEffect(() => {
    let tab = searchParams.get('tab');
    if (tab === 'inventoryincidents') {
      tab = 'incidents';
    }
    if (tab && (TAB_KEYS as string[]).includes(tab)) {
      setActiveTab(tab as TabKey);
    }
  }, [searchParams]);

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

  const fetchProjectDetails = async (isInitial = true) => {
    if (!projectId) return;
    if (isInitial) setLoading(true);
    try {
      queryClient.invalidateQueries({ queryKey: ['projectIncidents', projectId] });
      const data = await projectService.getProjectById(projectId);
      setProject(data);

    } catch (err) {
      console.error('Error loading project details:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails(true);
  }, [projectId]);

  useEffect(() => {
    if (!connection || !projectId) return;

    const numericProjectId = Number(projectId.replace('p-', ''));
    if (isNaN(numericProjectId)) return;

    const joinGroup = () => {
      if (connection.state === 'Connected') {
        connection.invoke('JoinProjectGroup', numericProjectId)
          .catch(err => console.error('SignalR JoinProjectGroup error in ProjectLayoutHub:', err));
      }
    };

    if (connection.state === 'Connected') {
      joinGroup();
    }

    connection.onreconnected(joinGroup);

    return () => {
      if (connection.state === 'Connected') {
        connection.invoke('LeaveProjectGroup', numericProjectId)
          .catch(err => console.error('SignalR LeaveProjectGroup error in ProjectLayoutHub:', err));
      }
    };
  }, [connection, projectId]);

  useEffect(() => {
    if (!connection || !projectId) return;

    const handleWbsUpdated = () => {
      console.log('ProjectLayoutHub received WbsTreeUpdated, reloading project details for progress...');
      fetchProjectDetails(false);
    };

    connection.on('WbsTreeUpdated', handleWbsUpdated);

    return () => {
      connection.off('WbsTreeUpdated', handleWbsUpdated);
    };
  }, [connection, projectId]);

  useSignalREvent('IncidentUpdated', () => {
    console.log('SignalR: IncidentUpdated received in ProjectLayoutHub, reloading project...');
    fetchProjectDetails(false);
  });

  useSignalREvent('ProjectUpdated', () => {
    console.log('SignalR: ProjectUpdated received in ProjectLayoutHub, reloading project...');
    fetchProjectDetails(false);
  });

  useSignalREvent('IncidentCreated', () => {
    console.log('SignalR: IncidentCreated received in ProjectLayoutHub, reloading project...');
    fetchProjectDetails(false);
  });

  const handleStatusChange = async (newStatus: 'inprogress' | 'paused' | 'done') => {
    if (!project) return;
    setStatusError(null);
    const prevStatus = project.status;

    try {
      if (newStatus === 'inprogress') {
        // Optimistic update UI real-time
        setProject(prev => prev ? { ...prev, status: 'inprogress' } : null);

        if (prevStatus === 'paused') {
          await projectService.resumeProject(project.id);
        } else {
          await projectService.activateProject(project.id);
        }
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        fetchProjectDetails(false);
      } else if (newStatus === 'paused') {
        setPauseReason("");
        setIsPauseModalOpen(true);
      } else {
        // Optimistic update UI real-time
        setProject(prev => prev ? { ...prev, status: newStatus } : null);
        await projectService.updateProject(project.id, { status: newStatus });
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '10px' }}>
        <Loader2 className="animate-spin" size={24} style={{ color: 'hsl(var(--primary))' }} />
        <span>Đang tải thông tin không gian làm việc...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <h3>Không tìm thấy dự án</h3>
        <button onClick={() => navigate('/projects')} className="btn btn-primary" style={{ marginTop: '16px' }}>
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
              {project.status === 'inprogress' && <span className="badge badge-primary">Đang triển khai</span>}
              {project.status === 'paused' && <span className="badge badge-warning">Tạm dừng </span>}
              {project.status === 'done' && <span className="badge badge-success">Hoàn thành </span>}
              {project.pauseReason && (
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
                  title="Xem lịch sử dừng & tiếp tục dự án"
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
              const history = parseStatusHistory(project.pauseReason);
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
                <button onClick={() => navigate(`/projects/${projectId}/reports/cost`)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} /> Báo cáo Chi phí
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
                {project.status === 'paused' && (
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
          <span>Kiểm soát Vật tư</span>
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

      {project.status === 'paused' && (
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
        className={`animate-fade-in ${project.status === 'paused' && activeTab !== 'incidents' && !(activeTab === 'wbs' && isTPKT && hasApprovedEmergencyIncident) ? 'paused-project-readonly-container' : ''}`}
        style={{ marginTop: '10px' }}
      >
        {activeTab === 'members' && <ProjectMembers projectId={project.id} />}
        {activeTab === 'wbs' && <WBSWorkspace projectId={project.id} />}
        {activeTab === 'logs' && <DailyLogFeed projectId={project.id} />}
        {activeTab === 'materialrequests' && <ProjectMaterialRequestsTab projectId={Number(project.id)} />}
        {activeTab === 'inventory' && <InventoryWorkspace projectId={Number(project.id)} />}
        {activeTab === 'inventoryadjustments' && <AdjustmentList projectId={Number(project.id)} />}
        {activeTab === 'surplus' && <SurplusWorkspace projectId={Number(project.id)} projectName={project.name} />}
        {activeTab === 'incidents' && <ProjectIncidents projectId={project.id} projectName={project.name} />}
        {activeTab === 'inventoryincidents' && <GlobalInventoryIncidents projectId={Number(project.id)} />}
        {activeTab === 'purchaseorders' && <ProjectPOTab projectId={Number(project.id)} />}
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
          title="Lịch sử dừng & tiếp tục dự án"
          width="lg"
          footer={
            <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>
              Đóng
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
              Nhật ký ghi nhận lịch sử các lần tạm dừng thi công khẩn cấp (sự cố) hoặc tạm dừng chủ động, và kích hoạt hoạt động lại dự án.
            </p>

            <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid hsl(var(--border))', marginLeft: '12px', display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '10px' }}>
              {parseStatusHistory(project.pauseReason).map((item, index) => {
                const isPause = item.type === 'pause';
                const formattedDate = item.timestamp ? new Date(item.timestamp).toLocaleString('vi-VN') : 'Không rõ thời gian';

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
                      backgroundColor: isPause ? 'hsl(var(--danger-glow))' : 'hsl(var(--success-glow))',
                      border: `2px solid ${isPause ? 'hsl(var(--danger))' : 'hsl(var(--success))'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isPause ? 'hsl(var(--danger))' : 'hsl(var(--success))',
                      zIndex: 1
                    }}>
                      {isPause ? <Pause size={10} style={{ color: 'inherit' }} /> : <Play size={10} style={{ color: 'inherit' }} />}
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
                          color: isPause ? 'hsl(var(--danger))' : 'hsl(var(--success))'
                        }}>
                          {isPause ? '🛑 Tạm dừng dự án' : '🚀 Tiếp tục thi công'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {formattedDate}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))' }}>
                        Thực hiện bởi: <strong>{item.user || 'Hệ thống'}</strong>
                      </div>

                      {isPause && item.reason && (
                        <div style={{
                          backgroundColor: 'hsl(var(--muted)/0.3)',
                          borderLeft: '3px solid hsl(var(--danger))',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          fontSize: '0.88rem',
                          color: 'hsl(var(--text-primary))',
                          marginTop: '4px',
                          whiteSpace: 'pre-wrap'
                        }}>
                          <strong>Lý do dừng:</strong> {cleanPauseReason(item.reason)}
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
