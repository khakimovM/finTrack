import * as React from 'react';
import { Segmented } from './Segmented';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** "Faol (4)" — shown in brackets after the label. */
  count?: number;
  /** Small info pill instead of brackets (unread notifications). */
  badge?: number;
}

export interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: TabItem<T>[];
  'aria-label': string;
  fullWidth?: boolean;
  className?: string;
}

/** View switcher: the segmented look with tab semantics. */
export function Tabs<T extends string>({ value, onChange, items, fullWidth, className, ...aria }: TabsProps<T>) {
  return (
    <Segmented
      role="tablist"
      value={value}
      onChange={onChange}
      fullWidth={fullWidth}
      className={className}
      aria-label={aria['aria-label']}
      options={items.map((item) => ({
        value: item.value,
        label: (
          <>
            {item.count !== undefined ? `${item.label} (${item.count})` : item.label}
            {item.badge ? (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-info-soft px-1.5 text-[11.5px] font-semibold text-info">
                {item.badge}
              </span>
            ) : null}
          </>
        ) as React.ReactNode,
      }))}
    />
  );
}
