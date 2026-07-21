import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { incidentService } from '../../services/incidentService';
import type { IncidentReport, WBSTask, WBSPhase, ProjectMember } from '../../types/common';
import { ResolveIncidentModal } from '../Incidents/modals/ResolveIncidentModal';
import { IncidentDetailModal } from '../Incidents/modals/IncidentDetailModal';
import { CreateDecreaseAdjustmentModal } from '../InventoryAdjustments/components/CreateDecreaseAdjustmentModal';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { Badge, Button, Pagination } from '../../components/ui';
import { useNotification } from '../../context/NotificationContext';
import { useSignalREvent } from '../../hooks/useSignalREvent';

export const GlobalIncidents: React.FC = () => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { connection } = useNotification();
  const [activeTab, setActiveTab] = useState<'construction' | 'inventory'>(
    user?.role === 'accountant' ? 'inventory' : 'construction'
  );

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Modals & Selected States
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [selectedTask, setSelectedTask] = useState<WBSTask | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<WBSPhase | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isDecreaseOpen, setIsDecreaseOpen] = useState(false);
  const [loadingRowAction, setLoadingRowAction] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const visibleIncidents = incidents.filter(inc => {
    if (activeTab === 'inventory') {
      return inc.incidentType === 'InventoryLoss' || inc.incidentType === 'InventoryDamage';
    }
    return inc.incidentType !== 'InventoryLoss' && inc.incidentType !== 'InventoryDamage';
  });

  const totalPages = Math.ceil(visibleIncidents.length / ITEMS_PER_PAGE);
  const paginatedIncidents = visibleIncidents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const loadData = async () => {
    setLoading(true);
    try {
      const incListDto = await incidentService.getAllIncidents();
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
          phaseName: dto.phaseName || 'Không xác định',
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
      setError('Lỗi khi tải dữ liệu sự cố toàn hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Tham gia SignalR group chung (Project_0)
  useEffect(() => {
    if (!connection) return;

    const joinGroup = () => {
      connection.invoke('JoinProjectGroup', 0)
        .catch((e) => console.error(`[SignalR] JoinProjectGroup error:`, e));
    };

    if (connection.state === 'Connected') {
      joinGroup();
    }

    connection.onreconnected(joinGroup);

    return () => {
      if (connection.state === 'Connected') {
        connection.invoke('LeaveProjectGroup', 0).catch(console.error);
      }
    };
  }, [connection]);

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
      setSuccess(msg);
      setTimeout(() => setSuccess(null), 3000);
    }
    loadData();
  };

  const handleError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const handleRowClick = async (inc: IncidentReport) => {
    setLoadingRowAction(inc.id);
    try {
      const [tList, pList, mList] = await Promise.all([
        projectService.getTasks(inc.projectId),
        projectService.getPhases(inc.projectId),
        projectService.getMembers(inc.projectId)
      ]);
      const task = tList.find(t => t.id === inc.taskId);
      const phase = pList.find(p => p.id === inc.phaseId) || pList.find(p => p.id === task?.phaseId);

      setSelectedTask(task || null);
      setSelectedPhase(phase || null);
      setProjectMembers(mList);

      setSelectedIncident(inc);
      setIsDetailOpen(true);
    } catch (err) {
      console.error(err);
      handleError('Lỗi khi tải thông tin chi tiết sự cố.');
    } finally {
      setLoadingRowAction(null);
    }
  };

  const getStatusBadge = (status: string, incidentType: string) => {
    switch (status) {
      case 'Reported':
        return <Badge variant="warning" className="normal-case">Báo cáo mới</Badge>;
      case 'Assessing':
        return <Badge variant="danger" className="normal-case">Yêu cầu bổ sung</Badge>;
      case 'WaitingReview':
      case 'Assessed':
        return <Badge variant="info" className="normal-case">Chờ TPKT duyệt</Badge>;
      case 'WaitingStopApproval':
        return <Badge variant="danger" className="normal-case bg-[hsl(0_100%_96%)] text-[hsl(0_92%_50%)]">Chờ duyệt dừng thi công</Badge>;
      case 'WaitingRecoveryPlan':
        return <Badge variant="warning" className="normal-case bg-[hsl(280_100%_97%)] text-[hsl(280_70%_45%)]">Chờ lập kế hoạch</Badge>;
      case 'WaitingDirectorApproval':
        return <Badge variant="success" className="normal-case bg-[hsl(142_100%_97%)] text-[hsl(142_71%_40%)]">Chờ Giám đốc duyệt</Badge>;
      case 'WaitingAccountant':
        return <Badge variant="warning" className="normal-case">Chờ Kế toán xác minh</Badge>;
      case 'WaitingDirector':
        return <Badge variant="warning" className="normal-case">Chờ Giám đốc phê duyệt</Badge>;
      case 'Approved':
        if (incidentType === 'InventoryLoss' || incidentType === 'InventoryDamage') {
          return <Badge variant="success" className="normal-case bg-[hsl(var(--success-glow))] text-[hsl(var(--success))]">Chờ GĐ duyệt kho</Badge>;
        }
        return <Badge variant="success" className="normal-case">Đã phê duyệt</Badge>;
      case 'Confirmed':
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

  const effectivePhase = selectedPhase;

  return (
    <div className="flex flex-col gap-5">

      {success && (
        <div className="animate-fade-in py-2.5 px-3.5 bg-[hsl(var(--success-glow))] border border-[hsl(var(--success)/0.2)] rounded-sm text-[hsl(142_70%_30%)] text-[0.85rem]">
          {success}
        </div>
      )}
      {error && (
        <div className="animate-fade-in py-2.5 px-3.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm text-[hsl(346_84%_35%)] text-[0.85rem]">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 mb-2">
        <div>
          <h3 className="text-[1.3rem] font-bold m-0">
            Quản lý Sự cố Toàn hệ thống
          </h3>
          <p className="text-[0.85rem] text-[hsl(var(--text-muted))] mt-1 mb-0">
            Tổng hợp toàn bộ báo cáo sự cố (Thi công / Vật tư) trên toàn hệ thống
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-[hsl(var(--border))] mb-4">
        {user?.role !== 'accountant' && (
          <button
            className={`px-4 py-2 text-[0.95rem] font-semibold border-b-2 transition-colors ${activeTab === 'construction' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'}`}
            onClick={() => setActiveTab('construction')}
          >
            Sự cố Thi công
          </button>
        )}
        <button
          className={`px-4 py-2 text-[0.95rem] font-semibold border-b-2 transition-colors ${activeTab === 'inventory' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'}`}
          onClick={() => setActiveTab('inventory')}
        >
          Sự cố Kho vật tư
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,_minmax(200px,_1fr))] gap-4">
        <div className="card p-4 flex items-center gap-3 border-l-4 border-[hsl(var(--primary))]">
          <div className="p-2.5 rounded-full bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">TỔNG SỰ CỐ</span>
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
              {visibleIncidents.filter(i => !['Approved', 'Confirmed', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3 border-l-4 border-[hsl(var(--success))]">
          <div className="p-2.5 rounded-full bg-[hsl(var(--success-glow))] text-[hsl(var(--success))] shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">ĐÃ KHẮC PHỤC</span>
            <strong className="text-[1.4rem] font-bold">
              {visibleIncidents.filter(i => ['Approved', 'Confirmed', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h4 className="text-[0.95rem] font-semibold text-[hsl(var(--text-secondary))] mb-3.5 pb-2 border-b border-[hsl(var(--border))]">
          Danh sách Báo cáo sự cố
        </h4>

        {loading ? (
          <div className="flex justify-center items-center py-10 gap-2 text-[hsl(var(--text-muted))]">
            <Loader2 className="animate-spin" size={20} />
            Đang tải dữ liệu toàn hệ thống...
          </div>
        ) : visibleIncidents.length === 0 ? (
          <div className="text-center py-10 text-[hsl(var(--text-muted))] text-[0.9rem] border border-dashed border-[hsl(var(--border))] rounded-md">
            Hệ thống chưa ghi nhận sự cố nào.
          </div>
        ) : (
          <div className="table-container">
            <div className="overflow-x-auto w-full">
              <table>
                <thead>
                  <tr>
                    <th>Ngày báo cáo</th>
                    <th>Dự án</th>
                    <th>Công việc / Giai đoạn</th>
                    <th>Người báo cáo</th>
                    <th>Trạng thái</th>
                    <th className="text-center">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedIncidents.map((inc) => (
                    <tr key={inc.id}
                      className={`cursor-pointer hover:bg-[hsl(var(--bg-main)/0.5)] transition-colors ${loadingRowAction === inc.id ? 'opacity-50 pointer-events-none' : ''}`}
                      onClick={() => handleRowClick(inc)}>
                      <td className="whitespace-nowrap text-sm">{inc.date}</td>
                      <td>
                        <strong className="text-[0.88rem] text-[hsl(var(--primary))]">{inc.projectName || `Dự án #${inc.projectId}`}</strong>
                      </td>
                      <td>
                        <strong className="text-[0.88rem]">
                          {inc.isEmergency
                            ? '🛑 Toàn bộ dự án (Yêu cầu dừng)'
                            : (inc.incidentType === 'InventoryLoss' || inc.incidentType === 'InventoryDamage')
                              ? (inc.phaseName || 'Giai đoạn')
                              : (inc.taskName || 'Công việc')}
                        </strong>
                      </td>
                      <td className="text-sm">{inc.reporterName}</td>
                      <td className="whitespace-nowrap">{getStatusBadge(inc.status, inc.incidentType)}</td>
                      <td className="text-center">
                        <Button variant="secondary" className="py-1 px-2 text-[0.75rem] h-auto">
                          {loadingRowAction === inc.id ? <Loader2 size={12} className="animate-spin" /> : 'Xem'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && visibleIncidents.length > 0 && (
          <div className="border-t border-[hsl(var(--border))] mt-4 pt-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {isDetailOpen && selectedIncident && (
        <IncidentDetailModal
          isOpen={isDetailOpen}
          onClose={() => { setIsDetailOpen(false); setSelectedIncident(null); }}
          incident={selectedIncident}
          phase={effectivePhase!}
          user={user ? { id: user.id, name: user.name, role: user.role } : null}
          onResolveClick={() => {
            if (selectedIncident.incidentType === 'InventoryLoss' || selectedIncident.incidentType === 'InventoryDamage') {
              setIsDecreaseOpen(true);
            } else {
              setIsResolveOpen(true);
            }
          }}
          onSuccessAction={handleSuccess}
        />
      )}

      {isResolveOpen && selectedIncident && (selectedTask || effectivePhase) && (
        <ResolveIncidentModal
          isOpen={isResolveOpen}
          onClose={() => setIsResolveOpen(false)}
          incident={selectedIncident}
          task={selectedTask as any}
          phase={effectivePhase!}
          members={projectMembers}
          user={user ? { id: user.id, name: user.name } : null}
          onSuccess={(msg) => {
            setIsDetailOpen(false);
            setSelectedIncident(null);
            handleSuccess(msg);
          }}
          onError={handleError}
        />
      )}

      {isDecreaseOpen && selectedIncident && (
        <CreateDecreaseAdjustmentModal
          isOpen={isDecreaseOpen}
          onClose={() => setIsDecreaseOpen(false)}
          projectId={Number(selectedIncident.projectId)}
          incident={selectedIncident}
          onSuccess={() => {
            setIsDecreaseOpen(false);
            setIsDetailOpen(false);
            setSelectedIncident(null);
            handleSuccess("Đã tạo phiếu giảm tồn kho và cập nhật sự cố.");
          }}
          onError={handleError}
        />
      )}

    </div>
  );
};
