import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { TagResponse } from '@fintrack/shared';
import { CHART_COLORS, CHART_COLOR_NAMES, chartIndexOf, colorVar } from '../../../lib/colors';
import { cn } from '../../../lib/utils';
import { useCreateTag, useUpdateTag } from '../hooks/useTags';

interface Draft {
  /** null: a new tag. */
  id: string | null;
  name: string;
  color: string;
  error: string | null;
}

export interface TagsPanelProps {
  tags: TagResponse[];
  compact: boolean;
  /** Bumped by the page's "Yangi teg" button to open an empty editor. */
  newTagSignal: number;
  onOpen: (tag: TagResponse) => void;
  onDelete: (tag: TagResponse) => void;
}

const iconButton = 'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-text-secondary focus-ring';

export function TagsPanel({ tags, compact, newTagSignal, onOpen, onDelete }: TagsPanelProps) {
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const blank = (): Draft => ({ id: null, name: '', color: CHART_COLORS[0], error: null });
  // Mounted by the empty state's button: start with the editor open.
  const [current, setCurrent] = useState<Draft | null>(() => (newTagSignal > 0 ? blank() : null));
  const [signal, setSignal] = useState(newTagSignal);
  if (signal !== newTagSignal) {
    setSignal(newTagSignal);
    setCurrent(blank());
  }

  const close = () => setCurrent(null);
  const change = (patch: Partial<Draft>) => setCurrent((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    if (!current) return;
    const name = current.name.trim().replace(/^#+/, '').toLowerCase();
    if (!name) return change({ error: 'Teg nomini kiriting' });
    if (tags.some((t) => t.id !== current.id && t.name.toLowerCase() === name)) return change({ error: 'Bunday teg allaqachon mavjud' });
    try {
      if (current.id === null) await createTag.mutateAsync({ name, color: current.color });
      else await updateTag.mutateAsync({ id: current.id, data: { name, color: current.color } });
      close();
    } catch {
      // The hook has already said why.
    }
  };

  const editor = current && (
    <div
      key={current.id ?? 'new'}
      className="flex flex-col gap-3 rounded-2xl border border-ring bg-card px-4 py-3.5 shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_18%,transparent)]"
    >
      <div className={cn('flex h-[42px] items-center gap-2 rounded-[10px] border bg-card px-3', current.error ? 'border-danger' : 'border-input')}>
        <span className="font-semibold text-text-muted">#</span>
        <input
          autoFocus
          value={current.name}
          maxLength={30}
          onChange={(e) => change({ name: e.target.value, error: null })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
            if (e.key === 'Escape') close();
          }}
          placeholder="teg nomi"
          aria-label="Teg nomi"
          aria-invalid={current.error ? true : undefined}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-text outline-none placeholder:text-text-muted"
        />
        <span className="text-[12px] text-text-muted">{current.name.length}/30</span>
      </div>
      {current.error && (
        <span role="alert" className="-mt-1 text-[12.5px] font-medium text-danger">
          {current.error}
        </span>
      )}
      <div role="radiogroup" aria-label="Rang" className="flex flex-wrap gap-1.5">
        {CHART_COLORS.map((hex, index) => {
          const on = chartIndexOf(current.color) === index + 1;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={CHART_COLOR_NAMES[index]}
              onClick={() => change({ color: hex })}
              className={cn('h-7 w-7 rounded-full focus-ring', on && 'shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--text)]')}
              style={{ background: `var(--chart-${index + 1})` }}
            />
          );
        })}
      </div>
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={close} className="h-[34px] rounded-full bg-secondary px-3.5 text-[13px] font-medium text-text focus-ring">
          Bekor qilish
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={createTag.isPending || updateTag.isPending}
          className="h-[34px] rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-foreground focus-ring disabled:opacity-60"
        >
          Saqlash
        </button>
      </div>
    </div>
  );

  return (
    <div className={cn('grid items-start gap-3', compact ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(260px,1fr))]')}>
      {tags.map((tag) =>
        current?.id === tag.id ? (
          editor
        ) : (
          <div
            key={tag.id}
            onClick={() => onOpen(tag)}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card py-3.5 pl-4 pr-2.5 transition-colors duration-fast hover:border-input"
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorVar(tag.color) }} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-semibold leading-5">#{tag.name}</span>
              <span className="text-[12.5px] leading-[17px] text-text-muted">{tag.transactionCount} ta tranzaksiya</span>
            </div>
            <button
              type="button"
              aria-label="Tahrirlash"
              onClick={(e) => {
                e.stopPropagation();
                setCurrent({ id: tag.id, name: tag.name, color: tag.color, error: null });
              }}
              className={cn(iconButton, 'hover:bg-secondary hover:text-text')}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="O‘chirish"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(tag);
              }}
              className={cn(iconButton, 'hover:bg-danger-soft hover:text-danger')}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ),
      )}
      {current?.id === null && editor}
      {!current && (
        <button
          type="button"
          onClick={() => setCurrent(blank())}
          className="flex min-h-[72px] items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-input text-[14px] font-medium text-text-secondary transition-colors duration-fast hover:bg-card hover:text-text focus-ring"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Yangi teg
        </button>
      )}
    </div>
  );
}
