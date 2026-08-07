import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemConfigService, type SystemConfigDto } from '../../services/systemConfigService';
import { Button, Input, Card, CardHeader, CardTitle, CardBody, Badge, FormItem, LoadingSpinner, type BadgeVariant } from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { compressAndUploadFile } from '../../utils/uploadHelper';
import {
  Pencil, Check, X, AlertCircle, Loader2, Info, Camera,
  Building2, SlidersHorizontal, Package, CalendarClock, FileEdit,
} from 'lucide-react';
import toast from 'react-hot-toast';

const COMPANY_KEYS = ['CompanyName', 'CompanyLogoUrl'];

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

const dataTypeMeta: Record<string, { label: string; variant: BadgeVariant }> = {
  number: { label: 'Số', variant: 'info' },
  percentage: { label: 'Phần trăm', variant: 'warning' },
  string: { label: 'Văn bản', variant: 'default' },
};

const paramIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  NguongTonKhoThap: Package,
  HanHuyPhieuNgay: CalendarClock,
  DailyLogEditWindowHours: FileEdit,
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
    onSuccess: (result) => {
      console.log(result.message || 'Đã cập nhật thông tin công ty.');
      queryClient.invalidateQueries({ queryKey: ['company-info'] });
      refetch();
    },
    onError: (err: any) => toast.error(err.message || 'Không thể cập nhật thông tin công ty.'),
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
        toast.error('Không thể tải logo lên. Vui lòng thử lại.');
        setIsUploading(false);
      }
    );
  };

  const isDirty = name.trim() !== companyName || logoUrl !== companyLogoUrl;

  const handleDiscard = () => {
    setName(companyName);
    setLogoUrl(companyLogoUrl);
  };

  return (
    <Card>
      <CardHeader className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))]">
          <Building2 size={17} />
        </div>
        <CardTitle>Thông tin công ty</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col sm:flex-row sm:items-center gap-8">
          <div className="relative shrink-0 self-center sm:self-start">
            <button
              type="button"
              onClick={handlePickLogo}
              disabled={isUploading}
              className="group relative h-32 w-32 rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100 shadow-sm ring-4 ring-white overflow-hidden focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2"
              title="Nhấn để đổi logo"
            >
              <img src={logoUrl} alt="Logo công ty" className="h-full w-full object-contain p-4" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                <span className="text-[11px] font-medium">Đổi logo</span>
              </div>
            </button>
            <button
              type="button"
              onClick={handlePickLogo}
              disabled={isUploading}
              title="Đổi logo"
              className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white shadow-md ring-4 ring-white hover:bg-[hsl(var(--primary-hover))] transition-colors disabled:opacity-60"
            >
              {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex-1 flex flex-col gap-4 min-w-0 w-full">
            <FormItem label="Tên công ty">
              <Input
                icon={Building2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên công ty"
                className="max-w-md"
              />
              <p className="mt-1.5 text-xs text-gray-400">Tên và logo hiển thị trên sidebar và trang đăng nhập.</p>
            </FormItem>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="primary"
                onClick={() => saveMutation.mutate()}
                disabled={!isDirty || !name.trim() || isUploading}
                isLoading={saveMutation.isPending}
              >
                <Check size={15} />
                Lưu thay đổi
              </Button>
              {isDirty && (
                <Button type="button" variant="ghost" onClick={handleDiscard} disabled={saveMutation.isPending}>
                  Hoàn tác
                </Button>
              )}
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
    onSuccess: (result) => {
      console.log(result.message || 'Đã cập nhật cấu hình hệ thống.');
      setEditing(null);
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
    },
    onError: (err: any) => setEditError(err.message || 'Không thể cập nhật cấu hình hệ thống.'),
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
      <CardHeader className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))]">
          <SlidersHorizontal size={17} />
        </div>
        <CardTitle>Tham số hệ thống</CardTitle>
      </CardHeader>
      <CardBody className="!px-0 !pt-0 !pb-2">
        {isError && (
          <div className="flex items-center gap-3 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger))/0.3] rounded-xl p-4 m-5 text-sm text-rose-800">
            <AlertCircle size={18} className="text-[hsl(var(--danger))] shrink-0" />
            <span>{(error as any)?.message || 'Không thể tải cấu hình hệ thống.'}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-[160px]">
            <LoadingSpinner size="md" label="Đang tải cấu hình..." />
          </div>
        ) : configs.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">Chưa có tham số nào trong hệ thống.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tham số</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Mô tả</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Kiểu dữ liệu</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Giá trị hiện tại</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Cập nhật lúc</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((cfg) => {
                  const isEditing = editing?.key === cfg.configKey;
                  const typeMeta = dataTypeMeta[cfg.dataType] ?? { label: cfg.dataType, variant: 'default' as BadgeVariant };
                  const ParamIcon = paramIcon[cfg.configKey] ?? SlidersHorizontal;
                  const updatedLabel = fmtDate(cfg.updatedAt);

                  return (
                    <tr key={cfg.configKey} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <ParamIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">{cfg.displayName || cfg.configKey}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{cfg.configKey}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 align-middle leading-relaxed max-w-xs">
                        <span className="line-clamp-2" title={cfg.description}>{cfg.description || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 align-middle">
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
                                className="h-9 w-32"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                              {cfg.unit && <span className="text-xs text-slate-400 font-semibold">{cfg.unit}</span>}
                            </div>
                            {editError && (
                              <span className="text-xs text-[hsl(var(--danger))] font-medium">{editError}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-base text-[hsl(var(--primary))]">{cfg.configValue}</span>
                            {cfg.unit && <span className="text-xs text-slate-400 font-semibold">{cfg.unit}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs align-middle whitespace-nowrap">
                        {updatedLabel || '—'}
                      </td>
                      <td className="px-5 py-3.5 align-middle text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              disabled={updateMutation.isPending}
                              onClick={saveEdit}
                              title="Lưu"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-glow))] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            </button>
                            <button
                              type="button"
                              disabled={updateMutation.isPending}
                              onClick={cancelEdit}
                              title="Hủy"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(cfg)}
                            disabled={editing !== null}
                            title="Chỉnh sửa"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-[hsl(var(--primary-glow))] hover:text-[hsl(var(--primary))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
