import { useEffect, useRef } from 'react';

/**
 * Runs `init` once per opening of a dialog, as soon as the data it needs is `ready`. A background
 * refetch hands the dialog new arrays; re-running the initialisation then would overwrite what the
 * user is typing, so later renders of the same opening never call it again.
 */
export function useInitOnOpen(isOpen: boolean, ready: boolean, init: () => void): void {
  const initRef = useRef(init);
  initRef.current = init;
  const doneRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      doneRef.current = false;
      return;
    }
    if (doneRef.current || !ready) return;
    doneRef.current = true;
    initRef.current();
  }, [isOpen, ready]);
}
