import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemConfigService, type SystemConfigDto } from '../../services/systemConfigService';
import { Button, Input, Card, CardHeader, CardTitle, CardBody } from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { compressAndUploadFile } from '../../utils/uploadHelper';
import { Pencil, Check, X, AlertCircle, Loader2, Info, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

const COMPANY_KEYS = ['CompanyName', 'CompanyLogoUrl'];

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

const CompanySettingsCard: React.FC = () => {
  const { companyName, companyLogoUrl, refetch } = useCompany();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(companyName);
  const [logoUrl, setLogoUrl] = useState(companyLogoUrl);
  const [isUploading, setIsUploading] = useState(false);

  React.useEffect(() => {
    setName(companyName);
    setLogoUrl(companyLogoUrl);
  }, [companyName, companyLogoUrl]);

  const saveMutation = useMutation({
    mutationFn: () => systemConfigService.updateCompanySettings(name.trim(), logoUrl),
    onSuccess: () => {
      toast.success('Cập nhật thông tin công ty thành công.');
      queryClient.invalidateQueries({ queryKey: ['company-info'] });
      refetch();
    },
    onError: (err: any) => toast.error(err.message || 'Cập nhật thất bại.'),
  });

  const handlePickLogo = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploading(true);
    compressAndUploadFile(
      file,
      'company',
      (url) => {
        setLogoUrl(url);
        setIsUploading(false);
      },
      () => {
        toast.error('Tải logo lên thất bại. Vui lòng thử lại.');
        setIsUploading(false);
      }
    );
  };

  const isDirty = name.trim() !== companyName || logoUrl !== companyLogoUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin công ty</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center gap-3">
            <img
              src={logoUrl}
              alt="Logo công ty"
              className="h-24 w-24 object-contain rounded-lg border border-gray-200 bg-gray-50 p-2"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button type="button" variant="secondary" onClick={handlePickLogo} disabled={isUploading} className="text-sm">
              {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Đổi logo
            </Button>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">
              Tên công ty
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                placeholder="Tên công ty"
              />
            </label>
            <div>
              <Button
                type="button"
                variant="primary"
                onClick={() => saveMutation.mutate()}
                disabled={!isDirty || !name.trim() || isUploading || saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

const SystemParametersCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: allConfigs = [], isLoading, isError, error } = useQuery({
    queryKey: ['system-configs'],
    queryFn: () => systemConfigService.getAll(),
  });

  const configs = allConfigs.filter((c) => !COMPANY_KEYS.includes(c.configKey));

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
    <Card>
      <CardHeader>
        <CardTitle>Tham số hệ thống</CardTitle>
      </CardHeader>
      <CardBody>
        {isError && (
          <div className="flex items-center gap-3 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger))/0.3] rounded-xl p-4 text-sm text-rose-800 mb-4">
            <AlertCircle size={18} className="text-[hsl(var(--danger))] shrink-0" />
            <span>{(error as any)?.message || 'Không thể tải cấu hình hệ thống.'}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-[160px] gap-2.5">
            <Loader2 className="animate-spin text-[hsl(var(--primary))]" size={24} />
            <span className="text-[hsl(var(--text-secondary))] font-medium">Đang tải cấu hình...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tham số</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Mô tả</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Kiểu dữ liệu</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Giá trị hiện tại</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Cập nhật lúc</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((cfg) => {
                  const isEditing = editing?.key === cfg.configKey;
                  return (
                    <tr key={cfg.configKey} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 align-middle">
                        <div className="font-semibold text-slate-900">{cfg.displayName || cfg.configKey}</div>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono">{cfg.configKey}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 align-middle leading-relaxed max-w-xs break-words">
                        {cfg.description || '—'}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {dataTypeLabel[cfg.dataType] ?? cfg.dataType}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
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
                      <td className="px-4 py-3 text-slate-400 text-xs align-middle whitespace-nowrap">
                        {fmtDate(cfg.updatedAt)}
                      </td>
                      <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
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
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Chưa có tham số nào trong hệ thống.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export const SystemConfigPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-start gap-3 bg-[hsl(var(--primary-glow))] border border-[hsl(var(--primary))/0.2] rounded-xl p-4 text-sm">
        <Info size={18} className="text-[hsl(var(--primary))] shrink-0 mt-0.5" />
        <span className="text-[hsl(var(--text-secondary))] leading-relaxed font-medium">
          Các cấu hình này ảnh hưởng đến toàn hệ thống. Chỉ Admin mới có quyền chỉnh sửa.
        </span>
      </div>

      <CompanySettingsCard />
      <SystemParametersCard />
    </div>
  );
};
