import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemConfigService, type SystemConfigDto } from '../../services/systemConfigService';
import { Button, Input } from '../../components/ui';
import { Settings, Pencil, Check, X, AlertCircle, Loader2, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const dataTypeLabel: Record<string, string> = {
  number: 'Số',
  percentage: 'Phần trăm',
  string: 'Văn bản',
};

interface EditState {
  key: string;
  value: string;
}

export const SystemConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: configs = [], isLoading, isError, error } = useQuery({
    queryKey: ['system-configs'],
    queryFn: () => systemConfigService.getAll(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: EditState) => systemConfigService.update(key, value),
    onSuccess: () => {
      toast.success('Cập nhật cấu hình thành công.');
      setEditing(null);
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
    },
    onError: (err: any) => setEditError(err.message || 'Cập nhật thất bại.'),
  });

  const startEdit = (cfg: SystemConfigDto) => {
    setEditing({ key: cfg.configKey, value: cfg.configValue });
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditError(null);
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editing.value.trim()) return setEditError('Giá trị không được để trống.');
    updateMutation.mutate(editing);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Settings size={22} style={{ color: 'hsl(var(--primary))' }} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
          Cấu hình hệ thống
        </h2>
      </div>

      {/* Info banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: 'hsl(var(--primary-glow))', border: '1px solid hsl(var(--primary) / 0.2)',
        borderRadius: 8, padding: '10px 14px', fontSize: 13,
      }}>
        <Info size={15} style={{ color: 'hsl(var(--primary))', flexShrink: 0, marginTop: 1 }} />
        <span style={{ color: 'hsl(var(--text-secondary))' }}>
          Các tham số này ảnh hưởng đến hoạt động toàn hệ thống. Chỉ Admin có quyền chỉnh sửa.
        </span>
      </div>

      {isError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)',
          borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'hsl(346 84% 35%)',
        }}>
          <AlertCircle size={15} style={{ color: 'hsl(var(--danger))' }} />
          {(error as any)?.message || 'Không thể tải cấu hình hệ thống.'}
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, gap: 10 }}>
          <Loader2 className="animate-spin" size={22} style={{ color: 'hsl(var(--primary))' }} />
          <span style={{ color: 'hsl(var(--text-secondary))' }}>Đang tải cấu hình...</span>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid hsl(var(--border))' }}>
                {['Tham số', 'Mô tả', 'Kiểu', 'Giá trị hiện tại', 'Cập nhật lúc', ''].map((h) => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    color: 'hsl(var(--text-muted))', fontWeight: 600, whiteSpace: 'nowrap',
                    background: 'hsl(var(--bg-card))',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg) => {
                const isEditing = editing?.key === cfg.configKey;
                return (
                  <tr key={cfg.configKey} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    {/* Name + key */}
                    <td style={{ padding: '14px 16px', minWidth: 200 }}>
                      <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{cfg.displayName}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2, fontFamily: 'monospace' }}>
                        {cfg.configKey}
                      </div>
                    </td>
                    {/* Description */}
                    <td style={{ padding: '14px 16px', minWidth: 200, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                      {cfg.description || '—'}
                    </td>
                    {/* DataType */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: 'hsl(var(--border))', color: 'hsl(var(--text-secondary))',
                      }}>
                        {dataTypeLabel[cfg.dataType] ?? cfg.dataType}
                      </span>
                    </td>
                    {/* Value (editable) */}
                    <td style={{ padding: '14px 16px', minWidth: 160 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Input
                              type={cfg.dataType === 'number' || cfg.dataType === 'percentage' ? 'number' : 'text'}
                              min={0}
                              max={cfg.dataType === 'percentage' ? 100 : undefined}
                              step={cfg.dataType === 'percentage' ? 1 : 0.01}
                              value={editing!.value}
                              onChange={(e) => {
                                setEditing({ ...editing!, value: e.target.value });
                                setEditError(null);
                              }}
                              className="h-8"
                              style={{ width: 220 }}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                            />
                            {cfg.unit && (
                              <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>
                                {cfg.unit}
                              </span>
                            )}
                          </div>
                          {editError && editing!.key === cfg.configKey && (
                            <span style={{ fontSize: 11, color: 'hsl(var(--danger))' }}>{editError}</span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--primary))' }}>
                            {cfg.configValue}
                          </span>
                          {cfg.unit && (
                            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{cfg.unit}</span>
                          )}
                        </div>
                      )}
                    </td>
                    {/* UpdatedAt */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', color: 'hsl(var(--text-muted))', fontSize: 12 }}>
                      {fmtDate(cfg.updatedAt)}
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button
                            type="button" variant="primary" className="p-1.5 h-auto"
                            disabled={updateMutation.isPending}
                            onClick={saveEdit}
                            title="Lưu"
                          >
                            {updateMutation.isPending
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Check size={14} />}
                          </Button>
                          <Button
                            type="button" variant="secondary" className="p-1.5 h-auto"
                            disabled={updateMutation.isPending}
                            onClick={cancelEdit}
                            title="Hủy"
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button" variant="secondary" className="p-1.5 h-auto"
                          onClick={() => startEdit(cfg)}
                          disabled={editing !== null}
                          title="Chỉnh sửa"
                        >
                          <Pencil size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {configs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                    Chưa có cấu hình nào trong hệ thống.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
