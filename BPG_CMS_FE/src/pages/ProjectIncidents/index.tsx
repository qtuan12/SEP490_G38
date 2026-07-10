import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { incidentService } from '../../services/incidentService';
import type { IncidentReport, WBSTask, WBSPhase, ProjectMember } from '../../types/common';
import { ResolveIncidentModal } from '../Incidents/modals/ResolveIncidentModal';
import { IncidentDetailModal } from '../Incidents/modals/IncidentDetailModal';
import {
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Badge, Button } from '../../components/ui';
import { useNotification } from '../../context/NotificationContext';
import { useSignalREvent } from '../../hooks/useSignalREvent';

interface Props {
  projectId: string;
}

export const ProjectIncidents: React.FC<Props> = ({ projectId }) => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { connection } = useNotification();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modal states
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  const loadData = async () => {
    setLoading(true);
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
          damageDescription: dto.damageDescription,
          estimatedMaterialLoss: dto.estimatedMaterialLoss,
          estimatedLaborDays: dto.estimatedLaborDays,
          estimatedDelayDays: dto.estimatedDelayDays,
          proposedAction: dto.proposedAction,
          handlingInstruction: dto.handlingInstruction,
          reworkTaskId: dto.reworkTaskId?.toString(),
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

      setIncidents(incList); // Do not filter by task, show all incidents for the project!
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

    const joinGroup = () => {
      connection.invoke('JoinProjectGroup', Number(projectId))
        .catch((e) => console.error(`[SignalR] JoinProjectGroup error:`, e));
    };

    if (connection.state === 'Connected') {
      joinGroup();
    }

    connection.onreconnected(joinGroup);

    return () => {
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

  // Help functions for UI
  const getStatusBadge = (status: string, incidentType: string) => {
    switch (status) {
      case 'Reported':
        return <Badge variant="warning" className="normal-case">Báo cáo mới</Badge>;
      case 'Assessing':
        return <Badge variant="danger" className="normal-case">Yêu cầu bổ sung</Badge>;
      case 'WaitingAccountant':
        return <Badge variant="warning" className="normal-case">Chờ Kế toán xác minh</Badge>;
      case 'WaitingDirector':
        return <Badge variant="warning" className="normal-case">Chờ Giám đốc phê duyệt</Badge>;
      case 'WaitingReview':
        return <Badge variant="info" className="normal-case">Chờ TPKT duyệt</Badge>;
      case 'Approved':
        if (incidentType === 'InventoryLoss' || incidentType === 'InventoryDamage') {
          return <Badge variant="success" className="normal-case bg-[hsl(var(--success-glow))] text-[hsl(var(--success))]">Đang trình GĐ duyệt kho</Badge>;
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

  // Pagination logic
  const totalPages = Math.ceil(incidents.length / ITEMS_PER_PAGE);
  const paginatedIncidents = incidents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col gap-5">

      {/* Notifications */}
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
              {incidents.filter(i => !['Approved', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-[hsl(var(--success-glow))] text-[hsl(var(--success))] shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="block text-[0.75rem] text-[hsl(var(--text-muted))] font-semibold">ĐÃ KHẮC PHỤC (REWORKED)</span>
            <strong className="text-[1.4rem] font-bold">
              {incidents.filter(i => ['Approved', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Incidents Table */}
      <div className="card p-5">
        <h4 className="text-[0.95rem] font-semibold text-[hsl(var(--text-secondary))] mb-3.5 pb-2 border-b border-[hsl(var(--border))]">
          Danh sách Báo cáo sự cố toàn dự án
        </h4>

        {loading ? (
          <div className="text-center py-8 text-[hsl(var(--text-muted))]">Đang tải báo cáo sự cố...</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-10 text-[hsl(var(--text-muted))] text-[0.9rem] border border-dashed border-[hsl(var(--border))] rounded-md">
            Chưa ghi nhận sự cố nào tại dự án này.
          </div>
        ) : (
          <div className="table-container">
            <div className="overflow-x-auto w-full">
              <table>
                <thead>
                  <tr>
                    <th>Ngày báo cáo</th>
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
                      <td><strong className="text-[0.88rem]">{(inc.incidentType === 'InventoryLoss' || inc.incidentType === 'InventoryDamage') ? (inc.phaseName || 'Giai đoạn') : (inc.taskName || 'Không xác định')}</strong></td>
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
      </div>

      {/* ─── MODAL 1: DETAILED INCIDENT & WORKFLOW VIEW ─── */}
      {isDetailOpen && selectedIncident && (
        <IncidentDetailModal
          isOpen={isDetailOpen}
          onClose={() => { setIsDetailOpen(false); setSelectedIncident(null); }}
          incident={selectedIncident}
          phase={effectivePhase!}
          user={user ? { id: user.id, name: user.name, role: user.role } : null}
          onResolveClick={() => setIsResolveOpen(true)}
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

    </div>
  );
};
