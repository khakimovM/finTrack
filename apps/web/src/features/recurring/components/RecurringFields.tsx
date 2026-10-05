import { Repeat } from 'lucide-react';
import type { RecurrenceFrequency } from '@fintrack/shared';
import { ChoiceGrid } from '../../../components/ui/ChoiceGrid';
import { formatDate } from '../../../lib/format';

const WEEKDAY_NAMES = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

/** Weekday (1 = Monday … 7) for weekly rules, day of the month for monthly ones, nothing otherwise. */
export function DayOfCycleField({
  frequency,
  value,
  onChange,
}: {
  frequency: RecurrenceFrequency;
  value: number;
  onChange: (day: number) => void;
}) {
  if (frequency === 'WEEKLY') {
    return (
      <ChoiceGrid
        label="Hafta kuni"
        size="sm"
        columns={4}
        phoneColumns={4}
        value={String(value)}
        onChange={(day) => onChange(Number(day))}
        options={WEEKDAY_NAMES.map((name, index) => ({ value: String(index + 1), label: name }))}
      />
    );
  }
  if (frequency === 'MONTHLY') {
    return (
      <ChoiceGrid
        label="Oy kuni"
        size="sm"
        columns={7}
        phoneColumns={7}
        value={String(value)}
        onChange={(day) => onChange(Number(day))}
        hint={value > 28 ? 'Qisqa oylarda oyning oxirgi kuni yoziladi' : undefined}
        options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
      />
    );
  }
  return null;
}

/** "Keyingi to‘lov: …" under the form, from the same schedule the API keeps. */
export function NextRunPreview({ next, today }: { next: string | null; today: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3.5 py-3 text-[14px] font-semibold" aria-live="polite">
      <Repeat className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
      <span className="text-pretty">
        {next
          ? `Keyingi to‘lov: ${formatDate(next)}${next === today ? ' (bugun yoziladi)' : ''}`
          : 'Tugash sanasidan keyin to‘lov yozilmaydi'}
      </span>
    </div>
  );
}
