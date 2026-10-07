import { useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { todayLocalIso } from '@fintrack/shared';
import { usePeriodStore, type PeriodPreset } from '../../../stores/periodStore';
import { formatRange } from '../../../lib/format';
import { useIsMobile } from '../../../lib/useMediaQuery';
import { EXIT_MS, popMotion, usePresence } from '../../../lib/motion';
import { cn } from '../../../lib/utils';
import { Segmented } from '../../../components/ui/Segmented';
import { RangePicker } from '../../../components/ui/RangePicker';
import { Sheet } from '../../../components/ui/Sheet';
import { useDismiss } from '../../../components/ui/Popover';
import { PERIOD_OPTIONS } from '../periods';

/** Period segments ("Oraliq" opens a calendar) and the active range in words. */
export function DashboardPeriod() {
  const { preset, from, to, setPreset, setCustomRange } = usePeriodStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const close = () => setPickerOpen(false);
  useDismiss([rootRef], pickerOpen && !isMobile, close);
  const popover = usePresence(pickerOpen && !isMobile, EXIT_MS.base);

  const onChange = (value: PeriodPreset) => {
    if (value === 'custom') setPickerOpen(true);
    else setPreset(value);
  };

  const picker = (
    <RangePicker
      value={preset === 'custom' ? { from, to } : null}
      max={todayLocalIso()}
      size={isMobile ? 'lg' : 'md'}
      onCancel={close}
      onApply={(range) => {
        setCustomRange(range.from, range.to);
        close();
      }}
    />
  );

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-x-4 gap-y-2.5">
      <div className="-mx-4 w-[calc(100%+32px)] overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
        <Segmented
          aria-label="Davr"
          value={preset}
          onChange={onChange}
          options={PERIOD_OPTIONS.map((o) =>
            o.value === 'custom' ? { ...o, icon: <Calendar className="h-3.5 w-3.5" aria-hidden /> } : o,
          )}
        />
      </div>
      <span className="flex items-center gap-1.5 text-[14px] text-text-secondary">
        <Calendar className="h-4 w-4" aria-hidden />
        {formatRange(from, to)}
      </span>
      {popover.mounted && (
        <div
          role="dialog"
          aria-label="Oraliqni tanlang"
          aria-hidden={popover.closing || undefined}
          className={cn(
            'absolute left-0 top-full z-40 mt-2 w-[316px] origin-top-left rounded-xl border border-border bg-popover p-3 shadow-md',
            popMotion(popover.closing),
          )}
        >
          {picker}
        </div>
      )}
      {isMobile && (
        <Sheet isOpen={pickerOpen} onClose={close} title="Oraliqni tanlang">
          <div className="pt-2">{picker}</div>
        </Sheet>
      )}
    </div>
  );
}
