import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateTransactionInput,
  CreateTransactionInputSchema,
  todayLocalIso,
} from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { useAccounts } from '../../accounts/hooks/useAccounts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useCreateTransaction } from '../hooks/useTransactions';
import { categoryOptions } from '../../categories/categoryOptions';
import { EntryTypeToggle } from './EntryTypeToggle';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'INCOME' | 'EXPENSE';
}

export function TransactionModal({
  isOpen,
  onClose,
  defaultType = 'EXPENSE',
}: TransactionModalProps) {
  const [activeType, setActiveType] = useState<'INCOME' | 'EXPENSE'>(defaultType);
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const createTransaction = useCreateTransaction();

  const accounts = accountsData?.data ?? [];
  const allCategories = categoriesData ?? [];

  const filteredCategories = categoryOptions(allCategories, activeType);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTransactionInput>({
    resolver: zodResolver(CreateTransactionInputSchema),
    defaultValues: {
      type: defaultType,
      accountId: '',
      amount: '',
      categoryId: '',
      date: todayLocalIso(),
      note: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      setActiveType(defaultType);
      setValue('type', defaultType);
      if (accounts.length > 0) {
        const defaultAcc = accounts.find((a) => a.isDefault) ?? accounts[0];
        setValue('accountId', defaultAcc.id);
      }
      if (filteredCategories.length > 0) {
        setValue('categoryId', filteredCategories[0].id);
      }
    }
  }, [isOpen, defaultType, accounts.length]);

  const handleTypeChange = (type: 'INCOME' | 'EXPENSE') => {
    setActiveType(type);
    setValue('type', type);
    const newCats = allCategories.filter((c) => c.type === type);
    if (newCats.length > 0) {
      setValue('categoryId', newCats[0].id);
    } else {
      setValue('categoryId', '');
    }
  };

  const onSubmit = async (data: CreateTransactionInput) => {
    await createTransaction.mutateAsync(data);
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Yangi tranzaksiya"
      description="Kirim yoki chiqim operatsiyasini qayd etish"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <EntryTypeToggle value={activeType} onChange={handleTypeChange} />

        {/* Amount Input */}
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

        {/* Account and Category selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Hisob"
            error={errors.accountId?.message}
            {...register('accountId')}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.icon} {acc.name}
              </option>
            ))}
          </Select>

          <Select
            label="Kategoriya"
            error={errors.categoryId?.message}
            {...register('categoryId')}
          >
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </div>

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
            placeholder="Masalan: Bozorlik, oylik..."
            error={errors.note?.message}
            {...register('note')}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
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
