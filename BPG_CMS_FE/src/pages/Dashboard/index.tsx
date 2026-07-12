import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Layers,
  AlertTriangle,
  ClipboardList,
  Users,
  Boxes,
  FileText,
  Truck,
  ShoppingCart,
  Tags,
  Package,
  Hammer,
  Clock,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  CheckSquare,
  Wrench
} from 'lucide-react';
import { userService } from '../../services/userService';
import { projectService } from '../../services/projectService';
import { reportService } from '../../services/reportService';

import type { Project, MaterialRequest } from '../../types/common';
import { useNavigate } from 'react-router-dom';
import { DashboardStats } from '../Dashboard/components/DashboardStats';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [userCount, setUserCount] = useState(0);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [warnings, setWarnings] = useState<import('../../types/common').DashboardWarningDto[]>([]);
  const [metrics, setMetrics] = useState<import('../../types/common').DashboardMetricsDto | null>(null);

  // States for Project Leader & Site Engineer roles
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectExecData, setProjectExecData] = useState<any>(null);
  const [loadingProjectExec, setLoadingProjectExec] = useState<boolean>(false);

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
      const result = await userService.getUsers();
      setUserCount(result.totalCount);
    } catch (err) {
      console.error('Error fetching users for stats:', err);
    }
  };

  const fetchMaterialRequests = async () => {
    try {
      const list = await projectService.getAllMaterialRequests();
      setMaterialRequests(list);
    } catch (err) {
      console.error('Error loading material requests:', err);
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
    if (isAccountant || isDirector) {
      fetchMaterialRequests();
    }
    fetchWarnings();
    fetchMetrics();

    // Fetch project list for dropdown filters
    if (user?.role === 'projectleader' || user?.role === 'siteengineer') {
      projectService.getProjects()
        .then((data) => {
          const activeProjects = data.filter(p => p.status !== 'draft');
          setProjects(activeProjects);
          if (activeProjects.length > 0) {
            setSelectedProjectId(activeProjects[0].id);
          }
        })
        .catch((err) => console.error('Error fetching projects:', err));
    }
  }, [isAccountant, isDirector, user]);

  useEffect(() => {
    if (selectedProjectId) {
      setLoadingProjectExec(true);
      const numericId = parseInt(selectedProjectId.replace('p-', '')) || 0;
      reportService.getExecutiveDashboard(numericId)
        .then((data) => {
          setProjectExecData(data);
        })
        .catch((err) => console.error('Error loading project exec dashboard:', err))
        .finally(() => setLoadingProjectExec(false));
    } else {
      setProjectExecData(null);
    }
  }, [selectedProjectId]);

  const pendingRequestsCount = materialRequests.filter(r => r.status === 'pending_accountant' || r.status === 'pending_director' || r.status === 'pending_disbursement').length;
  const overBOQPendingCount = materialRequests.filter(r => r.isOverBOQ && (r.status === 'pending_accountant' || r.status === 'pending_director')).length;

  const statsGeneral = [
    { title: 'Dự án đang chạy', value: metrics ? metrics.activeProjects.toString() : '...', change: `Tổng số: ${metrics?.totalProjects || 0}`, isPositive: true, icon: <Layers size={24} />, color: 'hsl(var(--primary))' },
    { title: 'Yêu cầu Vật tư chờ duyệt', value: pendingRequestsCount.toString(), change: `${overBOQPendingCount} Vượt định mức`, isPositive: false, icon: <Boxes size={24} />, color: 'hsl(var(--danger))' },
    { title: 'Dự án đã đóng / Tạm dừng', value: metrics ? (metrics.closedProjects + metrics.pausedProjects).toString() : '...', change: `${metrics?.closedProjects || 0} Đóng, ${metrics?.pausedProjects || 0} Tạm dừng`, isPositive: true, icon: <ClipboardList size={24} />, color: 'hsl(var(--success))' },
    { title: 'Tổng số nhân viên', value: userCount.toString(), change: 'Cập nhật thời gian thực', isPositive: true, icon: <Users size={24} />, color: 'hsl(var(--primary-hover))' },
  ];

  // =========================================================================
  // Role Dashboard Renderers
  // =========================================================================

  // 1. Giám đốc (Director) & Admin
  const renderDirectorDashboard = () => {
    const statusData = metrics ? [
      { name: 'Đang chạy', value: metrics.activeProjects, color: 'hsl(var(--primary))' },
      { name: 'Tạm dừng', value: metrics.pausedProjects, color: 'hsl(var(--warning))' },
      { name: 'Hoàn thành', value: metrics.completedProjects, color: 'hsl(var(--success))' },
      { name: 'Đóng', value: metrics.closedProjects, color: 'hsl(var(--text-muted))' },
      { name: 'Bản nháp', value: metrics.draftProjects, color: 'hsl(var(--border))' },
    ].filter(d => d.value > 0) : [];

    return (
      <div className="flex flex-col gap-8">
        <DashboardStats stats={statsGeneral} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="glass-panel p-5 animate-fade-in flex flex-col h-[380px] lg:col-span-7">
            <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
              <Layers className="text-[hsl(var(--primary))]" size={18} />
              <span>Tiến độ dự án (Đang chạy & Tạm dừng)</span>
            </h3>
            <div className="flex-1 min-h-0">
              {(!metrics?.activeProjectsProgress || metrics.activeProjectsProgress.length === 0) ? (
                <div className="text-[hsl(var(--text-muted))] text-center py-6 border border-dashed border-[hsl(var(--border))] rounded-md h-full flex items-center justify-center text-xs">
                  Hiện không có dự án nào đang chạy hoặc tạm dừng.
                </div>
              ) : (
                <div className="h-full overflow-y-auto pr-1.5 space-y-3 custom-scrollbar">
                  {[...metrics.activeProjectsProgress].sort((a, b) => b.projectId - a.projectId).map((p) => (
                    <div
                      key={p.projectId}
                      onClick={() => navigate(`/projects/${p.projectId}`)}
                      className={`flex flex-col gap-1.5 p-3 rounded border ${p.status === 'paused' ? 'border-yellow-200 hover:border-yellow-400 bg-yellow-50/20' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))]'} transition-colors cursor-pointer hover:shadow-md`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold flex items-center gap-1.5 truncate">
                          {p.projectName}
                          {p.status === 'paused' && <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] rounded font-semibold uppercase tracking-wider">Tạm dừng</span>}
                        </span>
                        <span className={`font-semibold shrink-0 ${p.status === 'paused' ? 'text-yellow-600' : 'text-[hsl(var(--primary-hover))]'}`}>{p.progress}%</span>
                      </div>
                      <div className="text-[10px] text-[hsl(var(--text-muted))] flex items-center gap-1">
                        <span className="truncate">{p.address}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[hsl(var(--border))] rounded-full overflow-hidden">
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
          </div>

          <div className="glass-panel p-5 animate-fade-in flex flex-col h-[380px] lg:col-span-5">
            <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
              <ClipboardList className="text-[hsl(var(--primary))]" size={18} />
              <span>Tỉ trọng trạng thái dự án</span>
            </h3>
            <div className="flex-1 min-h-0 flex flex-col justify-center items-center">
              {metrics ? (
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="flex-1 min-h-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => [`${value} dự án`, 'Số lượng']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 text-xs">
                    {statusData.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-[hsl(var(--text-secondary))] font-medium">
                          {entry.name}: <strong className="text-[hsl(var(--text-primary))]">{entry.value}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[hsl(var(--text-muted))] text-center py-6 text-xs">
                  Không có dữ liệu trạng thái dự án.
                </div>
              )}
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="glass-panel p-5 mt-2">
            <h3 className="text-[1.05rem] font-bold mb-4 text-[hsl(var(--text-primary))] flex items-center gap-2">
              <AlertTriangle size={18} className="text-[hsl(var(--danger))]" />
              <span>Cảnh báo rủi ro toàn hệ thống ({warnings.length})</span>
            </h3>
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {warnings.map((w, idx) => (
                <div
                  key={idx}
                  className={`flex items-start justify-between gap-3 p-4 border rounded-md cursor-pointer hover:shadow-md transition-shadow ${w.warningType === 'Critical' ? 'bg-[hsl(var(--danger)/0.1)] border-[hsl(var(--danger)/0.4)] text-[hsl(var(--danger))]' :
                      w.warningType === 'Red' ? 'bg-red-50 border-red-200 text-red-700' :
                        'bg-yellow-50 border-yellow-200 text-yellow-700'
                    }`}
                  onClick={() => navigate(`/projects/${w.projectId}/tasks/${w.taskId}`)}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[0.95rem] block mb-1">
                        {w.projectName}
                      </strong>
                      <div className="text-sm font-medium mb-1">Task: {w.taskName}</div>
                      <span className="text-[0.85rem] opacity-90">{w.message}</span>
                    </div>
                  </div>
                  <div className="text-xs font-bold px-2 py-1 bg-white/50 rounded border border-black/10">
                    {w.warningType === 'Critical' ? 'KHẨN CẤP' : w.warningType === 'Red' ? 'TRỄ HẠN' : 'NGUY CƠ'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 2. Kế toán (Accountant)
  const renderAccountantDashboard = () => {
    const statusData = metrics ? [
      { name: 'Đang chạy', value: metrics.activeProjects, color: 'hsl(var(--primary))' },
      { name: 'Tạm dừng', value: metrics.pausedProjects, color: 'hsl(var(--warning))' },
      { name: 'Hoàn thành', value: metrics.completedProjects, color: 'hsl(var(--success))' },
      { name: 'Đóng', value: metrics.closedProjects, color: 'hsl(var(--text-muted))' },
    ].filter(d => d.value > 0) : [];

    const statsAccountant = [
      { title: 'Yêu cầu vật tư chờ soát xét', value: pendingRequestsCount.toString(), change: `${overBOQPendingCount} Vượt định mức`, isPositive: false, icon: <Boxes size={24} />, color: 'hsl(var(--danger))' },
      { title: 'Dự án đang thi công', value: metrics ? metrics.activeProjects.toString() : '...', change: `Tổng số: ${metrics?.totalProjects || 0}`, isPositive: true, icon: <Layers size={24} />, color: 'hsl(var(--primary))' },
      { title: 'Dự án tạm dừng/đóng', value: metrics ? (metrics.closedProjects + metrics.pausedProjects).toString() : '...', change: `${metrics?.closedProjects || 0} Đóng, ${metrics?.pausedProjects || 0} Tạm dừng`, isPositive: true, icon: <ClipboardList size={24} />, color: 'hsl(var(--warning))' },
      { title: 'Nhân sự hệ thống', value: userCount.toString(), change: 'Cập nhật thời gian thực', isPositive: true, icon: <Users size={24} />, color: 'hsl(var(--primary-hover))' },
    ];

    return (
      <div className="flex flex-col gap-8">
        <DashboardStats stats={statsAccountant} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="glass-panel p-5 animate-fade-in flex flex-col h-[380px] lg:col-span-7">
            <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
              <Layers className="text-[hsl(var(--primary))]" size={18} />
              <span>Tiến độ dự án đang kiểm soát chi phí</span>
            </h3>
            <div className="flex-1 min-h-0">
              {(!metrics?.activeProjectsProgress || metrics.activeProjectsProgress.length === 0) ? (
                <div className="text-[hsl(var(--text-muted))] text-center py-6 border border-dashed border-[hsl(var(--border))] rounded-md h-full flex items-center justify-center text-xs">
                  Không có dự án thi công.
                </div>
              ) : (
                <div className="h-full overflow-y-auto pr-1.5 space-y-3 custom-scrollbar">
                  {[...metrics.activeProjectsProgress].sort((a, b) => b.projectId - a.projectId).map((p) => (
                    <div
                      key={p.projectId}
                      onClick={() => navigate(`/projects/${p.projectId}`)}
                      className="flex flex-col gap-1.5 p-3 rounded border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] transition-colors cursor-pointer hover:shadow-md"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold truncate">{p.projectName}</span>
                        <span className="font-semibold text-[hsl(var(--primary-hover))]">{p.progress}%</span>
                      </div>
                      <div className="text-[10px] text-[hsl(var(--text-muted))] flex items-center gap-1">
                        <span className="truncate">{p.address}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[hsl(var(--border))] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[hsl(var(--primary-hover))] to-[hsl(var(--primary))] transition-all duration-500 ease-out"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel p-5 animate-fade-in flex flex-col h-[380px] lg:col-span-5">
            <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
              <ClipboardList className="text-[hsl(var(--primary))]" size={18} />
              <span>Phân bổ Trạng thái Dự án</span>
            </h3>
            <div className="flex-1 min-h-0 flex flex-col justify-center items-center">
              {metrics ? (
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="flex-1 min-h-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => [`${value} dự án`, 'Số lượng']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 text-xs">
                    {statusData.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-[hsl(var(--text-secondary))] font-medium">{entry.name}: <strong>{entry.value}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[hsl(var(--text-muted))] text-center py-6 text-xs">
                  Không có dữ liệu dự án.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-[1.05rem] font-bold mb-5 flex items-center gap-2">
            <TrendingUp size={18} className="text-[hsl(var(--primary))]" />
            <span>Phím tắt tác vụ tài chính & kho vận</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div
              onClick={() => navigate('/suppliers')}
              className="card p-4 flex items-center gap-3.5 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] cursor-pointer hover:shadow-md transition-all rounded-lg"
            >
              <div className="p-3 rounded-full bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] shrink-0">
                <Truck size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm">Nhà cung cấp</h4>
                <p className="text-[10px] text-[hsl(var(--text-secondary))] mt-0.5">Quản lý nhà cung ứng vật tư</p>
              </div>
            </div>

            <div
              onClick={() => navigate('/purchase-orders')}
              className="card p-4 flex items-center gap-3.5 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] cursor-pointer hover:shadow-md transition-all rounded-lg"
            >
              <div className="p-3 rounded-full bg-[hsl(142_70%_90%)] text-[hsl(142_70%_35%)] shrink-0">
                <ShoppingCart size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm">Đơn mua hàng (PO)</h4>
                <p className="text-[10px] text-[hsl(var(--text-secondary))] mt-0.5">Soạn thảo, quản lý PO</p>
              </div>
            </div>

            <div
              onClick={() => navigate('/categories')}
              className="card p-4 flex items-center gap-3.5 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] cursor-pointer hover:shadow-md transition-all rounded-lg"
            >
              <div className="p-3 rounded-full bg-[hsl(38_90%_90%)] text-[hsl(38_90%_35%)] shrink-0">
                <Tags size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm">Danh mục vật tư</h4>
                <p className="text-[10px] text-[hsl(var(--text-secondary))] mt-0.5">Phân nhóm chủng loại vật tư</p>
              </div>
            </div>

            <div
              onClick={() => navigate('/materials')}
              className="card p-4 flex items-center gap-3.5 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] cursor-pointer hover:shadow-md transition-all rounded-lg"
            >
              <div className="p-3 rounded-full bg-[hsl(246_80%_90%)] text-[hsl(246_80%_35%)] shrink-0">
                <Package size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm">Kho Catalog vật tư</h4>
                <p className="text-[10px] text-[hsl(var(--text-secondary))] mt-0.5">Thông tin danh mục kỹ thuật</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 3. Trưởng phòng Kỹ thuật (Technical Manager)
  const renderTechnicalManagerDashboard = () => {
    const statsTechManager = [
      { title: 'Dự án đang chạy', value: metrics ? metrics.activeProjects.toString() : '...', change: `Tổng số: ${metrics?.totalProjects || 0}`, isPositive: true, icon: <Layers size={24} />, color: 'hsl(var(--primary))' },
      { title: 'Cảnh báo tiến độ WBS', value: warnings.length.toString(), change: `Cần rà soát kỹ thuật`, isPositive: false, icon: <AlertTriangle size={24} />, color: 'hsl(var(--danger))' },
      { title: 'Dự án tạm dừng', value: metrics ? metrics.pausedProjects.toString() : '...', change: `Nguy cơ đình trệ`, isPositive: true, icon: <ClipboardList size={24} />, color: 'hsl(var(--warning))' },
      { title: 'Nhân viên kỹ thuật', value: userCount.toString(), change: 'Cập nhật hệ thống', isPositive: true, icon: <Users size={24} />, color: 'hsl(var(--primary-hover))' },
    ];

    return (
      <div className="flex flex-col gap-8">
        <DashboardStats stats={statsTechManager} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="glass-panel p-5 animate-fade-in flex flex-col h-[380px] lg:col-span-7">
            <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
              <Layers className="text-[hsl(var(--primary))]" size={18} />
              <span>Tiến độ triển khai dự án kỹ thuật</span>
            </h3>
            <div className="flex-1 min-h-0">
              {(!metrics?.activeProjectsProgress || metrics.activeProjectsProgress.length === 0) ? (
                <div className="text-[hsl(var(--text-muted))] text-center py-6 border border-dashed border-[hsl(var(--border))] rounded-md h-full flex items-center justify-center text-xs">
                  Hiện không có dự án kỹ thuật nào.
                </div>
              ) : (
                <div className="h-full overflow-y-auto pr-1.5 space-y-3 custom-scrollbar">
                  {[...metrics.activeProjectsProgress].sort((a, b) => b.projectId - a.projectId).map((p) => (
                    <div
                      key={p.projectId}
                      onClick={() => navigate(`/projects/${p.projectId}`)}
                      className="flex flex-col gap-1.5 p-3 rounded border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] transition-colors cursor-pointer hover:shadow-md"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold truncate">{p.projectName}</span>
                        <span className="font-semibold text-[hsl(var(--primary-hover))]">{p.progress}%</span>
                      </div>
                      <div className="text-[10px] text-[hsl(var(--text-muted))] flex items-center gap-1">
                        <span className="truncate">{p.address}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[hsl(var(--border))] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[hsl(var(--primary-hover))] to-[hsl(var(--primary))] transition-all duration-500 ease-out"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel p-5 animate-fade-in flex flex-col h-[380px] lg:col-span-5">
            <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
              <AlertTriangle className="text-[hsl(var(--danger))]" size={18} />
              <span>Danh sách cảnh báo WBS cần xử lý</span>
            </h3>
            <div className="flex-1 min-h-0">
              {warnings.length === 0 ? (
                <div className="text-[hsl(var(--success))] text-center py-10 border border-dashed border-[hsl(var(--border))] rounded-md h-full flex items-center justify-center text-xs font-semibold">
                  Tất cả các dự án hoạt động ổn định, không có cảnh báo.
                </div>
              ) : (
                <div className="h-full overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                  {warnings.map((w, idx) => (
                    <div
                      key={idx}
                      onClick={() => navigate(`/projects/${w.projectId}/tasks/${w.taskId}`)}
                      className={`p-3 rounded border text-xs cursor-pointer hover:shadow-sm transition-all flex flex-col gap-1 ${w.warningType === 'Critical' ? 'bg-[hsl(var(--danger)/0.04)] border-[hsl(var(--danger)/0.25)] hover:border-[hsl(var(--danger))]' :
                          w.warningType === 'Red' ? 'bg-red-50/40 border-red-200 hover:border-red-400' :
                            'bg-yellow-50/40 border-yellow-200 hover:border-yellow-400'
                        }`}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold truncate text-[hsl(var(--text-primary))]">{w.projectName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${w.warningType === 'Critical' ? 'bg-[hsl(var(--danger)/0.15)] text-[hsl(var(--danger))]' :
                            w.warningType === 'Red' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                          {w.warningType === 'Critical' ? 'KHẨN CẤP' : w.warningType === 'Red' ? 'TRỄ HẠN' : 'NGUY CƠ'}
                        </span>
                      </div>
                      <div className="text-[10px] text-[hsl(var(--text-muted))]">Task: <strong className="text-[hsl(var(--text-secondary))]">{w.taskName}</strong></div>
                      <div className="text-[10px] text-[hsl(var(--text-secondary))] mt-0.5 truncate">{w.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel p-5">
          <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2">
            <Wrench size={18} className="text-[hsl(var(--primary))]" />
            <span>Liên kết kỹ thuật nhanh</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => navigate('/materials-control')}
              className="card p-4 flex items-center justify-between border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] cursor-pointer hover:shadow-md transition-all rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] rounded-full">
                  <Package size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Kiểm soát định mức BOQ</h4>
                  <p className="text-[10px] text-[hsl(var(--text-secondary))] mt-0.5">Kiểm soát xuất vật tư công trường theo hạn ngạch</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-[hsl(var(--text-muted))]" />
            </div>

            <div
              onClick={() => navigate('/projects')}
              className="card p-4 flex items-center justify-between border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] cursor-pointer hover:shadow-md transition-all rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[hsl(142_70%_90%)] text-[hsl(142_70%_35%)] rounded-full">
                  <Hammer size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Danh sách dự án xây dựng</h4>
                  <p className="text-[10px] text-[hsl(var(--text-secondary))] mt-0.5">Theo dõi sơ đồ WBS, Gantt chart dự án</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-[hsl(var(--text-muted))]" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 4. Chỉ huy trưởng (Project Leader - CHT)
  const renderProjectLeaderDashboard = () => {
    if (projects.length === 0) {
      return (
        <div className="glass-panel p-10 text-center text-[hsl(var(--text-muted))]">
          Chưa có dự án nào hoạt động được phân công cho Chỉ huy trưởng.
        </div>
      );
    }

    const taskStatusData = projectExecData ? [
      { name: 'Hoàn thành', value: projectExecData.completedTasks, color: 'hsl(var(--success))' },
      { name: 'Đang làm', value: Math.max(0, projectExecData.totalTasks - projectExecData.completedTasks - projectExecData.delayedTasks - projectExecData.atRiskTasks), color: 'hsl(var(--primary))' },
      { name: 'Trễ hạn', value: projectExecData.delayedTasks, color: 'hsl(var(--danger))' },
      { name: 'Nguy cơ', value: projectExecData.atRiskTasks, color: 'hsl(var(--warning))' },
    ].filter(d => d.value > 0) : [];

    const phaseChartData = projectExecData ? (projectExecData.phaseBreakdown || []).map((p: any) => ({
      name: p.phaseName.length > 14 ? p.phaseName.substring(0, 14) + '…' : p.phaseName,
      fullName: p.phaseName,
      progress: p.progressPercent,
    })) : [];

    const statsProjectLeader = projectExecData ? [
      { title: 'Tiến độ Công việc', value: `${projectExecData.completedTasks} / ${projectExecData.totalTasks}`, change: `${Math.round((projectExecData.completedTasks / Math.max(1, projectExecData.totalTasks)) * 100)}% Hoàn thành`, isPositive: true, icon: <CheckSquare size={24} />, color: 'hsl(var(--success))' },
      { title: 'Công việc trễ hạn (Đỏ)', value: projectExecData.delayedTasks.toString(), change: 'Cần giải quyết ngay', isPositive: false, icon: <AlertCircle size={24} />, color: 'hsl(var(--danger))' },
      { title: 'Công việc nguy cơ (Vàng)', value: projectExecData.atRiskTasks.toString(), change: 'Cần theo dõi tiến độ', isPositive: false, icon: <Clock size={24} />, color: 'hsl(var(--warning))' },
      { title: 'Vật tư vượt định mức BOQ', value: projectExecData.materialsExceedingBOQ.toString(), change: 'Yêu cầu vượt BOQ', isPositive: false, icon: <Boxes size={24} />, color: 'hsl(346_84%_35%)' },
    ] : [];

    return (
      <div className="flex flex-col gap-6">
        <div className="glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-[1.1rem]">Giám sát dự án đang thi công</h3>
            <p className="text-xs text-[hsl(var(--text-secondary))]">Chọn dự án để xem báo cáo tiến độ và công việc chi tiết.</p>
          </div>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-4 py-2 text-sm border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--bg-main))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] font-semibold"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {loadingProjectExec ? (
          <div className="flex items-center justify-center min-h-[40vh] gap-3 text-[hsl(var(--text-muted))]">
            <span className="animate-spin text-2xl font-bold">↻</span>
            <span>Đang tải thông tin dự án...</span>
          </div>
        ) : !projectExecData ? (
          <div className="glass-panel p-10 text-center text-[hsl(var(--text-muted))]">
            Không tìm thấy thông tin báo cáo cho dự án này.
          </div>
        ) : (
          <div className="flex flex-col gap-8 animate-fade-in">
            <DashboardStats stats={statsProjectLeader} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel p-5 flex flex-col h-[380px]">
                <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
                  <TrendingUp size={18} className="text-[hsl(var(--primary))]" />
                  <span>Tiến độ theo Phase của Dự án</span>
                </h3>
                {phaseChartData.length > 0 ? (
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={phaseChartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={95} tick={{ fontSize: 11, fontWeight: 500 }} />
                        <RechartsTooltip
                          formatter={(value) => [`${value}%`, 'Tiến độ']}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                          cursor={{ fill: 'hsl(var(--bg-main))' }}
                        />
                        <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={18} fill="hsl(var(--primary))">
                          {phaseChartData.map((entry: { progress: number }, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.progress >= 80 ? 'hsl(var(--success))' : entry.progress >= 40 ? 'hsl(var(--primary))' : 'hsl(var(--warning))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[hsl(var(--text-muted))] text-xs">
                    Chưa có cấu trúc Phase trong dự án này.
                  </div>
                )}
              </div>

              <div className="glass-panel p-5 flex flex-col h-[380px]">
                <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
                  <ClipboardList className="text-[hsl(var(--primary))]" size={18} />
                  <span>Tỉ trọng trạng thái công việc (WBS Tasks)</span>
                </h3>
                <div className="flex-1 min-h-0 flex flex-col justify-center items-center">
                  {taskStatusData.length > 0 ? (
                    <div className="w-full h-full flex flex-col justify-between">
                      <div className="flex-1 min-h-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={taskStatusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {taskStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value) => [`${value} công việc`, 'Số lượng']} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 text-xs">
                        {taskStatusData.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-[hsl(var(--text-secondary))] font-medium">{entry.name}: <strong>{entry.value}</strong></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[hsl(var(--text-muted))] text-center text-xs">
                      Không có công việc trong dự án này.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {projectExecData.delayedTasksList && projectExecData.delayedTasksList.length > 0 && (
              <div className="glass-panel p-5 mt-2">
                <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
                  <AlertTriangle size={18} className="text-[hsl(var(--danger))]" />
                  <span>Danh sách công việc dự án cần chú ý ({projectExecData.delayedTasksList.length})</span>
                </h3>
                <div className="overflow-hidden border border-[hsl(var(--border))] rounded-lg">
                  <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
                    <table className="w-full text-xs text-left relative">
                      <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2.5 font-bold border-b border-[hsl(var(--border))]">Mức độ</th>
                          <th className="px-4 py-2.5 font-bold border-b border-[hsl(var(--border))]">Tên công việc</th>
                          <th className="px-4 py-2.5 font-bold border-b border-[hsl(var(--border))]">Phase</th>
                          <th className="px-4 py-2.5 font-bold border-b border-[hsl(var(--border))] text-right">Tiến độ</th>
                          <th className="px-4 py-2.5 font-bold border-b border-[hsl(var(--border))]">Hạn chót</th>
                          <th className="px-4 py-2.5 font-bold border-b border-[hsl(var(--border))]">Người đảm nhận</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[hsl(var(--border))]">
                        {projectExecData.delayedTasksList.map((task: any) => (
                          <tr
                            key={task.taskId}
                            onClick={() => navigate(`/projects/${selectedProjectId.replace('p-', '')}/tasks/${task.taskId}/logs`)}
                            className="hover:bg-[hsl(var(--bg-main))] transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${task.warningType === 'Red' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                {task.warningType === 'Red' ? '🔴 Trễ hạn' : '🟡 Nguy cơ'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-bold truncate max-w-[200px]">{task.taskName}</td>
                            <td className="px-4 py-2.5 text-[hsl(var(--text-secondary))]">{task.phaseName}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-[hsl(var(--primary-hover))]">{task.progressPercent}%</td>
                            <td className="px-4 py-2.5 text-[hsl(var(--text-muted))]">{new Date(task.endDate).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-2.5 text-[hsl(var(--text-secondary))] font-medium">{task.assigneeName || 'Chưa phân công'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 5. Kỹ sư hiện trường (Site Engineer)
  const renderSiteEngineerDashboard = () => {
    if (projects.length === 0) {
      return (
        <div className="glass-panel p-10 text-center text-[hsl(var(--text-muted))]">
          Chưa có dự án nào hoạt động được phân công cho Kỹ sư hiện trường.
        </div>
      );
    }

    const statsSiteEngineer = projectExecData ? [
      { title: 'Tiến độ Dự án', value: `${projectExecData.completedTasks} / ${projectExecData.totalTasks}`, change: `${Math.round((projectExecData.completedTasks / Math.max(1, projectExecData.totalTasks)) * 100)}% Hoàn thành`, isPositive: true, icon: <CheckSquare size={24} />, color: 'hsl(var(--success))' },
      { title: 'Công việc trễ hạn', value: projectExecData.delayedTasks.toString(), change: 'Cần đẩy nhanh tiến độ', isPositive: false, icon: <AlertCircle size={24} />, color: 'hsl(var(--danger))' },
      { title: 'Công việc nguy cơ', value: projectExecData.atRiskTasks.toString(), change: 'Theo dõi kỹ thuật', isPositive: false, icon: <Clock size={24} />, color: 'hsl(var(--warning))' },
      { title: 'Vật tư vượt định mức BOQ', value: projectExecData.materialsExceedingBOQ.toString(), change: 'Yêu cầu kiểm soát', isPositive: false, icon: <Boxes size={24} />, color: 'hsl(346_84%_35%)' },
    ] : [];

    const numericProjectId = selectedProjectId.replace('p-', '');

    return (
      <div className="flex flex-col gap-6">
        <div className="glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-[1.1rem]">Giám sát hiện trường dự án</h3>
            <p className="text-xs text-[hsl(var(--text-secondary))]">Chọn dự án tham gia thi công để rà soát công việc hiện trường.</p>
          </div>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-4 py-2 text-sm border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--bg-main))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] font-semibold"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {loadingProjectExec ? (
          <div className="flex items-center justify-center min-h-[40vh] gap-3 text-[hsl(var(--text-muted))]">
            <span className="animate-spin text-2xl font-bold">↻</span>
            <span>Đang tải thông tin hiện trường...</span>
          </div>
        ) : !projectExecData ? (
          <div className="glass-panel p-10 text-center text-[hsl(var(--text-muted))]">
            Không tìm thấy thông tin báo cáo cho dự án này.
          </div>
        ) : (
          <div className="flex flex-col gap-8 animate-fade-in">
            <DashboardStats stats={statsSiteEngineer} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="glass-panel p-5 flex flex-col h-[350px] lg:col-span-8">
                <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
                  <AlertTriangle size={18} className="text-[hsl(var(--danger))]" />
                  <span>Nhiệm vụ cần lưu ý của dự án</span>
                </h3>
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                  {(!projectExecData.delayedTasksList || projectExecData.delayedTasksList.length === 0) ? (
                    <div className="text-[hsl(var(--success))] text-center py-10 text-xs font-semibold">
                      Không có nhiệm vụ nào trễ hạn hoặc nguy cơ trễ trong dự án này.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {projectExecData.delayedTasksList.map((task: any) => {
                        const isAssignedToMe = task.assigneeName?.toLowerCase().includes(user?.name.toLowerCase() || 'never_match');
                        return (
                          <div
                            key={task.taskId}
                            onClick={() => navigate(`/projects/${numericProjectId}/tasks/${task.taskId}/logs`)}
                            className={`p-3 rounded border text-xs cursor-pointer hover:shadow-sm transition-all flex justify-between items-center gap-4 ${isAssignedToMe
                                ? 'bg-[hsl(var(--primary-glow)/0.4)] border-[hsl(var(--primary))] font-semibold'
                                : 'bg-[hsl(var(--bg-main))] border-[hsl(var(--border))]'
                              }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${task.warningType === 'Red' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                  {task.warningType === 'Red' ? 'Trễ hạn' : 'Nguy cơ'}
                                </span>
                                {isAssignedToMe && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[hsl(var(--primary))] text-white">
                                    Tôi phụ trách
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold truncate text-[hsl(var(--text-primary))]">{task.taskName}</h4>
                              <p className="text-[10px] text-[hsl(var(--text-muted))] mt-0.5">Phase: {task.phaseName}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[hsl(var(--primary-hover))] font-bold block">{task.progressPercent}%</span>
                              <span className="text-[10px] text-[hsl(var(--text-muted))] mt-0.5 block">DL: {new Date(task.endDate).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-panel p-5 flex flex-col h-[350px] lg:col-span-4">
                <h3 className="text-[1.05rem] font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
                  <Wrench size={18} className="text-[hsl(var(--primary))]" />
                  <span>Tác vụ nhanh hiện trường</span>
                </h3>
                <div className="flex-1 flex flex-col justify-between gap-3">
                  <button
                    onClick={() => navigate(`/projects/${numericProjectId}?tab=dailylogs`)}
                    className="w-full flex items-center justify-between p-3.5 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] transition-all cursor-pointer rounded-lg text-left outline-none font-bold text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-[hsl(var(--primary))]" />
                      <span>Báo cáo Nhật ký thi công</span>
                    </div>
                    <ChevronRight size={16} />
                  </button>

                  <button
                    onClick={() => navigate(`/projects/${numericProjectId}?tab=incidents`)}
                    className="w-full flex items-center justify-between p-3.5 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] transition-all cursor-pointer rounded-lg text-left outline-none font-bold text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={18} className="text-[hsl(var(--danger))]" />
                      <span>Báo cáo Sự cố Công trường</span>
                    </div>
                    <ChevronRight size={16} />
                  </button>

                  <button
                    onClick={() => navigate(`/projects/${numericProjectId}?tab=wbs`)}
                    className="w-full flex items-center justify-between p-3.5 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] transition-all cursor-pointer rounded-lg text-left outline-none font-bold text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <CheckSquare size={18} className="text-[hsl(var(--success))]" />
                      <span>Kiểm tra Sơ đồ WBS / BOQ</span>
                    </div>
                    <ChevronRight size={16} />
                  </button>

                  <button
                    onClick={() => navigate(`/projects/${numericProjectId}?tab=drawings`)}
                    className="w-full flex items-center justify-between p-3.5 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--bg-main))] transition-all cursor-pointer rounded-lg text-left outline-none font-bold text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Package size={18} className="text-[hsl(38_90%_45%)]" />
                      <span>Xem bản vẽ Thiết kế</span>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
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

      {/* Conditional Role Dashboard Renderer */}
      {user?.role === 'admin' || user?.role === 'director' ? renderDirectorDashboard() :
        user?.role === 'accountant' ? renderAccountantDashboard() :
          user?.role === 'technicalmanager' ? renderTechnicalManagerDashboard() :
            user?.role === 'projectleader' ? renderProjectLeaderDashboard() :
              user?.role === 'siteengineer' ? renderSiteEngineerDashboard() : (
                <div className="glass-panel p-6 text-center text-[hsl(var(--text-muted))]">
                  Giao diện đang được phát triển cho vai trò của bạn.
                </div>
              )}
    </div>
  );
};
