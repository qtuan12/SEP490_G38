import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { projectService } from '../../../services/projectService';
import { incidentService } from '../../../services/incidentService';
import type { IncidentReport, WBSPhase } from '../../../types/common';
import { IncidentDetailModal } from '../../Incidents/modals/IncidentDetailModal';
import { CreateDecreaseAdjustmentModal } from './CreateDecreaseAdjustmentModal';
import {
  AlertTriangle,
  Clock,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { Badge } from '../../../components/ui';
import { useNotification } from '../../../context/NotificationContext';
import { useSignalREvent } from '../../../hooks/useSignalREvent';
import { useRealtimeDataRefresh } from '../../../hooks/useRealtimeDataRefresh';
import {
  REALTIME_DATA_CHANGED_AGGREGATION_MS,
  RealtimeEntities,
} from '../../../constants/realtimeEntities';

interface GlobalInventoryIncidentsProps {
  projectId: number;
}

export const GlobalInventoryIncidents: React.FC<GlobalInventoryIncidentsProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { connection } = useNotification();
  const realtimeRefreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals & Selected States
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<WBSPhase | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDecreaseOpen, setIsDecreaseOpen] = useState(false);
  const [loadingRowAction, setLoadingRowAction] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const incidentIdParam = searchParams.get('incidentId');

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

  const [error, setError] = useState<string | null>(null);

  // Lọc danh sách sự cố kho/vật tư
  const visibleIncidents = incidents.filter(inc => {
    return inc.incidentType === 'InventoryLoss' || inc.incidentType === 'InventoryDamage';
  });

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const incListDto = projectId > 0 ? await incidentService.getIncidents(projectId) : await incidentService.getAllIncidents();
      const incList: IncidentReport[] = incListDto.map(dto => {
        let desc = dto.description || '';
        const images: string[] = [];

        const imgRegex = /!\[.*?\]\((.*?)\)/g;
        let match;
        while ((match = imgRegex.exec(desc)) !== null) {
          images.push(match[1]);
        }

        desc = desc.replace(/\*\*Hình ảnh đính kèm:\*\*/g, '');
        desc = desc.replace(/!\[.*?\]\((.*?)\)/g, '');
        desc = desc.trim();

        return {
          id: dto.incidentId.toString(),
          projectId: dto.projectId.toString(),
          projectName: dto.projectName,
          taskId: dto.taskId?.toString() || '',
          taskName: dto.taskName || 'Không xác định',
          phaseId: dto.phaseId?.toString() || '',
          phaseName: dto.phaseName || '',
          reporterId: dto.reportedBy.toString(),
          reporterName: dto.reporterName,
          reviewerId: dto.reviewerBy?.toString(),
          reviewerName: dto.reviewerName,
          incidentType: dto.incidentType as any,
          description: desc,
          status: dto.status as any,
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

      setIncidents(incList);
    } catch (err: any) {
      console.error(err);
      if (showLoading) setError('Lỗi khi tải dữ liệu sự cố.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Tham gia SignalR group
  useEffect(() => {
    if (!connection || projectId === null || projectId === undefined || projectId < 0) return;
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

  const scheduleRealtimeRefresh = () => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadData(false);
    }, REALTIME_DATA_CHANGED_AGGREGATION_MS);
  };

  useEffect(() => () => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
  }, [projectId]);

  useSignalREvent('IncidentCreated', scheduleRealtimeRefresh);
  useSignalREvent('IncidentUpdated', scheduleRealtimeRefresh);
  useRealtimeDataRefresh(scheduleRealtimeRefresh, RealtimeEntities.incidents, 0);

  useEffect(() => {
    if (selectedIncident && isDetailOpen) {
      const updated = incidents.find(i => i.id === selectedIncident.id);
      if (updated) {
        setSelectedIncident(updated);
      }
    }
  }, [incidents, selectedIncident, isDetailOpen]);

  const handleError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const handleRowClick = async (inc: IncidentReport) => {
    setLoadingRowAction(inc.id);
    try {
      const [tList, pList] = await Promise.all([
        projectService.getTasks(inc.projectId),
        projectService.getPhases(inc.projectId)
      ]);
      let phase = pList.find(p => p.id === inc.phaseId);
      if (!phase && inc.taskId) {
        const task = tList.find(t => t.id === inc.taskId);
        phase = pList.find(p => p.id === task?.phaseId);
      }

      setSelectedPhase(phase || null);

      setSelectedIncident({
        ...inc,
        phaseId: phase ? phase.id.toString() : inc.phaseId,
        phaseName: phase ? phase.name : inc.phaseName
      });
      setIsDetailOpen(true);
    } catch (err) {
      console.error(err);
      handleError('Lỗi khi tải thông tin chi tiết sự cố.');
    } finally {
      setLoadingRowAction(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Reported':
        return <Badge className="normal-case bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50">Báo cáo mới</Badge>;
      case 'WaitingAccountant':
        return <Badge className="normal-case bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50">Chờ Kế toán xác minh</Badge>;
      case 'WaitingDirector':
        return <Badge className="normal-case bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-50">Chờ Giám đốc duyệt</Badge>;
      case 'Approved':
      case 'Confirmed':
      case 'Closed':
      case 'Resolved':
        return <Badge className="normal-case bg-green-50 text-green-700 border border-green-200 hover:bg-green-50">Đã xử lý</Badge>;
      case 'Rejected':
        return <Badge className="normal-case bg-red-50 text-red-700 border border-red-200 hover:bg-red-50">Bị từ chối</Badge>;
      default:
        return <Badge variant="default" className="normal-case">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {error && (
        <div className="bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))] p-3 rounded-lg border border-[hsl(var(--danger))] text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(200px,_1fr))] gap-4">
        <div className="card p-4 flex items-center gap-3 border-l-4 border-[hsl(var(--primary))]">
          <div className="p-2.5 rounded-full bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">TỔNG SỰ CỐ VẬT TƯ</span>
            <strong className="text-[1.4rem] font-bold">{visibleIncidents.length}</strong>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3 border-l-4 border-[hsl(var(--warning))]">
          <div className="p-2.5 rounded-full bg-[hsl(var(--warning-glow))] text-[hsl(var(--warning))] shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">CHỜ XỬ LÝ</span>
            <strong className="text-[1.4rem] font-bold">
              {visibleIncidents.filter(i => !['Approved', 'Confirmed', 'Closed', 'Rejected'].includes(i.status)).length}
            </strong>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3 border-l-4 border-[hsl(var(--success))]">
          <div className="p-2.5 rounded-full bg-[hsl(var(--success-glow))] text-[hsl(var(--success))] shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">ĐÃ XỬ LÝ</span>
            <strong className="text-[1.4rem] font-bold">
              {visibleIncidents.filter(i => ['Approved', 'Confirmed', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-[hsl(var(--border))]">
          <h3 className="font-semibold text-[1.1rem]">Danh sách Báo cáo sự cố</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[hsl(var(--bg-card-hover))] text-left text-[hsl(var(--text-muted))]">
                <th className="p-4 font-semibold">DỰ ÁN</th>
                <th className="p-4 font-semibold">NGÀY BÁO CÁO</th>
                <th className="p-4 font-semibold">NGƯỜI BÁO CÁO</th>
                <th className="p-4 font-semibold">TRẠNG THÁI</th>
                <th className="p-4 font-semibold text-center w-32">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[hsl(var(--text-muted))]">
                    <Loader2 className="animate-spin inline-block mr-2" size={20} />
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : visibleIncidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[hsl(var(--text-muted))]">
                    Không có sự cố vật tư/kho nào.
                  </td>
                </tr>
              ) : (
                visibleIncidents.map(inc => (
                  <tr
                    key={inc.id}
                    className="hover:bg-[hsl(var(--bg-card-hover))] cursor-pointer transition-colors"
                    onClick={() => handleRowClick(inc)}
                  >
                    <td className="p-4 font-medium text-[hsl(var(--primary))]">{inc.projectName}</td>
                    <td className="p-4 text-[hsl(var(--text-secondary))]">{inc.date}</td>
                    <td className="p-4">{inc.reporterName}</td>
                    <td className="p-4">{getStatusBadge(inc.status)}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        {loadingRowAction === inc.id ? (
                          <Loader2 size={16} className="animate-spin text-[hsl(var(--primary))]" />
                        ) : (
                          <>
                            <button className="text-[hsl(var(--primary))] hover:underline text-sm font-medium px-2 py-1">
                              Xem
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isDetailOpen && selectedIncident && (
        <IncidentDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedIncident(null);
            setSelectedPhase(null);
          }}
          incident={selectedIncident}
          phase={selectedPhase!}
          user={user ? { id: user.id, name: user.name, role: user.role } : null}
          onResolveClick={() => {
            setIsDetailOpen(false);
            setIsDecreaseOpen(true);
          }}
          onSuccessAction={scheduleRealtimeRefresh}
        />
      )}

      {isDecreaseOpen && selectedIncident && (
        <CreateDecreaseAdjustmentModal
          isOpen={isDecreaseOpen}
          onClose={() => setIsDecreaseOpen(false)}
          onSuccess={(msg) => {
            setIsDecreaseOpen(false);
            if (msg) toast.success(msg);
            scheduleRealtimeRefresh();
          }}
          projectId={projectId}
          incident={selectedIncident}
        />
      )}
    </div>
  );
};
