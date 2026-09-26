import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateTransferInput,
  CreateTransferInputSchema,
  formatIsoDate,
  formatMoney,
} from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { useAccounts } from '../hooks/useAccounts';
import { useCreateTransfer } from '../../transfers/hooks/useTransfers';
import { ArrowRightLeft } from 'lucide-react';

export interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFromAccountId?: string;
}

export function TransferModal({
  isOpen,
  onClose,
  defaultFromAccountId,
}: TransferModalProps) {
  const { data: accountsData } = useAccounts();
  const createTransfer = useCreateTransfer();
  const accounts = accountsData?.data ?? [];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTransferInput>({
    resolver: zodResolver(CreateTransferInputSchema),
    defaultValues: {
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      date: formatIsoDate(new Date()),
      note: '',
    },
  });

  const fromAccountId = watch('fromAccountId');
  const toAccountId = watch('toAccountId');

  useEffect(() => {
    if (isOpen && accounts.length >= 2) {
      const from = defaultFromAccountId ?? accounts[0].id;
      const to = accounts.find((a) => a.id !== from)?.id ?? accounts[1].id;
      setValue('fromAccountId', from);
      setValue('toAccountId', to);
      setValue('date', formatIsoDate(new Date()));
    }
  }, [isOpen, defaultFromAccountId, accounts, setValue]);

  const onSubmit = async (data: CreateTransferInput) => {
    if (data.fromAccountId === data.toAccountId) {
      setError('toAccountId', {
        message: 'Jo‘natuvchi va qabul qiluvchi hisob bir xil bo‘lishi mumkin emas',
      });
      return;
    }
    await createTransfer.mutateAsync(data);
    reset();
    onClose();
  };

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hisoblararo o‘tkazma"
      description="Bir hisobingizdan boshqasiga pul o‘tkazish"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* From / To Accounts */}
        <div className="space-y-3">
          <Select
            label="Qayerdan (Chiqim hisobi)"
            error={errors.fromAccountId?.message}
            {...register('fromAccountId')}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.icon} {acc.name} ({formatMoney(acc.balance)})
              </option>
            ))}
          </Select>

          <div className="flex justify-center -my-1">
            <div className="h-8 w-8 rounded-full bg-muted/60 border border-border flex items-center justify-center text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
          </div>

          <Select
            label="Qayerga (Kirim hisobi)"
            error={errors.toAccountId?.message}
            {...register('toAccountId')}
          >
            {accounts
              .filter((acc) => acc.id !== fromAccountId)
              .map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.icon} {acc.name} ({formatMoney(acc.balance)})
                </option>
              ))}
          </Select>
        </div>

        {/* Amount */}
        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <MoneyInput
              label="O‘tkazma summasi"
              value={field.value}
              onChange={field.onChange}
              error={errors.amount?.message}
            />
          )}
        />

        {/* Date and Note */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="date"
            label="Sana"
            error={errors.date?.message}
            {...register('date')}
          />
          <Input
            type="text"
            label="Izoh (ixtiyoriy)"
            placeholder="Masalan: Kartani to‘ldirish"
            error={errors.note?.message}
            {...register('note')}
          />
        </div>

        {/* Summary pill */}
        {fromAccount && toAccount && (
          <div className="p-3 rounded-xl bg-accent/40 border border-border/60 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {fromAccount.name} → {toAccount.name}
            </span>
            <span className="font-semibold text-foreground">Ichki o‘tkazma</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting}>
            O‘tkazish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
