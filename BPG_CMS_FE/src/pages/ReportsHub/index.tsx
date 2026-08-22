import React, { useState, useEffect } from 'react';
import { projectService } from '../../services/projectService';
import type { Project } from '../../types/common';
import { ExecutiveDashboardReport } from './components/ExecutiveDashboardReport';
import { PortfolioDashboard } from './components/PortfolioDashboard';
import { ConstructionProgressReport } from './components/ConstructionProgressReport';
import { IncidentReport } from './components/IncidentReport';
import { ProcurementReport } from './components/ProcurementReport';
import { ReturnsAndSurplusReport } from './components/ReturnsAndSurplusReport';
import { BoqVsActualReport } from '../Reports/BoqVsActualReport';
import {
  LayoutDashboard, HardHat, AlertOctagon, Package, ShoppingCart,
  RotateCcw, Calendar, ChevronDown, Check, FolderKanban
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { TableLoader } from '../../components/ui';

const formatLocalDateInput = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

class ReportErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Report Component Render Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl m-4">
          <AlertOctagon size={32} className="mx-auto text-red-500 mb-2" />
          <h3 className="text-sm font-bold text-red-700 dark:text-red-300">Không thể hiển thị báo cáo</h3>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{this.state.error?.message || 'Đã xảy ra lỗi trong quá trình xử lý dữ liệu báo cáo.'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ReportsHub: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjectId = searchParams.get('projectId') || 'all';
  const activeTab = searchParams.get('tab') || 'executive';

  useEffect(() => {
    const validTabs = new Set([
      'executive', 'construction', 'incidents', 'boq', 'procurement', 'returns-surplus'
    ]);
    const projectOnlyTabs = new Set(['construction', 'incidents']);
    if (!validTabs.has(activeTab)
      || (selectedProjectId === 'all' && projectOnlyTabs.has(activeTab))) {
      setSearchParams({ projectId: selectedProjectId, tab: 'executive' }, { replace: true });
    }
  }, [activeTab, selectedProjectId, setSearchParams]);

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
      })
      .catch(err => console.error('Error fetching projects:', err))
      .finally(() => setLoading(false));
  }, []);

  const selectedProject = projects.find(p => p.id.toString() === selectedProjectId);

  const handleProjectSelect = (id: string) => {
    const projectOnlyTabs = ['construction', 'incidents'];
    const nextTab = id === 'all' && projectOnlyTabs.includes(activeTab)
      ? 'executive'
      : activeTab;
    setSearchParams({ projectId: id, tab: nextTab });
    setProjectDropdownOpen(false);
  };

  const handleTabChange = (tab: string) => {
    setSearchParams({ projectId: selectedProjectId, tab });
  };

  const applyPresetFilter = (preset: '30days' | 'quarter' | 'all') => {
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
      return;
    }
    const end = new Date();
    const start = new Date();
    if (preset === '30days') {
      start.setDate(end.getDate() - 29);
    } else if (preset === 'quarter') {
      start.setFullYear(end.getFullYear(), Math.floor(end.getMonth() / 3) * 3, 1);
    }
    setFromDate(formatLocalDateInput(start));
    setToDate(formatLocalDateInput(end));
  };

  const tabs = [
    { id: 'executive', label: 'Tổng quan', icon: <LayoutDashboard size={16} />, showForAll: true },
    { id: 'construction', label: 'Tiến độ Thi công', icon: <HardHat size={16} />, showForAll: false },
    { id: 'incidents', label: 'Sự cố', icon: <AlertOctagon size={16} />, showForAll: false },
    { id: 'boq', label: 'Định mức BOQ', icon: <Package size={16} />, showForAll: true },
    { id: 'procurement', label: 'Mua sắm & Chi phí', icon: <ShoppingCart size={16} />, showForAll: true },
    { id: 'returns-surplus', label: 'Hoàn trả & Vật tư thừa', icon: <RotateCcw size={16} />, showForAll: true },
  ];

  const visibleTabs = tabs.filter(tab => {
    if (selectedProjectId === 'all') return tab.showForAll;
    return true;
  });

  const filteredProjectsForDropdown = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  if (loading) {
    return (
      <TableLoader isTable={false} message="Đang tải Trung tâm Báo cáo..." minHeight="400px" />
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inprogress':
      case 'active': return 'bg-emerald-500';
      case 'paused': return 'bg-amber-500';
      case 'completed': return 'bg-blue-500';
      case 'closed': return 'bg-slate-400';
      default: return 'bg-slate-300';
    }
  };

  const filterProps = {
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in min-h-screen pb-10">
      {/* Top Header & Project Selection Dropdown */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))] m-0">Báo cáo và Phân tích</h1>
          <p className="text-xs text-[hsl(var(--text-muted))] m-0 mt-0.5">
            {selectedProjectId === 'all' ? 'Dữ liệu báo cáo tổng hợp tất cả các dự án' : `Báo cáo chi tiết: ${selectedProject?.name || ''}`}
          </p>
        </div>

        {/* Project Quick Select Dropdown */}
        <div className="relative shrink-0 w-full md:w-auto">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="w-full md:w-80 flex items-center justify-between gap-3 px-4 py-2.5 bg-[hsl(var(--bg-main))] hover:bg-[hsl(var(--border))] border border-[hsl(var(--border))] rounded-xl text-xs font-semibold transition-all shadow-sm text-[hsl(var(--text-primary))] cursor-pointer"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <FolderKanban size={16} className="text-[hsl(var(--primary))] shrink-0" />
              <span className="truncate">
                {selectedProjectId === 'all' ? 'Tất cả dự án (Tổng hợp)' : selectedProject?.name || 'Chọn Dự án'}
              </span>
            </div>
            <ChevronDown size={14} className={`text-[hsl(var(--text-muted))] transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {projectDropdownOpen && (
            <div className="absolute right-0 mt-2 w-full md:w-80 bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
              <div className="p-2 border-b border-[hsl(var(--border))]">
                <input
                  type="text"
                  placeholder="Tìm dự án..."
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))] rounded-lg text-xs focus:outline-none focus:border-[hsl(var(--primary))]"
                />
              </div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                <button
                  onClick={() => handleProjectSelect('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${selectedProjectId === 'all' ? 'bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--bg-main))] text-[hsl(var(--text-primary))]'}`}
                >
                  <span>Tất cả dự án (Báo cáo Tổng hợp)</span>
                  {selectedProjectId === 'all' && <Check size={14} />}
                </button>
                <div className="my-1 border-t border-[hsl(var(--border))]" />
                {filteredProjectsForDropdown.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleProjectSelect(p.id.toString())}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${selectedProjectId === p.id.toString() ? 'bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--bg-main))] text-[hsl(var(--text-primary))]'}`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden pr-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(p.status)}`} />
                      <span className="truncate">{p.name}</span>
                    </div>
                    {selectedProjectId === p.id.toString() && <Check size={14} className="shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Portfolio metrics are current-state metrics and do not support a historical range. */}
      {!(selectedProjectId === 'all' && activeTab === 'executive') && (
      <div className="bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--text-muted))] flex items-center gap-1.5 px-2">
            <Calendar size={14} className="text-[hsl(var(--primary))]" /> Kỳ báo cáo:
          </span>
          <div className="flex items-center gap-2 bg-[hsl(var(--bg-main))] px-3 py-1.5 rounded-xl border border-[hsl(var(--border))]">
            <input
              type="date"
              className="text-xs bg-transparent border-none focus:outline-none text-[hsl(var(--text-primary))]"
              value={fromDate}
              max={toDate || undefined}
              onChange={e => setFromDate(e.target.value)}
            />
            <span className="text-xs text-[hsl(var(--text-muted))]">đến</span>
            <input
              type="date"
              className="text-xs bg-transparent border-none focus:outline-none text-[hsl(var(--text-primary))]"
              value={toDate}
              min={fromDate || undefined}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
        </div>

        {/* Quick Presets & Export Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyPresetFilter('30days')}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-[hsl(var(--bg-main))] hover:bg-[hsl(var(--border))] text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))] transition-colors cursor-pointer"
          >
            30 ngày gần đây
          </button>
          <button
            onClick={() => applyPresetFilter('quarter')}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-[hsl(var(--bg-main))] hover:bg-[hsl(var(--border))] text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))] transition-colors cursor-pointer"
          >
            Quý này
          </button>
          <button
            onClick={() => applyPresetFilter('all')}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-[hsl(var(--bg-main))] hover:bg-[hsl(var(--border))] text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))] transition-colors cursor-pointer"
          >
            Toàn thời gian
          </button>
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="px-2.5 py-1 text-xs text-red-600 hover:text-red-700 font-semibold underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>
      )}

      {/* Segmented Pill Tabs */}
      <div className="flex border-b border-[hsl(var(--border))] overflow-x-auto custom-scrollbar bg-[hsl(var(--bg-card))] rounded-2xl p-1.5 items-center gap-1 shadow-sm">
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs transition-all whitespace-nowrap cursor-pointer
                ${isActive
                  ? 'bg-[hsl(var(--primary))] text-white shadow-sm font-bold scale-[1.01]'
                  : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-main))]'
                }
              `}
            >
              {tab.icon} <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Full-Width Content Container */}
      <div className="bg-[hsl(var(--bg-card))] rounded-2xl border border-[hsl(var(--border))] p-5 shadow-sm min-h-[calc(100vh-250px)]">
        {!selectedProjectId ? (
          <div className="p-12 text-center text-[hsl(var(--text-muted))]">
            Vui lòng chọn một dự án để xem báo cáo chi tiết.
          </div>
        ) : (
          <ReportErrorBoundary key={`${selectedProjectId}-${activeTab}-${fromDate}-${toDate}`}>
            <div className="animate-fade-in">
              {activeTab === 'executive' && (
                selectedProjectId === 'all'
                  ? <PortfolioDashboard />
                  : <ExecutiveDashboardReport projectId={Number(selectedProjectId)} {...filterProps} />
              )}
              {activeTab === 'construction' && (
                <ConstructionProgressReport projectId={selectedProjectId} {...filterProps} />
              )}
              {activeTab === 'incidents' && (
                <IncidentReport projectId={selectedProjectId} {...filterProps} />
              )}
              {activeTab === 'boq' && (
                <BoqVsActualReport embeddedProjectId={selectedProjectId} {...filterProps} />
              )}
              {activeTab === 'procurement' && (
                <ProcurementReport projectId={selectedProjectId} {...filterProps} />
              )}
              {activeTab === 'returns-surplus' && (
                <ReturnsAndSurplusReport projectId={selectedProjectId} {...filterProps} />
              )}
            </div>
          </ReportErrorBoundary>
        )}
      </div>
    </div>
  );
};
