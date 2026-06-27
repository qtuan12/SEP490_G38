// Force IDE TS Server to re-parse this file
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { inventoryAdjustmentService, type InventoryAdjustmentDto } from '../../../services/inventoryAdjustmentService';
import { projectService } from '../../../services/projectService';
import { Button, Badge, Pagination } from '../../../components/ui';
import { Plus, Minus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { CreateIncreaseAdjustmentModal } from './CreateIncreaseAdjustmentModal';
import { CreateDecreaseAdjustmentModal } from './CreateDecreaseAdjustmentModal';
import { ReviewAdjustmentModal } from './ReviewAdjustmentModal';

interface AdjustmentListProps {
  projectId: number;
}

export const AdjustmentList: React.FC<AdjustmentListProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [data, setData] = useState<InventoryAdjustmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isProjectLeader, setIsProjectLeader] = useState(false);

  // Modals state
  const [isIncreaseOpen, setIsIncreaseOpen] = useState(false);
  const [isDecreaseOpen, setIsDecreaseOpen] = useState(false);
  const [reviewId, setReviewId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await inventoryAdjustmentService.getAdjustments(projectId, {
        pageNumber: page,
        pageSize,
        adjustmentType: typeFilter || undefined,
        status: statusFilter || undefined
      });
      setData(res.items);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, page, pageSize, typeFilter, statusFilter]);

  useEffect(() => {
    const checkLeader = async () => {
      if (!user) return;
      if (user.role === 'admin') {
        setIsProjectLeader(true);
        return;
      }
      try {
        const members = await projectService.getMembers(projectId.toString());
        const me = members.find(m => m.userId === user.id?.toString() || m.userId === user.id);
        if (me && me.isLeader) {
          setIsProjectLeader(true);
        } else {
          setIsProjectLeader(false);
        }
      } catch (err) {
        console.error('Failed to check leader role:', err);
      }
    };
    checkLeader();
  }, [projectId, user]);

  const handleSuccess = () => {
    setIsIncreaseOpen(false);
    setIsDecreaseOpen(false);
    setReviewId(null);
    loadData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending': return <Badge variant="warning"><Clock size={12} className="mr-1"/> Chờ duyệt</Badge>;
      case 'Approved': return <Badge variant="success"><CheckCircle size={12} className="mr-1"/> Đã duyệt</Badge>;
      case 'Rejected': return <Badge variant="danger"><XCircle size={12} className="mr-1"/> Từ chối</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === 'Increase') return <span className="text-[hsl(var(--success))] font-medium flex items-center gap-1"><Plus size={14}/> Tăng</span>;
    if (type === 'Decrease') return <span className="text-[hsl(var(--danger))] font-medium flex items-center gap-1"><Minus size={14}/> Giảm</span>;
    return <span>{type}</span>;
  };

  const canCreateIncrease = isProjectLeader || user?.role === 'admin';
  const canCreateDecrease = user?.role === 'accountant' || user?.role === 'admin';

  return (
    <div className="bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-[hsl(var(--border))] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-2">
          <select 
            className="px-3 py-1.5 border border-[hsl(var(--border))] rounded-lg text-sm bg-transparent"
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tất cả loại</option>
            <option value="Increase">Tăng tồn kho</option>
            <option value="Decrease">Giảm tồn kho</option>
          </select>

          <select 
            className="px-3 py-1.5 border border-[hsl(var(--border))] rounded-lg text-sm bg-transparent"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="Pending">Chờ duyệt</option>
            <option value="Approved">Đã duyệt</option>
            <option value="Rejected">Từ chối</option>
          </select>
        </div>

        <div className="flex gap-2">
          {canCreateDecrease && (
            <Button variant="danger" className="flex items-center gap-1.5 text-sm" onClick={() => setIsDecreaseOpen(true)}>
              <Minus size={16} /> Phiếu Giảm (Sự cố)
            </Button>
          )}
          {canCreateIncrease && (
            <Button variant="primary" className="flex items-center gap-1.5 text-sm" onClick={() => setIsIncreaseOpen(true)}>
              <Plus size={16} /> Phiếu Tăng
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={`w-full text-sm text-left ${loading ? 'opacity-50' : ''}`}>
          <thead className="bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--border))]">
            <tr>
              <th className="px-4 py-3 font-medium">Mã Phiếu</th>
              <th className="px-4 py-3 font-medium">Loại</th>
              <th className="px-4 py-3 font-medium">Lý do</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Ngày tạo</th>
              <th className="px-4 py-3 font-medium">Người duyệt</th>
              <th className="px-4 py-3 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[hsl(var(--text-muted))]">
                  Không có dữ liệu phiếu điều chỉnh
                </td>
              </tr>
            ) : (
              data.map(item => (
                <tr key={item.adjustmentId} className="hover:bg-[hsl(var(--bg-main))]/50 transition-colors">
                  <td className="px-4 py-3 font-medium">ADJ-{item.adjustmentId.toString().padStart(5, '0')}</td>
                  <td className="px-4 py-3">{getTypeBadge(item.adjustmentType)}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={item.reason}>{item.reason}</td>
                  <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                  <td className="px-4 py-3">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                  <td className="px-4 py-3">{item.approverName || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setReviewId(item.adjustmentId)}>
                      {item.status === 'Pending' && (user?.role === 'director' || user?.role === 'admin') ? 'Duyệt' : 'Xem chi tiết'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-[hsl(var(--border))]">
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(totalCount / pageSize)}
          onPageChange={setPage}
        />
      </div>

      {isIncreaseOpen && (
        <CreateIncreaseAdjustmentModal
          isOpen={isIncreaseOpen}
          onClose={() => setIsIncreaseOpen(false)}
          onSuccess={handleSuccess}
          projectId={projectId}
        />
      )}

      {isDecreaseOpen && (
        <CreateDecreaseAdjustmentModal
          isOpen={isDecreaseOpen}
          onClose={() => setIsDecreaseOpen(false)}
          onSuccess={handleSuccess}
          projectId={projectId}
        />
      )}

      {reviewId !== null && (
        <ReviewAdjustmentModal
          isOpen={reviewId !== null}
          onClose={() => setReviewId(null)}
          onSuccess={handleSuccess}
          adjustmentId={reviewId}
          adjustmentData={data.find(x => x.adjustmentId === reviewId)}
        />
      )}
    </div>
  );
};
