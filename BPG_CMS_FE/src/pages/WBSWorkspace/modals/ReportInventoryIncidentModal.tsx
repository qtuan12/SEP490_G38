import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { incidentService } from '../../../services/incidentService';
import { UploadCloud, X, Package, Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { compressAndUploadFile } from '../../../utils/uploadHelper';
import type { UploadedFileState } from '../../../utils/uploadHelper';
import { directPurchaseService } from '../../../services/directPurchaseService';
import type { PhaseBOQItemDto } from '../../../services/directPurchaseService';
import { inventoryService } from '../../../services/inventoryService';

const getLocalISOString = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
};

const schema = z.object({
  incidentType: z.enum(['InventoryLoss', 'InventoryDamage']),
  description: z.string().min(5, 'Mô tả sự cố phải có ít nhất 5 ký tự'),
  incidentDate: z.string()
    .min(1, 'Vui lòng chọn ngày phát hiện')
    .refine((val) => {
      const selected = new Date(val);
      const now = new Date();
      return selected <= now;
    }, 'Ngày/Giờ phát hiện không được vượt quá thời gian hiện tại'),
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [dragging, setDragging] = useState(false);

  const [damagedMaterials, setDamagedMaterials] = useState<Array<PhaseBOQItemDto & { stockQuantity: number; quantityLost: number }>>([]);
  const [boqItems, setBoqItems] = useState<Array<PhaseBOQItemDto & { stockQuantity: number }>>([]);
  const [loadingBOQ, setLoadingBOQ] = useState(false);
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [searchMaterial, setSearchMaterial] = useState('');

  React.useEffect(() => {
    if (isOpen && phaseId) {
      setLoadingBOQ(true);
      setBoqItems([]);
      setDamagedMaterials([]);
      Promise.all([
        directPurchaseService.getPhaseBOQ(Number(projectId), Number(phaseId)).catch(() => []),
        inventoryService.getCurrentInventory(Number(projectId)).catch(() => [])
      ])
        .then(([boqRes, invRes]) => {
          const invMap = new Map<number, number>();
          (invRes || []).forEach(inv => {
            const qty = inv.availableQuantity ?? inv.quantity ?? 0;
            invMap.set(inv.materialId, qty);
          });

          const filtered = (boqRes || [])
            .map(item => ({
              ...item,
              stockQuantity: invMap.get(item.materialId) || 0
            }))
            .filter(item => item.stockQuantity > 0);

          setBoqItems(filtered);
        })
        .catch(console.error)
        .finally(() => setLoadingBOQ(false));
    }
  }, [isOpen, projectId, phaseId]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<any>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      incidentType: 'InventoryLoss',
      description: '',
      incidentDate: getLocalISOString(),
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

      // Collect successfully uploaded URLs
      const successfulUrls = uploadedFiles
        .filter(f => f.status === 'success' && f.url)
        .map(f => f.url!);

      if (successfulUrls.length > 0) {
        finalDesc += '\n\n**Hình ảnh đính kèm:**\n' + successfulUrls.map((url, i) => `![Ảnh ${i + 1}](${url})`).join('\n');
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
      onSuccess('Báo cáo sự cố vật tư kho đã được lưu và gửi thông báo tới Kế toán xác minh.');
      reset();
      setUploadedFiles([]);
      onClose();
    },
    onError: (err: any) => {
      onError(err.message || 'Lỗi khi báo cáo sự cố vật tư.');
    },
  });

  const onSubmit = (data: any) => {
    if (uploadedFiles.some(f => f.status === 'uploading')) {
      toast.error('Vui lòng chờ hình ảnh tải lên hoàn tất.');
      return;
    }
    if (uploadedFiles.some(f => f.status === 'error') || uploadedFiles.some(f => !f.url || !f.url.startsWith('http'))) {
      toast.error('Không thể tải ảnh lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.');
      return;
    }

    if (damagedMaterials.length > 0) {
      const emptyItem = damagedMaterials.find(m => !m.quantityLost || isNaN(m.quantityLost) || m.quantityLost <= 0);
      if (emptyItem) {
        toast.error(`Vui lòng nhập số lượng lỗi/mất lớn hơn 0 cho vật tư "${emptyItem.materialName}".`);
        return;
      }

      const overStockItem = damagedMaterials.find(m => m.quantityLost > m.stockQuantity);
      if (overStockItem) {
        toast.error(`Số lượng thiệt hại của "${overStockItem.materialName}" (${overStockItem.quantityLost}) không được vượt quá số lượng tồn kho hiện có (${overStockItem.stockQuantity}).`);
        return;
      }
    }

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
    const remaining = 5 - uploadedFiles.length;
    if (remaining <= 0) { toast.error('Đã đạt giới hạn tối đa 5 ảnh.'); return; }
    const MAX = 10 * 1024 * 1024;
    if (files.some(f => f.size > MAX)) { toast.error('Hình ảnh không được vượt quá 10MB.'); return; }
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, remaining);
    if (!valid.length) return;

    valid.forEach(file => {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);

      const newFileState: UploadedFileState = {
        id: tempId,
        name: file.name,
        url: localUrl,
        status: 'uploading'
      };

      setUploadedFiles(prev => [...prev, newFileState]);

      compressAndUploadFile(
        file,
        'incidents',
        (uploadedUrl) => {
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'success', url: uploadedUrl } : f)
          );
        },
        () => {
          toast.error(`Không thể tải ảnh ${file.name} lên.`);
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'error' } : f)
          );
        }
      );
    });
  };
  const removeImage = (id: string) => {
    setUploadedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target && target.url && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lập Báo cáo Sự cố Vật tư Kho " width="xl">

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
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Mất mát, hư hỏng khi chưa xuất dùng  - Giai đoạn: {phaseName}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minHeight: '510px' }}>
          <div className="flex flex-col gap-3">
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Phần 1: Thông tin Sự cố
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                  Loại sự cố vật tư <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                </label>
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'hsl(var(--bg-card))',
                  border: '1px solid hsl(var(--border))',
                  fontSize: '0.9rem',
                  color: 'hsl(210, 70%, 45%)',
                  fontWeight: 600,
                }}>
                  📦 Sự cố Vật tư Kho
                </div>
                <input type="hidden" {...register('incidentType')} value="InventoryLoss" />
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
                  style={{ resize: 'none' }}
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
                  max={getLocalISOString()}
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
                  onClick={() => { if (uploadedFiles.length < 5) document.getElementById('incident-img-input')?.click(); }}
                  style={{
                    border: `2px dashed ${dragging ? 'hsl(210, 70%, 45%)' : 'hsl(var(--border))'}`,
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    cursor: uploadedFiles.length >= 5 ? 'not-allowed' : 'pointer',
                    background: dragging ? 'hsl(210, 100%, 97%)' : 'hsl(var(--bg-card))',
                    opacity: uploadedFiles.length >= 5 ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  <input id="incident-img-input" type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} disabled={uploadedFiles.length >= 5} />
                  <UploadCloud size={24} style={{ color: 'hsl(var(--text-secondary))', margin: '0 auto 6px' }} />
                  <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', margin: '0 0 4px' }}>
                    Kéo thả hoặc click để chọn ảnh
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Đã chọn {uploadedFiles.length}/5 ảnh</span>
                </div>
                {uploadedFiles.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {uploadedFiles.map((file) => (
                      <div key={file.id} style={{ position: 'relative', width: 60, height: 60, borderRadius: 6, overflow: 'hidden', border: file.status === 'error' ? '1px solid #dc2626' : file.status === 'success' ? '1px solid #16a34a' : '1px solid hsl(var(--border))' }}>
                        <img src={file.url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                        {file.status === 'uploading' && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Loader2 size={12} className="animate-spin" style={{ color: '#fff' }} />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); removeImage(file.id); }}
                          style={{ position: 'absolute', top: 2, right: 2, background: '#dc2626', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
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
                      {loadingBOQ ? (
                        <div style={{ padding: '10px', textAlign: 'center', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                          <Loader2 size={14} className="animate-spin inline mr-1" />Đang tải danh sách vật tư ...
                        </div>
                      ) : boqItems.filter(item =>
                        item.materialCode.toLowerCase().includes(searchMaterial.toLowerCase()) ||
                        item.materialName.toLowerCase().includes(searchMaterial.toLowerCase())
                      ).slice(0, 20).map(item => (
                        <div key={item.materialId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid hsl(var(--border))', fontSize: '0.8rem' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{item.materialCode} - {item.materialName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>BOQ: {item.boqQuantity} {item.unitName} · Tồn kho hiện có: <span style={{ color: 'hsl(var(--primary))', fontWeight: 600 }}>{item.stockQuantity} {item.unitName}</span></div>
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
                      {!loadingBOQ && boqItems.length === 0 && (
                        <div style={{ padding: '10px', textAlign: 'center', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                          Không có vật tư nào vừa thuộc BOQ giai đoạn vừa có sẵn trong kho.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {damagedMaterials.length > 0 ? (
                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead style={{ textAlign: 'left' }}>
                        <tr>
                          <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: '8px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--bg-muted))' }}>Vật tư</th>
                          <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: '8px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--bg-muted))' }}>SL Lỗi/Mất</th>
                          <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: '8px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--bg-muted))', width: '40px' }}></th>
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
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="number"
                                    min={0.01}
                                    step="any"
                                    placeholder="Nhập SL..."
                                    className="input"
                                    style={{
                                      width: '90px',
                                      padding: '4px 8px',
                                      borderColor: (!m.quantityLost || m.quantityLost <= 0 || m.quantityLost > m.stockQuantity) ? '#dc2626' : undefined
                                    }}
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
                                {(!m.quantityLost || m.quantityLost <= 0) && (
                                  <span style={{ fontSize: '0.7rem', color: '#dc2626' }}>Vui lòng nhập SL &gt; 0</span>
                                )}
                                {m.quantityLost > m.stockQuantity && (
                                  <span style={{ fontSize: '0.7rem', color: '#dc2626' }}>Vượt tồn kho ({m.stockQuantity})</span>
                                )}
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
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border))', borderRadius: '6px' }}>
                    Chưa có vật tư nào được chọn.
                  </div>
                )}
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
