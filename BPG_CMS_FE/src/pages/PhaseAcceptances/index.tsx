import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Ban } from 'lucide-react';
import { Button, Input, DataTable, Badge } from '../../components/ui';
import { phaseAcceptanceService } from '../../services/phaseAcceptanceService';
import { CancelAcceptanceModal } from './CancelAcceptanceModal';

export const PhaseAcceptances: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchProjectId, setSearchProjectId] = useState(searchParams.get('projectId') || '');
  const [searchPhaseId, setSearchPhaseId] = useState(searchParams.get('phaseId') || '');
  
  // Đồng bộ lại khi URL thay đổi
  useEffect(() => {
    if (searchParams.get('projectId')) setSearchProjectId(searchParams.get('projectId')!);
    if (searchParams.get('phaseId')) setSearchPhaseId(searchParams.get('phaseId')!);
  }, [searchParams]);
  
  const [selectedCancelId, setSelectedCancelId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['phaseAcceptances', page, pageSize, searchProjectId, searchPhaseId],
    queryFn: () => phaseAcceptanceService.getPhaseAcceptances({
      pageIndex: page,
      pageSize,
      projectId: searchProjectId ? Number(searchProjectId) : undefined,
      phaseId: searchPhaseId ? Number(searchPhaseId) : undefined
    })
  });

  const handleCancelClick = (id: number) => {
    setSelectedCancelId(id);
  };

  const handleCancelSuccess = () => {
    setSelectedCancelId(null);
    refetch();
  };

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
          {row.pdfUrl && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open(row.pdfUrl, '_blank')}
              title="Tải/Xem PDF"
            >
              <Download size={16} />
            </Button>
          )}
          {!row.isCancelled && (
            <Button 
              variant="danger" 
              size="sm" 
              onClick={() => handleCancelClick(row.acceptanceId)}
              title="Hủy nghiệm thu"
            >
              <Ban size={16} />
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Danh sách Nghiệm thu Giai đoạn</h1>
          <p className="text-[hsl(var(--text-secondary))] mt-1">Quản lý các biên bản nghiệm thu đã lập</p>
        </div>
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
          <div className="p-4 border-t border-[hsl(var(--border-light))] flex justify-between items-center bg-[hsl(var(--bg-surface))]">
            <span className="text-sm text-[hsl(var(--text-secondary))]">
              Hiển thị {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, data.totalCount)} trong {data.totalCount}
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Trước
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page * pageSize >= data.totalCount}
                onClick={() => setPage(p => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {selectedCancelId && (
        <CancelAcceptanceModal 
          acceptanceId={selectedCancelId}
          isOpen={true}
          onClose={() => setSelectedCancelId(null)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  );
};
