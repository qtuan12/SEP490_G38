import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, ArrowLeft } from 'lucide-react';
import { Button, DataTable, Badge, Pagination } from '../../components/ui';
import { phaseAcceptanceService } from '../../services/phaseAcceptanceService';
import { projectService } from '../../services/projectService';
import { formatDate } from '../../utils/dateHelpers';
import { useSignalREvent } from '../../hooks/useSignalREvent';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useProjectAccess } from '../../hooks/useProjectAccess';

export const PhaseAcceptances: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchProjectId, setSearchProjectId] = useState(searchParams.get('projectId') || '');
  const [searchPhaseId, setSearchPhaseId] = useState(searchParams.get('phaseId') || '');
  
  const queryClient = useQueryClient();

  // Listen to realtime notifications via SignalR
  useSignalREvent('ReceiveNotification', (noti: any) => {
    if (noti?.referenceType === 'PhaseAcceptance' || noti?.referenceType === 'Project') {
      queryClient.invalidateQueries({ queryKey: ['phaseAcceptances'] });
      toast('Danh sách nghiệm thu giai đoạn vừa được cập nhật!', { icon: '📝' });
    }
  });

  // Lấy thông tin Tên Dự án & Tên Giai đoạn để hiển thị thay vì ID thô
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', searchProjectId],
    queryFn: () => projectService.getProjectById(searchProjectId),
    enabled: !!searchProjectId
  });

  const { data: phasesList, isLoading: phasesLoading } = useQuery({
    queryKey: ['phases', searchProjectId],
    queryFn: () => projectService.getPhases(searchProjectId),
    enabled: !!searchProjectId
  });

  const currentPhaseName = phasesList?.find((p: any) => p.id === searchPhaseId)?.name || '';

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

  const { canManageTechnical } = useProjectAccess(searchProjectId || null);
  const canManageAcceptance = canManageTechnical;

  const hasActiveAcceptance = data?.items?.some((item: any) => !item.isCancelled);
  const canCreate =
    searchProjectId &&
    searchPhaseId &&
    !hasActiveAcceptance &&
    canManageAcceptance;

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
      render: (row: any) => formatDate(row.acceptanceDate)
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
        {canManageAcceptance && (
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

      <div className="bg-[hsl(var(--bg-surface))] p-5 rounded-xl border border-[hsl(var(--border-light))] shadow-sm flex gap-6 flex-wrap items-center">
        <div className="flex flex-col gap-1 min-w-[220px]">
          <span className="text-xs text-[hsl(var(--text-secondary))] font-semibold uppercase tracking-wider">Dự án</span>
          <span className="text-sm font-bold text-[hsl(var(--text-primary))] bg-slate-100/60 px-3 py-2 rounded-md border border-slate-200/50 block">
            {projectLoading ? 'Đang tải...' : project?.name || `ID: ${searchProjectId}`}
          </span>
        </div>
        <div className="flex flex-col gap-1 min-w-[220px]">
          <span className="text-xs text-[hsl(var(--text-secondary))] font-semibold uppercase tracking-wider">Giai đoạn</span>
          <span className="text-sm font-bold text-[hsl(var(--text-primary))] bg-slate-100/60 px-3 py-2 rounded-md border border-slate-200/50 block">
            {phasesLoading ? 'Đang tải...' : currentPhaseName || `ID: ${searchPhaseId}`}
          </span>
        </div>
        <div className="ml-auto text-xs text-[hsl(var(--text-secondary))] italic bg-blue-50/50 text-blue-600 px-3 py-1.5 rounded-md border border-blue-100/50 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>

        </div>
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
