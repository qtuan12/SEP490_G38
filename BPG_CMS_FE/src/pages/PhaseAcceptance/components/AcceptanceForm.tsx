import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import MDEditor from '@uiw/react-md-editor';
import rehypeSanitize from 'rehype-sanitize';
import { phaseAcceptanceService } from '../../../services/phaseAcceptanceService';
import type { WBSPhase } from '../../../types/common';
import { Lock } from 'lucide-react';

const acceptanceSchema = z.object({
  reportContent: z.string().min(20, 'Vui lòng nhập nội dung báo cáo chi tiết (ít nhất 20 ký tự)')
});

type AcceptanceFormData = z.infer<typeof acceptanceSchema>;

interface AcceptanceFormProps {
  phase: WBSPhase;
  allCompleted: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onPhaseUpdated: () => void;
}

export const AcceptanceForm: React.FC<AcceptanceFormProps> = ({
  phase,
  allCompleted,
  onSuccess,
  onError,
  onPhaseUpdated
}) => {
  const { control, handleSubmit, formState: { errors } } = useForm<AcceptanceFormData>({
    resolver: zodResolver(acceptanceSchema),
    defaultValues: {
      reportContent: ''
    }
  });

  const acceptMutation = useMutation({
    mutationFn: async (data: AcceptanceFormData) => {
      await phaseAcceptanceService.acceptPhase({
        phaseId: Number(phase.id),
        reportContent: data.reportContent
      });
      return data;
    },
    onSuccess: () => {
      onSuccess('Đã nghiệm thu giai đoạn và đóng băng Phase thành công!');
      onPhaseUpdated();
    },
    onError: (err: any) => {
      onError(err.message || 'Có lỗi xảy ra khi nghiệm thu.');
    }
  });

  const onSubmitForm = (data: AcceptanceFormData) => {
    acceptMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)} className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-bold border-b border-[hsl(var(--border))] pb-2 m-0 text-[hsl(var(--text-primary))]">
          Nội dung Báo cáo Nghiệm thu
        </h3>

      </div>

      <div className="bg-white rounded-md border border-[hsl(var(--border))]" data-color-mode="light">
        <Controller
          name="reportContent"
          control={control}
          render={({ field }) => (
            <MDEditor
              value={field.value}
              onChange={(val: any) => field.onChange(val || '')}
              previewOptions={{
                rehypePlugins: [[rehypeSanitize]],
              }}
              height={300}
              className="w-full"
            />
          )}
        />
        {errors.reportContent && (
          <span className="text-[hsl(var(--danger))] text-sm px-3 block mt-2">
            {errors.reportContent.message}
          </span>
        )}
      </div>

      <div className="flex gap-3 justify-end mt-4">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!allCompleted || acceptMutation.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Lock size={16} />
          <span>{acceptMutation.isPending ? 'Đang xử lý...' : 'Xác nhận & Đóng băng Phase'}</span>
        </button>
      </div>
    </form>
  );
};
