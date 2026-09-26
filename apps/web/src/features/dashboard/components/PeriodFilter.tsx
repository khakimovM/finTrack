import { useState } from 'react';
import { usePeriodStore, PeriodPreset } from '../../../stores/periodStore';
import { Calendar } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: 'today', label: 'Bugun' },
  { key: 'this_week', label: 'Shu hafta' },
  { key: 'this_month', label: 'Shu oy' },
  { key: 'this_year', label: 'Shu yil' },
  { key: 'custom', label: 'Oraliq' },
];

export function PeriodFilter() {
  const { preset, from, to, setPreset, setCustomRange } = usePeriodStore();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const handlePresetClick = (key: PeriodPreset) => {
    setPreset(key);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customFrom && customTo && customFrom <= customTo) {
      setCustomRange(customFrom, customTo);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Preset Buttons */}
      <div className="inline-flex items-center gap-1 rounded-2xl bg-muted/60 p-1 backdrop-blur-sm border border-border/50 overflow-x-auto max-w-full">
        {PRESETS.map((p) => {
          const isActive = preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePresetClick(p.key)}
              className={cn(
                'px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap min-h-[36px] flex items-center gap-1.5',
                isActive
                  ? 'bg-background text-foreground shadow-sm shadow-black/5 font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
              )}
            >
              {p.key === 'custom' && <Calendar className="h-3.5 w-3.5" />}
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Date display or Custom range picker */}
      <div className="flex items-center gap-2">
        {preset !== 'custom' ? (
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 rounded-xl border border-border/40">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>
              {from} &mdash; {to}
            </span>
          </div>
        ) : (
          <form onSubmit={handleApplyCustom} className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 w-36 text-xs"
              required
            />
            <span className="text-xs text-muted-foreground">&mdash;</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 w-36 text-xs"
              required
            />
            <Button type="submit" size="sm" variant="secondary" className="h-9 text-xs">
              Qo‘llash
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
