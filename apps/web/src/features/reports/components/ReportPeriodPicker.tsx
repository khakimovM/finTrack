import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { todayLocalIso } from '@fintrack/shared';
import { Segmented } from '../../../components/ui/Segmented';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Button } from '../../../components/ui/Button';
import { DateRange, REPORT_PRESETS, ReportPreset } from '../periods';

export interface ReportPeriodPickerProps {
  preset: ReportPreset;
  /** The range in use; the inputs edit a draft until "Qo‘llash". */
  custom: DateRange;
  onPresetChange: (preset: ReportPreset) => void;
  onCustomChange: (range: DateRange) => void;
}

export function ReportPeriodPicker({ preset, custom, onPresetChange, onCustomChange }: ReportPeriodPickerProps) {
  const today = todayLocalIso();
  const [draft, setDraft] = useState<DateRange>(custom);
  const [error, setError] = useState<'both' | 'order' | null>(null);

  const apply = () => {
    if (!draft.from || !draft.to) return setError('both');
    if (draft.to < draft.from) return setError('order');
    setError(null);
    onCustomChange(draft);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="-mx-4 max-w-[100vw] overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <Segmented
          aria-label="Davr"
          value={preset}
          onChange={(next) => {
            setError(null);
            setDraft(custom);
            onPresetChange(next);
          }}
          options={REPORT_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
        />
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-3">
          <DatePicker
            label="Boshlanish"
            value={draft.from}
            onChange={(from) => {
              setDraft((prev) => ({ ...prev, from }));
              setError(null);
            }}
            max={today}
            today={today}
            className="flex-[1_1_160px]"
          />
          <DatePicker
            label="Tugash"
            value={draft.to}
            onChange={(to) => {
              setDraft((prev) => ({ ...prev, to }));
              setError(null);
            }}
            max={today}
            today={today}
            className="flex-[1_1_160px]"
          />
          <Button onClick={apply} className="h-11">
            Qo‘llash
          </Button>
          {error && (
            <p role="alert" className="flex basis-full items-center gap-1.5 text-[13px] font-medium text-danger">
              <CircleAlert className="h-[15px] w-[15px]" aria-hidden />
              {error === 'both' ? 'Ikkala sanani ham tanlang' : 'Tugash sanasi boshlanishdan oldin bo‘lishi mumkin emas'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
