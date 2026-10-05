import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

export interface SortableOptions {
  /** Items only change places inside their group (categories: siblings under one parent). */
  groupOf?: (id: string) => string | null;
  /** The new order, once a drag ends or a key moves an item. */
  onCommit: (ids: string[]) => void;
}

/** `id` moved to where `target` is now, inside one list. */
export function moveTo(ids: string[], id: string, target: string): string[] {
  const from = ids.indexOf(id);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

const KEY_STEP: Record<string, number> = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };

/**
 * Drag by a handle with mouse, finger or pen (HTML5 drag-and-drop has no touch support), or move
 * with the arrow keys. While dragging, the list shows `order`; it is committed when the pointer
 * is released.
 */
export function useSortable(ids: string[], { groupOf = () => null, onCommit }: SortableOptions) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const draftRef = useRef<string[] | null>(null);
  const order = draft ?? ids;

  const update = (next: string[] | null) => {
    draftRef.current = next;
    setDraft(next);
  };

  const finish = (commit: boolean) => {
    const next = draftRef.current;
    setDragId(null);
    update(null);
    if (commit && next && next.join() !== ids.join()) onCommit(next);
  };

  const handleProps = (id: string) => ({
    'aria-label': 'Sudrash',
    'aria-keyshortcuts': 'ArrowUp ArrowDown',
    tabIndex: 0,
    style: { touchAction: 'none', cursor: dragId === id ? 'grabbing' : 'grab' } satisfies CSSProperties,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragId(id);
      update(ids);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (dragId !== id || !draftRef.current) return;
      // The dragged item sits under the pointer itself: look through it for the one below.
      const target = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((el) => el.closest<HTMLElement>('[data-sort-id]')?.dataset.sortId)
        .find((found) => found && found !== id);
      if (!target || groupOf(target) !== groupOf(id)) return;
      const next = moveTo(draftRef.current, id, target);
      if (next !== draftRef.current) update(next);
    },
    onPointerUp: () => dragId === id && finish(true),
    onPointerCancel: () => dragId === id && finish(false),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const step = KEY_STEP[event.key];
      if (!step) return;
      event.preventDefault();
      const siblings = ids.filter((other) => groupOf(other) === groupOf(id));
      const neighbour = siblings[siblings.indexOf(id) + step];
      if (neighbour) onCommit(moveTo(ids, id, neighbour));
    },
  });

  const itemProps = (id: string) => ({ 'data-sort-id': id });

  return { order, dragId, handleProps, itemProps };
}
