import { useInitOnOpen } from '../../../lib/useInitOnOpen';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateBudgetInputSchema, CreateBudgetInput, BudgetStatusItem } from '@fintrack/shared';
import { useCreateBudget, useUpdateBudget } from '../hooks/useBudgets';
import { useCategories } from '../../categories/hooks/useCategories';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { Select } from '../../../components/ui/Select';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: string;
  editItem?: BudgetStatusItem | null;
}

export function BudgetModal({ isOpen, onClose, month, editItem }: BudgetModalProps) {
  const { data: categoriesData } = useCategories();
  const expenseCategories = (categoriesData ?? []).filter((c) => c.type === 'EXPENSE');

  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();

  const isEdit = Boolean(editItem);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateBudgetInput>({
    resolver: zodResolver(CreateBudgetInputSchema),
    defaultValues: {
      categoryId: editItem?.category?.id ?? expenseCategories[0]?.id ?? '',
      month,
      limitAmount: editItem?.limitAmount ?? '',
    },
  });

  // Waits for the categories so a new budget starts on the first expense category.
  useInitOnOpen(isOpen, editItem != null || categoriesData !== undefined, () => {
    if (editItem) {
      setValue('categoryId', editItem.category.id);
      setValue('month', month);
      setValue('limitAmount', editItem.limitAmount);
    } else {
      reset({ categoryId: expenseCategories[0]?.id ?? '', month, limitAmount: '' });
    }
  });

  const categoryIdValue = watch('categoryId');
  const limitAmountValue = watch('limitAmount');

  const onSubmit = async (data: CreateBudgetInput) => {
    try {
      if (isEdit && editItem) {
        await updateBudget.mutateAsync({
          id: editItem.id,
          data: { limitAmount: data.limitAmount },
        });
      } else {
        await createBudget.mutateAsync({
          ...data,
          month,
        });
      }
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
      title={isEdit ? 'Byudjet Limitini Yangilash' : 'Yangi Byudjet Belgilash'}
      description={`Tanlangan oy (${month}) uchun xarajat kategoriyasiga limit belgilang.`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        {!isEdit ? (
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Xarajat Kategoriyasi *</label>
            <Select
              value={categoryIdValue || expenseCategories[0]?.id || ''}
              onChange={(e) => setValue('categoryId', e.target.value)}
              options={expenseCategories.map((c) => ({
                value: c.id,
                label: `${c.icon} ${c.name}`,
              }))}
              error={errors.categoryId?.message}
            />
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-center gap-2.5">
            <span className="text-xl">{editItem?.category.icon}</span>
            <div>
              <span className="text-xs font-bold text-foreground block">
                {editItem?.category.name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Kategoriya limitini tahrirlash
              </span>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground">Oylik Limit Summasi *</label>
          <MoneyInput
            value={limitAmountValue}
            onChange={(tiyinStr: string) => setValue('limitAmount', tiyinStr)}
            placeholder="0"
            error={errors.limitAmount?.message}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={isSubmitting || createBudget.isPending || updateBudget.isPending}
          >
            {isEdit ? 'Yangilash' : 'Saqlash'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
