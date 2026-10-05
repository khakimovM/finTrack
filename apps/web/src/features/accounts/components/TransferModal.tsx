import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowDownUp, ArrowLeftRight } from 'lucide-react';
import { CreateTransferInput, CreateTransferInputSchema, todayLocalIso } from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Textarea } from '../../../components/ui/Textarea';
import { AccountPicker } from '../../../components/ui/EntityPickers';
import { useInitOnOpen } from '../../../lib/useInitOnOpen';
import { apiErrorToMessage } from '../../../lib/apiError';
import { formatAmount } from '../../../lib/money';
import { useAccounts } from '../hooks/useAccounts';
import { useCreateTransfer } from '../../transfers/hooks/useTransfers';

export interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFromAccountId?: string;
}

export function TransferModal({ isOpen, onClose, defaultFromAccountId }: TransferModalProps) {
  const { data: accountsData } = useAccounts();
  const createTransfer = useCreateTransfer();
  const accounts = accountsData?.data ?? [];
  const today = todayLocalIso();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, setValue, getValues, reset, watch, formState } = useForm<CreateTransferInput>({
    resolver: zodResolver(CreateTransferInputSchema),
    defaultValues: { fromAccountId: '', toAccountId: '', amount: '', date: today, note: '' },
  });

  useInitOnOpen(isOpen, accountsData !== undefined, () => {
    setServerError(null);
    const from = accounts.find((a) => a.id === defaultFromAccountId) ?? accounts.find((a) => a.isDefault) ?? accounts[0];
    const to = accounts.find((a) => a.id !== from?.id);
    reset({ fromAccountId: from?.id ?? '', toAccountId: to?.id ?? '', amount: '', date: today, note: '' });
  });

  const fromAccountId = watch('fromAccountId');
  const toAccountId = watch('toAccountId');
  const amount = watch('amount');
  const same = fromAccountId !== '' && fromAccountId === toAccountId;
  const from = accounts.find((a) => a.id === fromAccountId);
  const to = accounts.find((a) => a.id === toAccountId);

  const swap = () => {
    const { fromAccountId: a, toAccountId: b } = getValues();
    setValue('fromAccountId', b);
    setValue('toAccountId', a);
  };

  const onSubmit = async (data: CreateTransferInput) => {
    if (data.fromAccountId === data.toAccountId) return;
    setServerError(null);
    try {
      await createTransfer.mutateAsync({ ...data, note: data.note || undefined });
      onClose();
    } catch (err) {
      setServerError(apiErrorToMessage(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hisoblararo o‘tkazma"
      description="Bir hisobingizdan boshqasiga pul o‘tkazish"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
            Bekor qilish
          </Button>
          <Button type="submit" form="transfer-form" loading={formState.isSubmitting} disabled={same}>
            <ArrowLeftRight className="h-4 w-4" aria-hidden />
            O‘tkazish
          </Button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]" noValidate>
        <div className="flex flex-col gap-1.5">
          <Controller
            name="fromAccountId"
            control={control}
            render={({ field }) => (
              <AccountPicker label="Qayerdan" accounts={accounts} value={field.value} onChange={field.onChange} />
            )}
          />
          <div className="-mb-1.5 mt-0.5 flex justify-center">
            <button
              type="button"
              onClick={swap}
              aria-label="Hisoblarni almashtirish"
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-text shadow-xs transition-colors duration-fast hover:bg-secondary"
            >
              <ArrowDownUp className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </div>
          <Controller
            name="toAccountId"
            control={control}
            render={({ field }) => (
              <AccountPicker
                label="Qayerga"
                accounts={accounts}
                value={field.value}
                onChange={field.onChange}
                disabledId={same ? undefined : fromAccountId}
                invalid={same}
              />
            )}
          />
          {same && (
            <p role="alert" className="flex items-center gap-1.5 text-[13px] font-medium leading-[18px] text-danger">
              <AlertCircle className="h-[15px] w-[15px] shrink-0" aria-hidden />
              Jo‘natuvchi va qabul qiluvchi hisob bir xil bo‘lishi mumkin emas
            </p>
          )}
        </div>
        <Controller
          name="amount"
          control={control}
          render={({ field, fieldState }) => (
            <MoneyInput
              label="Summa"
              size="lg"
              autoFocus
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error ? 'Summa 0 dan katta bo‘lishi kerak' : undefined}
            />
          )}
        />
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <DatePicker label="Sana" value={field.value} onChange={field.onChange} chips={['today', 'yesterday']} max={today} today={today} />
          )}
        />
        <Controller
          name="note"
          control={control}
          render={({ field }) => (
            <Textarea
              label="Izoh (ixtiyoriy)"
              placeholder="Masalan: Kartani to‘ldirish"
              maxLength={500}
              value={field.value ?? ''}
              onChange={field.onChange}
            />
          )}
        />
        {from && to && !same && (
          <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3.5 py-3 text-[14px] font-medium">
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
            <span className="text-pretty">
              {from.name} → {to.name} · {formatAmount(/^\d+$/.test(amount) ? amount : '0')}
            </span>
          </div>
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
