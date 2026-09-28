import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  RecurringRuleResponse,
  UpdateRecurringRuleInput,
  UpdateRecurringRuleInputSchema,
} from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { useUpdateRecurringRule } from '../hooks/useRecurring';
import { DayOfCycleSelect } from './DayOfCycleSelect';
import { hasDayOfCycle, scheduleLabel } from '../recurringLabels';

export interface RecurringEditModalProps {
  rule: RecurringRuleResponse | null;
  onClose: () => void;
}

function valuesOf(rule: RecurringRuleResponse | null): UpdateRecurringRuleInput {
  return {
    amount: rule?.amount ?? '',
    dayOfCycle: rule?.dayOfCycle ?? null,
    endsAt: rule?.endsAt ?? '',
  };
}

/** Amount, day and end date. Type, account and frequency define the rule: create a new one instead. */
export function RecurringEditModal({ rule, onClose }: RecurringEditModalProps) {
  const updateRule = useUpdateRecurringRule();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<UpdateRecurringRuleInput>({
    resolver: zodResolver(UpdateRecurringRuleInputSchema),
    defaultValues: valuesOf(rule),
  });

  useEffect(() => {
    reset(valuesOf(rule));
  }, [rule, reset]);

  if (!rule) return null;

  const onSubmit = async (data: UpdateRecurringRuleInput) => {
    // Only what changed: sending the day again would restart the schedule from today.
    const changes: UpdateRecurringRuleInput = {};
    if (dirtyFields.amount) changes.amount = data.amount;
    if (dirtyFields.dayOfCycle) changes.dayOfCycle = data.dayOfCycle;
    if (dirtyFields.endsAt) changes.endsAt = data.endsAt;
    if (Object.keys(changes).length > 0)
      await updateRule.mutateAsync({ id: rule.id, data: changes });
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Takroriy to‘lovni tahrirlash"
      description={scheduleLabel(rule)}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <MoneyInput
              label="Summa"
              value={field.value}
              onChange={field.onChange}
              error={errors.amount?.message}
            />
          )}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {hasDayOfCycle(rule.frequency) && (
            <DayOfCycleSelect
              frequency={rule.frequency}
              error={errors.dayOfCycle?.message}
              {...register('dayOfCycle', { setValueAs: Number })}
            />
          )}
          <Input
            type="date"
            label="Tugash (ixtiyoriy)"
            error={errors.endsAt?.message}
            {...register('endsAt')}
          />
        </div>

        {hasDayOfCycle(rule.frequency) && (
          <p className="text-xs text-muted-foreground">
            Kun o‘zgarsa, jadval bugundan boshlab qayta hisoblanadi.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border/80 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
