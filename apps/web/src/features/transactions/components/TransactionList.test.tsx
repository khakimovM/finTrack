import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionList, groupByDay } from './TransactionList';
import { renderWithProviders } from '../../../test/render';
import { transaction } from '../../../test/fixtures';

const TODAY = '2026-09-15';
const income = transaction({ type: 'INCOME', amount: '800000000', note: 'Oylik' });
const expense = transaction({ type: 'EXPENSE', amount: '5000000', date: '2026-09-14', note: 'Taksi' });
const transferOut = transaction({
  type: 'TRANSFER_OUT',
  category: null,
  transferGroupId: 'group-1',
  transferPeer: { accountId: '00000000-0000-4000-8000-00000000beef', name: 'Jamg‘arma', icon: '🐷' },
});
const loan = transaction({
  type: 'LOAN_GIVEN',
  category: null,
  debtId: '00000000-0000-4000-8000-00000000debe',
  debt: { id: '00000000-0000-4000-8000-00000000debe', personName: 'Jasur' },
});
const adjustment = transaction({ type: 'ADJUSTMENT', category: null, note: 'Boshlang‘ich qoldiq' });

function setup() {
  const actions = { onOpen: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onCancelTransfer: vi.fn(), onOpenDebt: vi.fn() };
  const selection = { ids: new Set<string>(), toggle: vi.fn(), toggleAll: vi.fn() };
  renderWithProviders(
    <TransactionList
      variant="table"
      transactions={[income, transferOut, loan, adjustment, expense]}
      grouped
      today={TODAY}
      parents={new Map()}
      actions={actions}
      selection={selection}
    />,
  );
  const rowOf = (text: string) => screen.getByText(text).closest('div[class*="min-h-[58px]"]') as HTMLElement;
  return { actions, selection, rowOf };
}

describe('TransactionList', () => {
  it('groups by day with the net of that day’s incomes and expenses', () => {
    setup();
    expect(screen.getByText('Bugun · 15-sentabr, seshanba')).toBeTruthy();
    expect(screen.getByText('Kecha · 14-sentabr, dushanba')).toBeTruthy();
    // The transfer and the loan on the same day are not income: only the salary counts.
    expect(screen.getAllByText('+8 000 000 so‘m')).toHaveLength(2);
  });

  it('names both sides of a transfer and the person of a debt', () => {
    setup();
    expect(screen.getByText('Naqd pul → Jamg‘arma')).toBeTruthy();
    expect(screen.getByText('Jasur')).toBeTruthy();
  });

  it('edits and deletes incomes and expenses from the row menu', async () => {
    const { actions, rowOf } = setup();
    const row = rowOf('Oylik');
    await userEvent.click(within(row).getByRole('button', { name: 'Amallar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'O‘chirish' }));
    expect(actions.onDelete).toHaveBeenCalledWith(income);
    expect(actions.onOpen).not.toHaveBeenCalled();

    await userEvent.click(row);
    expect(actions.onOpen).toHaveBeenCalledWith(income);
  });

  it('cancels a transfer and sends a loan to its debt instead of deleting', async () => {
    const { actions, rowOf } = setup();
    await userEvent.click(within(rowOf('Naqd pul → Jamg‘arma')).getByRole('button', { name: 'Amallar' }));
    expect(screen.queryByRole('menuitem', { name: 'O‘chirish' })).toBeNull();
    await userEvent.click(screen.getByRole('menuitem', { name: 'O‘tkazmani bekor qilish' }));
    expect(actions.onCancelTransfer).toHaveBeenCalledWith(transferOut);

    await userEvent.click(within(rowOf('Jasur')).getByRole('button', { name: 'Amallar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Qarzga o‘tish' }));
    expect(actions.onOpenDebt).toHaveBeenCalledWith(loan);
  });

  it('locks system rows and keeps managed rows out of bulk selection', async () => {
    const { actions, rowOf } = setup();
    const row = rowOf('Boshlang‘ich qoldiq');
    expect(within(row).getByLabelText('Tizim yozuvi')).toBeTruthy();
    expect(within(row).queryByRole('button', { name: 'Amallar' })).toBeNull();
    await userEvent.click(row);
    expect(actions.onOpen).not.toHaveBeenCalled();
    // The header plus the income and the expense; transfers, loans and adjustments have none.
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });
});

describe('groupByDay', () => {
  it('keeps one flat group when sorted by amount', () => {
    expect(groupByDay([income, expense], false)).toEqual([{ day: null, net: 0n, rows: [income, expense] }]);
  });

  it('nets incomes against expenses per day', () => {
    const lunch = transaction({ type: 'EXPENSE', amount: '300000' });
    expect(groupByDay([income, lunch], true)[0].net).toBe(800000000n - 300000n);
  });
});
