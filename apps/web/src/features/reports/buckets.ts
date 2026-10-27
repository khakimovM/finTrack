import { diffInDays, endOfMonth, parseIsoDate, type StatsTimeseriesItem, type TimeseriesGroupBy } from '@fintrack/shared';
import { daysOfMonth, formatShortDate, monthNames, monthShortStandaloneNames, monthStandaloneNames } from '../../lib/format';
import { t } from '../../lib/i18n';
import type { Comparison, ReportPreset } from './periods';

export interface Bucket {
  label: string;
  title: string;
}

export interface BucketPlan {
  buckets: Bucket[];
  /** What to ask /stats/timeseries for, for both periods. */
  groupBy: TimeseriesGroupBy;
  /** Bucket index of a timeseries row (its `bucket` date) within a period starting at `from`. */
  indexOf: (bucket: string, from: string) => number;
}

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const WEEKS: Array<[number, number]> = [
  [1, 7],
  [8, 14],
  [15, 21],
  [22, 28],
  [29, 31],
];

/**
 * How the "Davrlar solishtiruvi" chart cuts both periods into comparable pieces: weeks of the
 * month (1–7, 8–14…) for a month, months for a year, up to six equal stretches for a custom range.
 */
export function bucketPlan(preset: ReportPreset, comparison: Comparison): BucketPlan {
  const { current, previous } = comparison;

  if (preset === 'this_month' || preset === 'last_month') {
    const days = endOfMonth(parseIsoDate(current.from)).getUTCDate();
    const daysBefore = endOfMonth(parseIsoDate(previous.from)).getUTCDate();
    // A longer previous month (31 January before February) keeps its last days on the chart.
    const last = Math.max(days, Number(previous.to.slice(8, 10)));
    const month = Number(current.from.slice(5, 7));
    const before = Number(previous.from.slice(5, 7));
    const weeks = WEEKS.filter(([a]) => a <= last);
    const span = (a: number, b: number, end: number) => `${a}–${Math.min(b, end)}`;
    return {
      groupBy: 'day',
      buckets: weeks.map(([a, b]) => {
        const now = a <= days ? span(a, b, days) : null;
        const then = a <= daysBefore ? span(a, b, daysBefore) : null;
        const title =
          now === then
            ? `${daysOfMonth(now ?? '', month)} / ${monthNames()[before - 1]}`
            : [now && daysOfMonth(now, month), then && daysOfMonth(then, before)].filter(Boolean).join(' / ');
        return { label: now ?? then ?? '', title };
      }),
      indexOf: (bucket) => {
        const day = Number(bucket.slice(8, 10));
        return weeks.findIndex(([a, b]) => day >= a && day <= b);
      },
    };
  }

  if (preset === 'this_year') {
    const year = Number(current.from.slice(0, 4));
    return {
      groupBy: 'month',
      buckets: monthShortStandaloneNames().map((short, i) => ({
        label: capital(short),
        title: `${capital(monthStandaloneNames()[i])} ${year} / ${year - 1}`,
      })),
      indexOf: (bucket) => Number(bucket.slice(5, 7)) - 1,
    };
  }

  const length = diffInDays(current.from, current.to) + 1;
  const count = Math.min(6, length);
  const step = length / count;
  const edges = Array.from({ length: count }, (_, i) => [Math.floor(i * step), Math.floor((i + 1) * step) - 1] as const);
  const dayOf = (offset: number) => {
    const date = parseIsoDate(current.from);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  return {
    // The API caps daily series at 400 days; longer ranges come by month.
    groupBy: length <= 400 ? 'day' : 'month',
    buckets: edges.map(([a, b]) => ({
      label: a === b ? formatShortDate(dayOf(a)) : `${Number(dayOf(a).slice(8, 10))}–${formatShortDate(dayOf(b))}`,
      title: a === b ? t('reports.compare.day', { n: a + 1 }) : t('reports.compare.days', { from: a + 1, to: b + 1 }),
    })),
    // A previous period a few days longer (whole months: 31 days before 30) ends in the last stretch.
    indexOf: (bucket, from) => {
      const offset = Math.min(Math.max(0, diffInDays(from, bucket)), length - 1);
      return edges.findIndex(([a, b]) => offset >= a && offset <= b);
    },
  };
}

/** Sums one money field of a timeseries into the plan's buckets, in tiyin. */
export function sumIntoBuckets(
  plan: BucketPlan,
  rows: StatsTimeseriesItem[],
  from: string,
  field: 'income' | 'expense',
): bigint[] {
  const totals = plan.buckets.map(() => 0n);
  for (const row of rows) {
    const index = plan.indexOf(row.bucket, from);
    if (index >= 0) totals[index] += BigInt(row[field]);
  }
  return totals;
}
