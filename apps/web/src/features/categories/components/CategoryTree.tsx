import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CategoryResponse, ReorderCategoriesInput } from '@fintrack/shared';
import { EmojiTile } from '../../../components/ui/EmojiTile';
import { SystemChip } from '../../../components/ui/Chip';
import { useSortable } from '../../../lib/useSortable';
import { cn } from '../../../lib/utils';

export interface CategoryTreeProps {
  /** Top-level categories of one type, children nested, in their saved order. */
  categories: CategoryResponse[];
  compact: boolean;
  onAddChild: (parent: CategoryResponse) => void;
  onEdit: (category: CategoryResponse) => void;
  onDelete: (category: CategoryResponse) => void;
  onReorder: (items: ReorderCategoriesInput['items']) => void;
}

/** Parents keep their children right under them, whatever order the flat list ended in. */
export function regroup(order: string[], parentOf: Map<string, string | null>): string[] {
  const tops = order.filter((id) => !parentOf.get(id));
  return tops.flatMap((top) => [top, ...order.filter((id) => parentOf.get(id) === top)]);
}

/** Only the sibling groups whose order changed, numbered from 1. */
export function changedGroups(before: string[], after: string[], parentOf: Map<string, string | null>) {
  const groupOf = (id: string) => parentOf.get(id) ?? '';
  const groups = new Set(after.map(groupOf));
  const items: ReorderCategoriesInput['items'] = [];
  for (const group of groups) {
    const was = before.filter((id) => groupOf(id) === group);
    const now = after.filter((id) => groupOf(id) === group);
    if (was.join() !== now.join()) now.forEach((id, index) => items.push({ id, sortOrder: index + 1 }));
  }
  return items;
}

export function CategoryTree({ categories, compact, onAddChild, onEdit, onDelete, onReorder }: CategoryTreeProps) {
  const byId = new Map<string, CategoryResponse>();
  const parentOf = new Map<string, string | null>();
  for (const parent of categories) {
    byId.set(parent.id, parent);
    parentOf.set(parent.id, null);
    for (const child of parent.children ?? []) {
      byId.set(child.id, child);
      parentOf.set(child.id, parent.id);
    }
  }
  const saved = categories.flatMap((p) => [p.id, ...(p.children ?? []).map((c) => c.id)]);

  const sortable = useSortable(saved, {
    groupOf: (id) => parentOf.get(id) ?? 'root',
    onCommit: (order) => {
      const items = changedGroups(saved, regroup(order, parentOf), parentOf);
      if (items.length > 0) onReorder(items);
    },
  });
  const rows = regroup(sortable.order, parentOf);

  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-card">
      {rows.map((id, index) => {
        const category = byId.get(id);
        if (!category) return null;
        const child = category.parentId !== null;
        const kids = categories.find((p) => p.id === id)?.children?.length ?? 0;
        return (
          <div
            key={id}
            {...sortable.itemProps(id)}
            className={cn(
              'flex items-center py-1.5 pr-2.5 transition-colors duration-fast hover:bg-surface',
              compact ? 'gap-2' : 'gap-3',
              child ? cn('min-h-[52px]', compact ? 'pl-[22px]' : 'pl-9') : 'min-h-16 pl-2.5',
              !child && index > 0 && 'border-t border-border',
              sortable.dragId === id && 'bg-surface opacity-50',
            )}
          >
            <span {...sortable.handleProps(id)} className="flex w-5 shrink-0 justify-center rounded-sm text-text-muted focus-ring">
              <GripVertical className="h-4 w-4" aria-hidden />
            </span>
            {child && (
              <span
                aria-hidden
                className="-ml-1.5 -mt-3.5 h-[22px] w-3.5 shrink-0 rounded-bl-[8px] border-b-[1.5px] border-l-[1.5px] border-border"
              />
            )}
            <EmojiTile
              emoji={category.icon}
              color={category.color}
              size={child ? 34 : 40}
              className={cn('rounded-[11px]', child ? 'text-[16px]' : 'text-[19px]')}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn('truncate text-[15px] leading-5', child ? 'font-medium' : 'font-semibold')}>{category.name}</span>
                {category.isSystem && <SystemChip />}
              </span>
              {!child && kids > 0 && <span className="text-[12.5px] leading-[17px] text-text-muted">{kids} ta subkategoriya</span>}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {!child && (
                <button
                  type="button"
                  onClick={() => onAddChild(category)}
                  aria-label="Subkategoriya qo‘shish"
                  title="+ Subkategoriya"
                  className={cn(
                    'flex h-[34px] items-center gap-1 whitespace-nowrap rounded-full text-[13px] font-medium text-text-secondary hover:bg-secondary hover:text-text focus-ring',
                    compact ? 'px-[9px]' : 'px-3',
                  )}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {!compact && 'Subkategoriya'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onEdit(category)}
                aria-label="Tahrirlash"
                title="Tahrirlash"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-text-secondary hover:bg-secondary hover:text-text focus-ring"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              {category.isSystem ? (
                <span className="w-[34px]" aria-hidden />
              ) : (
                <button
                  type="button"
                  onClick={() => onDelete(category)}
                  aria-label="O‘chirish"
                  title="O‘chirish"
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-text-secondary hover:bg-danger-soft hover:text-danger focus-ring"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
