import * as React from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EXIT_MS, popMotion, usePresence } from '../../lib/motion';
import { Field, useFieldId } from './Field';
import { useDismiss } from './Popover';

export interface DropdownOption {
  value: string;
  label: string;
  /** Emoji or icon shown in a small tile before the label. */
  icon?: React.ReactNode;
  /** 1 = child row, indented (category trees). */
  depth?: 0 | 1;
  /** Muted text on the right, e.g. a balance or "UTC+5". */
  meta?: React.ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  /** field: 48px form control; pill: 38px filter trigger that turns solid when a value is set. */
  variant?: 'field' | 'pill';
  label?: string;
  /** Text on the trigger when nothing (or the "all" value) is selected. */
  placeholder?: string;
  /** For pill filters: the value meaning "no filter", e.g. "". */
  emptyValue?: string;
  /** Pill only: an icon before the text (the sort control). */
  icon?: React.ReactNode;
  /** Pill only: a sort is never "set", so it keeps the plain look. */
  plain?: boolean;
  error?: string;
  /** Renders the list in place instead of floating (mobile filter sheet). */
  inline?: boolean;
  align?: 'start' | 'end';
  listClassName?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/** Custom select from the design: trigger plus a listbox with ✓ on the chosen row. */
export function Dropdown({
  value,
  onChange,
  options,
  variant = 'field',
  label,
  placeholder = 'Tanlang',
  emptyValue,
  icon,
  plain = false,
  error,
  inline = false,
  align = 'start',
  listClassName,
  className,
  id,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const fieldId = useFieldId(id);
  const listId = `${fieldId}-list`;
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const close = React.useCallback(() => setOpen(false), []);
  useDismiss([rootRef], open && !inline, close);
  // An inline list sits in the page flow, so it just appears and goes; a floating one pops.
  const floating = usePresence(open && !inline, EXIT_MS.base);

  const selected = options.find((o) => o.value === value);
  const isSet = emptyValue !== undefined ? value !== emptyValue : Boolean(selected);
  const solid = (isSet && !plain) || open;

  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open || active < 0) return;
    const node = listRef.current?.children[active] as HTMLElement | undefined;
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const choose = (option: DropdownOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const move = (step: number) => {
    if (options.length === 0) return;
    let next = active;
    for (let i = 0; i < options.length; i += 1) {
      next = (next + step + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActive(next);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (options[active]) choose(options[active]);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const Chevron = open ? ChevronUp : ChevronDown;
  const trigger =
    variant === 'pill' ? (
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          'inline-flex h-[38px] max-w-full items-center gap-1.5 rounded-full border pl-3.5 pr-3 text-[13.5px] font-medium transition-colors duration-fast focus-ring',
          solid ? 'border-text bg-secondary text-text' : 'border-input bg-card text-text hover:bg-secondary',
          className,
        )}
      >
        {icon}
        <span className="truncate">{isSet && selected ? selected.label : placeholder}</span>
        <Chevron className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
      </button>
    ) : (
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={error ? true : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-12 w-full items-center gap-2.5 rounded-md border bg-card px-3.5 text-left text-[15px] shadow-xs transition-[border-color,box-shadow] duration-fast field-focus',
          error ? 'border-danger' : 'border-input',
          open && 'border-ring shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)]',
          className,
        )}
      >
        {selected?.icon && <span className="shrink-0 text-[17px] leading-none">{selected.icon}</span>}
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-text-muted')}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.meta && <span className="shrink-0 text-[12.5px] text-text-muted">{selected.meta}</span>}
        <Chevron className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
      </button>
    );

  const list = (inline ? open : floating.mounted) && (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-labelledby={fieldId}
      aria-hidden={floating.closing || undefined}
      tabIndex={-1}
      className={cn(
        'max-h-[380px] overflow-y-auto rounded-lg border border-border bg-popover p-1.5',
        inline
          ? 'mt-2'
          : cn(
              'absolute top-full z-40 mt-1.5 min-w-[240px] shadow-md',
              align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
              popMotion(floating.closing),
            ),
        listClassName,
      )}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <li
            key={option.value}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            onMouseEnter={() => setActive(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
            className={cn(
              'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[10px] pr-2.5 text-[14px]',
              option.depth === 1 ? 'pl-[30px] font-normal' : 'pl-2.5 font-medium',
              isSelected ? 'bg-secondary' : index === active && 'bg-secondary/60',
              option.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            {option.icon && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-secondary text-[15px] leading-none">
                {option.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.meta && <span className="shrink-0 text-[12.5px] text-text-muted">{option.meta}</span>}
            <span className="flex w-4 shrink-0 justify-center">
              {isSelected && <Check className="h-4 w-4" aria-hidden />}
            </span>
          </li>
        );
      })}
    </ul>
  );

  const body = (
    <div ref={rootRef} className={cn('relative', variant === 'pill' ? 'inline-flex flex-col' : 'w-full')}>
      {trigger}
      {list}
    </div>
  );

  if (variant === 'pill') return body;
  return (
    <Field id={fieldId} label={label} error={error}>
      {body}
    </Field>
  );
}
