import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateDebtInputSchema, CreateDebtInput } from '@fintrack/shared';
import { useCreateDebt } from '../hooks/useDebts';
import { useAccounts } from '../../accounts/hooks/useAccounts';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { Select } from '../../../components/ui/Select';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDirection?: 'I_LENT' | 'I_BORROWED';
}

export function DebtModal({ isOpen, onClose, defaultDirection = 'I_LENT' }: DebtModalProps) {
  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.data ?? [];
  const createDebt = useCreateDebt();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateDebtInput>({
    resolver: zodResolver(CreateDebtInputSchema),
    defaultValues: {
      direction: defaultDirection,
      personName: '',
      personPhone: '',
      accountId: accounts[0]?.id ?? '',
      amount: '',
      dueDate: '',
      note: '',
    },
  });

  const selectedDirection = watch('direction');
  const amountValue = watch('amount');
  const accountIdValue = watch('accountId');

  const onSubmit = async (data: CreateDebtInput) => {
    try {
      await createDebt.mutateAsync(data);
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
      title="Yangi Qarz Qo‘shish"
      description="Qarz summasi va shaxs ma’lumotlarini kiriting. Ledgerda avtomatik tranzaksiya ochiladi."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        {/* Direction Switch */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/60 border border-border/50">
          <button
            type="button"
            onClick={() => setValue('direction', 'I_LENT')}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              selectedDirection === 'I_LENT'
                ? 'bg-success text-success-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Menga qarzdor (Men berdim)
          </button>
          <button
            type="button"
            onClick={() => setValue('direction', 'I_BORROWED')}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              selectedDirection === 'I_BORROWED'
                ? 'bg-warning text-warning-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Men qarzdorman (Men oldim)
          </button>
        </div>

        {/* Person Name & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Shaxs ismi *</label>
            <Input
              {...register('personName')}
              placeholder="Masalan: Jasur Karimov"
              error={errors.personName?.message}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Telefon raqami</label>
            <Input
              {...register('personPhone')}
              placeholder="+998 90 123 45 67"
              error={errors.personPhone?.message}
            />
          </div>
        </div>

        {/* Account & Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <label className="text-xs font-bold text-foreground">Summa *</label>
            <MoneyInput
              value={amountValue}
              onChange={(tiyinStr: string) => setValue('amount', tiyinStr)}
              placeholder="0"
              error={errors.amount?.message}
            />
          </div>
        </div>

        {/* Due Date & Note */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Qaytarish muddati</label>
            <Input type="date" {...register('dueDate')} error={errors.dueDate?.message} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Izoh</label>
            <Input {...register('note')} placeholder="Ixtiyoriy izoh..." error={errors.note?.message} />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" size="sm" loading={isSubmitting || createDebt.isPending}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
