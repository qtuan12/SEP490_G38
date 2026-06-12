import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type {WBSPhase, MaterialRequest, Project} from '../types/common';
import { CreateMaterialRequestModal } from './MaterialRequests/modals/CreateMaterialRequestModal';
import { Plus, ArrowLeft, ClipboardList, Package, Calendar, User as UserIcon, FileText, AlertTriangle, Menu } from 'lucide-react';

export const PhaseMaterialRequests: React.FC = () => {
  const { projectId, phaseId } = useParams<{ projectId: string; phaseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState<WBSPhase | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [allRequests, setAllRequests] = useState<MaterialRequest[]>([]);
  const [phaseRequests, setPhaseRequests] = useState<MaterialRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const fetchData = async () => {
    if (!projectId || !phaseId) return;
    try {
      const pList = await projectService.getPhases(projectId);
      const currentPhase = pList.find(p => p.id === phaseId);
      setPhase(currentPhase || null);

      const allProjs = await projectService.getProjects();
      setProject(allProjs.find(p => p.id === projectId) || null);

      const reqs = await projectService.getAllMaterialRequests();
      setAllRequests(reqs);
      // Chỉ lấy các yêu cầu thuộc Phase này và KHÔNG phải là yêu cầu của Task (Vật tư bù đắp sự cố)
      setPhaseRequests(reqs.filter(r => r.phaseId === phaseId && !r.taskId));

      const members = await projectService.getMembers(projectId);
      const currentMember = members.find(m => m.userId === user?.id);
      setIsLeader((currentMember ? currentMember.isLeader : false) || user?.role === 'admin' || user?.role === 'technicalmanager');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId, phaseId, user]);

  const handleRefresh = async () => {
    await fetchData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_leader': return <span className="badge badge-warning">Chờ Leader</span>;
      case 'approved_by_leader': return <span className="badge badge-info">Đã tổng hợp</span>;
      case 'pending_accountant': return <span className="badge badge-warning">Chờ Kế toán</span>;
      case 'pending_disbursement': return <span className="badge badge-warning">Chờ Tạm ứng</span>;
      case 'pending_director': return <span className="badge badge-warning">Chờ Giám đốc</span>;
      case 'approved': return <span className="badge badge-success">Đã duyệt</span>;
      case 'rejected': return <span className="badge badge-danger">Từ chối</span>;
      default: return <span className="badge badge-secondary">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'hsl(var(--text-muted))' }}>
        Đang tải dữ liệu...
      </div>
    );
  }

  if (!phase) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'hsl(var(--danger))' }}>
        Không tìm thấy Giai đoạn (Phase).
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px', gap: '20px', backgroundColor: 'hsl(var(--bg-main))' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'hsl(var(--bg-card))', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border))' }}>
        <button onClick={() => navigate(`/projects/${projectId}`)} className="btn btn-secondary" title="Quay lại" style={{ padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="btn btn-secondary" title="Thu gọn/Mở rộng danh sách đề xuất" style={{ padding: '8px' }}>
          <Menu size={20} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'hsl(var(--text-primary))' }}>Yêu cầu Vật tư: {phase.name}</h2>
          <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', marginTop: '4px' }}>
            Dự án: <strong>{project?.name}</strong>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT PANEL: LIST */}
        <div style={{ 
          width: isSidebarOpen ? '400px' : '0px', 
          minWidth: isSidebarOpen ? '400px' : '0px',
          opacity: isSidebarOpen ? 1 : 0,
          overflow: 'hidden',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px', 
          backgroundColor: 'hsl(var(--bg-card))', 
          padding: isSidebarOpen ? '20px' : '0px', 
          borderRadius: 'var(--radius-md)', 
          border: isSidebarOpen ? '1px solid hsl(var(--border))' : 'none',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={20} /> Danh sách đề xuất
            </h3>
            <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}>
              <Plus size={16} /> Yêu cầu vật tư
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px', flex: 1 }}>
            {phaseRequests.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '40px 20px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)' }}>
                Chưa có yêu cầu vật tư nào cho giai đoạn này.
              </div>
            ) : (
              phaseRequests.map(req => (
                <div 
                  key={req.id} 
                  onClick={() => setSelectedRequest(req)}
                  style={{ 
                    padding: '16px', 
                    border: `1px solid ${selectedRequest?.id === req.id ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`, 
                    borderRadius: 'var(--radius-md)', 
                    cursor: 'pointer',
                    backgroundColor: selectedRequest?.id === req.id ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-main))',
                    transition: 'all 0.2s',
                    transform: selectedRequest?.id === req.id ? 'translateX(4px)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '0.95rem', color: 'hsl(var(--text-primary))' }}>{req.requesterName}</strong>
                    {getStatusBadge(req.status)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '6px' }}>
                    <Calendar size={14} /> {req.date}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                    <Package size={14} /> {req.items.length} loại vật tư
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL: DETAILS */}
        <div style={{ flex: 1, backgroundColor: 'hsl(var(--bg-card))', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border))', overflowY: 'auto' }}>
          {selectedRequest ? (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '1px solid hsl(var(--border))' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem' }}>Chi tiết Yêu cầu Vật tư</h3>
                  <div style={{ display: 'flex', gap: '16px', color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><UserIcon size={16} /> {selectedRequest.requesterName}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={16} /> {selectedRequest.date}</span>
                  </div>
                </div>
                <div style={{ transform: 'scale(1.2)', transformOrigin: 'top right' }}>
                  {getStatusBadge(selectedRequest.status)}
                </div>
              </div>

              {selectedRequest.type === 'emergency' && (
                <div style={{ padding: '16px', backgroundColor: 'hsl(var(--warning-glow))', border: '1px solid hsl(var(--warning) / 0.3)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={24} style={{ color: 'hsl(var(--warning))', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', color: 'hsl(var(--warning-hover))', marginBottom: '4px' }}>Mua ngoài khẩn cấp (Direct Purchase)</strong>
                    <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>Yêu cầu này được tạo khẩn cấp và đã tải lên hóa đơn mua ngoài trực tiếp.</span>
                  </div>
                </div>
              )}

              {selectedRequest.isOverBOQ && (
                <div style={{ padding: '16px', backgroundColor: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={24} style={{ color: 'hsl(var(--danger))', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', color: 'hsl(var(--danger))', marginBottom: '4px' }}>Vượt Định Mức (Over BOQ)</strong>
                    <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>Yêu cầu này vượt quá định mức BOQ ban đầu và cần Giám đốc phê duyệt.</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                  <Package size={18} /> Danh sách vật tư
                </h4>
                <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div className="overflow-x-auto w-full">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'hsl(var(--bg-main))' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))' }}>STT</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))' }}>Tên Vật tư</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))' }}>Số lượng</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))' }}>ĐVT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid hsl(var(--border-light))' }}>
                          <td style={{ padding: '12px 16px' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>{item.name}</td>
                          <td style={{ padding: '12px 16px', color: 'hsl(var(--primary))', fontWeight: 600 }}>{item.quantity}</td>
                          <td style={{ padding: '12px 16px', color: 'hsl(var(--text-secondary))' }}>{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
          </div>
                </div>
              </div>

              {(selectedRequest.reason || selectedRequest.rejectionReason) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {selectedRequest.reason && (
                    <div style={{ padding: '16px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border))' }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.95rem' }}>
                        <FileText size={16} /> Ghi chú / Giải trình
                      </strong>
                      <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {selectedRequest.reason}
                      </div>
                    </div>
                  )}

                  {selectedRequest.rejectionReason && (
                    <div style={{ padding: '16px', backgroundColor: 'hsl(var(--danger-glow))', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--danger) / 0.3)' }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.95rem', color: 'hsl(var(--danger))' }}>
                        <AlertTriangle size={16} /> Lý do từ chối
                      </strong>
                      <div style={{ fontSize: '0.9rem', color: 'hsl(var(--danger))', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {selectedRequest.rejectionReason}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedRequest.invoiceImage && (
                <div style={{ marginTop: '8px' }}>
                  <strong style={{ display: 'block', marginBottom: '12px', fontSize: '1.05rem' }}>Hình ảnh Hóa đơn</strong>
                  <img 
                    src={selectedRequest.invoiceImage} 
                    alt="Invoice" 
                    style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border))', objectFit: 'contain' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=L%E1%BB%97i+t%E1%BA%A3i+%E1%BA%A3nh';
                    }}
                  />
                </div>
              )}

            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '24px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={64} opacity={0.3} />
              </div>
              <p style={{ fontSize: '1.1rem' }}>Chọn một yêu cầu từ danh sách bên trái để xem chi tiết</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && projectId && (
        <CreateMaterialRequestModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          phase={phase}
          projectId={projectId}
          user={user}
          isLeader={isLeader}
          allMaterialRequests={allRequests}
          requestType="normal"
          onSuccess={(msg) => { 
            alert(msg); 
            handleRefresh(); 
            setIsCreateOpen(false); 
          }}
          onError={(msg) => alert(msg)}
        />
      )}
    </div>
  );
};

