import * as React from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FieldProps {
  id?: string;
  label?: React.ReactNode;
  /** Right side of the label row, e.g. "12/100". */
  counter?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label row, control, then either the error line or the hint — the frame every form field shares. */
export function Field({ id, label, counter, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {(label || counter) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={id} className="text-[13px] font-medium leading-[18px] text-text-secondary">
              {label}
            </label>
          )}
          {counter && <span className="text-[12px] leading-4 text-text-muted">{counter}</span>}
        </div>
      )}
      {children}
      {error ? <FieldError id={id ? `${id}-error` : undefined}>{error}</FieldError> : hint ? (
        <p className="text-[12.5px] leading-[17px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-[13px] font-medium leading-[18px] text-danger">
      <CircleAlert className="mt-px h-[15px] w-[15px]" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** A stable id for a field: the caller's, otherwise a generated one. */
export function useFieldId(id?: string): string {
  const generated = React.useId();
  return id ?? generated;
}
