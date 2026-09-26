import { DebtPayment, DebtStatus } from '@prisma/client';
import { DebtPaymentResponse, DebtResponse, diffInDays, formatIsoDate } from '@fintrack/shared';
import { DebtWithPayments } from './debts.repository';

export function debtStatusFor(amount: bigint, paid: bigint): DebtStatus {
  if (paid >= amount) return 'PAID';
  return paid > 0n ? 'PARTIALLY_PAID' : 'ACTIVE';
}

/** `today` is the user's calendar day (YYYY-MM-DD); overdue is computed at read time. */
export function toDebtResponse(debt: DebtWithPayments, today: string): DebtResponse {
  const paidAmount = debt.payments.reduce((acc, p) => acc + p.amount, 0n);
  const remainingAmount = debt.amount > paidAmount ? debt.amount - paidAmount : 0n;
  const dueDate = debt.dueDate ? formatIsoDate(debt.dueDate) : null;
  const daysLeft = dueDate ? diffInDays(today, dueDate) : null;

  return {
    id: debt.id,
    direction: debt.direction,
    personName: debt.personName,
    personPhone: debt.personPhone,
    amount: debt.amount.toString(),
    paidAmount: paidAmount.toString(),
    remainingAmount: remainingAmount.toString(),
    dueDate,
    status: debt.status,
    paidAt: debt.paidAt?.toISOString() ?? null,
    isOverdue: debt.status !== 'PAID' && daysLeft !== null && daysLeft < 0,
    daysLeft,
    note: debt.note,
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString(),
  };
}

export function toDebtPaymentResponse(payment: DebtPayment): DebtPaymentResponse {
  return {
    id: payment.id,
    amount: payment.amount.toString(),
    paidAt: formatIsoDate(payment.paidAt),
    note: payment.note,
    createdAt: payment.createdAt.toISOString(),
  };
}
