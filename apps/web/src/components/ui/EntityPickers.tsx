import * as React from 'react';
import { Check, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatAmount } from '../../lib/money';
import { EmojiTile } from './EmojiTile';
import { Field, useFieldId } from './Field';
import { useDismiss } from './Popover';

export interface PickerAccount {
  id: string;
  name: string;
  icon: string;
  color: string;
  balance: string;
}

export interface PickerCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  children?: PickerCategory[];
}

const triggerClasses =
  'flex h-14 w-full items-center gap-3 rounded-md border bg-card pl-2 pr-3.5 text-left shadow-xs transition-[border-color,box-shadow] duration-fast field-focus';
const openRing = 'border-ring shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)]';

/** Shared open/close + keyboard plumbing of the two pickers. */
function usePicker() {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss([rootRef], open, close);
  return { open, setOpen, rootRef, triggerRef, close };
}

export interface AccountPickerProps {
  label?: string;
  accounts: PickerAccount[];
  value: string;
  onChange: (id: string) => void;
  /** The other side of a transfer: shown but not selectable. */
  disabledId?: string;
  disabledHint?: string;
  error?: string;
  /** Red border without a message (strict-mode error shown elsewhere). */
  invalid?: boolean;
  className?: string;
}

/** Emoji tile, name and balance; the list opens in place under the field. */
export function AccountPicker({
  label,
  accounts,
  value,
  onChange,
  disabledId,
  disabledHint = 'Jo‘natuvchi hisob',
  error,
  invalid,
  className,
}: AccountPickerProps) {
  const fieldId = useFieldId();
  const { open, setOpen, rootRef, triggerRef } = usePicker();
  const selected = accounts.find((a) => a.id === value);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <Field id={fieldId} label={label} error={error} className={className}>
      <div ref={rootRef} className="flex flex-col gap-1.5">
        <button
          ref={triggerRef}
          id={fieldId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          className={cn(triggerClasses, error || invalid ? 'border-danger' : 'border-input', open && openRing)}
        >
          {selected ? (
            <>
              <EmojiTile emoji={selected.icon} color={selected.color} size={40} className="rounded-[10px]" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium text-text">{selected.name}</span>
                <span className="text-[13px] text-text-muted">{formatAmount(selected.balance, { sign: 'negative' })}</span>
              </span>
            </>
          ) : (
            <span className="flex-1 pl-2 text-[15px] text-text-muted">Hisobni tanlang</span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-text-muted" aria-hidden /> : <ChevronDown className="h-4 w-4 text-text-muted" aria-hidden />}
        </button>
        {open && (
          <ul role="listbox" aria-labelledby={fieldId} className="rounded-lg border border-border bg-popover p-1.5 shadow-md">
            {accounts.map((account) => {
              const disabled = account.id === disabledId;
              const on = account.id === value;
              return (
                <li key={account.id} role="option" aria-selected={on} aria-disabled={disabled || undefined}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => choose(account.id)}
                    className={cn(
                      'flex min-h-12 w-full items-center gap-2.5 rounded-[10px] px-2 text-left focus-ring disabled:cursor-not-allowed disabled:opacity-45',
                      on ? 'bg-secondary' : 'hover:bg-secondary',
                    )}
                  >
                    <EmojiTile emoji={account.icon} color={account.color} size={32} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium">{account.name}</span>
                      {disabled && <span className="text-[12px] text-text-muted">{disabledHint}</span>}
                    </span>
                    <span className="shrink-0 text-[13px] text-text-muted">{formatAmount(account.balance, { sign: 'negative' })}</span>
                    <span className="flex w-4 shrink-0 justify-center">{on && <Check className="h-4 w-4" aria-hidden />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Field>
  );
}

export interface CategoryPickerProps {
  label?: string;
  /** Top-level categories of the current type, children nested. */
  categories: PickerCategory[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  className?: string;
}

/** Search, then parents (bold) with their children indented; only one type is ever offered. */
export function CategoryPicker({ label, categories, value, onChange, error, className }: CategoryPickerProps) {
  const fieldId = useFieldId();
  const { open, setOpen, rootRef, triggerRef } = usePicker();
  const [query, setQuery] = React.useState('');

  const flat = React.useMemo(
    () =>
      categories.flatMap((parent) => [
        { category: parent, parent: null as PickerCategory | null },
        ...(parent.children ?? []).map((child) => ({ category: child, parent })),
      ]),
    [categories],
  );
  const selected = flat.find((row) => row.category.id === value);
  const needle = query.trim().toLowerCase();
  const rows = needle
    ? flat.filter(
        (row) =>
          row.category.name.toLowerCase().includes(needle) || row.parent?.name.toLowerCase().includes(needle),
      )
    : flat;

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  return (
    <Field id={fieldId} label={label} error={error} className={className}>
      <div ref={rootRef} className="flex flex-col gap-1.5">
        <button
          ref={triggerRef}
          id={fieldId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(triggerClasses, error ? 'border-danger' : 'border-input', open && openRing)}
        >
          {selected ? (
            <>
              <EmojiTile emoji={selected.category.icon} color={selected.category.color} size={40} className="rounded-[10px]" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium text-text">{selected.category.name}</span>
                {selected.parent && <span className="text-[12.5px] text-text-muted">{selected.parent.name}</span>}
              </span>
            </>
          ) : (
            <>
              <EmojiTile emoji="📁" variant="neutral" size={40} className="rounded-[10px]" />
              <span className="flex-1 text-[15px] text-text-muted">Kategoriyani tanlang</span>
            </>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-text-muted" aria-hidden /> : <ChevronDown className="h-4 w-4 text-text-muted" aria-hidden />}
        </button>
        {open && (
          <div className="overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            <div className="flex h-[42px] items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-text-muted" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && rows[0]) {
                    e.preventDefault();
                    choose(rows[0].category.id);
                  }
                }}
                placeholder="Kategoriyani qidirish…"
                aria-label="Kategoriyani qidirish"
                className="h-full w-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-text-muted"
              />
            </div>
            <ul role="listbox" aria-labelledby={fieldId} className="max-h-[248px] overflow-y-auto p-1.5">
              {rows.length === 0 && <li className="px-3 py-3 text-[14px] text-text-muted">Hech narsa topilmadi</li>}
              {rows.map(({ category, parent }) => {
                const on = category.id === value;
                return (
                  <li key={category.id} role="option" aria-selected={on}>
                    <button
                      type="button"
                      onClick={() => choose(category.id)}
                      className={cn(
                        'flex h-[42px] w-full items-center gap-2.5 rounded-[10px] pr-2.5 text-left text-[14px] focus-ring',
                        parent ? 'pl-10 font-normal' : 'pl-2.5 font-semibold',
                        on ? 'bg-secondary' : 'hover:bg-secondary',
                      )}
                    >
                      <EmojiTile emoji={category.icon} color={category.color} size={28} />
                      <span className="min-w-0 flex-1 truncate">{category.name}</span>
                      {on && <Check className="h-4 w-4" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Field>
  );
}
