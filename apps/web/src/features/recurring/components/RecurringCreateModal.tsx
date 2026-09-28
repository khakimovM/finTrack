import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateRecurringRuleInput,
  CreateRecurringRuleInputSchema,
  todayLocalIso,
} from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { useAccounts } from '../../accounts/hooks/useAccounts';
import { useCategories } from '../../categories/hooks/useCategories';
import { categoryOptions } from '../../categories/categoryOptions';
import { EntryType, EntryTypeToggle } from '../../transactions/components/EntryTypeToggle';
import { useCreateRecurringRule } from '../hooks/useRecurring';
import { DayOfCycleSelect } from './DayOfCycleSelect';
import { FREQUENCY_OPTIONS, hasDayOfCycle } from '../recurringLabels';

export interface RecurringCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function defaults(): CreateRecurringRuleInput {
  const today = todayLocalIso();
  return {
    type: 'EXPENSE',
    amount: '',
    accountId: '',
    categoryId: '',
    frequency: 'MONTHLY',
    dayOfCycle: Number(today.slice(8, 10)),
    startsAt: today,
    endsAt: '',
    note: '',
  };
}

export function RecurringCreateModal({ isOpen, onClose }: RecurringCreateModalProps) {
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const createRule = useCreateRecurringRule();
  const accounts = accountsData?.data ?? [];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateRecurringRuleInput>({
    resolver: zodResolver(CreateRecurringRuleInputSchema),
    defaultValues: defaults(),
  });
  const type = watch('type');
  const frequency = watch('frequency');
  const categories = categoryOptions(categoriesData ?? [], type);

  useEffect(() => {
    if (!isOpen) return;
    reset(defaults());
    const account = accounts.find((a) => a.isDefault) ?? accounts[0];
    if (account) setValue('accountId', account.id);
    setValue('categoryId', categoryOptions(categoriesData ?? [], 'EXPENSE')[0]?.id ?? '');
  }, [isOpen, accounts.length, categoriesData?.length]);

  const changeType = (next: EntryType) => {
    setValue('type', next);
    setValue('categoryId', categoryOptions(categoriesData ?? [], next)[0]?.id ?? '');
  };

  const onSubmit = async (data: CreateRecurringRuleInput) => {
    await createRule.mutateAsync({
      ...data,
      dayOfCycle: hasDayOfCycle(data.frequency) ? data.dayOfCycle : null,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Yangi takroriy to‘lov"
      description="Oylik, ijara, obuna kabi muntazam kirim yoki chiqim"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <EntryTypeToggle value={type} onChange={changeType} />

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
          <Select label="Hisob" error={errors.accountId?.message} {...register('accountId')}>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.icon} {acc.name}
              </option>
            ))}
          </Select>
          <Select label="Kategoriya" error={errors.categoryId?.message} {...register('categoryId')}>
            <option value="">— Kategoriyasiz —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Takrorlanish" options={FREQUENCY_OPTIONS} {...register('frequency')} />
          {hasDayOfCycle(frequency) && (
            <DayOfCycleSelect
              frequency={frequency}
              error={errors.dayOfCycle?.message}
              {...register('dayOfCycle', { setValueAs: Number })}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            type="date"
            label="Boshlanish"
            error={errors.startsAt?.message}
            {...register('startsAt')}
          />
          <Input
            type="date"
            label="Tugash (ixtiyoriy)"
            error={errors.endsAt?.message}
            {...register('endsAt')}
          />
        </div>

        <Input
          type="text"
          label="Izoh (ixtiyoriy)"
          placeholder="Masalan: Kvartira ijarasi"
          error={errors.note?.message}
          {...register('note')}
        />

        <p className="text-xs text-muted-foreground">
          O‘tgan sanalar uchun to‘lov yozilmaydi. Birinchi to‘lov kuni bugun bo‘lsa, u darhol
          yoziladi.
        </p>

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
