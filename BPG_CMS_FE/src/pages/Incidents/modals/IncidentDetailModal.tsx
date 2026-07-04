import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { MiniMarkdown } from '../../../components/ui/MiniMarkdown';
import type { IncidentReport, WBSPhase } from '../../../types/common';
import { ArrowRight, AlertCircle, CheckCircle, HardHat, Package, MapPin, Clock, Users, BarChart3 } from 'lucide-react';

interface IncidentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentReport;
  phase: WBSPhase | null;
  user: { id: string; name: string; role: string } | null;
  onResolveClick: () => void;
  projectId: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const INCIDENT_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.FC<any> }> = {
  Construction: {
    label: 'Sự cố Thi công',
    color: 'hsl(28, 90%, 50%)',
    bg: 'hsl(28, 100%, 97%)',
    border: 'hsl(28, 80%, 78%)',
    icon: HardHat,
  },
  InventoryLoss: {
    label: 'Thất thoát Vật tư',
    color: 'hsl(210, 70%, 45%)',
    bg: 'hsl(210, 100%, 97%)',
    border: 'hsl(210, 70%, 78%)',
    icon: Package,
  },
  InventoryDamage: {
    label: 'Hư hại Vật tư',
    color: 'hsl(210, 70%, 45%)',
    bg: 'hsl(210, 100%, 97%)',
    border: 'hsl(210, 70%, 78%)',
    icon: Package,
  },
};

function extractMetaFromDesc(description: string): { mainDesc: string; meta: Record<string, string> } {
  // Split the leading body from metadata lines prefixed with **Key:**
  const lines = description.split('\n');
  const metaLines: Record<string, string> = {};
  const bodyLines: string[] = [];
  let metaStarted = false;

  for (const line of lines) {
    const match = line.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
    if (match) {
      metaStarted = true;
      metaLines[match[1].trim()] = match[2].trim();
    } else if (metaStarted && line.trim() === '') {
      // skip blank after meta
    } else {
      bodyLines.push(line);
    }
  }

  return { mainDesc: bodyLines.join('\n').trim(), meta: metaLines };
}

// ── component ─────────────────────────────────────────────────────────────────

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  isOpen,
  onClose,
  incident,
  phase,
  user,
  onResolveClick,
}) => {
  if (!isOpen || !incident) return null;

  const incidentType = incident.incidentType as keyof typeof INCIDENT_META;
  const meta = INCIDENT_META[incidentType] ?? INCIDENT_META.Construction;
  const TypeIcon = meta.icon;
  const isInventoryIncident = incidentType === 'InventoryLoss' || incidentType === 'InventoryDamage';
  const isConstruction = !isInventoryIncident;

  // Extract images from description (they were embedded as ![alt](url))
  const imageLines = (incident.description || '').split('\n').filter(l => l.startsWith('!['));
  const descWithoutImages = incident.description?.split('\n').filter(l => !l.startsWith('![')).join('\n').trim();
  const { mainDesc: mainDescClean, meta: descMetaClean } = extractMetaFromDesc(descWithoutImages || '');

  const statusColor = {
    WaitingReview:    { label: 'Chờ TPKT Thẩm định', color: 'hsl(38, 92%, 50%)', bg: 'hsl(38, 100%, 96%)' },
    WaitingAccountant:{ label: 'Chờ Kế toán Xác minh', color: 'hsl(210, 70%, 45%)', bg: 'hsl(210, 100%, 97%)' },
    Assessing:        { label: 'Cần Bổ sung', color: 'hsl(0, 72%, 50%)', bg: 'hsl(0, 100%, 97%)' },
    Approved:         { label: 'Đã Duyệt', color: 'hsl(142, 71%, 40%)', bg: 'hsl(142, 100%, 97%)' },
    Rejected:         { label: 'Bị Từ chối', color: 'hsl(0, 72%, 50%)', bg: 'hsl(0, 100%, 97%)' },
  }[incident.status as string] ?? { label: incident.status, color: 'hsl(var(--text-secondary))', bg: 'hsl(var(--bg-muted))' };

  const roleLabel = user?.role?.toLowerCase() ?? '';
  const isTPKT = roleLabel === 'technicalmanager' || roleLabel === 'admin';
  const isAccountant = roleLabel === 'accountant';

  return (
    <Modal isOpen={isOpen} onClose={onClose} width="lg"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '6px', borderRadius: '8px', background: meta.bg, border: `1px solid ${meta.border}` }}>
            <TypeIcon size={16} color={meta.color} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: meta.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{meta.label}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Chi tiết Sự cố #{incident.id}</div>
          </div>
          <div style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: statusColor.bg, color: statusColor.color }}>
            {statusColor.label}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Phase info */}
        {phase && (
          <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-muted))', padding: '8px 12px', borderRadius: '6px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <BarChart3 size={13} />
            <span>Phase: <strong>{phase.name}</strong> · Hạn: <strong style={{ color: 'hsl(var(--primary))' }}>{phase.deadline || 'Không có'}</strong></span>
          </div>
        )}

        {/* Progress tracker */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'hsl(var(--bg-muted))', borderRadius: '10px', border: '1px solid hsl(var(--border))' }}>
          {[
            { n: 1, label: 'PL Báo cáo', done: true },
            { n: 2, label: isInventoryIncident ? 'Kế toán Xác minh' : 'TPKT Thẩm định', done: !!incident.damageDescription },
            { n: 3, label: isInventoryIncident ? 'GĐ Phê duyệt' : 'Hoàn tất', done: incident.status === 'Approved' },
          ].map((step, idx) => (
            <React.Fragment key={step.n}>
              {idx > 0 && <ArrowRight size={13} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0 }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%', fontSize: '0.75rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.done ? 'hsl(var(--success))' : 'hsl(var(--border))',
                  color: step.done ? '#fff' : 'hsl(var(--text-muted))',
                }}>
                  {step.n}
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, textAlign: 'center', color: step.done ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}>
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Revision notice */}
        {incident.status === 'Assessing' && (
          <div style={{ padding: '12px', background: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)', borderRadius: '8px', display: 'flex', gap: '8px', color: 'hsl(var(--danger))' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '0.85rem' }}>Yêu cầu bổ sung từ {isInventoryIncident ? 'Kế toán' : 'TPKT'}:</strong>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{incident.revisionComment}</p>
            </div>
          </div>
        )}

        {/* ── BƯỚC 1: Thông tin sự cố ─────────────────────────────── */}
        <div style={{ border: `1px solid ${meta.border}`, borderRadius: '10px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '10px 14px', background: meta.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Bước 1: Báo cáo Sự cố (Project Leader)
            </span>
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
              {incident.reporterName} · {incident.date}
            </span>
          </div>

          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Task name */}
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Hạng mục công việc</span>
              <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: '0.9rem' }}>{incident.taskName}</p>
            </div>

            {/* Meta info grid (extracted from description) */}
            {Object.keys(descMetaClean).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                {Object.entries(descMetaClean).map(([key, val]) => {
                  const icons: Record<string, React.ReactNode> = {
                    'Vị trí chi tiết': <MapPin size={12} />,
                    'Vị trí kho/Lô hàng': <MapPin size={12} />,
                    'Ngày/Giờ xảy ra': <Clock size={12} />,
                    'Ngày/Giờ phát hiện': <Clock size={12} />,
                    'Người/Tổ đội phụ trách': <Users size={12} />,
                    'Người làm chứng/Liên đới': <Users size={12} />,
                  };
                  return (
                    <div key={key} style={{ padding: '8px 10px', background: 'hsl(var(--bg-muted))', borderRadius: '6px', borderLeft: `3px solid ${meta.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' }}>
                        {icons[key] ?? null}
                        {key}
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{val}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Main description */}
            {mainDescClean && (
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Mô tả diễn biến sự cố</span>
                <div style={{ marginTop: '4px', padding: '10px', background: 'hsl(var(--bg-muted))', borderRadius: '6px' }}>
                  <MiniMarkdown content={mainDescClean} />
                </div>
              </div>
            )}

            {/* Images */}
            {imageLines.length > 0 && (
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Hình ảnh đính kèm</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                  {incident.images?.map((img, idx) => (
                    <a key={idx} href={img} target="_blank" rel="noopener noreferrer">
                      <img src={img} alt={`Ảnh ${idx + 1}`} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '6px', border: '1px solid hsl(var(--border))', transition: 'transform 0.2s' }}
                        onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                        onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── BƯỚC 2: Đánh giá thiệt hại ───────────────────────────── */}
        {incident.damageDescription && (
          <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Bước 2: {isInventoryIncident ? 'Thống kê Vật tư Thiệt hại' : 'Đánh giá Thiệt hại & Vật tư Cấp bù'}
              </span>
            </div>

            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Construction-specific stats */}
              {isConstruction && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ padding: '8px 10px', background: 'hsl(var(--bg-muted))', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Nhân công khắc phục</div>
                    <strong style={{ fontSize: '0.9rem' }}>{incident.estimatedLaborDays} ngày công</strong>
                  </div>
                  <div style={{ padding: '8px 10px', background: 'hsl(var(--bg-muted))', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Trễ tiến độ dự kiến</div>
                    <strong style={{ fontSize: '0.9rem' }}>{incident.estimatedDelayDays} ngày</strong>
                  </div>
                  {incident.proposedAction && (
                    <div style={{ padding: '8px 10px', background: 'hsl(var(--bg-muted))', borderRadius: '6px', gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Đề xuất xử lý</div>
                      <strong style={{ fontSize: '0.9rem' }}>{incident.proposedAction}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Damage description as Markdown */}
              <MiniMarkdown content={incident.damageDescription} />
            </div>
          </div>
        )}

        {/* ── BƯỚC 3: Kết quả phê duyệt ────────────────────────────── */}
        {incident.status === 'Approved' && (
          <div style={{ border: '1px solid hsl(var(--success) / 0.4)', borderRadius: '10px', padding: '14px', background: 'hsl(var(--success-glow))', display: 'flex', gap: '10px' }}>
            <CheckCircle size={18} style={{ color: 'hsl(var(--success))', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--success))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Bước 3: Đã Duyệt bởi {incident.reviewerName?.toUpperCase()}
              </span>
              <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'hsl(var(--text-primary))' }}>
                {isInventoryIncident
                  ? 'Sự cố đã được Kế toán xác minh. Phiếu Kiểm kê Giảm Tồn đang chờ Giám đốc phê duyệt.'
                  : 'Sự cố đã được TPKT thẩm định. Rework Task hoặc điều chỉnh tiến độ đã được áp dụng.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Handling Instruction ─────────────────────────────────────── */}
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-muted))' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Hướng dẫn xử lý (Từ cấp quản lý)
            </span>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {incident.handlingInstruction ? (
              <div style={{ padding: '10px', background: 'hsl(var(--bg-card))', borderRadius: '6px', border: '1px solid hsl(var(--border))', fontSize: '0.85rem', color: 'hsl(var(--text-primary))', whiteSpace: 'pre-wrap' }}>
                {incident.handlingInstruction}
              </div>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Chưa có hướng dẫn xử lý.</span>
            )}
          </div>
        </div>

        {/* ── Action buttons ─────────────────────────────────────────── */}
        {!isInventoryIncident && incident.status === 'WaitingReview' && isTPKT && (
          <button onClick={onResolveClick} className="btn btn-primary" style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}>
            🏗 Thẩm định &amp; Phê duyệt (TPKT)
          </button>
        )}
        {isInventoryIncident && incident.status === 'WaitingAccountant' && isAccountant && (
          <button onClick={onResolveClick} className="btn btn-primary" style={{ width: '100%', fontSize: '0.85rem', padding: '10px', background: 'hsl(210, 70%, 45%)' }}>
            📦 Xác minh &amp; Tạo Phiếu Giảm Tồn (Kế toán)
          </button>
        )}

      </div>
    </Modal>
  );
};
