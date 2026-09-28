import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatMoney } from '@fintrack/shared';

/** "+1 200 so‘m" / "−1 200 so‘m", but a plain "0 so‘m" when there is nothing. */
function signed(sign: '+' | '−', tiyin: string): string {
  return BigInt(tiyin) === 0n ? formatMoney(tiyin) : `${sign}${formatMoney(tiyin)}`;
}

/** Income and expense of everything matching the current filters (`meta.sums`). */
export function TransactionSums({ income, expense }: { income: string; expense: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Filtr bo‘yicha kirim</p>
          <p className="mt-1 text-xl font-extrabold text-success">{signed('+', income)}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
          <ArrowUpRight className="h-5 w-5" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Filtr bo‘yicha chiqim</p>
          <p className="mt-1 text-xl font-extrabold text-destructive">{signed('−', expense)}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <ArrowDownLeft className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
