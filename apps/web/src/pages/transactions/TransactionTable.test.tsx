import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionTable } from './TransactionTable';
import { renderWithProviders } from '../../test/render';
import { transaction } from '../../test/fixtures';

const income = transaction({ type: 'INCOME', amount: '800000000' });
const transferOut = transaction({
  type: 'TRANSFER_OUT',
  category: null,
  transferGroupId: 'group-1',
});
const debtId = '00000000-0000-4000-8000-00000000debe';
const loan = transaction({ type: 'LOAN_GIVEN', category: null, debtId });
const adjustment = transaction({ type: 'ADJUSTMENT', category: null });

function setup() {
  const props = {
    transactions: [income, transferOut, loan, adjustment],
    selectedIds: new Set<string>(),
    onToggleSelect: vi.fn(),
    onToggleAll: vi.fn(),
    onDelete: vi.fn(),
    onCancelTransfer: vi.fn(),
  };
  renderWithProviders(<TransactionTable {...props} />);
  // Desktop table and mobile cards are both rendered (CSS picks one): check the table.
  return { props, table: within(screen.getByRole('table')) };
}

describe('TransactionTable row actions', () => {
  it('deletes income and expense rows', async () => {
    const { props, table } = setup();
    await userEvent.click(table.getByRole('button', { name: 'O‘chirish' }));
    expect(props.onDelete).toHaveBeenCalledWith(income.id);
  });

  it('cancels a transfer as a pair, by its group id', async () => {
    const { props, table } = setup();
    await userEvent.click(table.getByRole('button', { name: 'O‘tkazmani bekor qilish' }));
    expect(props.onCancelTransfer).toHaveBeenCalledWith('group-1');
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('sends loan rows to their debt instead of deleting them', () => {
    const { table } = setup();
    expect(table.getByRole('link', { name: 'Qarzga o‘tish' }).getAttribute('href')).toBe(
      `/app/debts?debt=${debtId}`,
    );
  });

  it('locks system rows and keeps managed rows out of bulk selection', () => {
    const { table } = setup();
    expect(table.getByLabelText('Tizim yozuvi')).toBeTruthy();
    const checkboxes = table.getAllByRole('checkbox').slice(1) as HTMLInputElement[];
    expect(checkboxes.map((c) => c.disabled)).toEqual([false, true, true, true]);
  });

  it('shows dates the Uzbek way', () => {
    const { table } = setup();
    expect(table.getAllByText('15-sentabr, 2026')).toHaveLength(4);
  });
});
