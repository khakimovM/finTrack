import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useCreateTag, useTags } from '../../tags/hooks/useTags';

export interface TagPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

/** "#tag" toggles plus an inline "+ Yangi teg" that creates the tag and selects it. */
export function TagPicker({ value, onChange }: TagPickerProps) {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [draft, setDraft] = useState<string | null>(null);
  // Enter closes the input, and the blur that follows must not add the tag a second time.
  const committing = useRef(false);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const commit = async () => {
    if (committing.current) return;
    committing.current = true;
    const name = (draft ?? '').trim().replace(/^#+/, '').toLowerCase();
    setDraft(null);
    try {
      if (!name) return;
      const existing = tags.find((t) => t.name.toLowerCase() === name);
      if (existing) {
        if (!value.includes(existing.id)) onChange([...value, existing.id]);
        return;
      }
      const created = await createTag.mutateAsync({ name, color: '#94a3b8' }).catch(() => null);
      if (created) onChange([...value, created.id]);
    } finally {
      committing.current = false;
    }
  };

  return (
    <div role="group" aria-labelledby="tag-picker-label" className="flex flex-col gap-2">
      <span id="tag-picker-label" className="text-[13px] font-medium text-text-secondary">
        Teglar
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => {
          const on = value.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(tag.id)}
              className={cn(
                'focus-ring inline-flex h-8 items-center gap-1 rounded-[8px] border px-3 text-[13px] font-medium transition-colors duration-fast',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary text-text-secondary hover:text-text',
              )}
            >
              {on && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}#{tag.name}
            </button>
          );
        })}
        {draft !== null ? (
          <input
            autoFocus
            value={draft}
            maxLength={30}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              }
              if (e.key === 'Escape') {
                // The dialog would close on the same Escape.
                e.stopPropagation();
                setDraft(null);
              }
            }}
            onBlur={() => void commit()}
            placeholder="teg nomi"
            aria-label="Yangi teg"
            className="h-8 w-[120px] rounded-[8px] border border-ring bg-card px-2.5 text-[13px] font-medium text-text shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)] outline-none placeholder:text-text-muted"
          />
        ) : (
          <button
            type="button"
            onClick={() => setDraft('')}
            disabled={createTag.isPending}
            className="focus-ring h-8 rounded-[8px] border border-dashed border-input px-3 text-[13px] font-medium text-text-secondary transition-colors duration-fast hover:text-text"
          >
            + Yangi teg
          </button>
        )}
      </div>
    </div>
  );
}
