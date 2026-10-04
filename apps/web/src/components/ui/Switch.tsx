import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/** 44×26 track; with a label the whole row is the (≥44px) hit target. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  id,
  'aria-label': ariaLabel,
}: SwitchProps) {
  const generated = React.useId();
  const switchId = id ?? generated;
  const labelId = `${switchId}-label`;
  const descriptionId = description ? `${switchId}-description` : undefined;

  const track = (
    <span
      aria-hidden
      className={cn(
        'flex h-[26px] w-11 shrink-0 items-center rounded-full p-[3px] transition-colors duration-fast',
        checked ? 'justify-end bg-primary' : 'justify-start bg-input',
      )}
    >
      <span className="h-5 w-5 rounded-full bg-card shadow-sm" />
    </span>
  );

  return (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={descriptionId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full min-h-11 items-center gap-4 rounded-md text-left focus-ring disabled:cursor-not-allowed disabled:opacity-40',
        !label && 'w-auto',
        className,
      )}
    >
      {label && (
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span id={labelId} className="text-[15px] font-medium text-text">
            {label}
          </span>
          {description && (
            <span id={descriptionId} className="text-[13px] leading-[18px] text-text-secondary">
              {description}
            </span>
          )}
        </span>
      )}
      {track}
    </button>
  );
}
