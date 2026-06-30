import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import type { Project } from '../../types/common';
import { AdjustmentList } from './components/AdjustmentList';
import { GlobalInventoryIncidents } from './components/GlobalInventoryIncidents';
import { Loader2, FileSignature, AlertTriangle } from 'lucide-react';
import { FormItem } from '../../components/ui';

export const InventoryAdjustmentsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'adjustments' | 'incidents'>('adjustments');

  useEffect(() => {
    loadProjects();
  }, []);

  const { user } = useAuth();
  const isGlobalRole = user?.role === 'technicalmanager' || user?.role === 'admin' || user?.role === 'accountant';

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await projectService.getProjects();
      setProjects(data);
      if (isGlobalRole) {
        setSelectedProjectId('all');
      } else if (data && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const parsedProjectId = selectedProjectId && selectedProjectId !== 'all'
    ? (parseInt(selectedProjectId.replace('p-', ''), 10) || null)
    : null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quản lý Phiếu Điều Chỉnh & Sự cố Kho</h1>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
          Xem, tạo, phê duyệt phiếu điều chỉnh tăng/giảm và xử lý các sự cố vật tư.
        </p>
      </div>

      <div className="bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--text-muted))]">
            <Loader2 className="animate-spin" size={16} /> Đang tải dự án...
          </div>
        ) : (
          <div className="w-full md:w-1/3">
            <FormItem label="Chọn dự án">
              <select
                className="w-full px-3 py-2 border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] bg-transparent"
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                {isGlobalRole && <option value="all">-- Tất cả dự án --</option>}
                {!isGlobalRole && <option value="" disabled>-- Chọn dự án --</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormItem>
          </div>
        )}
      </div>

      <div className="flex border-b border-[hsl(var(--border))]">
        <button
          onClick={() => setActiveTab('adjustments')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === 'adjustments' 
              ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' 
              : 'border-transparent text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-main))] hover:border-[hsl(var(--border))]'
          }`}
        >
          <FileSignature size={18} />
          Phiếu Điều Chỉnh
        </button>
        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === 'incidents' 
              ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' 
              : 'border-transparent text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-main))] hover:border-[hsl(var(--border))]'
          }`}
        >
          <AlertTriangle size={18} />
          Báo cáo Sự cố Kho/Vật tư
        </button>
      </div>

      {selectedProjectId === 'all' ? (
        activeTab === 'adjustments' ? (
          <div className="text-center py-10 text-[hsl(var(--text-muted))]">
            Vui lòng chọn một dự án cụ thể để xem phiếu điều chỉnh.
          </div>
        ) : (
          <GlobalInventoryIncidents projectId={0} />
        )
      ) : parsedProjectId ? (
        activeTab === 'adjustments' ? (
          <AdjustmentList projectId={parsedProjectId} />
        ) : (
          <GlobalInventoryIncidents projectId={parsedProjectId} />
        )
      ) : (
        !loading && (
          <div className="text-center py-10 text-[hsl(var(--text-muted))]">
            Vui lòng chọn một dự án để xem dữ liệu.
          </div>
        )
      )}
    </div>
  );
};
