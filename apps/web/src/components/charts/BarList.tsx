import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BarListItem {
  key: string;
  label: React.ReactNode;
  value: number;
  /** Text at the end of the row ("3 000 000 so‘m"). */
  display: React.ReactNode;
  color: string;
}

/**
 * Horizontal bars scaled to the largest value: name | bar | value on wide screens, name and
 * value over a full-width bar on phones.
 */
export function BarList({ items, className }: { items: BarListItem[]; className?: string }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[150px_1fr_auto] sm:gap-y-0"
        >
          <span className="truncate text-[14px] text-text sm:col-start-1">{item.label}</span>
          <span className="col-span-2 row-start-2 h-2.5 rounded-full bg-secondary sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color }}
            />
          </span>
          <span className="whitespace-nowrap text-right text-[14px] font-semibold tabular-nums sm:col-start-3 sm:min-w-[96px]">{item.display}</span>
        </li>
      ))}
    </ul>
  );
}
