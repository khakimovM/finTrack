import { AlertTriangle } from 'lucide-react';
import { formatMoney } from '@fintrack/shared';
import { cn } from '../../lib/utils';

export interface AmountProps {
  value: string | bigint;
  type?: string; // 'INCOME' | 'EXPENSE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | etc.
  className?: string;
  showSign?: boolean;
}

export function Amount({ value, type, className, showSign = true }: AmountProps) {
  let tiyin: bigint;
  try {
    tiyin = typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    tiyin = 0n;
  }

  const isIncome =
    type === 'INCOME' ||
    type === 'TRANSFER_IN' ||
    type === 'LOAN_TAKEN' ||
    type === 'LOAN_REPAY_IN';
  const isExpense =
    type === 'EXPENSE' ||
    type === 'TRANSFER_OUT' ||
    type === 'LOAN_GIVEN' ||
    type === 'LOAN_REPAY_OUT';

  const isNegativeBalance = !type && tiyin < 0n;
  const absTiyin = tiyin < 0n ? -tiyin : tiyin;
  const formatted = formatMoney(absTiyin);

  let prefix = '';
  if (showSign) {
    if (isIncome) prefix = '+ ';
    else if (isExpense) prefix = '− ';
    else if (isNegativeBalance) prefix = '− ';
  }

  return (
    <span
      className={cn(
        'font-bold tracking-tight inline-flex items-center gap-1 whitespace-nowrap',
        isIncome && 'text-success',
        isExpense && 'text-destructive',
        isNegativeBalance && 'text-destructive font-extrabold',
        !isIncome && !isExpense && !isNegativeBalance && 'text-foreground',
        className,
      )}
    >
      {isNegativeBalance && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
      <span>
        {prefix}
        {formatted}
      </span>
    </span>
  );
}
