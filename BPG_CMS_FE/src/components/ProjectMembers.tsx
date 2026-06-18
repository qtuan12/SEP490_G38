import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type {ProjectMember} from '../types/common';
import { userService } from '../services/userService';
import type { UserProfile } from '../services/authService';
import { Modal } from './ui/Modal';
import { Crown, UserPlus, UserX, Loader2, UserCheck } from 'lucide-react';

interface ProjectMembersProps {
  projectId: string;
}

export const ProjectMembers: React.FC<ProjectMembersProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [availableEngineers, setAvailableEngineers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const isTPKT = user?.role === 'technicalmanager' || user?.role === 'admin';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const projMembers = await projectService.getMembers(projectId);
      setMembers(projMembers);

      // Only TPKT/Admin needs to load all users to add them
      if (isTPKT) {
        const usersResponse = await userService.getUsers({ pageSize: 1000 });
        const allUsers = usersResponse.items;
        // Filter out those who are not engineers or are already members of this project
        const engineers = allUsers.filter(u =>
          u.role?.toLowerCase() === 'siteengineer' && !projMembers.some(m => m.userId === u.id)
        );
        setAvailableEngineers(engineers);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải thành viên dự án.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const openAddModal = () => {
    setSelectedUserIds([]);
    setSearchQuery('');
    setIsAddOpen(true);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) return;

    try {
      const usersResponse = await userService.getUsers({ pageSize: 1000 });
      const allUsers = usersResponse.items;
      
      await Promise.all(selectedUserIds.map(id => {
        const targetUser = allUsers.find(u => u.id === id);
        if (targetUser) {
          return projectService.addMember(projectId, {
            id: targetUser.id,
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role
          });
        }
      }));

      setSuccess(`Đã thêm ${selectedUserIds.length} kỹ sư vào dự án.`);
      setIsAddOpen(false);
      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi gán thành viên. Có thể một số thành viên đã tồn tại.');
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa kỹ sư ${name} khỏi dự án này?`)) return;

    try {
      await projectService.removeMember(projectId, userId);
      setSuccess(`Đã xóa kỹ sư ${name} khỏi dự án.`);
      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa thành viên.');
    }
  };

  const handleToggleLeader = async (userId: string, name: string) => {
    try {
      const updatedList = await projectService.toggleLeader(projectId, userId);
      setMembers(updatedList);
      
      const target = updatedList.find(m => m.userId === userId);
      setSuccess(`Đã ${target?.isLeader ? 'gán' : 'hủy'} vai trò Project Leader cho ${name}.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật vai trò trưởng nhóm.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '150px', gap: '8px' }}>
        <Loader2 className="animate-spin" size={20} style={{ color: 'hsl(var(--primary))' }} />
        <span>Đang tải danh sách thành viên...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Notifications */}
      {success && (
        <div className="animate-fade-in" style={{
          padding: '10px 14px',
          backgroundColor: 'hsl(var(--success-glow))',
          border: '1px solid hsl(var(--success) / 0.2)',
          borderRadius: 'var(--radius-sm)',
          color: 'hsl(142 70% 30%)',
          fontSize: '0.85rem'
        }}>
          {success}
        </div>
      )}

      {error && (
        <div className="animate-fade-in" style={{
          padding: '10px 14px',
          backgroundColor: 'hsl(var(--danger-glow))',
          border: '1px solid hsl(var(--danger) / 0.2)',
          borderRadius: 'var(--radius-sm)',
          color: 'hsl(346 84% 35%)',
          fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      {/* Header and Add Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Kỹ sư & Chỉ huy công trường</h3>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
            Danh sách nhân sự tham gia thi công và giám sát dự án
          </p>
        </div>
        {isTPKT && (
          <button onClick={openAddModal} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
            <UserPlus size={16} />
            <span>Thêm kỹ sư</span>
          </button>
        )}
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {members.map((m) => (
          <div 
            key={m.userId} 
            className="card" 
            style={{ 
              padding: '20px', 
              position: 'relative', 
              border: m.isLeader ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid hsl(var(--border))',
              backgroundColor: m.isLeader ? 'hsl(var(--primary-glow) / 0.1)' : 'hsl(var(--bg-card))',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: m.isLeader ? 'var(--shadow-sm), 0 0 10px hsl(var(--primary-glow))' : 'var(--shadow-sm)'
            }}
          >
            {/* Crown tag */}
            {m.isLeader && (
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '16px',
                backgroundColor: 'gold',
                color: 'hsl(224 71% 4%)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.7rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <Crown size={12} fill="gold" />
                <span>CHỦ HUY TRƯỞNG</span>
              </div>
            )}

            {/* Profile info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: m.isLeader ? 'hsl(var(--primary-glow))' : 'hsl(var(--border))',
                color: m.isLeader ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '1rem'
              }}>
                {m.userName.charAt(0)}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.userName}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.userEmail}
                </p>
              </div>
            </div>

            {/* Actions for TPKT */}
            {isTPKT && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderTop: '1px solid hsl(var(--border) / 0.5)',
                paddingTop: '12px',
                marginTop: '4px'
              }}>
                {/* Crown Assign Checkbox/Button */}
                <button
                  onClick={() => handleToggleLeader(m.userId, m.userName)}
                  className={`btn ${m.isLeader ? 'btn-secondary' : 'btn-secondary'}`}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '0.75rem',
                    color: m.isLeader ? 'hsl(var(--text-secondary))' : 'goldenrod',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title={m.isLeader ? 'Bỏ vai trò Project Leader' : 'Gán làm Project Leader'}
                >
                  <Crown size={14} fill={m.isLeader ? 'none' : 'currentColor'} />
                  <span>{m.isLeader ? 'Hủy Lead' : 'Gán Lead'}</span>
                </button>

                {/* Remove member button */}
                <button
                  onClick={() => handleRemoveMember(m.userId, m.userName)}
                  className="btn btn-secondary"
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '0.75rem', 
                    color: 'hsl(var(--danger))',
                    borderColor: 'hsl(var(--danger) / 0.2)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <UserX size={14} />
                  <span>Xóa</span>
                </button>
              </div>
            )}
            
            {/* Informational Read-only icons for other users */}
            {!isTPKT && (
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <UserCheck size={14} />
                <span>Kỹ sư thi công dự án</span>
              </div>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border))', borderRadius: 'var(--radius-md)' }}>
            Chưa có thành viên nào được gán vào dự án.
          </div>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Thêm Kỹ sư vào Dự án">
        <form onSubmit={handleAddMember} className="flex flex-col gap-3 sm:gap-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-medium text-sm sm:text-base">Chọn Kỹ sư từ Hệ thống</label>
              {selectedUserIds.length > 0 && (
                <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--primary))]">
                  Đã chọn {selectedUserIds.length}
                </span>
              )}
            </div>
            <input 
              type="text" 
              placeholder="Tìm kiếm tên hoặc email..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input w-full mb-2 p-2 sm:p-2.5 text-sm sm:text-base rounded-[var(--radius-sm)] border border-[hsl(var(--border))]"
            />
            <div className="max-h-[45vh] sm:max-h-[300px] overflow-y-auto border border-[hsl(var(--border))] rounded-[var(--radius-sm)] bg-[hsl(var(--bg-card))]">
            {availableEngineers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
              availableEngineers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).map((eng) => (
                <label 
                  key={eng.id} 
                  className="flex items-center gap-3 p-3 border-b border-[hsl(var(--border)/0.5)] cursor-pointer transition-colors hover:bg-[hsl(var(--primary-glow)/0.05)]"
                  style={{ backgroundColor: selectedUserIds.includes(eng.id) ? 'hsl(var(--primary-glow) / 0.1)' : 'transparent' }}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedUserIds.includes(eng.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds([...selectedUserIds, eng.id]);
                      } else {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== eng.id));
                      }
                    }}
                    className="w-4 h-4 sm:w-[18px] sm:h-[18px] cursor-pointer accent-[hsl(var(--primary))]"
                  />
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--border))] text-[hsl(var(--text-secondary))] flex items-center justify-center font-semibold text-xs sm:text-sm shrink-0">
                      {eng.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-semibold text-sm sm:text-[0.9rem] truncate" style={{ color: selectedUserIds.includes(eng.id) ? 'hsl(var(--primary))' : 'inherit' }}>{eng.name}</div>
                      <div className="text-xs sm:text-[0.75rem] text-[hsl(var(--text-muted))] truncate">{eng.email}</div>
                    </div>
                  </div>
                </label>
              ))
            ) : (
              <div style={{ padding: '20px', color: 'hsl(var(--text-muted))', fontSize: '0.85rem', textAlign: 'center' }}>
                Không tìm thấy kỹ sư nào phù hợp.
              </div>
            )}
            </div>
          </div>

          <div className="flex justify-end gap-2 sm:gap-3 mt-1 sm:mt-2">
            <button type="button" className="btn btn-secondary px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base flex-1 sm:flex-none" onClick={() => setIsAddOpen(false)}>Hủy</button>
            <button 
              type="submit" 
              className="btn btn-primary px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base flex-[2] sm:flex-none"
              disabled={selectedUserIds.length === 0}
            >
              <UserPlus size={16} className="mr-1.5 sm:mr-2" />
              Gán ({selectedUserIds.length})
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
