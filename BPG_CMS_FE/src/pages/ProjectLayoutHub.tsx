import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { projectService } from '../services/projectService';
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
  AlertTriangle,
} from 'lucide-react';
import { InventoryWorkspace } from './InventoryWorkspace/InventoryWorkspace';
import { SurplusWorkspace } from './SurplusWorkspace/SurplusWorkspace';
import { ProjectIncidents } from './ProjectIncidents';
import { ProjectPOTab } from './ProjectLayoutHub/ProjectPOTab';
import { ProjectDirectPurchaseTab } from './ProjectLayoutHub/ProjectDirectPurchaseTab';
import { AdjustmentList } from './InventoryAdjustments/components/AdjustmentList';
import { GlobalInventoryIncidents } from './InventoryAdjustments/components/GlobalInventoryIncidents';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const cleanPauseReason = (reason: string): string => {
  if (!reason) return "";
  return reason
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\*\*Hình ảnh đính kèm:?\*\*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const ProjectLayoutHub: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user } = useAuth();
  const { connection } = useNotification();
  const [isPL, setIsPL] = useState(false);
  const isTPKT = user?.role === 'technicalmanager' || user?.role === 'admin';

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const isAccountant = user?.role === 'accountant';
  const [isAssignedLeader, setIsAssignedLeader] = useState(false);

  type TabKey = 'members' | 'wbs' | 'logs' | 'inventory' | 'inventoryadjustments' | 'incidents' | 'inventoryincidents' | 'surplus' | 'purchaseorders' | 'directpurchases';
  const TAB_KEYS: TabKey[] = ['members', 'wbs', 'logs', 'inventory', 'inventoryadjustments', 'incidents', 'inventoryincidents', 'surplus', 'purchaseorders', 'directpurchases'];

  const [activeTab, setActiveTab] = useState<TabKey>(
    (searchParams.get('tab') as TabKey) || 'wbs'
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
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

  const fetchProjectDetails = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await projectService.getProjectById(projectId);
      setProject(data);

      const members = await projectService.getMembers(projectId);
      const currentMember = members.find(m => m.userId === user?.id);
      const memberIsLeader = currentMember?.isLeader ?? false;
      setIsAssignedLeader(memberIsLeader);
      setIsPL(memberIsLeader || user?.role === 'admin' || user?.role === 'technicalmanager');
    } catch (err) {
      console.error('Error loading project details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  useEffect(() => {
    if (!connection || !projectId) return;

    const handleWbsUpdated = () => {
      console.log('ProjectLayoutHub received WbsTreeUpdated, reloading project details for progress...');
      fetchProjectDetails();
    };

    connection.on('WbsTreeUpdated', handleWbsUpdated);

    return () => {
      connection.off('WbsTreeUpdated', handleWbsUpdated);
    };
  }, [connection, projectId]);

  // Handle reload when tabs perform updates
  // const handleTabUpdate = () => {
  //   fetchProjectDetails();
  // };

  const handleStatusChange = async (newStatus: 'inprogress' | 'paused' | 'done') => {
    if (!project) return;
    setStatusError(null);
    try {
      if (newStatus === 'inprogress') {
        if (project.status === 'paused') {
          await projectService.resumeProject(project.id);
        } else {
          await projectService.activateProject(project.id);
        }
        fetchProjectDetails(); // reload
      } else if (newStatus === 'paused') {
        setPauseReason("");
        setIsPauseModalOpen(true);
      } else {
        await projectService.updateProject(project.id, { status: newStatus });
        fetchProjectDetails(); // reload
      }
    } catch (err: any) {
      setStatusError(err.message || 'Có lỗi xảy ra khi đổi trạng thái');
    }
  };

  const handleConfirmPause = async () => {
    if (!project) return;
    setIsPausing(true);
    setStatusError(null);
    try {
      await projectService.pauseProject(project.id, pauseReason || "Tạm dừng dự án");
      await fetchProjectDetails();
      setIsPauseModalOpen(false);
    } catch (err: any) {
      setStatusError(err.message || 'Có lỗi xảy ra khi tạm dừng dự án');
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

            {project.status === 'paused' && project.pauseReason && (
              <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: 'hsl(var(--warning) / 0.1)', borderLeft: '4px solid hsl(var(--warning))', color: 'hsl(var(--warning))', fontSize: '0.9rem', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <strong>Lý do tạm dừng:</strong> {cleanPauseReason(project.pauseReason)}
                  {project.pausedAt && <span style={{ marginLeft: '8px', fontSize: '0.85em', opacity: 0.8 }}>(Thời gian: {new Date(project.pausedAt).toLocaleString('vi-VN')})</span>}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {(user?.role === 'director' || user?.role === 'accountant') && (
              <>
                <button onClick={() => navigate(`/projects/${projectId}/reports/boq`)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={16} /> Báo cáo BOQ
                </button>
                <button onClick={() => navigate(`/projects/${projectId}/reports/cost`)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} /> Báo cáo Chi phí
                </button>
              </>
            )}

            {/* Nút Sửa chỉ dành cho TPKT/Admin */}
            {isTPKT && project.status !== 'done' && (
              <button onClick={() => setIsEditOpen(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit3 size={16} /> Sửa
              </button>
            )}

            {/* Project Status Actions cho PL và TPKT */}
            {isPL && (
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
          <span>Sự cố thi công</span>
        </button>

        <button
          onClick={() => handleTabChange('inventoryincidents')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'inventoryincidents' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'inventoryincidents' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'inventoryincidents' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <AlertTriangle size={18} />
          <span>Sự cố vật tư</span>
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

        {(isAccountant || isAssignedLeader) && (
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
      <div
        className="animate-fade-in"
        style={{ marginTop: '10px' }}
      >
        {activeTab === 'members' && <ProjectMembers projectId={project.id} />}
        {activeTab === 'wbs' && <WBSWorkspace projectId={project.id} />}
        {activeTab === 'logs' && <DailyLogFeed projectId={project.id} />}
        {activeTab === 'inventory' && <InventoryWorkspace projectId={Number(project.id)} />}
        {activeTab === 'inventoryadjustments' && <AdjustmentList projectId={Number(project.id)} />}
        {activeTab === 'surplus' && <SurplusWorkspace projectId={Number(project.id)} projectName={project.name} />}
        {activeTab === 'incidents' && <ProjectIncidents projectId={project.id} />}
        {activeTab === 'inventoryincidents' && <GlobalInventoryIncidents projectId={Number(project.id)} />}
        {activeTab === 'purchaseorders' && <ProjectPOTab projectId={Number(project.id)} />}
        {activeTab === 'directpurchases' && <ProjectDirectPurchaseTab projectId={Number(project.id)} isLeader={isAssignedLeader} />}
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
    </div>
  );
};
