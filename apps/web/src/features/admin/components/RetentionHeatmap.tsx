import { AdminRetentionResponse } from '@fintrack/shared';
import { formatShortDate } from '../../../lib/format';
import { cn } from '../../../lib/utils';
import { formatCount, percentOf } from '../format';

/** Cell colour: the share of the cohort active that week, as the strength of one colour. */
function shade(pct: number): string {
  if (pct === 0) return 'var(--secondary)';
  const strength = Math.max(14, Math.min(100, pct));
  return `color-mix(in srgb, var(--chart-1) ${strength}%, transparent)`;
}

/**
 * Weekly sign-up cohorts (rows, newest last) against the weeks since signing up (columns): the
 * percentage of each cohort that came back. Weeks that have not happened yet stay blank.
 */
export function RetentionHeatmap({ data }: { data: AdminRetentionResponse }) {
  const weeks = Array.from({ length: data.weeks }, (_, n) => n);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-[3px] text-[12.5px]">
        <caption className="sr-only">Haftalik kogortalar: ro‘yxatdan o‘tgandan keyingi har haftada qaytganlar ulushi</caption>
        <thead>
          <tr className="text-text-muted">
            <th scope="col" className="px-2 py-1.5 text-left font-medium">
              Hafta
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Odam
            </th>
            {weeks.map((n) => (
              <th key={n} scope="col" className="px-1 py-1.5 text-center font-medium">
                {n === 0 ? '0-hafta' : `${n}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.cohorts.map((cohort) => (
            <tr key={cohort.week}>
              <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-text-secondary">
                {formatShortDate(cohort.week)}
              </th>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatCount(cohort.size)}</td>
              {cohort.active.map((active, n) => {
                if (active === null) return <td key={n} aria-label="hali kelmagan" />;
                const pct = percentOf(active, cohort.size);
                return (
                  <td
                    key={n}
                    title={`${formatCount(active)} / ${formatCount(cohort.size)}`}
                    className={cn(
                      'h-9 min-w-[48px] rounded-[8px] text-center tabular-nums',
                      cohort.size === 0 ? 'text-text-muted' : pct >= 55 ? 'font-semibold text-white' : 'text-text',
                    )}
                    style={{ background: cohort.size === 0 ? 'transparent' : shade(pct) }}
                  >
                    {cohort.size === 0 ? '—' : `${pct}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
