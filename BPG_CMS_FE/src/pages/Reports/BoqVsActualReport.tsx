import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportService, type BoqVsActualItemDto } from '../../services/reportService';
import { projectService } from '../../services/projectService';
import type {Project} from '../../types/common';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  embeddedProjectId?: string;
}

export const BoqVsActualReport: React.FC<Props> = ({ embeddedProjectId }) => {
  const params = useParams<{ projectId: string }>();
  const projectId = embeddedProjectId || params.projectId;
  const navigate = useNavigate();
  
  const [items, setItems] = useState<BoqVsActualItemDto[]>([]);
  const [allProjectsData, setAllProjectsData] = useState<{name: string, exceedCount: number}[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    (async () => {
      try {
        setLoading(true);
        if (projectId === 'all') {
          const projs = await projectService.getProjects();
          const activeProjs = projs.filter(p => p.status !== 'draft');
          const reports = await Promise.all(activeProjs.map(p => reportService.getBoqVsActual(Number(p.id)).catch(() => null)));
          
          const aggregated = activeProjs.map((p, idx) => {
            const r = reports[idx];
            return {
              name: p.name,
              exceedCount: r ? r.items.filter(i => i.isExceeding).length : 0
            };
          }).filter(x => x.exceedCount > 0);
          
          setAllProjectsData(aggregated.sort((a,b) => b.exceedCount - a.exceedCount));
          setProject(null);
        } else {
          const [projs, report] = await Promise.all([
            projectService.getProjects(),
            reportService.getBoqVsActual(Number(projectId))
          ]);
          setProject(projs.find(p => p.id === projectId) || null);
          setItems(report.items || []);
        }
      } catch (err: any) {
        setError(err.message || 'Lỗi tải báo cáo đối chiếu định mức');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải Báo cáo BOQ...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-10 text-center text-[hsl(var(--danger))]">{error}</div>;
  }

  const exceedingItemsCount = items.filter(i => i.isExceeding).length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between py-4 px-6 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] flex-wrap gap-3 rounded-md shadow-sm">
        <div className="flex items-center gap-3.5">
          {!embeddedProjectId && (
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="flex items-center gap-1.5 py-1.5 px-3.5 border border-[hsl(var(--border))] rounded-sm bg-transparent cursor-pointer text-[hsl(var(--text-secondary))] text-[0.85rem] font-medium hover:bg-[hsl(var(--bg-main))] transition-colors"
            >
              <ArrowLeft size={15} /><span>Quay lại Dự án</span>
            </button>
          )}
          <div>
            <h2 className="text-[1.1rem] font-bold m-0">Báo cáo Đối chiếu BOQ vs Thực tế</h2>
            <p className="text-[0.75rem] text-[hsl(var(--text-muted))] m-0 mt-1">Dự án: {project?.name}</p>
          </div>
        </div>
      </div>

      {projectId === 'all' ? (
        <div className="card p-5 border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))]">
          <h4 className="text-md font-semibold mb-4 text-[hsl(var(--text-primary))]">Dự án có vật tư vượt Định mức (Toàn công ty)</h4>
          {allProjectsData.length > 0 ? (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={allProjectsData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12}} />
                  <RechartsTooltip formatter={(value: any) => [`${value} mã vật tư`, 'Vượt định mức']} cursor={{fill: 'hsl(var(--bg-main))'}} />
                  <Bar dataKey="exceedCount" name="Mã vật tư vượt BOQ" fill="hsl(var(--danger))" radius={[0, 4, 4, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-10 text-center text-[hsl(var(--success))] font-medium">
              Tuyệt vời! Không có dự án nào có vật tư vượt định mức BOQ.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5 bg-[hsl(var(--bg-main))] flex items-center gap-4">
              <div className="p-3 bg-[hsl(var(--success-glow))] text-[hsl(var(--success))] rounded-full">
                <CheckCircle size={24} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[hsl(var(--text-muted))]">VẬT TƯ ĐÃ THỐNG KÊ</div>
                <div className="text-2xl font-bold text-[hsl(var(--text-primary))]">{items.length}</div>
              </div>
            </div>

            <div className="card p-5 bg-[hsl(var(--bg-main))] flex items-center gap-4 border-r-4 border-r-[hsl(var(--danger))]">
              <div className="p-3 bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))] rounded-full">
                <AlertTriangle size={24} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[hsl(var(--text-muted))]">VẬT TƯ VƯỢT ĐỊNH MỨC BOQ</div>
                <div className="text-2xl font-bold text-[hsl(var(--danger))]">{exceedingItemsCount}</div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          {items.length > 0 && (
            <div className="card p-5 border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))]">
              <h4 className="text-md font-semibold mb-4 text-[hsl(var(--text-primary))]">Top vật tư tiêu thụ (BOQ vs Thực tế)</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={items.slice(0, 10).map(i => ({
                      name: i.materialName,
                      boq: i.boqLimit,
                      actual: i.totalExpectedUsage,
                      isExceeding: i.isExceeding
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                    <YAxis />
                    <RechartsTooltip cursor={{fill: 'hsl(var(--bg-main))'}} />
                    <Legend />
                    <Bar dataKey="boq" name="Định mức (BOQ)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actual" name="Tổng tiêu thụ dự kiến" radius={[4, 4, 0, 0]}>
                      {items.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isExceeding ? 'hsl(var(--danger))' : 'hsl(var(--success))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left">
                <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--border))]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Mã VT</th>
                    <th className="px-4 py-3 font-semibold">Tên vật tư</th>
                    <th className="px-4 py-3 font-semibold">ĐVT</th>
                    <th className="px-4 py-3 font-semibold text-right">Định mức (BOQ)</th>
                    <th className="px-4 py-3 font-semibold text-right">Đã xuất</th>
                    <th className="px-4 py-3 font-semibold text-right">Tồn kho</th>
                    <th className="px-4 py-3 font-semibold text-right">Tổng TT Dự kiến</th>
                    <th className="px-4 py-3 font-semibold text-right">Vượt mức</th>
                    <th className="px-4 py-3 font-semibold text-center">Cảnh báo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {items.map(item => (
                    <tr key={item.materialId} className={`hover:bg-[hsl(var(--bg-main))] transition-colors ${item.isExceeding ? 'bg-[hsl(var(--danger-glow))]' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs">{item.materialCode}</td>
                      <td className="px-4 py-3 font-medium">{item.materialName}</td>
                      <td className="px-4 py-3">{item.unitName}</td>
                      <td className="px-4 py-3 text-right font-semibold">{item.boqLimit}</td>
                      <td className="px-4 py-3 text-right">{item.totalIssued}</td>
                      <td className="px-4 py-3 text-right">{item.stockRemaining}</td>
                      <td className="px-4 py-3 text-right font-bold">{item.totalExpectedUsage}</td>
                      <td className={`px-4 py-3 text-right font-bold ${item.isExceeding ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--success))]'}`}>
                        {item.isExceeding ? `+${item.exceededAmount}` : '0'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.isExceeding ? (
                          <div className="inline-flex items-center gap-1 text-[hsl(var(--danger))] bg-[hsl(var(--danger)/0.1)] px-2 py-1 rounded text-xs font-bold">
                            <AlertTriangle size={14} /> VƯỢT
                          </div>
                        ) : (
                          <span className="text-[hsl(var(--success))] text-xs font-semibold">AN TOÀN</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">
                        Chưa có dữ liệu định mức vật tư cho dự án này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
