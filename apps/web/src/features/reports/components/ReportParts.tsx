import { useState } from 'react';
import type { StatsCompareResponse, StatsTimeseriesItem } from '@fintrack/shared';
import { ChangeChip } from '../../../components/ui/Chip';
import { EmojiTile } from '../../../components/ui/EmojiTile';
import { Segmented } from '../../../components/ui/Segmented';
import { GroupedBars } from '../../../components/charts/GroupedBars';
import { formatAmount, tiyinToChartNumber } from '../../../lib/money';
import { cn } from '../../../lib/utils';
import { changePercent } from '../../dashboard/periods';
import { sumIntoBuckets, type BucketPlan } from '../buckets';
import type { CategoryChange } from '../useReport';
import type { Comparison } from '../periods';

const CARD = 'flex min-w-0 flex-col rounded-[20px] border border-border bg-card p-4 sm:p-5';

function CompareCard({ label, current, previous, upIsGood, tone }: { label: string; current: bigint; previous: bigint; upIsGood: boolean; tone: 'income' | 'expense' | 'net' }) {
  const value =
    tone === 'income'
      ? formatAmount(current, { sign: current > 0n ? '+' : 'none', currency: false })
      : tone === 'expense'
        ? formatAmount(current, { sign: current > 0n ? '-' : 'none', currency: false })
        : formatAmount(current, { sign: 'auto', currency: false });
  const before = tone === 'net' ? formatAmount(previous, { sign: 'auto' }) : formatAmount(previous);
  const colour = tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : current < 0n ? 'text-danger' : 'text-text';
  return (
    <section aria-label={label} className={cn(CARD, 'justify-between gap-x-3 gap-y-1.5 max-sm:flex-row max-sm:items-start')}>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[14px] text-text-secondary">{label}</span>
        <span className={cn('whitespace-nowrap text-[17px] font-semibold leading-[1.2] tracking-[-0.02em] tabular-nums sm:text-[24px]', colour)}>
          {value} <span className="text-[13px] font-medium tracking-normal text-text-muted">so‘m</span>
        </span>
        <span className="whitespace-nowrap text-[13px] text-text-muted">Oldin: {before}</span>
      </div>
      <div>
        <ChangeChip value={changePercent(current, previous)} upIsGood={upIsGood} />
      </div>
    </section>
  );
}

export function CompareCards({ data }: { data: StatsCompareResponse }) {
  const v = (s: string) => BigInt(s);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3 sm:gap-4">
      <CompareCard label="Kirim" current={v(data.current.income)} previous={v(data.previous.income)} upIsGood tone="income" />
      <CompareCard label="Chiqim" current={v(data.current.expense)} previous={v(data.previous.expense)} upIsGood={false} tone="expense" />
      <CompareCard label="Sof natija" current={v(data.current.net)} previous={v(data.previous.net)} upIsGood tone="net" />
    </div>
  );
}

const fromSom = (som: number) => formatAmount(BigInt(Math.round(som * 100)));

/** Current and previous period cut into the same pieces, expense or income. */
export function PeriodChart({
  plan,
  comparison,
  series,
}: {
  plan: BucketPlan;
  comparison: Comparison;
  series: { current: StatsTimeseriesItem[]; previous: StatsTimeseriesItem[] };
}) {
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const now = sumIntoBuckets(plan, series.current, comparison.current.from, kind);
  const before = sumIntoBuckets(plan, series.previous, comparison.previous.from, kind);
  const colour = kind === 'expense' ? 'var(--expense)' : 'var(--income)';
  const previousColour = `color-mix(in oklab, ${colour} 32%, var(--secondary))`;

  return (
    <section aria-label="Davrlar solishtiruvi" className={cn(CARD, 'gap-3.5')}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-auto text-[16px] font-semibold leading-6">Davrlar solishtiruvi</h2>
        <span className="flex gap-3 text-[12.5px] text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colour }} aria-hidden />
            Hozir
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: previousColour }} aria-hidden />
            Oldin
          </span>
        </span>
        <Segmented
          aria-label="Ko‘rsatkich"
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Chiqim' },
            { value: 'income', label: 'Kirim' },
          ]}
        />
      </div>
      <GroupedBars
        data={plan.buckets.map((bucket, i) => ({
          label: bucket.label,
          title: bucket.title,
          current: tiyinToChartNumber(now[i]),
          previous: tiyinToChartNumber(before[i]),
        }))}
        currentColor={colour}
        previousColor={previousColour}
        height={260}
        barSize={plan.buckets.length > 6 ? 12 : 24}
        formatValue={fromSom}
        ariaLabel={`${kind === 'expense' ? 'Chiqim' : 'Kirim'}: hozirgi va oldingi davr`}
      />
    </section>
  );
}

function CategoryRows({ rows, type }: { rows: CategoryChange[]; type: 'expense' | 'income' }) {
  const top = rows.reduce((max, r) => (r.current > max ? r.current : r.previous > max ? r.previous : max), 1n);
  const width = (v: bigint) => `${Number((v * 1000n) / top) / 10}%`;
  if (rows.length === 0) return <p className="py-5 text-center text-[14px] text-text-muted">Bu davrlarda yozuvlar yo‘q</p>;
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1.5 border-t border-border py-2.5">
          <div className="flex items-center gap-2.5">
            <EmojiTile emoji={row.icon} color={row.color} size={32} />
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{row.name}</span>
            <ChangeChip value={changePercent(row.current, row.previous)} upIsGood={type === 'income'} />
          </div>
          <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 pl-[42px] text-[12px]">
            <span className="text-text-muted">Hozir</span>
            <span className="h-1.5 rounded-full bg-secondary">
              <span
                className={cn('block h-full rounded-full', type === 'expense' ? 'bg-expense' : 'bg-income')}
                style={{ width: width(row.current) }}
              />
            </span>
            <span className="whitespace-nowrap text-right text-[13px] font-semibold">{formatAmount(row.current)}</span>
            <span className="text-text-muted">Oldin</span>
            <span className="h-1.5 rounded-full bg-secondary">
              <span className="block h-full rounded-full bg-input" style={{ width: width(row.previous) }} />
            </span>
            <span className="whitespace-nowrap text-right text-[13px] font-medium text-text-secondary">{formatAmount(row.previous)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CategoryCompare({ title, rows, type }: { title: string; rows: CategoryChange[]; type: 'expense' | 'income' }) {
  return (
    <section aria-label={title} className={cn(CARD, 'gap-1')}>
      <div className="flex items-center justify-between gap-3 pb-2">
        <h2 className="text-[16px] font-semibold leading-6">{title}</h2>
        <span className="flex gap-3 text-[12px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className={cn('h-1 w-2.5 rounded-full', type === 'expense' ? 'bg-expense' : 'bg-income')} aria-hidden />
            Hozir
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-2.5 rounded-full bg-input" aria-hidden />
            Oldin
          </span>
        </span>
      </div>
      <CategoryRows rows={rows} type={type} />
    </section>
  );
}

