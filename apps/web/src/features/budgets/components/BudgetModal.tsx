import { useState, type FormEvent } from 'react';
import type { BudgetStatusItem } from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { ChoiceGrid } from '../../../components/ui/ChoiceGrid';
import { formatMonth } from '../../../lib/format';
import { apiErrorCode, apiErrorToMessage } from '../../../lib/apiError';
import { useInitOnOpen } from '../../../lib/useInitOnOpen';
import { toast } from '../../../stores/toastStore';
import { useCategories } from '../../categories/hooks/useCategories';
import { useCreateBudget, useUpdateBudget } from '../hooks/useBudgets';

export interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "YYYY-MM". */
  month: string;
  /** Budgets the month already has: their categories are marked and refused. */
  existing: BudgetStatusItem[];
  /** Edit this budget's limit; its category and month stay. */
  editItem?: BudgetStatusItem | null;
}

const TAKEN = 'Bu oy uchun ushbu kategoriyada byudjet allaqachon bor';

export function BudgetModal({ isOpen, onClose, month, existing, editItem = null }: BudgetModalProps) {
  const editing = editItem !== null;
  const { data: tree = [] } = useCategories();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const [categoryId, setCategoryId] = useState('');
  const [limit, setLimit] = useState('');
  const [error, setError] = useState<{ category?: string; limit?: string }>({});

  useInitOnOpen(isOpen, true, () => {
    setCategoryId(editItem?.category.id ?? '');
    setLimit(editItem?.limitAmount ?? '');
    setError({});
  });

  // Budgets are set on top-level expense categories; their subcategories count towards them.
  const parents = tree.filter((c) => c.type === 'EXPENSE' && c.parentId === null);
  const budgeted = new Set(existing.map((b) => b.category.id));
  const taken = !editing && budgeted.has(categoryId);
  const busy = createBudget.isPending || updateBudget.isPending;
  const monthName = formatMonth(month);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing && !categoryId) return setError({ category: 'Kategoriyani tanlang' });
    if (taken) return;
    if (!(/^\d+$/.test(limit) && BigInt(limit) > 0n)) return setError({ limit: 'Limit 0 dan katta bo‘lishi kerak' });
    try {
      if (editItem) await updateBudget.mutateAsync({ id: editItem.id, data: { limitAmount: limit } });
      else await createBudget.mutateAsync({ categoryId, month, limitAmount: limit });
      onClose();
    } catch (err) {
      if (apiErrorCode(err) === 'BUDGET_EXISTS') setError({ category: TAKEN });
      else toast.error(apiErrorToMessage(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Byudjetni tahrirlash' : 'Byudjet belgilash'}
      description={`${monthName} uchun oylik xarajat limiti`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button type="submit" form="budget-form" loading={busy} disabled={taken}>
            Saqlash
          </Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-[18px]" noValidate>
        {editItem ? (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-text-secondary">Xarajat kategoriyasi</span>
            <dl className="flex flex-col rounded-md border border-border bg-surface px-3.5 py-1">
              {[
                ['Kategoriya', `${editItem.category.icon} ${editItem.category.name}`],
                ['Oy', monthName],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-border py-2.5 text-[14px] last:border-b-0">
                  <dt className="text-text-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[12.5px] leading-[17px] text-text-muted">Kategoriyani o‘zgartirish uchun byudjetni o‘chirib, yangisini belgilang.</p>
          </div>
        ) : (
          <ChoiceGrid
            label="Xarajat kategoriyasi"
            columns={2}
            phoneColumns={2}
            value={categoryId}
            onChange={(id) => {
              setCategoryId(id);
              setError({});
            }}
            error={taken ? TAKEN : error.category}
            options={parents.map((c) => ({
              value: c.id,
              label: c.name,
              emoji: c.icon,
              color: c.color,
              sub: budgeted.has(c.id) ? 'Byudjet bor' : undefined,
            }))}
          />
        )}
        <MoneyInput
          label="Oylik limit"
          size="md"
          autoFocus={editing}
          value={limit}
          onChange={(value) => {
            setLimit(value);
            setError((prev) => ({ ...prev, limit: undefined }));
          }}
          error={error.limit}
        />
      </form>
    </Modal>
  );
}
