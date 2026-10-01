import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SettleDebtInputSchema,
  SettleDebtInput,
  DebtResponse,
  formatMoney,
  todayLocalIso,
} from '@fintrack/shared';
import { useSettleDebt } from '../hooks/useDebts';
import { useAccounts } from '../../accounts/hooks/useAccounts';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

interface SettleDebtModalProps {
  debt: DebtResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SettleDebtModal({ debt, isOpen, onClose }: SettleDebtModalProps) {
  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.data ?? [];
  const settleDebt = useSettleDebt();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettleDebtInput>({
    resolver: zodResolver(SettleDebtInputSchema),
    defaultValues: {
      accountId: accounts[0]?.id ?? '',
      paidAt: todayLocalIso(),
      note: 'Qarz to‘liq yopildi',
    },
  });

  const accountIdValue = watch('accountId');
  // The select shows the default account before the user touches it; the form must hold it too.
  const defaultAccountId = (accounts.find((a) => a.isDefault) ?? accounts[0])?.id;
  useEffect(() => {
    if (isOpen && !accountIdValue && defaultAccountId) setValue('accountId', defaultAccountId);
  }, [isOpen, accountIdValue, defaultAccountId, setValue]);

  if (!debt) return null;

  const onSubmit = async (data: SettleDebtInput) => {
    try {
      await settleDebt.mutateAsync({ id: debt.id, data });
      reset();
      onClose();
    } catch {
      // Error handled in hook toast
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Qarzni To‘liq Yopish"
      description={`"${debt.personName}" qoldiq summasi: ${formatMoney(debt.remainingAmount)}. To‘lov amalga oshirilgach qarz statusi "To‘langan" ga o‘tadi.`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <Select
          label="Hisob *"
          value={accountIdValue || defaultAccountId || ''}
          onChange={(e) => setValue('accountId', e.target.value)}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.icon} ${a.name}`,
          }))}
          error={errors.accountId?.message}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Sana *"
            type="date"
            {...register('paidAt')}
            error={errors.paidAt?.message}
          />

          <Input label="Izoh" {...register('note')} error={errors.note?.message} />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="text-success hover:text-success"
            loading={isSubmitting || settleDebt.isPending}
          >
            To‘liq yopishni tasdiqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
