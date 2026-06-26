import React, { useState, useEffect } from 'react';

import { projectService } from '../../services/projectService';
import type { Project } from '../../types/common';
import { AdjustmentList } from './components/AdjustmentList';
import { Loader2 } from 'lucide-react';
import { FormItem } from '../../components/ui';

export const InventoryAdjustmentsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await projectService.getProjects();
      setProjects(data);
      if (data && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quản lý Phiếu Điều Chỉnh</h1>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
          Xem, tạo và phê duyệt các phiếu điều chỉnh tăng/giảm tồn kho.
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
                <option value="" disabled>-- Chọn dự án --</option>
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

      {selectedProjectId ? (
        <AdjustmentList projectId={parseInt(selectedProjectId.replace('p-', '')) || 0} />
      ) : (
        !loading && (
          <div className="text-center py-10 text-[hsl(var(--text-muted))]">
            Vui lòng chọn một dự án để xem phiếu điều chỉnh.
          </div>
        )
      )}
    </div>
  );
};
