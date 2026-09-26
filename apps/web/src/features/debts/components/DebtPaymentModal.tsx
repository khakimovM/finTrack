import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateDebtPaymentInputSchema,
  CreateDebtPaymentInput,
  DebtResponse,
  formatMoney,
  formatIsoDate,
} from '@fintrack/shared';
import { useCreateDebtPayment } from '../hooks/useDebts';
import { useAccounts } from '../../accounts/hooks/useAccounts';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { Select } from '../../../components/ui/Select';

interface DebtPaymentModalProps {
  debt: DebtResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DebtPaymentModal({ debt, isOpen, onClose }: DebtPaymentModalProps) {
  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.data ?? [];
  const createPayment = useCreateDebtPayment();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateDebtPaymentInput>({
    resolver: zodResolver(CreateDebtPaymentInputSchema),
    defaultValues: {
      accountId: accounts[0]?.id ?? '',
      amount: '',
      paidAt: formatIsoDate(new Date()),
      note: '',
    },
  });

  if (!debt) return null;

  const amountValue = watch('amount');
  const accountIdValue = watch('accountId');

  const onSubmit = async (data: CreateDebtPaymentInput) => {
    try {
      await createPayment.mutateAsync({ id: debt.id, data });
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
      title="Qarzga To‘lov Kiritish"
      description={`"${debt.personName}" qarzi bo‘yicha to‘lov summasini kiriting. Joriy qoldiq: ${formatMoney(debt.remainingAmount)}`}
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

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground">To‘lov summasi *</label>
          <MoneyInput
            value={amountValue}
            onChange={(tiyinStr: string) => setValue('amount', tiyinStr)}
            placeholder="0"
            error={errors.amount?.message}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">To‘langan sana *</label>
            <Input type="date" {...register('paidAt')} error={errors.paidAt?.message} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Izoh</label>
            <Input {...register('note')} placeholder="Ixtiyoriy izoh..." error={errors.note?.message} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" size="sm" loading={isSubmitting || createPayment.isPending}>
            To‘lovni qabul qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
