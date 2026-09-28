import { StatsCompareResponse, formatMoney } from '@fintrack/shared';
import { Card, CardContent } from '../../../components/ui/Card';
import { cn } from '../../../lib/utils';
import { ChangeBadge } from './ChangeBadge';

interface Row {
  label: string;
  current: string;
  previous: string;
  percent: number;
  growthIsGood: boolean;
  tone: string;
  signed?: boolean;
}

function signedMoney(tiyin: string): string {
  const value = BigInt(tiyin);
  if (value === 0n) return formatMoney(value);
  return value < 0n ? `−${formatMoney(-value)}` : `+${formatMoney(value)}`;
}

/** Income, spending and net for both periods, with the change between them. */
export function CompareSummary({ data }: { data: StatsCompareResponse }) {
  const rows: Row[] = [
    {
      label: 'Kirim',
      current: data.current.income,
      previous: data.previous.income,
      percent: data.changes.incomeChangePercent,
      growthIsGood: true,
      tone: 'text-success',
    },
    {
      label: 'Chiqim',
      current: data.current.expense,
      previous: data.previous.expense,
      percent: data.changes.expenseChangePercent,
      growthIsGood: false,
      tone: 'text-destructive',
    },
    {
      label: 'Sof natija',
      current: data.current.net,
      previous: data.previous.net,
      percent: data.changes.netChangePercent,
      growthIsGood: true,
      tone: BigInt(data.current.net) < 0n ? 'text-destructive' : 'text-foreground',
      signed: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {rows.map((row) => (
        <Card key={row.label} className="border border-border/60 shadow-sm">
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {row.label}
            </p>
            <p className={cn('text-xl font-black', row.tone)}>
              {row.signed ? signedMoney(row.current) : formatMoney(row.current)}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Oldin: {row.signed ? signedMoney(row.previous) : formatMoney(row.previous)}
              </span>
              <ChangeBadge
                current={row.current}
                previous={row.previous}
                percent={row.percent}
                growthIsGood={row.growthIsGood}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
