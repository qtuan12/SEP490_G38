import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { FileCheck2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '../../../components/ui';
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
}

export const MaterialRequestDecisionForm = ({
  requestId,
  onSubmitDecision,
  onCompleted,
}: MaterialRequestDecisionFormProps) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<MaterialRequestDecisionFormValues>({
    resolver: zodResolver(materialRequestDecisionSchema),
    defaultValues: {
      decision: undefined,
      note: '',
    },
  });

  const selectedDecision = useWatch({ control, name: 'decision' });
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

  return (
    <form
      className="material-request-decision-form"
      onSubmit={handleSubmit(values => mutation.mutate(values))}
    >
      <div className="material-request-decision-form__header">
        <h4 className="material-request-decision-form__title">Ý kiến</h4>
        <p className="material-request-decision-form__hint"></p>
      </div>

      <fieldset className="material-request-decision-form__fieldset">
        <div className="material-request-decision-form__options">
          {MATERIAL_REQUEST_DECISION_OPTIONS.map(option => (
            <label
              key={option.value}
              className={`material-request-decision-form__option${selectedDecision === option.value ? ' material-request-decision-form__option--selected' : ''}`}
            >
              <input
                type="radio"
                value={option.value}
                disabled={mutation.isPending}
                {...register('decision')}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
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
        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          <FileCheck2 size={14} />
          {mutation.isPending ? 'Đang lưu...' : 'Xác nhận'}
        </Button>
      </div>
    </form>
  );
};
