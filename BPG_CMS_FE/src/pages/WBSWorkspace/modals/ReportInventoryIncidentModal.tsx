import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { incidentService } from '../../../services/incidentService';
import { projectService } from '../../../services/projectService';
import { UploadCloud, X, Package, Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { inventoryService } from '../../../services/inventoryService';
import type { CurrentInventory } from '../../../types/inventory';

const schema = z.object({
  incidentType: z.enum(['InventoryLoss', 'InventoryDamage']),
  description: z.string().min(5, 'Mô tả sự cố phải có ít nhất 5 ký tự'),
  incidentDate: z.string().min(1, 'Vui lòng chọn ngày phát hiện'),
  estimatedLaborDays: z.coerce.number().optional().default(0),
  estimatedDelayDays: z.coerce.number().optional().default(0),
});

type FormData = z.infer<typeof schema>;

interface ReportInventoryIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  phaseId: string;
  phaseName: string;
  user: { id: string; name: string } | null;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const ReportInventoryIncidentModal: React.FC<ReportInventoryIncidentModalProps> = ({
  isOpen,
  onClose,
  projectId,
  phaseId,
  phaseName,
  onSuccess,
  onError,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const [damagedMaterials, setDamagedMaterials] = useState<Array<CurrentInventory & { quantityLost: number }>>([]);
  const [inventory, setInventory] = useState<CurrentInventory[]>([]);
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [searchMaterial, setSearchMaterial] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      inventoryService.getCurrentInventory(Number(projectId))
        .then(res => setInventory(res))
        .catch(console.error);
    }
  }, [isOpen, projectId]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<any>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      incidentType: 'InventoryLoss',
      description: '',
      incidentDate: new Date().toISOString().slice(0, 16),
      estimatedLaborDays: 0,
      estimatedDelayDays: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let finalDesc = data.description.trim();

      const d = new Date(data.incidentDate);
      const dateStr = `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${d.toLocaleDateString('vi-VN')}`;
      finalDesc += `\n\n**Ngày/Giờ phát hiện:** ${dateStr}`;

      if (selectedFiles.length > 0) {
        const uploadedUrls = await projectService.uploadFiles(selectedFiles, 'incidents');
        if (uploadedUrls && uploadedUrls.length > 0) {
          finalDesc += '\n\n**Hình ảnh đính kèm:**\n' + uploadedUrls.map((url, i) => `![Ảnh ${i + 1}](${url})`).join('\n');
        }
      }

      let finalDamageDesc = '';
      if (damagedMaterials.length > 0) {
        finalDamageDesc = `### Bảng thống kê vật tư thiệt hại\n\n| Mã vật tư | Tên vật tư | ĐVT | SL Lỗi/Mất |\n|---|---|---|---|\n`;
        damagedMaterials.forEach(m => {
          finalDamageDesc += `| ${m.materialCode} | ${m.materialName} | ${m.unitName} | **${m.quantityLost}** |\n`;
        });
      } else {
        finalDamageDesc = 'Không có vật tư nào được thống kê cụ thể.';
      }

      await incidentService.createAndAssessIncident({
        projectId: Number(projectId),
        phaseId: Number(phaseId), // Passed PhaseId instead of TaskId
        incidentType: data.incidentType,
        description: finalDesc,
        damageDescription: finalDamageDesc,
        estimatedMaterialLoss: 0,
        estimatedLaborDays: data.estimatedLaborDays ?? 0,
        estimatedDelayDays: data.estimatedDelayDays ?? 0,
      });
    },
    onSuccess: () => {
      onSuccess('Báo cáo sự cố vật tư đã được lưu và chuyển Kế toán xác minh.');
      reset();
      setSelectedFiles([]);
      setPreviews([]);
      onClose();
    },
    onError: (err: any) => {
      onError(err.message || 'Lỗi khi báo cáo sự cố vật tư.');
    },
  });

  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  const onInvalid = (errors: any) => {
    console.error('[ReportInventoryIncidentModal] Validation errors:', errors);
    const firstError = Object.values(errors)[0] as any;
    const msg = firstError?.message || 'Vui lòng kiểm tra lại các trường bắt buộc.';
    toast.error(msg);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addImages(Array.from(e.dataTransfer.files));
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addImages(Array.from(e.target.files));
  };
  const addImages = (files: File[]) => {
    const remaining = 5 - selectedFiles.length;
    if (remaining <= 0) { toast.error('Đã đạt giới hạn tối đa 5 ảnh.'); return; }
    const MAX = 10 * 1024 * 1024;
    if (files.some(f => f.size > MAX)) { toast.error('Hình ảnh không được vượt quá 10MB.'); return; }
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, remaining);
    if (!valid.length) return;
    setSelectedFiles(prev => [...prev, ...valid]);
    setPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
  };
  const removeImage = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx); });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lập Báo cáo Sự cố Vật tư Kho (Trưởng nhóm)" width="xl">

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: '8px',
        background: 'hsl(210, 100%, 97%)',
        border: '1px solid hsl(210, 70%, 75%)',
        marginBottom: '16px',
      }}>
        <Package size={18} color="hsl(210, 70%, 45%)" />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(210, 70%, 45%)' }}>Sự cố Vật tư Kho</div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Mất mát, hư hỏng khi chưa xuất dùng (do PL báo cáo kèm biên bản) - Giai đoạn: {phaseName}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-3">
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Phần 1: Thông tin Sự cố
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Loại sự cố vật tư <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                </label>
                <select className="input" {...register('incidentType')}>
                  <option value="InventoryLoss">📦 Thất thoát vật tư </option>
                  <option value="InventoryDamage">🔴 Hư hại vật tư </option>
                </select>
              </div>

              <div>
                <label htmlFor="report-desc" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Mô tả nguyên nhân và tình trạng sự cố
                  {' '}<span style={{ color: 'hsl(var(--danger))' }}>*</span>
                </label>
                <textarea
                  id="report-desc"
                  className="input"
                  placeholder="Mô tả vật tư bị mất/hư hỏng, số lượng ước tính, điều kiện phát hiện..."
                  {...register('description')}
                  rows={3}
                />
                {(errors as any).description && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{String((errors as any).description?.message)}</span>}
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Ngày/Giờ phát hiện <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  className="input"
                  {...register('incidentDate')}
                />
                {(errors as any).incidentDate && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.75rem' }}>{String((errors as any).incidentDate?.message)}</span>}
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Hình ảnh / Biên bản kiểm kê (Tối đa 5 ảnh)
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => { if (selectedFiles.length < 5) document.getElementById('incident-img-input')?.click(); }}
                  style={{
                    border: `2px dashed ${dragging ? 'hsl(210, 70%, 45%)' : 'hsl(var(--border))'}`,
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    cursor: selectedFiles.length >= 5 ? 'not-allowed' : 'pointer',
                    background: dragging ? 'hsl(210, 100%, 97%)' : 'hsl(var(--bg-card))',
                    opacity: selectedFiles.length >= 5 ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  <input id="incident-img-input" type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} disabled={selectedFiles.length >= 5} />
                  <UploadCloud size={24} style={{ color: 'hsl(var(--text-secondary))', margin: '0 auto 6px' }} />
                  <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', margin: '0 0 4px' }}>
                    Kéo thả hoặc click để chọn ảnh
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Đã chọn {selectedFiles.length}/5 ảnh</span>
                </div>
                {previews.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {previews.map((url, idx) => (
                      <div key={idx} style={{ position: 'relative', width: 60, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid hsl(var(--border))' }}>
                        <img src={url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); removeImage(idx); }}
                          style={{ position: 'absolute', top: 2, right: 2, background: '#dc2626', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <X size={10} color="white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Phần 2: Đánh giá Thiệt hại & Đề xuất
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                    Danh sách vật tư thiệt hại
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMaterialSelector(!showMaterialSelector)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> Thêm vật tư
                  </button>
                </div>

                {showMaterialSelector && (
                  <div style={{ padding: '10px', background: 'hsl(var(--bg-muted))', borderRadius: '6px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-2.5 top-2.5 text-[hsl(var(--text-muted))]" />
                        <input
                          type="text"
                          placeholder="Tìm vật tư theo mã hoặc tên..."
                          className="input"
                          style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
                          value={searchMaterial}
                          onChange={e => setSearchMaterial(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid hsl(var(--border))', borderRadius: '4px', background: 'hsl(var(--bg-card))' }}>
                      {inventory.filter(item =>
                        item.materialCode.toLowerCase().includes(searchMaterial.toLowerCase()) ||
                        item.materialName.toLowerCase().includes(searchMaterial.toLowerCase())
                      ).slice(0, 20).map(item => (
                        <div key={item.materialId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid hsl(var(--border))', fontSize: '0.8rem' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{item.materialCode} - {item.materialName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>Tồn: {item.availableQuantity} {item.unitName}</div>
                          </div>
                          <button
                            type="button"
                            className="text-[hsl(var(--primary))] hover:underline"
                            style={{ fontSize: '0.75rem', fontWeight: 600 }}
                            onClick={() => {
                              if (!damagedMaterials.find(m => m.materialId === item.materialId)) {
                                setDamagedMaterials([...damagedMaterials, { ...item, quantityLost: 0 }]);
                              }
                            }}
                          >
                            Chọn
                          </button>
                        </div>
                      ))}
                      {inventory.length === 0 && (
                        <div style={{ padding: '10px', textAlign: 'center', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                          Không có vật tư nào trong kho.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {damagedMaterials.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead style={{ background: 'hsl(var(--bg-muted))', textAlign: 'left' }}>
                      <tr>
                        <th style={{ padding: '8px', borderBottom: '1px solid hsl(var(--border))' }}>Vật tư</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid hsl(var(--border))' }}>SL Lỗi/Mất</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid hsl(var(--border))', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {damagedMaterials.map((m, idx) => (
                        <tr key={m.materialId}>
                          <td style={{ padding: '8px', borderBottom: '1px solid hsl(var(--border))' }}>
                            <div style={{ fontWeight: 600 }}>{m.materialCode}</div>
                            <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>{m.materialName}</div>
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid hsl(var(--border))' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                min={0}
                                className="input"
                                style={{ width: '80px', padding: '4px 8px' }}
                                value={m.quantityLost === 0 ? '' : m.quantityLost}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const newArr = [...damagedMaterials];
                                  newArr[idx].quantityLost = val;
                                  setDamagedMaterials(newArr);
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>{m.unitName}</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid hsl(var(--border))', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setDamagedMaterials(damagedMaterials.filter((_, i) => i !== idx))}
                              style={{ color: 'hsl(var(--danger))', background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border))', borderRadius: '6px' }}>
                    Chưa có vật tư nào được chọn.
                  </div>
                )}
              </div>

              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'hsl(210, 100%, 97%)',
                border: '1px solid hsl(210, 70%, 85%)',
                fontSize: '0.8rem',
                color: 'hsl(210, 50%, 40%)',
                lineHeight: 1.6,
              }}>
                <strong>📋 Quy trình tiếp theo:</strong><br />
                Sau khi PL lưu báo cáo này, <strong>Kế toán</strong> sẽ xem xét, xác minh và tạo <strong>Phiếu Kiểm kê Giảm Tồn Kho</strong> để trình <strong>Giám đốc</strong> phê duyệt.
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-[hsl(var(--border))]">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={mutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'hsl(210, 70%, 45%)' }}
          >
            {mutation.isPending && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {mutation.isPending ? 'Đang lưu...' : '📦 Lưu & Chuyển Kế toán xác minh'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
