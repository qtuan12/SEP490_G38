import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportService, type CostReferenceReportDto } from '../../services/reportService';
import { projectService } from '../../services/projectService';
import type {Project} from '../../types/common';
import { ArrowLeft, Loader2, DollarSign, ShoppingCart, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  embeddedProjectId?: string;
}

export const CostReferenceReport: React.FC<Props> = ({ embeddedProjectId }) => {
  const params = useParams<{ projectId: string }>();
  const projectId = embeddedProjectId || params.projectId;
  const navigate = useNavigate();
  
  const [reportData, setReportData] = useState<CostReferenceReportDto | null>(null);
  const [allProjectsData, setAllProjectsData] = useState<{name: string, valid: number, invalid: number}[]>([]);
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
          const reports = await Promise.all(activeProjs.map(p => reportService.getCostReference(Number(p.id)).catch(() => null)));
          
          const aggregated = activeProjs.map((p, idx) => {
            const r = reports[idx];
            return {
              name: p.name,
              valid: r ? r.totalPoCost : 0,
              invalid: r ? r.totalDirectPurchaseCost : 0,
            };
          }).filter(x => x.valid > 0 || x.invalid > 0);
          
          setAllProjectsData(aggregated);
          setProject(null);
        } else {
          const [projs, report] = await Promise.all([
            projectService.getProjects(),
            reportService.getCostReference(Number(projectId))
          ]);
          setProject(projs.find(p => p.id === projectId) || null);
          setReportData(report);
        }
      } catch (err: any) {
        setError(err.message || 'Lỗi tải báo cáo chi phí');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải Báo cáo Chi phí tham khảo...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-10 text-center text-[hsl(var(--danger))]">{error}</div>;
  }

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
            <h2 className="text-[1.1rem] font-bold m-0">Báo cáo Chi phí tham khảo</h2>
            <p className="text-[0.75rem] text-[hsl(var(--text-muted))] m-0 mt-1">Dự án: {project?.name}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-[hsl(var(--warning-glow))] border border-[hsl(var(--warning)/0.3)] text-[hsl(var(--warning))] rounded-md text-sm">
        <AlertCircle size={20} className="shrink-0" />
        <div>
          <strong>Lưu ý:</strong> Đây là báo cáo chi phí mang tính chất tham khảo dựa trên tổng giá trị các đơn đặt hàng (PO) và mua ngoài khẩn cấp (Direct Purchase).
          Hạch toán lợi nhuận/thua lỗ chính thức cần được thực hiện trên phần mềm Kế toán riêng của công ty.
        </div>
      </div>

      {projectId === 'all' ? (
        <div className="card p-5 border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))]">
          <h4 className="text-md font-semibold mb-4 text-[hsl(var(--text-primary))]">So sánh Chi phí giữa các Dự án</h4>
          {allProjectsData.length > 0 ? (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={allProjectsData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{fontSize: 11}} interval={0} angle={-45} textAnchor="end" />
                  <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Tr`} />
                  <RechartsTooltip formatter={(value: any) => {
                    const numValue = Number(value) || 0;
                    return [`${numValue.toLocaleString('vi-VN')} VNĐ`, 'Giá trị'];
                  }} cursor={{fill: 'hsl(var(--bg-main))'}} />
                  <Legend verticalAlign="top" height={36}/>
                  <Bar dataKey="valid" name="PO Đã duyệt (Hợp lệ)" stackId="a" fill="hsl(var(--primary))" maxBarSize={60} />
                  <Bar dataKey="invalid" name="Mua ngoài (Sự cố)" stackId="a" fill="hsl(var(--danger))" maxBarSize={60} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-10 text-center text-[hsl(var(--text-muted))]">Chưa có dữ liệu chi phí nào cho các dự án.</div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 bg-[hsl(var(--bg-main))] flex items-center gap-4 border-l-4 border-l-[hsl(var(--primary))]">
              <div className="p-3 bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] rounded-full">
                <ShoppingCart size={24} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Tổng giá trị PO</div>
                <div className="text-2xl font-bold text-[hsl(var(--text-primary))]">
                  {reportData?.totalPoCost.toLocaleString('vi-VN')} <span className="text-sm text-[hsl(var(--text-muted))] font-normal">VNĐ</span>
                </div>
              </div>
            </div>

            <div className="card p-5 bg-[hsl(var(--bg-main))] flex items-center gap-4 border-l-4 border-l-[hsl(var(--danger))]">
              <div className="p-3 bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))] rounded-full">
                <AlertCircle size={24} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Mua ngoài (Sự cố)</div>
                <div className="text-2xl font-bold text-[hsl(var(--text-primary))]">
                  {reportData?.totalDirectPurchaseCost.toLocaleString('vi-VN')} <span className="text-sm text-[hsl(var(--text-muted))] font-normal">VNĐ</span>
                </div>
              </div>
            </div>

            <div className="card p-5 bg-[hsl(var(--bg-main))] flex items-center gap-4 border-l-4 border-l-[hsl(var(--success))]">
              <div className="p-3 bg-[hsl(var(--success-glow))] text-[hsl(var(--success))] rounded-full">
                <DollarSign size={24} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">TỔNG CHI PHÍ VẬT TƯ</div>
                <div className="text-3xl font-black text-[hsl(var(--success))]">
                  {reportData?.totalCost.toLocaleString('vi-VN')} <span className="text-sm text-[hsl(var(--text-muted))] font-normal">VNĐ</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5 border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))]">
            <h4 className="text-md font-semibold mb-4 text-[hsl(var(--text-primary))]">Biểu đồ Phân bổ Chi phí</h4>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'PO Đã duyệt (Hợp lệ)', value: reportData?.totalPoCost || 0, color: 'hsl(var(--primary))' },
                    { name: 'Mua ngoài (Sự cố)', value: reportData?.totalDirectPurchaseCost || 0, color: 'hsl(var(--danger))' }
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{fontSize: 12}} />
                  <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Tr`} />
                  <RechartsTooltip formatter={(value: any) => {
                    const numValue = Number(value) || 0;
                    return [`${numValue.toLocaleString('vi-VN')} VNĐ`, 'Giá trị'];
                  }} cursor={{fill: 'hsl(var(--bg-main))'}} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={100}>
                    {
                      [
                        { color: 'hsl(var(--primary))' },
                        { color: 'hsl(var(--danger))' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
