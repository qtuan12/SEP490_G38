import React, { useEffect, useRef } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { materialService } from '../../../../services/materialService';
import { unitService } from '../../../../services/unitService';
import { Button, Input, Select, LoadingSpinner } from '../../../../components/ui';
import type { MaterialCatalog, MaterialConversionRequest } from '../../../../types/material';
import { X, Plus, Trash2, ArrowRightLeft, Save } from 'lucide-react';

interface ConversionFormData {
  conversions: MaterialConversionRequest[];
}

interface MaterialConversionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  material: MaterialCatalog | null;
  onSuccess: (message: string) => void;
}

export const MaterialConversionDrawer: React.FC<MaterialConversionDrawerProps> = ({ isOpen, onClose, material, onSuccess }) => {
  const queryClient = useQueryClient();
  const initializedMaterialIdRef = useRef<number | null>(null);

  const { data: unitsData } = useQuery({
    queryKey: ['units', 'all'],
    queryFn: () => unitService.getUnits({ pageNumber: 1, pageSize: 1000 }),
    enabled: isOpen,
  });

  const { data: conversions, isLoading: isLoadingConversions } = useQuery({
    queryKey: ['conversions', material?.materialId],
    queryFn: () => materialService.getConversions(material!.materialId),
    enabled: isOpen && !!material,
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, isDirty },
  } = useForm<ConversionFormData>({
    defaultValues: { conversions: [] },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'conversions',
  });



  const mutation = useMutation({
    mutationFn: async (data: ConversionFormData) => {
      return materialService.syncConversions(material!.materialId, data.conversions);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['conversions', material?.materialId] });
      onSuccess(result.message || `Đã đồng bộ tỷ lệ quy đổi cho ${material?.name}.`);
      onClose();
    },
  });

  useEffect(() => {
    if (!isOpen) {
      initializedMaterialIdRef.current = null;
      return;
    }

    const materialId = material?.materialId ?? null;
    const materialChanged = initializedMaterialIdRef.current !== materialId;
    if (isOpen) {
      mutation.reset();
    }
    if (isOpen && conversions && !isLoadingConversions) {
      if (!materialChanged && isDirty) return;
      reset({
        conversions: conversions.map(c => ({
          alternativeUnitId: c.alternativeUnitId,
          conversionRate: c.conversionRate,
        })),
      });
      initializedMaterialIdRef.current = materialId;
    }
  }, [isOpen, material?.materialId, conversions, isLoadingConversions, reset, isDirty]);

  const onSubmit = (data: ConversionFormData) => {
    mutation.mutate(data);
  };

  const unitOptions = unitsData?.items
    .filter(u => u.unitId !== material?.baseUnitId) // Cannot convert to base unit itself
    .map(u => ({ label: `${u.unitName} (${u.unitCode})`, value: u.unitId.toString() })) || [];

  if (!isOpen) return null;

  return (
    <>
      <div 
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50 }}
        onClick={onClose}
      />
      <div 
        style={{ 
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '500px',
          backgroundColor: 'hsl(var(--bg-card))', zIndex: 60, display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', animation: 'slideInRight 0.3s ease-out'
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={20} style={{ color: 'hsl(var(--primary))' }} />
              Tỷ lệ Quy đổi
            </h2>
            {material && (
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem', marginTop: '4px' }}>
                Vật tư: <strong style={{ color: 'hsl(var(--text-primary))' }}>{material.name}</strong> 
                <span style={{ margin: '0 8px', color: 'hsl(var(--border))' }}>|</span> 
                Đơn vị gốc: <strong style={{ color: 'hsl(var(--primary))' }}>{material.baseUnitName}</strong>
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {isLoadingConversions ? (
            <LoadingSpinner size="md" className="py-10" />
          ) : (
            <form id="conversion-form" onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {mutation.isError && (
                <div style={{ padding: '12px', fontSize: '0.875rem', color: 'hsl(var(--danger))', backgroundColor: 'hsl(var(--danger)/0.1)', borderRadius: '4px', border: '1px solid hsl(var(--danger)/0.2)' }}>
                  {(mutation.error as any)?.message || 'Có lỗi xảy ra khi lưu tỷ lệ quy đổi.'}
                </div>
              )}

              {fields.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border))', borderRadius: '8px' }}>
                  Chưa có tỷ lệ quy đổi nào được thiết lập.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid hsl(var(--border))', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase' }}>
                    <div>Đơn vị quy đổi</div>
                    <div>Tỷ lệ (1 Đơn vị Mới = ? Đơn vị Gốc)</div>
                    <div></div>
                  </div>
                  
                  {fields.map((field, index) => (
                    <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '12px', alignItems: 'center' }}>
                      <Select
                        options={[{ label: 'Chọn Đơn vị', value: '' }, ...unitOptions]}
                        value={watch(`conversions.${index}.alternativeUnitId`)?.toString() || ''}
                        onChange={(e) => setValue(
                          `conversions.${index}.alternativeUnitId`,
                          Number(e.target.value),
                          { shouldDirty: true },
                        )}
                        disabled={isSubmitting || mutation.isPending}
                        style={{ height: '36px' }}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...control.register(`conversions.${index}.conversionRate`, { valueAsNumber: true })}
                        placeholder="VD: 50"
                        disabled={isSubmitting || mutation.isPending}
                        style={{ height: '36px' }}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => remove(index)}
                        style={{ padding: '0', height: '36px', width: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'hsl(var(--danger))' }}
                        type="button"
                        title="Xóa quy đổi"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="secondary"
                type="button"
                onClick={() => append({ alternativeUnitId: 0, conversionRate: 0 })}
                style={{ marginTop: '8px', borderStyle: 'dashed' }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} /> Thêm Quy đổi
              </Button>
            </form>
          )}
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-main))', display: 'flex', gap: '12px' }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Hủy bỏ</Button>
          <Button 
            variant="primary" 
            onClick={handleSubmit(onSubmit)} 
            isLoading={isSubmitting || mutation.isPending}
            style={{ flex: 1, backgroundColor: 'hsl(var(--success))', color: 'white' }}
          >
            <Save size={16} style={{ marginRight: '6px' }} /> Đồng bộ Lưu
          </Button>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </>
  );
};
