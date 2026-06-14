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
import { MaterialCompensationTable } from '../Dashboard/components/MaterialCompensationTable';
import { RecentActivities } from '../Dashboard/components/RecentActivities';
import { QuickActionsPanel } from '../Dashboard/components/QuickActionsPanel';
import { DashboardStats } from '../Dashboard/components/DashboardStats';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [userCount, setUserCount] = useState(0);
  const [criticalAlerts, setCriticalAlerts] = useState<string[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [metrics, setMetrics] = useState<import('../../types/common').DashboardMetricsDto | null>(null);

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

  const scanIncidents = async () => {
    try {
      const projects = await projectService.getProjects();
      const alerts: string[] = [];
      
      for (const p of projects) {
        const incs = await projectService.getIncidents(p.id);
        const phasesList = await projectService.getPhases(p.id);
        const tasksList = await projectService.getTasks(p.id);
        
        incs.forEach(inc => {
          if (inc.status === 'Closed' || inc.status === 'Approved') {
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

      {/* Critical Alerts for Directors/TPKTs */}
      {(user?.role === 'admin' || user?.role === 'technicalmanager' || user?.role === 'director') && criticalAlerts.length > 0 && (
        <div className="flex flex-col gap-3">
          {criticalAlerts.map((alert, idx) => (
            <div
              key={idx}
              className="animate-fade-in flex items-center gap-3 py-4 px-5 bg-[hsl(var(--danger)/0.1)] border-2 border-[hsl(var(--danger)/0.4)] rounded-md text-[hsl(var(--danger))] text-[0.9rem] font-semibold"
            >
              <AlertTriangle size={24} className="shrink-0" />
              <div>
                <strong className="text-[0.95rem] block mb-0.5">
                  CẢNH BÁO KHẨN CẤP: VỠ TIẾN ĐỘ DỰ PHÒNG (REWORK BREACH)!
                </strong>
                <span>{alert} Vỡ quỹ thời gian dự phòng! Hãy thương lượng lại hợp đồng hoặc huy động tài lực.</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid Stats */}
      <DashboardStats stats={stats} />

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
        {/* Recent Activities / site diary */}
        <RecentActivities activities={recentActivities} />

        {/* Quick Actions Panel */}
        <QuickActionsPanel userRole={user?.role} />
      </div>

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
  );
};
