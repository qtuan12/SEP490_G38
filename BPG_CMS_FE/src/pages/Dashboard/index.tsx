import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Shield, 
  Layers, 
  AlertTriangle, 
  ClipboardList, 
  Users, 
  Boxes
} from 'lucide-react';
import { userService } from '../../services/userService';
import { projectService } from '../../services/projectService';
import type {MaterialRequest} from '../../types/common';
import { useNavigate } from 'react-router-dom';
import { MaterialCompensationTable } from '../Dashboard/components/MaterialCompensationTable';
import { RecentActivities } from '../Dashboard/components/RecentActivities';
import { DashboardStats } from '../Dashboard/components/DashboardStats';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [userCount, setUserCount] = useState(0);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [warnings, setWarnings] = useState<import('../../types/common').DashboardWarningDto[]>([]);
  const [metrics, setMetrics] = useState<import('../../types/common').DashboardMetricsDto | null>(null);

  const navigate = useNavigate();

  const isAccountant = user?.role === 'accountant' || user?.role === 'admin';
  const isDirector = user?.role === 'director' || user?.role === 'admin';

  const fetchMetrics = async () => {
    try {
      const data = await projectService.getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

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

  const fetchWarnings = async () => {
    try {
      const list = await projectService.getDashboardWarnings();
      setWarnings(list);
    } catch (err) {
      console.error('Error fetching warnings:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMaterialRequests();
    fetchWarnings();
    fetchMetrics();
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
      const updated = await projectService.approveMaterialRequestByDirector(reqId, user?.name || 'director');
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
    { title: 'Dự án đang chạy', value: metrics ? metrics.activeProjects.toString() : '...', change: `Tổng số: ${metrics?.totalProjects || 0}`, isPositive: true, icon: <Layers size={24} />, color: 'hsl(var(--primary))' },
    { title: 'Yêu cầu Vật tư chờ duyệt', value: pendingRequestsCount.toString(), change: `${overBOQPendingCount} Vượt định mức`, isPositive: false, icon: <Boxes size={24} />, color: 'hsl(var(--danger))' },
    { title: 'Dự án đã đóng / Tạm dừng', value: metrics ? (metrics.closedProjects + metrics.pausedProjects).toString() : '...', change: `${metrics?.closedProjects || 0} Đóng, ${metrics?.pausedProjects || 0} Tạm dừng`, isPositive: true, icon: <ClipboardList size={24} />, color: 'hsl(var(--success))' },
    { title: 'Tổng số nhân viên', value: userCount.toString(), change: 'Cập nhật thời gian thực', isPositive: true, icon: <Users size={24} />, color: 'hsl(var(--primary-hover))' },
  ];

  const recentActivities = [
    { id: 1, user: 'Nguyễn Văn Kỹ', role: 'TP Kỹ Thuật', action: 'Nghiệm thu Phase 1: Móng & Cột', time: '10 phút trước', detail: 'Dự án Chung cư BPG - Biên bản nghiệm thu PDF đã ký số.' },
    { id: 2, user: 'Trần Văn Công', role: 'siteengineer', action: 'Cập nhật tiến độ: Đổ bê tông dầm sàn', time: '35 phút trước', detail: 'Tiến độ task tăng lên 60% (+15%). Đính kèm 3 hình ảnh.' },
    { id: 3, user: 'Lê Thị Thu', role: 'accountant', action: 'Tạo đơn đặt hàng PO-2026-0048', time: '2 giờ trước', detail: 'Vật tư: Xi măng Hải Vân (150 bao), Đơn giá: 85,000đ.' },
    { id: 4, user: 'Phạm Huy Hoàng', role: 'director', action: 'Duyệt yêu cầu vật tư vượt định mức', time: '4 giờ trước', detail: 'Dự án Cải tạo văn phòng FPT - Xi măng vượt định mức 15% (đã có giải trình).' },
  ];

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="glass-panel p-8 bg-[linear-gradient(135deg,_hsl(var(--bg-card-glass))_0%,_hsl(var(--primary-glow))_100%)] flex justify-between items-center flex-wrap gap-5">
        <div>
          <h2 className="text-[1.75rem] font-bold mb-2">
            Chào mừng trở lại, <span className="text-[hsl(var(--primary-hover))]">{user?.name}</span>!
          </h2>
          <p className="text-[hsl(var(--text-secondary))] max-w-[600px] leading-relaxed">
            Bạn đang truy cập hệ thống với vai trò <strong className="text-[hsl(var(--text-primary))]">{user?.role.toUpperCase()}</strong>. 
            Mọi hành động kiểm soát tiến độ & vật tư đều được lưu nhật ký hệ thống tự động.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 py-2 px-4 bg-[hsl(var(--bg-main))] rounded-sm border border-[hsl(var(--border))] text-[0.85rem]">
          <Shield size={16} className="text-[hsl(var(--success))]" />
          <span>Hệ thống bảo mật & ghi log hoạt động (Active)</span>
        </div>
      </div>

      {/* Warnings / Alerts for Directors/TPKTs */}
      {(user?.role === 'admin' || user?.role === 'technicalmanager' || user?.role === 'director') && warnings.length > 0 && (
        <div className="flex flex-col gap-3">
          {warnings.map((w, idx) => (
            <div
              key={idx}
              className={`animate-fade-in flex items-center gap-3 py-4 px-5 border-2 rounded-md font-semibold ${
                w.warningType === 'Critical' ? 'bg-[hsl(var(--danger)/0.1)] border-[hsl(var(--danger)/0.4)] text-[hsl(var(--danger))]' :
                w.warningType === 'Red' ? 'bg-red-50 border-red-200 text-red-700' :
                'bg-yellow-50 border-yellow-200 text-yellow-700'
              }`}
            >
              <AlertTriangle size={24} className="shrink-0" />
              <div>
                <strong className="text-[0.95rem] block mb-0.5">
                  {w.warningType === 'Critical' ? 'CẢNH BÁO KHẨN CẤP: VỠ TIẾN ĐỘ DỰ PHÒNG (REWORK BREACH)!' :
                   w.warningType === 'Red' ? `Dự án "${w.projectName}": Cảnh báo trễ hạn - ${w.taskName}` :
                   `Dự án "${w.projectName}": Nguy cơ trễ hạn - ${w.taskName}`}
                </strong>
                <span>{w.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid Stats */}
      <DashboardStats stats={stats} />

      {/* Active Projects Progress Widget */}
      <div className="glass-panel p-6 animate-fade-in">
        <h3 className="text-[1.1rem] font-bold mb-4 flex items-center gap-2">
          <Layers className="text-[hsl(var(--primary))]" /> Tiến độ dự án (Đang chạy & Tạm dừng)
        </h3>
        {(!metrics?.activeProjectsProgress || metrics.activeProjectsProgress.length === 0) ? (
          <div className="text-[hsl(var(--text-muted))] text-center py-6 border border-dashed border-[hsl(var(--border))] rounded-md">
            Hiện không có dự án nào đang chạy hoặc tạm dừng.
          </div>
        ) : (
          <div className="max-h-[280px] overflow-y-auto pr-2 space-y-4">
            {[...metrics.activeProjectsProgress].sort((a, b) => b.projectId - a.projectId).map((p) => (
              <div 
                key={p.projectId} 
                onClick={() => navigate(`/projects/${p.projectId}`)}
                className={`flex flex-col gap-1.5 p-3 rounded-md border ${p.status === 'paused' ? 'border-yellow-200 hover:border-yellow-400 bg-yellow-50/30' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))]'} transition-colors cursor-pointer hover:shadow-md`}
              >
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold flex items-center gap-2">
                    {p.projectName}
                    {p.status === 'paused' && <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[0.7rem] rounded font-semibold uppercase tracking-wider">Tạm dừng</span>}
                  </span>
                  <span className={`font-semibold ${p.status === 'paused' ? 'text-yellow-600' : 'text-[hsl(var(--primary-hover))]'}`}>{p.progress}%</span>
                </div>
                <div className="text-xs text-[hsl(var(--text-muted))] flex items-center gap-1 mb-1">
                  <span className="truncate">{p.address}</span>
                </div>
                <div className="h-2 w-full bg-[hsl(var(--border))] rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ease-out ${p.status === 'paused' ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 'bg-gradient-to-r from-[hsl(var(--primary-hover))] to-[hsl(var(--primary))]'}`} 
                    style={{ width: `${p.progress}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
        {/* Recent Activities / site diary */}
        <RecentActivities activities={recentActivities} />

        {/* Step 5: Material Compensation & Over BOQ verification workspace */}
        <MaterialCompensationTable
          materialRequests={materialRequests}
          loadingRequests={loadingRequests}
          isAccountant={isAccountant}
          isDirector={isDirector}
          handleVerifyRequestByAccountant={handleVerifyRequestByAccountant}
          handleDisburseRequestByAccountant={handleDisburseRequestByAccountant}
          handleApproveRequestByDirector={handleApproveRequestByDirector}
          handleRejectRequest={handleRejectRequest}
        />
      </div>
    </div>
  );
};
