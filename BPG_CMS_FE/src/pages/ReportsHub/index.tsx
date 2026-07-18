import React, { useState, useEffect } from 'react';
import { projectService } from '../../services/projectService';
import type { Project } from '../../types/common';
import { ExecutiveDashboardReport } from './components/ExecutiveDashboardReport';
import { PortfolioDashboard } from './components/PortfolioDashboard';
import { ConstructionProgressReport } from './components/ConstructionProgressReport';
import { IncidentReport } from './components/IncidentReport';
import { InventoryLedgerReport } from './components/InventoryLedgerReport';
import { ProcurementReport } from './components/ProcurementReport';
import { BoqVsActualReport } from '../Reports/BoqVsActualReport';
import {
  LayoutDashboard, HardHat, AlertOctagon, Package, Warehouse, ShoppingCart, Loader2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const ReportsHub: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjectId = searchParams.get('projectId');
  const activeTab = searchParams.get('tab') || 'executive';

  useEffect(() => {
    projectService.getProjects()
      .then(data => {
        const filteredAndSorted = data
          .filter(p => p.status !== 'draft')
          .sort((a, b) => {
            if (a.status === 'inprogress' && b.status !== 'inprogress') return -1;
            if (a.status !== 'inprogress' && b.status === 'inprogress') return 1;
            return 0;
          });
        setProjects(filteredAndSorted);
        if (!selectedProjectId) {
          setSearchParams({ projectId: 'all', tab: 'executive' });
        }
      })
      .catch(err => console.error('Error fetching projects:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleProjectSelect = (projectId: string) => {
    setSearchParams({ projectId, tab: activeTab });
  };

  const handleTabChange = (tab: string) => {
    if (selectedProjectId) {
      setSearchParams({ projectId: selectedProjectId, tab });
    }
  };



  const tabs = [
    { id: 'executive', label: 'Tổng quan', icon: <LayoutDashboard size={16} />, showForAll: true },
    { id: 'construction', label: 'Tiến độ Thi công', icon: <HardHat size={16} />, showForAll: false },
    { id: 'incidents', label: 'Sự cố', icon: <AlertOctagon size={16} />, showForAll: false },
    { id: 'boq', label: 'Định mức BOQ', icon: <Package size={16} />, showForAll: true },
    { id: 'inventory', label: 'Kho vật tư', icon: <Warehouse size={16} />, showForAll: false },
    { id: 'procurement', label: 'Mua sắm & Chi phí', icon: <ShoppingCart size={16} />, showForAll: true },
  ];

  const visibleTabs = tabs.filter(tab => {
    if (selectedProjectId === 'all') return tab.showForAll;
    return true; // show all tabs for specific projects
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải trung tâm báo cáo...</span>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inprogress':
      case 'active': return 'bg-[hsl(var(--primary))]';
      case 'paused': return 'bg-[hsl(var(--warning))]';
      case 'completed': return 'bg-[hsl(var(--success))]';
      case 'closed': return 'bg-[hsl(var(--text-muted))]';
      default: return 'bg-[hsl(var(--border))]';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'inprogress':
      case 'active': return 'Đang chạy';
      case 'paused': return 'Tạm dừng';
      case 'completed': return 'Hoàn thành';
      case 'closed': return 'Đã đóng';
      default: return 'Bản nháp';
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in h-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold mb-0">Trung tâm Báo cáo</h1>
        <p className="text-[hsl(var(--text-secondary))] text-sm">Xem và phân tích chéo các chỉ số quản lý dự án.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left Sidebar: Master List */}
        {isSidebarOpen && (
          <div className="md:col-span-3 flex flex-col gap-2 bg-[hsl(var(--bg-main))] p-3 rounded-md border border-[hsl(var(--border))] h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar shadow-sm animate-fade-in">
            <div className="sticky top-0 bg-[hsl(var(--bg-main))] pb-2 border-b border-[hsl(var(--border))] z-10 mb-2 flex justify-between items-center">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-[hsl(var(--text-secondary))] px-2">Chọn Dự án</h3>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] p-1 rounded-md hover:bg-[hsl(var(--bg-muted))]"
                title="Thu gọn danh sách"
              >
                <PanelLeftClose size={18} />
              </button>
            </div>

            <button
              onClick={() => handleProjectSelect('all')}
              className={`text-left p-3 rounded-md transition-colors flex items-center gap-3 border ${selectedProjectId === 'all'
                ? 'bg-[hsl(var(--primary-glow))] border-[hsl(var(--primary))] text-[hsl(var(--primary-hover))] shadow-sm font-bold'
                : 'border-transparent hover:bg-[hsl(var(--bg-muted))] text-[hsl(var(--text-primary))]'
                }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${selectedProjectId === 'all' ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--border))] text-[hsl(var(--text-muted))]'}`}>
                <LayoutDashboard size={16} />
              </div>
              <div>
                <div className="text-[0.9rem]">Tất cả dự án </div>
                <div className="text-xs font-normal opacity-70">Báo cáo Tổng hợp</div>
              </div>
            </button>

            <div className="my-1 border-t border-[hsl(var(--border))]"></div>

            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => handleProjectSelect(p.id.toString())}
                className={`text-left p-3 rounded-md transition-colors flex items-center gap-3 border ${selectedProjectId === p.id.toString()
                  ? 'bg-white border-[hsl(var(--border))] shadow-sm font-semibold text-[hsl(var(--primary-hover))]'
                  : 'border-transparent hover:bg-[hsl(var(--bg-muted))] text-[hsl(var(--text-primary))]'
                  }`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(p.status)}`}></div>
                <div className="overflow-hidden">
                  <div className="text-[0.88rem] truncate">{p.name}</div>
                  <div className="text-[0.7rem] uppercase font-semibold text-[hsl(var(--text-muted))] mt-0.5">{getStatusLabel(p.status)}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Right Content: Detail View */}
        <div className={`flex flex-col min-h-[calc(100vh-200px)] transition-all ${isSidebarOpen ? 'md:col-span-9' : 'md:col-span-12'}`}>
          {/* Tabs */}
          <div className="flex border-b border-[hsl(var(--border))] overflow-x-auto custom-scrollbar mb-4 bg-[hsl(var(--bg-main))] rounded-t-md px-2 pt-2 items-center">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="mr-2 p-2 rounded-md hover:bg-[hsl(var(--bg-muted))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]"
                title="Mở rộng danh sách dự án"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 py-3 px-4 border-b-2 font-semibold text-[0.8rem] transition-colors whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary-hover))]'
                    : 'border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-muted))]'
                  }
                `}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Report Area */}
          <div className="bg-[hsl(var(--bg-main))] rounded-b-md flex-1 pb-6">
            {!selectedProjectId ? (
              <div className="p-10 text-center text-[hsl(var(--text-muted))]">
                Vui lòng chọn một dự án bên trái để xem báo cáo.
              </div>
            ) : (
              <div className="animate-fade-in">
                {activeTab === 'executive' && (
                  selectedProjectId === 'all'
                    ? <PortfolioDashboard />
                    : <ExecutiveDashboardReport projectId={Number(selectedProjectId)} />
                )}
                {activeTab === 'construction' && (
                  <ConstructionProgressReport projectId={selectedProjectId} />
                )}
                {activeTab === 'incidents' && (
                  <IncidentReport projectId={selectedProjectId} />
                )}
                {activeTab === 'boq' && (
                  <BoqVsActualReport embeddedProjectId={selectedProjectId} />
                )}
                {activeTab === 'inventory' && (
                  <InventoryLedgerReport projectId={selectedProjectId} />
                )}
                {activeTab === 'procurement' && (
                  <ProcurementReport projectId={selectedProjectId} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
