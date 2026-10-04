import * as React from 'react';

export interface TooltipRow {
  label: string;
  value: React.ReactNode;
  /** Swatch and value colour; no swatch when omitted (single-series charts). */
  color?: string;
}

/** Popover-styled tooltip: muted title, then one row per series. */
export function ChartTooltipBox({ title, rows, minWidth = 190 }: { title: string; rows: TooltipRow[]; minWidth?: number }) {
  return (
    <div
      className="rounded-md border border-border bg-popover px-3 py-2.5 text-[13px] text-text shadow-md"
      style={{ minWidth }}
    >
      <div className="mb-1.5 text-[12px] font-medium text-text-muted">{title}</div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            {row.color && <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: row.color }} aria-hidden />}
            <span className="text-text-secondary">{row.label}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums" style={row.color ? { color: row.color } : undefined}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The fields Recharts passes to a custom tooltip that we read. */
export interface RechartsTooltipProps<Datum> {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Datum }>;
}
