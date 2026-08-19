import React, { useEffect, useState } from 'react';
import { projectService } from '../services/projectService';
import type { ProjectMember } from '../types/common';
import type { UserProfile } from '../services/authService';
import { Modal } from './ui/Modal';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { Crown, UserPlus, UserX, UserCheck, Phone, Search } from 'lucide-react';
import { useSignalREvent } from '../hooks/useSignalREvent';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { RoleGroup } from '../auth/roles';

interface AvailableEngineer extends UserProfile {
  leaderProjectNames?: string[];
}

interface ProjectMembersProps {
  projectId: string;
}

export const ProjectMembers: React.FC<ProjectMembersProps> = ({ projectId }) => {
  const { user, hasAnyRole } = useAuth();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [availableEngineers, setAvailableEngineers] = useState<AvailableEngineer[]>([]);
  const [projectStatus, setProjectStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{ id: string, name: string } | null>(null);
  const loadRequestIdRef = React.useRef(0);

  const isTechManagerOrAdmin = hasAnyRole(RoleGroup.Technical) || hasAnyRole(RoleGroup.AdminOnly);
  const isCurrentProjectLeader = members.some(m => m.userId === user?.id && m.isLeader);

  const isProjectCompleted = ['completed', 'closed', 'done', 'paused'].includes((projectStatus || '').toLowerCase());

  // TPKT/Admin hoặc Trưởng dự án (Project Leader) của dự án chưa hoàn thành/chưa tạm dừng đều có quyền thêm/xóa thành viên kỹ sư.
  const canManageMembers = (isTechManagerOrAdmin || isCurrentProjectLeader) && !isProjectCompleted;
  // Chỉ TPKT/Admin mới được chỉ định hoặc thay đổi Trưởng nhóm trong dự án chưa hoàn thành/chưa tạm dừng
  const canToggleLeader = isTechManagerOrAdmin && !isProjectCompleted;
  const hasLeader = members.some(m => m.isLeader);

  const loadData = async (bustCache = false, silent = false) => {
    const requestId = ++loadRequestIdRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const projMembers = await projectService.getMembers(projectId, bustCache);
      if (requestId !== loadRequestIdRef.current) return;
      setMembers(projMembers);

      // Lấy tất cả dự án và thành viên để tìm thông tin dự án hiện tại và thông tin trưởng nhóm của các dự án đang làm
      const allProjects = await projectService.getProjects();
      if (requestId !== loadRequestIdRef.current) return;

      const currentProj = allProjects.find(p => p.id === projectId || p.id === `p-${projectId}` || p.id === projectId.replace('p-', ''));
      if (currentProj) {
        setProjectStatus(currentProj.status || '');
      }

      const isLeader = projMembers.some(m => m.userId === user?.id && m.isLeader);
      const canManage = isTechManagerOrAdmin || isLeader;

      if (canManage) {
        const engineers = await projectService.getAvailableMembers(projectId);

        const allMembersPromises = allProjects.map(p => projectService.getMembers(p.id));
        const allMembersArrays = await Promise.all(allMembersPromises);
        if (requestId !== loadRequestIdRef.current) return;

        const leaderMap = new Map<string, string[]>();
        allMembersArrays.forEach((mems, index) => {
          const project = allProjects[index];
          const statusLower = (project.status || '').toLowerCase();
          // Nếu dự án đã hoàn thành thì không còn tính người đó là trưởng dự án nữa
          if (statusLower === 'completed' || statusLower === 'closed' || statusLower === 'done') {
            return;
          }
          mems.forEach(m => {
            if (m.isLeader) {
              const currentProjects = leaderMap.get(m.userId) || [];
              leaderMap.set(m.userId, [...currentProjects, project.name]);
            }
          });
        });

        const engineersWithLeaderInfo: AvailableEngineer[] = engineers.map(e => ({
          ...e,
          leaderProjectNames: leaderMap.get(e.id) || []
        }));

        setAvailableEngineers(engineersWithLeaderInfo);
        setSelectedUserIds(current =>
          current.filter(id => engineersWithLeaderInfo.some(engineer => engineer.id === id)),
        );
      }
    } catch (err: any) {
      if (requestId !== loadRequestIdRef.current) return;
      if (silent) console.error(err);
      else setError(err.message || 'Không thể tải thành viên dự án.');
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, isTechManagerOrAdmin]);

  useEffect(() => () => {
    loadRequestIdRef.current += 1;
  }, [projectId, isTechManagerOrAdmin]);

  useSignalREvent('ProjectLeaderUpdated', () => {
    loadData(true, true);
  });

  useSignalREvent('ProjectMemberAdded', () => {
    loadData(true, true);
  });

  const openAddModal = () => {
    setSelectedUserIds([]);
    setSearchQuery('');
    setIsAddOpen(true);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) return;

    try {
      const results = await Promise.all(selectedUserIds.map(id => {
        const targetUser = availableEngineers.find(user => user.id === id);
        if (!targetUser)
          throw new Error('Kỹ sư đã chọn không còn khả dụng để thêm vào dự án.');

        return projectService.addMember(projectId, {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role
        });
      }));

      console.log(selectedUserIds.length === 1 && results[0]?.__message ? results[0].__message : `Đã thêm ${selectedUserIds.length} kỹ sư vào dự án.`);
      setIsAddOpen(false);
      void loadData(true, true);
    } catch (err: any) {
      toast.error(err.message || 'Không thể thêm thành viên vào dự án.');
    }
  };

  const handleRemoveMember = (userId: string, name: string) => {
    setMemberToDelete({ id: userId, name });
    setDeleteConfirmOpen(true);
  };

  const confirmRemoveMember = async () => {
    if (!memberToDelete) return;

    try {
      const message = await projectService.removeMember(projectId, memberToDelete.id);
      console.log(message || `Đã xóa kỹ sư ${memberToDelete.name} khỏi dự án.`);
      void loadData(true, true);
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa thành viên khỏi dự án.');
    } finally {
      setDeleteConfirmOpen(false);
      setMemberToDelete(null);
    }
  };

  const handleToggleLeader = async (userId: string, name: string) => {
    try {
      const updatedList = await projectService.toggleLeader(projectId, userId);
      setMembers(updatedList);

      const target = updatedList.find(m => m.userId === userId);
      console.log(updatedList.__message || `Đã ${target?.isLeader ? 'gán' : 'hủy'} vai trò Trưởng nhóm cho ${name}.`);
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật vai trò trưởng nhóm.');
    }
  };

  // Danh sách kỹ sư khả dụng hiển thị trong Modal Thêm kỹ sư vào Dự án:
  // - TPKT/Admin: Hiển thị tất cả kỹ sư, đồng thời gán mác "Trưởng nhóm - [Tên dự án]" cho người đang làm PL ở dự án chưa hoàn thành.
  // - Trưởng dự án (PL): Chỉ hiển thị những kỹ sư KHÔNG phải là Trưởng nhóm của dự án chưa hoàn thành.
  const candidateEngineers = availableEngineers.filter(u => {
    if (!isTechManagerOrAdmin && u.leaderProjectNames && u.leaderProjectNames.length > 0) {
      return false;
    }
    const roleLower = (u.role || '').toLowerCase();
    if (roleLower === 'technicalmanager' || roleLower === 'admin' || roleLower === 'director') return false;
    return true;
  });

  const searchedEngineers = candidateEngineers.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner size="md" label="Đang tải danh sách thành viên..." className="py-12" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

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
        {canManageMembers && (
          <button onClick={openAddModal} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
            <UserPlus size={16} />
            <span>Thêm kỹ sư</span>
          </button>
        )}
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {members.map((m) => {
          return (
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
                  <span>TRƯỞNG NHÓM</span>
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
                  {m.userPhone && (
                    <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Phone size={10} />
                      {m.userPhone}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions for TPKT & Project Leader */}
              {canManageMembers && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '6px',
                  borderTop: '1px solid hsl(var(--border) / 0.5)',
                  paddingTop: '12px',
                  marginTop: '4px'
                }}>
                  {/* Crown Assign Checkbox/Button: TPKT/Admin only */}
                  {canToggleLeader && (!hasLeader || m.isLeader) ? (
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
                      title={m.isLeader ? 'Bỏ vai trò Trưởng nhóm' : 'Gán làm Trưởng nhóm'}
                    >
                      <Crown size={14} fill={m.isLeader ? 'none' : 'currentColor'} />
                      <span>{m.isLeader ? 'Hủy trưởng nhóm' : 'Gán trưởng nhóm'}</span>
                    </button>
                  ) : null}

                  {/* Remove member button: TPKT/Admin or Leader (on non-leader engineers) */}
                  {(canToggleLeader || !m.isLeader) && (
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
                  )}
                </div>
              )}

              {/* Informational Read-only icons for other users */}
              {!canManageMembers && (
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <UserCheck size={14} />
                  <span>Kỹ sư thi công dự án</span>
                </div>
              )}
            </div>
          );
        })}

        {members.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border))', borderRadius: 'var(--radius-md)' }}>
            Chưa có thành viên nào được gán vào dự án.
          </div>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Thêm Kỹ sư vào Dự án" width="md">
        <form onSubmit={handleAddMember} className="flex flex-col gap-3 sm:gap-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-medium text-sm sm:text-base text-slate-800 dark:text-slate-200">Chọn Kỹ sư từ Hệ thống</label>
              {selectedUserIds.length > 0 && (
                <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary-glow)/0.15)] px-2 py-0.5 rounded-full">
                  Đã chọn {selectedUserIds.length}
                </span>
              )}
            </div>

            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Tìm kiếm tên hoặc email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input w-full pl-9 pr-3 py-2 text-sm sm:text-base rounded-[var(--radius-sm)] border border-[hsl(var(--border))]"
                autoFocus
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Fixed height container to prevent modal resizing when filtering/typing */}
            <div className="h-[330px] min-h-[330px] max-h-[330px] overflow-y-auto custom-scrollbar border border-[hsl(var(--border))] rounded-[var(--radius-sm)] bg-[hsl(var(--bg-card))] flex flex-col divide-y divide-[hsl(var(--border)/0.4)]">
              {searchedEngineers.length > 0 ? (
                searchedEngineers.map((eng) => (
                  <label
                    key={eng.id}
                    className="flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-[hsl(var(--primary-glow)/0.05)] shrink-0"
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
                    {eng.leaderProjectNames && eng.leaderProjectNames.length > 0 && (() => {
                      const count = eng.leaderProjectNames.length;
                      const tooltipText = count === 1
                        ? `Đang là Trưởng dự án tại: ${eng.leaderProjectNames[0]}`
                        : `Đang là Trưởng dự án tại ${count} dự án:\n${eng.leaderProjectNames.map(name => `• ${name}`).join('\n')}`;

                      return (
                        <div
                          className="flex items-center gap-1.5 shrink-0 ml-2 max-w-[170px] sm:max-w-[210px] px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition-all cursor-help"
                          title={tooltipText}
                        >
                          <Crown size={12} className="shrink-0 text-amber-500 fill-amber-500" />
                          {count === 1 ? (
                            <span className="truncate">
                              TDA: {eng.leaderProjectNames[0]}
                            </span>
                          ) : (
                            <span className="font-bold whitespace-nowrap">
                              Trưởng Dự Án ({count} )
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </label>
                ))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <Search size={32} className="mb-2 opacity-30 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Không tìm thấy kỹ sư nào phù hợp</p>
                  <p className="text-xs text-slate-400 mt-1">Hãy thử tìm kiếm với tên hoặc email khác.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 sm:gap-3 mt-1 sm:mt-2 pt-2 border-t border-[hsl(var(--border)/0.5)]">
            <button type="button" className="btn btn-secondary px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base flex-1 sm:flex-none" onClick={() => setIsAddOpen(false)}>Hủy</button>
            <button
              type="submit"
              className="btn btn-primary px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base flex-[2] sm:flex-none"
              disabled={selectedUserIds.length === 0}
            >
              <UserPlus size={16} className="mr-1.5 sm:mr-2" />
              Thêm ({selectedUserIds.length})
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Xác nhận xóa thành viên">
        <div className="flex flex-col gap-4">
          <p>Bạn có chắc chắn muốn xóa kỹ sư <strong>{memberToDelete?.name}</strong> khỏi dự án này?</p>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" className="btn btn-secondary px-4 py-2" onClick={() => setDeleteConfirmOpen(false)}>Hủy</button>
            <button type="button" className="btn btn-primary px-4 py-2" style={{ backgroundColor: 'hsl(var(--danger))', borderColor: 'hsl(var(--danger))', color: 'white' }} onClick={confirmRemoveMember}>Xóa</button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
