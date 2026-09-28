import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInitOnOpen } from './useInitOnOpen';

describe('useInitOnOpen', () => {
  it('waits for the data, runs once per opening and ignores later re-renders', () => {
    const init = vi.fn();
    const { rerender } = renderHook(({ open, ready }) => useInitOnOpen(open, ready, init), {
      initialProps: { open: false, ready: false },
    });
    expect(init).not.toHaveBeenCalled();

    rerender({ open: true, ready: false });
    expect(init).not.toHaveBeenCalled();

    rerender({ open: true, ready: true });
    rerender({ open: true, ready: true }); // e.g. a refetch while the user types
    expect(init).toHaveBeenCalledTimes(1);

    rerender({ open: false, ready: true });
    rerender({ open: true, ready: true });
    expect(init).toHaveBeenCalledTimes(2);
  });

  it('uses the latest init function', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useInitOnOpen(true, false, fn), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    renderHook(() => useInitOnOpen(true, true, second));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
