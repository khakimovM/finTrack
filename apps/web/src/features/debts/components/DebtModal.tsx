import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { CreateDebtInput, CreateDebtInputSchema, DebtResponse, UpdateDebtInput, todayLocalIso } from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { Segmented } from '../../../components/ui/Segmented';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Textarea } from '../../../components/ui/Textarea';
import { ChoiceGrid } from '../../../components/ui/ChoiceGrid';
import { formatAmount } from '../../../lib/money';
import { apiErrorCode, apiErrorToMessage } from '../../../lib/apiError';
import { useInitOnOpen } from '../../../lib/useInitOnOpen';
import { useAccounts } from '../../accounts/hooks/useAccounts';
import { useCreateDebt, useUpdateDebt } from '../hooks/useDebts';
import { t } from '../../../lib/i18n';

export interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDirection?: 'I_LENT' | 'I_BORROWED';
  /** Edit this debt: only the person, the due date and the note can change. */
  debt?: DebtResponse | null;
}



export function DebtModal({ isOpen, onClose, defaultDirection = 'I_LENT', debt = null }: DebtModalProps) {
  const editing = debt !== null;
  const today = todayLocalIso();
  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.data ?? [];
  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch, formState } = useForm<CreateDebtInput>({
    resolver: zodResolver(CreateDebtInputSchema),
    defaultValues: { direction: defaultDirection, personName: '', personPhone: '', accountId: '', amount: '', dueDate: '', note: '' },
  });

  useInitOnOpen(isOpen, accountsData !== undefined, () => {
    setServerError(null);
    const account = accounts.find((a) => a.isDefault) ?? accounts[0];
    reset({
      direction: debt?.direction ?? defaultDirection,
      personName: debt?.personName ?? '',
      personPhone: debt?.personPhone ?? '',
      // Editing never sends these two; they only satisfy the create schema.
      accountId: account?.id ?? '00000000-0000-4000-8000-000000000000',
      amount: debt?.amount ?? '',
      dueDate: debt?.dueDate ?? '',
      note: debt?.note ?? '',
    });
  });

  const direction = watch('direction');

  const onSubmit = async (data: CreateDebtInput) => {
    setServerError(null);
    try {
      if (debt) {
        const patch: UpdateDebtInput = {};
        if (data.personName !== debt.personName) patch.personName = data.personName;
        if ((data.personPhone || null) !== debt.personPhone) patch.personPhone = data.personPhone || null;
        if ((data.dueDate || null) !== debt.dueDate) patch.dueDate = data.dueDate || null;
        if ((data.note || null) !== debt.note) patch.note = data.note || null;
        if (Object.keys(patch).length > 0) await updateDebt.mutateAsync({ id: debt.id, data: patch });
      } else {
        await createDebt.mutateAsync({ ...data, note: data.note || undefined });
      }
      onClose();
    } catch (err) {
      setServerError(apiErrorCode(err) === 'INSUFFICIENT_BALANCE' ? t('transactions.form.strict') : apiErrorToMessage(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? t('debts.form.titleEdit') : t('debts.form.titleNew')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="debt-form" loading={formState.isSubmitting}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="debt-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]" noValidate>
        {!editing && (
          <Controller
            name="direction"
            control={control}
            render={({ field }) => (
              <Segmented
                aria-label={t('debts.form.direction')}
                size="lg"
                fullWidth
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'I_LENT', label: t('debts.lent'), tone: 'debt' },
                  { value: 'I_BORROWED', label: t('debts.borrowed'), tone: 'debt' },
                ]}
              />
            )}
          />
        )}
        <Controller
          name="personName"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              {...field}
              label={t('debts.form.person')}
              placeholder={t('debts.form.personPlaceholder')}
              maxLength={100}
              showCounter
              autoFocus={!editing}
              error={fieldState.error ? t('debts.form.personRequired') : undefined}
            />
          )}
        />
        <Controller
          name="personPhone"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              {...field}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value.replace(/[^\d+ ]/g, ''))}
              type="tel"
              inputMode="tel"
              label={t('debts.form.phone')}
              placeholder="+998 90 123 45 67"
              maxLength={17}
              error={fieldState.error ? t('debts.form.phoneInvalid') : undefined}
            />
          )}
        />
        {editing && debt ? (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-text-secondary">{t('debts.form.fixed')}</span>
            <dl className="flex flex-col rounded-md border border-border bg-surface px-3.5 py-1">
              {[
                [t('debts.form.direction'), debt.direction === 'I_LENT' ? t('debts.lent') : t('debts.borrowed')],
                [t('transactions.form.amount'), formatAmount(debt.amount)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-border py-2.5 text-[14px] last:border-b-0">
                  <dt className="text-text-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[12.5px] leading-[17px] text-text-muted">{t('debts.form.fixedHint')}</p>
          </div>
        ) : (
          <>
            <Controller
              name="accountId"
              control={control}
              render={({ field }) => (
                <ChoiceGrid
                  label={t('transactions.form.account')}
                  columns={2}
                  phoneColumns={1}
                  value={field.value}
                  onChange={field.onChange}
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: a.name,
                    emoji: a.icon,
                    color: a.color,
                    sub: formatAmount(a.balance, { sign: 'negative' }),
                  }))}
                />
              )}
            />
            <Controller
              name="amount"
              control={control}
              render={({ field, fieldState }) => (
                <MoneyInput
                  label={t('transactions.form.amount')}
                  size="md"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error ? t('transactions.form.amountError') : undefined}
                />
              )}
            />
          </>
        )}
        <Controller
          name="dueDate"
          control={control}
          render={({ field }) => (
            <DatePicker
              label={t('debts.form.dueDate')}
              value={field.value ?? ''}
              onChange={field.onChange}
              chips={['none']}
              placeholder={t('debts.due.none')}
              min={editing ? undefined : today}
              today={today}
            />
          )}
        />
        <Controller
          name="note"
          control={control}
          render={({ field }) => (
            <Textarea
              label={t('debts.form.note')}
              placeholder={t('debts.form.notePlaceholder')}
              maxLength={500}
              value={field.value ?? ''}
              onChange={field.onChange}
            />
          )}
        />
        {!editing && (
          <p className="flex gap-2.5 rounded-md bg-info-soft px-3.5 py-3 text-info">
            <Info className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="text-pretty text-[13.5px] font-medium leading-[19px] text-text">
              {direction === 'I_LENT'
                ? t('debts.form.lentHint')
                : t('debts.form.borrowedHint')}
            </span>
          </p>
        )}
        {serverError && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
