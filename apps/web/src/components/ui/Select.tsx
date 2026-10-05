import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Field, useFieldId } from './Field';
import { inputClasses } from './Input';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
  wrapperClassName?: string;
}

/** Native select in the input style; used where the platform picker is the better UX (phones). */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, label, error, hint, id, options, children, ...props }, ref) => {
    const selectId = useFieldId(id);
    return (
      <Field id={selectId} label={label} hint={hint} error={error} className={wrapperClassName}>
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={error ? true : undefined}
            className={cn(inputClasses, 'appearance-none pr-10', error && 'border-danger', className)}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
        </div>
      </Field>
    );
  },
);

Select.displayName = 'Select';
