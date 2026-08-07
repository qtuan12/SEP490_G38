import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import type { Project } from '../../types/common';
import { AdjustmentList } from './components/AdjustmentList';
import { Loader2, FileSignature } from 'lucide-react';
import { FormItem } from '../../components/ui';
import { RoleGroup } from '../../auth/roles';
import { useRealtimeDataRefresh } from '../../hooks/useRealtimeDataRefresh';
import { RealtimeEntities } from '../../constants/realtimeEntities';

const PROJECT_SELECTOR_REALTIME_ENTITIES = RealtimeEntities.projects.filter(
  entity => entity === 'Project' || entity === 'ProjectMember',
);

export const InventoryAdjustmentsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { hasAnyRole } = useAuth();
  const isGlobalRole = hasAnyRole(RoleGroup.Reports);

  const loadProjects = async (preserveSelection = false, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await projectService.getProjects();
      setProjects(data);
      setSelectedProjectId(current => {
        if (
          preserveSelection
          && current
          && ((current === 'all' && isGlobalRole) || data.some(project => project.id === current))
        ) return current;

        if (isGlobalRole) return 'all';
        return data.length > 0 ? data[0].id : null;
      });
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [isGlobalRole]);

  // Keep the current project selected when the accessible project list changes.
  useRealtimeDataRefresh(
    () => loadProjects(true, false),
    PROJECT_SELECTOR_REALTIME_ENTITIES,
  );

  const parsedProjectId = selectedProjectId && selectedProjectId !== 'all'
    ? (parseInt(selectedProjectId.replace('p-', ''), 10) || null)
    : null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quản lý Kiểm kê vật tư & Sự cố Kho</h1>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
          Xem, tạo, phê duyệt phiếu kiểm kê vật tư và xử lý các sự cố vật tư.
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
                className="w-full px-3 py-2 border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]"
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                {isGlobalRole && <option value="all" className="bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]">-- Tất cả dự án --</option>}
                {!isGlobalRole && <option value="" disabled className="bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]">-- Chọn dự án --</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))]">
                    {p.name}
                  </option>
                ))}
              </select>
            </FormItem>
          </div>
        )}
      </div>

      <div className="flex border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]">
          <FileSignature size={18} />
          Danh sách Kiểm kê
        </div>
      </div>

      {selectedProjectId === 'all' ? (
        <AdjustmentList projectId={0} />
      ) : parsedProjectId ? (
        <AdjustmentList projectId={parsedProjectId} />
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
