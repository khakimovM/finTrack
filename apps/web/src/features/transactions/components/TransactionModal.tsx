import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownLeft, ArrowUpRight, ShieldAlert } from 'lucide-react';
import {
  CreateTransactionInput,
  CreateTransactionInputSchema,
  TransactionResponse,
  UpdateTransactionInput,
  todayLocalIso,
} from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { Segmented } from '../../../components/ui/Segmented';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Textarea } from '../../../components/ui/Textarea';
import { AccountPicker, CategoryPicker } from '../../../components/ui/EntityPickers';
import { apiErrorCode, apiErrorToMessage } from '../../../lib/apiError';
import { useInitOnOpen } from '../../../lib/useInitOnOpen';
import { useAuthStore } from '../../../stores/authStore';
import { useAccounts } from '../../accounts/hooks/useAccounts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useCreateTransaction, useUpdateTransaction } from '../hooks/useTransactions';
import { TagPicker } from './TagPicker';

type EntryType = 'INCOME' | 'EXPENSE';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: EntryType;
  /** Edit this income or expense instead of creating one. */
  transaction?: TransactionResponse | null;
}

const STRICT_MESSAGE = 'Hisobda yetarli mablag‘ yo‘q (Qatʼiy rejim)';

/** Create or edit an income or expense. Transfers and debt rows are never edited here. */
export function TransactionModal({ isOpen, onClose, defaultType = 'EXPENSE', transaction = null }: TransactionModalProps) {
  const editing = transaction !== null;
  const user = useAuthStore((s) => s.user);
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const [serverError, setServerError] = useState<string | null>(null);

  const accounts = accountsData?.data ?? [];
  const categories = categoriesData ?? [];
  const today = todayLocalIso();

  const { control, handleSubmit, setValue, getValues, reset, watch, formState } = useForm<CreateTransactionInput>({
    resolver: zodResolver(CreateTransactionInputSchema),
    defaultValues: { type: defaultType, accountId: '', amount: '', categoryId: '', date: today, note: '', tagIds: [] },
  });

  const firstCategoryOf = (type: EntryType) => categories.find((c) => c.type === type)?.id ?? '';

  useInitOnOpen(isOpen, accountsData !== undefined && categoriesData !== undefined, () => {
    setServerError(null);
    if (transaction) {
      reset({
        type: transaction.type as EntryType,
        accountId: transaction.account.id,
        amount: transaction.amount,
        categoryId: transaction.category?.id ?? '',
        date: transaction.date,
        note: transaction.note ?? '',
        tagIds: transaction.tags.map((t) => t.id),
      });
      return;
    }
    const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];
    // From defaultType, not the form: it still holds the previous opening's type here, and an
    // income category on an expense is rejected by the API.
    reset({
      type: defaultType,
      accountId: defaultAccount?.id ?? '',
      amount: '',
      categoryId: firstCategoryOf(defaultType),
      date: today,
      note: '',
      tagIds: [],
    });
  });

  const type = watch('type') as EntryType;
  const accountId = watch('accountId');
  const amount = watch('amount');
  const account = accounts.find((a) => a.id === accountId);

  // Strict mode: an expense may not take an account below zero. When editing an expense on the
  // same account, its old amount is already out of the balance.
  let available = account ? BigInt(account.balance) : 0n;
  if (transaction?.type === 'EXPENSE' && transaction.account.id === accountId) available += BigInt(transaction.amount);
  const overdraft =
    Boolean(user?.strictMode) && type === 'EXPENSE' && account !== undefined && /^\d+$/.test(amount) && BigInt(amount) > available;
  const strictError = overdraft ? STRICT_MESSAGE : serverError === STRICT_MESSAGE ? STRICT_MESSAGE : null;

  const changeType = (next: EntryType) => {
    setValue('type', next);
    const current = categories.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.id === getValues('categoryId'));
    if (!current || current.type !== next) setValue('categoryId', firstCategoryOf(next));
  };

  const onSubmit = async (data: CreateTransactionInput) => {
    setServerError(null);
    try {
      if (transaction) {
        const patch: UpdateTransactionInput = {};
        if (data.type !== transaction.type) patch.type = data.type as EntryType;
        if (data.amount !== transaction.amount) patch.amount = data.amount;
        if (data.accountId !== transaction.account.id) patch.accountId = data.accountId;
        if (data.categoryId !== (transaction.category?.id ?? '')) patch.categoryId = data.categoryId;
        if (data.date !== transaction.date) patch.date = data.date;
        if ((data.note ?? '') !== (transaction.note ?? '')) patch.note = data.note || null;
        const tagIds = data.tagIds ?? [];
        const before = transaction.tags.map((t) => t.id);
        if (tagIds.length !== before.length || tagIds.some((id) => !before.includes(id))) patch.tagIds = tagIds;
        if (Object.keys(patch).length > 0) await updateTransaction.mutateAsync({ id: transaction.id, data: patch });
      } else {
        await createTransaction.mutateAsync({ ...data, note: data.note || undefined });
      }
      onClose();
    } catch (err) {
      setServerError(apiErrorCode(err) === 'INSUFFICIENT_BALANCE' ? STRICT_MESSAGE : apiErrorToMessage(err));
    }
  };

  const categoryTree = categories.filter((c) => c.type === type);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Tranzaksiyani tahrirlash' : 'Yangi tranzaksiya'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
            Bekor qilish
          </Button>
          <Button type="submit" form="transaction-form" loading={formState.isSubmitting} disabled={Boolean(strictError)}>
            Saqlash
          </Button>
        </>
      }
    >
      <form id="transaction-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]" noValidate>
        <Segmented
          aria-label="Tur"
          size="lg"
          fullWidth
          value={type}
          onChange={changeType}
          options={[
            { value: 'EXPENSE', label: 'Chiqim', tone: 'expense', icon: <ArrowUpRight className="h-4 w-4" aria-hidden /> },
            { value: 'INCOME', label: 'Kirim', tone: 'income', icon: <ArrowDownLeft className="h-4 w-4" aria-hidden /> },
          ]}
        />
        <Controller
          name="amount"
          control={control}
          render={({ field, fieldState }) => (
            <MoneyInput
              label="Summa"
              size="lg"
              autoFocus={!editing}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error ? 'Summa 0 dan katta bo‘lishi kerak' : undefined}
            />
          )}
        />
        <Controller
          name="accountId"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <AccountPicker label="Hisob" accounts={accounts} value={field.value} onChange={field.onChange} invalid={Boolean(strictError)} />
              {strictError && (
                <p role="alert" className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger">
                  <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
                  {strictError}
                </p>
              )}
            </div>
          )}
        />
        <Controller
          name="categoryId"
          control={control}
          render={({ field, fieldState }) => (
            <CategoryPicker
              label="Kategoriya"
              categories={categoryTree}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error ? 'Kategoriyani tanlang' : undefined}
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
              placeholder="Masalan: Bozorlik, oylik..."
              maxLength={500}
              value={field.value ?? ''}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          name="tagIds"
          control={control}
          render={({ field }) => <TagPicker value={field.value ?? []} onChange={field.onChange} />}
        />
        {serverError && serverError !== STRICT_MESSAGE && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
