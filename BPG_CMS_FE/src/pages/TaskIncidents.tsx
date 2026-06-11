import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type { IncidentReport, WBSTask, WBSPhase, ProjectMember } from '../services/projectService';
import { Modal } from '../components/Modal';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  ArrowRight,
  Info,
  AlertCircle
} from 'lucide-react';

export const TaskIncidents: React.FC = () => {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [isResolveOpen, setIsResolveOpen] = useState(false);

  // Create Incident Form State
  const [createCategory, setCreateCategory] = useState<'Construction' | 'InventoryLoss' | 'InventoryDamage' | 'Delay' | 'Safety' | 'Other'>('Construction');
  const [createDescription, setCreateDescription] = useState('');
  const [createImages, setCreateImages] = useState<string>('');

  // Damage Report Form State
  const [damageDesc, setDamageDesc] = useState('');
  const [damageLoss, setDamageLoss] = useState<number>(0);
  const [damageDays, setDamageDays] = useState<number>(1);
  const [damageDelayDays, setDamageDelayDays] = useState<number>(0);
  const [proposedAction, setProposedAction] = useState<string>('Tạo Rework Task');

  // Resolve/Rework Form State
  const [resolutionAction, setResolutionAction] = useState<'rework' | 'reduce_progress'>('rework');
  const [reworkName, setReworkName] = useState('');
  const [reworkDeadline, setReworkDeadline] = useState('');
  const [reworkAssigneeId, setReworkAssigneeId] = useState('');
  const [reduceProgressValue, setReduceProgressValue] = useState<number>(0);
  const [reduceProgressReason, setReduceProgressReason] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentMember = members.find(m => m.userId === user?.id);
  const isPL = currentMember ? currentMember.isLeader : false;
  const isTPKT = user?.role === 'tpkt' || user?.role === 'admin';
  const canApproveOrRequestRevision = isTPKT; // Only TPKT/Admin can approve/request revision
  const canReportIncident = isPL || isTPKT; // Only PL or TPKT/Admin

  const loadData = async () => {
    if (!projectId || !taskId) return;
    setLoading(true);
    try {
      const incList = await projectService.getIncidents(projectId);
      const taskList = await projectService.getTasks(projectId);
      const phaseList = await projectService.getPhases(projectId);
      const memberList = await projectService.getMembers(projectId);

      setIncidents(incList.filter(i => i.taskId === taskId));
      setTasks(taskList.filter(t => t.status !== 'obsolete'));
      setPhases(phaseList);
      setMembers(memberList);

      if (memberList.length > 0) {
        setReworkAssigneeId(memberList[0].userId);
      }
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



  // 1. Submit Incident & Damage Report (PL)
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDescription.trim()) {
      handleError('Vui lòng nhập mô tả sự cố.');
      return;
    }
    if (!damageDesc.trim()) {
      handleError('Vui lòng nhập mô tả đánh giá thiệt hại.');
      return;
    }

    try {
      const selectedTask = tasks.find(t => t.id === taskId);
      if (!selectedTask) throw new Error('Không tìm thấy công việc.');

      const imgUrls = createImages.split('\n').map(url => url.trim()).filter(Boolean);

      await projectService.createIncident({
        projectId: projectId!,
        taskId: taskId!,
        taskName: selectedTask.name,
        reporterId: user?.id || 'u-unknown',
        reporterName: user?.name || 'PL',
        incidentType: createCategory,
        description: createDescription.trim(),
        images: imgUrls.length > 0 ? imgUrls : ['https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=600&q=80'],
        damageDescription: damageDesc.trim(),
        estimatedMaterialLoss: Number(damageLoss) || 0,
        estimatedLaborDays: Number(damageDays) || 0,
        estimatedDelayDays: Number(damageDelayDays) || 0,
        proposedAction: proposedAction
      });

      handleSuccess('Đã báo cáo sự cố & thiệt hại thành công và chuyển lên TPKT.');
      setIsCreateOpen(false);
      setCreateDescription('');
      setCreateImages('');
      setDamageDesc('');
      setDamageLoss(0);
      setDamageDays(1);
      setDamageDelayDays(0);
      setProposedAction('Tạo Rework Task');
    } catch (err: any) {
      handleError(err.message || 'Lỗi khi báo cáo sự cố.');
    }
  };


  // 4. Approve & Resolve Rework
  const handleResolveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    try {
      let resolutionData: any = {};
      
      if (resolutionAction === 'rework') {
        if (!reworkName.trim()) {
          handleError('Vui lòng nhập tên công việc Rework.');
          return;
        }
        if (!reworkDeadline) {
          handleError('Vui lòng chọn hạn hoàn thành công việc Rework.');
          return;
        }
        const selectedAssignee = members.find(m => m.userId === reworkAssigneeId);
        if (!selectedAssignee) throw new Error('Không tìm thấy kỹ sư đã chọn.');

        resolutionData = {
          name: reworkName.trim(),
          deadline: reworkDeadline,
          assignedTo: reworkAssigneeId,
          assignedName: selectedAssignee.userName
        };
      } else {
        if (reduceProgressValue <= 0 || reduceProgressValue > 100) {
          handleError('Phần trăm giảm tiến độ phải từ 1 đến 100.');
          return;
        }
        resolutionData = {
          reduction: Number(reduceProgressValue),
          reason: reduceProgressReason.trim() || 'Xử lý sự cố'
        };
      }

      await projectService.resolveIncident(
        selectedIncident.id, 
        resolutionAction,
        resolutionData,
        { id: user?.id || 'u-admin', name: user?.name || 'TPKT' }
      );

      handleSuccess(resolutionAction === 'rework' 
        ? `Đã duyệt sự cố và tạo công việc khắc phục: "${reworkName.trim()}"`
        : `Đã duyệt sự cố và giảm ${reduceProgressValue}% tiến độ công việc gốc.`);
        
      setIsResolveOpen(false);
      setIsDetailOpen(false);
      setSelectedIncident(null);
      setReworkName('');
      setReworkDeadline('');
      setReduceProgressValue(0);
      setReduceProgressReason('');
    } catch (err: any) {
      handleError(err.message || 'Lỗi khi duyệt sự cố.');
    }
  };

  // Help functions for UI
  const getStatusBadge = (status: IncidentReport['status']) => {
    switch (status) {
      case 'Reported':
        return <span className="badge badge-warning">Báo cáo mới</span>;
      case 'Assessing':
        return <span className="badge badge-danger">Yêu cầu bổ sung</span>;
      case 'WaitingReview':
        return <span className="badge badge-primary">Chờ TPKT duyệt</span>;
      case 'Approved':
        return <span className="badge badge-success">Đã phê duyệt</span>;
      case 'Rejected':
        return <span className="badge badge-danger">Từ chối</span>;
      case 'Closed':
        return <span className="badge badge-secondary">Đã đóng</span>;
      default:
        return null;
    }
  };

  // Check deadline reserves
  const selectedTask = selectedIncident ? tasks.find(t => t.id === selectedIncident.taskId) : null;
  const selectedTaskPhase = selectedTask ? phases.find(p => p.id === selectedTask.phaseId) : null;
  const isExceedingReserve = reworkDeadline && selectedTaskPhase?.deadline
    ? new Date(reworkDeadline) > new Date(selectedTaskPhase.deadline)
    : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Notifications */}
      {success && (
        <div className="animate-fade-in" style={{ padding: '10px 14px', backgroundColor: 'hsl(var(--success-glow))', border: '1px solid hsl(var(--success) / 0.2)', borderRadius: 'var(--radius-sm)', color: 'hsl(142 70% 30%)', fontSize: '0.85rem' }}>
          {success}
        </div>
      )}
      {error && (
        <div className="animate-fade-in" style={{ padding: '10px 14px', backgroundColor: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.2)', borderRadius: 'var(--radius-sm)', color: 'hsl(346 84% 35%)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Header and Statistics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button 
            className="btn btn-secondary" 
            style={{ marginBottom: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            Quay lại WBS
          </button>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Quản lý Sự cố của Task</h3>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
            Quản lý báo cáo sự cố hư hỏng tại công trường và quy trình tái thi công (Rework)
          </p>
        </div>
        {canReportIncident && (
          <div style={{ display: 'flex', gap: '10px' }}>
          {canReportIncident && (
            <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} /> Lập Báo cáo Sự cố &amp; Thiệt hại
            </button>
          )}
        </div>
        )}
      </div>

      {/* Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '50%', backgroundColor: 'hsl(var(--primary-glow))', color: 'hsl(var(--primary))' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>TỔNG SỐ SỰ CỐ</span>
            <strong style={{ fontSize: '1.4rem' }}>{incidents.length}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '50%', backgroundColor: 'hsl(var(--warning-glow))', color: 'hsl(var(--warning))' }}>
            <Clock size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>CHỜ XỬ LÝ / PHẢN HỒI</span>
            <strong style={{ fontSize: '1.4rem' }}>
              {incidents.filter(i => !['Approved', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '50%', backgroundColor: 'hsl(var(--success-glow))', color: 'hsl(var(--success))' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>ĐÃ KHẮC PHỤC (REWORKED)</span>
            <strong style={{ fontSize: '1.4rem' }}>
              {incidents.filter(i => ['Approved', 'Closed'].includes(i.status)).length}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Incidents Table */}
      <div className="card" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
          Danh sách Báo cáo sự cố cho Công việc này
        </h4>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))' }}>Đang tải báo cáo sự cố...</div>
        ) : incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
            Chưa ghi nhận sự cố thi công nào tại dự án này.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Ngày báo cáo</th>
                  <th>Công việc bị sự cố</th>
                  <th>Phân loại</th>
                  <th>Người báo cáo</th>
                  <th>Mô tả sự cố</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedIncident(inc); setIsDetailOpen(true); }}>
                    <td>{inc.date}</td>
                    <td><strong style={{ fontSize: '0.88rem' }}>{inc.taskName}</strong></td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'hsl(210 20% 90%)', color: 'hsl(var(--text-secondary))' }}>{inc.incidentType}</span>
                    </td>
                    <td>{inc.reporterName}</td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inc.description}
                    </td>
                    <td>{getStatusBadge(inc.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Xem</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL 1: DETAILED INCIDENT & WORKFLOW VIEW ─── */}
      {isDetailOpen && selectedIncident && (
        <Modal isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setSelectedIncident(null); }} title="Chi tiết xử lý Sự cố thi công">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* Phase info warning reserve check */}
            {selectedTaskPhase && (
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', backgroundColor: 'hsl(var(--bg-main))', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                Phase hiện tại: <strong>{selectedTaskPhase.name}</strong> · Hạn chót giai đoạn (Phase Deadline): <strong style={{ color: 'hsl(var(--primary))' }}>{selectedTaskPhase.deadline || 'Không có'}</strong>
              </div>
            )}

            {/* Steps Visual Tracker */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'hsl(var(--bg-main) / 0.5)', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border))' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'hsl(var(--success))', color: '#fff', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, justifyContent: 'center' }}>1</div>
                <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Sự cố</span>
              </div>
              <ArrowRight size={14} style={{ color: 'hsl(var(--text-muted))' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: selectedIncident.damageDescription ? 'hsl(var(--success))' : 'hsl(var(--border))', color: selectedIncident.damageDescription ? '#fff' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, justifyContent: 'center' }}>2</div>
                <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Thiệt hại</span>
              </div>
              <ArrowRight size={14} style={{ color: 'hsl(var(--text-muted))' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: selectedIncident.status === 'Approved' ? 'hsl(var(--success))' : 'hsl(var(--border))', color: selectedIncident.status === 'Approved' ? '#fff' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, justifyContent: 'center' }}>3</div>
                <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Phê duyệt</span>
              </div>
            </div>

            {/* Revision Requested Notice */}
            {selectedIncident.status === 'Assessing' && (
              <div style={{ padding: '12px', backgroundColor: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: '8px', color: 'hsl(var(--danger))' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>Yêu cầu bổ sung từ TPKT:</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{selectedIncident.revisionComment}</p>
                </div>
              </div>
            )}

            {/* Step 1: Incident details */}
            <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.1)' }}>
              <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', fontWeight: 700 }}>BƯỚC 1: BÁO CÁO SỰ CỐ GỐC</span>
              <h4 style={{ margin: '6px 0 8px 0', fontSize: '1rem', fontWeight: 700 }}>{selectedIncident.taskName}</h4>
              <p style={{ fontSize: '0.85rem', margin: '0 0 10px 0', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                {selectedIncident.description}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {selectedIncident.images.map((img, idx) => (
                  <img key={idx} src={img} alt="Sự cố" style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid hsl(var(--border))' }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                <span>Bởi: <strong>{selectedIncident.reporterName}</strong></span>
                <span>Ngày: {selectedIncident.date}</span>
              </div>
            </div>

            {/* Step 2: Damage Report */}
            {selectedIncident.damageDescription && (
              <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.1)' }}>
                <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', fontWeight: 700 }}>BƯỚC 2: BÁO CÁO THIỆT HẠI CHI TIẾT (PROJECT LEADER)</span>
                <p style={{ fontSize: '0.85rem', margin: '6px 0 10px 0', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                  {selectedIncident.damageDescription}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', fontSize: '0.8rem' }}>
                  <div style={{ padding: '8px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'hsl(var(--text-muted))', display: 'block', fontSize: '0.7rem' }}>VẬT TƯ THẤT THOÁT</span>
                    <strong>{selectedIncident.estimatedMaterialLoss?.toLocaleString('vi-VN')} VNĐ</strong>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'hsl(var(--text-muted))', display: 'block', fontSize: '0.7rem' }}>THỜI GIAN KHẮC PHỤC DỰ KIẾN</span>
                    <strong>{selectedIncident.estimatedLaborDays} ngày công</strong>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', fontSize: '0.8rem' }}>
                  <div style={{ padding: '8px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'hsl(var(--text-muted))', display: 'block', fontSize: '0.7rem' }}>SỐ NGÀY TRỄ TIẾN ĐỘ</span>
                    <strong>{selectedIncident.estimatedDelayDays} ngày</strong>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'hsl(var(--text-muted))', display: 'block', fontSize: '0.7rem' }}>ĐỀ XUẤT XỬ LÝ</span>
                    <strong>{selectedIncident.proposedAction}</strong>
                  </div>
                </div>
                
              </div>
            )}

            {/* Step 3: TPKT Decision details */}
            {selectedIncident.status === 'Approved' && (
              <div style={{ border: '1px solid hsl(var(--success) / 0.3)', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'hsl(var(--success-glow))', display: 'flex', gap: '12px' }}>
                <CheckCircle size={20} style={{ color: 'hsl(var(--success))', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'hsl(var(--success))', fontWeight: 700 }}>BƯỚC 3: ĐÃ DUYỆT BỞI {selectedIncident.reviewerName?.toUpperCase()}</span>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'hsl(var(--text-primary))' }}>
                    Sự cố đã được duyệt thành công. Tiến độ công việc hoặc Rework đã được khởi tạo theo quyết định của TPKT.
                  </p>
                </div>
              </div>
            )}

            {/* Consultation Comments Section (Step 2) */}
            <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.1)', marginTop: '8px' }}>
              <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>
                Ý KIẾN THAM KHẢO &amp; TRAO ĐỔI (CONSULTATION)
              </span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', maxHeight: '160px', overflowY: 'auto' }}>
                {!selectedIncident.comments || selectedIncident.comments.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', padding: '4px 0' }}>Chưa có ý kiến trao đổi nào.</span>
                ) : (
                  selectedIncident.comments.map((c) => (
                    <div key={c.id} style={{ padding: '6px 10px', backgroundColor: 'hsl(var(--bg-main) / 0.4)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '2px', color: 'hsl(var(--text-primary))' }}>
                        <span>{c.userName} ({c.role.toUpperCase()})</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'normal', color: 'hsl(var(--text-muted))' }}>{c.date}</span>
                      </div>
                      <p style={{ margin: 0, color: 'hsl(var(--text-secondary))' }}>{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              {user && (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const input = form.elements.namedItem('commentText') as HTMLInputElement;
                    if (!input.value.trim()) return;
                    try {
                      const newComment = await projectService.addIncidentComment(selectedIncident.id, { name: user.name, role: user.role, id: user.id }, input.value.trim());
                      // update current incident comments locally
                      setSelectedIncident(prev => prev ? {
                        ...prev,
                        comments: [...(prev.comments || []), newComment]
                      } : null);
                      input.value = '';
                      // reload other background data
                      const updatedIncList = await projectService.getIncidents(projectId!);
                      setIncidents(updatedIncList.filter(i => i.taskId === taskId));
                    } catch (err: any) {
                      handleError(err.message || 'Lỗi khi gửi ý kiến.');
                    }
                  }}
                  style={{ display: 'flex', gap: '8px', marginTop: '12px' }}
                >
                  <input 
                    name="commentText"
                    type="text" 
                    placeholder="Nhập ý kiến tư vấn trao đổi..." 
                    style={{ flex: 1, fontSize: '0.8rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                  />
                  <button type="submit" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    Gửi ý kiến
                  </button>
                </form>
              )}
            </div>

            {/* Decision Buttons (TPKT/Admin only, only if Damage Report is submitted) */}
            {selectedIncident.status === 'WaitingReview' && canApproveOrRequestRevision && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>

                <button
                  onClick={() => {
                    setIsResolveOpen(true);
                    setReworkName(`[Rework] Khắc phục - ${selectedIncident.taskName}`);
                    setReworkDeadline(selectedTaskPhase?.deadline || '');
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: '0.85rem' }}
                >
                  Phê duyệt xử lý
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── MODAL 2: REPORT NEW INCIDENT & DAMAGE (PL) ─── */}
      {isCreateOpen && (
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Lập Báo cáo Sự cố &amp; Thiệt hại">
          <form onSubmit={handleCreateIncident} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ paddingBottom: '12px', borderBottom: '1px solid hsl(var(--border))' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'hsl(var(--primary))' }}>PHẦN 1: THÔNG TIN SỰ CỐ</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                <div>
                  <label>Phân loại nguồn gốc sự cố</label>
                  <select
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value as any)}
                    required
                  >
                    <option value="Construction">Sự cố Thi công (Construction)</option>
                    <option value="InventoryLoss">Thất thoát vật tư (Inventory Loss)</option>
                    <option value="InventoryDamage">Hư hại vật tư (Inventory Damage)</option>
                    <option value="Delay">Chậm tiến độ (Delay)</option>
                    <option value="Safety">An toàn lao động (Safety)</option>
                    <option value="Other">Khác (Other)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="create-desc">Mô tả chi tiết sự cố hiện trường <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <textarea
                    id="create-desc"
                    placeholder="Nêu rõ diễn biến sự cố, phần kết cấu bị ảnh hưởng, thời điểm phát hiện..."
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    rows={2}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="create-imgs">Hình ảnh hiện trường (Nhập url ảnh, mỗi url 1 dòng)</label>
                  <textarea
                    id="create-imgs"
                    placeholder="https://example.com/photo1.jpg"
                    value={createImages}
                    onChange={(e) => setCreateImages(e.target.value)}
                    rows={1}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'hsl(var(--primary))' }}>PHẦN 2: ĐÁNH GIÁ THIỆT HẠI &amp; ĐỀ XUẤT</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label htmlFor="damage-description">Mô tả đánh giá chi tiết <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <textarea
                    id="damage-description"
                    placeholder="Đánh giá khối lượng thiệt hại, mức độ ảnh hưởng kết cấu..."
                    value={damageDesc}
                    onChange={(e) => setDamageDesc(e.target.value)}
                    rows={2}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="damage-loss">Ước tính vật tư hao phí (VNĐ)</label>
                    <input
                      id="damage-loss"
                      type="number"
                      placeholder="0"
                      value={damageLoss}
                      onChange={(e) => setDamageLoss(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label htmlFor="damage-days">Số ngày nhân công khắc phục <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <input
                      id="damage-days"
                      type="number"
                      min={0}
                      value={damageDays}
                      onChange={(e) => setDamageDays(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="damage-delay">Số ngày dự kiến trễ tiến độ <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <input
                      id="damage-delay"
                      type="number"
                      min={0}
                      value={damageDelayDays}
                      onChange={(e) => setDamageDelayDays(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="proposed-action">Đề xuất xử lý <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <select
                      id="proposed-action"
                      value={proposedAction}
                      onChange={(e) => setProposedAction(e.target.value)}
                      required
                    >
                      <option value="Tạo Rework Task">Tạo Rework Task</option>
                      <option value="Giảm tiến độ task">Giảm tiến độ task</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary">Lưu Báo cáo &amp; Trình TPKT</button>
            </div>
          </form>
        </Modal>
      )}


      {/* ─── MODAL 5: APPROVE & RESOLVE REWORK TASK (TPKT) ─── */}
      {isResolveOpen && selectedIncident && (
        <Modal isOpen={isResolveOpen} onClose={() => setIsResolveOpen(false)} title="Phê duyệt Sự cố">
          <form onSubmit={handleResolveIncident} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', gap: '20px', padding: '10px', backgroundColor: 'hsl(var(--bg-muted))', borderRadius: 'var(--radius-sm)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="resolutionAction" 
                  value="rework" 
                  checked={resolutionAction === 'rework'} 
                  onChange={() => setResolutionAction('rework')} 
                />
                Tạo Rework Task mới
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="resolutionAction" 
                  value="reduce_progress" 
                  checked={resolutionAction === 'reduce_progress'} 
                  onChange={() => setResolutionAction('reduce_progress')} 
                />
                Giảm % tiến độ Task
              </label>
            </div>

            {resolutionAction === 'rework' ? (
              <>
                {/* Phase Deadline Info */}
                {selectedTaskPhase && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: 'hsl(var(--primary-glow))', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'hsl(var(--primary))' }}>
                    <Info size={14} style={{ flexShrink: 0 }} />
                    <span>Hạn chót của Giai đoạn (Phase Deadline): <strong>{selectedTaskPhase.deadline || 'Không xác định'}</strong></span>
                  </div>
                )}

                <div>
                  <label htmlFor="rework-name">Tên Công việc Rework mới <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <input
                    id="rework-name"
                    type="text"
                    value={reworkName}
                    onChange={(e) => setReworkName(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '4px' }}>
                    * Task cũ sẽ chuyển sang Obsolete (Khóa). Rework task mới sẽ làm lại từ 0%.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="rework-deadline">Hạn hoàn thành (Deadline) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <input
                      id="rework-deadline"
                      type="date"
                      value={reworkDeadline}
                      onChange={(e) => setReworkDeadline(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="rework-assignee">Giao cho kỹ sư phụ trách <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                    <select
                      id="rework-assignee"
                      value={reworkAssigneeId}
                      onChange={(e) => setReworkAssigneeId(e.target.value)}
                      required
                    >
                      {members.map(m => (
                        <option key={m.userId} value={m.userId}>{m.userName} ({m.userRole})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Red warning check reserve */}
                {isExceedingReserve && (
                  <div className="animate-fade-in" style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: 'hsl(var(--danger) / 0.1)',
                    border: '1px solid hsl(var(--danger) / 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'hsl(var(--danger))',
                    fontSize: '0.85rem'
                  }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>CẢNH BÁO: VỠ KẾ HOẠCH DỰ DỰ PHÒNG!</strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', lineHeight: '1.3' }}>
                        Hạn hoàn thành công việc Rework ({reworkDeadline}) đã vượt quá hạn chót của Giai đoạn ({selectedTaskPhase?.deadline}).
                        Cảnh báo đỏ vỡ tiến độ sẽ lập tức được gửi lên Giám đốc để xử lý đàm phán!
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="target-progress" style={{ display: 'block', marginBottom: '8px' }}>
                    Kéo thả để điều chỉnh Tiến độ thực tế <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                  </label>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'hsl(var(--bg-card))', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                    <div style={{ width: '60px', textAlign: 'right', fontSize: '1.4rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                      {(selectedTask?.progress || 0) - reduceProgressValue}%
                    </div>
                    
                    <input
                      id="target-progress"
                      type="range"
                      min="0"
                      max={selectedTask?.progress || 100}
                      value={(selectedTask?.progress || 0) - reduceProgressValue}
                      onChange={(e) => {
                        const newTarget = Number(e.target.value);
                        setReduceProgressValue((selectedTask?.progress || 0) - newTarget);
                      }}
                      style={{ flex: 1, cursor: 'pointer', accentColor: 'hsl(var(--primary))' }}
                    />
                    
                    <div style={{ minWidth: '90px', fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                      (Bị trừ <strong style={{ color: 'hsl(var(--danger))' }}>{reduceProgressValue}%</strong>)
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="reduce-progress-reason">Lý do/Ghi chú <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <textarea
                    id="reduce-progress-reason"
                    rows={2}
                    placeholder="Lý do trừ tiến độ..."
                    value={reduceProgressReason}
                    onChange={(e) => setReduceProgressReason(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsResolveOpen(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" style={{ backgroundColor: resolutionAction === 'rework' && isExceedingReserve ? 'hsl(var(--danger))' : 'hsl(var(--primary))' }}>
                Xác nhận Phê duyệt
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
