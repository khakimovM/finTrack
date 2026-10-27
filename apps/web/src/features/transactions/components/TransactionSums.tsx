import type { TransactionListMeta } from '@fintrack/shared';
import { currencyWord, formatAmount } from '../../../lib/money';
import { cn } from '../../../lib/utils';
import { t, tn } from '../../../lib/i18n';

function SumCard({ label, tiyin, count, tone }: { label: string; tiyin: string; count: string; tone: 'income' | 'expense' }) {
  const zero = BigInt(tiyin) === 0n;
  const sign = zero ? 'none' : tone === 'income' ? '+' : '-';
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[20px] border border-border bg-card px-4 py-3.5 sm:px-5 sm:py-4">
      <span className="text-[13px] leading-[18px] text-text-secondary">{label}</span>
      <span
        className={cn(
          'whitespace-nowrap text-[17px] font-semibold leading-tight tracking-[-0.02em] sm:text-[22px]',
          tone === 'income' ? 'text-income' : 'text-expense',
        )}
      >
        {formatAmount(tiyin, { sign, currency: false })}{' '}
        <span className="text-[13px] font-medium tracking-normal text-text-muted">{currencyWord()}</span>
      </span>
      <span className="text-[12px] leading-4 text-text-muted">{count}</span>
    </div>
  );
}

/** Income and expense of everything the filters match, not just the page on screen. */
export function TransactionSums({ sums }: { sums: TransactionListMeta['sums'] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(2,minmax(0,300px))] sm:gap-4">
      <SumCard label={t('transactions.sums.income')} tiyin={sums.income} count={tn('transactions.sums.incomeCount', sums.incomeCount)} tone="income" />
      <SumCard label={t('transactions.sums.expense')} tiyin={sums.expense} count={tn('transactions.sums.expenseCount', sums.expenseCount)} tone="expense" />
    </div>
  );
}
