import * as React from 'react';
import { cn } from '../../lib/utils';
import { Field, useFieldId } from './Field';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

/** Two rows, no resize, "n/500" counter when maxLength is set. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, wrapperClassName, label, error, hint, id, rows = 2, maxLength, ...props }, ref) => {
    const fieldId = useFieldId(id);
    const length = typeof props.value === 'string' ? props.value.length : 0;
    return (
      <Field
        id={fieldId}
        label={label}
        hint={hint}
        error={error}
        counter={maxLength ? `${length}/${maxLength}` : undefined}
        className={wrapperClassName}
      >
        <textarea
          id={fieldId}
          ref={ref}
          rows={rows}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          className={cn(
            'w-full resize-none rounded-md border border-input bg-card px-3.5 py-3 text-[15px] leading-[22px] text-text shadow-xs transition-[border-color,box-shadow] duration-fast placeholder:text-text-muted field-focus',
            error && 'border-danger',
            className,
          )}
          {...props}
        />
      </Field>
    );
  },
);
Textarea.displayName = 'Textarea';
