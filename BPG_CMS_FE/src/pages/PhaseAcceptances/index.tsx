import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, ArrowLeft } from 'lucide-react';
import { Button, Input, DataTable, Badge, Pagination } from '../../components/ui';
import { phaseAcceptanceService } from '../../services/phaseAcceptanceService';
import { useAuth } from '../../context/AuthContext';

export const PhaseAcceptances: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchProjectId, setSearchProjectId] = useState(searchParams.get('projectId') || '');
  const [searchPhaseId, setSearchPhaseId] = useState(searchParams.get('phaseId') || '');
  
  // Đồng bộ lại khi URL thay đổi
  useEffect(() => {
    if (searchParams.get('projectId')) setSearchProjectId(searchParams.get('projectId')!);
    if (searchParams.get('phaseId')) setSearchPhaseId(searchParams.get('phaseId')!);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['phaseAcceptances', page, pageSize, searchProjectId, searchPhaseId],
    queryFn: () => phaseAcceptanceService.getPhaseAcceptances({
      pageIndex: page,
      pageSize,
      projectId: searchProjectId ? Number(searchProjectId) : undefined,
      phaseId: searchPhaseId ? Number(searchPhaseId) : undefined
    })
  });

  const { user } = useAuth();

  const hasActiveAcceptance = data?.items?.some((item: any) => !item.isCancelled);
  const canCreate = searchProjectId && searchPhaseId && !hasActiveAcceptance && user?.role === 'technicalmanager';

  const columns = [
    { key: 'acceptanceId', header: 'ID' },
    { 
      key: 'projectName',
      header: 'Dự án', 
      render: (row: any) => <div className="font-medium text-[hsl(var(--text-primary))]">{row.projectName}</div>
    },
    { 
      key: 'phaseName',
      header: 'Giai đoạn', 
      render: (row: any) => <div className="text-[hsl(var(--text-secondary))]">{row.phaseName}</div>
    },
    { 
      key: 'acceptedByName',
      header: 'Người nghiệm thu'
    },
    { 
      key: 'acceptanceDate',
      header: 'Ngày nghiệm thu', 
      render: (row: any) => {
        try {
          return new Date(row.acceptanceDate).toLocaleDateString('vi-VN', {
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
          });
        } catch {
          return row.acceptanceDate;
        }
      }
    },
    { 
      key: 'isCancelled',
      header: 'Trạng thái', 
      render: (row: any) => (
        <Badge variant={row.isCancelled ? 'danger' : 'success'}>
          {row.isCancelled ? 'Đã hủy' : 'Hợp lệ'}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Hành động',
      render: (row: any) => (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(`/projects/${row.projectId || searchProjectId}/phases/${row.phaseId}/acceptance?historyId=${row.acceptanceId}`)}
            title="Xem chi tiết"
          >
            <Eye size={16} />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {searchProjectId && (
        <button 
          onClick={() => navigate(`/projects/${searchProjectId}`)} 
          className="inline-flex items-center gap-1.5 bg-transparent border-none text-[hsl(var(--text-secondary))] cursor-pointer text-[0.9rem] font-medium w-fit hover:text-[hsl(var(--primary))] transition-colors p-0 mb-2"
        >
          <ArrowLeft size={16} />
          <span>Quay lại Không gian dự án</span>
        </button>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Danh sách Nghiệm thu Giai đoạn</h1>
          <p className="text-[hsl(var(--text-secondary))] mt-1">Quản lý các biên bản nghiệm thu đã lập</p>
        </div>
        {user?.role === 'technicalmanager' && (
          <Button 
            variant="primary" 
            disabled={!canCreate}
            onClick={() => navigate(`/projects/${searchProjectId}/phases/${searchPhaseId}/acceptance`)}
            title={!searchProjectId || !searchPhaseId ? 'Vui lòng nhập ID Dự án và ID Giai đoạn để lọc' : hasActiveAcceptance ? 'Phải hủy biên bản hiện hành mới được tạo mới' : ''}
          >
            Tạo biên bản nghiệm thu
          </Button>
        )}
      </div>

      <div className="bg-[hsl(var(--bg-surface))] p-4 rounded-xl border border-[hsl(var(--border-light))] shadow-sm flex gap-4 items-end">
        <div className="w-64">
          <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1">
            ID Dự án
          </label>
          <Input 
            placeholder="Nhập Project ID..." 
            value={searchProjectId}
            onChange={(e) => setSearchProjectId(e.target.value)}
          />
        </div>
        <div className="w-64">
          <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1">
            ID Giai đoạn
          </label>
          <Input 
            placeholder="Nhập Phase ID..." 
            value={searchPhaseId}
            onChange={(e) => setSearchPhaseId(e.target.value)}
          />
        </div>
        <Button variant="primary" onClick={() => setPage(1)}>Lọc</Button>
      </div>

      <div className="bg-[hsl(var(--bg-surface))] rounded-xl border border-[hsl(var(--border-light))] shadow-sm overflow-hidden">
        <DataTable 
          columns={columns} 
          data={data?.items || []} 
          isLoading={isLoading}
          keyExtractor={(item: any) => item.acceptanceId}
        />
        
        {/* Simple Pagination */}
        {data && data.totalCount > 0 && (
          <div className="p-4 border-t border-[hsl(var(--border-light))] bg-[hsl(var(--bg-surface))]">
            <Pagination
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(data.totalCount / pageSize))}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};
