import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { incidentService } from '../../services/incidentService';
import type { IncidentReport, WBSTask, WBSPhase, ProjectMember } from '../../types/common';
import { ResolveIncidentModal } from '../Incidents/modals/ResolveIncidentModal';
import { IncidentDetailModal } from '../Incidents/modals/IncidentDetailModal';
import { ReportEmergencyStopModal } from '../Incidents/modals/ReportEmergencyStopModal';
import { CreateDecreaseAdjustmentModal } from '../InventoryAdjustments/components/CreateDecreaseAdjustmentModal';
import { LoadingSpinner } from '../../components/ui';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { Badge, Button } from '../../components/ui';
import { useNotification } from '../../context/NotificationContext';
import { useSignalREvent } from '../../hooks/useSignalREvent';
import { useProjectAccess } from '../../hooks/useProjectAccess';
import { parseDateSafe } from '../../utils/dateHelpers';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  projectName?: string;
}

export const ProjectIncidents: React.FC<Props> = ({ projectId, projectName }) => {
  const { user } = useAuth();
  const { isProjectLeader, isProjectActive } = useProjectAccess(projectId);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { connection } = useNotification();
  const [projName, setProjName] = useState(projectName || '');
  const [searchParams, setSearchParams] = useSearchParams();
  const taskIdFilterStr = searchParams.get('taskId');
  const incidentIdParam = searchParams.get('incidentId');

  useEffect(() => {
    if (!projectName && projectId) {
      projectService.getProjectById(projectId).then(res => {
        if (res?.name) setProjName(res.name);
      }).catch(console.error);
    } else if (projectName) {
      setProjName(projectName);
    }
  }, [projectId, projectName]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter states
  const [filterType, setFilterType] = useState<'all' | 'construction' | 'emergency' | 'inventory'>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterStartDate, filterEndDate]);

  // Modal states
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isDecreaseOpen, setIsDecreaseOpen] = useState(false);

  // Auto-open incident detail when incidentId is in query params
  useEffect(() => {
    if (incidentIdParam && incidents.length > 0) {
      const target = incidents.find(i => i.id === incidentIdParam);
      if (target) {
        setSelectedIncident(target);
        setIsDetailOpen(true);
      }
    }
  }, [incidentIdParam, incidents]);

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedIncident(null);
    if (searchParams.has('incidentId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('incidentId');
      setSearchParams(next, { replace: true });
    }
  };

  const [error, setError] = useState<string | null>(null);


  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const incListDtoAll = await incidentService.getIncidents(Number(projectId));
      const incListDto = incListDtoAll;
      const incList: IncidentReport[] = incListDto.map(dto => {
        let desc = dto.description || '';
        const images: string[] = [];

        // Match Markdown image syntax ![alt](url)
        const imgRegex = /!\[.*?\]\((.*?)\)/g;
        let match;
        while ((match = imgRegex.exec(desc)) !== null) {
          images.push(match[1]);
        }

        // Remove the images and the "**Hình ảnh đính kèm:**" text from description
        desc = desc.replace(/\*\*Hình ảnh đính kèm:\*\*/g, '');
        desc = desc.replace(/!\[.*?\]\((.*?)\)/g, '');
        desc = desc.trim();

        return {
          id: dto.incidentId.toString(),
          projectId: dto.projectId.toString(),
          projectName: dto.projectName || projName || '',
          taskId: dto.taskId?.toString() || '',
          taskName: '', // Need to map below
          phaseId: dto.phaseId?.toString() || '',
          phaseName: '', // Need to map below
          reporterId: dto.reportedBy.toString(),
          reporterName: dto.reporterName,
          reviewerId: dto.reviewerBy?.toString(),
          reviewerName: dto.reviewerName,
          incidentType: dto.incidentType as any,
          description: desc,
          status: dto.status as any,
          latestAdjustmentId: dto.latestAdjustmentId,
          latestAdjustmentStatus: dto.latestAdjustmentStatus,
          damageDescription: dto.damageDescription,
          estimatedMaterialLoss: dto.estimatedMaterialLoss,
          estimatedLaborDays: dto.estimatedLaborDays,
          estimatedDelayDays: dto.estimatedDelayDays,
          proposedAction: dto.proposedAction,
          handlingInstruction: dto.handlingInstruction,
          reworkTaskId: dto.reworkTaskId?.toString(),
          isEmergency: dto.isEmergency,
          recoveryPlanText: dto.recoveryPlanText,
          recoveryEstimateCost: dto.recoveryEstimateCost,
          createdAt: dto.createdAt,
          date: (() => {
            const dateStr = dto.createdAt.endsWith('Z') ? dto.createdAt : dto.createdAt + 'Z';
            const d = new Date(dateStr);
            const hours = d.getHours().toString().padStart(2, '0');
            const minutes = d.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
          })(),
          images: images
        };
      });
      const taskList = await projectService.getTasks(projectId);
      const phaseList = await projectService.getPhases(projectId);
      const memberList = await projectService.getMembers(projectId);

      // Map taskName back to incidents
      incList.forEach(inc => {
        const t = taskList.find(x => x.id === inc.taskId);
        if (t) inc.taskName = t.name;

        const p = phaseList.find(x => x.id === inc.phaseId);
        if (p) inc.phaseName = p.name;
      });

      setIncidents(incList.filter(inc =>
        inc.incidentType === 'Construction' ||
        inc.incidentType === 'InventoryLoss' ||
        inc.incidentType === 'InventoryDamage'
      ));
      setTasks(taskList.filter(t => t.status !== 'obsolete'));
      setPhases(phaseList);
      setMembers(memberList);

    } catch (err: any) {
      console.error(err);
      setError('Lỗi khi tải dữ liệu sự cố.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Tham gia SignalR group của dự án
  useEffect(() => {
    if (!connection) return;
    let active = true;

    const joinGroup = () => {
      if (!active || connection.state !== 'Connected') return;
      connection.invoke('JoinProjectGroup', Number(projectId))
        .catch((e) => console.error(`[SignalR] JoinProjectGroup error:`, e));
    };

    if (connection.state === 'Connected') {
      joinGroup();
    }

    connection.onreconnected(joinGroup);

    return () => {
      active = false;
      if (connection.state === 'Connected') {
        connection.invoke('LeaveProjectGroup', Number(projectId)).catch(console.error);
      }
    };
  }, [connection, projectId]);

  useSignalREvent('IncidentCreated', () => {
    loadData();
  });

  useSignalREvent('IncidentUpdated', () => {
    loadData();
  });

  useEffect(() => {
    if (selectedIncident && isDetailOpen) {
      const updated = incidents.find(i => i.id === selectedIncident.id);
      if (updated) {
        setSelectedIncident(updated);
      }
    }
  }, [incidents, selectedIncident, isDetailOpen]);

  const handleSuccess = (msg?: string) => {
    if (msg) {
      toast.success(msg);
    }
    loadData();
  };

  const handleError = (msg: string) => {
    toast.error(msg);
  };

  // Help functions for UI
  const getStatusBadge = (status: string, incidentType: string) => {
    switch (status) {
      case 'Reported':
        return <Badge variant="warning" className="normal-case">Báo cáo mới</Badge>;
      case 'Assessing':
        return <Badge variant="danger" className="normal-case">Yêu cầu bổ sung</Badge>;
      case 'WaitingAccountant':
        return <Badge variant="warning" className="normal-case">Chờ Kế toán xác minh</Badge>;
      case 'UnderResolution':
        return <Badge variant="warning" className="normal-case">Đang xử lý tổn thất</Badge>;
      case 'WaitingReview':
        return <Badge variant="info" className="normal-case">Chờ phê duyệt</Badge>;
      case 'WaitingStopApproval':
        return <Badge variant="danger" className="normal-case bg-[hsl(0_100%_96%)] text-[hsl(0_92%_50%)]">Chờ duyệt dừng thi công</Badge>;
      case 'WaitingRecoveryPlan':
        return <Badge variant="warning" className="normal-case bg-[hsl(280_100%_97%)] text-[hsl(280_70%_45%)]">Chờ lập kế hoạch</Badge>;
      case 'WaitingDirectorApproval':
        return <Badge variant="success" className="normal-case bg-[hsl(142_100%_97%)] text-[hsl(142_71%_40%)]">Chờ Giám đốc duyệt</Badge>;
      case 'Approved':
        if (incidentType === 'InventoryLoss' || incidentType === 'InventoryDamage') {
          return <Badge variant="success" className="normal-case bg-[hsl(var(--success-glow))] text-[hsl(var(--success))]">Đã phê duyệt</Badge>;
        }
        return <Badge variant="success" className="normal-case">Đã phê duyệt</Badge>;
      case 'Rejected':
        return <Badge variant="danger" className="normal-case">Từ chối</Badge>;
      case 'Closed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-[hsl(210_20%_90%)] text-[hsl(var(--text-secondary))] text-[0.75rem] normal-case">Đã đóng</span>;
      case 'Resolved':
        return <Badge variant="default" className="normal-case bg-[hsl(var(--border))] text-[hsl(var(--text-secondary))]">Đã xử lý</Badge>;
      default:
        return <Badge variant="default" className="normal-case bg-[hsl(var(--border))] text-[hsl(var(--text-secondary))]">{status}</Badge>;
    }
  };

  // Check deadline reserves
  const selectedTask = selectedIncident ? tasks.find(t => t.id === selectedIncident.taskId) : null;
  const selectedTaskPhase = selectedTask ? phases.find(p => p.id === selectedTask.phaseId) || null : null;
  // If incident is inventory, it has phaseId directly
  const selectedInventoryPhase = selectedIncident ? phases.find(p => p.id === selectedIncident.phaseId) || null : null;
  const effectivePhase = selectedTaskPhase || selectedInventoryPhase;

  // Filter logic
  const filteredIncidents = incidents.filter(inc => {
    if (taskIdFilterStr && inc.taskId !== taskIdFilterStr) {
      return false;
    }

    if (filterType === 'construction' && (inc.incidentType !== 'Construction' || inc.isEmergency)) {
      return false;
    }
    if (filterType === 'emergency' && !inc.isEmergency) {
      return false;
    }
    if (filterType === 'inventory' && inc.incidentType !== 'InventoryLoss' && inc.incidentType !== 'InventoryDamage') {
      return false;
    }

    if (inc.createdAt) {
      const incDate = parseDateSafe(inc.createdAt);

      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (incDate < start) return false;
      }

      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (incDate > end) return false;
      }
    }

    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredIncidents.length / ITEMS_PER_PAGE);
  const paginatedIncidents = filteredIncidents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const isPL = isProjectLeader;
  const hasActiveEmergencyStop = incidents.some(
    i => i.isEmergency && ['WaitingStopApproval', 'WaitingRecoveryPlan', 'WaitingDirectorApproval'].includes(i.status)
  );

  return (
    <div className="flex flex-col gap-5">

      {error && (
        <div className="animate-fade-in py-2.5 px-3.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm text-[hsl(346_84%_35%)] text-[0.85rem]">
          {error}
        </div>
      )}

      {/* Summary Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(200px,_1fr))] gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">TỔNG SỐ SỰ CỐ DỰ ÁN</span>
            <strong className="text-[1.4rem] font-bold">{incidents.length}</strong>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-[hsl(var(--warning-glow))] text-[hsl(var(--warning))] shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">CHỜ XỬ LÝ / PHẢN HỒI</span>
            <strong className="text-[1.4rem] font-bold">
              {incidents.filter(i => !['Approved', 'Confirmed', 'Resolved', 'Closed', 'Rejected'].includes(i.status)).length}
            </strong>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-[hsl(var(--success-glow))] text-[hsl(var(--success))] shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">ĐÃ PHÊ DUYỆT / XỬ LÝ</span>
            <strong className="text-[1.4rem] font-bold">
              {incidents.filter(i => ['Approved', 'Confirmed', 'Resolved', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))] shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">ĐÃ TỪ CHỐI</span>
            <strong className="text-[1.4rem] font-bold">
              {incidents.filter(i => i.status === 'Rejected').length}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Incidents Table */}
      <div className="card p-5">
        <div className="flex justify-between items-center mb-3.5 pb-2 border-b border-[hsl(var(--border))]">
          <h4 className="text-[0.95rem] font-semibold text-[hsl(var(--text-secondary))]">
            Danh sách Báo cáo sự cố toàn dự án
          </h4>
          {isPL && isProjectActive && !hasActiveEmergencyStop && (
            <Button
              onClick={() => setIsEmergencyModalOpen(true)}
              className="bg-[hsl(0_72%_45%)] hover:bg-[hsl(0_72%_35%)] text-white font-medium py-1.5 px-3 rounded text-[0.8rem] flex items-center gap-1.5"
            >
              🛑 Yêu cầu dừng thi công khẩn cấp
            </Button>
          )}
        </div>

        {loading ? (
          <LoadingSpinner size="md" label="Đang tải báo cáo sự cố..." className="py-12" />
        ) : (
          <>
            {/* Filters Container */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              alignItems: 'center',
              marginBottom: '20px',
              padding: '14px',
              backgroundColor: 'hsl(var(--bg-muted)/0.4)',
              borderRadius: '8px',
              border: '1px solid hsl(var(--border))'
            }}>
              {/* Filter Type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Phân loại sự cố</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--bg-card))',
                    color: 'hsl(var(--text-primary))',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  <option value="all">Tất cả sự cố</option>
                  <option value="construction">🏗 Sự cố thi công</option>
                  <option value="emergency">🛑 Sự cố khẩn cấp</option>
                  <option value="inventory">📦 Sự cố vật tư kho</option>
                </select>
              </div>

              {/* Filter Start Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Từ ngày</span>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--bg-card))',
                    color: 'hsl(var(--text-primary))',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Filter End Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Đến ngày</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--bg-card))',
                    color: 'hsl(var(--text-primary))',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Clear Filters Button */}
              {(filterType !== 'all' || filterStartDate || filterEndDate) && (
                <button
                  onClick={() => {
                    setFilterType('all');
                    setFilterStartDate('');
                    setFilterEndDate('');
                  }}
                  style={{
                    alignSelf: 'flex-end',
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'hsl(var(--danger))',
                    fontWeight: 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  className="hover:opacity-80"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>

            {filteredIncidents.length === 0 ? (
              <div className="text-center py-10 text-[hsl(var(--text-muted))] text-[0.9rem] border border-dashed border-[hsl(var(--border))] rounded-md">
                {incidents.length === 0 ? "Chưa ghi nhận sự cố nào tại dự án này." : "Không tìm thấy sự cố nào phù hợp với bộ lọc."}
              </div>
            ) : (
              <div className="table-container">
                <div className="overflow-x-auto w-full">
                  <table>
                    <thead>
                      <tr>
                        <th>Ngày báo cáo</th>
                        <th>Phân loại</th>
                        <th>Công việc / Giai đoạn bị sự cố</th>
                        <th>Người báo cáo</th>
                        <th>Trạng thái</th>
                        <th className="text-center">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedIncidents.map((inc) => (
                        <tr key={inc.id} className="cursor-pointer hover:bg-[hsl(var(--bg-main)/0.5)] transition-colors" onClick={() => { setSelectedIncident(inc); setIsDetailOpen(true); }}>
                          <td className="whitespace-nowrap text-sm">{inc.date}</td>
                          <td>
                            {inc.isEmergency ? (
                              <Badge variant="danger" className="normal-case bg-[hsl(0_100%_97%)] text-[hsl(0_90%_45%)] border-[hsl(0_80%_80%)]">🛑 Khẩn cấp</Badge>
                            ) : inc.incidentType === 'Construction' ? (
                              <Badge variant="warning" className="normal-case bg-[hsl(28_100%_97%)] text-[hsl(28_90%_45%)] border-[hsl(28_80%_80%)]">🏗 Thi công</Badge>
                            ) : (
                              <Badge variant="info" className="normal-case bg-[hsl(210_100%_97%)] text-[hsl(210_70%_40%)] border-[hsl(210_70%_80%)]">📦 Vật tư kho</Badge>
                            )}
                          </td>
                          <td>
                            <strong className="text-[0.88rem]">
                              {inc.isEmergency
                                ? '🛑 Toàn bộ dự án (Yêu cầu dừng)'
                                : (inc.incidentType === 'InventoryLoss' || inc.incidentType === 'InventoryDamage')
                                  ? (inc.phaseName || 'Giai đoạn')
                                  : (inc.taskName || 'Không xác định')}
                            </strong>
                          </td>
                          <td className="text-sm">{inc.reporterName}</td>
                          <td className="whitespace-nowrap">{getStatusBadge(inc.status, inc.incidentType)}</td>
                          <td className="text-center">
                            <Button variant="secondary" className="py-1 px-2 text-[0.75rem] h-auto">Xem</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-4 gap-4" style={{ padding: '16px 0' }}>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{
                        color: currentPage === 1 ? 'hsl(var(--text-muted))' : 'hsl(var(--text-secondary))',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        background: 'none',
                        border: 'none',
                        fontWeight: 500,
                        fontSize: '0.9rem'
                      }}
                    >
                      Trang trước
                    </button>

                    <div style={{
                      padding: '6px 16px',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '20px',
                      fontWeight: 600,
                      color: '#2563eb', // text-blue-600
                      fontSize: '0.9rem'
                    }}>
                      <span style={{ color: '#2563eb' }}>Trang {currentPage}</span> <span style={{ color: 'hsl(var(--text-secondary))' }}>/ {totalPages}</span>
                    </div>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        color: currentPage === totalPages ? 'hsl(var(--text-muted))' : 'hsl(var(--text-secondary))',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        background: 'none',
                        border: 'none',
                        fontWeight: 500,
                        fontSize: '0.9rem'
                      }}
                    >
                      Trang sau
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── MODAL 1: DETAILED INCIDENT & WORKFLOW VIEW ─── */}
      {isDetailOpen && selectedIncident && (
        <IncidentDetailModal
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
          incident={selectedIncident}
          phase={effectivePhase!}
          user={user ? { id: user.id, name: user.name, role: user.role } : null}
          task={selectedTask || undefined}
          members={members}
          onResolveClick={() => {
            if (selectedIncident.incidentType === 'InventoryLoss' || selectedIncident.incidentType === 'InventoryDamage') {
              setIsDetailOpen(false);
              setIsDecreaseOpen(true);
            } else {
              setIsResolveOpen(true);
            }
          }}
          onSuccessAction={handleSuccess}
        />
      )}

      {/* ─── MODAL 5: APPROVE & RESOLVE REWORK TASK (TPKT / ACCOUNTANT) ─── */}
      {isResolveOpen && selectedIncident && selectedTask && (
        <ResolveIncidentModal
          isOpen={isResolveOpen}
          onClose={() => setIsResolveOpen(false)}
          incident={selectedIncident}
          task={selectedTask}
          phase={effectivePhase!}
          members={members}
          user={user ? { id: user.id, name: user.name } : null}
          onSuccess={(msg) => {
            setIsDetailOpen(false);
            setSelectedIncident(null);
            handleSuccess(msg);
          }}
          onError={handleError}
        />
      )}

      <ReportEmergencyStopModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        projectId={projectId}
        projectName={projName}
        onSuccess={handleSuccess}
      />

      {isDecreaseOpen && selectedIncident && (
        <CreateDecreaseAdjustmentModal
          isOpen={isDecreaseOpen}
          onClose={() => setIsDecreaseOpen(false)}
          onSuccess={() => {
            setIsDecreaseOpen(false);
            handleSuccess('Đã xử lý sự cố vật tư kho thành công.');
          }}
          projectId={Number(projectId)}
          incident={selectedIncident}
        />
      )}
    </div>
  );
};
