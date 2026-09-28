import { Input } from '../../../components/ui/Input';
import { cn } from '../../../lib/utils';
import { DateRange, REPORT_PRESETS, ReportPreset } from '../periods';

export interface ReportPeriodPickerProps {
  preset: ReportPreset;
  custom: DateRange;
  customError?: string;
  onPresetChange: (preset: ReportPreset) => void;
  onCustomChange: (range: DateRange) => void;
}

export function ReportPeriodPicker({
  preset,
  custom,
  customError,
  onPresetChange,
  onCustomChange,
}: ReportPeriodPickerProps) {
  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-1 rounded-2xl border border-border/50 bg-muted/60 p-1"
        role="tablist"
      >
        {REPORT_PRESETS.map((p) => (
          <button
            key={p.value}
            role="tab"
            aria-selected={preset === p.value}
            onClick={() => onPresetChange(p.value)}
            className={cn(
              'min-h-11 flex-1 whitespace-nowrap rounded-xl px-2 text-xs font-bold transition-all sm:min-h-9 sm:flex-none sm:px-3',
              preset === p.value
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <Input
            type="date"
            label="Boshlanish"
            value={custom.from}
            onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
          />
          <Input
            type="date"
            label="Tugash"
            value={custom.to}
            error={customError}
            onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
