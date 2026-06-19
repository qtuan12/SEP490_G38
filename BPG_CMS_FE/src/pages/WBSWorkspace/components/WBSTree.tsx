import { useWBS } from './WBSContext';
import { useNavigate } from 'react-router-dom';
import type { WBSTask } from '../../../types/common';
import { Folder, FileText, ChevronDown, ChevronRight, ChevronUp, CheckCircle, Trash2, AlertTriangle, FolderPlus, FilePlus2, Pencil, MoreVertical, Box, FileSignature, CornerDownRight, Info, History } from 'lucide-react';


const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getAvatarColor = (userId: string) => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  return colors[hash % colors.length];
};

export const WBSTree = () => {
  const handleReorderPhase = (_phaseId: string, _direction: 'up' | 'down') => {};
  const {
    phases, tasks, isTPKTOrPL, isPL, canEdit, materialRequests,
    expandedPhases, selectedTaskId, isCreatePhaseOpen, togglePhase, setExpandedPhases,
    hoveredPhaseId, setHoveredPhaseId, hoveredTaskId, setHoveredTaskId,
    phaseMenuId, setPhaseMenuId, taskMenuId, setTaskMenuId,
    setIsCreatePhaseOpen, setSelectedPhaseForEdit, setIsEditPhaseOpen,
    setSelectedPhaseForTask, setParentTaskForNew, setParentDeadlineForNew, setIsCreateTaskOpen,
    setSelectedTaskForEdit, setIsEditTaskOpen,
    setSelectedPhaseForMatReq, setCreateMatReqType, setIsPhaseMatReqOpen, setIsLeaderApprovalOpen,
    setSelectedPhaseForBOQ, setIsBOQOpen, setSelectedResubmitRequest, setIsResubmitOpen,
    setSelectedTaskId, setIsDetailOpen, setIsObsoleteOpen,
    handleCancelMatReq,
    isPhaseReadyForAcceptance, loading, handleReorderTask, handleDeleteTask, handleDeletePhase
  } = useWBS();
  
  const navigate = useNavigate();

  const menuItemStyle = {
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.82rem',
    cursor: 'pointer',
    color: 'hsl(var(--text-primary))',
    transition: 'background 0.15s ease',
  };

  return (
    <>
      {/* ─── Left: WBS Tree ─────────────────────────────── */}
      <div className="card" style={{ padding: '20px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
            Sơ đồ hình cây Giai đoạn → Công việc
          </h4>

          {loading ? (
            <div style={{ textAlign: 'center', margin: 'auto', color: 'hsl(var(--text-muted))' }}>Đang tải...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>

              {phases.length === 0 && !isCreatePhaseOpen && (
                <div style={{ textAlign: 'center', margin: 'auto', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
                  Chưa có dữ liệu WBS. Nhấn "+ Thêm Giai đoạn" để bắt đầu.
                </div>
              )}

              {/* ═══ PHASE ROWS ═════════════════════════════════ */}
              {phases.map((ph, phaseIndex) => {
                const topLevelTasks = tasks
                  .filter(t => t.phaseId === ph.id && !t.parentTaskId)
                  .map((t, i) => ({ ...t, sortOrder: t.sortOrder ?? (i + 1) }))
                  .sort((a, b) => a.sortOrder - b.sortOrder);

                const validTopLevelTasks = topLevelTasks.filter(t => t.status !== 'obsolete');
                const phaseProgress = validTopLevelTasks.length > 0
                  ? Math.round(validTopLevelTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / validTopLevelTasks.length)
                  : 0;

                const allPhaseTasks = tasks.filter(t => t.phaseId === ph.id);
                const phaseTasks: WBSTask[] = [];
                topLevelTasks.forEach(parent => {
                  phaseTasks.push(parent);
                  const children = allPhaseTasks
                    .filter(t => t.parentTaskId === parent.id)
                    .map((t, i) => ({ ...t, sortOrder: t.sortOrder ?? (i + 1) }))
                    .sort((a, b) => a.sortOrder - b.sortOrder);
                  phaseTasks.push(...children);
                });
                const isExpanded = expandedPhases[ph.id];
                const isFrozen = ph.status === 'frozen';
                const readyForAcceptance = isPhaseReadyForAcceptance(ph.id) && !isFrozen;
                const isHovered = hoveredPhaseId === ph.id;
                const showMenu = phaseMenuId === ph.id;
                const isFirstPhase = phaseIndex === 0;
                const isLastPhase = phaseIndex === phases.length - 1;

                return (
                  <div key={ph.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>

                    {/* Phase row */}
                    <div
                      onClick={() => togglePhase(ph.id)}
                      onMouseEnter={() => setHoveredPhaseId(ph.id)}
                      onMouseLeave={() => setHoveredPhaseId(null)}
                      style={{
                        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px',
                        padding: '7px 8px',
                        backgroundColor: isFrozen ? 'hsl(var(--success-glow) / 0.08)' : isHovered ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-main) / 0.5)',
                        borderRadius: 'var(--radius-sm)',
                        border: isFrozen ? '1px solid hsl(var(--success) / 0.2)' : isHovered ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid hsl(var(--border))',
                        fontWeight: 600, fontSize: '0.9rem',
                        transition: 'all 0.13s ease',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Order number + ▲▼ buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '18px' }}>
                        {canEdit && (isHovered || isFirstPhase && isLastPhase) ? (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); handleReorderPhase(ph.id, 'up'); }}
                              disabled={isFirstPhase}
                              title="Di chuyển lên"
                              style={{ background: 'none', border: 'none', cursor: isFirstPhase ? 'not-allowed' : 'pointer', padding: 0, color: isFirstPhase ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                            >
                              <ChevronUp size={11} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleReorderPhase(ph.id, 'down'); }}
                              disabled={isLastPhase}
                              title="Di chuyển xuống"
                              style={{ background: 'none', border: 'none', cursor: isLastPhase ? 'not-allowed' : 'pointer', padding: 0, color: isLastPhase ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                            >
                              <ChevronDown size={11} />
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(var(--text-muted))', lineHeight: 1.2, textAlign: 'center' }}>
                            {phaseIndex + 1}
                          </span>
                        )}
                      </div>

                      {/* Collapse toggle */}
                      <button onClick={(e) => { e.stopPropagation(); togglePhase(ph.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'hsl(var(--text-secondary))', flexShrink: 0 }}>
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>

                      <Folder size={15} style={{ color: isFrozen ? 'hsl(var(--success))' : 'hsl(var(--primary))', flexShrink: 0 }} />

                      {/* Name */}
                      <div
                        style={{ flex: 1, minWidth: '100px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                        title={canEdit && !isFrozen && phaseProgress === 0 ? "Double-click để chỉnh sửa" : ""}
                        onDoubleClick={(e) => { e.stopPropagation(); if (canEdit && !isFrozen && phaseProgress === 0) { setSelectedPhaseForEdit(ph); setIsEditPhaseOpen(true); setPhaseMenuId(null); } }}
                      >
                        <span style={{ textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap', color: isFrozen ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))', textDecoration: isFrozen ? 'line-through' : 'none' }}>
                          {ph.name}
                        </span>
                      </div>

                        {ph.startDate && ph.endDate && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'hsl(var(--text-muted))',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              border: '1px solid hsl(var(--border))',
                              padding: '1px 5px',
                              borderRadius: 'var(--radius-sm)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            📅 {ph.startDate.split('-').reverse().join('-')} → {ph.endDate.split('-').reverse().join('-')}
                          </span>
                        )}

                        {ph.materials && ph.materials.length > 0 && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'hsl(var(--primary))',
                              backgroundColor: 'hsl(var(--primary-glow))',
                              padding: '1px 5px',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 'normal',
                              cursor: 'help',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid hsl(var(--primary) / 0.15)',
                              whiteSpace: 'nowrap'
                            }}
                            title={ph.materials.map(m => `${m.name}: ${m.quantity} ${m.unit}`).join(', ')}
                          >
                            📦 {ph.materials.length} vật tư
                          </span>
                        )}

                        {materialRequests.filter(r => r.phaseId === ph.id && !r.taskId).map(r => (
                          <span
                            key={r.id}
                            className={`badge badge-${r.status === 'approved' || r.status === 'disbursed' || r.status === 'received' ? 'success' :
                              r.status === 'rejected' ? 'danger' : 'warning'
                              }`}
                            style={{ fontSize: '0.62rem', padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0, whiteSpace: 'nowrap' }}
                          >
                            Yêu cầu vật tư: {
                              r.status === 'pending_leader' ? 'Chờ Leader' :
                                r.status === 'pending_tpkt' ? 'Chờ TPKT' :
                                  r.status === 'pending_accountant' ? 'Chờ KT' :
                                    r.status === 'pending_director' ? 'Chờ GĐ duyệt' :
                                      r.status === 'pending_disbursement' ? 'Chờ giải ngân' :
                                        r.status === 'disbursed' ? 'Đã giải ngân' :
                                          r.status === 'approved' ? 'Đã duyệt' :
                                            r.status === 'received' ? 'Đã nhận' : 'Bị từ chối'
                            }
                            {r.status === 'rejected' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedResubmitRequest(r);
                                  setIsResubmitOpen(true);
                                }}
                                style={{
                                  marginLeft: '4px',
                                  background: 'hsl(var(--primary))',
                                  border: 'none',
                                  borderRadius: 'var(--radius-sm)',
                                  color: '#fff',
                                  padding: '0px 4px',
                                  cursor: 'pointer',
                                  fontSize: '0.55rem',
                                  fontWeight: 'bold',
                                  lineHeight: 1.2
                                }}
                                title="Sửa & Gửi lại"
                              >
                                Sửa & Gửi lại
                              </button>
                            )}
                            {r.status === 'pending_accountant' && isPL && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelMatReq(r.id);
                                }}
                                style={{
                                  marginLeft: '4px',
                                  background: 'hsl(var(--danger))',
                                  border: 'none',
                                  borderRadius: 'var(--radius-sm)',
                                  color: '#fff',
                                  padding: '0px 4px',
                                  cursor: 'pointer',
                                  fontSize: '0.55rem',
                                  fontWeight: 'bold',
                                  lineHeight: 1.2
                                }}
                                title="Hủy phiếu"
                              >
                                Hủy phiếu
                              </button>
                            )}
                            {r.status === 'pending_accountant' && isPL && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelMatReq(r.id);
                                }}
                                style={{
                                  marginLeft: '4px',
                                  background: 'hsl(var(--danger))',
                                  border: 'none',
                                  borderRadius: 'var(--radius-sm)',
                                  color: '#fff',
                                  padding: '0px 4px',
                                  cursor: 'pointer',
                                  fontSize: '0.55rem',
                                  fontWeight: 'bold',
                                  lineHeight: 1.2
                                }}
                                title="Hủy phiếu"
                              >
                                Hủy phiếu
                              </button>
                            )}
                          </span>
                        ))}

                      {/* Badge */}
                      {isFrozen ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '1px 5px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); navigate(`/projects/${ph.projectId}/phases/${ph.id}/acceptance`); }}>Đã nghiệm thu</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--success))', minWidth: '28px', textAlign: 'right' }}>100%</span>
                            <div style={{ width: '50px', height: '6px', backgroundColor: 'hsl(var(--border))', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: '100%', height: '100%', backgroundColor: 'hsl(var(--success))' }} />
                            </div>
                          </div>
                        </div>
                      ) : readyForAcceptance ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span className="badge badge-warning animate-fade-in" style={{ fontSize: '0.6rem', padding: '1px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                            onClick={(e) => { e.stopPropagation(); if (isTPKTOrPL) navigate(`/projects/${ph.projectId}/phases/${ph.id}/acceptance`); }}>
                            <FileSignature size={9} /><span>Chờ nghiệm thu</span>
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--warning-text))', minWidth: '28px', textAlign: 'right' }}>{phaseProgress}%</span>
                            <div style={{ width: '50px', height: '6px', backgroundColor: 'hsl(var(--border))', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${phaseProgress}%`, height: '100%', backgroundColor: 'hsl(var(--warning-text))', transition: 'width 0.3s ease' }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>{phaseTasks.length} việc</span>
                          {phaseTasks.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: phaseProgress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-secondary))', minWidth: '28px', textAlign: 'right' }}>
                                {phaseProgress}%
                              </span>
                              <div style={{ width: '50px', height: '6px', backgroundColor: 'hsl(var(--border))', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${phaseProgress}%`, height: '100%', backgroundColor: phaseProgress === 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))', transition: 'width 0.3s ease' }} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons (hover) */}
                      {canEdit && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', opacity: isHovered || showMenu ? 1 : 0, transition: 'opacity 0.13s', flexShrink: 0 }}>
                          {/* + Task */}
                          {!isFrozen && (
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedPhases(prev => ({ ...prev, [ph.id]: true })); setSelectedPhaseForTask(ph.id); setParentTaskForNew(undefined); setParentDeadlineForNew(ph.deadline); setIsCreateTaskOpen(true); }}
                              title="Thêm Task"
                              style={{ background: 'hsl(var(--primary))', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0 }}
                            >
                              <FilePlus2 size={11} />
                            </button>
                          )}

                          {/* ⋮ menu */}
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={e => { e.stopPropagation(); setPhaseMenuId(showMenu ? null : ph.id); setTaskMenuId(null); }}
                              title="Tùy chọn"
                              style={{ background: 'transparent', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0 }}
                            >
                              <MoreVertical size={11} />
                            </button>

                            {showMenu && (
                              <div onClick={e => e.stopPropagation()} className="absolute top-[24px] z-[200] bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-md shadow-lg min-w-[160px] overflow-hidden left-0 sm:left-auto sm:right-0 py-1">
                                {!isFrozen && phaseProgress === 0 && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setSelectedPhaseForEdit(ph); setIsEditPhaseOpen(true); setPhaseMenuId(null); }}
                                  >
                                    <Pencil size={13} style={{ color: 'hsl(var(--primary))' }} />
                                    <span>Chỉnh sửa Giai đoạn</span>
                                  </div>
                                )}
                                {!isFrozen && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setPhaseMenuId(null); navigate(`/projects/${ph.projectId}/phases/${ph.id}/material-requests`); }}
                                  >
                                    <FileText size={13} style={{ color: 'hsl(var(--primary))' }} />
                                    <span>Yêu cầu vật tư Giai đoạn</span>
                                  </div>
                                )}
                                {!isFrozen && isPL && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--warning-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setPhaseMenuId(null); setSelectedPhaseForMatReq(ph); setCreateMatReqType('emergency'); setIsPhaseMatReqOpen(true); }}
                                  >
                                    <AlertTriangle size={13} style={{ color: 'hsl(var(--warning))' }} />
                                    <span style={{ color: 'hsl(var(--warning-hover))' }}>Mua ngoài khẩn cấp Giai đoạn</span>
                                  </div>
                                )}
                                {!isFrozen && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setPhaseMenuId(null); setSelectedPhaseForBOQ(ph); setIsBOQOpen(true); }}
                                  >
                                    <Box size={13} style={{ color: 'hsl(var(--primary))' }} />
                                    <span>Cập nhật bảng BOQ</span>
                                  </div>
                                )}

                                {!isFrozen && materialRequests.some(r => r.phaseId === ph.id && r.status === 'pending_leader') && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => {
                                      setPhaseMenuId(null);
                                      // Mở modal duyệt đề xuất (Ta sẽ định nghĩa sau)
                                      setSelectedPhaseForMatReq(ph);
                                      setIsLeaderApprovalOpen(true);
                                    }}
                                  >
                                    <CheckCircle size={13} style={{ color: 'hsl(var(--warning))' }} />
                                    <span>Duyệt Yêu cầu từ SE</span>
                                  </div>
                                )}

                                <div
                                  style={menuItemStyle}
                                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                  onClick={() => { setPhaseMenuId(null); navigate(`/phase-acceptances?projectId=${ph.projectId}&phaseId=${ph.id}`); }}
                                >
                                  <CheckCircle size={13} style={{ color: 'hsl(var(--primary))' }} />
                                  <span>Danh sách Nghiệm thu</span>
                                </div>


                                {!isFrozen && (
                                  <div
                                    style={{ ...menuItemStyle, color: 'hsl(var(--danger))' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--danger-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setPhaseMenuId(null); handleDeletePhase(ph.id, ph.name); }}
                                  >
                                    <Trash2 size={13} />
                                    <span>Xóa Giai đoạn</span>
                                  </div>
                                )}
                                {isFrozen && (
                                  <div style={{ ...menuItemStyle, cursor: 'default', opacity: 0.5, fontSize: '0.78rem' }}>
                                    Giai đoạn đã nghiệm thu (khóa)
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Task children */}
                    {isExpanded && (
                      <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px dashed hsl(var(--border-light))', marginLeft: '18px', marginTop: '2px' }}>
                        {ph.description && (
                          <div style={{
                            padding: '8px 12px',
                            margin: '4px 0 8px 0',
                            backgroundColor: 'hsl(var(--bg-main) / 0.5)',
                            border: '1px solid hsl(var(--border-light))',
                            borderLeft: '3px solid hsl(var(--primary) / 0.6)',
                            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                            color: 'hsl(var(--text-secondary))',
                            fontSize: '0.82rem',
                            lineHeight: 1.5,
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-start'
                          }}>
                            <Info size={14} style={{ color: 'hsl(var(--primary))', marginTop: '2px', flexShrink: 0 }} />
                            <div style={{ flex: 1, whiteSpace: 'pre-wrap' }}>
                              {ph.description}
                            </div>
                          </div>
                        )}
                        {phaseTasks.map((t, taskIndex) => {
                          const isSelected = selectedTaskId === t.id;
                          const isHoveredTask = hoveredTaskId === t.id;

                          const showTaskMenu = taskMenuId === t.id;
                          // Task is locked for rename/delete once it has been worked on
                          const isWorkedOn = t.progress > 0 || t.history.length > 0;
                          const isFirstTask = taskIndex === 0;
                          const isLastTask = taskIndex === phaseTasks.length - 1;

                          return (
                            <div
                              key={t.id}
                              onMouseEnter={() => setHoveredTaskId(t.id)}
                              onMouseLeave={() => setHoveredTaskId(null)}
                              style={{
                                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '7px',
                                padding: '6px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: isSelected ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid transparent',
                                backgroundColor: isSelected ? 'hsl(var(--primary-glow))' : isHoveredTask ? 'hsl(var(--bg-main) / 0.6)' : 'transparent',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                transition: 'all var(--transition-fast)',
                                opacity: t.status === 'obsolete' ? 0.6 : 1,
                                position: 'relative',
                                marginLeft: t.parentTaskId ? '28px' : '0px',
                              }}
                              onClick={() => {
                                setSelectedTaskId(t.id);
                                setIsDetailOpen(true);
                              }}
                            >
                              {/* Task order number + ▲▼ */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '16px' }} onClick={e => e.stopPropagation()}>
                                {canEdit && !isFrozen && t.status !== 'obsolete' && isHoveredTask && !t.parentTaskId ? (
                                  <>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleReorderTask(ph.id, t.id, 'up'); }}
                                      disabled={isFirstTask}
                                      title="Di chuyển lên"
                                      style={{ background: 'none', border: 'none', cursor: isFirstTask ? 'not-allowed' : 'pointer', padding: 0, color: isFirstTask ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                                    >
                                      <ChevronUp size={10} />
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleReorderTask(ph.id, t.id, 'down'); }}
                                      disabled={isLastTask}
                                      title="Di chuyển xuống"
                                      style={{ background: 'none', border: 'none', cursor: isLastTask ? 'not-allowed' : 'pointer', padding: 0, color: isLastTask ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                                    >
                                      <ChevronDown size={10} />
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'hsl(var(--text-muted))', opacity: 0.7 }}>
                                    {taskIndex + 1}
                                  </span>
                                )}
                              </div>

                              {t.parentTaskId ? (
                                <CornerDownRight size={12} style={{ color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))', flexShrink: 0 }} />
                              ) : (
                                <FileText size={13} style={{ color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))', flexShrink: 0 }} />
                              )}

                              {/* Name */}
                              <div
                                style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                                title={isWorkedOn && t.status !== 'obsolete' ? 'Task đã có tiến độ — không thể chỉnh sửa. Dùng "Hủy việc" và tạo lại.' : canEdit && !isFrozen && t.status !== 'obsolete' ? 'Double-click để chỉnh sửa' : ''}
                                onDoubleClick={e => { e.stopPropagation(); if (canEdit && !isFrozen && t.status !== 'obsolete' && !isWorkedOn) { setSelectedTaskForEdit(t); setIsEditTaskOpen(true); setTaskMenuId(null); } }}
                              >
                                <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', fontWeight: isSelected ? 600 : 500, color: t.status === 'obsolete' ? 'hsl(var(--text-muted))' : isSelected ? 'hsl(var(--primary-hover))' : 'hsl(var(--text-secondary))', textDecoration: (isFrozen || t.status === 'obsolete') ? 'line-through' : 'none', cursor: canEdit && !isFrozen && t.status !== 'obsolete' && !isWorkedOn ? 'pointer' : 'default' }}>
                                  {t.name}
                                </span>
                                {t.description && (
                                  <span style={{ 
                                    fontSize: '0.72rem', 
                                    color: 'hsl(var(--text-secondary))', 
                                    whiteSpace: 'normal', 
                                    marginTop: '4px', 
                                    lineHeight: 1.4,
                                    paddingLeft: '6px',
                                    borderLeft: '2px solid hsl(var(--border-light))',
                                    fontStyle: 'italic'
                                  }}>
                                    {t.description}
                                  </span>
                                )}
                              </div>

                              {t.status !== 'obsolete' && t.progress < 100 && (
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginLeft: '8px' }}>
                                  {t.isOverdue && (
                                    <span style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: 'hsl(var(--danger) / 0.15)', color: 'hsl(var(--danger))', borderRadius: '4px', border: '1px solid hsl(var(--danger) / 0.3)', whiteSpace: 'nowrap' }} title={`Đã trễ hạn!`}>🚨 Trễ hạn</span>
                                  )}
                                  {t.isAtRisk && (
                                    <span style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: 'hsl(var(--warning) / 0.15)', color: 'hsl(var(--warning))', borderRadius: '4px', border: '1px solid hsl(var(--warning) / 0.3)', whiteSpace: 'nowrap' }} title={`Tiến độ thực tế đang chậm hơn tiến độ kỳ vọng`}>⚠️ Nguy cơ</span>
                                  )}
                                  {t.daysLeft !== undefined && !t.isOverdue && (
                                    <span style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '4px', border: '1px solid hsl(var(--primary) / 0.2)', whiteSpace: 'nowrap' }} title={`Thời gian còn lại`}>⏳ Còn {t.daysLeft} ngày</span>
                                  )}
                                </div>
                              )}

                              {t.assignedTo && t.assignedName && (
                                <div style={{ display: 'flex', alignItems: 'center', marginRight: '8px', flexShrink: 0 }}>
                                  {t.assignedTo.split(',').map((id: string, index: number) => {
                                    const names = t.assignedName ? t.assignedName.split(', ') : [];
                                    const name = names[index] || 'Kỹ sư';
                                    const initials = getInitials(name);
                                    const bgColor = getAvatarColor(id);
                                    return (
                                      <div
                                        key={id}
                                        title={name}
                                        style={{
                                          width: '22px',
                                          height: '22px',
                                          borderRadius: '50%',
                                          backgroundColor: bgColor,
                                          color: '#fff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '0.65rem',
                                          fontWeight: 700,
                                          border: '2px solid hsl(var(--bg-card))',
                                          marginLeft: index > 0 ? '-6px' : '0',
                                          boxShadow: 'var(--shadow-sm)',
                                          cursor: 'help',
                                        }}
                                      >
                                        {initials}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {t.status === 'obsolete' && (
                                <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '1px 4px', flexShrink: 0 }}>Đã hủy</span>
                              )}



                              {/* Task context menu — only show ⋮ when task has NOT been worked on */}
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))', flexShrink: 0 }}>
                                {t.progress}%
                              </span>

                              {/* Task context menu */}
                              {canEdit && !isFrozen && t.status !== 'obsolete' && (
                                  <div style={{ position: 'relative', opacity: isHoveredTask || showTaskMenu ? 1 : 0, transition: 'opacity 0.13s', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={e => { e.stopPropagation(); setTaskMenuId(showTaskMenu ? null : t.id); setPhaseMenuId(null); }}
                                      title="Tùy chọn"
                                      style={{ background: 'transparent', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', padding: 0 }}
                                    >
                                      <MoreVertical size={10} />
                                    </button>

                                    {showTaskMenu && (
                                      <div onClick={e => e.stopPropagation()} className="absolute top-[22px] z-[200] bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-md shadow-lg min-w-[155px] overflow-hidden left-0 sm:left-auto sm:right-0 py-1">
                                        <div
                                          style={menuItemStyle}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { setSelectedTaskForEdit(t); setIsEditTaskOpen(true); setTaskMenuId(null); }}
                                        >
                                          <Pencil size={12} style={{ color: 'hsl(var(--primary))' }} /><span>Chỉnh sửa Công việc</span>
                                        </div>

                                        <div
                                          style={menuItemStyle}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--warning-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { setTaskMenuId(null); navigate(`/projects/${ph.projectId}/tasks/${t.id}/incidents`); }}
                                        >
                                          <AlertTriangle size={12} style={{ color: 'hsl(var(--warning))' }} /><span>Báo cáo sự cố</span>
                                        </div>

                                        <div
                                          style={menuItemStyle}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { setTaskMenuId(null); navigate(`/projects/${ph.projectId}/tasks/${t.id}/logs`); }}
                                        >
                                          <History size={12} style={{ color: 'hsl(var(--primary))' }} /><span>Xem nhật ký thi công</span>
                                        </div>

                                        <div
                                          style={{ ...menuItemStyle, display: t.parentTaskId ? 'none' : 'flex' }}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { setTaskMenuId(null); setSelectedPhaseForTask(ph.id); setParentTaskForNew(t.id); setParentDeadlineForNew(t.deadline); setIsCreateTaskOpen(true); }}
                                        >
                                          <FilePlus2 size={12} style={{ color: 'hsl(var(--primary))' }} /><span>Thêm Task con</span>
                                        </div>

                                        <div
                                          style={{ ...menuItemStyle, color: 'hsl(var(--danger))' }}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--danger-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { 
                                            setTaskMenuId(null); 
                                            if (t.progress > 0) {
                                              setSelectedTaskId(t.id);
                                              setIsObsoleteOpen(true);
                                            } else {
                                              handleDeleteTask(t.id, t.name);
                                            }
                                          }}
                                        >
                                          <Trash2 size={12} /><span>{t.progress > 0 ? 'Đánh dấu lỗi thời' : 'Xóa hẳn Task'}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                              )}
                            </div>
                          );
                        })}

                        {phaseTasks.length === 0 && (
                          <div style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Chưa có công việc nào.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Add Phase button (Modal trigger) ─────────── */}
              {canEdit && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    onClick={() => setIsCreatePhaseOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '8px 12px', border: '1px dashed hsl(var(--border-light))', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer', color: 'hsl(var(--text-muted))', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.15s ease' }}
                    onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'hsl(var(--primary))'; b.style.color = 'hsl(var(--primary))'; b.style.background = 'hsl(var(--primary-glow))'; }}
                    onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'hsl(var(--border-light))'; b.style.color = 'hsl(var(--text-muted))'; b.style.background = 'transparent'; }}
                  >
                    <FolderPlus size={14} /><span>+ Thêm Giai đoạn mới</span>
                  </button>
                </div>
              )}
            </div>
          )}
      </div>
    </>
  );
};

