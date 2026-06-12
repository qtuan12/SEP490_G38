import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  Layers, 
  AlertTriangle, 
  ClipboardList, 
  Users, 
  Clock, 
  TrendingUp,
  ChevronRight,
  TrendingDown,
  CheckCircle,
  XCircle,
  FileCheck2,
  Boxes
} from 'lucide-react';
import { userService } from '../services/userService';
import { projectService } from '../services/projectService';
import type { MaterialRequest } from '../services/projectService';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState(0);
  const [criticalAlerts, setCriticalAlerts] = useState<string[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const isAccountant = user?.role === 'accountant' || user?.role === 'admin';
  const isDirector = user?.role === 'director' || user?.role === 'admin';

  const fetchUsers = async () => {
    try {
      const list = await userService.getUsers();
      setUserCount(list.length);
    } catch (err) {
      console.error('Error fetching users for stats:', err);
    }
  };

  const fetchMaterialRequests = async () => {
    setLoadingRequests(true);
    try {
      const list = await projectService.getAllMaterialRequests();
      setMaterialRequests(list);
    } catch (err) {
      console.error('Error loading material requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const scanIncidents = async () => {
    try {
      const projects = await projectService.getProjects();
      const alerts: string[] = [];
      
      for (const p of projects) {
        const incs = await projectService.getIncidents(p.id);
        const phasesList = await projectService.getPhases(p.id);
        const tasksList = await projectService.getTasks(p.id);
        
        incs.forEach(inc => {
          if (inc.status === 'Approved') {
            const reworkTask = tasksList.find(t => 
              (inc.reworkTaskId && t.id === inc.reworkTaskId) ||
              (t.name.includes(inc.taskName) && t.name.startsWith('[Rework]'))
            );
            
            if (reworkTask) {
              const phase = phasesList.find(ph => ph.id === reworkTask.phaseId);
              if (phase && phase.deadline && reworkTask.deadline) {
                if (new Date(reworkTask.deadline) > new Date(phase.deadline)) {
                  alerts.push(
                    `Dự án "${p.name}" - Công việc khắc phục "${reworkTask.name}" có hạn hoàn thành (${reworkTask.deadline}) vượt quá Hạn chót của Giai đoạn "${phase.name}" (${phase.deadline}).`
                  );
                }
              }
            }
          }
        });
      }
      setCriticalAlerts(alerts);
    } catch (err) {
      console.error('Error scanning incidents for alerts:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMaterialRequests();
    scanIncidents();
  }, []);

  const handleVerifyRequestByAccountant = async (reqId: string) => {
    try {
      const req = materialRequests.find(r => r.id === reqId);
      await projectService.processMaterialRequestByAccountant(reqId);
      if (req?.isOverBOQ) {
        alert('Yêu cầu vượt định mức. Đã chuyển trình Giám đốc phê duyệt.');
      } else {
        alert('Yêu cầu trong định mức hợp lệ. Đã duyệt cấp PO thành công.');
      }
      fetchMaterialRequests();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi soát xét.');
    }
  };

  const handleDisburseRequestByAccountant = async (reqId: string) => {
    try {
      await projectService.disburseEmergencyRequest(reqId);
      alert('Đã phê duyệt giải ngân chi phí mua ngoài khẩn cấp thành công.');
      fetchMaterialRequests();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi giải ngân.');
    }
  };

  const handleApproveRequestByDirector = async (reqId: string) => {
    try {
      const updated = await projectService.approveMaterialRequestByDirector(reqId, user?.name || 'Giám đốc');
      const totalCost = updated.items.reduce((sum, item) => sum + (item.quantity * ((item as any).price || 0)), 0);
      alert(`Phê duyệt thành công! Khoản chi phí khắc phục sự cố trị giá ${totalCost.toLocaleString('vi-VN')} VND đã được ghi nhận vào báo cáo lỗ/lãi của dự án.`);
      fetchMaterialRequests();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi phê duyệt.');
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    const reason = prompt('Nhập lý do từ chối yêu cầu vật tư:');
    if (!reason || reason.trim().length < 5) {
      alert('Vui lòng nhập lý do từ chối hợp lệ (ít nhất 5 ký tự).');
      return;
    }
    try {
      await projectService.rejectMaterialRequest(reqId, reason.trim());
      alert('Đã từ chối yêu cầu vật tư.');
      fetchMaterialRequests();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi từ chối.');
    }
  };

  const pendingRequestsCount = materialRequests.filter(r => r.status === 'pending_accountant' || r.status === 'pending_director' || r.status === 'pending_disbursement').length;
  const overBOQPendingCount = materialRequests.filter(r => r.isOverBOQ && (r.status === 'pending_accountant' || r.status === 'pending_director')).length;

  const stats = [
    { title: 'Dự án đang chạy', value: '3', change: '+1 trong tháng', isPositive: true, icon: <Layers size={24} />, color: 'hsl(var(--primary))' },
    { title: 'Yêu cầu Vật tư chờ duyệt', value: pendingRequestsCount.toString(), change: `${overBOQPendingCount} Vượt định mức`, isPositive: false, icon: <Boxes size={24} />, color: 'hsl(var(--danger))' },
    { title: 'Nhật ký thi công hôm nay', value: '12', change: '100% đầy đủ ảnh', isPositive: true, icon: <ClipboardList size={24} />, color: 'hsl(var(--success))' },
    { title: 'Tổng số nhân viên', value: userCount.toString(), change: 'Cập nhật thời gian thực', isPositive: true, icon: <Users size={24} />, color: 'hsl(var(--primary-hover))' },
  ];

  const recentActivities = [
    { id: 1, user: 'Nguyễn Văn Kỹ', role: 'TP Kỹ Thuật', action: 'Nghiệm thu Phase 1: Móng & Cột', time: '10 phút trước', detail: 'Dự án Chung cư BPG - Biên bản nghiệm thu PDF đã ký số.' },
    { id: 2, user: 'Trần Văn Công', role: 'Kỹ Sư', action: 'Cập nhật tiến độ: Đổ bê tông dầm sàn', time: '35 phút trước', detail: 'Tiến độ task tăng lên 60% (+15%). Đính kèm 3 hình ảnh.' },
    { id: 3, user: 'Lê Thị Thu', role: 'Kế Toán', action: 'Tạo đơn đặt hàng PO-2026-0048', time: '2 giờ trước', detail: 'Vật tư: Xi măng Hải Vân (150 bao), Đơn giá: 85,000đ.' },
    { id: 4, user: 'Phạm Huy Hoàng', role: 'Giám Đốc', action: 'Duyệt yêu cầu vật tư vượt định mức', time: '4 giờ trước', detail: 'Dự án Cải tạo văn phòng FPT - Xi măng vượt định mức 15% (đã có giải trình).' },
  ];

  const getStatusBadgeMR = (status: MaterialRequest['status']) => {
    switch (status) {
      case 'pending_accountant':
        return <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>Chờ Kế toán soát</span>;
      case 'pending_director':
        return <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>Chờ Giám đốc duyệt</span>;
      case 'pending_disbursement':
        return <span className="badge badge-warning" style={{ fontSize: '0.72rem', backgroundColor: 'hsl(38 92% 95%)', color: 'hsl(38 90% 40%)' }}>Chờ Giải ngân (PO/Kho Auto)</span>;
      case 'disbursed':
        return <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Đã giải ngân</span>;
      case 'approved':
        return <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Đã duyệt (PO Auto)</span>;
      case 'rejected':
        return <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>Đã từ chối</span>;
      default:
        return null;
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Welcome Banner */}
      <div className="glass-panel" style={{
        padding: '32px',
        background: 'linear-gradient(135deg, hsl(var(--bg-card-glass)) 0%, hsl(var(--primary-glow)) 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>
            Chào mừng trở lại, <span style={{ color: 'hsl(var(--primary-hover))' }}>{user?.name}</span>!
          </h2>
          <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: '600px', lineHeight: 1.5 }}>
            Bạn đang truy cập hệ thống với vai trò <strong style={{ color: 'hsl(var(--text-primary))' }}>{user?.role.toUpperCase()}</strong>. 
            Mọi hành động kiểm soát tiến độ & vật tư đều được lưu nhật ký hệ thống tự động.
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          backgroundColor: 'hsl(var(--bg-main))',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid hsl(var(--border))',
          fontSize: '0.85rem'
        }}>
          <Shield size={16} style={{ color: 'hsl(var(--success))' }} />
          <span>Hệ thống bảo mật & ghi log hoạt động (Active)</span>
        </div>
      </div>

      {/* Critical Alerts for Directors/TPKTs */}
      {(user?.role === 'admin' || user?.role === 'technicalmanager' || user?.role === 'director') && criticalAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {criticalAlerts.map((alert, idx) => (
            <div
              key={idx}
              className="animate-fade-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 20px',
                backgroundColor: 'hsl(var(--danger) / 0.1)',
                border: '2px solid hsl(var(--danger) / 0.4)',
                borderRadius: 'var(--radius-md)',
                color: 'hsl(var(--danger))',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              <AlertTriangle size={24} style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '2px' }}>
                  CẢNH BÁO KHẨN CẤP: VỠ TIẾN ĐỘ DỰ PHÒNG (REWORK BREACH)!
                </strong>
                <span>{alert} Vỡ quỹ thời gian dự phòng! Hãy thương lượng lại hợp đồng hoặc huy động tài lực.</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '24px'
      }}>
        {stats.map((stat, i) => (
          <div key={i} className="card" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'hsl(var(--border))';
          }}
          >
            <div>
              <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
                {stat.title}
              </span>
              <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>
                {stat.value}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                {stat.isPositive ? (
                  <TrendingUp size={14} style={{ color: 'hsl(var(--success))' }} />
                ) : (
                  <TrendingDown size={14} style={{ color: 'hsl(var(--danger))' }} />
                )}
                <span style={{ color: stat.isPositive ? 'hsl(142 70% 60%)' : 'hsl(346 84% 65%)', fontWeight: 600 }}>
                  {stat.change}
                </span>
              </div>
            </div>
            <div style={{
              backgroundColor: 'hsl(var(--bg-main))',
              color: stat.color,
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid hsl(var(--border))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Sections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
        alignItems: 'flex-start'
      }}>
        {/* Recent Activities / site diary */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Hoạt động & Nhật ký mới nhận</h3>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => navigate('/projects')}>
              Xem toàn bộ
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recentActivities.map((act) => (
              <div key={act.id} style={{
                padding: '16px',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'hsl(var(--bg-main) / 0.4)',
                display: 'flex',
                gap: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'hsl(var(--border))',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  color: 'hsl(var(--text-secondary))',
                  flexShrink: 0,
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  {act.user.charAt(0)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      {act.user} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'hsl(var(--text-muted))' }}>({act.role})</span>
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {act.time}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'hsl(var(--text-primary))', fontWeight: 500 }}>
                    {act.action}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.4 }}>
                    {act.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Phím tắt nhanh</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {user?.role === 'admin' && (
              <a href="/users" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'all var(--transition-fast)',
                backgroundColor: 'hsl(var(--bg-main) / 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                e.currentTarget.style.backgroundColor = 'hsl(var(--primary-glow))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'hsl(var(--border))';
                e.currentTarget.style.backgroundColor = 'hsl(var(--bg-main) / 0.2)';
              }}
              >
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px' }}>Quản lý Nhân sự</h4>
                  <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Thêm mới, chỉnh sửa, gán vai trò</p>
                </div>
                <ChevronRight size={16} />
              </a>
            )}

            <div style={{
              padding: '16px',
              border: '1px dashed hsl(var(--border))',
              borderRadius: 'var(--radius-sm)',
              opacity: 0.7,
              cursor: 'not-allowed'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px', color: 'hsl(var(--text-muted))' }}>
                Lập kế hoạch WBS
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Khóa bởi nghiệp vụ - Đang xây dựng</p>
            </div>

            <div style={{
              padding: '16px',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'hsl(var(--bg-main) / 0.2)'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px' }}>
                Kiểm soát Vật tư đền bù
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Xem bảng duyệt Over BOQ ở bên dưới</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 5: Material Compensation & Over BOQ verification workspace */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Boxes style={{ color: 'hsl(var(--primary))' }} size={20} />
            <span>Phê duyệt Vật tư bù đắp Sự cố (Over BOQ Approval)</span>
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
            Cấp vật tư đền bù cho các Rework Task · Tự động phát hiện vượt định mức (Over BOQ) · Soát xét Kế toán & Phê duyệt của Giám đốc (Bước 5)
          </p>
        </div>

        {loadingRequests ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'hsl(var(--text-muted))' }}>Đang tải danh sách vật tư...</div>
        ) : materialRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
            Chưa có yêu cầu vật tư bù đắp sự cố nào.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Ngày yêu cầu</th>
                  <th>Công việc / Giai đoạn</th>
                  <th>Người yêu cầu</th>
                  <th>Chi tiết Vật tư đền bù</th>
                  <th>Tổng giá trị (VND)</th>
                  <th>Phân loại</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Thao tác duyệt</th>
                </tr>
              </thead>
              <tbody>
                {materialRequests.map((req) => {
                  const totalVal = req.items.reduce((sum, item) => sum + (item.quantity * ((item as any).price || 0)), 0);
                  
                  return (
                    <tr key={req.id}>
                      <td>{req.date}</td>
                      <td><strong style={{ fontSize: '0.85rem' }}>{req.taskName || req.phaseName || 'N/A'}</strong></td>
                      <td>{req.requesterName}</td>
                      <td>
                        <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {req.items.map((it, idx) => (
                            <span key={idx}>- {it.name}: <strong>{it.quantity}</strong> {it.unit} {((it as any).price || 0) > 0 && `(đơn giá: ${((it as any).price || 0).toLocaleString('vi-VN')}đ)`}</span>
                          ))}
                        </div>
                        {req.reason && <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', margin: '4px 0 0 0' }}>Lý do: {req.reason}</p>}
                        {req.type === 'emergency' && req.invoiceImage && (
                          <div style={{ marginTop: '4px' }}>
                            <a href={req.invoiceImage} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'hsl(var(--primary))', fontWeight: 600 }}>Xem hóa đơn mua lẻ</a>
                          </div>
                        )}
                      </td>
                      <td><strong>{totalVal.toLocaleString('vi-VN')} đ</strong></td>
                      <td>
                        {req.type === 'emergency' ? (
                          <span className="badge badge-warning" style={{ fontSize: '0.65rem', backgroundColor: 'hsl(38 92% 95%)', color: 'hsl(38 90% 40%)' }}>Khẩn cấp (Direct Purchase)</span>
                        ) : req.isOverBOQ ? (
                          <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Over BOQ (Vượt định mức)</span>
                        ) : (
                          <span className="badge" style={{ backgroundColor: 'hsl(210 20% 90%)', color: 'hsl(var(--text-secondary))', fontSize: '0.65rem' }}>Trong định mức</span>
                        )}
                      </td>
                      <td>{getStatusBadgeMR(req.status)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {req.status === 'pending_accountant' && (
                          isAccountant ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button 
                                onClick={() => handleVerifyRequestByAccountant(req.id)}
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <FileCheck2 size={13} />
                                <span>{req.isOverBOQ ? 'Trình Giám đốc' : 'Duyệt cấp PO'}</span>
                              </button>
                              <button 
                                onClick={() => handleRejectRequest(req.id)}
                                className="btn" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'hsl(var(--danger-glow))', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.3)' }}
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>Chờ Kế toán soát</span>
                          )
                        )}

                        {req.status === 'pending_disbursement' && (
                          isAccountant ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button 
                                onClick={() => handleDisburseRequestByAccountant(req.id)}
                                className="btn btn-primary" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'hsl(var(--success))', border: 'none' }}
                              >
                                Giải ngân
                              </button>
                              <button 
                                onClick={() => handleRejectRequest(req.id)}
                                className="btn" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'hsl(var(--danger-glow))', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.3)' }}
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>Chờ Giải ngân</span>
                          )
                        )}

                        {req.status === 'pending_director' && (
                          isDirector ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button 
                                onClick={() => handleApproveRequestByDirector(req.id)}
                                className="btn btn-primary" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'hsl(var(--success))', border: 'none' }}
                              >
                                Duyệt
                              </button>
                              <button 
                                onClick={() => handleRejectRequest(req.id)}
                                className="btn" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'hsl(var(--danger-glow))', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.3)' }}
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>Chờ Giám đốc duyệt</span>
                          )
                        )}

                        {(req.status === 'approved' || req.status === 'disbursed') && (
                          <div style={{ fontSize: '0.78rem', color: 'hsl(var(--success))', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle size={13} />
                              <span>{req.status === 'approved' ? 'Đã duyệt PO' : 'Đã giải ngân'}</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))' }}>{req.approvedBy || 'GĐ'}</span>
                          </div>
                        )}

                        {req.status === 'rejected' && (
                          <div style={{ fontSize: '0.78rem', color: 'hsl(var(--danger))', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <XCircle size={13} />
                              <span>Đã từ chối</span>
                            </div>
                            {req.rejectionReason && (
                              <span style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', maxWidth: '140px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.rejectionReason}>
                                Lý do: {req.rejectionReason}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

