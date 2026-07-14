import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemConfigService, type SystemConfigDto } from '../../services/systemConfigService';
import { Button, Input } from '../../components/ui';
import { Pencil, Check, X, AlertCircle, Loader2, Info } from 'lucide-react';
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
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-[hsl(var(--primary-glow))] border border-[hsl(var(--primary))/0.2] rounded-xl p-4 text-sm">
        <Info size={18} className="text-[hsl(var(--primary))] shrink-0 mt-0.5" />
        <span className="text-[hsl(var(--text-secondary))] leading-relaxed font-medium">
          Các tham số này ảnh hưởng đến hoạt động toàn hệ thống. Chỉ Admin mới có quyền chỉnh sửa và cập nhật các cấu hình này.
        </span>
      </div>

      {isError && (
        <div className="flex items-center gap-3 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger))/0.3] rounded-xl p-4 text-sm text-rose-800">
          <AlertCircle size={18} className="text-[hsl(var(--danger))] shrink-0" />
          <span>{(error as any)?.message || 'Không thể tải cấu hình hệ thống.'}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-[200px] gap-2.5">
          <Loader2 className="animate-spin text-[hsl(var(--primary))]" size={24} />
          <span className="text-[hsl(var(--text-secondary))] font-medium">Đang tải cấu hình...</span>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Tham số</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Mô tả</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Kiểu dữ liệu</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Giá trị hiện tại</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Cập nhật lúc</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((cfg) => {
                  const isEditing = editing?.key === cfg.configKey;
                  return (
                    <tr key={cfg.configKey} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      {/* Key & Display Name */}
                      <td className="px-6 py-4 align-middle">
                        <div className="font-semibold text-slate-900">{cfg.displayName}</div>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono">{cfg.configKey}</div>
                      </td>
                      {/* Description */}
                      <td className="px-6 py-4 text-slate-600 align-middle leading-relaxed max-w-xs break-words">
                        {cfg.description || '—'}
                      </td>
                      {/* Data Type */}
                      <td className="px-6 py-4 align-middle">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {dataTypeLabel[cfg.dataType] ?? cfg.dataType}
                        </span>
                      </td>
                      {/* Value */}
                      <td className="px-6 py-4 align-middle">
                        {isEditing ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
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
                                className="h-9 w-40"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                              {cfg.unit && (
                                <span className="text-xs text-slate-400 font-semibold">{cfg.unit}</span>
                              )}
                            </div>
                            {editError && editing!.key === cfg.configKey && (
                              <span className="text-xs text-[hsl(var(--danger))] font-medium">{editError}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-base text-[hsl(var(--primary))]">
                              {cfg.configValue}
                            </span>
                            {cfg.unit && (
                              <span className="text-xs text-slate-400 font-semibold">{cfg.unit}</span>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Updated At */}
                      <td className="px-6 py-4 text-slate-400 text-xs align-middle whitespace-nowrap">
                        {fmtDate(cfg.updatedAt)}
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4 align-middle text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="primary"
                              className="p-2 h-auto"
                              disabled={updateMutation.isPending}
                              onClick={saveEdit}
                              title="Lưu"
                            >
                              {updateMutation.isPending ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Check size={15} />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="p-2 h-auto"
                              disabled={updateMutation.isPending}
                              onClick={cancelEdit}
                              title="Hủy"
                            >
                              <X size={15} />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            className="p-2 h-auto"
                            onClick={() => startEdit(cfg)}
                            disabled={editing !== null}
                            title="Chỉnh sửa"
                          >
                            <Pencil size={15} className="text-[hsl(var(--primary-hover))]" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {configs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      Chưa có cấu hình nào trong hệ thống.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
