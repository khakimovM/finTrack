import { AdminChannel, addDays, formatIsoDate, parseIsoDate } from '@fintrack/shared';
import { WEEKDAYS_SHORT, formatDayMonth } from '../../../lib/format';
import { cn } from '../../../lib/utils';
import { channelsText } from './UserBits';

const DAYS = 90;

/** Days of the last 90 as columns of weeks (Monday on top), like a contributions calendar. */
function weeksOf(today: string): Array<Array<string | null>> {
  const end = parseIsoDate(today);
  const start = addDays(end, -(DAYS - 1));
  const lead = (start.getUTCDay() + 6) % 7;
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(formatIsoDate(d));
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** 90 days of a person's activity: a filled square for every day they used FinTrack anywhere. */
export function ActivityCalendar({ activity, today }: { activity: Array<{ day: string; channels: AdminChannel[] }>; today: string }) {
  const byDay = new Map(activity.map((a) => [a.day, a.channels]));
  const weeks = weeksOf(today);
  const activeDays = activity.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-semibold">Faollik, 90 kun</h3>
        <span className="text-[13px] text-text-secondary">
          {activeDays > 0 ? `${activeDays} kun faol` : 'Bu davrda faol bo‘lmagan'}
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="img" aria-label={`So‘nggi 90 kundan ${activeDays} kunida faol`}>
        <div className="flex flex-col gap-[3px] pr-0.5 text-[10px] leading-[14px] text-text-muted" aria-hidden>
          {WEEKDAYS_SHORT.map((d, i) => (
            <span key={d} className={cn('h-[14px]', i % 2 === 1 && 'invisible')}>
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={w} className="flex flex-col gap-[3px]" aria-hidden>
            {week.map((day, i) => {
              if (!day) return <span key={i} className="h-[14px] w-[14px]" />;
              const channels = byDay.get(day) ?? [];
              return (
                <span
                  key={day}
                  title={`${formatDayMonth(day)}: ${channels.length > 0 ? channelsText(channels) : 'faol emas'}`}
                  className={cn(
                    'h-[14px] w-[14px] rounded-[4px]',
                    channels.length === 0 && 'bg-secondary',
                    channels.length === 1 && 'bg-[color-mix(in_srgb,var(--chart-1)_55%,transparent)]',
                    channels.length > 1 && 'bg-[var(--chart-1)]',
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-[12px] text-text-muted">To‘q rang — o‘sha kuni bir nechta kanaldan foydalangan.</p>
    </div>
  );
}
