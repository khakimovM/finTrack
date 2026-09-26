import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SettleDebtInputSchema,
  SettleDebtInput,
  DebtResponse,
  formatMoney,
  formatIsoDate,
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
      paidAt: formatIsoDate(new Date()),
      note: 'Qarz to‘liq yopildi',
    },
  });

  if (!debt) return null;

  const accountIdValue = watch('accountId');

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
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground">Hisob *</label>
          <Select
            value={accountIdValue || accounts[0]?.id || ''}
            onChange={(e) => setValue('accountId', e.target.value)}
            options={accounts.map((a) => ({
              value: a.id,
              label: `${a.icon} ${a.name}`,
            }))}
            error={errors.accountId?.message}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Sana *</label>
            <Input type="date" {...register('paidAt')} error={errors.paidAt?.message} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Izoh</label>
            <Input {...register('note')} error={errors.note?.message} />
          </div>
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
