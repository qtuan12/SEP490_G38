import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { FileCheck2, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button, Select } from '../../../components/ui';
import type { MaterialRequestProcurementDecision } from '../../../types/common';
import { MATERIAL_REQUEST_DECISION_OPTIONS } from '../materialRequestDecision';
import {
  materialRequestDecisionSchema,
  type MaterialRequestDecisionFormValues,
} from '../materialRequestDecisionSchema';
import './MaterialRequestDecisionForm.css';

interface MaterialRequestDecisionFormProps {
  requestId: string;
  onSubmitDecision: (
    requestId: string,
    decision: MaterialRequestProcurementDecision,
    note: string,
  ) => Promise<boolean>;
  onCompleted: () => void;
  onClose: () => void;
}

export const MaterialRequestDecisionForm = ({
  requestId,
  onSubmitDecision,
  onCompleted,
  onClose,
}: MaterialRequestDecisionFormProps) => {
  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<MaterialRequestDecisionFormValues>({
    resolver: zodResolver(materialRequestDecisionSchema),
    defaultValues: {
      decision: undefined,
      note: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: MaterialRequestDecisionFormValues) => onSubmitDecision(
      requestId,
      values.decision,
      values.note,
    ),
    onSuccess: succeeded => {
      if (succeeded) onCompleted();
    },
  });

  const selectableOptions = [
    { value: '', label: 'Chọn phương án xử lý', disabled: true },
    ...MATERIAL_REQUEST_DECISION_OPTIONS
      .filter(option => option.value !== 'NotApproved')
      .map(option => ({ value: option.value, label: option.label })),
  ];

  const handleReject = async () => {
    if (!await trigger('note')) return;
    mutation.mutate({
      decision: 'NotApproved',
      note: getValues('note'),
    });
  };

  return (
    <form
      className="material-request-decision-form"
      onSubmit={handleSubmit(values => mutation.mutate(values))}
    >
      <div className="material-request-decision-form__header">
        <h4 className="material-request-decision-form__title">Phương án xử lý</h4>
        <p className="material-request-decision-form__hint"></p>
      </div>

      <fieldset className="material-request-decision-form__fieldset">
        <Select
          options={selectableOptions}
          error={Boolean(errors.decision)}
          disabled={mutation.isPending}
          aria-label="Phương án xử lý"
          {...register('decision')}
        />
        {errors.decision && <p className="material-request-decision-form__error">{errors.decision.message}</p>}
      </fieldset>

      <div className="material-request-decision-form__field">
        <label className="material-request-decision-form__label" htmlFor="accountant-note">
          Ghi chú
        </label>
        <textarea
          id="accountant-note"
          className="material-request-decision-form__textarea"
          rows={3}
          maxLength={1000}
          disabled={mutation.isPending}
          placeholder=""
          {...register('note')}
        />
        {errors.note && <p className="material-request-decision-form__error">{errors.note.message}</p>}
      </div>

      <div className="material-request-decision-form__actions">
        <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
          Đóng chi tiết
        </Button>
        <div className="material-request-decision-form__actions-right">
          <Button type="button" variant="danger" onClick={handleReject} disabled={mutation.isPending}>
            <XCircle size={14} />
            Từ chối
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            <FileCheck2 size={14} />
            {mutation.isPending ? 'Đang lưu...' : 'Xác nhận'}
          </Button>
        </div>
      </div>
    </form>
  );
};
