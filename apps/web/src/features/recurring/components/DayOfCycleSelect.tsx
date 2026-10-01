import { forwardRef } from 'react';
import { RecurrenceFrequency } from '@fintrack/shared';
import { Select, SelectProps } from '../../../components/ui/Select';
import { WEEKDAYS } from '../recurringLabels';

const WEEKDAY_OPTIONS = WEEKDAYS.map((name, i) => ({
  value: String(i + 1),
  label: name[0].toUpperCase() + name.slice(1),
}));
const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}-kuni`,
}));

/** Weekday for weekly rules, day of month for monthly ones (API dayOfCycle). */
export const DayOfCycleSelect = forwardRef<
  HTMLSelectElement,
  Omit<SelectProps, 'options' | 'label'> & { frequency: RecurrenceFrequency }
>(({ frequency, ...props }, ref) => (
  <Select
    ref={ref}
    label={frequency === 'WEEKLY' ? 'Hafta kuni' : 'Oy kuni'}
    options={frequency === 'WEEKLY' ? WEEKDAY_OPTIONS : MONTH_DAY_OPTIONS}
    {...props}
  />
));

DayOfCycleSelect.displayName = 'DayOfCycleSelect';
