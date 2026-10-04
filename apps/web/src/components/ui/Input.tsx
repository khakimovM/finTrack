import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Field, useFieldId } from './Field';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Shows "n/max" next to the label (needs maxLength). */
  showCounter?: boolean;
  wrapperClassName?: string;
}

export const inputClasses =
  'flex h-12 w-full rounded-md border border-input bg-card px-3.5 text-[15px] text-text shadow-xs transition-[border-color,box-shadow] duration-fast placeholder:text-text-muted field-focus disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-text-muted';

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, wrapperClassName, type, label, error, hint, showCounter, id, maxLength, ...props }, ref) => {
    const inputId = useFieldId(id);
    const length = typeof props.value === 'string' ? props.value.length : undefined;
    return (
      <Field
        id={inputId}
        label={label}
        hint={hint}
        error={error}
        counter={showCounter && maxLength && length !== undefined ? `${length}/${maxLength}` : undefined}
        className={wrapperClassName}
      >
        <input
          id={inputId}
          ref={ref}
          type={type}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(inputClasses, error && 'border-danger', className)}
          {...props}
        />
      </Field>
    );
  },
);
Input.displayName = 'Input';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

/** The pill search field of lists: icon on the left, a clear button once there is text. */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, className, placeholder = 'Qidiruv', ...props }, ref) => (
    <div
      className={cn(
        'flex h-11 min-w-0 items-center gap-2 rounded-full border border-input bg-card pl-3.5 pr-1.5 shadow-xs field-focus',
        className,
      )}
    >
      <Search className="h-[17px] w-[17px] shrink-0 text-text-muted" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={props['aria-label'] ?? placeholder}
        className="h-full w-full min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Qidiruvni tozalash"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-text-secondary hover:bg-secondary-hover focus-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  ),
);
SearchInput.displayName = 'SearchInput';
