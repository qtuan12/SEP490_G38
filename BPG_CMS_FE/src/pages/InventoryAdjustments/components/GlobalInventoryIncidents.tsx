import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { projectService } from '../../../services/projectService';
import { incidentService } from '../../../services/incidentService';
import type { IncidentReport, WBSPhase } from '../../../types/common';
import { IncidentDetailModal } from '../../Incidents/modals/IncidentDetailModal';
import { CreateDecreaseAdjustmentModal } from '../../Incidents/modals/CreateDecreaseAdjustmentModal';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  FileText
} from 'lucide-react';
import { Badge, Button } from '../../../components/ui';

interface GlobalInventoryIncidentsProps {
  projectId: number;
}

export const GlobalInventoryIncidents: React.FC<GlobalInventoryIncidentsProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Selected States
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<WBSPhase | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadingRowAction, setLoadingRowAction] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAccountant = user?.role === 'accountant';

  // Lọc danh sách sự cố kho/vật tư
  const visibleIncidents = incidents.filter(inc => {
    return inc.incidentType === 'InventoryLoss' || inc.incidentType === 'InventoryDamage';
  });

  const loadData = async () => {
    setLoading(true);
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
          reworkTaskId: dto.reworkTaskId?.toString(),
          date: new Date(dto.createdAt).toLocaleString('vi-VN'),
          images: images
        };
      });

      setIncidents(incList);
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

  const handleSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
    loadData();
  };

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
       const task = tList.find(t => t.id === inc.taskId);
       const phase = pList.find(p => p.id === task?.phaseId);
       
       setSelectedPhase(phase || null);
       
       setSelectedIncident(inc);
       setIsDetailOpen(true);
    } catch(err) {
       console.error(err);
       handleError('Lỗi khi tải thông tin chi tiết sự cố.');
    } finally {
       setLoadingRowAction(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Reported':
        return <Badge variant="warning" className="normal-case">Báo cáo mới</Badge>;
      case 'WaitingAccountant':
        return <Badge variant="warning" className="normal-case">Chờ Kế toán xác minh</Badge>;
      case 'Approved':
      case 'Confirmed':
      case 'Closed':
        return <Badge variant="success" className="normal-case">Đã xử lý</Badge>;
      default:
        return <Badge variant="default" className="normal-case">{status}</Badge>;
    }
  };

  const handleCreateDecrease = (e: React.MouseEvent, inc: IncidentReport) => {
    e.stopPropagation();
    setSelectedIncident(inc);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {success && (
        <div className="bg-[hsl(var(--success-glow))] text-[hsl(var(--success))] p-3 rounded-lg border border-[hsl(var(--success))] text-sm flex items-center gap-2">
          <CheckCircle size={16} />
          {success}
        </div>
      )}
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
              {visibleIncidents.filter(i => !['Approved', 'Confirmed', 'Closed'].includes(i.status)).length}
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
                <th className="p-4 font-semibold">CÔNG VIỆC BỊ SỰ CỐ</th>
                <th className="p-4 font-semibold">PHÂN LOẠI</th>
                <th className="p-4 font-semibold">NGƯỜI BÁO CÁO</th>
                <th className="p-4 font-semibold">TRẠNG THÁI</th>
                <th className="p-4 font-semibold text-center w-32">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[hsl(var(--text-muted))]">
                    <Loader2 className="animate-spin inline-block mr-2" size={20} />
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : visibleIncidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[hsl(var(--text-muted))]">
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
                    <td className="p-4">
                      {inc.taskName === 'Không xác định' 
                        ? <span className="text-[hsl(var(--text-muted))] italic">Không có</span>
                        : inc.taskName
                      }
                    </td>
                    <td className="p-4">
                      <Badge variant="default" className="bg-[hsl(var(--border))] text-[hsl(var(--text-secondary))] normal-case border-none">
                        {inc.incidentType}
                      </Badge>
                    </td>
                    <td className="p-4">{inc.reporterName}</td>
                    <td className="p-4">{getStatusBadge(inc.status)}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        {loadingRowAction === inc.id ? (
                          <Loader2 size={16} className="animate-spin text-[hsl(var(--primary))]" />
                        ) : (
                          <>
                            {isAccountant && inc.status === 'Reported' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleCreateDecrease(e, inc)}
                              >
                                <FileText size={16} /> Lập Phiếu
                              </Button>
                            )}
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
            // Close detail modal, which will cause CreateDecreaseAdjustmentModal to render
            // because of the !isDetailOpen condition below
            setIsDetailOpen(false);
          }}
          onSuccess={handleSuccess}
          onError={handleError}
          onIncidentUpdated={(updatedIncident) => {
            setSelectedIncident(updatedIncident);
            setIncidents(prev => prev.map(inc => inc.id === updatedIncident.id ? updatedIncident : inc));
          }}
          projectId={selectedIncident.projectId}
        />
      )}

      {selectedIncident && !isDetailOpen && (
        <CreateDecreaseAdjustmentModal
          isOpen={true}
          onClose={() => setSelectedIncident(null)}
          incident={selectedIncident}
          projectId={selectedIncident.projectId}
          onSuccess={(msg) => {
            setSelectedIncident(null);
            handleSuccess(msg);
          }}
          onError={(msg) => {
            handleError(msg);
          }}
        />
      )}
    </div>
  );
};
